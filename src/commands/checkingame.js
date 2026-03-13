function normalizeId(rawId) {
    if (rawId === null || rawId === undefined) return "";
    return String(rawId).replace(/_\d+$/, "").trim();
}

function chunkArray(values, chunkSize) {
    const chunks = [];
    for (let i = 0; i < values.length; i += chunkSize) {
        chunks.push(values.slice(i, i + chunkSize));
    }
    return chunks;
}

function toMentionUid(rawId, normalizedId) {
    const source = String(rawId || "").trim();
    if (/_.+$/.test(source)) return source;

    const normalized = normalizeId(normalizedId || source);
    if (!normalized) return source;
    return `${normalized}_0`;
}

function pickDisplayName(profile) {
    const candidates = [
        profile?.displayName,
        profile?.dName,
        profile?.zaloName,
        profile?.name,
        profile?.username,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }

    return "";
}

function toMemberSeed(rawMember) {
    if (!rawMember || typeof rawMember !== "object") return null;

    const rawId = String(rawMember.userId || rawMember.uid || rawMember.id || "").trim();
    const normalizedId = normalizeId(rawId);
    if (!rawId && !normalizedId) return null;

    return {
        rawId: rawId || normalizedId,
        normalizedId,
        mentionUid: toMentionUid(rawId || normalizedId, normalizedId),
        displayName: pickDisplayName(rawMember),
    };
}

function upsertMember(memberByNormalized, payload) {
    const normalizedId = normalizeId(payload?.normalizedId || payload?.rawId || payload?.id);
    if (!normalizedId) return;

    const rawId = String(payload?.rawId || payload?.id || normalizedId).trim();
    const displayName = String(payload?.displayName || "").trim();
    const current = memberByNormalized.get(normalizedId) || {
        rawId: rawId || normalizedId,
        normalizedId,
        mentionUid: toMentionUid(rawId || normalizedId, normalizedId),
        displayName: "",
    };

    if (!current.rawId && rawId) current.rawId = rawId;
    current.mentionUid = toMentionUid(current.rawId || rawId || normalizedId, normalizedId);
    if (!current.displayName && displayName) current.displayName = displayName;

    memberByNormalized.set(normalizedId, current);
}

function buildMentionMessage(members) {
    const mentions = [];
    let msg = "Nh\u1eefng b\u1ea1n ch\u01b0a c\u1eadp nh\u1eadt ingame, v\u00e0o set l\u1eb9 nha:";

    for (const member of members) {
        const safeName = String(member.displayName || "Th\u00e0nh vi\u00ean")
            .replace(/\n/g, " ")
            .trim();
        const mentionText = `@${safeName}`;
        const prefix = " ";
        const pos = msg.length + 1;

        msg += `${prefix}${mentionText}`;
        mentions.push({
            uid: String(
                member.mentionUid ||
                    toMentionUid(member.rawId || member.normalizedId, member.normalizedId)
            ),
            pos,
            len: mentionText.length,
        });
    }

    return { msg, mentions };
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

async function loadMembersFromGroupInfo(api, threadId) {
    const groupInfo = await fetchGroupInfoSafe(api, threadId);
    const memberByNormalized = new Map();

    if (!groupInfo) {
        return {
            memberByNormalized,
            expectedTotalMembers: 0,
        };
    }

    const idLists = [groupInfo.memberIds, groupInfo.memVerList, groupInfo.adminIds];
    for (const list of idLists) {
        if (!Array.isArray(list)) continue;
        for (const rawId of list) {
            upsertMember(memberByNormalized, { rawId: String(rawId || "").trim() });
        }
    }

    if (Array.isArray(groupInfo.currentMems)) {
        for (const rawMember of groupInfo.currentMems) {
            const member = toMemberSeed(rawMember);
            if (!member) continue;
            upsertMember(memberByNormalized, member);
        }
    }

    return {
        memberByNormalized,
        expectedTotalMembers: Number(groupInfo.totalMember) || memberByNormalized.size,
    };
}

async function loadMembersFromGroupLink(api, threadId, memberByNormalized, expectedTotalMembers) {
    if (!Number.isFinite(expectedTotalMembers) || expectedTotalMembers <= memberByNormalized.size) {
        return;
    }

    try {
        const detail = await api.getGroupLinkDetail(threadId);
        const link = detail?.link;
        if (!link) return;

        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 200 && memberByNormalized.size < expectedTotalMembers) {
            const info = await api.getGroupLinkInfo({ link, memberPage: page });
            const currentMems = Array.isArray(info?.currentMems) ? info.currentMems : [];

            for (const rawMember of currentMems) {
                const member = toMemberSeed(rawMember);
                if (!member) continue;
                upsertMember(memberByNormalized, member);
            }

            hasMore = Number(info?.hasMoreMember) === 1;
            page += 1;
        }
    } catch (error) {
        console.error("L\u1ed7i fallback l\u1ea5y th\u00e0nh vi\u00ean qua group link:", error);
    }
}

