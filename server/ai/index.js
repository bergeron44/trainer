const { ChatProvider, assertChatProvider } = require('./core/chatProvider');
const {
    ChatGenerateInputSchema,
    ChatGenerateOutputSchema,
    validateChatGenerateInput,
    validateChatGenerateOutput,
} = require('./core/chatSchemas');
const {
    registerChatProvider,
    listChatProviders,
    getConfiguredProviderName,
    createChatProvider,
    clearChatProviderRegistryForTests,
} = require('./providers');

module.exports = {
    ChatProvider,
    assertChatProvider,
    ChatGenerateInputSchema,
    ChatGenerateOutputSchema,
    validateChatGenerateInput,
    validateChatGenerateOutput,
    registerChatProvider,
    listChatProviders,
    getConfiguredProviderName,
    createChatProvider,
    clearChatProviderRegistryForTests,
};
