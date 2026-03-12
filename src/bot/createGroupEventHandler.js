const fs = require("fs");

const { createWelcomeImage } = require("../design/welcome/renderer");
const { createKickEventImage } = require("../design/kick/renderer");

function normalizeUserId(rawId) {
    const value = String(rawId || "").trim();
    if (!value) return "";

    const withVersion = value.match(/^(.+)_\d+$/);
    if (withVersion?.[1]) return withVersion[1].trim();

    return value.replace(/_0$/, "").trim();
}

function pickDisplayName(profile, fallbackUserId) {
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

    return `UID ${fallbackUserId}`;
}

function pickAvatar(profile) {
    const candidates = [profile?.avatar, profile?.avatar_120, profile?.avatar_240, profile?.avatar_25];

    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }

    return "";
}

function toSeedMember(rawMember) {
    if (typeof rawMember === "string" || typeof rawMember === "number") {
        const userId = normalizeUserId(rawMember);
        if (!userId) return null;

        return {
            userId,
            displayName: `UID ${userId}`,
            avatar: "",
        };
    }

    if (!rawMember || typeof rawMember !== "object") return null;

    const userId = normalizeUserId(
        rawMember.id || rawMember.uid || rawMember.userId || rawMember.memberId
    );
    if (!userId) return null;

    return {
        userId,
        displayName: pickDisplayName(rawMember, userId),
        avatar: pickAvatar(rawMember),
    };
}

function extractMembersFromEvent(groupEvent, type) {
    const rawMembers = Array.isArray(groupEvent?.data?.updateMembers)
        ? groupEvent.data.updateMembers
        : [];
    const members = rawMembers.map(toSeedMember).filter(Boolean);

    if (members.length === 0 && type === "leave") {
        const fallback = toSeedMember(groupEvent?.data?.sourceId || groupEvent?.data?.memberId);
        if (fallback) members.push(fallback);
    }

    if (members.length === 0 && type === "remove_member") {
        const fallback = toSeedMember(
            groupEvent?.data?.memberId ||
                groupEvent?.data?.targetId ||
                groupEvent?.data?.sourceId
        );
        if (fallback) members.push(fallback);
    }

    const byId = new Map();
    for (const member of members) {
        if (!byId.has(member.userId)) {
            byId.set(member.userId, member);
        }
    }

    return [...byId.values()];
}

function extractActorId(groupEvent) {
    const data = groupEvent?.data || {};
    const candidates = [
        data.actorId,
        data.adminId,
        data.inviterId,
        data.operatorId,
        data.sourceId,
        data.uidFrom,
        data.fromUid,
        data.creatorId,
        groupEvent?.sourceId,
    ];

    for (const candidate of candidates) {
        const id = normalizeUserId(candidate);
        if (id) return id;
    }

    return "";
}

async function resolveActorMeta(api, groupEvent) {
    const actorId = extractActorId(groupEvent);
    if (!actorId) {
        return { userId: "", displayName: "" };
    }

    try {
        const info = await api.getUserInfo(actorId);
        const changedProfiles = info?.changed_profiles || {};
        const profile = changedProfiles[actorId] || Object.values(changedProfiles)[0];
        if (profile && typeof profile === "object") {
            return {
                userId: actorId,
                displayName: pickDisplayName(profile, actorId),
            };
        }
    } catch (_) {}

    return {
        userId: actorId,
        displayName: `UID ${actorId}`,
    };
}

async function fetchMemberProfile(api, userId, seed = {}) {
    const merged = { ...seed };

    try {
        const info = await api.getUserInfo(String(userId));
        const changedProfiles = info?.changed_profiles || {};
        const profile = changedProfiles[userId] || Object.values(changedProfiles)[0];
        if (profile && typeof profile === "object") {
            Object.assign(merged, profile);
        }
    } catch (_) {}

    return {
        userId: String(userId),
        displayName: pickDisplayName(merged, userId),
        avatar: pickAvatar(merged),
    };
}

