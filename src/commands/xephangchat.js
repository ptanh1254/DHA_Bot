const fs = require("fs");

const { createChatRankingImage } = require("../design/chatRanking/renderer");
const { formatCount } = require("../design/chatRanking/template");
const { getVNDateParts, getVNDateTimeFormatted, getVNWeekInfo } = require("../utils/vnTime");
const { UserDailyMessage } = require("../db/userDailyMessageModel");
const { UserWeeklyMessage } = require("../db/userWeeklyMessageModel");

function normalizeDisplayName(name, fallbackUserId) {
    if (typeof name === "string" && name.trim()) return name.trim();
    return `UID ${fallbackUserId}`;
}

function chunkArray(values, chunkSize) {
    const chunks = [];
    for (let i = 0; i < values.length; i += chunkSize) {
        chunks.push(values.slice(i, i + chunkSize));
    }
    return chunks;
}

function normalizeId(rawId) {
    if (rawId === null || rawId === undefined) return "";
    return String(rawId).replace(/_0$/, "").trim();
}

function normalizeMemberId(rawId) {
    const value = String(rawId || "").trim();
    if (!value) return "";

    const withVersion = value.match(/^(.+)_\d+$/);
    if (withVersion) return withVersion[1].trim();

    return normalizeId(value);
}

function pickDisplayName(profile) {
    const candidates = [
        profile?.displayName,
        profile?.dName,
        profile?.zaloName,
        profile?.username,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }

    return "";
}

function pickAvatarUrl(profile) {
    const candidates = [profile?.avatar, profile?.avatar_120, profile?.avatar_240, profile?.avatar_25];

    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }

    return "";
}

function upsertMemberMeta(metaMap, uid, profile) {
    const normalizedUid = normalizeMemberId(uid);
    if (!normalizedUid || !profile || typeof profile !== "object") return;

    const current = metaMap.get(normalizedUid) || { displayName: "", avatarUrl: "" };
    const displayName = pickDisplayName(profile);
    const avatarUrl = pickAvatarUrl(profile);

    if (displayName) {
        current.displayName = displayName;
    }

    if (avatarUrl) {
        current.avatarUrl = avatarUrl;
    }

    metaMap.set(normalizedUid, current);
}

async function resolveMemberMeta(api, threadId, rows, User, seedMetaMap = new Map()) {
    const metaMap = new Map(seedMetaMap);
    const missingIdSet = new Set();

    // Only collect IDs that are REALLY missing (not in seedMetaMap with both displayName + avatarUrl)
    for (const row of rows) {
        const uid = String(row.userId);
        const rowDisplayName = pickDisplayName(row);
        const rowAvatar = pickAvatarUrl(row);

        if (rowDisplayName || rowAvatar) {
            upsertMemberMeta(metaMap, uid, {
                displayName: rowDisplayName,
                avatar: rowAvatar,
            });
        }

        const current = metaMap.get(uid) || {};
        // Skip if already fully resolved in seedMetaMap (from enrichGroupMemberMeta)
        if (!current.displayName || !current.avatarUrl) {
            missingIdSet.add(uid);
        }
    }

    if (missingIdSet.size === 0) return metaMap;
    
    const missingIds = [...missingIdSet];
    const chunkSize = 50;  // Increased from 20 - getUserInfo supports larger arrays
    const chunks = chunkArray(missingIds, chunkSize);
    const allUpdates = [];

    // Run API calls in parallel (5 chunks at a time for better throughput)
    for (let i = 0; i < chunks.length; i += 5) {
        const batchPromises = [];
        
        for (let j = 0; j < 5 && i + j < chunks.length; j++) {
            batchPromises.push(
                (async () => {
                    try {
                        const chunk = chunks[i + j];
                        const info = await api.getUserInfo(chunk);
                        const changedProfiles = info?.changed_profiles || {};
                        const updates = [];

                        for (const uid of chunk) {
                            const profile = changedProfiles[uid];
                            if (!profile) continue;

                            upsertMemberMeta(metaMap, uid, profile);
                            const latest = metaMap.get(uid);
                            if (latest?.displayName) {
                                updates.push({
                                    updateOne: {
                                        filter: { groupId: threadId, userId: uid },
                                        update: { $set: { displayName: latest.displayName } },
                                    },
                                });
                            }
                        }
                        
                        return updates;
                    } catch (error) {
                        console.error("Lỗi lấy thông tin người dùng cho xếp hạng:", error);
                        return [];
                    }
                })()
            );
        }

        const batchResults = await Promise.all(batchPromises);
        for (const updates of batchResults) {
            allUpdates.push(...updates);
        }
    }

    // Batch all DB updates
    if (allUpdates.length > 0) {
        try {
            const chunks = chunkArray(allUpdates, 500);
            await Promise.all(chunks.map(chunk => User.bulkWrite(chunk, { ordered: false })));
        } catch (error) {
            console.error("Lỗi cập nhật displayName trong DB:", error);
        }
    }

    return metaMap;
}

