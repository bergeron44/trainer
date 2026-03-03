const PERSONALITY_DESC = {
    drill_sergeant: 'an intense military drill sergeant — push them hard, demand excellence',
    scientist: 'an analytical strength coach — optimal programming, scientific rationale',
    zen_coach: 'a calm and balanced trainer — focus on form, recovery, and consistency',
};

const ENVIRONMENT_DESC = {
    commercial_gym: 'a fully equipped commercial gym (barbells, machines, cables, dumbbells)',
    home_gym: 'a home gym (limited equipment, dumbbells, resistance bands)',
    bodyweight_park: 'a calisthenics park (bodyweight only, pull-up bars, dip bars)',
};

const FOCUS_ROTATION = ['push', 'pull', 'legs', 'full_body', 'push', 'pull', 'legs'];

/**
 * Determine today's suggested focus based on recent workout muscle groups
 */
function suggestTodayFocus(recentWorkouts) {
    const recentGroups = recentWorkouts.slice(0, 3).map(w => w.muscle_group);
    // Find the first focus type not done recently
    for (const focus of FOCUS_ROTATION) {
        const muscleMap = { push: ['chest', 'shoulders', 'arms'], pull: ['back', 'arms'], legs: ['legs'], full_body: ['full_body', 'core'] };
        const isDoneRecently = recentGroups.some(g => muscleMap[focus]?.includes(g));
        if (!isDoneRecently) return focus;
    }
    return 'full_body';
}

/**
 * Build system prompt for daily workout
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

Rules:
- Respond ONLY with valid JSON — no markdown, no extra text
- Exercise names in English
- coach_note in Hebrew (1-2 motivational sentences)
- Use only equipment available in the user's environment
- Set volume appropriate for experience level
- Include 4-6 exercises`;
}

/**
 * Build user message for daily workout
 */
function buildWorkoutUserMessage({ recentWorkouts, todayFocus, user }) {
    const p = user.profile || {};
    const recentSummary = recentWorkouts.slice(0, 5)
        .map(w => `  - ${new Date(w.date).toLocaleDateString('he-IL')}: ${w.muscle_group} (${w.exercises?.length || 0} exercises, ${w.status})`)
        .join('\n') || '  (no recent workouts)';

    return `Generate a special one-time workout for TODAY.

Today's suggested focus: ${todayFocus}
Session duration: ${p.session_duration || 60} minutes

My recent workouts:
${recentSummary}

Generate a workout that:
1. Targets the suggested focus muscle group
2. Fits within the session duration
3. Avoids repeating the same muscles from the last 1-2 days
4. Is appropriate for my experience level and equipment

Respond with this exact JSON structure:
{
  "title": "Catchy workout title",
  "muscle_group": "primary muscle group",
  "focus": "${todayFocus}",
  "duration_minutes": ${p.session_duration || 60},
  "exercises": [
    {
      "name": "Exercise Name",
      "sets": 3,
      "reps": "8-12",
      "rest_seconds": 90,
      "notes": "Quick form tip"
    }
  ],
  "coach_note": "משפט מוטיבציה בעברית"
}`;
}

module.exports = { buildWorkoutSystem, buildWorkoutUserMessage, suggestTodayFocus };
