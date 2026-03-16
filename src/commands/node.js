const { UserNote } = require("../db/userNoteModel");

function getMentionedUserId(message) {
    const mentions = message?.data?.mentions;
    if (!Array.isArray(mentions) || mentions.length === 0) return null;
    const uid = mentions[0]?.uid;
    return uid ? String(uid) : null;
}

async function handleNodeCommand(api, message, threadId, prefix = "!") {
    const messageType = Number(message?.type) || 1;
    const targetUserId = getMentionedUserId(message);

    if (!targetUserId) {
        await api.sendMessage(
            { msg: `Bạn hãy tag 1 người dùng. Ví dụ: ${prefix}node @TenNguoiDung ghi chú của bạn` },
            threadId,
            messageType
        );
        return;
    }

    // Extract the note content from the message
    // The actual content is in message.data.content (not message.body)
    const messageContent = String(message?.data?.content || "").trim();
    const mentions = message?.data?.mentions || [];
    
    let noteContent = "";

    // Use mention position and length to extract text after mention
    if (mentions.length > 0) {
        const firstMention = mentions[0];
        const mentionEndPos = (firstMention.pos || 0) + (firstMention.len || 0);
        
        // Get text after the mention
        if (mentionEndPos < messageContent.length) {
            noteContent = messageContent.substring(mentionEndPos).trim();
        }
    }

    // Fallback: Try regex pattern if position-based extraction didn't work
    if (!noteContent) {
        const atMatch = messageContent.match(/@(\S+)\s+(.+)/);
        if (atMatch && atMatch[2]) {
            noteContent = atMatch[2].trim();
        }
    }

    if (!noteContent) {
        console.log("[NODE DEBUG] Failed to parse. Content:", messageContent);
        console.log("[NODE DEBUG] Mentions:", JSON.stringify(mentions));
        await api.sendMessage(
            { msg: `Vui lòng nhập ghi chú. Ví dụ: ${prefix}node @TenNguoiDung ghi chú của bạn` },
            threadId,
            messageType
        );
        return;
    }

    // Get sender info - similar to kick command
    const senderUserId = String(message?.data?.uidFrom || "").trim();
    const senderNameRaw = typeof message?.data?.dName === "string" ? message.data.dName.trim() : "";
    const senderName = senderNameRaw || ""; // Just use the name, no fallback to UID

    // Save the note
    try {
        const now = new Date();
        await UserNote.findOneAndUpdate(
            { groupId: threadId, userId: targetUserId },
            {
                $set: {
                    groupId: threadId,
                    userId: targetUserId,
                    note: noteContent,
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

        await api.sendMessage(
            { msg: `✓ Đã ghi chú thành công` },
            threadId,
            messageType
        );
    } catch (error) {
        console.error("Lỗi khi lưu ghi chú:", error);
        await api.sendMessage(
            { msg: "Lỗi khi lưu ghi chú. Vui lòng thử lại!" },
            threadId,
            messageType
        );
    }
}

module.exports = {
    handleNodeCommand,
};