async function loadMembersFromGroupLink(api, threadId, memberIdSet, metaMap, expectedTotalMembers) {
    if (!Number.isFinite(expectedTotalMembers) || expectedTotalMembers <= memberIdSet.size) {
        return;
    }

    try {
        const detail = await api.getGroupLinkDetail(threadId);
        const link = detail?.link;
        if (!link) return;

        // Load initial page to get hasMoreMember info
        const firstPageInfo = await api.getGroupLinkInfo({ link, memberPage: 1 });
        const hasMore = Number(firstPageInfo?.hasMoreMember) === 1;
        
        // Process first page
        const firstPageMems = Array.isArray(firstPageInfo?.currentMems) ? firstPageInfo.currentMems : [];
        for (const member of firstPageMems) {
            const uid = normalizeMemberId(member?.id);
            if (!uid) continue;
            memberIdSet.add(uid);
            upsertMemberMeta(metaMap, uid, member);
        }

        if (!hasMore || memberIdSet.size >= expectedTotalMembers) return;

        // Load remaining pages in parallel (3 pages at a time)
        const remainingPages = [];
        for (let page = 2; page <= 200 && memberIdSet.size < expectedTotalMembers; page += 3) {
            remainingPages.push(
                Promise.all([
                    api.getGroupLinkInfo({ link, memberPage: page }).catch(() => ({ currentMems: [] })),
                    page + 1 <= 200 ? api.getGroupLinkInfo({ link, memberPage: page + 1 }).catch(() => ({ currentMems: [] })) : Promise.resolve({ currentMems: [] }),
                    page + 2 <= 200 ? api.getGroupLinkInfo({ link, memberPage: page + 2 }).catch(() => ({ currentMems: [] })) : Promise.resolve({ currentMems: [] }),
                ])
            );
        }

        const results = await Promise.all(remainingPages);
        for (const pageResults of results) {
            for (const info of pageResults) {
                if (!info) continue;
                const currentMems = Array.isArray(info.currentMems) ? info.currentMems : [];
                for (const member of currentMems) {
                    const uid = normalizeMemberId(member?.id);
                    if (!uid) continue;
                    memberIdSet.add(uid);
                    upsertMemberMeta(metaMap, uid, member);
                }
            }
        }
    } catch (error) {
        console.error("Lỗi fallback lấy thành viên qua group link:", error);
    }
}

async function loadGroupMembers(api, threadId) {
    try {
        const groupInfoResponse = await api.getGroupInfo(threadId);
        const gridInfoMap = groupInfoResponse?.gridInfoMap || {};
        const groupInfo = gridInfoMap[threadId] || Object.values(gridInfoMap)[0];

        if (!groupInfo) {
            return { memberIds: [], metaMap: new Map(), expectedTotalMembers: 0 };
        }

        const memberIdSet = new Set();
        if (Array.isArray(groupInfo.memberIds)) {
            for (const rawId of groupInfo.memberIds) {
                const uid = normalizeMemberId(rawId);
                if (uid) memberIdSet.add(uid);
            }
        }

        if (Array.isArray(groupInfo.memVerList)) {
            for (const rawId of groupInfo.memVerList) {
                const uid = normalizeMemberId(rawId);
                if (uid) memberIdSet.add(uid);
            }
        }

        if (Array.isArray(groupInfo.adminIds)) {
            for (const rawId of groupInfo.adminIds) {
                const uid = normalizeMemberId(rawId);
                if (uid) memberIdSet.add(uid);
            }
        }

        const metaMap = new Map();
        if (Array.isArray(groupInfo.currentMems)) {
            for (const member of groupInfo.currentMems) {
                const uid = normalizeMemberId(member?.id);
                if (!uid) continue;

                memberIdSet.add(uid);
                upsertMemberMeta(metaMap, uid, member);
            }
        }

        const expectedTotalMembers = Number(groupInfo.totalMember) || memberIdSet.size;
        await loadMembersFromGroupLink(
            api,
            threadId,
            memberIdSet,
            metaMap,
            expectedTotalMembers
        );

        return {
            memberIds: [...memberIdSet],
            metaMap,
            expectedTotalMembers,
        };
    } catch (error) {
        console.error("Lỗi lấy danh sách thành viên nhóm:", error);
        return { memberIds: [], metaMap: new Map(), expectedTotalMembers: 0 };
    }
}

