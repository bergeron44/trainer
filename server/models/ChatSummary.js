const mongoose = require('mongoose');

const chatSummarySchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    user_request: { type: String, required: true },
    ai_response: { type: String, required: true },
    context: String
}, {
    timestamps: true
});

const ChatSummary = mongoose.model('ChatSummary', chatSummarySchema);
module.exports = ChatSummary;
