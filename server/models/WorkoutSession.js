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
    start_time: { type: Date, required: true },
    end_time: Date,
    completed_exercises: [{
        exercise_id: String,
        sets_completed: Number,
        time_spent: Number
    }],
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
