const fs = require("fs");

const { createChatRankingImage } = require("../design/chatRanking/renderer");
const { formatCount } = require("../design/chatRanking/template");

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

    for (const row of rows) {
        const uid = String(row.userId);
        const existing = metaMap.get(uid) || {};

        const rowDisplayName = pickDisplayName(row);
        const rowAvatar = pickAvatarUrl(row);

        if (rowDisplayName || rowAvatar) {
            upsertMemberMeta(metaMap, uid, {
                displayName: rowDisplayName,
                avatar: rowAvatar,
            });
        }

        const current = metaMap.get(uid) || {};
        if (!current.displayName || !current.avatarUrl) {
            missingIdSet.add(uid);
        }
    }

    for (const chunk of chunkArray([...missingIdSet], 20)) {
        try {
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

            if (updates.length > 0) {
                await User.bulkWrite(updates, { ordered: false });
            }
        } catch (error) {
            console.error("Lỗi lấy thông tin người dùng cho xếp hạng:", error);
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

        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 200 && memberIdSet.size < expectedTotalMembers) {
            const info = await api.getGroupLinkInfo({ link, memberPage: page });
            const currentMems = Array.isArray(info?.currentMems) ? info.currentMems : [];

            for (const member of currentMems) {
                const uid = normalizeMemberId(member?.id);
                if (!uid) continue;

                memberIdSet.add(uid);
                upsertMemberMeta(metaMap, uid, member);
            }

            hasMore = Number(info?.hasMoreMember) === 1;
            page += 1;
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

    for (const chunk of chunkArray(unresolvedIds, 50)) {
        try {
            const memberInfo = await api.getGroupMembersInfo(chunk);
            const profiles = memberInfo?.profiles || {};

            for (const [rawId, profile] of Object.entries(profiles)) {
                const uid = normalizeMemberId(profile?.id || rawId);
                if (!uid) continue;

                upsertMemberMeta(metaMap, uid, profile);
            }
        } catch (error) {
            console.error("Lỗi lấy profile thành viên nhóm:", error);
        }
    }
}

async function syncMembersToDatabase(User, threadId, memberIds, metaMap) {
    if (memberIds.length === 0) return;

    const now = new Date();
    const operations = memberIds.map((uid) => {
        const displayName = metaMap.get(uid)?.displayName || "";
        const avatarUrl = metaMap.get(uid)?.avatarUrl || "";
        const setOnInsert = {
            groupId: threadId,
            userId: uid,
            msgCount: 0,
            totalMsgCount: 0,
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

function toTimeValue(dateLike) {
    if (!dateLike) return Number.MAX_SAFE_INTEGER;
    const time = new Date(dateLike).getTime();
    return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function buildRankingUsers(users, memberIds, metaMap) {
    const byUser = new Map();

    for (const user of users) {
        const uid = normalizeMemberId(user?.userId);
        if (!uid) continue;

        const msgCount = Number(user?.msgCount) || 0;
        const incomingDisplayName = pickDisplayName(user);
        const existing = byUser.get(uid);

        if (!existing) {
            byUser.set(uid, {
                userId: uid,
                displayName: incomingDisplayName || metaMap.get(uid)?.displayName || "",
                avatarUrl: metaMap.get(uid)?.avatarUrl || "",
                msgCount,
                joinDate: user?.joinDate || null,
            });
            continue;
        }

        existing.msgCount += msgCount;
        if (!existing.displayName && incomingDisplayName) {
            existing.displayName = incomingDisplayName;
        }
        if (!existing.avatarUrl && metaMap.get(uid)?.avatarUrl) {
            existing.avatarUrl = metaMap.get(uid).avatarUrl;
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
                msgCount: 0,
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

async function handleXepHangChatCommand(api, message, threadId, User, botUserId = "") {
    const { memberIds, metaMap, expectedTotalMembers } = await loadGroupMembers(api, threadId);
    await enrichGroupMemberMeta(api, memberIds, metaMap);
    await syncMembersToDatabase(User, threadId, memberIds, metaMap);

    const query = { groupId: threadId };
    if (memberIds.length > 0) {
        query.userId = { $in: memberIds };
    }

    const users = await User.find(query).lean();
    const rankingUsers = buildRankingUsers(users, memberIds, metaMap);
    const normalizedBotUserId = normalizeMemberId(botUserId);
    const filteredRankingUsers = normalizedBotUserId
        ? rankingUsers.filter(
              (user) => normalizeMemberId(user?.userId) !== normalizedBotUserId
          )
        : rankingUsers;
    console.log(
        `[XEPHANG] group=${threadId} expected=${expectedTotalMembers || 0} loaded=${memberIds.length} ranking=${rankingUsers.length} rankingNoBot=${filteredRankingUsers.length}`
    );

    if (filteredRankingUsers.length === 0) {
        await api.sendMessage(
            { msg: "Chưa có dữ liệu chat trong nhóm này." },
            threadId,
            message.type
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
            msgCount: Number(user.msgCount) || 0,
        };
    });

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
        for (let i = 0; i < ranking.length; i += pageSize) {
            const pageRows = ranking.slice(i, i + pageSize);
            const page = Math.floor(i / pageSize) + 1;
            const outputPath = await createChatRankingImage(pageRows, {
                page,
                totalPages,
                totalMembers,
                fileName: `xephang-${threadId}-${page}-${Date.now()}.png`,
            });
            outputPaths.push(outputPath);
        }

        await api.sendMessage(
            {
                msg: `Bảng xếp hạng tương tác (${formatCount(totalMembers)} thành viên) - ${totalPages} ảnh, 10 người/ảnh.`,
                attachments: outputPaths,
            },
            threadId,
            message.type
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


