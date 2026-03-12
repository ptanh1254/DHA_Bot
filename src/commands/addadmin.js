function normalizeId(rawId) {
    if (rawId === null || rawId === undefined) return "";
    return String(rawId).replace(/_0$/, "").trim();
}

function normalizeName(rawName) {
    return String(rawName || "")
        .replace(/^@+/, "")
        .trim();
}

function getMentionedTargets(message) {
    const mentions = Array.isArray(message?.data?.mentions) ? message.data.mentions : [];
    const content = typeof message?.data?.content === "string" ? message.data.content : "";
    const uniqueTargets = new Map();

    for (const mention of mentions) {
        const uid = normalizeId(mention?.uid);
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
            displayName: displayName || "Nguoi dung",
        });
    }

    return [...uniqueTargets.values()];
}

async function isGroupAdmin(api, threadId, userId) {
    try {
        const response = await api.getGroupInfo(threadId);
        const gridInfoMap = response?.gridInfoMap || {};
        const groupInfo = gridInfoMap[threadId] || Object.values(gridInfoMap)[0];
        if (!groupInfo) return false;

        const actorId = normalizeId(userId);
        if (!actorId) return false;

        const creatorId = normalizeId(
            groupInfo?.creatorId || groupInfo?.ownerId || groupInfo?.creator
        );
        if (creatorId && creatorId === actorId) return true;

        const adminIds = Array.isArray(groupInfo?.adminIds) ? groupInfo.adminIds : [];
        return adminIds.map(normalizeId).includes(actorId);
    } catch (error) {
        console.error("Khong the kiem tra quyen admin cho !addadmin:", error);
        return false;
    }
}

function formatTargetNames(targets) {
    return targets.map((target) => target.displayName).join(", ");
}

async function handleAddAdminCommand(
    api,
    message,
    threadId,
    GroupKeyMember,
    prefix = "!"
) {
    const actorId = String(message?.data?.uidFrom || "").trim();
    const allowed = await isGroupAdmin(api, threadId, actorId);
    if (!allowed) {
        await api.sendMessage(
            { msg: "Lenh nay chi admin/chu nhom moi dung duoc." },
            threadId,
            message.type
        );
        return;
    }

    const targets = getMentionedTargets(message);
    if (targets.length === 0) {
        await api.sendMessage(
            {
                msg: `Hay tag nguoi can them quyen. Vi du: ${prefix}addadmin @TenNguoiDung`,
            },
            threadId,
            message.type
        );
        return;
    }

    const operations = targets.map((target) => ({
        updateOne: {
            filter: { groupId: threadId, userId: target.userId },
            update: {
                $set: {
                    userName: target.displayName,
                    verifiedAt: new Date(),
                },
                $setOnInsert: {
                    groupId: threadId,
                    userId: target.userId,
                },
            },
            upsert: true,
        },
    }));

    await GroupKeyMember.bulkWrite(operations, { ordered: false });

    await api.sendMessage(
        {
            msg: [
                "Da them vao danh sach duoc dung bot:",
                formatTargetNames(targets),
            ].join("\n"),
        },
        threadId,
        message.type
    );
}

module.exports = {
    handleAddAdminCommand,
};
