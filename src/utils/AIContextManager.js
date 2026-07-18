class AIContextManager {
    constructor() {
        this.contexts = new Map();
        this.maxContexts = 100;
        this.maxMessages = 50;
        this.cleanupInterval = 5 * 60 * 1000;
        this.messageTimeout = 30 * 60 * 1000;

        this.startCleanup();
    }

    initializeContext(channelId, systemMessage) {
        this.contexts.set(channelId, {
            messages: [{ role: 'system', content: systemMessage }],
            lastAccess: Date.now(),
            createdAt: Date.now()
        });
    }

    addMessage(channelId, message) {
        if (!this.contexts.has(channelId)) {
            this.contexts.set(channelId, {
                messages: [],
                lastAccess: Date.now(),
                createdAt: Date.now()
            });
        }

        const context = this.contexts.get(channelId);
        context.messages.push(message);
        context.lastAccess = Date.now();

        if (context.messages.length > this.maxMessages + 1) {
            const systemMessage = context.messages.find(msg => msg.role === 'system');
            const userMessages = context.messages.filter(msg => msg.role !== 'system');
            const recentMessages = userMessages.slice(-this.maxMessages);
            
            context.messages = systemMessage ? [systemMessage, ...recentMessages] : recentMessages;
        }

        if (this.contexts.size > this.maxContexts) {
            this.cleanupOldest();
        }
    }

    getContext(channelId) {
        const context = this.contexts.get(channelId);
        if (context) {
            context.lastAccess = Date.now();
        }
        return context;
    }

    setContext(channelId, contextData) {
        this.contexts.set(channelId, {
            ...contextData,
            lastAccess: Date.now(),
            createdAt: Date.now()
        });

        if (this.contexts.size > this.maxContexts) {
            this.cleanupOldest();
        }
    }

    removeContext(channelId) {
        this.contexts.delete(channelId);
    }

    cleanup() {
        const now = Date.now();
        for (const [channelId, context] of this.contexts) {
            if (now - context.lastAccess > this.messageTimeout) {
                this.contexts.delete(channelId);
            }
        }
    }

    cleanupOldest() {
        let oldestChannel = null;
        let oldestTime = Date.now();

        for (const [channelId, context] of this.contexts) {
            if (context.lastAccess < oldestTime) {
                oldestTime = context.lastAccess;
                oldestChannel = channelId;
            }
        }

        if (oldestChannel) {
            this.contexts.delete(oldestChannel);
        }
    }

    startCleanup() {
        setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);
    }

    getStats() {
        const now = Date.now();
        let activeContexts = 0;
        let totalMessages = 0;

        for (const context of this.contexts.values()) {
            if (now - context.lastAccess < this.messageTimeout) {
                activeContexts++;
                totalMessages += context.messages.length;
            }
        }

        return {
            totalContexts: this.contexts.size,
            activeContexts,
            totalMessages,
            maxContexts: this.maxContexts,
            maxMessages: this.maxMessages
        };
    }

    getConversationHistory(channelId) {
        const context = this.getContext(channelId);
        if (!context) return '';

        return context.messages.map(msg => `${msg.role}: ${msg.content}`).join("\n");
    }

    addAIResponse(channelId, response) {
        this.addMessage(channelId, { role: 'assistant', content: response });
    }

    clearContext(channelId) {
        this.contexts.delete(channelId);
    }

    getActiveContexts() {
        const now = Date.now();
        const active = [];

        for (const [channelId, context] of this.contexts) {
            if (now - context.lastAccess < this.messageTimeout) {
                active.push({
                    channelId,
                    messageCount: context.messages.length,
                    lastAccess: context.lastAccess,
                    createdAt: context.createdAt
                });
            }
        }

        return active;
    }
}

export default AIContextManager;