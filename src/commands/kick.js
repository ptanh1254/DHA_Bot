function buildKickStatusMessage(prefix, isEnabled) {
    const statusText = isEnabled ? "B\u1eacT" : "T\u1eaeT";
    return [
        `Ch\u1ebf \u0111\u1ed9 th\u00f4ng b\u00e1o drama r\u1eddi/kick hi\u1ec7n t\u1ea1i: ${statusText}`,
        `D\u00f9ng \`${prefix}kick on\` \u0111\u1ec3 b\u1eadt`,
        `D\u00f9ng \`${prefix}kick off\` \u0111\u1ec3 t\u1eaft`,
        `D\u00f9ng \`${prefix}kick @TenNguoiDung\` \u0111\u1ec3 m\u1eddi ra kh\u1ecfi nh\u00f3m`,
    ].join("\n");
}

function getMentionedUserIds(message) {
    const mentions = Array.isArray(message?.data?.mentions) ? message.data.mentions : [];
    const uniqueIds = new Set();

    for (const mention of mentions) {
        const uid = String(mention?.uid || "").trim();
        if (uid) uniqueIds.add(uid);
    }

    return [...uniqueIds];
}

function formatUidList(ids) {
    return ids.map((id) => `UID ${id}`).join(", ");
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
    const normalizedArgs = String(argsText || "").trim().toLowerCase();
    const mentionIds = getMentionedUserIds(message);
    const hasMentions = mentionIds.length > 0;
    const actorUserId = String(message?.data?.uidFrom || "").trim();
    const actorNameRaw =
        typeof message?.data?.dName === "string" ? message.data.dName.trim() : "";
    const actorName = actorNameRaw || (actorUserId ? `UID ${actorUserId}` : "Người dùng bí ẩn");

    if (!normalizedArgs && !hasMentions) {
        const setting = await GroupSetting.findOne({ groupId: threadId }).lean();
        const statusMessage = buildKickStatusMessage(prefix, setting?.kickEnabled === true);
        await api.sendMessage({ msg: statusMessage }, threadId, message.type);
        return;
    }

    if (!hasMentions && (normalizedArgs === "on" || normalizedArgs === "off")) {
        const shouldEnable = normalizedArgs === "on";
        await GroupSetting.findOneAndUpdate(
            { groupId: threadId },
            { $set: { kickEnabled: shouldEnable } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        await api.sendMessage(
            {
                msg: shouldEnable
                    ? "\u0110\u00e3 b\u1eadt loa ph\u01b0\u1eddng: ai r\u1eddi nh\u00f3m/b\u1ecb kick c\u0169ng s\u1ebd \u0111\u01b0\u1ee3c th\u00f4ng b\u00e1o."
                    : "\u0110\u00e3 t\u1eaft loa ph\u01b0\u1eddng r\u1eddi/kick cho nh\u00f3m n\u00e0y.",
            },
            threadId,
            message.type
        );
        return;
    }

    if (!hasMentions) {
        await api.sendMessage(
            {
                    msg: [
                        `Sai c\u00fa ph\u00e1p.`,
                        `- \`${prefix}kick\`: xem tr\u1ea1ng th\u00e1i`,
                        `- \`${prefix}kick on/off\`: b\u1eadt t\u1eaft th\u00f4ng b\u00e1o`,
                        `- \`${prefix}kick @TenNguoiDung\`: m\u1eddi ng\u01b0\u1eddi \u0111\u01b0\u1ee3c tag ra kh\u1ecfi nh\u00f3m`,
                    ].join("\n"),
            },
            threadId,
            message.type
        );
        return;
    }

    try {
        if (kickIntentStore && actorUserId) {
            kickIntentStore.rememberKickRequest(threadId, mentionIds, {
                actorUserId,
                actorName,
            });
        }

        const result = await api.removeUserFromGroup(mentionIds, threadId);
        const errorMembers = Array.isArray(result?.errorMembers)
            ? result.errorMembers.map((id) => String(id))
            : [];
        const failedSet = new Set(errorMembers);
        const successIds = mentionIds.filter((id) => !failedSet.has(id));

        if (kickIntentStore && errorMembers.length > 0) {
            kickIntentStore.clearKickRequest(threadId, errorMembers);
        }

        if (successIds.length > 0 && errorMembers.length === 0) {
            await api.sendMessage(
                {
                    msg: `\u2705 \u0110\u00e3 ti\u1ec5n ra c\u1eeda th\u00e0nh c\u00f4ng: ${formatUidList(successIds)}.`,
                },
                threadId,
                message.type
            );
            return;
        }

        if (successIds.length > 0 && errorMembers.length > 0) {
            await api.sendMessage(
                {
                    msg: [
                        `\u2705 \u0110\u00e3 ti\u1ec5n ra c\u1eeda: ${formatUidList(successIds)}.`,
                        `\u26a0\ufe0f Ch\u01b0a ti\u1ec5n \u0111\u01b0\u1ee3c: ${formatUidList(errorMembers)}.`,
                    ].join("\n"),
                },
                threadId,
                message.type
            );
            return;
        }

        await api.sendMessage(
            {
                msg: [
                    "\u274c Ch\u01b0a th\u1ec3 m\u1eddi th\u00e0nh vi\u00ean \u0111\u01b0\u1ee3c tag ra kh\u1ecfi nh\u00f3m.",
                    "Ki\u1ec3m tra l\u1ea1i quy\u1ec1n qu\u1ea3n tr\u1ecb c\u1ee7a bot v\u00e0 tr\u1ea1ng th\u00e1i th\u00e0nh vi\u00ean trong nh\u00f3m.",
                ].join("\n"),
            },
            threadId,
            message.type
        );
    } catch (error) {
        if (kickIntentStore) {
            kickIntentStore.clearKickRequest(threadId, mentionIds);
        }
        console.error("L\u1ed7i command !kick:", error);
        await api.sendMessage(
            {
                msg: [
                    "\ud83d\ude35\u200d\ud83d\udcab C\u00faa s\u00fat ch\u01b0a th\u00e0nh c\u00f4ng.",
                    "Bot c\u1ea7n quy\u1ec1n qu\u1ea3n tr\u1ecb nh\u00f3m \u0111\u1ec3 th\u1ef1c hi\u1ec7n l\u1ec7nh n\u00e0y.",
                ].join("\n"),
            },
            threadId,
            message.type
        );
    }
}

module.exports = {
    handleKickCommand,
};
