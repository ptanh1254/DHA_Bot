function normalizeId(rawId) {
    if (rawId === null || rawId === undefined) return "";
    return String(rawId).replace(/_\d+$/, "").trim();
}

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
        const uid = normalizeId(mention?.uid);
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
            displayName: displayName || "Người dùng",
        });
    }

    return [...uniqueTargets.values()];
}

function extractUidArgs(argsText) {
    return String(argsText || "")
        .split(/\s+/)
        .map((part) => normalizeId(part))
        .filter((part) => /^\d{6,}$/.test(part));
}

function formatTargetNames(targets) {
    return targets.map((target) => target.displayName).join(", ");
}

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
    const messageType = Number(message?.type) || 1;
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
            normalizeName(row.userName) || `UID ${normalizeId(row.userId)}`,
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
                formatTargetNames(removedTargets),
            ].join("\n"),
        },
        threadId,
        messageType
    );
}

module.exports = {
    handleRemoveQTVCommand,
};
