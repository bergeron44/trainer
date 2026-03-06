const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profile: {
        age: Number,
        gender: { type: String, enum: ['male', 'female', 'other'] },
        height: Number,
        weight: Number,
        goal: { type: String, enum: ['weight_loss', 'muscle_gain', 'recomp', 'athletic_performance'] },
        body_fat_percentage: Number,
        injuries: String,
        experience_level: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
        workout_days_per_week: Number,
        session_duration: { type: Number, enum: [30, 60, 90] },
        environment: { type: String, enum: ['commercial_gym', 'home_gym', 'bodyweight_park'] },
        diet_type: { type: String, enum: ['everything', 'vegan', 'vegetarian', 'keto', 'paleo'] },
        allergies: String,
        meal_frequency: Number,
        activity_level: { type: String, enum: ['sedentary', 'lightly_active', 'moderately_active', 'very_active'] },
        sleep_hours: Number,
        past_obstacles: String,
        motivation_source: String,
        tdee: Number,
        target_calories: Number,
        protein_goal: Number,
        carbs_goal: Number,
        fat_goal: Number,
        trainer_personality: { type: String, enum: ['drill_sergeant', 'scientist', 'zen_coach'], default: 'drill_sergeant' },
        plan_choice: { type: String, enum: ['ai', 'existing'], default: 'ai' },
        nutrition_plan_choice: { type: String, enum: ['ai', 'existing', 'tracking_only'], default: 'ai' },
        onboarding_completed: { type: Boolean, default: false },
        has_existing_plan: { type: Boolean, default: false },
        workout_plan_status: { type: String, enum: ['pending', 'generating', 'ready', 'failed', 'skipped'], default: 'pending' },
        workout_plan_error: String,
        workout_plan_generated_at: Date,
        workout_plan_source: { type: String, enum: ['agent', 'legacy', 'manual'], default: 'agent' },
        nutrition_plan_status: { type: String, enum: ['pending', 'generating', 'ready', 'failed', 'skipped'], default: 'pending' },
        nutrition_plan_error: String,
        nutrition_plan_generated_at: Date,
        nutrition_plan_source: { type: String, enum: ['agent', 'legacy', 'manual', 'none'], default: 'none' }
    },
    liked_foods: [{
        name: String,
        image: String,
        calories: Number,
        protein: Number,
        carbs: Number,
        fat: Number
    }],
    disliked_foods: [{ name: String }]
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
module.exports = User;
