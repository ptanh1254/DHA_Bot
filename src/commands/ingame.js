const { getMessageType, getMentionedTargets, normalizeId } = require("../utils/commonHelpers");

function normalizeIngameName(input) {
    return String(input || "")
        .replace(/\s+/g, " ")
        .trim();
}

async function handleIngameCommand(api, message, threadId, User, argsText, prefix = "!") {
    const messageType = getMessageType(message);
    const mentions = getMentionedTargets(message);

    // Case 1: Checking ingame names via mentions
    if (mentions.length > 0) {
        const results = [];
        const responseMentions = [];
        let currentPos = 0;

        for (const target of mentions) {
            const userId = normalizeId(target.userId);
            const userDoc = await User.findOne({ groupId: threadId, userId }).lean();
            const ingameName = userDoc?.ingameName || "Chưa set ingame";
            
            const mentionText = `@${target.displayName}`;
            const line = `${mentionText}: ${ingameName}`;
            
            responseMentions.push({
                pos: currentPos,
                uid: userId,
                len: mentionText.length
            });
            
            results.push(line);
            currentPos += line.length + 1; // +1 for newline
        }

        await api.sendMessage(
            {
                msg: results.join("\n"),
                mentions: responseMentions,
            },
            threadId,
            messageType
        );
        return;
    }

    // Case 2: Setting own ingame name
    const rawName = normalizeIngameName(argsText);
    if (!rawName) {
        await api.sendMessage(
            {
                msg: `Dùng đúng cú pháp:\n- Set ingame: ${prefix}ingame TenIngame\n- Xem ingame người khác: ${prefix}ingame @Tag`,
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

    const userId = normalizeId(message?.data?.uidFrom || "");
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
