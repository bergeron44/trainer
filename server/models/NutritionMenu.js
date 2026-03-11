const mongoose = require('mongoose');

const nutritionMenuSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    date: {
        type: Date,
        required: true,
    },
    meal_period: {
        type: String,
        default: '',
    },
    meal_name: {
        type: String,
        required: true,
    },
    source: {
        type: String,
        enum: ['ai', 'manual', 'existing', 'imported'],
        default: 'manual',
    },
    total_calories: {
        type: Number,
        required: true,
    },
    total_protein: Number,
    total_carbs: Number,
    total_fat: Number,
    note: String,
    foods: [{
        name: String,
        portion: String,
        calories: Number,
        protein: Number,
        carbs: Number,
        fat: Number,
    }],
    import_origin: {
        type: String,
        enum: ['onboarding_custom_menu'],
    },
    import_signature: String,
    archived: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});

const NutritionMenu = mongoose.model('NutritionMenu', nutritionMenuSchema);
module.exports = NutritionMenu;
