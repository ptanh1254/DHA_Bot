const { normalizeId, getMentionedTargets, extractUidArgs, formatNameList, getMessageType } = require("../utils/commonHelpers");

async function handleRemoveQTVCommand(
    api,
    message,
    threadId,
    GroupKeyMember,
    argsText,
    prefix = "!"
) {
    const mentionTargets = getMentionedTargets(message);
    const uidArgs = extractUidArgs(argsText);
    const targetMap = new Map();

    for (const target of mentionTargets) {
        targetMap.set(target.userId, target);
    }
    for (const uid of uidArgs) {
        if (!targetMap.has(uid)) {
            targetMap.set(uid, { userId: uid, displayName: `UID ${uid}` });
        }
    }

    const targets = [...targetMap.values()];
    const messageType = getMessageType(message);
    if (targets.length === 0) {
        await api.sendMessage(
            {
                msg: [
                    "Hãy tag hoặc nhập UID người cần gỡ quyền dùng lệnh.",
                    `Ví dụ: ${prefix}removeqtv @TenNguoiDung`,
                    `Hoặc: ${prefix}removeqtv 123456789`,
                ].join("\n"),
            },
            threadId,
            messageType
        );
        return;
    }

    const targetIds = targets.map((target) => target.userId);
    const existingRows = await GroupKeyMember.find(
        { groupId: threadId, userId: { $in: targetIds } },
        { userId: 1, userName: 1 }
    ).lean();

    if (!existingRows || existingRows.length === 0) {
        await api.sendMessage(
            {
                msg: "Không có ai trong danh sách được dùng lệnh để gỡ.",
            },
            threadId,
            messageType
        );
        return;
    }

    const existingIds = existingRows.map((row) => normalizeId(row.userId)).filter(Boolean);
    if (existingIds.length > 0) {
        await GroupKeyMember.deleteMany({
            groupId: threadId,
            userId: { $in: existingIds },
        });
    }

    const rowNameById = new Map(
        existingRows.map((row) => [
            normalizeId(row.userId),
            (row.userName || "").replace(/^@+/, "").trim() || `UID ${normalizeId(row.userId)}`,
        ])
    );
    const removedTargets = targets
        .filter((target) => existingIds.includes(target.userId))
        .map((target) => ({
            ...target,
            displayName: rowNameById.get(target.userId) || target.displayName,
        }));

    await api.sendMessage(
        {
            msg: [
                "Đã gỡ khỏi danh sách được dùng lệnh:",
                formatNameList(removedTargets),
            ].join("\n"),
        },
        threadId,
        messageType
    );
}

module.exports = {
    handleRemoveQTVCommand,
};
