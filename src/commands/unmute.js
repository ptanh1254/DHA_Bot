const { getMentionedTargets, getMessageType, sendMessage, buildErrorMessage, formatNameList } = require("../utils/commonHelpers");

async function handleUnmuteCommand(api, message, threadId, MutedMember, prefix = "!") {
    const messageType = getMessageType(message);
    const targets = getMentionedTargets(message);
    if (targets.length === 0) {
        await sendMessage(api, buildErrorMessage("Hãy tag người cần unmute", [`${prefix}unmute @TenNguoiDung`]), threadId, messageType);
        return;
    }

    const targetIds = targets.map((target) => target.userId);

    await MutedMember.deleteMany({
        groupId: threadId,
        userId: { $in: targetIds },
    });

    await api.sendMessage(
        {
            msg: ["\ud83d\udd0a \u0110\u00e3 g\u1ee1 mute cho:", formatNameList(targets)].join("\n"),
        },
        threadId,
        messageType
    );
}

module.exports = {
    handleUnmuteCommand,
};
