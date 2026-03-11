/**
 * Integration tests for OnboardingWorkoutPlannerService and OnboardingNutritionMenuService.
 *
 * These tests hit the real Gemini API and real MongoDB.
 * All DB documents created during the test are deleted in the finally block.
 *
 * Run both:
 *   node --test server/tests/integration.onboardingPlanners.test.js
 *
 * Run only one:
 *   TEST_ONLY=nutrition node --test server/tests/integration.onboardingPlanners.test.js
 *   TEST_ONLY=workout  node --test server/tests/integration.onboardingPlanners.test.js
 *
 * Required env (from server/.env):
 *   MONGO_URI, GEMINI_API_KEY, GEMINI_MODEL, ONBOARDING_AI_PLANNER_MAX_OUTPUT_TOKENS
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Override rate-limit retry settings for integration tests so retries wait long
// enough for Gemini's 60-second RPM window to reset.
process.env.ONBOARDING_AI_PLANNER_RATE_LIMIT_RETRY_DELAY_MS = '65000';
process.env.ONBOARDING_AI_PLANNER_RATE_LIMIT_MAX_RETRIES = '3';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const User = require('../models/User');
const Workout = require('../models/Workout');
const NutritionMenu = require('../models/NutritionMenu');
const OnboardingWorkoutPlannerService = require('../services/onboardingWorkoutPlannerService');
const OnboardingNutritionMenuService = require('../services/onboardingNutritionMenuService');

const TEST_EMAIL_PREFIX = 'integration-test-planner';
const TIMEOUT_MS = 300_000; // 5 min — allows for one 65s retry cycle
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_WAIT_MS = 240_000; // 4 min poll window

// Gap between the two tests to avoid hitting the Gemini rate limit back-to-back.
// Skipped when running a single test in isolation (TEST_ONLY=nutrition|workout).
const INTER_TEST_PAUSE_MS = 65_000;

// Set TEST_ONLY=nutrition or TEST_ONLY=workout to run a single test.
const TEST_ONLY = (process.env.TEST_ONLY || '').toLowerCase().trim();
const runWorkout = !TEST_ONLY || TEST_ONLY === 'workout';
const runNutrition = !TEST_ONLY || TEST_ONLY === 'nutrition';
// Only insert the inter-test pause when both tests run back-to-back.
const needsPause = runWorkout && runNutrition;

async function connectDB() {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGO_URI);
    }
}

async function disconnectDB() {
    // Give any in-flight DB writes a moment to land before disconnecting.
    await new Promise((r) => setTimeout(r, 500));
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
}

async function createTestUser() {
    const email = `${TEST_EMAIL_PREFIX}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.invalid`;
    return User.create({
        name: 'Integration Test User',
        email,
        password: 'hashed_not_used',
        profile: {
            age: 28,
            gender: 'male',
            height: 178,
            weight: 80,
            goal: 'muscle_gain',
            experience_level: 'intermediate',
            workout_days_per_week: 4,
            session_duration: 60,
            environment: 'commercial_gym',
            diet_type: 'everything',
            target_calories: 2500,
            protein_goal: 180,
            carbs_goal: 250,
            fat_goal: 70,
            tdee: 2300,
            activity_level: 'moderately_active',
            onboarding_completed: true,
            plan_choice: 'ai',
            has_existing_plan: false,
            nutrition_plan_choice: 'ai',
            workout_plan_status: 'pending',
            nutrition_plan_status: 'pending',
        },
    });
}

/**
 * Poll the user document until the given statusField reaches 'ready' or 'failed',
 * or until the timeout expires.
 */
