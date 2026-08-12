const { getVNDateParts, getVNWeekInfo } = require("../utils/vnTime");
const { findMatchedBannedWord } = require("../config/bannedWords");
const { UserDailyMessage } = require("../db/userDailyMessageModel");
const { UserWeeklyMessage } = require("../db/userWeeklyMessageModel");
const { AskUsage } = require("../db/askUsageModel");
const { BannedWordStrike } = require("../db/bannedWordStrikeModel");
const { getBotResponse } = require("../runtime/botResponseManager");
const { getAfkData, removeAfkData, addAfkMention, formatDuration } = require("../commands/afk");

async function tryDeleteMutedMessage(api, message, threadId, userId) {
    const msgId = String(message?.data?.msgId || "").trim();
    const cliMsgId = String(message?.data?.cliMsgId || msgId || Date.now()).trim();
    if (!msgId) return false;

    try {
        await api.deleteMessage(
            {
                threadId,
                type: 1,
                data: {
                    cliMsgId,
                    msgId,
                    uidFrom: String(userId),
                },
            },
            false
        );
        return true;
    } catch (error) {
        console.error("Không thể xóa tin nhắn của người bị mute:", error);
        return false;
    }
}

function shouldSendMuteNotice(strikeCount) {
    const value = Number(strikeCount) || 0;
    if (value <= 0) return false;
    if (value === 1 || value === 5 || value === 10) return true;
    return value > 10 && value % 10 === 0;
}

const MUTE_SPAM_KICK_THRESHOLD = 20;

async function tryKickMutedSpammer(api, threadId, userId) {
    const normalizedUserId = normalizeId(userId);
    if (!normalizedUserId) {
        return { attempted: false, success: false };
    }

    try {
        const result = await api.removeUserFromGroup([normalizedUserId], threadId);
        const failedIds = Array.isArray(result?.errorMembers)
            ? result.errorMembers.map((id) => normalizeId(id))
            : [];
        const failedSet = new Set(failedIds);
        return {
            attempted: true,
            success: !failedSet.has(normalizedUserId),
            userId: normalizedUserId,
        };
    } catch (error) {
        console.error("[mute-spam] L\u1ed7i kick user \u0111ang b\u1ecb mute:", error);
        return {
            attempted: true,
            success: false,
            userId: normalizedUserId,
        };
    }
}

function resolveBannedWordMutePolicy(strikeCount) {
    const count = Math.max(1, Number(strikeCount) || 1);
    if (count === 1) {
        return {
            durationMs: 1 * 60 * 1000,
            requiresManualUnmute: false,
            label: "1 ph\u00fat",
        };
    }

    if (count === 2) {
        return {
            durationMs: 5 * 60 * 1000,
            requiresManualUnmute: false,
            label: "5 ph\u00fat",
        };
    }

    return {
        durationMs: null,
        requiresManualUnmute: true,
        label: "\u0111\u1ebfn khi QTV m\u1edf",
    };
}

function formatMuteRemainingLabel(muteEntry) {
    if (!muteEntry || typeof muteEntry !== "object") return "";
    if (muteEntry.requiresManualUnmute === true) {
        return "\u0111\u1ebfn khi QTV m\u1edf";
    }

    const muteUntilMs = muteEntry?.muteUntil ? new Date(muteEntry.muteUntil).getTime() : NaN;
    if (!Number.isFinite(muteUntilMs)) return "";

    const remainingMs = Math.max(0, muteUntilMs - Date.now());
    if (remainingMs <= 0) return "s\u1eafp h\u1ebft";

    const minutes = Math.ceil(remainingMs / (60 * 1000));
    if (minutes <= 1) return "kho\u1ea3ng 1 ph\u00fat";
    return `kho\u1ea3ng ${minutes} ph\u00fat`;
}

async function getActiveMutedEntry(MutedMember, threadId, userId) {
    if (!MutedMember) return null;

    const userIdVariants = buildIdVariants(userId);
    if (userIdVariants.length === 0) return null;

    const entry = await MutedMember.findOne({
        groupId: threadId,
        userId: { $in: userIdVariants },
    })
        .sort({ mutedAt: -1 })
        .lean();
    if (!entry) return null;

    if (entry.requiresManualUnmute === true) {
        return entry;
    }

    const muteUntilMs = entry?.muteUntil ? new Date(entry.muteUntil).getTime() : NaN;
    if (Number.isFinite(muteUntilMs) && muteUntilMs <= Date.now()) {
        try {
            await MutedMember.deleteMany({
                groupId: threadId,
                userId: { $in: userIdVariants },
            });
        } catch (_) { }
        return null;
    }

    if (!Number.isFinite(muteUntilMs) && entry?.muteSource !== "banned_word") {
        return entry;
    }

    return entry;
}

async function sendMuteNotice(api, message, threadId, userId, strikeCount, muteEntry = null) {
    const rawName =
        typeof message?.data?.dName === "string" ? message.data.dName.trim() : "";
    const safeName = rawName || "Ng\u01b0\u1eddi d\u00f9ng";
    const mentionText = `@${safeName}`;
    const remainingLabel = formatMuteRemainingLabel(muteEntry);
    const msg = `🤫 Xuỵt! ${mentionText} đang bị khóa mõm 🤐${remainingLabel ? ` Ráng nhịn thêm ${remainingLabel} nữa nhé!` : ""}\n(Cố tình chat nhảm đã bị nghiệp quật xóa tin nhắn lần thứ ${strikeCount})`;
    const messageType = Number(message?.type) || 1;

    try {
        await api.sendMessage(
            {
                msg,
                mentions: [
                    {
                        pos: 0,
                        uid: String(userId),
                        len: mentionText.length,
                    },
                ],
            },
            threadId,
            messageType
        );
    } catch (error) {
        console.error("L\u1ed7i g\u1eedi c\u1ea3nh b\u00e1o mute:", error);
    }
}

async function sendAutoMuteNotice(
    api,
    message,
    threadId,
    userId,
    matchedWord,
    strikeCount,
    mutePolicy
) {
    const rawName = typeof message?.data?.dName === "string" ? message.data.dName.trim() : "";
    const safeName = rawName || "Người dùng";
    const mentionText = `@${safeName}`;
    
    const muteLabel = mutePolicy?.requiresManualUnmute
        ? "Hình phạt: Khóa mõm vĩnh viễn đến khi Admin DHA nhân từ mở lại. 💀"
        : `Hình phạt: Khóa mõm ${mutePolicy?.label || ""}. ⏳`;
    
    const msg = `🚨 Cảnh sát DHA xin thông báo! 🚨\n${mentionText} vừa dính phải ngôn từ cấm...\n${muteLabel}`;
    
    const messageType = Number(message?.type) || 1;

    try {
        await api.sendMessage(
            {
                msg,
                mentions: [
                    {
                        pos: 0,
                        uid: String(userId),
                        len: mentionText.length,
                    },
                ],
            },
            threadId,
            messageType
        );
    } catch (error) {
        console.error("L\u1ed7i g\u1eedi th\u00f4ng b\u00e1o auto mute:", error);
    }
}

