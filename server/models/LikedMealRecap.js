const mongoose = require('mongoose');

const likedMealRecapFoodSchema = new mongoose.Schema({
    name: { type: String, trim: true },
    portion: { type: String, trim: true },
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
}, { _id: false });

const likedMealRecapMealSchema = new mongoose.Schema({
    meal_name: { type: String, required: true, trim: true },
    meal_type: { type: String, trim: true },
    foods: { type: [likedMealRecapFoodSchema], default: [] },
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
}, { _id: false });

const likedMealRecapSourceSchema = new mongoose.Schema({
    label: { type: String, trim: true },
    url: { type: String, trim: true },
    provider: { type: String, trim: true },
}, { _id: false });

const likedMealRecapSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
        index: true,
    },
    signature: {
        type: String,
        required: true,
        trim: true,
    },
    meal: {
        type: likedMealRecapMealSchema,
        required: true,
    },
    recap: {
        title: { type: String, trim: true },
        recipe_title: { type: String, trim: true },
        ingredients_rubric: [{ type: String, trim: true }],
        recipe_guide: { type: String, trim: true },
        recipe_text: { type: String, trim: true },
        meal_macros: {
            calories: Number,
            protein: Number,
            carbs: Number,
            fat: Number,
        },
        updated_macros: {
            consumed_after_meal: {
                calories: Number,
                protein: Number,
                carbs: Number,
                fat: Number,
            },
            remaining_after_meal: {
                calories: Number,
                protein: Number,
                carbs: Number,
                fat: Number,
            },
        },
        source: likedMealRecapSourceSchema,
    },
}, {
    timestamps: true,
});

likedMealRecapSchema.index({ user: 1, signature: 1 }, { unique: true });

module.exports = mongoose.model('LikedMealRecap', likedMealRecapSchema);