async function upsertJoinMeta(User, threadId, memberProfile, actorMeta) {
    const now = new Date();
    const update = {
        $setOnInsert: {
            groupId: threadId,
            userId: memberProfile.userId,
            msgCount: 0,
            totalMsgCount: 0,
            joinDate: now,
        },
        $set: {
            displayName: memberProfile.displayName || `UID ${memberProfile.userId}`,
            avatarUrl: memberProfile.avatar || "",
        },
    };

    if (actorMeta?.userId) {
        update.$set.addedByUserId = actorMeta.userId;
        update.$set.addedByName =
            actorMeta.userId === memberProfile.userId
                ? "T\u1ef1 tham gia"
                : actorMeta.displayName || `UID ${actorMeta.userId}`;
    }

    await User.findOneAndUpdate(
        { groupId: threadId, userId: memberProfile.userId },
        update,
        {
            upsert: true,
            setDefaultsOnInsert: true,
        }
    );
}

function buildLeaveKickMessage(type, members, actorMeta, actorOverrideByUserId = new Map()) {
    const actorName = actorMeta?.displayName || (actorMeta?.userId ? `UID ${actorMeta.userId}` : "");

    if (type === "remove_member") {
        const lines = members.map((member, index) => {
            const name = member.displayName || `UID ${member.userId}`;
            const actorOverride = actorOverrideByUserId.get(member.userId);
            const effectiveActorName = actorOverride?.actorName || actorName;
            const effectiveActorId = actorOverride?.actorUserId || actorMeta?.userId || "";

            if (effectiveActorId && effectiveActorId !== member.userId && effectiveActorName) {
                return `#${index + 1} ${name}\n\u0110\u00e3 b\u1ecb ${effectiveActorName} s\u00fat kh\u1ecfi nh\u00f3m DHA.`;
            }
            return `#${index + 1} ${name}\n\u0110\u00e3 b\u1ecb s\u00fat kh\u1ecfi nh\u00f3m DHA b\u1edfi m\u1ed9t th\u1ebf l\u1ef1c b\u00ed \u1ea9n.`;
        });
        return ["\ud83d\udea8 Kicked Out Member \ud83d\udea8", ...lines].join("\n");
    }

    const leaveLines = members.map((member) => {
        const name = member.displayName || `UID ${member.userId}`;
        return `- ${name} \u0111\u00e3 x\u00e1ch d\u00e9p ra v\u1ec1, h\u1eb9n ng\u00e0y t\u00e1i xu\u1ea5t!`;
    });
    return ["\ud83d\udeaa Th\u00f4ng b\u00e1o r\u1eddi nh\u00f3m", ...leaveLines].join("\n");
}

function resolveEffectiveActor(memberUserId, actorMeta, actorOverrideByUserId = new Map()) {
    const actorOverride = actorOverrideByUserId.get(memberUserId);
    const actorUserId = actorOverride?.actorUserId || actorMeta?.userId || "";
    const actorName =
        actorOverride?.actorName ||
        actorMeta?.displayName ||
        (actorUserId ? `UID ${actorUserId}` : "");

    return {
        userId: actorUserId,
        displayName: actorName,
    };
}

async function sendWelcomeForMember(api, threadId, memberProfile) {
    let outputPath = "";
    try {
        outputPath = await createWelcomeImage(memberProfile, {
            fileName: `welcome-${threadId}-${memberProfile.userId}-${Date.now()}.png`,
        });

        await api.sendMessage(
            {
                msg: `Ch\u00e0o m\u1eebng ${memberProfile.displayName} \u0111\u1ebfn v\u1edbi khu gi\u1ea3i tr\u00ed DHA`,
                attachments: [outputPath],
            },
            threadId,
            1
        );
    } finally {
        if (outputPath && fs.existsSync(outputPath)) {
            try {
                fs.unlinkSync(outputPath);
            } catch (_) {}
        }
    }
}