async function updateUserMessageCounters(User, threadId, userId, senderName) {
    const now = new Date();
    const { dayKey, monthKey } = getVNDateParts(now);
    const { weekKey, weekStartDayKey, weekEndDayKey } = getVNWeekInfo(now);

    let current = await User.findOne({ groupId: threadId, userId }).lean();
    
    // AUTO-MIGRATION LOGIC: Tìm dữ liệu cũ dựa vào Tên hiển thị (để gộp nếu chưa gộp)
    if (senderName) {
        // Tìm tất cả các record cũ có cùng Tên hiển thị (ưu tiên record có dữ liệu gần nhất)
        const oldRecords = await User.find({ displayName: senderName }).sort({ lastMessageAt: -1 }).lean();
        const oldRecord = oldRecords.find(r => r.userId !== userId && (r.msgCount > 0 || r.totalMsgCount > 0));
        
        if (oldRecord) {
            console.log(`[Auto-Migration] Đã tìm thấy dữ liệu cũ của ${senderName} (Cũ: ${oldRecord.userId}, Mới: ${userId}). Đang gộp...`);
            // Gộp dữ liệu
            current = {
                ...current,
                groupId: threadId,
                userId: userId,
                displayName: senderName,
                avatarUrl: current?.avatarUrl || oldRecord.avatarUrl || "",
                msgCount: (current?.msgCount || 0) + (oldRecord.msgCount || 0),
                totalMsgCount: (current?.totalMsgCount || 0) + (oldRecord.totalMsgCount || 0),
                dailyMsgCount: (current?.dailyMsgCount || 0),
                monthlyMsgCount: (current?.monthlyMsgCount || 0),
                joinDate: oldRecord.joinDate || current?.joinDate || now,
                lastMessageAt: now,
                ingameName: oldRecord.ingameName || current?.ingameName || "",
                ingameSetAt: oldRecord.ingameSetAt || current?.ingameSetAt || null,
                addedByUserId: oldRecord.addedByUserId || current?.addedByUserId || "",
                addedByName: oldRecord.addedByName || current?.addedByName || ""
            };
            await User.updateOne({ groupId: threadId, userId }, { $set: current }, { upsert: true });
            
            // Xoá record cũ để tránh trùng lặp gộp nhiều lần
            await User.deleteOne({ _id: oldRecord._id });
            
            // Migrate các collection phụ
            const { KickHistory } = require("../db/kickHistoryModel");
            const { MutedMember } = require("../db/mutedMemberModel");
            const { BannedWordStrike } = require("../db/bannedWordStrikeModel");
            const { CommandViolation } = require("../db/commandViolationModel");
            
            try {
                await KickHistory.updateMany({ userId: oldRecord.userId }, { $set: { userId: userId, groupId: threadId } });
                await KickHistory.updateMany({ kickedBy: oldRecord.userId }, { $set: { kickedBy: userId } });
                await MutedMember.updateMany({ userId: oldRecord.userId }, { $set: { userId: userId, groupId: threadId } });
                await MutedMember.updateMany({ mutedBy: oldRecord.userId }, { $set: { mutedBy: userId } });
                await BannedWordStrike.updateMany({ userId: oldRecord.userId }, { $set: { userId: userId, groupId: threadId } });
                await CommandViolation.updateMany({ userId: oldRecord.userId }, { $set: { userId: userId, groupId: threadId } });
            } catch(e) {
                console.error("[Auto-Migration] Lỗi gộp collection phụ:", e);
            }
        }
    }

    const currentDaily =
        current?.dayKey === dayKey ? Number(current?.dailyMsgCount) || 0 : 0;
    const currentMonthly =
        current?.monthKey === monthKey ? Number(current?.monthlyMsgCount) || 0 : 0;

    const updateDoc = {
        $setOnInsert: {
            groupId: threadId,
            userId,
            joinDate: now,
        },
        $inc: {
            msgCount: 1,
            totalMsgCount: 1,
        },
        $set: {
            dayKey,
            monthKey,
            dailyMsgCount: currentDaily + 1,
            monthlyMsgCount: currentMonthly + 1,
            lastMessageAt: now,
        },
    };

    if (senderName) {
        updateDoc.$set.displayName = senderName;
    }

    await User.findOneAndUpdate({ groupId: threadId, userId }, updateDoc, {
        upsert: true,
    });

    const normalizedUserId = normalizeId(userId) || String(userId || "").trim();
    if (!normalizedUserId) return;

    try {
        await UserDailyMessage.findOneAndUpdate(
            { groupId: threadId, userId: normalizedUserId, dayKey },
            {
                $inc: { msgCount: 1 },
                $set: { lastMessageAt: now },
                $setOnInsert: {
                    groupId: threadId,
                    userId: normalizedUserId,
                    dayKey,
                },
            },
            {
                upsert: true,
                returnDocument: "after",
                setDefaultsOnInsert: true,
            }
        ).lean();
    } catch (error) {
        console.error("[daily-stats] Loi cap nhat thong ke theo ngay:", error?.message || error);
    }

    try {
        await UserWeeklyMessage.findOneAndUpdate(
            { groupId: threadId, userId: normalizedUserId, weekKey },
            {
                $inc: { msgCount: 1 },
                $set: {
                    lastMessageAt: now,
                    weekStartDayKey,
                    weekEndDayKey,
                },
                $setOnInsert: {
                    groupId: threadId,
                    userId: normalizedUserId,
                    weekKey,
                },
            },
            {
                upsert: true,
                returnDocument: "after",
                setDefaultsOnInsert: true,
            }
        ).lean();
    } catch (error) {
        console.error("[weekly-stats] Loi cap nhat thong ke theo tuan:", error?.message || error);
    }
}

function normalizeId(rawId) {
    if (rawId === null || rawId === undefined) return "";
    return String(rawId).replace(/_\d+$/, "").trim();
}

function buildIdVariants(rawId) {
    const raw = String(rawId || "").trim();
    const normalized = normalizeId(rawId);
    const set = new Set();

    if (raw) set.add(raw);
    if (normalized) {
        set.add(normalized);
        set.add(`${normalized}_0`);
        set.add(`${normalized}_1`);
        set.add(`${normalized}_2`);
    }

    return [...set].filter(Boolean);
}

function buildSuperAdminSet() {
    const defaults = [
        "7678683608712964658" 

    ];
    const fromEnv = String(process.env.SUPER_ADMIN_UIDS || "7678683608712964658")
        .split(",")
        .map((value) => normalizeId(value))
        .filter(Boolean);
    return new Set([...defaults.map((value) => normalizeId(value)), ...fromEnv]);
}

function buildKickBlockedUidSet() {
    const blockedUids = [];
    return new Set(blockedUids.map((value) => normalizeId(value)).filter(Boolean));
}

function resolveIdFromUnknown(raw) {
    if (raw === null || raw === undefined) return "";
    if (typeof raw === "string" || typeof raw === "number") {
        return normalizeId(raw);
    }
    if (typeof raw !== "object") return "";
    return normalizeId(raw.userId || raw.uid || raw.id || raw.memberId || raw.user_id);
}

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

function collectNormalizedIds(value) {
    if (!value) return [];
    if (!Array.isArray(value)) {
        const one = resolveIdFromUnknown(value);
        return one ? [one] : [];
    }

    const out = [];
    for (const item of value) {
        const id = resolveIdFromUnknown(item);
        if (id) out.push(id);
    }
    return out;
}

function isRoleAdminFlag(member) {
    if (!member || typeof member !== "object") return false;

    // Check explicit admin flags
    const explicitFlags = [
        member.isAdmin,
        member.isMgr,
        member.isManager,
        member.isModerator,
    ];
    if (explicitFlags.some((flag) => flag === true)) return true;

    // Check role field: 1=owner, 2=vice-owner, 3=admin/moderator
    const role = Number(member.role);
    if (!Number.isNaN(role) && role >= 1 && role <= 3) return true;

    // Also check type field (as per ZCA docs): 1=owner, 2=vice-owner, 3=admin/moderator
    const type = Number(member.type);
    if (!Number.isNaN(type) && type >= 1 && type <= 3) return true;

    // Also check roleID field variety
    const roleId = Number(member.roleId);
    if (!Number.isNaN(roleId) && roleId >= 1 && roleId <= 3) return true;

    return false;
}

