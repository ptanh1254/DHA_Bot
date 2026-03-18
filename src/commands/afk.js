const { getMessageType } = require("../utils/commonHelpers");
const { getVNDateParts } = require("../utils/vnTime");
const { UserDailyMessage } = require("../db/userDailyMessageModel");

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const DEFAULT_WEEKS = 1;
const MAX_WEEKS = 52;
const MESSAGE_THRESHOLD = 100;
const MAX_OUTPUT_USERS = 100;
const DEFAULT_MAX_CHARS_PER_MESSAGE = 1500;
const DEFAULT_MAX_MESSAGE_PARTS = 8;

function getMessageContent(message) {
    return typeof message?.data?.content === "string" ? message.data.content.trim() : "";
}

function parseWeeksArg(message, prefix = "!") {
    const raw = getMessageContent(message);
    const usage = `Dùng: ${prefix}afk [số tuần], ví dụ: ${prefix}afk 2`;

    if (!raw) return { weeks: DEFAULT_WEEKS };

    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return { weeks: DEFAULT_WEEKS };

    const candidate = parts[1];
    if (!/^\d+$/.test(candidate)) {
        return { error: `${usage}\nSố tuần phải là số nguyên từ 1 đến ${MAX_WEEKS}.` };
    }

    const weeks = Number(candidate);
    if (weeks < 1 || weeks > MAX_WEEKS) {
        return { error: `${usage}\nSố tuần phải trong khoảng 1..${MAX_WEEKS}.` };
    }

    return { weeks };
}

function resolveNow(message) {
    const rawTs = Number(message?.data?.ts);
    if (Number.isFinite(rawTs) && rawTs > 0) {
        const ms = rawTs < 1e12 ? rawTs * 1000 : rawTs;
        const date = new Date(ms);
        if (!Number.isNaN(date.getTime())) return date;
    }
    return new Date();
}

function toSafeDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function formatDuration(diffMs) {
    const safe = Math.max(0, Number(diffMs) || 0);
    const totalMinutes = Math.floor(safe / (60 * 1000));
    const totalHours = Math.floor(safe / (60 * 60 * 1000));
    const totalDays = Math.floor(safe / DAY_MS);

    if (totalDays >= 1) {
        const hours = totalHours % 24;
        return `${totalDays}d ${hours}h`;
    }
    if (totalHours >= 1) {
        const minutes = totalMinutes % 60;
        return `${totalHours}h ${minutes}m`;
    }
    return `${Math.max(totalMinutes, 1)}m`;
}

function getDisplayName(row) {
    const name = String(row?.displayName || "")
        .replace(/^@+/, "")
        .replace(/\s+/g, " ")
        .trim();
    if (name) return name;

    const userId = normalizeUserId(row?.userId) || String(row?.userId || "").trim();
    return userId ? `UID ${userId}` : "UID chưa rõ";
}

function normalizeUserId(rawId) {
    const value = String(rawId || "").trim();
    if (!value) return "";
    return value.replace(/_\d+$/, "").trim();
}

function buildIdVariants(rawId) {
    const trimmed = String(rawId || "").trim();
    const normalized = normalizeUserId(trimmed);
    const variants = new Set([trimmed, normalized]);
    if (normalized) {
        for (let i = 0; i <= 9; i++) {
            variants.add(`${normalized}_${i}`);
        }
    }
    return [...variants].filter(Boolean);
}

function formatPeriod(startDate, endDate) {
    const startLabel = getVNDateParts(startDate).dayLabel;
    const endLabel = getVNDateParts(endDate).dayLabel;
    return { startLabel, endLabel };
}

async function fetchGroupInfoSafe(api, threadId) {
    const attempts = [threadId, [threadId]];
    for (const arg of attempts) {
        try {
            const response = await api.getGroupInfo(arg);
            const map = response?.gridInfoMap || {};
            const groupInfo = map[threadId] || Object.values(map)[0] || null;
            if (groupInfo) return groupInfo;
        } catch (_) {}
    }
    return null;
}

function collectCurrentMemberIds(groupInfo) {
    const ids = new Set();
    if (!groupInfo || typeof groupInfo !== "object") return ids;

    const listFields = [groupInfo.memberIds, groupInfo.memVerList];
    for (const list of listFields) {
        if (!Array.isArray(list)) continue;
        for (const rawId of list) {
            const normalized = normalizeUserId(rawId);
            if (normalized) ids.add(normalized);
        }
    }

    const objectLists = [groupInfo.currentMems, groupInfo.members];
    for (const list of objectLists) {
        if (!Array.isArray(list)) continue;
        for (const item of list) {
            const normalized = normalizeUserId(
                item?.userId || item?.uid || item?.id || item?.memberId
            );
            if (normalized) ids.add(normalized);
        }
    }

    return ids;
}

