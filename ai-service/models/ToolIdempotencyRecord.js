const mongoose = require('mongoose');

const toolIdempotencyRecordSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    tool_name: {
        type: String,
        required: true,
    },
    key: {
        type: String,
        required: true,
    },
    result: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
}, {
    timestamps: true,
});

toolIdempotencyRecordSchema.index({ user: 1, tool_name: 1, key: 1 }, { unique: true });

const ToolIdempotencyRecord = mongoose.model('ToolIdempotencyRecord', toolIdempotencyRecordSchema);
module.exports = ToolIdempotencyRecord;
