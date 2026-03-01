const express = require('express');
const router = express.Router();
const Exercise = require('../models/Exercise');
const { protect } = require('../middleware/authMiddleware');

// GET /api/exercises — all exercises (optionally filter by muscle_group)
router.get('/', protect, async (req, res) => {
    try {
        const filter = {};
        if (req.query.muscle_group) filter.muscle_group = req.query.muscle_group;
        const exercises = await Exercise.find(filter).sort({ name: 1 });
        res.json(exercises);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/exercises/lookup?name=bench+press — find by name (fuzzy)
router.get('/lookup', protect, async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) return res.status(400).json({ message: 'name is required' });

        // Escape regex special chars
        const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // 1. Exact match (case insensitive)
        let exercise = await Exercise.findOne({ name: new RegExp(`^${escapeRe(name)}$`, 'i') });

        // 2. Strip trailing 's' / 'es' to handle plurals  ("Pull-ups" → "Pull-Up", "Barbell Rows" → "Barbell Row")
        if (!exercise) {
            const singular = name.replace(/e?s$/i, '');
            if (singular !== name) {
                exercise = await Exercise.findOne({ name: new RegExp(`^${escapeRe(singular)}$`, 'i') });
                // Also try singular with a partial to catch "Barbell Row" when "Barbell Rows" given
                if (!exercise) {
                    exercise = await Exercise.findOne({ name: new RegExp(escapeRe(singular), 'i') });
                }
            }
        }

        // 3. Partial match with the original name
        if (!exercise) {
            exercise = await Exercise.findOne({ name: new RegExp(escapeRe(name), 'i') });
        }

        // 4. Word-by-word scoring — pick the DB exercise whose name contains the most words from the query
        if (!exercise) {
            const words = name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            if (words.length > 0) {
                const candidates = await Exercise.find({
                    name: new RegExp(words[0], 'i')   // at least the first word matches
                }).lean();
                if (candidates.length > 0) {
                    // Score = number of query words found in the candidate name
                    const scored = candidates.map(c => ({
                        ex: c,
                        score: words.filter(w => c.name.toLowerCase().includes(w)).length
                    }));
                    scored.sort((a, b) => b.score - a.score);
                    if (scored[0].score > 0) exercise = scored[0].ex;
                }
            }
        }

        if (!exercise) return res.status(404).json({ message: 'Exercise not found' });
        res.json(exercise);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/exercises/:id
router.get('/:id', protect, async (req, res) => {
    try {
        const exercise = await Exercise.findById(req.params.id);
        if (!exercise) return res.status(404).json({ message: 'Exercise not found' });
        res.json(exercise);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
