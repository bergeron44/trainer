const mongoose = require('mongoose');

// Read-only model — we never write to exercises from ai-service
const exerciseSchema = new mongoose.Schema({
    name:          String,
    muscle_group:  String,
    equipment:     String,
    movement_type: String,
    default_sets:  { type: Number, default: 3 },
    default_reps:  { type: String, default: '8-12' },
    rest_seconds:  { type: Number, default: 90 },
}, { collection: 'exercises', timestamps: true });

module.exports = mongoose.model('Exercise', exerciseSchema);
