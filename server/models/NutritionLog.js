const mongoose = require('mongoose');

const nutritionLogSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    date: { type: Date, required: true },
    meal_name: { type: String, required: true },
    calories: { type: Number, required: true },
    protein: Number,
    carbs: Number,
    fat: Number,
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
