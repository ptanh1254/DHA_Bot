const { getMessageType, sendMessage } = require("../utils/commonHelpers");

// UID được phép dùng lệnh !imlang
const ALLOWED_UIDS = [
    "9030208052692663539"
];

// ---- Hàm tính thời gian (copy từ mute.js) ----
const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MAX_MUTE_DURATION_MS = 365 * DAY_MS;

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
    if (days > 0) parts.push(`${days} ngày`);
    if (hours > 0) parts.push(`${hours} giờ`);
    if (minutes > 0) parts.push(`${minutes} phút`);
    if (seconds > 0) parts.push(`${seconds} giây`);
    return parts.join(" ");
}

function parseDuration(argsText) {
    const normalized = String(argsText || "").replace(/\s+/g, "").toLowerCase();

    // Không nhập gì → khoá vô thời hạn (cần QTV mở)
    if (!normalized) {
        return {
            requiresManualUnmute: true,
            durationMs: null,
            label: "đến khi quản trị viên mở",
        };
    }

    const tokenRegex = /(\d+)([a-z]+)/g;
    let match = null;
    let cursor = 0;
    let totalMs = 0;
    let hasToken = false;

    while ((match = tokenRegex.exec(normalized)) !== null) {
        hasToken = true;
        if (match.index !== cursor) return { error: "invalid_format" };
        cursor = tokenRegex.lastIndex;

        const amount = Number(match[1]);
        if (!Number.isFinite(amount) || amount <= 0) return { error: "invalid_format" };

        const unitMs = parseDurationUnit(match[2]);
        if (!unitMs) return { error: "invalid_format" };

        totalMs += amount * unitMs;
        if (totalMs > MAX_MUTE_DURATION_MS) {
            return { error: "too_long", maxLabel: formatDurationLabel(MAX_MUTE_DURATION_MS) };
        }
    }

    if (!hasToken || cursor !== normalized.length || totalMs <= 0) {
        return { error: "invalid_format" };
    }

    return {
        requiresManualUnmute: false,
        durationMs: totalMs,
        label: formatDurationLabel(totalMs),
    };
}
// -------------------------------------------------

async function handleImlangCommand(
    api,
    message,
    threadId,
    MutedMember,
    prefix = "!",
    argsText = ""
) {
    const messageType = getMessageType(message);
    const rawUserId = String(message?.data?.uidFrom || "").trim();
    // Normalize: bỏ suffix _timestamp giống như mute.js
    const userId = rawUserId.replace(/_\d+$/, "").trim();
    const userName =
        typeof message?.data?.dName === "string" && message.data.dName.trim()
            ? message.data.dName.trim()
            : "Người dùng";

    // Kiểm tra quyền
    if (!ALLOWED_UIDS.includes(userId)) {
        await sendMessage(
            api,
            { msg: "Bạn không nằm trong danh sách được phép sử dụng lệnh này." },
            threadId,
            messageType
        );
        return;
    }

    // Lấy phần thời gian từ args (bỏ tên lệnh nếu còn sót)
    const rawArgs = String(argsText || "").trim() ||
        (() => {
            const content = String(message?.data?.content || "").replace(/\s+/g, " ").trim();
            const firstSpace = content.indexOf(" ");
            return firstSpace < 0 ? "" : content.slice(firstSpace + 1).trim();
        })();

    const durationInfo = parseDuration(rawArgs);

    if (durationInfo.error === "invalid_format") {
        await sendMessage(
            api,
            {
                msg: [
                    "Sai cú pháp thời gian.",
                    `- ${prefix}imlang           → khoá vô thời hạn (cần QTV mở)`,
                    `- ${prefix}imlang 30p       → tự khoá 30 phút`,
                    `- ${prefix}imlang 1h30p     → tự khoá 1 giờ 30 phút`,
                    `- ${prefix}imlang 1n        → tự khoá 1 ngày`,
                    "Đơn vị: s = giây, p = phút, h = giờ, n = ngày",
                ].join("\n"),
            },
            threadId,
            messageType
        );
        return;
    }

    if (durationInfo.error === "too_long") {
        await sendMessage(
            api,
            { msg: `Thời gian tối đa là ${durationInfo.maxLabel}.` },
            threadId,
            messageType
        );
        return;
    }

    const muteUntil = durationInfo.requiresManualUnmute
        ? null
        : new Date(Date.now() + durationInfo.durationMs);

    const muteReason = durationInfo.requiresManualUnmute
        ? "Tự khoá mõm vô thời hạn (lệnh !imlang)"
        : `Tự khoá mõm ${durationInfo.label} (lệnh !imlang)`;

    const updateOp = {
        updateOne: {
            filter: { groupId: threadId, userId },
            update: {
                $set: {
                    mutedByUserId: userId,
                    mutedByName: userName,
                    mutedAt: new Date(),
                    muteUntil,
                    requiresManualUnmute: durationInfo.requiresManualUnmute,
                    muteSource: "imlang",
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
    };

    await MutedMember.bulkWrite([updateOp], { ordered: false });

    // Thông báo kết quả
    const durationText = durationInfo.requiresManualUnmute
        ? "đến khi quản trị viên mở"
        : durationInfo.label;

    await sendMessage(
        api,
        { msg: `${userName} đã tự khoá mõm mình (${durationText})` },
        threadId,
        messageType
    );
}

module.exports = {
    handleImlangCommand,
    ALLOWED_UIDS,
};
