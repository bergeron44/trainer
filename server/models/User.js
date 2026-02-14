const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profile: {
        age: Number,
        gender: { type: String, enum: ['male', 'female', 'other'] },
        height: Number,
        weight: Number,
        goal: {
            type: String,
            enum: ['weight_loss', 'muscle_gain', 'recomp', 'athletic_performance']
        },
        body_fat_percentage: Number,
        injuries: String,
        experience_level: {
            type: String,
            enum: ['beginner', 'intermediate', 'advanced']
        },
        workout_days_per_week: Number,
        session_duration: { type: Number, enum: [30, 60, 90] },
        environment: {
            type: String,
            enum: ['commercial_gym', 'home_gym', 'bodyweight_park']
        },
        diet_type: {
            type: String,
            enum: ['everything', 'vegan', 'vegetarian', 'keto', 'paleo']
        },
        allergies: String,
        meal_frequency: Number,
        activity_level: {
            type: String,
            enum: ['sedentary', 'lightly_active', 'moderately_active', 'very_active']
        },
        sleep_hours: Number,
        past_obstacles: String,
        motivation_source: String,
        tdee: Number,
        target_calories: Number,
        protein_goal: Number,
        carbs_goal: Number,
        fat_goal: Number,
        trainer_personality: {
            type: String,
            enum: ['drill_sergeant', 'scientist', 'zen_coach'],
            default: 'drill_sergeant'
        },
        onboarding_completed: { type: Boolean, default: false },
        has_existing_plan: { type: Boolean, default: false }
    }
}, {
    timestamps: true
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);
module.exports = User;
