const mongoose = require('mongoose');

const chatSummarySchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    agent_type: {
        type: String,
        enum: ['coach', 'nutritionist'],
        default: 'coach',
        index: true,
    },
    user_request: { type: String, required: true },
    ai_response: { type: String, required: true },
    context: String
}, {
    timestamps: true
});

chatSummarySchema.index({ user: 1, agent_type: 1, createdAt: -1 });

const ChatSummary = mongoose.model('ChatSummary', chatSummarySchema);
module.exports = ChatSummary;
