function normalizeId(rawId) {
    if (rawId === null || rawId === undefined) return "";
    return String(rawId).replace(/_0$/, "").trim();
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

function formatTargetNames(targets) {
    return targets.map((target) => target.displayName).join(", ");
}

async function handleAddBQTCommand(api, message, threadId, GroupKeyMember, prefix = "!") {
    const targets = getMentionedTargets(message);
    if (targets.length === 0) {
        await api.sendMessage(
            {
                msg: `Hãy tag người cần thêm vào danh sách dùng lệnh. Ví dụ: ${prefix}addbqt @TenNguoiDung`,
            },
            threadId,
            message.type
        );
        return;
    }

    const operations = targets.map((target) => ({
        updateOne: {
            filter: { groupId: threadId, userId: target.userId },
            update: {
                $set: {
                    userName: target.displayName,
                    verifiedAt: new Date(),
                },
                $setOnInsert: {
                    groupId: threadId,
                    userId: target.userId,
                },
            },
            upsert: true,
        },
    }));

    await GroupKeyMember.bulkWrite(operations, { ordered: false });

    await api.sendMessage(
        {
            msg: [
                "Đã thêm vào danh sách được dùng lệnh:",
                formatTargetNames(targets),
            ].join("\n"),
        },
        threadId,
        message.type
    );
}

module.exports = {
    handleAddBQTCommand,
};
