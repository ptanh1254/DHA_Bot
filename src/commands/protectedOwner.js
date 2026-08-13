const {
    getMessageType,
    sendMessage,
    extractUidArgs,
    getMentionedUserIds,
} = require("../utils/commonHelpers");
const {
    addProtectedOwnerUid,
    removeProtectedOwnerUid,
    addAllowedTimUid,
    removeAllowedTimUid,
    getProtectedOwnerList,
    getProtectedTimList,
} = require("../config/protectedUsers");

/**
 * Lệnh quản lý danh sách UID được bảo vệ & UID thả cảm xúc
 * Cú pháp:
 * - !owner add @tag hoặc !owner add <UID>
 * - !owner del @tag hoặc !owner del <UID>
 * - !owner addtim @tag hoặc !owner addtim <UID>
 * - !owner deltim @tag hoặc !owner deltim <UID>
 * - !owner list
 */
async function handleProtectedOwnerCommand(
    api,
    message,
    threadId,
    argsText,
    isSuperAdminUser,
    prefix = "!"
) {
    const messageType = getMessageType(message);

    // Chỉ Admin / SuperAdmin mới được dùng lệnh này
    if (!isSuperAdminUser) {
        await sendMessage(
            api,
            { msg: "❌ Bạn không có quyền sử dụng lệnh quản lý UID bảo vệ này!" },
            threadId,
            messageType
        );
        return;
    }

    const raw = String(argsText || "").trim();
    const parts = raw.split(/\s+/);
    const subCmd = parts[0] ? parts[0].toLowerCase() : "";

    // Nếu gõ !owner hoặc !owner list
    if (!subCmd || subCmd === "list") {
        const ownerList = getProtectedOwnerList();
        const timList = getProtectedTimList();

        const lines = [
            "🛡️ **DANH SÁCH UID ĐƯỢC BẢO VỆ & CẤP QUYỀN** 🛡️",
            "",
            `👑 **UID Chủ Bot / VIP (${ownerList.length}):**`,
            ...ownerList.map((id, i) => `  ${i + 1}. UID ${id}`),
            "",
            `💖 **UID được dùng lệnh thả cảm xúc (${timList.length}):**`,
            ...timList.map((id, i) => `  ${i + 1}. UID ${id}`),
            "",
            "📌 **Cú pháp quản lý:**",
            `➡️ \`${prefix}owner add @tag\` (hoặc UID) : Thêm UID bảo vệ`,
            `➡️ \`${prefix}owner del @tag\` (hoặc UID) : Xoá UID bảo vệ`,
            `➡️ \`${prefix}owner addtim @tag\` (hoặc UID) : Thêm quyền thả cảm xúc`,
            `➡️ \`${prefix}owner deltim @tag\` (hoặc UID) : Xoá quyền thả cảm xúc`,
        ];

        await sendMessage(api, { msg: lines.join("\n") }, threadId, messageType);
        return;
    }

    // Lấy danh sách UID từ mention hoặc arg
    const mentionedIds = getMentionedUserIds(message);
    const manualIds = extractUidArgs(raw);
    const targetIds = [...new Set([...mentionedIds, ...manualIds])];

    if (targetIds.length === 0) {
        await sendMessage(
            api,
            { msg: `❌ Vui lòng tag người dùng hoặc nhập UID hợp lệ!\nVí dụ: \`${prefix}owner add @tên\` hoặc \`${prefix}owner add 7678683608712964658\`` },
            threadId,
            messageType
        );
        return;
    }

    if (subCmd === "add" || subCmd === "addowner") {
        for (const uid of targetIds) {
            await addProtectedOwnerUid(uid);
        }
        await sendMessage(
            api,
            { msg: `✅ Đã THÊM thành công ${targetIds.length} UID (${targetIds.join(", ")}) vào danh sách bảo vệ Chủ Bot!` },
            threadId,
            messageType
        );
        return;
    }

    if (subCmd === "del" || subCmd === "delete" || subCmd === "remove" || subCmd === "delowner") {
        for (const uid of targetIds) {
            await removeProtectedOwnerUid(uid);
        }
        await sendMessage(
            api,
            { msg: `✅ Đã XOÁ thành công ${targetIds.length} UID (${targetIds.join(", ")}) khỏi danh sách bảo vệ Chủ Bot!` },
            threadId,
            messageType
        );
        return;
    }

    if (subCmd === "addtim") {
        for (const uid of targetIds) {
            await addAllowedTimUid(uid);
        }
        await sendMessage(
            api,
            { msg: `✅ Đã THÊM thành công ${targetIds.length} UID (${targetIds.join(", ")}) vào danh sách được thả cảm xúc!` },
            threadId,
            messageType
        );
        return;
    }

    if (subCmd === "deltim" || subCmd === "removetim") {
        for (const uid of targetIds) {
            await removeAllowedTimUid(uid);
        }
        await sendMessage(
            api,
            { msg: `✅ Đã XOÁ thành công ${targetIds.length} UID (${targetIds.join(", ")}) khỏi danh sách thả cảm xúc!` },
            threadId,
            messageType
        );
        return;
    }

    await sendMessage(
        api,
        { msg: `❌ Sai cú pháp. Dùng \`${prefix}owner\` để xem hướng dẫn.` },
        threadId,
        messageType
    );
}

module.exports = {
    handleProtectedOwnerCommand,
};
