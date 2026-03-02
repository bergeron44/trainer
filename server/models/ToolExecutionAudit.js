const mongoose = require('mongoose');

const toolExecutionAuditSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    request_id: {
        type: String,
        index: true,
    },
    tool_call_id: String,
    tool_name: {
        type: String,
        required: true,
        index: true,
    },
    mode: {
        type: String,
        enum: ['read', 'write'],
        required: true,
    },
    status: {
        type: String,
        enum: ['success', 'error', 'replay'],
        required: true,
    },
    idempotency_key: String,
    changed_fields: [String],
    latency_ms: Number,
    input: mongoose.Schema.Types.Mixed,
    output: mongoose.Schema.Types.Mixed,
    error_code: String,
    error_message: String,
}, {
    timestamps: true,
});

toolExecutionAuditSchema.index({ user: 1, createdAt: -1 });

const ToolExecutionAudit = mongoose.model('ToolExecutionAudit', toolExecutionAuditSchema);
module.exports = ToolExecutionAudit;
