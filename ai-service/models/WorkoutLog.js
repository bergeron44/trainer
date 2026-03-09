const mongoose = require('mongoose');

const workoutLogSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    workout_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Workout'
    },
    exercise_name: { type: String, required: true },
    set_number: { type: Number, required: true },
    reps_completed: { type: Number, required: true },
    weight_used: { type: Number, required: true },
    date: { type: Date, required: true },
    rpe: Number
}, {
    timestamps: true
});

const WorkoutLog = mongoose.model('WorkoutLog', workoutLogSchema);
module.exports = WorkoutLog;
