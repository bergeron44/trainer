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

        // Exact match first
        let exercise = await Exercise.findOne({ name: new RegExp(`^${name}$`, 'i') });

        // Partial match fallback
        if (!exercise) {
            exercise = await Exercise.findOne({ name: new RegExp(name, 'i') });
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
