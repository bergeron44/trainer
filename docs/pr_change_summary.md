# PR Change Summary

## Scope
This PR turns onboarding nutrition/menu selection and nutrition tracking into database-backed flows, and extends onboarding to persist user-entered menu data.

## High-Level Changes
- Added persistent nutrition menu storage (`NutritionMenu`) linked to `user`.
- Extended nutrition history tracking (`NutritionLog`) with `meal_period` and `source`.
- Added nutrition menu APIs:
  - `GET /api/nutrition/menu`
  - `POST /api/nutrition/menu`
  - `DELETE /api/nutrition/entry/:id` (archive meal log)
- Updated `NutritionDemo` to persist/reload tracking and menu data from backend APIs.
- Added onboarding menu import step (`nutrition_menu_import`) when user chooses `Use My Existing Menu`.
- Updated onboarding submission payload to include `custom_nutrition_menu` (transient field used server-side for DB insertion).
- Added onboarding nutrition planner persistence logic in `userController`:
  - Saves user-entered onboarding menu (`existing`) into `NutritionMenu`.
  - Auto-generates starter menu entries for `ai` choice and saves to `NutritionMenu`.
  - Updates profile statuses/source fields accordingly.
- Added/updated i18n keys (EN/HE) for new onboarding/menu UX and nutrition status labels.

## Backend Details
### Models
- `server/models/NutritionMenu.js` (new)
  - User-scoped menu entries with macros, period, source, foods, archive flag.
- `server/models/NutritionLog.js` (updated)
  - Added `meal_period` and `source`.

### Controllers and Routes
- `server/controllers/nutritionController.js`
  - Added menu CRUD endpoints (save/get).
  - Added entry archive endpoint for tracking logs.
  - Hardened meal log creation validation and sorting/filtering.
- `server/routes/nutritionRoutes.js`
  - Wired `/menu` and `/entry/:id` routes.
- `server/controllers/userController.js`
  - Added onboarding nutrition persistence helpers:
    - sanitization for incoming `custom_nutrition_menu`
    - AI starter menu generation from profile macros
    - save-to-DB logic on register/profile update
  - Strips transient onboarding payload fields before persisting profile document.
  - Keeps profile nutrition status/source in sync with actual menu persistence.

## Frontend Details
- `src/components/onboarding/NutritionMenuImport.jsx` (new)
  - UI for entering existing user menu during onboarding.
- `src/pages/Onboarding.jsx`
  - Added `nutrition_menu_import` phase.
  - Existing-menu path now captures meals and passes them to backend via `custom_nutrition_menu`.
- `src/pages/NutritionDemo.jsx`
  - Loads today logs from DB and maps them to periods.
  - Persists manual foods, described meals, and AI-generated meals.
  - Saves menu entries + tracking entries.
  - Archives DB log when user removes a tracked entry.
  - Prevents duplicate AI meal save per current period.

## Localization
- Updated:
  - `src/locales/en.json`
  - `src/locales/he.json`
- Added strings for onboarding nutrition import and AI-meal state copy.

## Changed Files
- `server/controllers/nutritionController.js`
- `server/controllers/userController.js`
- `server/models/NutritionLog.js`
- `server/models/NutritionMenu.js` (new)
- `server/routes/nutritionRoutes.js`
- `src/components/onboarding/NutritionMenuImport.jsx` (new)
- `src/locales/en.json`
- `src/locales/he.json`
- `src/pages/NutritionDemo.jsx`
- `src/pages/Onboarding.jsx`

## Verification (latest run in working tree)
- `eslint` passed for updated frontend files.
- `npm run build` passed.
- `node --test server/tests/userProfileNormalization.test.js` passed.
- `node --test server/tests/chatTools.test.js` passed.