async function pollUntilDone(userId, statusField) {
    const deadline = Date.now() + POLL_MAX_WAIT_MS;
    while (Date.now() < deadline) {
        const u = await User.findById(userId).select(`profile.${statusField}`).lean();
        const status = u?.profile?.[statusField];
        if (status === 'ready' || status === 'failed') return status;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    return 'timeout';
}

// ─── Workout Planner ──────────────────────────────────────────────────────────

test('OnboardingWorkoutPlannerService generates a real workout plan', {
    timeout: TIMEOUT_MS,
    skip: !runWorkout,
}, async () => {
    await connectDB();

    let userId = null;
    try {
        const user = await createTestUser();
        userId = user._id;

        const service = new OnboardingWorkoutPlannerService();
        let outcome = await service.ensurePlanForUser({
            userId: String(userId),
            requestId: `integration-workout-${Date.now()}`,
            trigger: 'integration_test',
        });

        // If rate-limited, wait for the scheduled retry to complete
        if (outcome.status === 'pending') {
            console.log('[workout] Rate-limited — polling for retry completion…');
            const finalStatus = await pollUntilDone(userId, 'workout_plan_status');
            assert.equal(finalStatus, 'ready', `Workout plan did not reach ready after retry, got: ${finalStatus}`);
            outcome = { triggered: true, status: 'ready' };
        }

        assert.equal(outcome.triggered, true, `Expected triggered=true, got: ${JSON.stringify(outcome)}`);
        assert.equal(outcome.status, 'ready', `Expected status=ready, got: ${outcome.status}`);

        const workouts = await Workout.find({ user: userId, archived: { $ne: true } });
        assert.ok(workouts.length >= 1, `Expected workouts in DB, found: ${workouts.length}`);

        const updatedUser = await User.findById(userId);
        assert.equal(updatedUser.profile.workout_plan_status, 'ready');
        assert.equal(updatedUser.profile.has_existing_plan, true);
        assert.ok(updatedUser.profile.workout_plan_generated_at instanceof Date);

        console.log(`[workout] workoutsInDB=${workouts.length}`);
    } finally {
        if (userId) {
            await Promise.all([
                User.deleteOne({ _id: userId }),
                Workout.deleteMany({ user: userId }),
            ]);
        }
        await disconnectDB();
    }
});

// ─── Nutrition Menu ───────────────────────────────────────────────────────────

test('OnboardingNutritionMenuService generates a real AI nutrition menu', {
    timeout: TIMEOUT_MS,
    skip: !runNutrition,
}, async () => {
    // Give the API rate limit a breather after the workout planner test.
    if (needsPause) {
        console.log(`[nutrition] Waiting ${INTER_TEST_PAUSE_MS / 1000}s before starting to avoid rate limits…`);
        await new Promise((r) => setTimeout(r, INTER_TEST_PAUSE_MS));
    }

    await connectDB();

    let userId = null;
    try {
        const user = await createTestUser();
        userId = user._id;

        const service = new OnboardingNutritionMenuService();
        let outcome = await service.ensureMenuForUser({
            userId: String(userId),
            requestId: `integration-nutrition-${Date.now()}`,
            trigger: 'integration_test',
        });

        // If rate-limited, keep the DB connection open and poll for the retry to complete
        if (outcome.status === 'pending') {
            console.log('[nutrition] Rate-limited — polling for retry completion…');
            const finalStatus = await pollUntilDone(userId, 'nutrition_plan_status');
            assert.equal(finalStatus, 'ready', `Nutrition plan did not reach ready after retry, got: ${finalStatus}`);
            outcome = { triggered: true, status: 'ready' };
        }

        assert.equal(outcome.triggered, true, `Expected triggered=true, got: ${JSON.stringify(outcome)}`);
        assert.equal(outcome.status, 'ready', `Expected status=ready, got: ${outcome.status}`);

        const entries = await NutritionMenu.find({ user: userId, archived: { $ne: true } });
        assert.ok(entries.length >= 1, `Expected menu entries in DB, found: ${entries.length}`);

        for (const entry of entries) {
            assert.ok(entry.meal_period, `Entry missing meal_period: ${entry._id}`);
            assert.ok(entry.meal_name, `Entry missing meal_name: ${entry._id}`);
            assert.ok(entry.total_calories > 0, `Entry has zero calories: ${entry._id}`);
            assert.equal(entry.source, 'ai', `Entry source should be 'ai': ${entry._id}`);
        }

        const updatedUser = await User.findById(userId);
        assert.equal(updatedUser.profile.nutrition_plan_status, 'ready');
        assert.equal(updatedUser.profile.nutrition_plan_source, 'agent');
        assert.ok(updatedUser.profile.nutrition_plan_generated_at instanceof Date);

        const periods = [...new Set(entries.map((e) => e.meal_period))];
        console.log(`[nutrition] entriesInDB=${entries.length} periods=${periods.join(', ')}`);
    } finally {
        if (userId) {
            await Promise.all([
                User.deleteOne({ _id: userId }),
                NutritionMenu.deleteMany({ user: userId }),
            ]);
        }
        await disconnectDB();
    }
});
