const { getVNDateParts, getVNWeekInfo } = require("../utils/vnTime");
const { findMatchedBannedWord } = require("../config/bannedWords");
const { UserDailyMessage } = require("../db/userDailyMessageModel");
const { UserWeeklyMessage } = require("../db/userWeeklyMessageModel");
const { AskUsage } = require("../db/askUsageModel");

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

async function sendMuteNotice(api, message, threadId, userId, strikeCount) {
    const rawName =
        typeof message?.data?.dName === "string" ? message.data.dName.trim() : "";
    const safeName = rawName || "Người dùng";
    const mentionText = `@${safeName}`;
    const msg = `${mentionText} bị khoá mõm rồi cưng ơi (${strikeCount})`;
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
        console.error("Lỗi gửi cảnh báo mute:", error);
    }
}

async function sendAutoMuteNotice(api, message, threadId, userId) {
    const rawName =
        typeof message?.data?.dName === "string" ? message.data.dName.trim() : "";
    const safeName = rawName || "Người dùng";
    const mentionText = `@${safeName}`;
    const msg = `${mentionText} nói bậy hả, khoá mõm này cưng`;
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
        console.error("Lỗi gửi thông báo auto mute:", error);
    }
}

async function updateUserMessageCounters(User, threadId, userId, senderName) {
    const now = new Date();
    const { dayKey, monthKey } = getVNDateParts(now);
    const { weekKey, weekStartDayKey, weekEndDayKey } = getVNWeekInfo(now);

    const current = await User.findOne({ groupId: threadId, userId }).lean();
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

function buildSuperAdminSet() {
    const defaults = ["8073429320276439081"];
    const fromEnv = String(process.env.SUPER_ADMIN_UIDS || "")
        .split(",")
        .map((value) => normalizeId(value))
        .filter(Boolean);
    return new Set([...defaults.map((value) => normalizeId(value)), ...fromEnv]);
}

function resolveIdFromUnknown(raw) {
    if (raw === null || raw === undefined) return "";
    if (typeof raw === "string" || typeof raw === "number") {
        return normalizeId(raw);
    }
    if (typeof raw !== "object") return "";
    return normalizeId(raw.userId || raw.uid || raw.id || raw.memberId || raw.user_id);
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
        nodeCommand,
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
        handleHelp,
        handleHello,
        handlePreventRecall,
        handleNode,
        handleThongTin,
        handleCheckTT,
        handleCheck,
        handleCheckIngame,
        handleIngame,
        handleRemoveIngame,
        handleKick,
        handleMute,
        handleUnmute,
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
    } = commands;

    const normalizedBotUserId = normalizeId(botUserId);
    const adminCache = new Map();
    const ADMIN_CACHE_TTL_MS = 30 * 1000;
    const ADMIN_CACHE_MAX_ENTRIES = 1000;
    const ASK_DAILY_LIMIT = 5;
    const superAdmins = buildSuperAdminSet();

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
                } catch (_) {}
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
            const threadId = String(message.threadId);
            const userId = String(message.data?.uidFrom || "unknown");
            const rawText =
                typeof message.data?.content === "string" ? message.data.content : "";
            const text = rawText.trim();
            const normalized = text.toLowerCase();
            const hasText = normalized.length > 0;

            // Store message for recall event handling - only if preventRecallEnabled is true
            if (messageStore && hasText && GroupSetting) {
                const setting = await GroupSetting.findOne({ groupId: threadId }).lean();
                if (setting?.preventRecallEnabled === true) {
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
                const mutedEntry = await MutedMember.findOneAndUpdate(
                    { groupId: threadId, userId },
                    { $inc: { blockedMsgCount: 1 } },
                    { returnDocument: "after" }
                ).lean();

                if (mutedEntry) {
                    await tryDeleteMutedMessage(api, message, threadId, userId);

                    const strikeCount = Number(mutedEntry?.blockedMsgCount) || 1;
                    if (shouldSendMuteNotice(strikeCount)) {
                        await sendMuteNotice(api, message, threadId, userId, strikeCount);
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
                        await MutedMember.findOneAndUpdate(
                            { groupId: threadId, userId },
                            {
                                $set: {
                                    mutedByUserId: "AUTO_MOD_BANNED_WORD",
                                    mutedByName: "Auto mute từ cấm",
                                    mutedAt: new Date(),
                                },
                                $inc: { blockedMsgCount: 1 },
                                $setOnInsert: {
                                    groupId: threadId,
                                    userId,
                                },
                            },
                            {
                                upsert: true,
                                returnDocument: "after",
                                setDefaultsOnInsert: true,
                            }
                        ).lean();

                        await tryDeleteMutedMessage(api, message, threadId, userId);
                        await sendAutoMuteNotice(api, message, threadId, userId);
                        console.log(
                            `[AUTO_MUTE] thread=${threadId} user=${userId} matchedWord=${matchedWord}`
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
            const isNode =
                normalized === nodeCommand || normalized.startsWith(`${nodeCommand} `);
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
            const isAsk = normalized === askCommand || normalized.startsWith(`${askCommand} `);
            const helloArgs = isHello ? normalized.slice(helloCommand.length).trim() : "";
            const preventRecallArgs = isPreventRecall ? normalized.slice(preventRecallCommand.length).trim() : "";
            const kickArgs = isKick ? normalized.slice(kickCommand.length).trim() : "";
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
                isAsk;

            if (!isBotSelf && isKnownCommand) {
                // Public commands (không cần auth) - ingame, afk, love, ask
                const isPublicCommand = isIngame || isAFK || isLove || isAsk;
                // Kick status view (không có args thì là public)
                const isKickStatusOnly = isKick && kickArgs === "";
                // AutoKick status/on/off (không thêm uid thì là public)
                const isAutoKickStatusOnly = isAutoKick && (autoKickArgs === "" || autoKickArgs === "on" || autoKickArgs === "off");
                
                if (!isPublicCommand && !isKickStatusOnly && !isAutoKickStatusOnly) {
                    const normalizedUserId = normalizeId(userId);
                    const isAdmin = isSuperAdminUser ? true : await isGroupAdmin(threadId, userId);
                    
                    // Check if user is in authorized QTV member list
                    let isQTVMember = false;
                    if (!isAdmin && GroupKeyMember && normalizedUserId) {
                        try {
                            const qtvRecord = await GroupKeyMember.findOne({ groupId: threadId, userId: normalizedUserId }).lean();
                            isQTVMember = !!qtvRecord;
                        } catch (err) {
                            console.error(`[auth] Error checking QTV member: ${err.message}`);
                        }
                    }
                    
                    const isAuthorized = isAdmin || isQTVMember;
                    if (!isAuthorized) {
                        console.log(`[auth] Blocked ${normalized} from ${normalizedSenderId} (${message.data?.dName || "Unknown"}). isAdmin=${isAdmin}, isQTVMember=${isQTVMember}`);
                        await handleUnauthorizedCommandAttempt(threadId, message, userId);
                        return;
                    } else {
                        console.log(`[auth] Allowed ${normalized} from ${normalizedSenderId} (${message.data?.dName || "Unknown"}). isAdmin=${isAdmin}, isQTVMember=${isQTVMember}`);
                    }
                }
            }

            if (
                message.isSelf &&
                !isHelp &&
                !isHello &&
                !isThongTin &&
                !isCheckTT &&
                !isCheck &&
                !isCheckIngame &&
                !isIngame &&
                !isRemoveIngame &&
                !isKick &&
                !isMute &&
                !isUnmute &&
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
                !isAsk
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

            if (isNode) {
                await handleNode(api, message, threadId);
                console.log(`Đã xử lý command ${nodeCommand} tại thread ${threadId}`);
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
                await handleIngame(api, message, threadId, ingameArgs, User);
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
                await handleMute(api, message, threadId);
                return;
            }

            if (isUnmute) {
                await handleUnmute(api, message, threadId);
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
