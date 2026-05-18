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

function extractTextAfterFirstMention(message) {
    const messageContent = String(message?.data?.content || "").trim();
    const mentions = Array.isArray(message?.data?.mentions) ? message.data.mentions : [];

    if (mentions.length > 0) {
        const firstMention = mentions[0];
        const mentionPos = Number(firstMention?.pos) || 0;
        const mentionLen = Number(firstMention?.len) || 0;
        const mentionEndPos = Math.max(0, mentionPos + mentionLen);
        return messageContent.slice(mentionEndPos).trim();
    }

    const atMatch = messageContent.match(/@\S+\s+(.+)/);
    return atMatch && atMatch[1] ? atMatch[1].trim() : "";
}

function parseNoteLineNumber(message) {
    const args = extractTextAfterFirstMention(message);
    const match = args.match(/^(\d+)\b/);
    if (!match) return null;

    const lineNumber = Number(match[1]);
    return Number.isInteger(lineNumber) && lineNumber > 0 ? lineNumber : null;
}

function splitLegacyNoteLines(noteRaw) {
    return String(noteRaw || "")
        .split(/\r?\n+/)
        .map((line) => String(line || "").replace(/^[-*\u2022]+\s*/, "").trim())
        .filter(Boolean);
}

function buildLegacyNoteText(notes) {
    return notes
        .map((note) => String(note?.content || note || "").trim())
        .filter(Boolean)
        .join("\n");
}

async function handleNoteCommand(api, message, threadId, prefix = "!") {
    const messageType = getMessageType(message);
    const targetUserId = getMentionedUserId(message);

    if (!targetUserId) {
        await api.sendMessage(
            { msg: `Ban hay tag 1 nguoi dung. Vi du: ${prefix}note @TenNguoiDung ghi chú của bạn` },
            threadId,
            messageType
        );
        return;
    }

    const noteContent = extractNoteContent(message);
    if (!noteContent) {
        await api.sendMessage(
            { msg: `Vui long nhap ghi chú. Vi du: ${prefix}note @TenNguoiDung ghi chú của bạn` },
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
                $push: {
                    notes: {
                        content: noteContent,
                        createdBy: senderUserId,
                        createdByName: senderName,
                        createdAt: now,
                    },
                },
                $setOnInsert: {
                    createdAt: now,
                },
            },
            { upsert: true, returnDocument: "after" }
        );

        await api.sendMessage({ msg: "Đã thêm 1 dòng ghi chú." }, threadId, messageType);
    } catch (error) {
        console.error("Lỗi khi luu ghi chú:", error);
        await api.sendMessage(
            { msg: "Lỗi khi luu ghi chú. Vui long thử lại!" },
            threadId,
            messageType
        );
    }
}

async function handleXoaNoteCommand(api, message, threadId, prefix = "!") {
    const messageType = getMessageType(message);
    const targetUserId = getMentionedUserId(message);

    if (!targetUserId) {
        await api.sendMessage(
            { msg: `Ban hay tag 1 nguoi dung. Vi du: ${prefix}xoanote @TenNguoiDung` },
            threadId,
            messageType
        );
        return;
    }

    try {
        const lineNumber = parseNoteLineNumber(message);
        if (!lineNumber) {
            const result = await UserNote.deleteOne({ groupId: threadId, userId: targetUserId });
            if ((Number(result?.deletedCount) || 0) <= 0) {
                await api.sendMessage(
                    { msg: "Khong tim thay ghi chu de xoa." },
                    threadId,
                    messageType
                );
                return;
            }

            await api.sendMessage({ msg: "Đã xóa tất cả ghi chú thành công." }, threadId, messageType);
            return;
        }

        const noteRecord = await UserNote.findOne({ groupId: threadId, userId: targetUserId });
        if (!noteRecord) {
            await api.sendMessage(
                { msg: "Không tìm thấy ghi chú để xoá." },
                threadId,
                messageType
            );
            return;
        }

        const structuredNotes = Array.isArray(noteRecord.notes) ? noteRecord.notes : [];
        const hasStructuredNotes = structuredNotes.some((item) =>
            String(item?.content || "").trim()
        );

        if (hasStructuredNotes) {
            const nextNotes = structuredNotes.filter((item) => String(item?.content || "").trim());
            if (lineNumber > nextNotes.length) {
                await api.sendMessage(
                    { msg: `Chỉ có ${nextNotes.length} dòng ghi chú. Không có dòng ${lineNumber}.` },
                    threadId,
                    messageType
                );
                return;
            }

            const removed = nextNotes.splice(lineNumber - 1, 1)[0];
            noteRecord.notes = nextNotes;
            noteRecord.note = buildLegacyNoteText(nextNotes);
            noteRecord.updatedAt = new Date();
            await noteRecord.save();

            await api.sendMessage(
                { msg: `Đã xóa dòng ghi chú ${lineNumber}: ${String(removed?.content || "").trim()}` },
                threadId,
                messageType
            );
            return;
        }

        const legacyLines = splitLegacyNoteLines(noteRecord.note || "");
        if (lineNumber > legacyLines.length) {
            await api.sendMessage(
                { msg: `Chỉ có ${legacyLines.length} dòng ghi chú. Không có dòng ${lineNumber}.` },
                threadId,
                messageType
            );
            return;
        }

        const removed = legacyLines.splice(lineNumber - 1, 1)[0];
        noteRecord.note = legacyLines.join("\n");
        noteRecord.updatedAt = new Date();
        await noteRecord.save();

        await api.sendMessage(
            { msg: `Đã xóa dòng ghi chú ${lineNumber}: ${removed}` },
            threadId,
            messageType
        );
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
    handleNoteCommand,
    handleXoaNoteCommand,
};
