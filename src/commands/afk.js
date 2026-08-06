const { getMessageType } = require("../utils/commonHelpers");
const { normalizeId } = require("../config/protectedUsers");

// Memory store for AFK statuses
// Structure: threadId -> userId -> { reason, startTime, mentions: [] }
const afkState = new Map();

function getMessageContent(message) {
    return typeof message?.data?.content === "string" ? message.data.content.trim() : "";
}

function getAfkData(threadId, userId) {
    const threadAfk = afkState.get(String(threadId));
    if (!threadAfk) return null;
    return threadAfk.get(String(userId)) || null;
}

function setAfkData(threadId, userId, data) {
    let threadAfk = afkState.get(String(threadId));
    if (!threadAfk) {
        threadAfk = new Map();
        afkState.set(String(threadId), threadAfk);
    }
    threadAfk.set(String(userId), data);
}

function removeAfkData(threadId, userId) {
    const threadAfk = afkState.get(String(threadId));
    if (threadAfk) {
        threadAfk.delete(String(userId));
    }
}

function addAfkMention(threadId, userId, senderId, senderName, content) {
    const data = getAfkData(threadId, userId);
    if (data) {
        data.mentions.push({ senderId, senderName, content });
    }
}

function formatDuration(startTime) {
    const diffMs = Math.max(0, Date.now() - startTime);
    const totalMinutes = Math.floor(diffMs / (60 * 1000));
    const totalHours = Math.floor(diffMs / (60 * 60 * 1000));
    const totalDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (totalDays >= 1) {
        const hours = totalHours % 24;
        return `${totalDays} ngày ${hours} giờ`;
    }
    if (totalHours >= 1) {
        const minutes = totalMinutes % 60;
        return `${totalHours} giờ ${minutes} phút`;
    }
    return `${Math.max(totalMinutes, 1)} phút`;
}

async function handleAFKCommand(api, message, threadId, User, prefix = "!") {
    const messageType = getMessageType(message);
    const rawId = message?.data?.uidFrom;
    const senderId = normalizeId(rawId) || rawId;

    const raw = getMessageContent(message);
    const parts = raw.split(/\s+/);
    parts.shift(); // Remove the command
    const reason = parts.length > 0 ? parts.join(" ") : "không có lý do";

    setAfkData(threadId, senderId, {
        reason: reason,
        startTime: Date.now(),
        mentions: []
    });

    const senderName = typeof message?.data?.dName === "string" ? message.data.dName.trim() : `UID ${senderId}`;
    await api.sendMessage({
        msg: `💤 ${senderName} đã treo máy đi: ${reason}\n⏳ Bắt đầu bấm giờ...`
    }, threadId, messageType);
}

module.exports = {
    handleAFKCommand,
    getAfkData,
    removeAfkData,
    addAfkMention,
    formatDuration
};
