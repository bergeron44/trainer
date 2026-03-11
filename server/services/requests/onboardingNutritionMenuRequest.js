const BaseRequest = require('./baseRequest');
const { createChatProvider } = require('../../ai/providers');
const { createToolExecutor } = require('../../ai/tools');

const MAX_TOOL_ITERATIONS = 5;
const MAX_TOOL_CALLS = 20;

function safeJsonText(value) {
    try { return JSON.stringify(value); } catch (_e) { return String(value); }
}

function buildProfileContext({ userProfile = {}, likedFoods = [], dislikedFoods = [] } = {}) {
    const lines = [
        `Goal: ${userProfile.goal || 'not specified'}`,
        `Diet type: ${userProfile.diet_type || 'not specified'}`,
        `Allergies: ${userProfile.allergies || 'none'}`,
        `Daily calorie target: ${userProfile.target_calories || 'not specified'} kcal`,
        `Protein goal: ${userProfile.protein_goal || 'not specified'}g`,
        `Carbs goal: ${userProfile.carbs_goal || 'not specified'}g`,
        `Fat goal: ${userProfile.fat_goal || 'not specified'}g`,
        `TDEE: ${userProfile.tdee || 'not specified'} kcal`,
        `Activity level: ${userProfile.activity_level || 'not specified'}`,
    ];
    if (Array.isArray(likedFoods) && likedFoods.length > 0) {
        lines.push(`Liked foods: ${likedFoods.map((f) => f.name).filter(Boolean).join(', ')}`);
    }
    if (Array.isArray(dislikedFoods) && dislikedFoods.length > 0) {
        lines.push(`Disliked foods: ${dislikedFoods.map((f) => f.name).filter(Boolean).join(', ')}`);
    }
    return lines.join('\n');
}

class OnboardingNutritionMenuRequest extends BaseRequest {
    constructor({ provider, toolExecutor, maxOutputTokens } = {}) {
        super({ type: 'onboarding_nutrition_menu' });
        this._maxOutputTokens = maxOutputTokens || 1800;
        this._provider = provider || null;
        this._toolExecutor = toolExecutor || null;
    }

    _getProvider() {
        if (!this._provider) this._provider = createChatProvider();
        return this._provider;
    }

    _getToolExecutor() {
        if (!this._toolExecutor) this._toolExecutor = createToolExecutor();
        return this._toolExecutor;
    }

    buildSystemPrompt({ requestId, userProfile = {}, likedFoods = [], dislikedFoods = [] } = {}) {
        return [
            'You are the onboarding nutrition menu planner.',
            '',
            'User profile:',
            buildProfileContext({ userProfile, likedFoods, dislikedFoods }),
            '',
            'Save a complete meal menu for onboarding by calling nutrition_create_menu_entry for each meal.',
            'Create 3-4 meal periods (Breakfast, Lunch, Dinner, and optionally Snack).',
            'For each meal period, create 2-3 different meal options.',
            'Minimum success criteria: call nutrition_create_menu_entry at least once.',
            'Do not end this task without at least one nutrition_create_menu_entry call.',
            'Respect diet_type, allergies, and avoid disliked_foods.',
            'Each meal must have realistic calorie and macro values that fit within the daily targets.',
            `Every nutrition_create_menu_entry call must include idempotencyKey: "onboarding-${requestId || 'request'}-menu-<period>-<index>"`,
            'After saving all entries, provide a short summary of what was created.',
        ].join('\n');
    }

    _buildRetrySystemPrompt({ requestId, userProfile, likedFoods, dislikedFoods } = {}) {
        return [
            this.buildSystemPrompt({ requestId, userProfile, likedFoods, dislikedFoods }),
            '',
            'Previous pass failed to create any menu entries.',
            'Call nutrition_create_menu_entry at least once immediately.',
        ].join('\n');
    }

    _countCreated(toolTrace) {
        return (toolTrace || []).filter(
            (item) => item?.ok && item?.toolName === 'nutrition_create_menu_entry'
        ).length;
    }

    async _runPass({ system, userMessage, userId, requestId, options }) {
        const provider = this._getProvider();
        const toolExecutor = this._getToolExecutor();
        const toolDefinitions = toolExecutor.listToolsForModel({ names: ['nutrition_create_menu_entry'] });

        let workingMessages = [{ role: 'user', content: userMessage }];
        const toolTrace = [];
        let totalToolCalls = 0;
        let providerResult;

        for (let round = 1; round <= MAX_TOOL_ITERATIONS; round += 1) {
            // eslint-disable-next-line no-await-in-loop
            providerResult = await provider.generateSafe({
                system,
                messages: workingMessages,
                tools: toolDefinitions,
                options,
                userId,
            });

            const requestedCalls = Array.isArray(providerResult.toolCalls)
                ? providerResult.toolCalls
                : [];

            if (!requestedCalls.length) break;

            const remaining = MAX_TOOL_CALLS - totalToolCalls;
            if (remaining <= 0) break;

            const callsToExecute = requestedCalls
                .slice(0, remaining)
                .map((call, i) => ({ ...call, id: call.id || `nc_${round}_${i}` }));

            // eslint-disable-next-line no-await-in-loop
            const results = await toolExecutor.executeToolCalls({
                toolCalls: callsToExecute,
                maxCalls: remaining,
                context: { userId, requestId },
            });

            totalToolCalls += results.length;
            toolTrace.push(...results);

            workingMessages = [
                ...workingMessages,
                {
                    role: 'assistant',
                    content: providerResult.text || '',
                    toolCalls: callsToExecute,
                },
                ...results.map((result, i) => ({
                    role: 'tool',
                    name: result.toolName,
                    toolCallId: result.toolCallId || callsToExecute[i]?.id,
                    content: safeJsonText(result.ok ? result.data : result.error),
                })),
            ];

            if (totalToolCalls >= MAX_TOOL_CALLS) break;
        }

        return {
            toolTrace,
            provider: providerResult?.provider,
            model: providerResult?.model,
        };
    }

    async execute(context = {}) {
        const { userId, requestId, userProfile, likedFoods, dislikedFoods } = context;
        const profileData = {
            requestId,
            userProfile: userProfile || {},
            likedFoods: likedFoods || [],
            dislikedFoods: dislikedFoods || [],
        };
        const options = { temperature: 0.2, maxTokens: this._maxOutputTokens };

        // Pass 1
        const firstPass = await this._runPass({
            system: this.buildSystemPrompt(profileData),
            userMessage: 'Create my personalized onboarding nutrition menu now.',
            userId,
            requestId,
            options,
        });

        let mergedToolTrace = [...firstPass.toolTrace];
        let result = firstPass;
        let createdCount = this._countCreated(mergedToolTrace);

        // Pass 2: retry if no entries were created
        if (createdCount < 1) {
            const secondPass = await this._runPass({
                system: this._buildRetrySystemPrompt(profileData),
                userMessage: 'Retry now. Call nutrition_create_menu_entry with valid arguments.',
                userId,
                requestId,
                options: { temperature: 0.1, maxTokens: this._maxOutputTokens },
            });

            mergedToolTrace = [...mergedToolTrace, ...secondPass.toolTrace];
            result = secondPass;
            createdCount = this._countCreated(mergedToolTrace);
        }

        if (createdCount < 1) {
            throw new Error(
                `Nutrition menu planner created no entries. `
                + `provider=${result.provider} model=${result.model}`
            );
        }

        return { provider: result.provider, model: result.model, toolTrace: mergedToolTrace, createdCount };
    }
}

module.exports = OnboardingNutritionMenuRequest;