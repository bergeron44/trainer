const ToolRegistry = require('./toolRegistry');
const ToolExecutor = require('./toolExecutor');
const { createWorkoutTools } = require('./handlers/workoutsTools');
const { createUserTools } = require('./handlers/userTools');
const { createNutritionTools } = require('./handlers/nutritionTools');
const { createMealsTools } = require('./handlers/mealsTools');
const ToolExecutionAudit = require('../../models/ToolExecutionAudit');
const ToolIdempotencyRecord = require('../../models/ToolIdempotencyRecord');
const Workout = require('../../models/Workout');
const WorkoutLog = require('../../models/WorkoutLog');
const Exercise = require('../../models/Exercise');
const User = require('../../models/User');
const NutritionLog = require('../../models/NutritionLog');

function createDefaultToolRegistry({ models = {} } = {}) {
    const registry = new ToolRegistry();
    const resolvedModels = {
        Workout: models.Workout || Workout,
        WorkoutLog: models.WorkoutLog || WorkoutLog,
        Exercise: models.Exercise || Exercise,
        User: models.User || User,
        NutritionLog: models.NutritionLog || NutritionLog,
    };

    const tools = [
        ...createWorkoutTools({ models: resolvedModels }),
        ...createUserTools({ models: resolvedModels }),
        ...createNutritionTools({ models: resolvedModels }),
        ...createMealsTools({ models: resolvedModels }),
    ];

    for (const tool of tools) {
        registry.register(tool);
    }

    return registry;
}

function createToolExecutor({
    registry,
    models = {},
    toolExecutionAuditModel,
    toolIdempotencyRecordModel,
    config = {},
} = {}) {
    return new ToolExecutor({
        registry: registry || createDefaultToolRegistry({ models }),
        toolExecutionAuditModel: toolExecutionAuditModel || ToolExecutionAudit,
        toolIdempotencyRecordModel: toolIdempotencyRecordModel || ToolIdempotencyRecord,
        defaultTimeoutMs: Number.parseInt(config.defaultTimeoutMs || process.env.CHAT_TOOL_TIMEOUT_MS || '', 10)
            || 7000,
    });
}

module.exports = {
    ToolRegistry,
    ToolExecutor,
    createDefaultToolRegistry,
    createToolExecutor,
};
