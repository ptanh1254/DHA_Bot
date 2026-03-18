/**
 * Common utility functions used across multiple commands
 * Consolidates duplicate code for easy maintenance
 */

// ===== ID & Name Normalization =====
function normalizeId(rawId) {
    if (rawId === null || rawId === undefined) return "";
    return String(rawId).replace(/_0$/, "").trim();
}

function normalizeName(rawName) {
    return String(rawName || "")
        .replace(/^@+/, "")
        .trim();
}

function parseUidArg(rawArgs) {
    const value = String(rawArgs || "").trim();
    if (!value) return "";
    const firstToken = value.split(/\s+/)[0];
    return normalizeId(firstToken);
}

// ===== Message & Mention Extraction =====
function getMentionedUserIds(message) {
    const mentions = Array.isArray(message?.data?.mentions) ? message.data.mentions : [];
    const uniqueIds = new Set();
    for (const mention of mentions) {
        const uid = String(mention?.uid || "").trim();
        if (uid) uniqueIds.add(uid);
    }
    return [...uniqueIds];
}

function getMentionedTargets(message) {
    const mentions = Array.isArray(message?.data?.mentions) ? message.data.mentions : [];
    const content = typeof message?.data?.content === "string" ? message.data.content : "";
    const uniqueTargets = new Map();

    for (const mention of mentions) {
        const uid = String(mention?.uid || "").trim();
        if (!uid || uniqueTargets.has(uid)) continue;

        const pos = Number(mention?.pos);
        const len = Number(mention?.len);
        let displayName = "";

        if (content && Number.isFinite(pos) && Number.isFinite(len) && len > 0) {
            displayName = normalizeName(content.slice(pos, pos + len));
        }

        if (!displayName) {
            displayName = normalizeName(mention?.displayName);
        }

        uniqueTargets.set(uid, {
            userId: uid,
            displayName: displayName || "Người dùng",
        });
    }

    return [...uniqueTargets.values()];
}

function getMessageType(message) {
    return Number(message?.type) || 1;
}

function getUserNameFromMessage(message) {
    const rawName = typeof message?.data?.dName === "string" ? message.data.dName.trim() : "";
    return rawName || "Người dùng";
}

// ===== Message Formatting =====
function formatUidList(ids) {
    return ids.map((id) => `UID ${id}`).join(", ");
}

function formatNameList(targets) {
    return targets.map((target) => target.displayName).join(", ");
}

function buildMention(displayName, uid, pos = 0) {
    return {
        pos,
        uid: String(uid),
        len: `@${displayName}`.length,
    };
}

// ===== API Message Sending =====
async function sendMessage(api, msg, threadId, messageType, mentions = null) {
    try {
        const payload = typeof msg === "string" ? { msg } : msg;
        if (mentions && !payload.mentions) {
            payload.mentions = mentions;
        }
        await api.sendMessage(payload, threadId, messageType);
        return true;
    } catch (error) {
        console.error("Lỗi gửi tin nhắn:", error);
        return false;
    }
}

async function sendErrorMessage(api, errorMsg, threadId, messageType) {
    return sendMessage(api, { msg: errorMsg }, threadId, messageType);
}

// ===== Status Builders =====
function buildToggleStatusMessage(label, isEnabled, prefix, commands) {
    const statusText = isEnabled ? "🟢 BẬT" : "🔴 TẮT";
    const lines = [
        `${label}: ${statusText}`,
        ...commands.map(cmd => `${cmd.icon} ${cmd.text}`),
    ];
    return lines.join("\n");
}

function buildErrorMessage(title, commands = []) {
    const lines = [
        `❌ ${title}`,
        ...commands.map(cmd => `➡️ \`${cmd}\``),
    ];
    return lines.join("\n");
}

/**
 * Extract UIDs from arguments text (only IDs with 6+ digits)
 * Used in commands that accept both mentions and manual UID input
 */
function extractUidArgs(argsText) {
    return String(argsText || "")
        .split(/\s+/)
        .map((part) => normalizeId(part))
        .filter((part) => /^\d{6,}$/.test(part));
}

/**
 * Get the first mentioned user ID from message
 * Returns the UID string or null if no mentions found
 */
