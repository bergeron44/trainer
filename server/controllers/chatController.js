const ChatSummary = require('../models/ChatSummary');
const asyncHandler = require('express-async-handler');
const ChatBrainService = require('../services/chatBrainService');

let chatBrainService = new ChatBrainService();

function clampInt(value, { min, max, fallback }) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function sanitizeContext(context) {
    if (!context) return undefined;
    if (typeof context === 'string') return context;
    if (typeof context === 'object') return JSON.stringify(context);
    return String(context);
}

function mapChatError(error) {
    if (error?.name === 'ZodError') {
        return {
            status: 400,
            code: 'CHAT_VALIDATION_ERROR',
            message: 'Invalid chat payload.',
            details: error.issues || [],
        };
    }

    if (
        typeof error?.message === 'string' &&
        error.message.toLowerCase().includes('not configured')
    ) {
        return {
            status: 503,
            code: 'CHAT_PROVIDER_NOT_CONFIGURED',
            message: 'Chat provider is not configured on the server.',
        };
    }

    if (typeof error?.status === 'number') {
        return {
            status: 502,
            code: 'CHAT_PROVIDER_ERROR',
            message: 'Upstream AI provider request failed.',
        };
    }

    return {
        status: 500,
        code: 'CHAT_INTERNAL_ERROR',
        message: 'Failed to generate chat response.',
    };
}

function classifyError(error) {
    if (error?.name === 'ZodError') return 'validation';
    if (typeof error?.status === 'number') return 'provider_http';
    if (error?.code) return `provider_${String(error.code).toLowerCase()}`;
    return 'internal';
}

// @desc    Generate a response
// @route   POST /api/chat/response
// @access  Private
const generateResponse = asyncHandler(async (req, res) => {
    const start = Date.now();
    try {
        const {
            prompt,
            messages,
            context,
            coachStyle,
            personaId,
            system,
            metadata,
            options,
            persistSummary,
            memoryLimit,
        } = req.body || {};

        const result = await chatBrainService.generateResponse({
            prompt,
            messages,
            context,
            coachStyle,
            personaId,
            system,
            metadata,
            options,
            persistSummary,
            memoryLimit,
            userId: req.user.id,
        });

        const latencyMs = Date.now() - start;
        console.log('chat.response.success', {
            requestId: req.requestId,
            userId: req.user?.id,
            provider: result.provider,
            model: result.model,
            latencyMs,
            usage: result.usage,
        });

        res.json({
            response: result.response,
            provider: result.provider,
            model: result.model,
            finishReason: result.finishReason,
            usage: result.usage,
            meta: result.meta,
            requestId: req.requestId,
        });
    } catch (error) {
        const mappedError = mapChatError(error);
        const latencyMs = Date.now() - start;
        console.error('chatController.generateResponse error:', {
            code: mappedError.code,
            message: error?.message,
            status: error?.status,
            userId: req.user?.id,
            requestId: req.requestId,
            errorType: classifyError(error),
            latencyMs,
        });
        res.status(mappedError.status).json({
            error: mappedError.code,
            message: mappedError.message,
            details: mappedError.details,
            requestId: req.requestId,
        });
    }
});

// @desc    Get chat summaries
// @route   GET /api/chat/summaries
// @access  Private
const getSummaries = asyncHandler(async (req, res) => {
    const limit = clampInt(req.query.limit, {
        min: 1,
        max: 20,
        fallback: 5,
    });

    const summaries = await ChatSummary.find({ user: req.user.id })
        .sort({ createdAt: -1 })
        .limit(limit);

    res.json(summaries);
});

// @desc    Create chat summary
// @route   POST /api/chat/summaries
// @access  Private
const createSummary = asyncHandler(async (req, res) => {
    const { user_request, ai_response, context } = req.body;
    if (!user_request || !ai_response) {
        return res.status(400).json({
            error: 'CHAT_SUMMARY_VALIDATION_ERROR',
            message: 'user_request and ai_response are required.',
        });
    }

    const summary = await ChatSummary.create({
        user: req.user.id,
        user_request,
        ai_response,
        context: sanitizeContext(context),
    });

    res.status(201).json(summary);
});

function setChatBrainServiceForTests(service) {
    chatBrainService = service;
}

function resetChatBrainServiceForTests() {
    chatBrainService = new ChatBrainService();
}

module.exports = {
    generateResponse,
    getSummaries,
    createSummary,
    setChatBrainServiceForTests,
    resetChatBrainServiceForTests,
};
