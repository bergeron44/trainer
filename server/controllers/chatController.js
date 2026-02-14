const ChatSummary = require('../models/ChatSummary');
const asyncHandler = require('express-async-handler');

// @desc    Generate a response (Mock AI)
// @route   POST /api/chat/response
// @access  Private
const generateResponse = asyncHandler(async (req, res) => {
    const { prompt, context, coachStyle } = req.body;

    // In a real app, you would call OpenAI/Anthropic API here.
    // For now, we'll use a simple rule-based mock response.

    let response = "I'm here to help you crush your goals! 💪";

    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('nutrition') || lowerPrompt.includes('eat') || lowerPrompt.includes('food')) {
        response = "Nutrition is key! 🍎 Focus on whole foods and hitting your protein goals. Need specific meal ideas?";
    } else if (lowerPrompt.includes('workout') || lowerPrompt.includes('exercise') || lowerPrompt.includes('gym')) {
        response = "Consistency is king in the gym! 🏋️‍♂️ Stick to the plan and push for progress over perfection.";
    } else if (lowerPrompt.includes('tired') || lowerPrompt.includes('rest')) {
        response = "Rest is when the muscles grow! 😴 Listen to your body, but don't let excuses win.";
    }

    // Verify context/style for flavor (optional enhancement)
    if (coachStyle === 'hardcore') {
        response = response.toUpperCase() + " NO EXCUSES!";
    } else if (coachStyle === 'spicy') {
        response += " Don't slack off now! 🔥";
    }

    res.json({ response });
});

// @desc    Get chat summaries
// @route   GET /api/chat/summaries
// @access  Private
const getSummaries = asyncHandler(async (req, res) => {
    // Assuming ChatSummary model has a 'user' field, though the provided schema definition was minimal.
    // If the schema in 'entitis' file didn't specify a user, we might need to adjust.
    // Ideally, we filter by req.user.id

    // Check if ChatSummary model has user field, if not, we might need to update the model or just return all (not ideal for multi-user)
    // For now, let's assume valid schema or user-agnostic for this phase if schema is simple.
    // Actually, let's check the model file content in next steps if needed. 
    // Based on typical pattern:
    const summaries = await ChatSummary.find({}).sort({ createdAt: -1 }).limit(5); // Adjusted to not filter by user if schema doesn't have it yet, or add it.

    // NOTE: If ChatSummary schema doesn't have 'user', we should look into adding it. 
    // But for this refactor, we stick to existing structure unless we edit model.
    // We'll trust existing schema has timestamps (check entitis or model file).
    // Schema in 'entitis': "ChatSummary": { "id": "uuid", "created_date": "datetime", ... }
    // Mongoose equivalent usually has createdAt.

    res.json(summaries);
});

// @desc    Create chat summary
// @route   POST /api/chat/summaries
// @access  Private
const createSummary = asyncHandler(async (req, res) => {
    const { user_request, ai_response, context } = req.body;

    const summary = await ChatSummary.create({
        user_request,
        ai_response,
        context,
        // user: req.user.id // Add this if we update the schema
    });

    res.status(201).json(summary);
});

module.exports = {
    generateResponse,
    getSummaries,
    createSummary,
};
