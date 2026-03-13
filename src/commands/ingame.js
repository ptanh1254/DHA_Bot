function normalizeIngameName(input) {
    return String(input || "")
        .replace(/\s+/g, " ")
        .trim();
}

async function handleIngameCommand(api, message, threadId, User, argsText, prefix = "!") {
    const messageType = Number(message?.type) || 1;
    const rawName = normalizeIngameName(argsText);
    if (!rawName) {
        await api.sendMessage(
            {
                msg: `Dùng đúng cú pháp: ${prefix}ingame TenIngame`,
            },
            threadId,
            messageType
        );
        return;
    }

    if (rawName.length > 40) {
        await api.sendMessage(
            {
                msg: "Tên ingame tối đa 40 ký tự thôi nha.",
            },
            threadId,
            messageType
        );
        return;
    }

    const userId = String(message?.data?.uidFrom || "").trim();
    if (!userId) return;

    const existing = await User.findOne({ groupId: threadId, userId }).lean();
    const existingIngame = String(existing?.ingameName || "").trim();
    if (existingIngame) {
        await api.sendMessage(
            {
                msg: [
                    `Bạn đã set ingame rồi: ${existingIngame}`,
                    `Muốn đổi thì nhờ trưởng/phó nhóm dùng ${prefix}xoaingame @ban rồi set lại.`,
                ].join("\n"),
            },
            threadId,
            messageType
        );
        return;
    }

    const senderName =
        typeof message?.data?.dName === "string" ? message.data.dName.trim() : "";
    const now = new Date();
    const updateDoc = {
        $setOnInsert: {
            groupId: threadId,
            userId,
            msgCount: 0,
            totalMsgCount: 0,
            dailyMsgCount: 0,
            monthlyMsgCount: 0,
            dayKey: "",
            monthKey: "",
            joinDate: now,
        },
        $set: {
            ingameName: rawName,
            ingameSetAt: now,
        },
    };

    if (senderName) {
        updateDoc.$set.displayName = senderName;
    }

    await User.findOneAndUpdate({ groupId: threadId, userId }, updateDoc, {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
    });

    await api.sendMessage(
        {
            msg: `Đã lưu tên ingame: ${rawName}`,
        },
        threadId,
        messageType
    );
}

module.exports = {
    handleIngameCommand,
};
