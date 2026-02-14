const mongoose = require('mongoose');

const workoutSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    date: { type: Date, required: true },
    muscle_group: { type: String, required: true },
    exercises: [{
        id: String,
        name: String,
        sets: Number,
        reps: String,
        weight: Number,
        rest_seconds: Number,
        notes: String
    }],
    status: {
        type: String,
        enum: ['planned', 'in_progress', 'completed'],
        default: 'planned'
    },
    duration_minutes: Number,
    total_volume: Number,
    notes: String
}, {
    timestamps: true
});

const Workout = mongoose.model('Workout', workoutSchema);
module.exports = Workout;