function toPositiveInt(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const normalized = Math.floor(parsed);
    return normalized > 0 ? normalized : fallback;
}

function splitTextByLimit(text, limit) {
    const source = String(text || "").trim();
    if (!source) return [];
    if (source.length <= limit) return [source];

    const chunks = [];
    let remaining = source;

    while (remaining.length > limit) {
        let cutAt = remaining.lastIndexOf("\n", limit);
        if (cutAt < Math.floor(limit * 0.5)) {
            cutAt = remaining.lastIndexOf(" ", limit);
        }
        if (cutAt < Math.floor(limit * 0.5)) {
            cutAt = limit;
        }

        const head = remaining.slice(0, cutAt).trim();
        if (head) chunks.push(head);
        remaining = remaining.slice(cutAt).trim();
    }

    if (remaining) chunks.push(remaining);
    return chunks;
}

async function sendAFKResult(api, threadId, messageType, fullText) {
    const maxCharsPerMessage = toPositiveInt(
        process.env.AFK_MAX_CHARS_PER_MESSAGE,
        DEFAULT_MAX_CHARS_PER_MESSAGE
    );
    const maxMessageParts = toPositiveInt(
        process.env.AFK_MAX_MESSAGE_PARTS,
        DEFAULT_MAX_MESSAGE_PARTS
    );

    const chunks = splitTextByLimit(fullText, maxCharsPerMessage);
    const toSend = chunks.slice(0, maxMessageParts);

    for (let i = 0; i < toSend.length; i++) {
        const part = toSend[i];
        const msg = toSend.length > 1 ? `[${i + 1}/${toSend.length}] ${part}` : part;
        await api.sendMessage({ msg }, threadId, messageType);
    }

    if (chunks.length > maxMessageParts) {
        await api.sendMessage(
            {
                msg: `Danh sách còn dài, mình đã gửi ${maxMessageParts} phần đầu.`,
            },
            threadId,
            messageType
        );
    }
}

async function fetchRangeMessageCounts(threadId, startDayKey, endDayKey) {
    try {
        const rows = await UserDailyMessage.aggregate([
            {
                $match: {
                    groupId: threadId,
                    dayKey: { $gte: startDayKey, $lte: endDayKey },
                },
            },
            {
                $group: {
                    _id: "$userId",
                    msgCount: { $sum: "$msgCount" },
                },
            },
        ]);

        const countByRawId = new Map();
        const countByBaseId = new Map();
        for (const row of rows || []) {
            const rawId = String(row?._id || "").trim();
            const count = Number(row?.msgCount) || 0;
            if (!rawId) continue;

            const currentRaw = Number(countByRawId.get(rawId)) || 0;
            countByRawId.set(rawId, currentRaw + count);

            const baseId = normalizeUserId(rawId);
            if (baseId) {
                const currentBase = Number(countByBaseId.get(baseId)) || 0;
                countByBaseId.set(baseId, currentBase + count);
            }

            for (const id of buildIdVariants(rawId)) {
                const current = Number(countByRawId.get(id)) || 0;
                if (count > current) {
                    countByRawId.set(id, count);
                }
            }
        }

        return {
            hasStats: (rows || []).length > 0,
            countByRawId,
            countByBaseId,
        };
    } catch (error) {
        console.error("[afk] Lỗi lấy thống kê theo ngày:", error?.message || error);
        return {
            hasStats: false,
            countByRawId: new Map(),
            countByBaseId: new Map(),
        };
    }
}

function buildResultRows(users, senderBaseId, countByRawId, countByBaseId, now, toDayKey) {
    const rows = [];
    for (const user of users) {
        const rawId = String(user?.userId || "").trim();
        if (!rawId) continue;

        const baseId = normalizeUserId(rawId) || rawId;
        if (senderBaseId && senderBaseId === baseId) continue;

        const fallbackTodayCount =
            String(user?.dayKey || "").trim() === String(toDayKey || "").trim()
                ? Number(user?.dailyMsgCount) || 0
                : 0;
        const count =
            Number(countByBaseId.get(baseId)) ||
            Number(countByRawId.get(rawId)) ||
            Number(countByRawId.get(baseId)) ||
            fallbackTodayCount ||
            0;

        if (count >= MESSAGE_THRESHOLD) continue;

        const lastMessageAt = toSafeDate(user?.lastMessageAt);
        const diffMs = lastMessageAt ? Math.max(0, now.getTime() - lastMessageAt.getTime()) : null;

        rows.push({
            userId: baseId,
            displayName: getDisplayName(user),
            msgCount: count,
            diffMs,
        });
    }

    rows.sort((a, b) => {
        if (a.msgCount !== b.msgCount) return a.msgCount - b.msgCount;
        if (a.diffMs === null && b.diffMs !== null) return -1;
        if (a.diffMs !== null && b.diffMs === null) return 1;
        if (a.diffMs !== null && b.diffMs !== null && a.diffMs !== b.diffMs) {
            return b.diffMs - a.diffMs;
        }
        return a.displayName.localeCompare(b.displayName);
    });

    return rows;
}

