const { getMentionedTargets, getMessageType, sendMessage, buildErrorMessage, formatNameList } = require("../utils/commonHelpers");

async function handleMuteCommand(api, message, threadId, MutedMember, prefix = "!") {
    const messageType = getMessageType(message);
    const targets = getMentionedTargets(message);
    if (targets.length === 0) {
        await sendMessage(api, buildErrorMessage("Hãy tag người cần mute", [`${prefix}mute @TenNguoiDung`]), threadId, messageType);
        return;
    }

    const targetIds = targets.map((target) => target.userId);
    const mutedByUserId = String(message?.data?.uidFrom || "").trim();
    const mutedByName =
        typeof message?.data?.dName === "string" && message.data.dName.trim()
            ? message.data.dName.trim()
            : "Ng\u01b0\u1eddi d\u00f9ng b\u00ed \u1ea9n";

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

    await api.sendMessage(
        {
            msg: [
                "\ud83d\udd07 \u0110\u00e3 b\u1eadt mute chat t\u1ee9c th\u00ec cho:",
                formatNameList(targets),
                "T\u1eeb gi\u1edd nh\u1eefng ng\u01b0\u1eddi n\u00e0y nh\u1eafn l\u00e0 bot xo\u00e1 tin ngay.",
            ].join("\n"),
        },
        threadId,
        messageType
    );
}

module.exports = {
    handleMuteCommand,
};
