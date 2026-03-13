/**
 * In-memory store for recent messages
 * Used to retrieve message content when a message recall event is triggered
 */
class MessageStore {
    constructor(maxMessages = 1000, ttlMs = 5 * 60 * 1000) {
        this.messages = new Map(); // key: `${threadId}:${globalMsgId}`, value: message data
        this.maxMessages = maxMessages;
        this.ttlMs = ttlMs;
    }

    /**
     * Store a message
     */
    storeMessage(threadId, message) {
        if (!threadId || !message) return;

        const globalMsgId = String(message?.globalMsgId || message?.msgId || "").trim();
        const cliMsgId = String(message?.cliMsgId || "").trim();
        
        if (!globalMsgId) return;

        const key = `${threadId}:${globalMsgId}`;
        const messageData = {
            threadId,
            globalMsgId,
            cliMsgId,
            content: message?.content,
            senderUid: String(message?.uidFrom || message?.senderUid || "").trim(),
            senderName: String(message?.dName || message?.senderName || "").trim(),
            timestamp: Date.now(),
            messageType: String(message?.msgType || "").trim(),
        };

        this.messages.set(key, messageData);
        console.log(`[📝 MSG STORE] Lưu tin nhắn - msgId: ${globalMsgId}, nội dung: ${message?.content?.substring(0, 50)}`);

        // Clean up old messages if exceeding limit
        if (this.messages.size > this.maxMessages) {
            const sortedEntries = Array.from(this.messages.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp);
            
            const entriesToDelete = sortedEntries.slice(0, Math.floor(this.maxMessages * 0.2));
            for (const [key] of entriesToDelete) {
                this.messages.delete(key);
            }
        }
    }

    /**
     * Retrieve a message by globalMsgId
     */
    getMessage(threadId, globalMsgId) {
        if (!threadId || !globalMsgId) return null;

        const key = `${threadId}:${globalMsgId}`;
        const message = this.messages.get(key);

        if (!message) return null;

        // Check if message has expired
        if (Date.now() - message.timestamp > this.ttlMs) {
            this.messages.delete(key);
            return null;
        }

        return message;
    }

    /**
     * Remove a message
     */
    deleteMessage(threadId, globalMsgId) {
        if (!threadId || !globalMsgId) return;
        const key = `${threadId}:${globalMsgId}`;
        this.messages.delete(key);
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            totalMessages: this.messages.size,
            maxMessages: this.maxMessages,
            ttlMs: this.ttlMs,
        };
    }
}

function createMessageStore(maxMessages = 1000, ttlMs = 5 * 60 * 1000) {
    return new MessageStore(maxMessages, ttlMs);
}

module.exports = {
    createMessageStore,
    MessageStore,
};
