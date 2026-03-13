const fs = require('fs/promises');
const path = require('path');

const DEFAULT_AUDIT_LOG_PATH = path.join(process.cwd(), 'server', 'logs', 'nutrition_extraction_audit.jsonl');

async function appendJsonLine(filePath, payload) {
    const targetPath = filePath || DEFAULT_AUDIT_LOG_PATH;
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.appendFile(targetPath, `${JSON.stringify(payload)}\n`, 'utf8');
    return targetPath;
}

async function appendNutritionAuditLog({
    filePath,
    user_id,
    raw_text,
    extractor_output,
    normalized_output,
    validation_result,
    reviewer_output,
    final_decision,
    clarification_question,
    error_type,
    corrected_output_if_available,
}) {
    const entry = {
        timestamp: new Date().toISOString(),
        user_id,
        raw_text,
        extractor_output,
        normalized_output,
        validation_result,
        reviewer_output,
        final_decision,
        clarification_question: clarification_question || null,
        error_type: error_type || null,
        corrected_output_if_available: corrected_output_if_available || null,
    };

    const logPath = await appendJsonLine(filePath, entry);
    return { logPath, entry };
}

module.exports = {
    DEFAULT_AUDIT_LOG_PATH,
    appendNutritionAuditLog,
};
