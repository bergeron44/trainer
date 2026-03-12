/**
 * Seed realistic workout + nutrition history for a user
 * Usage: node server/scripts/seedProgressData.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const User = require('../models/User');
const Workout = require('../models/Workout');
const WorkoutSession = require('../models/WorkoutSession');
const WorkoutLog = require('../models/WorkoutLog');
const NutritionLog = require('../models/NutritionLog');

const TARGET_EMAIL = 'ronberger40@gmail.com';

const EXERCISES = [
    { name: 'Bench Press', sets: 4, reps: '8', baseWeight: 60 },
    { name: 'Squat',       sets: 4, reps: '8', baseWeight: 80 },
    { name: 'Deadlift',    sets: 3, reps: '5', baseWeight: 100 },
    { name: 'Pull-up',     sets: 3, reps: '8', baseWeight: 0 },
    { name: 'Overhead Press', sets: 3, reps: '10', baseWeight: 40 },
    { name: 'Row',         sets: 3, reps: '10', baseWeight: 50 },
    { name: 'Lunge',       sets: 3, reps: '12', baseWeight: 20 },
    { name: 'Dips',        sets: 3, reps: '10', baseWeight: 0 },
];

const MEAL_TEMPLATES = [
    { name: 'Oatmeal with Banana',    calories: 380, protein: 12, carbs: 72, fat: 7,  foods: [{ name: 'Oatmeal', calories: 250 }, { name: 'Banana', calories: 105 }] },
    { name: 'Grilled Chicken & Rice', calories: 620, protein: 52, carbs: 68, fat: 10, foods: [{ name: 'Grilled Chicken', calories: 300 }, { name: 'White Rice', calories: 200 }] },
    { name: 'Protein Shake',          calories: 280, protein: 35, carbs: 22, fat: 5,  foods: [{ name: 'Protein Shake', calories: 280 }] },
    { name: 'Salmon & Veggies',       calories: 520, protein: 45, carbs: 30, fat: 18, foods: [{ name: 'Salmon', calories: 320 }, { name: 'Mixed Veggies', calories: 80 }] },
    { name: 'Greek Yogurt & Berries', calories: 220, protein: 18, carbs: 28, fat: 4,  foods: [{ name: 'Greek Yogurt', calories: 150 }, { name: 'Berries', calories: 60 }] },
    { name: 'Eggs & Toast',           calories: 420, protein: 28, carbs: 35, fat: 16, foods: [{ name: 'Scrambled Eggs', calories: 280 }, { name: 'Toast', calories: 120 }] },
    { name: 'Pasta with Turkey',       calories: 680, protein: 48, carbs: 80, fat: 14, foods: [{ name: 'Pasta', calories: 320 }, { name: 'Turkey Mince', calories: 280 }] },
    { name: 'Brown Rice & Beef',       calories: 740, protein: 55, carbs: 75, fat: 18, foods: [{ name: 'Brown Rice', calories: 300 }, { name: 'Beef', calories: 350 }] },
];

const MUSCLE_GROUPS = ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Full Body'];

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

function setHour(date, h, m = 0) {
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d;
}

function randBetween(a, b) {
    return a + Math.random() * (b - a);
}

function pickRandom(arr, n = 1) {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return n === 1 ? shuffled[0] : shuffled.slice(0, n);
}

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const user = await User.findOne({ email: TARGET_EMAIL });
    if (!user) {
        console.error(`User ${TARGET_EMAIL} not found!`);
        process.exit(1);
    }
    console.log(`Found user: ${user.name} (${user._id})`);

    // Clear existing seed data (optional — comment out to keep)
    await WorkoutSession.deleteMany({ user: user._id });
    await WorkoutLog.deleteMany({ user: user._id });
    await NutritionLog.deleteMany({ user: user._id });
    await Workout.deleteMany({ user: user._id });
    console.log('Cleared existing data');

    // Workout days: ~every other day for 21 days (10 sessions)
    const workoutDays = [21, 19, 17, 14, 12, 10, 7, 5, 3, 1];

    for (let i = 0; i < workoutDays.length; i++) {
        const daysBack = workoutDays[i];
        const dayDate = daysAgo(daysBack);
        const muscleGroup = MUSCLE_GROUPS[i % MUSCLE_GROUPS.length];

        // Pick 4-5 exercises for this day
        const dayExercises = pickRandom(EXERCISES, 5);

        // Create Workout document
        const workoutExercises = dayExercises.map((ex, idx) => ({
            id: `ex_${i}_${idx}`,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            // Progressive overload: weight increases slightly each week
            weight: ex.baseWeight > 0 ? ex.baseWeight + (i * 2.5) : 0,
            rest_seconds: 90,
        }));

        const workout = await Workout.create({
            user: user._id,
            date: setHour(dayDate, 10),
            muscle_group: muscleGroup,
            exercises: workoutExercises,
            status: 'completed',
            duration_minutes: Math.round(randBetween(45, 75)),
        });

        // Create WorkoutSession
        const startTime = setHour(dayDate, 10);
        const durationMin = Math.round(randBetween(45, 75));
        const endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);

        let totalVolume = 0;
        const completedExercises = [];

        for (const ex of workoutExercises) {
            const completedSets = ex.sets;
            const weight = ex.weight || 0;
            totalVolume += weight * completedSets * (parseInt(ex.reps) || 0);
            completedExercises.push({
                exercise_id: ex.id,
                sets_completed: completedSets,
            });
        }

        const session = await WorkoutSession.create({
            user: user._id,
            workout_id: workout._id,
            start_time: startTime,
            end_time: endTime,
            status: 'completed',
            completed_exercises: completedExercises,
            total_volume: Math.round(totalVolume),
            xp_earned: completedExercises.length * 10 + Math.floor(totalVolume / 100),
        });

        // Create WorkoutLog entries (individual sets)
        for (const ex of workoutExercises) {
            const weight = ex.weight || 0;
            for (let setNum = 1; setNum <= ex.sets; setNum++) {
                // Slight weight variation per set (last sets sometimes drop slightly)
                const setWeight = setNum === ex.sets && weight > 0
                    ? Math.max(weight - 2.5, 0)
                    : weight;
                await WorkoutLog.create({
                    user: user._id,
                    workout_id: workout._id,
                    exercise_name: ex.name,
                    set_number: setNum,
                    reps_completed: parseInt(ex.reps) || 8,
                    weight_used: setWeight,
                    date: new Date(startTime.getTime() + setNum * 3 * 60 * 1000),
                });
            }
        }

        console.log(`  ✅ Day -${daysBack}: ${muscleGroup} — ${durationMin}min, volume=${Math.round(totalVolume)}kg`);
    }

    // Nutrition: every day for 21 days
    for (let d = 0; d <= 21; d++) {
        const dayDate = daysAgo(d);
        const isWorkoutDay = workoutDays.includes(d);

        // 3 meals per day
        const numMeals = isWorkoutDay ? 4 : 3;
        const meals = pickRandom(MEAL_TEMPLATES, numMeals);

        let totalCals = 0;
        for (let m = 0; m < meals.length; m++) {
            const meal = meals[m];
            // Small random variation
            const variation = 0.9 + Math.random() * 0.2;
            const calories = Math.round(meal.calories * variation);
            const protein  = Math.round(meal.protein  * variation);
            const carbs    = Math.round(meal.carbs    * variation);
            const fat      = Math.round(meal.fat      * variation);

            totalCals += calories;

            await NutritionLog.create({
                user: user._id,
                date: setHour(dayDate, 8 + m * 4),
                meal_name: meal.name,
                calories,
                protein,
                carbs,
                fat,
                foods: meal.foods.map(f => ({
                    name: f.name,
                    calories: Math.round(f.calories * variation),
                })),
            });
        }
        console.log(`  🍽️  Day -${d}: ${numMeals} meals — ${totalCals} kcal`);
    }

    console.log('\n✅ Seed complete! Refresh the progress page.');
    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