async function enrichGroupMemberMeta(api, memberIds, metaMap) {
    const unresolvedIds = memberIds.filter((uid) => {
        const current = metaMap.get(uid) || {};
        return !current.displayName || !current.avatarUrl;
    });

    if (unresolvedIds.length === 0) return;

    // Run chunks in parallel (3 chunks at a time, larger chunk size = fewer API calls)
    const chunkSize = 100;  // Increased from 50 - no limit in ZCA-JS docs
    const chunks = chunkArray(unresolvedIds, chunkSize);
    
    for (let i = 0; i < chunks.length; i += 3) {
        const batchPromises = [];
        
        for (let j = 0; j < 3 && i + j < chunks.length; j++) {
            batchPromises.push(
                (async () => {
                    try {
                        const memberInfo = await api.getGroupMembersInfo(chunks[i + j]);
                        const profiles = memberInfo?.profiles || {};
                        for (const [rawId, profile] of Object.entries(profiles)) {
                            const uid = normalizeMemberId(profile?.id || rawId);
                            if (!uid) continue;
                            upsertMemberMeta(metaMap, uid, profile);
                        }
                    } catch (error) {
                        console.error(`Lỗi lấy profile thành viên nhóm (batch ${j + 1}):`, error);
                    }
                })()
            );
        }

        await Promise.all(batchPromises);
    }
}

async function syncMembersToDatabase(User, threadId, memberIds, metaMap) {
    if (memberIds.length === 0) return;

    const now = new Date();
    const vnParts = getVNDateParts(now);
    const operations = memberIds.map((uid) => {
        const displayName = metaMap.get(uid)?.displayName || "";
        const avatarUrl = metaMap.get(uid)?.avatarUrl || "";
        const setOnInsert = {
            groupId: threadId,
            userId: uid,
            msgCount: 0,
            totalMsgCount: 0,
            dailyMsgCount: 0,
            monthlyMsgCount: 0,
            dayKey: vnParts.dayKey,
            monthKey: vnParts.monthKey,
            joinDate: now,
        };

        const update = { $setOnInsert: setOnInsert };
        if (displayName || avatarUrl) {
            update.$set = {};
            if (displayName) {
                update.$set.displayName = displayName;
            }
            if (avatarUrl) {
                update.$set.avatarUrl = avatarUrl;
            }
        }

        return {
            updateOne: {
                filter: { groupId: threadId, userId: uid },
                update,
                upsert: true,
            },
        };
    });

    for (const chunk of chunkArray(operations, 500)) {
        try {
            await User.bulkWrite(chunk, { ordered: false });
        } catch (error) {
            console.error("Lỗi đồng bộ thành viên vào database:", error);
        }
    }
}

