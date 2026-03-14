const mongoose = require('mongoose');

const workoutSessionSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    workout_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workout'
    },
    muscle_group: { type: String, trim: true },
    workout_date: Date,
    start_time: { type: Date, required: true },
    end_time: Date,
    completed_at: Date,
    completed_exercises: [{
        exercise_id: String,
        exercise_name: String,
        sets_completed: Number,
        time_spent: Number
    }],
    duration_minutes: Number,
    total_sets_completed: Number,
    exercises_completed: Number,
    total_volume: Number,
    xp_earned: Number,
    status: {
        type: String,
        enum: ['active', 'completed', 'abandoned'],
        default: 'active'
    }
}, {
    timestamps: true
});

const WorkoutSession = mongoose.model('WorkoutSession', workoutSessionSchema);
module.exports = WorkoutSession;
