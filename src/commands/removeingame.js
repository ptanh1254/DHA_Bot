const { normalizeId, getMentionedTargets, extractUidArgs, buildIdVariants, formatNameList, getMessageType } = require("../utils/commonHelpers");

async function handleRemoveIngameCommand(
    api,
    message,
    threadId,
    User,
    argsText,
    prefix = "!"
) {
    const messageType = getMessageType(message);
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
    if (targets.length === 0) {
        await api.sendMessage(
            {
                msg: [
                    `Dùng: ${prefix}xoaingame @TenNguoiDung`,
                    `Hoặc: ${prefix}xoaingame <uid>`,
                ].join("\n"),
            },
            threadId,
            messageType
        );
        return;
    }

    const ids = targets.map((target) => target.userId);
    const idVariants = [...new Set(ids.flatMap((id) => buildIdVariants(id)))];
    const rows = await User.find(
        { groupId: threadId, userId: { $in: idVariants } },
        { userId: 1, displayName: 1, ingameName: 1 }
    ).lean();

    if (!rows || rows.length === 0) {
        await api.sendMessage(
            {
                msg: "Không tìm thấy dữ liệu người dùng để xóa ingame.",
            },
            threadId,
            messageType
        );
        return;
    }

    const rowsWithIngame = rows.filter((row) => String(row?.ingameName || "").trim());
    if (rowsWithIngame.length === 0) {
        await api.sendMessage(
            {
                msg: "Những người này chưa có ingame để xóa.",
            },
            threadId,
            messageType
        );
        return;
    }

    const idsToClear = rowsWithIngame.map((row) => String(row.userId || "").trim()).filter(Boolean);
    await User.updateMany(
        { groupId: threadId, userId: { $in: idsToClear } },
        {
            $set: {
                ingameName: "",
            },
            $unset: {
                ingameSetAt: 1,
            },
        }
    );

    const nameById = new Map();
    for (const row of rowsWithIngame) {
        const rowIdRaw = String(row.userId || "").trim();
        const rowIdNormalized = normalizeId(rowIdRaw);
        const rowName = (row.displayName || "").replace(/^@+/, "").trim() || `UID ${rowIdNormalized || rowIdRaw}`;
        nameById.set(rowIdRaw, rowName);
        if (rowIdNormalized) {
            nameById.set(rowIdNormalized, rowName);
        }
    }
    const removedTargets = targets
        .filter((target) =>
            idsToClear.some((id) => buildIdVariants(id).includes(target.userId))
        )
        .map((target) => ({
            ...target,
            displayName: nameById.get(target.userId) || target.displayName,
        }));

    await api.sendMessage(
        {
            msg: [
                "Đã xóa ingame cho:",
                formatNameList(removedTargets),
            ].join("\n"),
        },
        threadId,
        messageType
    );
}

module.exports = {
    handleRemoveIngameCommand,
};
