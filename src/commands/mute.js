const {
    getMentionedTargets,
    getMessageType,
    sendMessage,
    formatNameList,
} = require("../utils/commonHelpers");
const {
    PROTECTED_OWNER_BLOCK_MESSAGE,
    isProtectedOwnerUid,
} = require("../config/protectedUsers");

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MAX_MUTE_DURATION_MS = 365 * DAY_MS;

function normalizeUid(rawId) {
    if (rawId === null || rawId === undefined) return "";
    return String(rawId).replace(/_\d+$/, "").trim();
}

function escapeRegExp(input) {
    return String(input || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSpaces(input) {
    return String(input || "")
        .replace(/\s+/g, " ")
        .trim();
}

function stripMentionsFromArgs(argsText, targets) {
    let out = String(argsText || "");

    for (const target of targets || []) {
        const displayName = String(target?.displayName || "").trim();
        if (!displayName) continue;
        const escapedName = escapeRegExp(displayName);
        out = out.replace(new RegExp(`@${escapedName}`, "gi"), " ");
    }

    return normalizeSpaces(out);
}

function parseDurationUnit(unitRaw) {
    const unit = String(unitRaw || "").toLowerCase();
    if (["s", "sec", "secs", "second", "seconds", "giay"].includes(unit)) return SECOND_MS;
    if (["p", "m", "min", "mins", "minute", "minutes", "phut"].includes(unit)) return MINUTE_MS;
    if (["h", "hr", "hrs", "hour", "hours", "gio"].includes(unit)) return HOUR_MS;
    if (["n", "d", "day", "days", "ngay"].includes(unit)) return DAY_MS;
    return 0;
}

function formatDurationLabel(totalMs) {
    let remainingSeconds = Math.max(1, Math.floor(Number(totalMs) / 1000));
    const days = Math.floor(remainingSeconds / 86400);
    remainingSeconds %= 86400;
    const hours = Math.floor(remainingSeconds / 3600);
    remainingSeconds %= 3600;
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days} ng\u00e0y`);
    if (hours > 0) parts.push(`${hours} gi\u1edd`);
    if (minutes > 0) parts.push(`${minutes} ph\u00fat`);
    if (seconds > 0) parts.push(`${seconds} gi\u00e2y`);
    return parts.join(" ");
}

function parseMuteDuration(argsText) {
    const normalized = normalizeSpaces(argsText).toLowerCase();
    if (!normalized) {
        return {
            requiresManualUnmute: true,
            durationMs: null,
            label: "\u0111\u1ebfn khi qu\u1ea3n tr\u1ecb vi\u00ean m\u1edf",
        };
    }

    const compact = normalized.replace(/\s+/g, "");
    if (["v", "vv", "vohan", "manual"].includes(compact)) {
        return {
            requiresManualUnmute: true,
            durationMs: null,
            label: "\u0111\u1ebfn khi qu\u1ea3n tr\u1ecb vi\u00ean m\u1edf",
        };
    }

    const tokenRegex = /(\d+)([a-z]+)/g;
    let match = null;
    let cursor = 0;
    let totalMs = 0;
    let hasToken = false;

    while ((match = tokenRegex.exec(compact)) !== null) {
        hasToken = true;
        if (match.index !== cursor) {
            return { error: "invalid_format" };
        }
        cursor = tokenRegex.lastIndex;

        const amount = Number(match[1]);
        if (!Number.isFinite(amount) || amount <= 0) {
            return { error: "invalid_format" };
        }

        const unitMs = parseDurationUnit(match[2]);
        if (!unitMs) {
            return { error: "invalid_format" };
        }

        totalMs += amount * unitMs;
        if (totalMs > MAX_MUTE_DURATION_MS) {
            return {
                error: "too_long",
                maxLabel: formatDurationLabel(MAX_MUTE_DURATION_MS),
            };
        }
    }

    if (!hasToken || cursor !== compact.length || totalMs <= 0) {
        return { error: "invalid_format" };
    }

    return {
        requiresManualUnmute: false,
        durationMs: totalMs,
        label: formatDurationLabel(totalMs),
    };
}

function extractFallbackArgsFromMessage(message) {
    const content = normalizeSpaces(message?.data?.content || "");
    if (!content) return "";
    const firstSpace = content.indexOf(" ");
    if (firstSpace < 0) return "";
    return content.slice(firstSpace + 1).trim();
}

function buildDurationSyntaxMessage(prefix) {
    return [
        "Sai c\u00fa ph\u00e1p th\u1eddi gian mute.",
        `- ${prefix}mute @T\u00eanNg\u01b0\u1eddiD\u00f9ng 1p`,
        `- ${prefix}mute @T\u00eanNg\u01b0\u1eddiD\u00f9ng 1h30p`,
        `- ${prefix}mute @T\u00eanNg\u01b0\u1eddiD\u00f9ng 1n2h5p10s`,
        "\u0110\u01a1n v\u1ecb h\u1ed7 tr\u1ee3: s = gi\u00e2y, p = ph\u00fat, h = gi\u1edd, n = ng\u00e0y.",
        `Mute \u0111\u1ebfn khi m\u1edf: ${prefix}mute @T\u00eanNg\u01b0\u1eddiD\u00f9ng`,
    ].join("\n");
}

async function handleMuteCommand(
    api,
    message,
    threadId,
    MutedMember,
    prefix = "!",
    argsText = ""
) {
    const messageType = getMessageType(message);
    const targets = getMentionedTargets(message);
    if (targets.length === 0) {
        await sendMessage(
            api,
            {
                msg: [
                    "H\u00e3y tag ng\u01b0\u1eddi c\u1ea7n mute.",
                    `V\u00ed d\u1ee5: ${prefix}mute @T\u00eanNg\u01b0\u1eddiD\u00f9ng`,
                    `Ho\u1eb7c: ${prefix}mute @T\u00eanNg\u01b0\u1eddiD\u00f9ng 1p`,
                ].join("\n"),
            },
            threadId,
            messageType
        );
        return;
    }

    const protectedTargets = targets.filter((target) => isProtectedOwnerUid(target.userId));
    const muteableTargets = targets.filter((target) => !isProtectedOwnerUid(target.userId));

    if (protectedTargets.length > 0 && muteableTargets.length === 0) {
        await sendMessage(api, { msg: PROTECTED_OWNER_BLOCK_MESSAGE }, threadId, messageType);
        return;
    }

    const rawArgs = normalizeSpaces(argsText) || extractFallbackArgsFromMessage(message);
    const durationArgs = stripMentionsFromArgs(rawArgs, targets);
    const durationInfo = parseMuteDuration(durationArgs);

    if (durationInfo.error === "invalid_format") {
        await sendMessage(
            api,
            { msg: buildDurationSyntaxMessage(prefix) },
            threadId,
            messageType
        );
        return;
    }

    if (durationInfo.error === "too_long") {
        await sendMessage(
            api,
            { msg: `Th\u1eddi gian mute t\u1ed1i \u0111a l\u00e0 ${durationInfo.maxLabel}.` },
            threadId,
            messageType
        );
        return;
    }

    const targetIds = [...new Set(muteableTargets.map((target) => normalizeUid(target.userId)).filter(Boolean))];
    if (targetIds.length === 0) {
        await sendMessage(
            api,
            { msg: "Kh\u00f4ng x\u00e1c \u0111\u1ecbnh \u0111\u01b0\u1ee3c UID h\u1ee3p l\u1ec7 \u0111\u1ec3 mute." },
            threadId,
            messageType
        );
        return;
    }
    const mutedByUserId = String(message?.data?.uidFrom || "").trim();
    const mutedByName =
        typeof message?.data?.dName === "string" && message.data.dName.trim()
            ? message.data.dName.trim()
            : "Ng\u01b0\u1eddi d\u00f9ng \u1ea9n danh";
    const muteUntil = durationInfo.requiresManualUnmute
        ? null
        : new Date(Date.now() + durationInfo.durationMs);
    const muteReason = durationInfo.requiresManualUnmute
        ? "Mute th\u1ee7 c\u00f4ng b\u1edfi qu\u1ea3n tr\u1ecb vi\u00ean"
        : `Mute th\u1ee7 c\u00f4ng ${durationInfo.label} b\u1edfi qu\u1ea3n tr\u1ecb vi\u00ean`;

    const operations = targetIds.map((userId) => ({
        updateOne: {
            filter: { groupId: threadId, userId },
            update: {
                $set: {
                    mutedByUserId,
                    mutedByName,
                    mutedAt: new Date(),
                    muteUntil,
                    requiresManualUnmute: durationInfo.requiresManualUnmute,
                    muteSource: "manual",
                    muteReason,
                    blockedMsgCount: 0,
                },
                $setOnInsert: {
                    groupId: threadId,
                    userId,
                },
            },
            upsert: true,
        },
    }));

    await MutedMember.bulkWrite(operations, { ordered: false });

    const lines = [
        durationInfo.requiresManualUnmute
            ? "\u0110\u00e3 b\u1eadt ch\u1ebf \u0111\u1ed9 mute (\u0111\u1ebfn khi qu\u1ea3n tr\u1ecb vi\u00ean m\u1edf) cho:"
            : `\u0110\u00e3 mute ${durationInfo.label} cho:`,
        formatNameList(muteableTargets),
    ];

    if (protectedTargets.length > 0) {
        lines.push(`${formatNameList(protectedTargets)}: ${PROTECTED_OWNER_BLOCK_MESSAGE}`);
    }

    await sendMessage(
        api,
        {
            msg: lines.join("\n"),
        },
        threadId,
        messageType
    );
}

module.exports = {
    handleMuteCommand,
};
