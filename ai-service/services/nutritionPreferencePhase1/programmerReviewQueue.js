const path = require('path');
const { appendNutritionAuditLog } = require('./auditLogger');
const fs = require('fs/promises');

const DEFAULT_PROGRAMMER_QUEUE_PATH = path.join(process.cwd(), 'server', 'logs', 'nutrition_programmer_review_queue.jsonl');

async function appendQueueEntry(filePath, payload) {
    const targetPath = filePath || DEFAULT_PROGRAMMER_QUEUE_PATH;
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.appendFile(targetPath, `${JSON.stringify(payload)}\n`, 'utf8');
    return targetPath;
}

async function enqueueProgrammerReview({
    filePath,
    user_id,
    reason,
    audit_entry,
    extractor_output,
    reviewer_output,
    final_decision,
}) {
    const entry = {
        timestamp: new Date().toISOString(),
        user_id,
        reason,
        final_decision,
        extractor_output,
        reviewer_output,
        audit_entry,
    };
    const queuePath = await appendQueueEntry(filePath, entry);
    return { queuePath, entry };
}

module.exports = {
    DEFAULT_PROGRAMMER_QUEUE_PATH,
    enqueueProgrammerReview,
};
