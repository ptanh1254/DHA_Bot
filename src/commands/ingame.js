const { getMessageType, getMentionedTargets, normalizeId } = require("../utils/commonHelpers");

function normalizeIngameName(input) {
    return String(input || "")
        .replace(/\s+/g, " ")
        .trim();
}

function escapeRegExp(input) {
    return String(input || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripMentionsFromArgs(argsText, mentions) {
    let out = String(argsText || "");

    for (const mention of mentions || []) {
        const displayName = String(mention?.displayName || "").trim();
        if (!displayName) continue;

        const escapedName = escapeRegExp(displayName);
        out = out.replace(new RegExp(`@${escapedName}`, "gi"), " ");
    }

    return normalizeIngameName(out);
}

async function handleIngameCommand(
    api,
    message,
    threadId,
    User,
    argsText,
    prefix = "!",
    canManageOthers = false
) {
    const messageType = getMessageType(message);
    const mentions = getMentionedTargets(message);
    const rawName = normalizeIngameName(argsText);
    const mentionBasedName = stripMentionsFromArgs(argsText, mentions);

    // Case 1: Privileged user can set ingame for mentioned member
    // Syntax: !ingame @user TenIngame
    if (mentions.length > 0 && mentionBasedName) {
        if (!canManageOthers) {
            await api.sendMessage(
                { msg: "Bạn không có quyền set ingame cho người khác." },
                threadId,
                messageType
            );
            return;
        }

        if (mentions.length > 1) {
            await api.sendMessage(
                { msg: `Chỉ set được 1 người mỗi lần. Dùng: ${prefix}ingame @Tag TênIngame` },
                threadId,
                messageType
            );
            return;
        }

        if (mentionBasedName.length > 40) {
            await api.sendMessage(
                { msg: "Tên ingame tối đa 40 ký tự thôi nha." },
                threadId,
                messageType
            );
            return;
        }

        const target = mentions[0];
        const targetUserId = normalizeId(target?.userId || "");
        if (!targetUserId) return;

        const existing = await User.findOne({ groupId: threadId, userId: targetUserId }).lean();
        const oldIngameName = String(existing?.ingameName || "").trim();
        const now = new Date();

        await User.findOneAndUpdate(
            { groupId: threadId, userId: targetUserId },
            {
                $setOnInsert: {
                    groupId: threadId,
                    userId: targetUserId,
                    msgCount: 0,
                    totalMsgCount: 0,
                    dailyMsgCount: 0,
                    monthlyMsgCount: 0,
                    dayKey: "",
                    monthKey: "",
                    joinDate: now,
                },
                $set: {
                    ingameName: mentionBasedName,
                    ingameSetAt: now,
                },
            },
            {
                upsert: true,
                returnDocument: "after",
                setDefaultsOnInsert: true,
            }
        );

        const targetName = String(target?.displayName || "Thành viên").trim() || "Thành viên";
        const mentionText = `@${targetName}`;
        const reply = oldIngameName
            ? `${mentionText} đã được cập nhật ingame: ${oldIngameName} -> ${mentionBasedName}`
            : `${mentionText} đã được set ingame: ${mentionBasedName}`;

        await api.sendMessage(
            {
                msg: reply,
                mentions: [
                    {
                        pos: 0,
                        uid: targetUserId,
                        len: mentionText.length,
                    },
                ],
            },
            threadId,
            messageType
        );
        return;
    }

    // Case 2: Check ingame via mentions
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
                len: mentionText.length,
            });

            results.push(line);
            currentPos += line.length + 1;
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

    // Case 3: Set own ingame
    if (!rawName) {
        await api.sendMessage(
            {
                msg: [
                    `Dùng đúng cú pháp:`,
                    `- Set cho bản thân: ${prefix}ingame TênIngame`,
                    `- Xem ingame: ${prefix}ingame @Tag`,
                    `- (Người có quyền) Set cho người khác: ${prefix}ingame @Tag TênIngame`,
                ].join("\n"),
            },
            threadId,
            messageType
        );
        return;
    }

    if (rawName.length > 40) {
        await api.sendMessage(
            { msg: "Tên ingame tối đa 40 ký tự thôi nha." },
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
                    `Muốn đổi thì nhờ trưởng/phó nhóm dùng ${prefix}xoaingame @bạn rồi set lại.`,
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
        { msg: `Đã lưu tên ingame: ${rawName}` },
        threadId,
        messageType
    );
}

module.exports = {
    handleIngameCommand,
};
