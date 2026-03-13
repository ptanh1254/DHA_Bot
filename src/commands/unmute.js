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
        const uid = String(mention?.uid || "").trim();
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
            displayName: displayName || "Ng\u01b0\u1eddi d\u00f9ng",
        });
    }

    return [...uniqueTargets.values()];
}

function formatNameList(targets) {
    return targets.map((target) => target.displayName).join(", ");
}

async function handleUnmuteCommand(api, message, threadId, MutedMember, prefix = "!") {
    const messageType = Number(message?.type) || 1;
    const targets = getMentionedTargets(message);
    if (targets.length === 0) {
        await api.sendMessage(
            {
                msg: `H\u00e3y tag ng\u01b0\u1eddi c\u1ea7n unmute. V\u00ed d\u1ee5: ${prefix}unmute @TenNguoiDung`,
            },
            threadId,
            messageType
        );
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
