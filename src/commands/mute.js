const {
    getMentionedTargets,
    getMessageType,
    sendMessage,
    buildErrorMessage,
    formatNameList,
} = require("../utils/commonHelpers");
const {
    PROTECTED_OWNER_BLOCK_MESSAGE,
    isProtectedOwnerUid,
} = require("../config/protectedUsers");

async function handleMuteCommand(api, message, threadId, MutedMember, prefix = "!") {
    const messageType = getMessageType(message);
    const targets = getMentionedTargets(message);
    if (targets.length === 0) {
        await sendMessage(
            api,
            buildErrorMessage("Hãy tag người cần mute", [`${prefix}mute @TenNguoiDung`]),
            threadId,
            messageType
        );
        return;
    }

    const protectedTargets = targets.filter((target) => isProtectedOwnerUid(target.userId));
    const muteableTargets = targets.filter((target) => !isProtectedOwnerUid(target.userId));

    if (protectedTargets.length > 0 && muteableTargets.length === 0) {
        await sendMessage(api, { msg: PROTECTED_OWNER_BLOCK_MESSAGE }, threadId, messageType);
        return;
    }

    const targetIds = muteableTargets.map((target) => target.userId);
    const mutedByUserId = String(message?.data?.uidFrom || "").trim();
    const mutedByName =
        typeof message?.data?.dName === "string" && message.data.dName.trim()
            ? message.data.dName.trim()
            : "Nguoi dung bi an";

    const operations = targetIds.map((userId) => ({
        updateOne: {
            filter: { groupId: threadId, userId },
            update: {
                $set: {
                    mutedByUserId,
                    mutedByName,
                    mutedAt: new Date(),
                    blockedMsgCount: 0,
                },
                $setOnInsert: {
                    groupId: threadId,
                    userId,
                },
            },
            upsert: true,
        },
    }));

    await MutedMember.bulkWrite(operations, { ordered: false });

    const lines = [
        "Đã bật chế độ mute cho:",
        formatNameList(muteableTargets),
        
    ];

    if (protectedTargets.length > 0) {
        lines.push(`${formatNameList(protectedTargets)}: ${PROTECTED_OWNER_BLOCK_MESSAGE}`);
    }

    await sendMessage(
        api,
        {
            msg: lines.join("\n"),
        },
        threadId,
        messageType
    );
}

module.exports = {
    handleMuteCommand,
};
