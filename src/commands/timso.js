const { Reactions, ThreadType } = require("zca-js");
const { getMessageType } = require("../utils/commonHelpers");
const { isAllowedTimCommandUid } = require("../config/protectedUsers");

function stripLeadingMention(text, mentions) {
    if (typeof text !== "string" || !Array.isArray(mentions) || mentions.length === 0) {
        return text;
    }

    const firstMention = mentions
        .filter((mention) => mention && typeof mention.pos !== "undefined" && typeof mention.len !== "undefined")
        .sort((a, b) => Number(a.pos) - Number(b.pos))[0];

    if (!firstMention) {
        return text;
    }

    const pos = Number(firstMention.pos);
    const len = Number(firstMention.len);
    if (Number.isNaN(pos) || Number.isNaN(len) || pos !== 0 || len <= 0) {
        return text;
    }

    return text.slice(len).trimStart();
}

function getQuotedMessageData(message) {
    const quote = message?.data?.quote;
    if (!quote || typeof quote !== "object") return null;
    const msgId = String(quote.msgId || quote.globalMsgId || "").trim();
    const cliMsgId = String(quote.cliMsgId || quote.qmsgCliId || "").trim();
    if (!msgId || !cliMsgId) return null;
    return { msgId, cliMsgId };
}

function parseTimCount(message) {
    const content = String(message?.data?.content || "");
    const cleanContent = stripLeadingMention(content, message?.data?.mentions).trim();
    const parts = cleanContent.split(/\s+/);
    if (parts.length < 2) return null;
    const count = Number.parseInt(parts[1], 10);
    if (!Number.isFinite(count) || count <= 0) return null;
    return Math.min(Math.max(count, 1), 3600);
}

function resolveSenderId(message) {
    if (!message || typeof message !== "object") return "";
    const data = message.data || {};
    const candidateIds = [
        data.uidFrom,
        data.uid,
        data.userId,
        data.senderId,
        data.from && data.from.userId,
        data.from && data.from.uid,
        data.from && data.from.uidFrom,
        data.sender && data.sender.userId,
        data.sender && data.sender.uid,
        data.sender && data.sender.uidFrom,
        message.sender && message.sender.userId,
        message.sender && message.sender.uid,
        message.sender && message.sender.uidFrom,
    ];

    for (const candidate of candidateIds) {
        if (candidate === null || candidate === undefined) continue;
        const normalized = String(candidate).trim();
        if (normalized) return normalized;
    }

    return "";
}

async function handleReactionCountCommand(api, message, threadId, reactionType, commandName, prefix = "!") {
    const messageType = getMessageType(message);
    const senderUserId = resolveSenderId(message);

    if (!isAllowedTimCommandUid(senderUserId)) {
        return;
    }

    const quotedMessage = getQuotedMessageData(message);
    if (!quotedMessage) {
        await api.sendMessage(
            {
                msg: `Hãy trả lời một tin nhắn bằng lệnh ${prefix}${commandName} <số>.`,
            },
            threadId,
            messageType
        );
        return;
    }

    const count = parseTimCount(message);
    if (count === null) {
        await api.sendMessage(
            {
                msg: `Sai cú pháp. Dùng ${prefix}${commandName} 100 để thả cảm xúc vào tin nhắn trả lời, tối đa 3600 lần.`,
            },
            threadId,
            messageType
        );
        return;
    }

    const dest = {
        type: message?.type === 1 ? ThreadType.Group : ThreadType.User,
        threadId: String(threadId || "").trim(),
        data: {
            msgId: quotedMessage.msgId,
            cliMsgId: quotedMessage.cliMsgId,
        },
    };

    for (let i = 0; i < count; i += 1) {
        try {
            await api.addReaction(reactionType, dest);
        } catch (error) {
            console.error(`[${commandName}] Failed to add reaction ${i + 1}/${count}:`, error?.message || error);
            break;
        }
    }
}

async function handleTimCommand(api, message, threadId, prefix = "!") {
    return handleReactionCountCommand(api, message, threadId, Reactions.HEART, "tim", prefix);
}

async function handleLikeCommand(api, message, threadId, prefix = "!") {
    return handleReactionCountCommand(api, message, threadId, Reactions.LIKE, "like", prefix);
}

async function handleHahaCommand(api, message, threadId, prefix = "!") {
    return handleReactionCountCommand(api, message, threadId, Reactions.HAHA, "haha", prefix);
}

async function handleWowCommand(api, message, threadId, prefix = "!") {
    return handleReactionCountCommand(api, message, threadId, Reactions.WOW, "wow", prefix);
}

async function handleKhocCommand(api, message, threadId, prefix = "!") {
    return handleReactionCountCommand(api, message, threadId, Reactions.CRY, "khoc", prefix);
}

async function handlePhanNoCommand(api, message, threadId, prefix = "!") {
    return handleReactionCountCommand(api, message, threadId, Reactions.ANGRY, "phanno", prefix);
}

module.exports = {
    handleTimCommand,
    handleLikeCommand,
    handleHahaCommand,
    handleWowCommand,
    handleKhocCommand,
    handlePhanNoCommand,
};
