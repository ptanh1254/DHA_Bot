const { getMentionedUserIds, getMessageType, formatUidList, sendMessage } = require("../utils/commonHelpers");
const {
    PROTECTED_OWNER_BLOCK_MESSAGE,
    isProtectedOwnerUid,
} = require("../config/protectedUsers");

function buildKickStatusMessage(prefix, isEnabled) {
    const statusText = isEnabled ? "BAT" : "TAT";
    return [
        `Che do thong bao roi/kick hien tai: ${statusText}`,
        `Dung \`${prefix}kick on\` de bat`,
        `Dung \`${prefix}kick off\` de tat`,
        `Dung \`${prefix}kick @TenNguoiDung\` de moi ra khoi nhom`,
    ].join("\n");
}

async function handleKickCommand(
    api,
    message,
    threadId,
    GroupSetting,
    argsText,
    prefix = "!",
    kickIntentStore = null
) {
    const messageType = getMessageType(message);
    const normalizedArgs = String(argsText || "").trim().toLowerCase();
    const mentionIds = getMentionedUserIds(message);
    const hasMentions = mentionIds.length > 0;
    const protectedMentionIds = mentionIds.filter((uid) => isProtectedOwnerUid(uid));
    const kickableMentionIds = mentionIds.filter((uid) => !isProtectedOwnerUid(uid));
    const protectedLine =
        protectedMentionIds.length > 0
            ? `${formatUidList(protectedMentionIds)}: ${PROTECTED_OWNER_BLOCK_MESSAGE}`
            : "";

    const actorUserId = String(message?.data?.uidFrom || "").trim();
    const actorNameRaw =
        typeof message?.data?.dName === "string" ? message.data.dName.trim() : "";
    const actorName = actorNameRaw || (actorUserId ? `UID ${actorUserId}` : "Nguoi dung bi an");

    if (!normalizedArgs && !hasMentions) {
        const setting = await GroupSetting.findOne({ groupId: threadId }).lean();
        const statusMessage = buildKickStatusMessage(prefix, setting?.kickEnabled !== false);
        await sendMessage(api, { msg: statusMessage }, threadId, messageType);
        return;
    }

    if (!hasMentions && (normalizedArgs === "on" || normalizedArgs === "off")) {
        const shouldEnable = normalizedArgs === "on";
        await GroupSetting.findOneAndUpdate(
            { groupId: threadId },
            { $set: { kickEnabled: shouldEnable } },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        );

        await sendMessage(
            api,
            {
                msg: shouldEnable
                    ? "Da bat thong bao roi/kick cho nhom nay."
                    : "Da tat thong bao roi/kick cho nhom nay.",
            },
            threadId,
            messageType
        );
        return;
    }

    if (!hasMentions) {
        await sendMessage(
            api,
            {
                msg: [
                    "Sai cu phap.",
                    `${prefix}kick: xem trang thai`,
                    `${prefix}kick on/off: bat tat thong bao`,
                    `${prefix}kick @TenNguoiDung: moi nguoi duoc tag ra khoi nhom`,
                ].join("\n"),
            },
            threadId,
            messageType
        );
        return;
    }

    if (protectedMentionIds.length > 0 && kickableMentionIds.length === 0) {
        await sendMessage(api, { msg: PROTECTED_OWNER_BLOCK_MESSAGE }, threadId, messageType);
        return;
    }

    try {
        if (kickIntentStore && actorUserId && kickableMentionIds.length > 0) {
            kickIntentStore.rememberKickRequest(threadId, kickableMentionIds, {
                actorUserId,
                actorName,
            });
        }

        const result = await api.removeUserFromGroup(kickableMentionIds, threadId);
        const errorMembers = Array.isArray(result?.errorMembers)
            ? result.errorMembers.map((id) => String(id))
            : [];
        const failedSet = new Set(errorMembers);
        const successIds = kickableMentionIds.filter((id) => !failedSet.has(id));

        if (kickIntentStore && errorMembers.length > 0) {
            kickIntentStore.clearKickRequest(threadId, errorMembers);
        }

        if (successIds.length > 0 && errorMembers.length === 0) {
            const lines = [`Da kick thanh cong: ${formatUidList(successIds)}.`];
            if (protectedLine) lines.push(protectedLine);
            await sendMessage(api, { msg: lines.join("\n") }, threadId, messageType);
            return;
        }

        if (successIds.length > 0 && errorMembers.length > 0) {
            const lines = [
                `Da kick: ${formatUidList(successIds)}.`,
                `Chua kick duoc: ${formatUidList(errorMembers)}.`,
            ];
            if (protectedLine) lines.push(protectedLine);
            await sendMessage(api, { msg: lines.join("\n") }, threadId, messageType);
            return;
        }

        const fallbackLines = [
            "Chua the moi thanh vien duoc tag ra khoi nhom.",
            "Kiem tra lai quyen admin cua bot va trang thai thanh vien trong nhom.",
        ];
        if (protectedLine) fallbackLines.push(protectedLine);
        await sendMessage(api, { msg: fallbackLines.join("\n") }, threadId, messageType);
    } catch (error) {
        if (kickIntentStore && kickableMentionIds.length > 0) {
            kickIntentStore.clearKickRequest(threadId, kickableMentionIds);
        }
        console.error("Loi command !kick:", error);
        const lines = [
            "Cu sut chua thanh cong.",
            "Bot can quyen admin nhom de thuc hien lenh nay.",
        ];
        if (protectedLine) lines.push(protectedLine);
        await sendMessage(api, { msg: lines.join("\n") }, threadId, messageType);
    }
}

module.exports = {
    handleKickCommand,
};