function getMentionedUserId(message) {
    const mentions = message?.data?.mentions;
    if (!Array.isArray(mentions) || mentions.length === 0) return null;
    const uid = mentions[0]?.uid;
    return uid ? String(uid) : null;
}

/**
 * Chunk an array into smaller arrays of specified size
 * Used for batch processing API calls with concurrency limits
 */
function chunkArray(values, chunkSize) {
    const chunks = [];
    for (let i = 0; i < values.length; i += chunkSize) {
        chunks.push(values.slice(i, i + chunkSize));
    }
    return chunks;
}

/**
 * Build ID variants for finding users across different formats
 * Handles _0, _1, _2 suffixes that Zalo uses
 */
function buildIdVariants(rawId) {
    const normalized = normalizeId(rawId);
    const variants = new Set([String(rawId || "").trim(), normalized]);
    if (normalized) {
        variants.add(`${normalized}_0`);
        variants.add(`${normalized}_1`);
        variants.add(`${normalized}_2`);
    }
    return [...variants].filter(Boolean);
}

/**
 * Profile helper functions for consistent user data extraction
 */

/**
 * Pick display name from user profile (tries multiple commonly-used fields)
 */
function pickDisplayName(profile, fallbackUserId = null) {
    const candidates = [
        profile?.displayName,
        profile?.dName,
        profile?.zaloName,
        profile?.username,
        profile?.name,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }

    return fallbackUserId ? `UID ${fallbackUserId}` : "";
}

/**
 * Pick avatar URL from user profile (tries multiple avatar field names)
 */
function pickAvatarUrl(profile) {
    const candidates = [profile?.avatar, profile?.avatar_120, profile?.avatar_240, profile?.avatar_25];
    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }
    return "";
}

/**
 * Toggle command handler - for on/off features like hello, camnoibay, etc
 */
async function handleToggleCommand(
    api,
    message,
    threadId,
    GroupSetting,
    argsText,
    prefix,
    config
) {
    const messageType = getMessageType(message);
    const normalizedArgs = String(argsText || "").trim().toLowerCase();
    const { settingKey, messages, statusLabel } = config;

    // No args - show status
    if (!normalizedArgs) {
        const setting = await GroupSetting.findOne({ groupId: threadId }).lean();
        const isEnabled = setting?.[settingKey] !== false;
        const statusText = isEnabled ? "BẬT" : "TẮT";
        const statusMessage = [
            `${statusLabel}: ${statusText}`,
            `Dùng \`${prefix}${settingKey} on\` để bật`,
            `Dùng \`${prefix}${settingKey} off\` để tắt`,
        ].join("\n");
        await sendMessage(api, { msg: statusMessage }, threadId, messageType);
        return;
    }

    // Invalid args
    if (normalizedArgs !== "on" && normalizedArgs !== "off") {
        await sendMessage(
            api,
            { msg: `Sai cú pháp. Dùng \`${prefix}${settingKey} on\` hoặc \`${prefix}${settingKey} off\`.` },
            threadId,
            messageType
        );
        return;
    }

    // Toggle setting
    const shouldEnable = normalizedArgs === "on";
    await GroupSetting.findOneAndUpdate(
        { groupId: threadId },
        { $set: { [settingKey]: shouldEnable } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    const message_text = shouldEnable ? messages.enabled : messages.disabled;
    await sendMessage(api, { msg: message_text }, threadId, messageType);
}

module.exports = {
    // ID & Name normalization
    normalizeId,
    normalizeName,
    parseUidArg,
    extractUidArgs,
    buildIdVariants,
    
    // Array utilities
    chunkArray,
    
    // Message extraction
    getMentionedUserIds,
    getMentionedUserId,
    getMentionedTargets,
    getMessageType,
    getUserNameFromMessage,
    
    // Formatting
    formatUidList,
    formatNameList,
    buildMention,
    
    // Profile helpers
    pickDisplayName,
    pickAvatarUrl,
    
    // API message sending
    sendMessage,
    sendErrorMessage,
    
    // Status builders
    buildToggleStatusMessage,
    buildErrorMessage,
    
    // Command handlers
    handleToggleCommand,
};