async function hydrateMemberNames(api, members) {
    const byNormalized = new Map();
    for (const member of members) {
        if (!member?.normalizedId) continue;
        byNormalized.set(member.normalizedId, member);
    }

    let unresolved = members
        .filter((member) => !String(member?.displayName || "").trim())
        .map((member) => member.normalizedId);

    if (unresolved.length === 0) return;

    for (const chunk of chunkArray(unresolved, 50)) {
        try {
            const info = await api.getGroupMembersInfo(chunk);
            const profiles = info?.profiles || {};
            for (const [rawId, profile] of Object.entries(profiles)) {
                const uid = normalizeId(profile?.id || rawId);
                if (!uid) continue;
                const current = byNormalized.get(uid);
                if (!current) continue;

                const displayName = pickDisplayName(profile);
                if (displayName) current.displayName = displayName;
            }
        } catch (_) {}
    }

    unresolved = members
        .filter((member) => !String(member?.displayName || "").trim())
        .map((member) => member.normalizedId);

    for (const chunk of chunkArray(unresolved, 20)) {
        try {
            const info = await api.getUserInfo(chunk);
            const changedProfiles = info?.changed_profiles || {};
            for (const [rawId, profile] of Object.entries(changedProfiles)) {
                const uid = normalizeId(profile?.id || rawId);
                if (!uid) continue;
                const current = byNormalized.get(uid);
                if (!current) continue;

                const displayName = pickDisplayName(profile);
                if (displayName) current.displayName = displayName;
            }
        } catch (_) {}
    }

    for (const member of members) {
        if (!String(member?.displayName || "").trim()) {
            member.displayName = "Th\u00e0nh vi\u00ean";
        }
    }
}

async function handleCheckIngameCommand(api, message, threadId, User) {
    const messageType = Number(message?.type) || 1;
    let loaded = {
        memberByNormalized: new Map(),
        expectedTotalMembers: 0,
    };

    try {
        loaded = await loadMembersFromGroupInfo(api, threadId);
    } catch (error) {
        console.error("L\u1ed7i l\u1ea5y th\u00f4ng tin nh\u00f3m cho !checkingame:", error);
    }

    await loadMembersFromGroupLink(
        api,
        threadId,
        loaded.memberByNormalized,
        loaded.expectedTotalMembers
    );

    const members = [...loaded.memberByNormalized.values()];
    await hydrateMemberNames(api, members);

    if (members.length === 0) {
        await api.sendMessage(
            {
                msg: "Ch\u01b0a l\u1ea5y \u0111\u01b0\u1ee3c danh s\u00e1ch th\u00e0nh vi\u00ean hi\u1ec7n t\u1ea1i c\u1ee7a nh\u00f3m. B\u1ea1n th\u1eed l\u1ea1i sau \u00edt ph\u00fat nha.",
            },
            threadId,
            messageType
        );
        return;
    }

    const rows = await User.find({ groupId: threadId }, { userId: 1, ingameName: 1 }).lean();
    const hasIngameByNormalized = new Map();
    const knownUidByNormalized = new Map();
    for (const row of rows) {
        const userId = String(row?.userId || "").trim();
        const normalizedId = normalizeId(userId);
        if (!normalizedId) continue;
        if (!knownUidByNormalized.has(normalizedId) && userId) {
            knownUidByNormalized.set(normalizedId, userId);
        }
        const ingameName = String(row?.ingameName || "").trim();
        if (ingameName) {
            hasIngameByNormalized.set(normalizedId, ingameName);
        }
    }

    const missing = members
        .filter((member) => !hasIngameByNormalized.has(member.normalizedId))
        .map((member) => {
            const dbUid = knownUidByNormalized.get(member.normalizedId);
            const mentionUid = toMentionUid(dbUid || member.rawId, member.normalizedId);
            return {
                ...member,
                mentionUid,
            };
        });
    if (missing.length === 0) {
        await api.sendMessage(
            {
                msg: "C\u1ea3 nh\u00f3m \u0111\u00e3 c\u1eadp nh\u1eadt ingame \u0111\u1ea7y \u0111\u1ee7 r\u1ed3i, qu\u00e1 tuy\u1ec7t!",
            },
            threadId,
            messageType
        );
        return;
    }

    const MAX_MENTIONS = 20;
    const mentionMembers = missing.slice(0, MAX_MENTIONS);
    const payload = buildMentionMessage(mentionMembers);
    if (missing.length > MAX_MENTIONS) {
        payload.msg += `\n...v\u00e0 c\u00f2n ${missing.length - MAX_MENTIONS} b\u1ea1n n\u1eefa ch\u01b0a c\u1eadp nh\u1eadt.`;
    }

    await api.sendMessage(
        {
            msg: payload.msg,
            mentions: payload.mentions,
        },
        threadId,
        messageType
    );
}

module.exports = {
    handleCheckIngameCommand,
};
