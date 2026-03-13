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
        coach_style: String,
        plan_choice: {
            type: String,
            enum: ['ai', 'existing'],
            default: 'ai'
        },
        custom_plan: [{
            day: String,
            name: String,
            exercises: [{
                name: String,
                sets: Number,
                reps: String
            }]
        }],
        onboarding_date: Date,
        trainer_personality: {
            type: String,
            enum: ['drill_sergeant_coach', 'scientist_coach', 'nutritionist', 'zen_coach'],
            default: 'drill_sergeant_coach'
        },
        onboarding_completed: { type: Boolean, default: false },
        has_existing_plan: { type: Boolean, default: false },
        workout_plan_status: {
            type: String,
            enum: ['pending', 'generating', 'ready', 'failed', 'skipped'],
            default: 'pending'
        },
        workout_plan_error: String,
        workout_plan_generated_at: Date,
        workout_plan_source: {
            type: String,
            enum: ['agent', 'legacy', 'manual'],
            default: 'agent'
        },
        menu_choice: {
            type: String,
            enum: ['ai', 'manual', 'tracking_only'],
            default: 'tracking_only',
        },
        menu_ai_preferences: { type: mongoose.Schema.Types.Mixed },
        manual_menu: [{
            name:  String,
            foods: String,
        }],
        has_existing_menu: { type: Boolean, default: false },
        menu_plan_status: {
            type: String,
            enum: ['pending', 'generating', 'ready', 'failed', 'skipped'],
            default: 'pending',
        },
        menu_plan_error:        String,
        menu_plan_generated_at: Date,
        menu_plan_source: {
            type: String,
            enum: ['agent', 'manual'],
            default: 'agent',
        },
    },
    liked_foods: [{
        name: String,
        image: String,
        calories: Number,
        protein: Number,
        carbs: Number,
        fat: Number
    }],
    disliked_foods: [{
        name: String
    }]
}, {
    timestamps: true
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);
module.exports = User;