async function loadWeeklyCountMap(threadId, weekInfo, currentDayKey) {
    const map = new Map();
    const safeWeekKey = String(weekInfo?.weekKey || "").trim();
    const safeWeekStart = String(weekInfo?.weekStartDayKey || "").trim();
    const safeWeekEnd = String(weekInfo?.weekEndDayKey || "").trim();
    const safeCurrentDayKey = String(currentDayKey || "").trim();
    if (!safeWeekKey) return map;

    try {
        let rows = await UserWeeklyMessage.find({
            groupId: threadId,
            weekKey: safeWeekKey,
        })
            .select("userId msgCount")
            .lean();

        if (
            (!rows || rows.length === 0) &&
            safeWeekStart &&
            safeWeekEnd &&
            safeCurrentDayKey
        ) {
            const fallbackRows = await UserDailyMessage.aggregate([
                {
                    $match: {
                        groupId: threadId,
                        dayKey: {
                            $gte: safeWeekStart,
                            $lte: safeCurrentDayKey,
                        },
                    },
                },
                {
                    $group: {
                        _id: "$userId",
                        msgCount: { $sum: "$msgCount" },
                        lastMessageAt: { $max: "$lastMessageAt" },
                    },
                },
            ]);

            if (Array.isArray(fallbackRows) && fallbackRows.length > 0) {
                const now = new Date();
                const operations = [];
                for (const row of fallbackRows) {
                    const uid = normalizeMemberId(row?._id);
                    if (!uid) continue;

                    operations.push({
                        updateOne: {
                            filter: { groupId: threadId, userId: uid, weekKey: safeWeekKey },
                            update: {
                                $set: {
                                    msgCount: Number(row?.msgCount) || 0,
                                    weekStartDayKey: safeWeekStart,
                                    weekEndDayKey: safeWeekEnd,
                                    lastMessageAt: row?.lastMessageAt || null,
                                },
                                $setOnInsert: {
                                    groupId: threadId,
                                    userId: uid,
                                    weekKey: safeWeekKey,
                                    createdAt: now,
                                },
                            },
                            upsert: true,
                        },
                    });
                }

                if (operations.length > 0) {
                    try {
                        await UserWeeklyMessage.bulkWrite(operations, { ordered: false });
                    } catch (error) {
                        console.error(
                            "[xhchat] Lỗi backfill dữ liệu tuần từ bảng ngày:",
                            error?.message || error
                        );
                    }
                }

                rows = fallbackRows.map((row) => ({
                    userId: normalizeMemberId(row?._id),
                    msgCount: Number(row?.msgCount) || 0,
                }));
            }
        }

        for (const row of rows || []) {
            const uid = normalizeMemberId(row?.userId);
            if (!uid) continue;
            const count = Number(row?.msgCount) || 0;
            const current = Number(map.get(uid)) || 0;
            map.set(uid, current + count);
        }
    } catch (error) {
        console.error("[xhchat] Lỗi lấy dữ liệu xếp hạng tuần:", error?.message || error);
    }

    return map;
}

