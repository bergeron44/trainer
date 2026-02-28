const mongoose = require('mongoose');

const exerciseSchema = mongoose.Schema({
    name: { type: String, required: true, unique: true },
    name_he: { type: String },
    muscle_group: {
        type: String,
        enum: ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'full_body'],
        required: true
    },
    equipment: { type: String, default: 'barbell' },
    // ExerciseDB fields
    body_part: { type: String },
    target: { type: String },
    secondary_muscles: [{ type: String }],
    instructions: [{ type: String }],
    description: { type: String },
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced', ''], default: '' },
    category: { type: String },
    // Media
    gif_url: { type: String, default: null },
    video_url: { type: String, default: null },
    gif_verified: { type: Boolean, default: false },
    // Defaults for workout generation
    default_sets: { type: Number, default: 3 },
    default_reps: { type: String, default: '8-12' },
    rest_seconds: { type: Number, default: 90 },
}, {
    timestamps: true
});

const Exercise = mongoose.model('Exercise', exerciseSchema);
module.exports = Exercise;
