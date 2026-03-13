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

function buildIdVariants(rawId) {
    const normalized = normalizeId(rawId);
    const variants = new Set([String(rawId || "").trim(), normalized]);
    if (normalized) {
        variants.add(`${normalized}_0`);
        variants.add(`${normalized}_1`);
        variants.add(`${normalized}_2`);
    }
    return [...variants].filter(Boolean);
}

async function handleRemoveIngameCommand(
    api,
    message,
    threadId,
    User,
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
    if (targets.length === 0) {
        await api.sendMessage(
            {
                msg: [
                    `Dùng: ${prefix}xoaingame @TenNguoiDung`,
                    `Hoặc: ${prefix}xoaingame <uid>`,
                ].join("\n"),
            },
            threadId,
            message.type
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
            message.type
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
            message.type
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
        const rowName = normalizeName(row.displayName) || `UID ${rowIdNormalized || rowIdRaw}`;
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
                formatTargetNames(removedTargets),
            ].join("\n"),
        },
        threadId,
        message.type
    );
}

module.exports = {
    handleRemoveIngameCommand,
};
