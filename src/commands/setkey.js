function normalizeId(rawId) {
    if (rawId === null || rawId === undefined) return "";
    return String(rawId).replace(/_0$/, "").trim();
}

function normalizeKey(rawValue) {
    return String(rawValue || "").trim().toLowerCase();
}

async function isGroupAdmin(api, threadId, userId) {
    try {
        const response = await api.getGroupInfo(threadId);
        const gridInfoMap = response?.gridInfoMap || {};
        const groupInfo = gridInfoMap[threadId] || Object.values(gridInfoMap)[0];
        if (!groupInfo) return false;

        const actorId = normalizeId(userId);
        if (!actorId) return false;

        const creatorId = normalizeId(
            groupInfo?.creatorId || groupInfo?.ownerId || groupInfo?.creator
        );
        if (creatorId && creatorId === actorId) return true;

        const adminIds = Array.isArray(groupInfo?.adminIds) ? groupInfo.adminIds : [];
        return adminIds.map(normalizeId).includes(actorId);
    } catch (error) {
        console.error("Khong the kiem tra quyen admin cho !setkey:", error);
        return false;
    }
}

function buildStatusMessage(prefix, isEnabled, hasKey) {
    const state = isEnabled ? "BAT" : "TAT";
    const keyState = hasKey ? "Da cai dat" : "Chua cai dat";

    return [
        `Che do key hien tai: ${state}`,
        `Trang thai key: ${keyState}`,
        `Dung \`${prefix}setkey <ma-key>\` de tao/doi key va bat che do key`,
        `Dung \`${prefix}setkey on\` de bat lai che do key voi key hien tai`,
        `Dung \`${prefix}setkey off\` de tat che do key`,
        `Thanh vien dung \`${prefix}key <ma-key>\` de kich hoat quyen dung bot`,
    ].join("\n");
}

async function handleSetKeyCommand(
    api,
    message,
    threadId,
    GroupSetting,
    GroupKeyMember,
    argsText,
    prefix = "!"
) {
    const actorId = String(message?.data?.uidFrom || "").trim();
    const allowed = await isGroupAdmin(api, threadId, actorId);
    if (!allowed) {
        await api.sendMessage(
            { msg: "Lenh nay chi admin/chu nhom moi dung duoc." },
            threadId,
            message.type
        );
        return;
    }

    const normalizedArgs = String(argsText || "").trim();
    const normalized = normalizedArgs.toLowerCase();
    const setting = await GroupSetting.findOne({ groupId: threadId }).lean();
    const hasCurrentKey = typeof setting?.commandAccessKey === "string" && setting.commandAccessKey.trim();

    if (!normalized) {
        await api.sendMessage(
            {
                msg: buildStatusMessage(prefix, setting?.commandAccessEnabled === true, hasCurrentKey),
            },
            threadId,
            message.type
        );
        return;
    }

    if (normalized === "off") {
        await GroupSetting.findOneAndUpdate(
            { groupId: threadId },
            { $set: { commandAccessEnabled: false } },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        );
        await api.sendMessage(
            { msg: "Da tat che do key. Moi thanh vien trong nhom deu dung bot duoc." },
            threadId,
            message.type
        );
        return;
    }

    if (normalized === "on") {
        if (!hasCurrentKey) {
            await api.sendMessage(
                {
                    msg: `Nhom chua co key. Dung \`${prefix}setkey <ma-key>\` truoc nha.`,
                },
                threadId,
                message.type
            );
            return;
        }

        await GroupSetting.findOneAndUpdate(
            { groupId: threadId },
            { $set: { commandAccessEnabled: true } },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        );
        await api.sendMessage(
            { msg: "Da bat che do key. Ai chua kich hoat key se khong dung bot duoc." },
            threadId,
            message.type
        );
        return;
    }

    const nextKey = normalizeKey(normalizedArgs);
    if (nextKey.length < 3) {
        await api.sendMessage(
            { msg: "Key ngan qua. Dat toi thieu 3 ky tu nha." },
            threadId,
            message.type
        );
        return;
    }

    await GroupSetting.findOneAndUpdate(
        { groupId: threadId },
        {
            $set: {
                commandAccessEnabled: true,
                commandAccessKey: nextKey,
            },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    await GroupKeyMember.deleteMany({ groupId: threadId });

    await api.sendMessage(
        {
            msg: [
                "Da cap nhat key moi va bat che do key cho nhom.",
                `Thanh vien can dung \`${prefix}key <ma-key>\` de duoc dung bot.`,
            ].join("\n"),
        },
        threadId,
        message.type
    );
}

module.exports = {
    handleSetKeyCommand,
};