function toTimeValue(dateLike) {
    if (!dateLike) return Number.MAX_SAFE_INTEGER;
    const time = new Date(dateLike).getTime();
    return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function getRankingScore(user, rankingType, dayKey, monthKey, weeklyCountMap = new Map()) {
    if (rankingType === "week") {
        const uid = normalizeMemberId(user?.userId);
        return Number(weeklyCountMap.get(uid)) || 0;
    }

    if (rankingType === "total") {
        return Number(user?.totalMsgCount) || 0;
    }

    if (rankingType === "month") {
        if (String(user?.monthKey || "") !== String(monthKey || "")) return 0;
        return Number(user?.monthlyMsgCount) || 0;
    }

    if (String(user?.dayKey || "") !== String(dayKey || "")) return 0;
    return Number(user?.dailyMsgCount) || 0;
}

function buildRankingUsers(users, memberIds, metaMap, options = {}) {
    const rankingType = String(options.rankingType || "day").toLowerCase();
    const dayKey = String(options.dayKey || "");
    const monthKey = String(options.monthKey || "");
    const weeklyCountMap = options.weeklyCountMap instanceof Map ? options.weeklyCountMap : new Map();
    const byUser = new Map();

    for (const user of users) {
        const uid = normalizeMemberId(user?.userId);
        if (!uid) continue;

        const msgCount = getRankingScore(
            user,
            rankingType,
            dayKey,
            monthKey,
            weeklyCountMap
        );
        const incomingDisplayName = pickDisplayName(user);
        const existing = byUser.get(uid);

        if (!existing) {
            byUser.set(uid, {
                userId: uid,
                displayName: incomingDisplayName || metaMap.get(uid)?.displayName || "",
                avatarUrl: metaMap.get(uid)?.avatarUrl || "",
                ingameName: String(user?.ingameName || "").trim(),
                msgCount,
                joinDate: user?.joinDate || null,
            });
            continue;
        }

        if (rankingType === "week") {
            existing.msgCount = Math.max(existing.msgCount, msgCount);
        } else {
            existing.msgCount += msgCount;
        }
        if (!existing.displayName && incomingDisplayName) {
            existing.displayName = incomingDisplayName;
        }
        if (!existing.avatarUrl && metaMap.get(uid)?.avatarUrl) {
            existing.avatarUrl = metaMap.get(uid).avatarUrl;
        }
        if (!existing.ingameName && String(user?.ingameName || "").trim()) {
            existing.ingameName = String(user.ingameName).trim();
        }

        const existingJoinTime = toTimeValue(existing.joinDate);
        const incomingJoinTime = toTimeValue(user?.joinDate);
        if (incomingJoinTime < existingJoinTime) {
            existing.joinDate = user?.joinDate || null;
        }
    }

    for (const uid of memberIds) {
        if (!byUser.has(uid)) {
            byUser.set(uid, {
                userId: uid,
                displayName: metaMap.get(uid)?.displayName || "",
                avatarUrl: metaMap.get(uid)?.avatarUrl || "",
                ingameName: "",
                msgCount: rankingType === "week" ? Number(weeklyCountMap.get(uid)) || 0 : 0,
                joinDate: null,
            });
        }
    }

    return [...byUser.values()].sort((a, b) => {
        if (b.msgCount !== a.msgCount) return b.msgCount - a.msgCount;

        const joinDiff = toTimeValue(a.joinDate) - toTimeValue(b.joinDate);
        if (joinDiff !== 0) return joinDiff;

        return String(a.userId).localeCompare(String(b.userId));
    });
}

function getRankingMeta(rankingType, vnParts, weekInfo, vnNowLabel) {
    if (rankingType === "total") {
        return {
            rankingType: "total",
            rankingTitle: "XẾP HẠNG CHAT TỔNG",
            periodLabel: "Mốc: Tích lũy toàn thời gian",
            replyLabel: "Bảng xếp hạng chat tổng",
        };
    }

    if (rankingType === "month") {
        return {
            rankingType: "month",
            rankingTitle: "XẾP HẠNG CHAT THÁNG",
            periodLabel: `Tháng: ${vnParts.monthLabel}`,
            replyLabel: `Bảng xếp hạng chat tháng ${vnParts.monthLabel}`,
        };
    }

    if (rankingType === "week") {
        return {
            rankingType: "week",
            rankingTitle: "XẾP HẠNG CHAT TUẦN",
            periodLabel: `Từ thứ 2 ngày ${weekInfo.weekStartLabel} đến ${vnNowLabel} (giờ Việt Nam)`,
            replyLabel: `Bảng xếp hạng chat tuần từ thứ 2 ${weekInfo.weekStartLabel}`,
        };
    }

    return {
        rankingType: "day",
        rankingTitle: "XẾP HẠNG CHAT NGÀY",
        periodLabel: `Ngày ${vnParts.dayLabel} - Ngày #${Number(vnParts.day || 0)} (reset 0h VN)`,
        replyLabel: `Bảng xếp hạng chat ngày ${vnParts.dayLabel}`,
    };
}

async function handleXepHangChatCommand(api, message, threadId, User, options = {}) {
    const messageType = Number(message?.type) || 1;
    const now = new Date();
    const vnParts = getVNDateParts(now);
    const weekInfo = getVNWeekInfo(now);
    const vnNowLabel = getVNDateTimeFormatted(now);
    const rankingType = String(options?.rankingType || "day").toLowerCase();
    const rankingMeta = getRankingMeta(rankingType, vnParts, weekInfo, vnNowLabel);
    const botUserId = String(options?.botUserId || "");

    const { memberIds, metaMap, expectedTotalMembers } = await loadGroupMembers(api, threadId);
    
    // Run enrichment and DB sync in parallel (they're independent)
    await Promise.all([
        enrichGroupMemberMeta(api, memberIds, metaMap),
        syncMembersToDatabase(User, threadId, memberIds, metaMap),
    ]);

    const query = { groupId: threadId };
    if (memberIds.length > 0) {
        query.userId = { $in: memberIds };
    }

    const [users, weeklyCountMap] = await Promise.all([
        User.find(query).lean(),
        rankingMeta.rankingType === "week"
            ? loadWeeklyCountMap(threadId, weekInfo, vnParts.dayKey)
            : Promise.resolve(new Map()),
    ]);

    const rankingUsers = buildRankingUsers(users, memberIds, metaMap, {
        rankingType: rankingMeta.rankingType,
        dayKey: vnParts.dayKey,
        monthKey: vnParts.monthKey,
        weeklyCountMap,
    });

    const normalizedBotUserId = normalizeMemberId(botUserId);
    const filteredRankingUsers = normalizedBotUserId
        ? rankingUsers.filter((user) => normalizeMemberId(user?.userId) !== normalizedBotUserId)
        : rankingUsers;

    console.log(
        `[XEPHANG] mode=${rankingMeta.rankingType} group=${threadId} expected=${expectedTotalMembers || 0} loaded=${memberIds.length} ranking=${rankingUsers.length} rankingNoBot=${filteredRankingUsers.length}`
    );

    if (filteredRankingUsers.length === 0) {
        await api.sendMessage(
            { msg: "Chưa có dữ liệu chat trong nhóm này." },
            threadId,
            Number(message?.type) || 1
        );
        return;
    }

    const resolvedMetaMap = await resolveMemberMeta(
        api,
        threadId,
        filteredRankingUsers,
        User,
        metaMap
    );

    const ranking = filteredRankingUsers.map((user, index) => {
        const uid = String(user.userId);
        const meta = resolvedMetaMap.get(uid) || {};

        return {
            rank: index + 1,
            userId: uid,
            displayName: normalizeDisplayName(user.displayName || meta.displayName, uid),
            avatarUrl: user.avatarUrl || meta.avatarUrl || "",
            ingameName: user.ingameName || "",
            msgCount: Number(user.msgCount) || 0,
        };
    });

    const totalMsgCount = ranking.reduce((sum, user) => sum + (Number(user.msgCount) || 0), 0);
    const pageSize = 10;
    const totalPages = Math.ceil(ranking.length / pageSize);
    const hasBotInMemberList =
        normalizedBotUserId &&
        memberIds.some((uid) => normalizeMemberId(uid) === normalizedBotUserId);
    const estimatedMembers = Math.max(expectedTotalMembers || 0, memberIds.length);
    const totalMembers = Math.max(
        ranking.length,
        Math.max(0, estimatedMembers - (hasBotInMemberList ? 1 : 0))
    );
    const outputPaths = [];

    try {
        const pageData = [];
        for (let i = 0; i < ranking.length; i += pageSize) {
            const pageRows = ranking.slice(i, i + pageSize);
            const page = Math.floor(i / pageSize) + 1;
            pageData.push({
                pageRows,
                page,
                totalPages,
                totalMembers,
                totalMsgCount,
                rankingTitle: rankingMeta.rankingTitle,
                periodLabel: rankingMeta.periodLabel,
                fileName: `xephang-${threadId}-${page}-${Date.now()}.png`,
            });
        }

        // Generate images in parallel (2 at a time to control resource usage)
        for (let i = 0; i < pageData.length; i += 2) {
            const batchPromises = [
                createChatRankingImage(pageData[i].pageRows, {
                    page: pageData[i].page,
                    totalPages: pageData[i].totalPages,
                    totalMembers: pageData[i].totalMembers,
                    totalMsgCount: pageData[i].totalMsgCount,
                    rankingTitle: pageData[i].rankingTitle,
                    periodLabel: pageData[i].periodLabel,
                    fileName: pageData[i].fileName,
                })
            ];

            if (i + 1 < pageData.length) {
                batchPromises.push(
                    createChatRankingImage(pageData[i + 1].pageRows, {
                        page: pageData[i + 1].page,
                        totalPages: pageData[i + 1].totalPages,
                        totalMembers: pageData[i + 1].totalMembers,
                        totalMsgCount: pageData[i + 1].totalMsgCount,
                        rankingTitle: pageData[i + 1].rankingTitle,
                        periodLabel: pageData[i + 1].periodLabel,
                        fileName: pageData[i + 1].fileName,
                    })
                );
            }

            const batchResults = await Promise.all(batchPromises);
            outputPaths.push(...batchResults);
        }

        await api.sendMessage(
            {
                msg: `${rankingMeta.replyLabel} (${formatCount(totalMembers)} thành viên) - ${totalPages} ảnh`,
                attachments: outputPaths,
            },
            threadId,
            messageType
        );
    } finally {
        for (const outputPath of outputPaths) {
            if (outputPath && fs.existsSync(outputPath)) {
                try {
                    fs.unlinkSync(outputPath);
                } catch (_) {}
            }
        }
    }
}

module.exports = {
    handleXepHangChatCommand,
};
