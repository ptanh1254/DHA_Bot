function buildKickStatusMessage(prefix, isEnabled) {
    const statusText = isEnabled ? "BẬT" : "TẮT";
    return [
        `Chế độ thông báo rời/kick hiện tại: ${statusText}`,
        `Dùng \`${prefix}kick on\` để bật`,
        `Dùng \`${prefix}kick off\` để tắt`,
        `Dùng \`${prefix}kick @TenNguoiDung\` để mời ra khỏi nhóm`,
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
        const statusMessage = buildKickStatusMessage(prefix, setting?.kickEnabled !== false);
        await api.sendMessage({ msg: statusMessage }, threadId, message.type);
        return;
    }

    if (!hasMentions && (normalizedArgs === "on" || normalizedArgs === "off")) {
        const shouldEnable = normalizedArgs === "on";
        await GroupSetting.findOneAndUpdate(
            { groupId: threadId },
            { $set: { kickEnabled: shouldEnable } },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        );

        await api.sendMessage(
            {
                msg: shouldEnable
                    ? "Đã bật thông báo rời/kick cho nhóm này."
                    : "Đã tắt thông báo rời/kick cho nhóm này.",
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
                    "Sai cú pháp.",
                    `- \`${prefix}kick\`: xem trạng thái`,
                    `- \`${prefix}kick on/off\`: bật tắt thông báo`,
                    `- \`${prefix}kick @TenNguoiDung\`: mời người được tag ra khỏi nhóm`,
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
                    msg: `Đã kick thành công: ${formatUidList(successIds)}.`,
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
                        `Đã kick: ${formatUidList(successIds)}.`,
                        `Chưa kick được: ${formatUidList(errorMembers)}.`,
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
                    "Chưa thể mời thành viên được tag ra khỏi nhóm.",
                    "Kiểm tra lại quyền admin của bot và trạng thái thành viên trong nhóm.",
                ].join("\n"),
            },
            threadId,
            message.type
        );
    } catch (error) {
        if (kickIntentStore) {
            kickIntentStore.clearKickRequest(threadId, mentionIds);
        }
        console.error("Lỗi command !kick:", error);
        await api.sendMessage(
            {
                msg: [
                    "Cú sút chưa thành công.",
                    "Bot cần quyền admin nhóm để thực hiện lệnh này.",
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
