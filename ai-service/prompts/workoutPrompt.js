const PERSONALITY_DESC = {
    drill_sergeant: 'an intense military drill sergeant — push them hard, demand excellence',
    drill_sergeant_coach: 'an intense military drill sergeant — push them hard, demand excellence',
    scientist: 'an analytical strength coach — optimal programming, scientific rationale',
    scientist_coach: 'an analytical strength coach — optimal programming, scientific rationale',
    nutritionist: 'a practical nutrition and performance coach — data-aware, adherence-focused',
    zen_coach: 'a calm and balanced trainer — focus on form, recovery, and consistency',
};

const ENVIRONMENT_DESC = {
    commercial_gym: 'a fully equipped commercial gym (barbells, machines, cables, dumbbells)',
    home_gym: 'a home gym (limited equipment, dumbbells, resistance bands)',
    bodyweight_park: 'a calisthenics park (bodyweight only, pull-up bars, dip bars)',
};

const FOCUS_ROTATION = ['push', 'pull', 'legs', 'full_body', 'push', 'pull', 'legs'];

// Map from focus type → muscle groups in the exercises collection
const FOCUS_TO_MUSCLES = {
    push:      ['chest', 'shoulders'],
    pull:      ['back'],
    legs:      ['legs'],
    full_body: ['full_body', 'core'],
    chest: ['chest'], back: ['back'], shoulders: ['shoulders'],
    arms: ['arms'], legs: ['legs'], core: ['core'],
    cardio: ['cardio'],
};

/**
 * Determine today's suggested focus based on recent workout muscle groups
 */
function suggestTodayFocus(recentWorkouts) {
    const recentGroups = recentWorkouts.slice(0, 3).map(w => w.muscle_group);
    for (const focus of FOCUS_ROTATION) {
        const muscleMap = {
            push: ['chest', 'shoulders', 'arms'],
            pull: ['back', 'arms'],
            legs: ['legs'],
            full_body: ['full_body', 'core'],
        };
        const isDoneRecently = recentGroups.some(g => muscleMap[focus]?.includes(g));
        if (!isDoneRecently) return focus;
    }
    return 'full_body';
}

/**
 * Returns the muscle groups to query given a focus/muscle_group string
 */
function getMuscleGroupsForFocus(focus) {
    return FOCUS_TO_MUSCLES[focus] || [focus];
}

/**
 * Build the exercise catalogue section of the prompt grouped by muscle
 */
function buildExerciseCatalogue(exercises) {
    const groups = {};
    for (const ex of exercises) {
        const g = ex.muscle_group;
        if (!groups[g]) groups[g] = [];
        groups[g].push(ex.name);
    }
    return Object.entries(groups)
        .map(([group, names]) => `=== ${group.toUpperCase()} ===\n${names.join(', ')}`)
        .join('\n\n');
}

/**
 * Build system prompt
 */
function buildWorkoutSystem(user) {
    const p = user.profile || {};
    const personality = PERSONALITY_DESC[p.trainer_personality] || PERSONALITY_DESC.zen_coach;
    const equipment = ENVIRONMENT_DESC[p.environment] || ENVIRONMENT_DESC.commercial_gym;

    return `You are NEXUS, ${personality}.

User profile:
- Goal: ${p.goal || 'recomp'}
- Experience: ${p.experience_level || 'intermediate'}
- Session duration: ${p.session_duration || 60} minutes
- Equipment: ${equipment}
- Injuries/limitations: ${p.injuries || 'none'}

CRITICAL RULES:
- You MUST choose exercise names ONLY from the provided catalogue — never invent names
- Respond ONLY with valid JSON — no markdown, no extra text
- Exercise names must match exactly as listed in the catalogue
- coach_note in Hebrew (1-2 motivational sentences)
- Include 4-6 exercises`;
}

/**
 * Build user message
 */
function buildWorkoutUserMessage({ recentWorkouts, todayFocus, todayWorkout, availableExercises, userNotes, user }) {
    const p = user.profile || {};

    const recentSummary = recentWorkouts.slice(0, 5)
        .map(w => `  - ${new Date(w.date).toLocaleDateString('he-IL')}: ${w.muscle_group} (${w.exercises?.length || 0} exercises, ${w.status})`)
        .join('\n') || '  (no recent workouts)';

    const currentWorkoutSection = todayWorkout
        ? `Current workout for today (REPLACE these exercises with better ones):
  Focus: ${todayWorkout.muscle_group}
  Current exercises: ${(todayWorkout.exercises || []).map(e => e.name).join(', ') || '(none)'}${todayWorkout.notes ? `\n  Notes: ${todayWorkout.notes}` : ''}`
        : `No workout scheduled for today — create one.`;

    const catalogue = buildExerciseCatalogue(availableExercises);
    const userNotesSection = userNotes ? `\nAthlete note: "${userNotes}"` : '';

    return `${currentWorkoutSection}${userNotesSection}

Recent workouts:
${recentSummary}

TODAY'S FOCUS: ${todayFocus}
SESSION: ${p.session_duration || 60} minutes

AVAILABLE EXERCISES — choose ONLY from this list:
${catalogue}

Pick 4-6 exercises from the catalogue that:
1. Match today's focus muscle group
2. Avoid repeating muscles from the last 1-2 days
3. Suit experience level: ${p.experience_level || 'intermediate'}

Respond with this exact JSON structure:
{
  "title": "Catchy workout title",
  "muscle_group": "primary muscle group",
  "focus": "${todayFocus}",
  "duration_minutes": ${p.session_duration || 60},
  "exercises": [
    {
      "name": "Exact Name From Catalogue",
      "sets": 4,
      "reps": "8-12",
      "rest_seconds": 90,
      "notes": "Quick form tip"
    }
  ],
  "coach_note": "משפט מוטיבציה בעברית"
}`;
}

module.exports = { buildWorkoutSystem, buildWorkoutUserMessage, suggestTodayFocus, getMuscleGroupsForFocus };
