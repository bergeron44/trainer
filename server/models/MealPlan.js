const mongoose = require('mongoose');

const mealPlanFoodSchema = new mongoose.Schema({
    name:     { type: String, required: true },
    portion:  String,
    calories: Number,
    protein:  Number,
    carbs:    Number,
    fat:      Number,
}, { _id: false });

const MEAL_TYPES = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack', 'post_workout', 'other'];

const mealPlanMealSchema = new mongoose.Schema({
    meal_name: { type: String, required: true },
    meal_type: { type: String, enum: MEAL_TYPES },
    foods:     { type: [mealPlanFoodSchema], default: [] },
    calories:  Number,
    protein:   Number,
    carbs:     Number,
    fat:       Number,
}, { _id: false });

const mealPlanSchema = new mongoose.Schema({
    user:     { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    source:   { type: String, enum: ['agent', 'manual'], required: true },
    meals:    { type: [mealPlanMealSchema], required: true },
    archived: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('MealPlan', mealPlanSchema);
