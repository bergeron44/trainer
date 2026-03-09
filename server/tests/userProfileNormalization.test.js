const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeIncomingProfile } = require('../controllers/userController');

test('normalizeIncomingProfile marks nutrition existing choice as skipped/manual', () => {
    const normalized = normalizeIncomingProfile({
        onboarding_completed: true,
        nutrition_plan_choice: 'existing',
    });

    assert.equal(normalized.nutrition_plan_status, 'skipped');
    assert.equal(normalized.nutrition_plan_source, 'manual');
    assert.equal(normalized.nutrition_plan_error, undefined);
});

test('normalizeIncomingProfile marks tracking_only choice as skipped/none', () => {
    const normalized = normalizeIncomingProfile({
        onboarding_completed: true,
        nutrition_plan_choice: 'tracking_only',
    });

    assert.equal(normalized.nutrition_plan_status, 'skipped');
    assert.equal(normalized.nutrition_plan_source, 'none');
    assert.equal(normalized.nutrition_plan_error, undefined);
});

test('normalizeIncomingProfile sets AI nutrition choice to pending when onboarding is complete', () => {
    const normalized = normalizeIncomingProfile({
        onboarding_completed: true,
        nutrition_plan_choice: 'ai',
    });

    assert.equal(normalized.nutrition_plan_status, 'pending');
    assert.equal(normalized.nutrition_plan_source, 'none');
});

test('normalizeIncomingProfile keeps legacy payloads without nutrition choice unchanged', () => {
    const normalized = normalizeIncomingProfile({
        onboarding_completed: false,
    });

    assert.equal(Object.hasOwn(normalized, 'nutrition_plan_status'), false);
    assert.equal(Object.hasOwn(normalized, 'nutrition_plan_source'), false);
});

test('normalizeIncomingProfile maps legacy trainer_personality to canonical enum', () => {
    const normalized = normalizeIncomingProfile({
        trainer_personality: 'drill_sergeant',
    });

    assert.equal(normalized.trainer_personality, 'drill_sergeant_coach');
});

test('normalizeIncomingProfile defaults unknown trainer_personality to drill_sergeant_coach', () => {
    const normalized = normalizeIncomingProfile({
        trainer_personality: 'unknown_mode',
    });

    assert.equal(normalized.trainer_personality, 'drill_sergeant_coach');
});
