# Ori Change 13-3

## What changed

This change replaces the Nutrition Demo "Tell Me What You Like" -> "Yes, update Today's Log" flow with a safe full-plan regeneration flow.

Before:
- The button generated only one meal for the current time slot.
- It auto-saved that one meal into `NutritionLog`.
- It did not rebuild the active daily meal plan the same way onboarding does.

After:
- The button calls a new backend endpoint: `POST /api/nutrition/menu/regenerate`.
- That endpoint rebuilds the active daily `MealPlan` using the same full-plan agent flow as the onboarding menu generation.
- It does **not** delete or overwrite real `NutritionLog` entries.
- After success, the frontend reloads the active meal plan and updates the Nutrition UI.

## Files changed

- `server/services/onboardingMenuPlannerService.js`
- `server/controllers/nutritionController.js`
- `server/routes/nutritionRoutes.js`
- `src/pages/NutritionDemo.jsx`
- `server/tests/onboardingMenuPlannerService.test.js`

## Backend behavior

### New safe regeneration endpoint

Route:
- `POST /api/nutrition/menu/regenerate`

Controller:
- `server/controllers/nutritionController.js`

What it does:
- Forces a regeneration of the active AI meal plan.
- Uses the latest user data from MongoDB.
- Returns the new active plan plus planner metadata.

### Planner service upgrade

The planner service now uses much richer context when generating the meal plan.

Service:
- `server/services/onboardingMenuPlannerService.js`

The service now includes:
- Full user profile summary
- Full structured `nutrition_preferences`
- `liked_foods`
- `disliked_foods`
- Legacy `menu_ai_preferences`
- Recent accepted/saved meals from `NutritionLog`

It also archives older active agent plans after a successful generation, so only the newest generated plan remains active.

## Prompt priority order

The meal-planning agent is explicitly told to use data in this order:

1. Hard restrictions
2. Structured nutrition preferences
3. Macro targets and goal
4. Training context
5. Accepted/saved meal history
6. liked/disliked food lists
7. Legacy free-text menu hints

## Data used in generation

### From `user.profile`

- `goal`
- `diet_type`
- `target_calories` / `tdee`
- `protein_goal`
- `carbs_goal`
- `fat_goal`
- `meal_frequency`
- `activity_level`
- `experience_level`
- `workout_days_per_week`
- `session_duration`
- `environment`
- `injuries`
- `allergies`
- `sleep_hours`
- `past_obstacles`
- `motivation_source`
- `trainer_personality`
- `workout_plan_status`
- `workout_plan_source`
- `has_existing_plan`

### From structured nutrition data

- `hard_restrictions`
- `soft_likes`
- `soft_dislikes`
- `budget_preferences`
- `rule_based_preferences`
- `practical_constraints`

### From user food lists

- `liked_foods`
- `disliked_foods`

### From history

- Up to 20 recent saved meals from `NutritionLog`

## Which agent builds the plan

Agent type:
- `nutritionist`

Service:
- `OnboardingMenuPlannerService`

Tool allowed:
- `menu_plan_save`

## Frontend behavior

File:
- `src/pages/NutritionDemo.jsx`

The confirmation button in the meal-plan refresh prompt now:
- Calls `/api/nutrition/menu/regenerate`
- Reloads `/api/nutrition/menu/active`
- Shows a success/failure alert

It no longer uses the single-meal `requestMealPlan(... autoLogToTodaysLog: true)` path.

## Meal recapy change

Added a real LLM-powered meal recap flow for generated meals.

Files:
- `ai-service/controllers/mealController.js`
- `ai-service/routes/mealRoutes.js`
- `ai-service/prompts/mealPrompt.js`
- `src/components/nutrition/MealPlanCard.jsx`
- `src/pages/NutritionDemo.jsx`

### What it does

- Adds `POST /ai/meal/recap`
- Replaces the old local recap alert with an AI-generated recapy
- Keeps the button text as `Give me recapy`
- Works from:
  - the generated meal card
  - the meal-plan detail sheet

### Prompt behavior

The recap prompt is told:
- this is a selected meal recap, not a meal generation task
- exact macro matching is **not required**
- close-enough macros are acceptable if the meal still fits the bigger plan
- explain why the meal fits the goal, restrictions, preferences, training context, and current day

### Returned recap payload

The recap endpoint returns:
- `summary`
- `why_it_fits`
- `macro_fit`
- `macro_flex_note`
- `coach_note`
- `meal_macros`
- `updated_macros`

`updated_macros` are computed deterministically in the controller so the user sees reliable numbers after the selected meal is applied to the current daily totals.

## Verification

Added test file:
- `server/tests/onboardingMenuPlannerService.test.js`
- `ai-service/tests/mealPrompt.test.js`

The tests cover:
- Prompt includes structured nutrition data and accepted meal history
- Successful regeneration archives older agent plans and keeps the newest active plan
