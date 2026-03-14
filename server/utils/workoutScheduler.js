/**
 * Shared workout scheduling utility.
 * Expands a repeating sequence of workout steps into dated workout insert documents.
 */

/**
 * Build an array of Workout insert documents from a repeating sequence.
 *
 * @param {Object} opts
 * @param {string|import('mongoose').Types.ObjectId} opts.userId
 * @param {Array<{type:'workout'|'rest', name?:string, exercises?:Array}>} opts.sequence
 * @param {Date} [opts.startDate]   defaults to today at midnight UTC
 * @param {number} [opts.weeks]     defaults to 12
 * @returns {Array} Ready-to-pass-to-insertMany workout documents
 */
function buildWorkoutInsertDocs({ userId, sequence, startDate, weeks = 12 }) {
    if (!Array.isArray(sequence) || sequence.length === 0) {
        return [];
    }

    // Normalize startDate to midnight UTC
    const base = startDate ? new Date(startDate) : new Date();
    const start = new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate()));

    const totalDays = weeks * 7;
    const docs = [];

    for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
        const step = sequence[dayOffset % sequence.length];

        if (!step || step.type === 'rest') {
            continue; // rest days consume a calendar day but produce no record
        }

        const date = new Date(start);
        date.setUTCDate(start.getUTCDate() + dayOffset);

        docs.push({
            user: userId,
            date,
            muscle_group: step.name,
            exercises: (step.exercises || []).map((ex, idx) => ({
                id: ex.id || `scheduled_${dayOffset}_${idx}`,
                name: ex.name,
                sets: ex.sets,
                reps: ex.reps,
                rest_seconds: ex.rest_seconds,
                weight: ex.weight,
                notes: ex.notes,
            })),
            status: 'planned',
        });
    }

    return docs;
}

module.exports = { buildWorkoutInsertDocs };
