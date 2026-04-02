const { UserNote } = require("../db/userNoteModel");
const { getMentionedUserId, getMessageType } = require("../utils/commonHelpers");

function extractNoteContent(message) {
    const messageContent = String(message?.data?.content || "").trim();
    const mentions = Array.isArray(message?.data?.mentions) ? message.data.mentions : [];

    let noteContent = "";

    if (mentions.length > 0) {
        const firstMention = mentions[0];
        const mentionPos = Number(firstMention?.pos) || 0;
        const mentionLen = Number(firstMention?.len) || 0;
        const mentionEndPos = Math.max(0, mentionPos + mentionLen);

        if (mentionEndPos < messageContent.length) {
            noteContent = messageContent.slice(mentionEndPos).trim();
        }
    }

    if (!noteContent) {
        const atMatch = messageContent.match(/@\S+\s+(.+)/);
        if (atMatch && atMatch[1]) {
            noteContent = atMatch[1].trim();
        }
    }

    return noteContent;
}

async function handleNodeCommand(api, message, threadId, prefix = "!") {
    const messageType = getMessageType(message);
    const targetUserId = getMentionedUserId(message);

    if (!targetUserId) {
        await api.sendMessage(
            { msg: `Bạn hãy tag 1 người dùng. Ví dụ: ${prefix}node @TenNguoiDung ghi chú của bạn` },
            threadId,
            messageType
        );
        return;
    }

    const noteContent = extractNoteContent(message);
    if (!noteContent) {
        await api.sendMessage(
            { msg: `Vui lòng nhập ghi chú. Ví dụ: ${prefix}node @TenNguoiDung ghi chú của bạn` },
            threadId,
            messageType
        );
        return;
    }

    const senderUserId = String(message?.data?.uidFrom || "").trim();
    const senderNameRaw =
        typeof message?.data?.dName === "string" ? message.data.dName.trim() : "";
    const senderName = senderNameRaw || "";

    try {
        const existingNoteRecord = await UserNote.findOne({
            groupId: threadId,
            userId: targetUserId,
        }).lean();
        const existingNote = String(existingNoteRecord?.note || "").trim();
        const nextNote = existingNote ? `${existingNote}\n${noteContent}` : noteContent;

        const now = new Date();
        await UserNote.findOneAndUpdate(
            { groupId: threadId, userId: targetUserId },
            {
                $set: {
                    groupId: threadId,
                    userId: targetUserId,
                    note: nextNote,
                    createdBy: senderUserId,
                    createdByName: senderName,
                    updatedAt: now,
                },
                $setOnInsert: {
                    createdAt: now,
                },
            },
            { upsert: true, returnDocument: "after" }
        );

        await api.sendMessage({ msg: "✅ Đã thêm 1 dòng ghi chú" }, threadId, messageType);
    } catch (error) {
        console.error("Lỗi khi lưu ghi chú:", error);
        await api.sendMessage(
            { msg: "Lỗi khi lưu ghi chú. Vui lòng thử lại!" },
            threadId,
            messageType
        );
    }
}

async function handleXoaNodeCommand(api, message, threadId, prefix = "!") {
    const messageType = getMessageType(message);
    const targetUserId = getMentionedUserId(message);

    if (!targetUserId) {
        await api.sendMessage(
            { msg: `Bạn hãy tag 1 người dùng. Ví dụ: ${prefix}xoanode @TenNguoiDung` },
            threadId,
            messageType
        );
        return;
    }

    try {
        const result = await UserNote.deleteOne({ groupId: threadId, userId: targetUserId });
        if ((Number(result?.deletedCount) || 0) <= 0) {
            await api.sendMessage(
                { msg: "Không tìm thấy ghi chú để xóa." },
                threadId,
                messageType
            );
            return;
        }

        await api.sendMessage({ msg: "✅ Đã xóa ghi chú thành công" }, threadId, messageType);
    } catch (error) {
        console.error("Lỗi khi xóa ghi chú:", error);
        await api.sendMessage(
            { msg: "Lỗi khi xóa ghi chú. Vui lòng thử lại!" },
            threadId,
            messageType
        );
    }
}

module.exports = {
    handleNodeCommand,
    handleXoaNodeCommand,
};
