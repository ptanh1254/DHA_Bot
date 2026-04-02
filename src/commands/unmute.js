const {
    getMentionedTargets,
    getMessageType,
    sendMessage,
    buildErrorMessage,
    formatNameList,
} = require("../utils/commonHelpers");

function normalizeUid(rawId) {
    if (rawId === null || rawId === undefined) return "";
    return String(rawId).replace(/_\d+$/, "").trim();
}

function buildUidVariants(rawId) {
    const normalized = normalizeUid(rawId);
    const raw = String(rawId || "").trim();
    const set = new Set();

    if (raw) set.add(raw);
    if (normalized) {
        set.add(normalized);
        set.add(`${normalized}_0`);
        set.add(`${normalized}_1`);
        set.add(`${normalized}_2`);
    }

    return [...set].filter(Boolean);
}

async function handleUnmuteCommand(api, message, threadId, MutedMember, prefix = "!") {
    const messageType = getMessageType(message);
    const targets = getMentionedTargets(message);
    if (targets.length === 0) {
        await sendMessage(
            api,
            buildErrorMessage("H\u00e3y tag ng\u01b0\u1eddi c\u1ea7n unmute", [`${prefix}unmute @TenNguoiDung`]),
            threadId,
            messageType
        );
        return;
    }

    const targetIds = [...new Set(targets.flatMap((target) => buildUidVariants(target.userId)))];

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
