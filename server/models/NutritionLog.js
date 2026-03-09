const mongoose = require('mongoose');

const nutritionLogSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    date: { type: Date, required: true },
    meal_name: { type: String, required: true },
    meal_period: { type: String, default: '' },
    source: {
        type: String,
        enum: ['ai', 'manual', 'existing', 'imported'],
        default: 'manual',
    },
    calories: { type: Number, required: true },
    protein: Number,
    carbs: Number,
    fat: Number,
    archived: {
        type: Boolean,
        default: false
    },
    foods: [{
        name: String,
        portion: String,
        calories: Number
    }]
}, {
    timestamps: true
});

const NutritionLog = mongoose.model('NutritionLog', nutritionLogSchema);
module.exports = NutritionLog;
