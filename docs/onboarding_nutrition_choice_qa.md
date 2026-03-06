# Onboarding Nutrition Choice QA

## Scope
- Validate new onboarding nutrition choice stage and profile persistence.
- Validate experienced and beginner branch navigation.
- Validate Nutrition screen behavior for `tracking_only`.

## Preconditions
- App and API are running.
- Tester can create new users.
- Optional: DB viewer for verifying saved profile payload.

## Test Cases

1. Experienced user with AI workout + AI nutrition
- Complete onboarding with `experience_level=intermediate` or `advanced`.
- On workout plan step choose `Build New AI Plan`.
- On nutrition step choose `Generate AI Menu`.
- Finish onboarding.
- Verify profile includes:
  - `plan_choice=ai`
  - `nutrition_plan_choice=ai`
  - `nutrition_plan_status=pending` (or backend-updated equivalent)

2. Experienced user with existing workout + existing menu
- Complete onboarding with `experience_level=advanced`.
- On workout plan step choose `Use My Current Routine`.
- Complete workout import step.
- On nutrition step choose `Use My Existing Menu`.
- Finish onboarding.
- Verify profile includes:
  - `plan_choice=existing`
  - `nutrition_plan_choice=existing`
  - `nutrition_plan_status=skipped`
  - `nutrition_plan_source=manual`

3. Beginner user with tracking-only nutrition
- Complete onboarding with `experience_level=beginner`.
- Confirm flow is `coach_selection -> nutrition_plan_choice -> summary`.
- On nutrition step choose `Tracking Only`.
- Finish onboarding.
- Verify profile includes:
  - `nutrition_plan_choice=tracking_only`
  - `nutrition_plan_status=skipped`
  - `nutrition_plan_source=none`

4. Back navigation behavior
- Beginner branch: from nutrition step press Back, verify return to coach selection.
- Experienced AI branch: from nutrition step press Back, verify return to workout plan choice.
- Experienced existing branch: from nutrition step press Back, verify return to workout import step.

5. Tracking-only nutrition page behavior
- Login as user with `nutrition_plan_choice=tracking_only`.
- Open Nutrition page.
- Verify `Plan Meal` action is disabled.
- Verify helper message indicates tracking-only mode.
- Verify manual food logging still works.

6. Legacy user regression
- Login as user with no `nutrition_plan_choice` field.
- Open Nutrition page.
- Verify `Plan Meal` action remains enabled.

## Notes
- This version does not add onboarding menu import UI.
- `ONBOARDING_AI_MENU_AUTOGEN_ENABLED` defaults to `false`; no onboarding-time AI meal generation is expected.
