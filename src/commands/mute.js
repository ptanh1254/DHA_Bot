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

async function handleMuteCommand(api, message, threadId, MutedMember, prefix = "!") {
    const targets = getMentionedTargets(message);
    if (targets.length === 0) {
        await api.sendMessage(
            {
                msg: `H\u00e3y tag ng\u01b0\u1eddi c\u1ea7n mute. V\u00ed d\u1ee5: ${prefix}mute @TenNguoiDung`,
            },
            threadId,
            message.type
        );
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
        message.type
    );
}

module.exports = {
    handleMuteCommand,
};