async function handleAFKCommand(api, message, threadId, User, prefix = "!") {
    const messageType = getMessageType(message);
    const parsed = parseWeeksArg(message, prefix);
    if (parsed.error) {
        await api.sendMessage({ msg: parsed.error }, threadId, messageType);
        return;
    }

    const weeks = parsed.weeks;
    const now = resolveNow(message);
    const fromDate = new Date(now.getTime() - weeks * WEEK_MS);
    const { dayKey: fromDayKey } = getVNDateParts(fromDate);
    const { dayKey: toDayKey } = getVNDateParts(now);
    const { startLabel, endLabel } = formatPeriod(fromDate, now);

    const senderBaseId = normalizeUserId(message?.data?.uidFrom);

    const users = await User.find({ groupId: threadId })
        .select("userId displayName lastMessageAt dayKey dailyMsgCount")
        .lean();

    if (!users || users.length === 0) {
        await api.sendMessage(
            { msg: "Chưa có dữ liệu người dùng trong nhóm này." },
            threadId,
            messageType
        );
        return;
    }

    const groupInfo = await fetchGroupInfoSafe(api, threadId);
    const currentMemberIds = collectCurrentMemberIds(groupInfo);
    if (currentMemberIds.size === 0) {
        await api.sendMessage(
            {
                msg: "Chưa lấy được danh sách thành viên hiện tại của nhóm. Bạn thử lại sau ít phút nhé.",
            },
            threadId,
            messageType
        );
        return;
    }

    const activeUsers = users.filter((user) =>
        currentMemberIds.has(normalizeUserId(user?.userId))
    );
    const removedOutUsers = Math.max(0, users.length - activeUsers.length);

    if (activeUsers.length === 0) {
        await api.sendMessage(
            {
                msg: "Hiện chưa có dữ liệu thành viên còn trong nhóm để thống kê AFK.",
            },
            threadId,
            messageType
        );
        return;
    }

    const { hasStats, countByRawId, countByBaseId } = await fetchRangeMessageCounts(
        threadId,
        fromDayKey,
        toDayKey
    );
    const rows = buildResultRows(
        activeUsers,
        senderBaseId,
        countByRawId,
        countByBaseId,
        now,
        toDayKey
    );
    const limitedRows = rows.slice(0, MAX_OUTPUT_USERS);

    if (rows.length === 0) {
        await api.sendMessage(
            {
                msg: [
                    `Không có ai dưới ${MESSAGE_THRESHOLD} tin trong khoảng ${startLabel} đến ${endLabel}.`,
                    hasStats
                        ? ""
                        : "Lưu ý: Chưa có dữ liệu thống kê theo ngày cho khoảng này.",
                ]
                    .filter(Boolean)
                    .join("\n"),
            },
            threadId,
            messageType
        );
        return;
    }

    const lines = [];
    lines.push(`AFK TUẦN (TIN < ${MESSAGE_THRESHOLD})`);
    lines.push(`Khoảng tính: ${startLabel} -> ${endLabel} (${weeks} tuần)`);
    lines.push(`Tổng người dưới ngưỡng: ${rows.length}`);
    if (removedOutUsers > 0) {
        lines.push(`Đã bỏ qua ${removedOutUsers} người đã rời nhóm.`);
    }
    if (!hasStats) {
        lines.push("Lưu ý: Dữ liệu theo ngày mới được bật, thống kê cũ có thể chưa đầy đủ.");
    }
    lines.push("");

    for (let i = 0; i < limitedRows.length; i++) {
        const row = limitedRows[i];
        const activity = row.diffMs === null ? "chưa từng nhắn tin" : `${formatDuration(row.diffMs)} trước`;
        lines.push(`${i + 1}. ${row.displayName} - ${row.msgCount} tin (${activity})`);
    }

    if (rows.length > MAX_OUTPUT_USERS) {
        lines.push("");
        lines.push(`... còn ${rows.length - MAX_OUTPUT_USERS} người khác dưới ${MESSAGE_THRESHOLD} tin.`);
    }

    await sendAFKResult(api, threadId, messageType, lines.join("\n"));
}

module.exports = {
    handleAFKCommand,
};