async function sendKickImageBundle(
    api,
    threadId,
    memberProfiles,
    actorMeta,
    actorOverrideByUserId
) {
    const actorProfileCache = new Map();

    try {
        for (const member of memberProfiles) {
            const effectiveActor = resolveEffectiveActor(
                member.userId,
                actorMeta,
                actorOverrideByUserId
            );

            let kickerProfile = {
                userId: effectiveActor.userId,
                displayName: effectiveActor.displayName || "Người kick bí ẩn",
                avatar: "",
            };

            if (effectiveActor.userId) {
                if (actorProfileCache.has(effectiveActor.userId)) {
                    kickerProfile = actorProfileCache.get(effectiveActor.userId);
                } else {
                    const fetched = await fetchMemberProfile(api, effectiveActor.userId, {
                        userId: effectiveActor.userId,
                        displayName: effectiveActor.displayName,
                    });
                    kickerProfile = fetched;
                    actorProfileCache.set(effectiveActor.userId, fetched);
                }
            }

            const actionText = `${member.displayName} đã bị ${kickerProfile.displayName} sút khỏi nhóm DHA`;
            let outputPath = "";
            try {
                outputPath = await createKickEventImage(
                    {
                        kicker: kickerProfile,
                        target: member,
                        actionText,
                    },
                    {
                        fileName: `kick-${threadId}-${member.userId}-${Date.now()}.png`,
                    }
                );

                await api.sendMessage(
                    {
                        msg: `🦶 ${member.displayName} đã lên bảng phong thần.`,
                        attachments: [outputPath],
                    },
                    threadId,
                    1
                );
            } finally {
                if (outputPath && fs.existsSync(outputPath)) {
                    try {
                        fs.unlinkSync(outputPath);
                    } catch (_) {}
                }
            }
        }
    } catch (error) {
        console.error("Lỗi tạo/gửi ảnh kick:", error);
        try {
            await api.sendMessage(
                {
                    msg: "⚠️ Có lỗi khi tạo ảnh kick, bot chỉ gửi text thông báo.",
                },
                threadId,
                1
            );
        } catch (_) {}
    }
}

function createGroupEventHandler({ api, GroupSetting, User, kickIntentStore }) {
    return async function onGroupEvent(groupEvent) {
        try {
            const type = String(groupEvent?.type || "").toLowerCase();
            if (!["join", "leave", "remove_member"].includes(type)) {
                return;
            }

            const threadId = String(groupEvent?.threadId || groupEvent?.data?.groupId || "").trim();
            if (!threadId) return;

            const members = extractMembersFromEvent(groupEvent, type);
            if (members.length === 0) return;

            const [setting, actorMeta] = await Promise.all([
                GroupSetting.findOne({ groupId: threadId }).lean(),
                resolveActorMeta(api, groupEvent),
            ]);

            if (type === "join") {
                for (const member of members) {
                    const profile = await fetchMemberProfile(api, member.userId, member);
                    await upsertJoinMeta(User, threadId, profile, actorMeta);

                    if (setting?.welcomeEnabled === true) {
                        await sendWelcomeForMember(api, threadId, profile);
                    }
                }
                return;
            }

            if (setting?.kickEnabled !== true) return;

            const actorOverrideByUserId = new Map();
            if (type === "remove_member" && kickIntentStore) {
                for (const member of members) {
                    const actorOverride = kickIntentStore.consumeKickActor(
                        threadId,
                        member.userId
                    );
                    if (actorOverride) {
                        actorOverrideByUserId.set(member.userId, actorOverride);
                    }
                }
            }

            const memberProfiles = await Promise.all(
                members.map((member) => fetchMemberProfile(api, member.userId, member))
            );
            const notifyMsg = buildLeaveKickMessage(
                type,
                memberProfiles,
                actorMeta,
                actorOverrideByUserId
            );
            await api.sendMessage({ msg: notifyMsg }, threadId, 1);

            if (type === "remove_member") {
                await sendKickImageBundle(
                    api,
                    threadId,
                    memberProfiles,
                    actorMeta,
                    actorOverrideByUserId
                );
            }
        } catch (error) {
            console.error("L\u1ed7i x\u1eed l\u00fd group_event:", error);
        }
    };
}

module.exports = {
    createGroupEventHandler,
};