function createMessageHandler({
    api,
    User,
    MutedMember,
    GroupSetting,
    GroupKeyMember,
    CommandViolation,
    commands,
    botUserId = "",
    messageStore = null,
}) {
    const {
        helpCommand,
        helloCommand,
        preventRecallCommand,
        noteCommand,
        xoaNoteCommand,
        thongTinCommand,
        checkTTCommand,
        checkCommand,
        checkIngameCommand,
        ingameCommand,
        removeIngameCommand,
        kickCommand,
        kickAliasCommand,
        muteCommand,
        unmuteCommand,
        camNoiBayCommand,
        autoKickCommand,
        autoKickListCommand,
        autoKickRemoveCommand,
        goAutoKickCommand,
        addBQTCommand,
        removeQTVCommand,
        removeQTVAliasCommand,
        xepHangDayCommand,
        xepHangWeekCommand,
        xepHangMonthCommand,
        xepHangTotalCommand,
        resetChatCommand,
        afkCommand,
        loveCommand,
        askCommand,
        timCommand,
                    nghiepCommand,
        thiepCuoiCommand,
        randomCommand,
        findCommand,
        aliasCommand,
        imlangCommand,
        xoaQrCommand,
    } = commands;

    const {
        handleHelp,
        handleHello,
        handlePreventRecall,
        handleNote,
        handleXoaNote,
        handleThongTin,
        handleCheckTT,
        handleCheck,
        handleCheckIngame,
        handleIngame,
        handleRemoveIngame,
        handleKick,
        handleMute,
        handleUnmute,
        handleImlang,
        handleCamNoiBay,
        handleAutoKick,
        handleAutoKickList,
        handleAutoKickRemove,
        handleAddBQT,
        handleRemoveQTV,
        handleXepHangDay,
        handleXepHangWeek,
        handleXepHangMonth,
        handleXepHangTotal,
        handleResetChat,
        handleAFK,
        handleLove,
        handleAsk,
        handleTim,
        handleNghiep,
        handleThiepCuoi,
        handleRandom,
        handleFind,
        handleAlias,
        handleXoaQr,
    } = commands;

    const normalizedBotUserId = normalizeId(botUserId);
    const adminCache = new Map();
    const ADMIN_CACHE_TTL_MS = 30 * 1000;
    const ADMIN_CACHE_MAX_ENTRIES = 1000;
    const ASK_DAILY_LIMIT = 5;
    const superAdmins = buildSuperAdminSet();
    const kickBlockedUids = buildKickBlockedUidSet();

    function pruneAdminCache(force = false) {
        const now = Date.now();
        for (const [key, value] of adminCache.entries()) {
            if (!value || value.expiresAt <= now) {
                adminCache.delete(key);
            }
        }

        if (force || adminCache.size > ADMIN_CACHE_MAX_ENTRIES) {
            while (adminCache.size > ADMIN_CACHE_MAX_ENTRIES) {
                const oldestKey = adminCache.keys().next().value;
                if (!oldestKey) break;
                adminCache.delete(oldestKey);
            }
        }
    }

    function isSuperAdmin(userId) {
        const normalized = normalizeId(userId);
        return normalized ? superAdmins.has(normalized) : false;
    }

    async function isAskUnlimitedUser(threadId, userId, isSuperAdminUser = false) {
        if (isSuperAdminUser) return true;

        const isAdmin = await isGroupAdmin(threadId, userId);
        if (isAdmin) return true;

        if (!GroupKeyMember) return false;
        const normalizedUserId = normalizeId(userId);
        if (!normalizedUserId) return false;

        try {
            const qtvRecord = await GroupKeyMember.findOne({
                groupId: threadId,
                userId: normalizedUserId,
            }).lean();
            return !!qtvRecord;
        } catch (error) {
            console.error(
                `[ask-quota] Lỗi kiểm tra quyền BQT cho ${normalizedUserId} ở ${threadId}:`,
                error?.message || error
            );
            return false;
        }
    }

    async function consumeAskQuota(threadId, userId, isSuperAdminUser = false) {
        const normalizedUserId = normalizeId(userId);
        if (!normalizedUserId) {
            return {
                allowed: false,
                isUnlimited: false,
                remaining: 0,
                limit: ASK_DAILY_LIMIT,
            };
        }

        const isUnlimited = await isAskUnlimitedUser(threadId, userId, isSuperAdminUser);
        if (isUnlimited) {
            return {
                allowed: true,
                isUnlimited: true,
                remaining: null,
                limit: ASK_DAILY_LIMIT,
            };
        }

        const now = new Date();
        const { dayKey } = getVNDateParts(now);

        let currentCount = 0;
        try {
            const current = await AskUsage.findOne({
                groupId: threadId,
                userId: normalizedUserId,
                dayKey,
            }).lean();
            currentCount = Number(current?.usageCount) || 0;
        } catch (error) {
            console.error(
                `[ask-quota] Lỗi đọc quota ask cho ${normalizedUserId} ở ${threadId}:`,
                error?.message || error
            );
            // Fail-open để không chặn chức năng nếu DB bị lỗi tạm thời.
            return {
                allowed: true,
                isUnlimited: false,
                remaining: null,
                limit: ASK_DAILY_LIMIT,
            };
        }

        if (currentCount >= ASK_DAILY_LIMIT) {
            return {
                allowed: false,
                isUnlimited: false,
                remaining: 0,
                limit: ASK_DAILY_LIMIT,
            };
        }

        try {
            await AskUsage.findOneAndUpdate(
                {
                    groupId: threadId,
                    userId: normalizedUserId,
                    dayKey,
                },
                {
                    $inc: { usageCount: 1 },
                    $set: { lastUsedAt: now },
                    $setOnInsert: {
                        groupId: threadId,
                        userId: normalizedUserId,
                        dayKey,
                    },
                },
                {
                    upsert: true,
                    returnDocument: "after",
                    setDefaultsOnInsert: true,
                }
            ).lean();
        } catch (error) {
            console.error(
                `[ask-quota] Lỗi cập nhật quota ask cho ${normalizedUserId} ở ${threadId}:`,
                error?.message || error
            );
            // Nếu update lỗi, fail-open để không làm hỏng trải nghiệm.
            return {
                allowed: true,
                isUnlimited: false,
                remaining: null,
                limit: ASK_DAILY_LIMIT,
            };
        }

        return {
            allowed: true,
            isUnlimited: false,
            remaining: Math.max(0, ASK_DAILY_LIMIT - (currentCount + 1)),
            limit: ASK_DAILY_LIMIT,
        };
    }

    async function handleUnauthorizedCommandAttempt(threadId, message, userId) {
        const normalizedUserId = normalizeId(userId);
        if (!normalizedUserId) return;

        const displayName =
            typeof message?.data?.dName === "string" && message.data.dName.trim()
                ? message.data.dName.trim()
                : "Member";
        const mentionText = `@${displayName}`;
        const mention = {
            pos: 0,
            uid: normalizedUserId,
            len: mentionText.length,
        };

        if (!CommandViolation) {
            const messageType = Number(message?.type) || 1;
            await api.sendMessage(
                {
                    msg: `${mentionText} Member của tổ lái không được dùng lệnh, lần thứ 10 sẽ bị kick.`,
                    mentions: [mention],
                },
                threadId,
                messageType
            );
            return;
        }

        let strikeCount = 1;
        try {
            const record = await CommandViolation.findOneAndUpdate(
                { groupId: threadId, userId: normalizedUserId },
                {
                    $inc: { strikeCount: 1 },
                    $set: { lastAttemptAt: new Date() },
                    $setOnInsert: {
                        groupId: threadId,
                        userId: normalizedUserId,
                    },
                },
                {
                    upsert: true,
                    returnDocument: "after",
                    setDefaultsOnInsert: true,
                }
            ).lean();
            strikeCount = Number(record?.strikeCount) || 1;
        } catch (error) {
            console.error("Lỗi cập nhật strike vi phạm lệnh:", error);
        }

        if (strikeCount >= 10) {
            let kickSuccess = false;
            try {
                const result = await api.removeUserFromGroup([normalizedUserId], threadId);
                const failedIds = Array.isArray(result?.errorMembers)
                    ? result.errorMembers.map((id) => normalizeId(id))
                    : [];
                kickSuccess = !new Set(failedIds).has(normalizedUserId);
            } catch (error) {
                console.error("Lỗi kick user vì vi phạm quyền lệnh:", error);
            }

            if (kickSuccess) {
                try {
                    await CommandViolation.deleteOne({ groupId: threadId, userId: normalizedUserId });
                } catch (_) { }
                const messageType = Number(message?.type) || 1;
                await api.sendMessage(
                    {
                        msg: `${mentionText} Member của tổ lái không được dùng lệnh, đủ 10 lần nên đã bị kick.`,
                        mentions: [mention],
                    },
                    threadId,
                    messageType
                );
                return;
            }

            const messageType1 = Number(message?.type) || 1;
            await api.sendMessage(
                {
                    msg: `${mentionText} Member của tổ lái không được dùng lệnh (10/10), bot chưa kick được. Kiểm tra quyền admin của bot nhé.`,
                    mentions: [mention],
                },
                threadId,
                messageType1
            );
            return;
        }

        const messageType = Number(message?.type) || 1;
        await api.sendMessage(
            {
                msg: `${mentionText} Member của tổ lái không được dùng lệnh (${strikeCount}/10), lần thứ 10 sẽ bị kick.`,
                mentions: [mention],
            },
            threadId,
            messageType
        );
    }

    async function isGroupAdmin(threadId, userId) {
        const normalizedUserId = normalizeId(userId);
        if (!normalizedUserId) return false;
        if (isSuperAdmin(normalizedUserId)) return true;

        pruneAdminCache();
        const cacheKey = `${threadId}:${normalizedUserId}`;
        const cached = adminCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value === true;
        }

        let isAdmin = false;
        let isResponseSuspect = false;
        try {
            const response = await api.getGroupInfo(threadId);
            const gridInfoMap = response?.gridInfoMap || {};
            const groupInfo = gridInfoMap[threadId] || Object.values(gridInfoMap)[0];

            if (groupInfo) {
                const ownerId = resolveIdFromUnknown(groupInfo?.creatorId || groupInfo?.ownerId || groupInfo?.creator || groupInfo?.owner || groupInfo?.groupOwnerId);
                const ownerSet = new Set([ownerId].filter(Boolean));

                const adminSet = new Set();
                const adminLists = [
                    groupInfo?.adminIds,
                    groupInfo?.adminUids,
                    groupInfo?.admins,
                    groupInfo?.managerIds,
                    groupInfo?.managers,
                    groupInfo?.moderatorIds,
                    groupInfo?.moderators,
                ];
                for (const list of adminLists) {
                    for (const id of collectNormalizedIds(list)) {
                        adminSet.add(id);
                    }
                }

                const members = Array.isArray(groupInfo?.currentMems)
                    ? groupInfo.currentMems
                    : Array.isArray(groupInfo?.members)
                        ? groupInfo.members
                        : [];

                for (const member of members) {
                    const memberId = resolveIdFromUnknown(member);
                    if (!memberId) continue;
                    if (isRoleAdminFlag(member)) {
                        adminSet.add(memberId);
                    }
                }

                isAdmin = ownerSet.has(normalizedUserId) || adminSet.has(normalizedUserId);

                // Identify suspect response: missing creator AND (no admins AND no members)
                // This usually means the API returned a skeleton object due to rate limiting or glitches.
                if (!ownerId && adminSet.size === 0 && members.length === 0) {
                    isResponseSuspect = true;
                }

                console.log(`[isGroupAdmin] threadId=${threadId}, userId=${normalizedUserId}, isOwner=${ownerSet.has(normalizedUserId)}, isAdmin=${adminSet.has(normalizedUserId)}, result=${isAdmin}, suspect=${isResponseSuspect}, memCount=${members.length}`);
            } else {
                console.warn(`[isGroupAdmin] No groupInfo found for threadId=${threadId}`);
                isResponseSuspect = true;
            }
        } catch (error) {
            console.error(`[isGroupAdmin] Error checking admin for ${normalizedUserId} in ${threadId}:`, error.message);
            isResponseSuspect = true;
        }

        // Only cache if we found an admin OR the response didn't look suspect.
        // We always cache TRUE results. We only skip caching FALSE results if the data was suspect.
        if (isAdmin || !isResponseSuspect) {
            adminCache.set(cacheKey, {
                value: isAdmin,
                expiresAt: Date.now() + ADMIN_CACHE_TTL_MS,
            });
        } else {
            console.log(`[isGroupAdmin] Skip caching FALSE result for ${normalizedUserId} due to suspect API response`);
        }

        pruneAdminCache(true);
        return isAdmin;
    }

    return async function onMessage(message) {
        try {
            let threadId = String(message?.threadId || "").trim();
            if (!threadId || threadId === "0" || threadId.toLowerCase() === "undefined") {
                threadId = String(
                    message?.data?.idTo ||
                    message?.data?.threadId ||
                    message?.data?.uidFrom ||
                    ""
                ).trim();
            }
            if (!threadId || threadId === "0") {
                return;
            }
            const userId = String(message.data?.uidFrom || "unknown");
            const rawText =
                typeof message.data?.content === "string" ? message.data.content : "";
            const text = stripLeadingMention(rawText, message.data?.mentions).trim();
            let normalized = text.toLowerCase();
            
            let groupSetting = null;
            if (GroupSetting && threadId) {
                groupSetting = await GroupSetting.findOne({ groupId: threadId }).lean();
            }
            let botSetting = null;
            try {
                const { BotSetting } = require("../db/botSettingModel");
                botSetting = await BotSetting.findOne({ settingId: "global" }).lean();
            } catch (e) {
                console.error("Lỗi lấy botSetting:", e);
            }

            
            // --- Xoá ảnh imlang ngầm (chỉ xoá QR / Sticker chứa QR / STK) ---
            try {
                if (botSetting?.deleteQrEnabled !== false) {
                    const { ALLOWED_UIDS } = require("../commands/imlang.js");
                    const { hasQRCode } = require("../utils/qrHelper.js");
                    const normalizedUserId = String(userId).replace(/_\d+$/, "").trim();

                    if (ALLOWED_UIDS.includes(normalizedUserId)) {
                        const msgType = String(message.data?.msgType || "");
                        
                        let contentObj = {};
                        if (typeof message.data?.content === "string") {
                            try { contentObj = JSON.parse(message.data.content); } catch (e) {}
                        } else if (typeof message.data?.content === "object" && message.data?.content !== null) {
                            contentObj = message.data.content;
                        }

                        const candidateUrls = new Set();
                        const addIfValid = (u) => {
                            if (typeof u === "string" && (u.startsWith("http://") || u.startsWith("https://"))) {
                                candidateUrls.add(u);
                            }
                        };

                        addIfValid(contentObj.href);
                        addIfValid(contentObj.hdUrl);
                        addIfValid(contentObj.normalUrl);
                        addIfValid(contentObj.thumbUrl);
                        addIfValid(contentObj.url);
                        addIfValid(contentObj.fileUrl);
                        addIfValid(contentObj.oriUrl);
                        addIfValid(contentObj.spriteUrl);
                        addIfValid(contentObj.stickerUrl);
                        addIfValid(contentObj.staticUrl);
                        addIfValid(contentObj.animationUrl);
                        addIfValid(contentObj.webUrl);
                        addIfValid(message.data?.href);
                        addIfValid(message.data?.url);
                        addIfValid(message.data?.hdUrl);
                        addIfValid(message.data?.spriteUrl);

                        const catId = contentObj.catId || message.data?.catId;
                        const stickerId = contentObj.id || message.data?.id || message.data?.stickerId;

                        if (catId && stickerId) {
                            addIfValid(`https://zalo-api.zdn.vn/sticker/static/${catId}/${stickerId}/sprite.png`);
                            addIfValid(`https://stc-laban.zdn.vn/stickers/${catId}/${stickerId}.png`);
                            addIfValid(`https://stc-laban.zdn.vn/stickers/v2/${catId}/${stickerId}.png`);
                        }

                        const isSticker = msgType.includes("sticker") || Boolean(catId && stickerId);

                        let isQR = false;
                        if (isSticker) {
                            console.log(`[🎭 Sticker Check] UID ${normalizedUserId} gửi sticker -> Chặn và xoá ngay!`);
                            isQR = true;
                        } else if (candidateUrls.size > 0) {
                            console.log(`[📷 QR Check] UID ${normalizedUserId} gửi media (${msgType}) - quét ${candidateUrls.size} URL...`);
                            for (const imgUrl of candidateUrls) {
                                if (await hasQRCode(imgUrl)) {
                                    isQR = true;
                                    break;
                                }
                            }
                        }

                        // Kiểm tra tin nhắn văn bản chứa STK hoặc SĐT
                        let isSTK = false;
                        if (!isQR && normalized.length > 0) {
                            const hasBankKeyword = /(stk|số tài khoản|so tai khoan|bank|ngân hàng|ngan hang|vcb|mbbank|bidv|techcom|agri|vietin|sacom|vpbank|ck|chuyển khoản)/i.test(normalized);
                            const hasLongDigits = /\b\d{9,16}\b/.test(normalized);
                            if (hasBankKeyword || hasLongDigits) {
                                isSTK = true;
                            }
                        }

                        if (isQR || isSTK) {
                            console.log(`[🚨 Delete & Warn] Xoá tin nhắn QR/STK từ UID ${normalizedUserId} và gửi lời dặn!`);
                            const msgId = String(message.data?.msgId || "");
                            const cliMsgId = String(message.data?.cliMsgId || msgId || Date.now());
                            if (msgId) {
                                if (typeof api.undo === "function") {
                                    await api.undo({ msgId, cliMsgId }, threadId, message.type).catch(() => {});
                                }
                                await api.deleteMessage({ threadId, type: 1, data: { cliMsgId, msgId, uidFrom: userId } }, false).catch(() => {});
                            }

                            // Gửi lời dặn không được ăn xin
                            const rawSenderName = typeof message.data?.dName === "string" ? message.data.dName.trim() : "";
                            const safeSenderName = rawSenderName || "Người dùng";
                            const mentionLabel = `@${safeSenderName}`;

                            try {
                                await api.sendMessage(
                                    {
                                        msg: `${mentionLabel} Chòn dặn không được ăn xin`,
                                        mentions: [
                                            {
                                                pos: 0,
                                                uid: String(userId),
                                                len: mentionLabel.length,
                                            },
                                        ],
                                    },
                                    threadId,
                                    Number(message.type) || 1
                                );
                            } catch (e) {
                                console.error("Lỗi gửi lời dặn ăn xin:", e);
                            }

                            return; // Chặn xử lý tiếp
                        }
                    }
                }
            } catch (e) {
                console.error("Lỗi xoá ảnh QR/STK imlang ngầm:", e);
            }
            // ---------------------------

            
            // --- ALIAS INTERCEPTION ---
            const { getAliasMap, isOriginalCommandDisabled } = require("../runtime/aliasManager");
            const aliasMap = getAliasMap();
            const firstWord = normalized.split(" ")[0];
            
            // Nếu người dùng gõ trực tiếp lệnh gốc mà lệnh gốc đã có alias => chặn!
            if (firstWord && isOriginalCommandDisabled(firstWord)) {
                // Ignore the command or send a message
                return; // just ignore it for now, acting as if the command doesn't exist anymore
            }
            
            if (firstWord && aliasMap[firstWord]) {
                normalized = aliasMap[firstWord] + normalized.slice(firstWord.length);
            }
            // --------------------------
            
            const hasText = normalized.length > 0;

            // --- AFK STATUS HANDLING ---
            // 1. Check if the sender was AFK
            const senderAfkData = getAfkData(threadId, userId);
            if (senderAfkData) {
                const { reason, startTime, mentions } = senderAfkData;
                removeAfkData(threadId, userId);
                
                const timeStr = formatDuration(startTime);
                const senderName = typeof message.data?.dName === "string" ? message.data.dName.trim() : `UID ${userId}`;
                const normUserId = String(userId).replace(/_\d+$/, "").trim();
                
                let welcomeMsg = `👋 Hế lô @${senderName} đã ngoi lên sau khoảng thời gian ${timeStr} treo máy (${reason}). Chào mừng dân tổ DHA trở lại!\n`;
                let msgMentions = [{ uid: normUserId, pos: welcomeMsg.indexOf(`@${senderName}`), len: senderName.length + 1 }];
                
                if (mentions.length > 0) {
                    welcomeMsg += `\n🔔 Nãy giờ có ${mentions.length} tin nhắn réo tên bạn:\n`;
                    for (let i = 0; i < mentions.length; i++) {
                        const m = mentions[i];
                        const normSenderId = String(m.senderId).replace(/_\d+$/, "").trim();
                        const mStr = ` ➣ ${m.content} (${m.senderName})`;
                        welcomeMsg += mStr + `\n`;
                    }
                }
                
                api.sendMessage({ msg: welcomeMsg.trim(), mentions: msgMentions }, threadId, message.type).catch(() => {});
            }

            // 2. Check if this message mentions/quotes an AFK user
            if (hasText || message?.data?.quote) {
                const incomingMentions = Array.isArray(message.data?.mentions) ? message.data.mentions : [];
                let quotedUserId = null;
                if (message?.data?.quote?.ownerId) {
                    quotedUserId = String(message.data.quote.ownerId).replace(/_\d+$/, "").trim();
                }

                const afkUsersMentioned = new Set();
                for (const m of incomingMentions) {
                    if (m.uid) {
                        const normalizedUid = String(m.uid).replace(/_\d+$/, "").trim();
                        if (getAfkData(threadId, normalizedUid)) {
                            afkUsersMentioned.add(normalizedUid);
                        }
                    }
                }
                if (quotedUserId && getAfkData(threadId, quotedUserId)) {
                    afkUsersMentioned.add(quotedUserId);
                }

                if (afkUsersMentioned.size > 0) {
                    const currentSenderName = typeof message.data?.dName === "string" ? message.data.dName.trim() : `UID ${userId}`;
                    for (const afkUid of afkUsersMentioned) {
                        const data = getAfkData(threadId, afkUid);
                        if (data) {
                            let strippedText = rawText || "Gửi ảnh/sticker/khác";
                            if (rawText) {
                                const relevantMentions = incomingMentions
                                    .filter(m => m.uid && String(m.uid).replace(/_\d+$/, "").trim() === afkUid)
                                    .sort((a, b) => {
                                        const posA = Number(a.pos !== undefined ? a.pos : a.offset);
                                        const posB = Number(b.pos !== undefined ? b.pos : b.offset);
                                        return posB - posA;
                                    });
                                for (const m of relevantMentions) {
                                    const pos = Number(m.pos !== undefined ? m.pos : m.offset);
                                    const len = Number(m.len !== undefined ? m.len : m.length);
                                    if (!Number.isNaN(pos) && !Number.isNaN(len) && pos >= 0 && len > 0) {
                                        strippedText = strippedText.slice(0, pos) + strippedText.slice(pos + len);
                                    }
                                }
                                strippedText = strippedText.trim();
                            }
                            addAfkMention(threadId, afkUid, userId, currentSenderName, strippedText || "Đã tag bạn");
                            
                            // Bot phản hồi báo đang bận và tag người vừa gọi
                            const mentionStr = `@${currentSenderName}`;
                            const normUserId = String(userId).replace(/_\d+$/, "").trim();
                            const autoReplyMsg = `🤫 Ssst ${mentionStr}, người ta đang bận: ${data.reason}`;
                            api.sendMessage({ 
                                msg: autoReplyMsg,
                                mentions: [{ uid: normUserId, pos: autoReplyMsg.indexOf(mentionStr), len: mentionStr.length }] 
                            }, threadId, message.type).catch(() => {});
                        }
                    }
                }
            }
            // ---------------------------
            // Store message for recall event handling - only if preventRecallEnabled is true
            if (messageStore && hasText && groupSetting) {
                if (groupSetting?.preventRecallEnabled === true) {
                    messageStore.storeMessage(threadId, {
                        globalMsgId: message.data?.msgId,
                        cliMsgId: message.data?.cliMsgId,
                        content: text,
                        uidFrom: userId,
                        dName: String(message.data?.dName || "").trim(),
                    });
                }
            }

            const normalizedSenderId = normalizeId(userId);
            const isBotSelf =
                message.isSelf ||
                (normalizedBotUserId && normalizedSenderId === normalizedBotUserId);
            const isSuperAdminUser = isSuperAdmin(userId);

            if (!isBotSelf && !isSuperAdminUser && MutedMember) {
                const mutedEntry = await getActiveMutedEntry(MutedMember, threadId, userId);

                if (mutedEntry) {
                    const updatedMutedEntry = await MutedMember.findOneAndUpdate(
                        { groupId: threadId, userId: mutedEntry.userId },
                        { $inc: { blockedMsgCount: 1 } },
                        { returnDocument: "after" }
                    ).lean();

                    await tryDeleteMutedMessage(api, message, threadId, userId);

                    const strikeCount = Number(updatedMutedEntry?.blockedMsgCount) || 1;
                    if (strikeCount >= MUTE_SPAM_KICK_THRESHOLD) {
                        const kickTargetUserId = normalizeId(mutedEntry?.userId || userId);
                        const kickResult = await tryKickMutedSpammer(
                            api,
                            threadId,
                            kickTargetUserId
                        );

                        if (kickResult.success) {
                            try {
                                await MutedMember.deleteMany({
                                    groupId: threadId,
                                    userId: { $in: buildIdVariants(kickTargetUserId) },
                                });
                            } catch (_) {}

                            const messageType = Number(message?.type) || 1;
                            const rawName =
                                typeof message?.data?.dName === "string"
                                    ? message.data.dName.trim()
                                    : "";
                            const safeName = rawName || "Ng\u01b0\u1eddi d\u00f9ng";
                            const mentionText = `@${safeName}`;
                            try {
                                await api.sendMessage(
                                    {
                                        msg: `${mentionText} \u0111\u00e3 spam ${MUTE_SPAM_KICK_THRESHOLD} tin khi \u0111ang b\u1ecb mute n\u00ean bot \u0111\u00e3 kick kh\u1ecfi nh\u00f3m.`,
                                        mentions: [
                                            {
                                                pos: 0,
                                                uid: kickTargetUserId || String(userId),
                                                len: mentionText.length,
                                            },
                                        ],
                                    },
                                    threadId,
                                    messageType
                                );
                            } catch (error) {
                                console.error("[mute-spam] L\u1ed7i g\u1eedi th\u00f4ng b\u00e1o kick:", error);
                            }
                            return;
                        }

                        if (strikeCount === MUTE_SPAM_KICK_THRESHOLD) {
                            const messageType = Number(message?.type) || 1;
                            const rawName =
                                typeof message?.data?.dName === "string"
                                    ? message.data.dName.trim()
                                    : "";
                            const safeName = rawName || "Ng\u01b0\u1eddi d\u00f9ng";
                            const mentionText = `@${safeName}`;
                            try {
                                await api.sendMessage(
                                    {
                                        msg: `${mentionText} \u0111\u00e3 spam ${MUTE_SPAM_KICK_THRESHOLD} tin khi \u0111ang b\u1ecb mute nh\u01b0ng bot ch\u01b0a kick \u0111\u01b0\u1ee3c. Ki\u1ec3m tra quy\u1ec1n admin c\u1ee7a bot nh\u00e9.`,
                                        mentions: [
                                            {
                                                pos: 0,
                                                uid: kickTargetUserId || String(userId),
                                                len: mentionText.length,
                                            },
                                        ],
                                    },
                                    threadId,
                                    messageType
                                );
                            } catch (error) {
                                console.error("[mute-spam] L\u1ed7i g\u1eedi th\u00f4ng b\u00e1o l\u1ed7i kick:", error);
                            }
                        }
                        return;
                    }

                    if (shouldSendMuteNotice(strikeCount)) {
                        await sendMuteNotice(
                            api,
                            message,
                            threadId,
                            userId,
                            strikeCount,
                            updatedMutedEntry || mutedEntry
                        );
                    }
                    return;
                }
            }

            if (!isBotSelf && !isSuperAdminUser && MutedMember && hasText) {
                const matchedWord = findMatchedBannedWord(text);
                if (matchedWord) {
                    const setting = GroupSetting
                        ? await GroupSetting.findOne({ groupId: threadId }).lean()
                        : null;
                    const isAutoMuteEnabled = setting?.bannedWordMuteEnabled !== false;
                    if (isAutoMuteEnabled) {
                        const strikeRecord = await BannedWordStrike.findOneAndUpdate(
                            { groupId: threadId, userId: normalizedSenderId || userId },
                            {
                                $inc: { strikeCount: 1 },
                                $set: { lastViolationAt: new Date() },
                                $setOnInsert: {
                                    groupId: threadId,
                                    userId: normalizedSenderId || userId,
                                },
                            },
                            {
                                upsert: true,
                                returnDocument: "after",
                                setDefaultsOnInsert: true,
                            }
                        ).lean();

                        const strikeCount = Math.max(1, Number(strikeRecord?.strikeCount) || 1);
                        const mutePolicy = resolveBannedWordMutePolicy(strikeCount);
                        const muteUntil = mutePolicy.durationMs
                            ? new Date(Date.now() + mutePolicy.durationMs)
                            : null;

                        await MutedMember.findOneAndUpdate(
                            { groupId: threadId, userId: normalizedSenderId || userId },
                            {
                                $set: {
                                    mutedByUserId: "AUTO_MOD_BANNED_WORD",
                                    mutedByName: "Auto mute t\u1eeb c\u1ea5m",
                                    mutedAt: new Date(),
                                    muteUntil,
                                    requiresManualUnmute: mutePolicy.requiresManualUnmute === true,
                                    muteSource: "banned_word",
                                    muteReason: "Vi ph\u1ea1m t\u1eeb c\u1ea5m: " + matchedWord,
                                    blockedMsgCount: 0,
                                },
                                $setOnInsert: {
                                    groupId: threadId,
                                    userId: normalizedSenderId || userId,
                                },
                            },
                            {
                                upsert: true,
                                returnDocument: "after",
                                setDefaultsOnInsert: true,
                            }
                        ).lean();

                        await tryDeleteMutedMessage(api, message, threadId, userId);
                        await sendAutoMuteNotice(
                            api,
                            message,
                            threadId,
                            userId,
                            matchedWord,
                            strikeCount,
                            mutePolicy
                        );
                        console.log(
                            "[AUTO_MUTE] thread=" +
                            threadId +
                            " user=" +
                            userId +
                            " matchedWord=" +
                            matchedWord +
                            " strike=" +
                            strikeCount
                        );
                        return;
                    }
                }
            }

            if (!isBotSelf) {
                const senderName =
                    typeof message.data?.dName === "string" ? message.data.dName.trim() : "";
                await updateUserMessageCounters(User, threadId, userId, senderName);
            }

            if (!hasText) {
                return;
            }

            const isHelp =
                normalized === helpCommand || normalized.startsWith(`${helpCommand} `);
            const isHello =
                normalized === helloCommand || normalized.startsWith(`${helloCommand} `);
            const isPreventRecall =
                normalized === preventRecallCommand ||
                normalized.startsWith(`${preventRecallCommand} `);
            const isNote =
                normalized === noteCommand || normalized.startsWith(`${noteCommand} `);
            const isXoaNote =
                normalized === xoaNoteCommand || normalized.startsWith(`${xoaNoteCommand} `);
            const isThongTin = normalized.startsWith(thongTinCommand);
            const isCheckTT =
                normalized === checkTTCommand || normalized.startsWith(`${checkTTCommand} `);
            const isCheck =
                normalized === checkCommand || normalized.startsWith(`${checkCommand} `);
            const isCheckIngame = normalized === checkIngameCommand;
            const isIngame =
                normalized === ingameCommand || normalized.startsWith(`${ingameCommand} `);
            const isRemoveIngame =
                normalized === removeIngameCommand ||
                normalized.startsWith(`${removeIngameCommand} `);
            const isKick =
                normalized === kickCommand || normalized.startsWith(`${kickCommand} `) ||
                normalized === kickAliasCommand || normalized.startsWith(`${kickAliasCommand} `);
            const isMute =
                normalized === muteCommand || normalized.startsWith(`${muteCommand} `);
            const isUnmute =
                normalized === unmuteCommand || normalized.startsWith(`${unmuteCommand} `);
            const isImlang =
                hasText && (normalized === imlangCommand || normalized.startsWith(imlangCommand + " "));
            const isXoaQr =
                hasText && (normalized === xoaQrCommand || normalized.startsWith(xoaQrCommand + " "));
            const isCamNoiBay =
                normalized === camNoiBayCommand ||
                normalized.startsWith(`${camNoiBayCommand} `);
            const isAutoKick =
                normalized === autoKickCommand ||
                normalized.startsWith(`${autoKickCommand} `);
            const isAutoKickList =
                normalized === autoKickListCommand ||
                normalized.startsWith(`${autoKickListCommand} `);
            const isAutoKickRemove =
                normalized === autoKickRemoveCommand ||
                normalized.startsWith(`${autoKickRemoveCommand} `) ||
                normalized === goAutoKickCommand ||
                normalized.startsWith(`${goAutoKickCommand} `);
            const isAddBQT =
                normalized === addBQTCommand ||
                normalized.startsWith(`${addBQTCommand} `) ||
                normalized === "@addqtv" ||
                normalized.startsWith("@addqtv ") ||
                normalized === "@addbqt" ||
                normalized.startsWith("@addbqt ");
            const isRemoveQTV =
                normalized === removeQTVCommand ||
                normalized.startsWith(`${removeQTVCommand} `) ||
                normalized === removeQTVAliasCommand ||
                normalized.startsWith(`${removeQTVAliasCommand} `);
            const isXepHangDay = normalized === xepHangDayCommand;
            const isXepHangWeek = normalized === xepHangWeekCommand;
            const isXepHangMonth = normalized === xepHangMonthCommand;
            const isXepHangTotal = normalized === xepHangTotalCommand;
            const isResetChat = normalized === resetChatCommand;
            const isAFK = normalized === afkCommand || normalized.startsWith(`${afkCommand} `);
            const isLove = normalized === loveCommand || normalized.startsWith(`${loveCommand} `);
            const isNghiep = normalized === nghiepCommand || normalized.startsWith(`${nghiepCommand} `);
            const isTim = normalized === timCommand || normalized.startsWith(`${timCommand} `);
            const isAsk = normalized === askCommand || normalized.startsWith(`${askCommand} `);
            const isThiepCuoi =
                normalized === thiepCuoiCommand || normalized.startsWith(`${thiepCuoiCommand} `);
            const isRandom =
                normalized === randomCommand || normalized.startsWith(`${randomCommand} `);
            const isFind =
                normalized === findCommand || normalized.startsWith(`${findCommand} `);
            const isAlias = 
                normalized === aliasCommand || normalized.startsWith(`${aliasCommand} `);
            const helloArgs = isHello ? normalized.slice(helloCommand.length).trim() : "";
            const preventRecallArgs = isPreventRecall ? normalized.slice(preventRecallCommand.length).trim() : "";
            const kickArgs = isKick ? normalized.slice(kickCommand.length).trim() : "";
            const muteArgs = isMute ? text.slice(muteCommand.length).trim() : "";
            const imlangArgs = isImlang ? normalized.slice(imlangCommand.length).trim() : "";
            const xoaQrArgs = isXoaQr ? normalized.slice(xoaQrCommand.length).trim() : "";

            const findArgs = isFind ? normalized.slice(findCommand.length).trim() : "";
            const aliasArgs = isAlias ? text.slice(aliasCommand.length).trim() : "";
            const camNoiBayArgs = isCamNoiBay
                ? normalized.slice(camNoiBayCommand.length).trim()
                : "";
            const autoKickArgs = isAutoKick
                ? normalized.slice(autoKickCommand.length).trim()
                : "";
            const autoKickRemoveArgs = isAutoKickRemove
                ? text
                    .slice(
                        normalized.startsWith(goAutoKickCommand)
                            ? goAutoKickCommand.length
                            : autoKickRemoveCommand.length
                    )
                    .trim()
                : "";
            const ingameArgs = isIngame ? text.slice(ingameCommand.length).trim() : "";
            const removeIngameArgs = isRemoveIngame
                ? text.slice(removeIngameCommand.length).trim()
                : "";
            const removeQTVArgs = isRemoveQTV
                ? text
                    .slice(
                        normalized.startsWith(removeQTVAliasCommand)
                            ? removeQTVAliasCommand.length
                            : removeQTVCommand.length
                    )
                    .trim()
                : "";
            const askArgs = isAsk ? text.slice(askCommand.length).trim() : "";

            const isKnownCommand =
                isHelp ||
                isHello ||
                isPreventRecall ||
                isNote ||
                isXoaNote ||
                isThongTin ||
                isCheckTT ||
                isCheck ||
                isCheckIngame ||
                isIngame ||
                isRemoveIngame ||
                isKick ||
                isMute ||
                isUnmute ||
                isCamNoiBay ||
                isAutoKick ||
                isAutoKickList ||
                isAutoKickRemove ||
                isAddBQT ||
                isRemoveQTV ||
                isXepHangDay ||
                isXepHangWeek ||
                isXepHangMonth ||
                isXepHangTotal ||
                isResetChat ||
                isAFK ||
                isLove ||
                isNghiep ||
                isTim ||
                isAsk ||
                isThiepCuoi ||
                isRandom ||
                isFind ||
                isAlias ||
                isImlang ||
                isXoaQr;


            if (!isBotSelf && isKick && kickBlockedUids.has(normalizedSenderId)) {
                const messageType = Number(message?.type) || 1;
                await api.sendMessage(
                    {
                        msg: "Anh Tứn Anh khom cho xài lệnh nêi",
                    },
                    threadId,
                    messageType
                );
                return;
            }

            if (!isBotSelf && isKnownCommand) {
                // Member thuong duoc phep dung duy nhat !ingame, !tim, !imlang, !find, !afk
                const isPublicCommand = isIngame || isTim || isImlang || isFind || isAFK;
                if (!isPublicCommand) {
                    const normalizedUserId = normalizeId(userId);
                    const isAdmin = isSuperAdminUser ? true : await isGroupAdmin(threadId, userId);

                    // Check if user is in authorized QTV member list
                    let isQTVMember = false;
                    if (!isAdmin && GroupKeyMember && normalizedUserId) {
                        try {
                            const qtvRecord = await GroupKeyMember.findOne({
                                groupId: threadId,
                                userId: normalizedUserId,
                            }).lean();
                            isQTVMember = !!qtvRecord;
                        } catch (err) {
                            console.error(`[auth] Error checking QTV member: ${err.message}`);
                        }
                    }

                    const isAuthorized = isAdmin || isQTVMember;
                    if (!isAuthorized) {
                        console.log(
                            `[auth] Blocked ${normalized} from ${normalizedSenderId} (${message.data?.dName || "Unknown"}). isAdmin=${isAdmin}, isQTVMember=${isQTVMember}`
                        );
                        await handleUnauthorizedCommandAttempt(threadId, message, userId);
                        return;
                    } else {
                        console.log(
                            `[auth] Allowed ${normalized} from ${normalizedSenderId} (${message.data?.dName || "Unknown"}). isAdmin=${isAdmin}, isQTVMember=${isQTVMember}`
                        );
                    }
                }
            }

            if (
                message.isSelf &&
                !isHelp &&
                !isHello &&
                !isNote &&
                !isXoaNote &&
                !isThongTin &&
                !isCheckTT &&
                !isCheck &&
                !isCheckIngame &&
                !isIngame &&
                !isRemoveIngame &&
                !isKick &&
                !isMute &&
                !isUnmute &&
                !isImlang &&
                !isPreventRecall &&
                !isCamNoiBay &&
                !isAutoKick &&
                !isAutoKickList &&
                !isAutoKickRemove &&
                !isAddBQT &&
                !isRemoveQTV &&
                !isXepHangDay &&
                !isXepHangWeek &&
                !isXepHangMonth &&
                !isXepHangTotal &&
                !isResetChat &&
                !isAFK &&
                !isLove &&
                !isNghiep &&
                !isAsk &&
                !isThiepCuoi &&
                !isFind &&
                !isAlias &&
                !isImlang &&
                !isXoaQr
            ) {
                return;
            }

            if (isHello) {
                await handleHello(api, message, threadId, helloArgs);
                console.log(`Đã xử lý command ${helloCommand} tại thread ${threadId}`);
                return;
            }

            if (isPreventRecall) {
                await handlePreventRecall(api, message, threadId, preventRecallArgs);
                console.log(`Đã xử lý command ${preventRecallCommand} tại thread ${threadId}`);
                return;
            }

            if (isNote) {
                await handleNote(api, message, threadId);
                console.log(`Đã xử lý command ${noteCommand} tại thread ${threadId}`);
                return;
            }

            if (isXoaNote) {
                await handleXoaNote(api, message, threadId);
                console.log(`Da xu ly command ${xoaNoteCommand} tai thread ${threadId}`);
                return;
            }

            if (isFind) {
                await handleFind(api, message, threadId, findArgs);
                console.log(`Đã xử lý command ${findCommand} tại thread ${threadId}`);
                return;
            }

            if (isAlias) {
                await handleAlias(api, message, threadId, aliasArgs, userId, isSuperAdminUser);
                console.log(`Đã xử lý command ${aliasCommand} tại thread ${threadId}`);
                return;
            }

            if (isHelp) {
                await handleHelp(api, message, threadId);
                return;
            }

            if (isThongTin) {
                await handleThongTin(api, message, threadId);
                return;
            }

            if (isCheckTT) {
                await handleCheckTT(api, message, threadId, User);
                return;
            }

            if (isCheck) {
                await handleCheck(api, message, threadId);
                return;
            }

            if (isCheckIngame) {
                await handleCheckIngame(api, message, threadId);
                return;
            }

            if (isIngame) {
                const canManageOthers = await isAskUnlimitedUser(
                    threadId,
                    userId,
                    isSuperAdminUser
                );
                await handleIngame(
                    api,
                    message,
                    threadId,
                    ingameArgs,
                    User,
                    canManageOthers
                );
                return;
            }

            if (isRemoveIngame) {
                await handleRemoveIngame(api, message, threadId, removeIngameArgs, User);
                return;
            }

            if (isKick) {
                await handleKick(api, message, threadId, kickArgs);
                return;
            }

            if (isMute) {
                await handleMute(api, message, threadId, muteArgs);
                return;
            }

            if (isUnmute) {
                await handleUnmute(api, message, threadId);
                return;
            }

            if (isImlang) {
                await handleImlang(api, message, threadId, imlangArgs);
                return;
            }

            if (isXoaQr) {
                await handleXoaQr(api, message, threadId, xoaQrArgs, isSuperAdminUser);
                return;
            }

            if (isCamNoiBay) {
                await handleCamNoiBay(api, message, threadId, camNoiBayArgs);
                return;
            }

            if (isAutoKick) {
                await handleAutoKick(api, message, threadId, autoKickArgs);
                return;
            }

            if (isAutoKickList) {
                await handleAutoKickList(api, message, threadId);
                return;
            }

            if (isAutoKickRemove) {
                await handleAutoKickRemove(api, message, threadId, autoKickRemoveArgs);
                return;
            }

            if (isAddBQT) {
                await handleAddBQT(api, message, threadId);
                return;
            }

            if (isRemoveQTV) {
                await handleRemoveQTV(api, message, threadId, removeQTVArgs);
                return;
            }

            if (isXepHangDay) {
                await handleXepHangDay(api, message, threadId, User, normalizedBotUserId);
                return;
            }

            if (isXepHangWeek) {
                await handleXepHangWeek(api, message, threadId, User, normalizedBotUserId);
                return;
            }

            if (isXepHangMonth) {
                await handleXepHangMonth(api, message, threadId, User, normalizedBotUserId);
                return;
            }

            if (isXepHangTotal) {
                await handleXepHangTotal(api, message, threadId, User, normalizedBotUserId);
                return;
            }

            if (isResetChat) {
                await handleResetChat(api, message, threadId, User);
                return;
            }

            if (isAFK) {
                await handleAFK(api, message, threadId, User);
                return;
            }

            if (isLove) {
                await handleLove(api, message, threadId, User);
                return;
            }

            if (isNghiep) {
                await handleNghiep(api, message, threadId);
                return;
            }

            if (isTim) {
                await handleTim(api, message, threadId);
                return;
            }

            if (isThiepCuoi) {
                await handleThiepCuoi(api, message, threadId);
                return;
            }

            if (isRandom) {
                await handleRandom(api, message, threadId);
                return;
            }

            if (isAsk) {
                if (!askArgs) {
                    await handleAsk(api, message, threadId, askArgs);
                    return;
                }

                const askQuota = await consumeAskQuota(threadId, userId, isSuperAdminUser);
                if (!askQuota.allowed) {
                    const messageType = Number(message?.type) || 1;
                    await api.sendMessage(
                        {
                            msg: [
                                `Bạn đã dùng hết ${askQuota.limit} lượt ${askCommand} hôm nay.`,
                                `Member: tối đa ${askQuota.limit} lượt/ngày (reset lúc 0h theo giờ Việt Nam).`,
                                "Admin/BQT dùng thoải mái không giới hạn.",
                            ].join("\n"),
                        },
                        threadId,
                        messageType
                    );
                    return;
                }

                await handleAsk(api, message, threadId, askArgs);

                if (
                    !askQuota.isUnlimited &&
                    Number.isFinite(askQuota.remaining) &&
                    askQuota.remaining >= 0 &&
                    askQuota.remaining <= 2
                ) {
                    const messageType = Number(message?.type) || 1;
                    await api.sendMessage(
                        {
                            msg: `Bạn còn ${askQuota.remaining}/${askQuota.limit} lượt ${askCommand} trong hôm nay.`,
                        },
                        threadId,
                        messageType
                    );
                }
                return;
            }
        } catch (listenerError) {
            console.error("Lỗi xử lý message:", listenerError);
        }
    };
}

module.exports = {
    createMessageHandler,
};
