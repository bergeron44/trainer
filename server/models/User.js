const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const WEEK_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MEAL_PERIODS = ['breakfast', 'lunch', 'afternoon_snack', 'dinner', 'evening_snack'];
const TIME_CONTEXT_DAY_VALUES = [...WEEK_DAYS, 'any'];
const TIME_CONTEXT_MEAL_VALUES = [...MEAL_PERIODS, 'any'];
const DAY_RULE_TYPES = ['cheat_day', 'budget_flex', 'fasting', 'custom'];
const MEAL_PREFERENCE_TYPES = ['light', 'moderate', 'heavy', 'high_protein', 'low_carb'];

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
            type: { type: String, enum: ['workout', 'rest'], required: true },
            name: String,
            exercises: [{
                id: String,
                name: String,
                sets: Number,
                reps: String,
                rest_seconds: Number,
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
    nutrition_preferences: {
        hard_restrictions: {
            diets: [{
                type: String,
                enum: ['vegan', 'vegetarian', 'pescatarian', 'kosher', 'halal', 'gluten_free', 'lactose_free']
            }],
            allergies: [String],
            medical_restrictions: [String],
            forbidden_ingredients: [String],
            notes: String
        },
        soft_likes: {
            cuisines: [String],
            foods: [String],
            notes: String
        },
        soft_dislikes: {
            cuisines: [String],
            foods: [String],
            notes: String
        },
        budget_preferences: {
            currency: { type: String, default: 'USD' },
            daily_budget: Number,
            weekly_budget: Number,
            expensive_days: [{
                day_of_week: { type: String, enum: WEEK_DAYS },
                budget_cap: Number,
                note: String
            }],
            notes: String
        },
        rule_based_preferences: {
            cheat_meals_per_week: { type: Number, min: 0, max: 21 },
            cheat_days: [{ type: String, enum: WEEK_DAYS }],
            day_rules: [{
                day_of_week: { type: String, enum: WEEK_DAYS },
                rule_type: { type: String, enum: DAY_RULE_TYPES },
                note: String
            }],
            meal_time_rules: [{
                meal_period: { type: String, enum: MEAL_PERIODS },
                preference: { type: String, enum: MEAL_PREFERENCE_TYPES },
                max_calories: Number,
                note: String
            }],
            time_context_notes: [{
                day_of_week: { type: String, enum: TIME_CONTEXT_DAY_VALUES, default: 'any' },
                meal_period: { type: String, enum: TIME_CONTEXT_MEAL_VALUES, default: 'any' },
                note: String
            }],
            time_notes: {
                by_day: {
                    sunday: { type: String, default: '' },
                    monday: { type: String, default: '' },
                    tuesday: { type: String, default: '' },
                    wednesday: { type: String, default: '' },
                    thursday: { type: String, default: '' },
                    friday: { type: String, default: '' },
                    saturday: { type: String, default: '' }
                },
                by_meal_period: {
                    breakfast: { type: String, default: '' },
                    lunch: { type: String, default: '' },
                    afternoon_snack: { type: String, default: '' },
                    dinner: { type: String, default: '' },
                    evening_snack: { type: String, default: '' }
                }
            },
            special_rules: [String],
            notes: String
        },
        practical_constraints: {
            max_prep_time_minutes: Number,
            cooking_skill: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
            equipment: [String],
            meals_per_day: Number,
            batch_cooking: Boolean,
            notes: String
        }
    },
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
