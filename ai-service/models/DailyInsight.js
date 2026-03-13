const mongoose = require('mongoose');

const dailyInsightSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    insights: [{
        type: { type: String, enum: ['warning', 'success', 'tip'], required: true },
        text: { type: String, required: true },
    }],
    generated_at: { type: Date, default: Date.now },
}, { timestamps: true });

dailyInsightSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyInsight', dailyInsightSchema);
