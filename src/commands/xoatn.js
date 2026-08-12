const { getMessageType, sendMessage } = require("../utils/commonHelpers");

/**
 * Lệnh !xoatn - Xoá tin nhắn được reply/quote
 */
async function handleXoaTnCommand(api, message, threadId, prefix = "!") {
    const messageType = getMessageType(message);
    const quote = message?.data?.quote;

    if (!quote || typeof quote !== "object") {
        await sendMessage(
            api,
            { msg: `Hãy trả lời (reply) vào tin nhắn cần xoá rồi gõ \`${prefix}xoatn\`.` },
            threadId,
            messageType
        );
        return;
    }

    const msgId = String(quote.msgId || quote.globalMsgId || "").trim();
    const cliMsgId = String(quote.cliMsgId || quote.qmsgCliId || msgId || Date.now()).trim();
    const ownerId = String(quote.ownerId || quote.uidFrom || "").trim();

    if (!msgId) {
        await sendMessage(
            api,
            { msg: "Không tìm thấy thông tin tin nhắn cần xoá." },
            threadId,
            messageType
        );
        return;
    }

    try {
        // 1. Thu hồi / Xoá tin nhắn được reply
        if (typeof api.undo === "function") {
            await api.undo({ msgId, cliMsgId }, threadId, message.type).catch(() => {});
        }
        await api.deleteMessage(
            { threadId, type: 1, data: { cliMsgId, msgId, uidFrom: ownerId } },
            false
        ).catch(() => {});

        // 2. Xoá luôn tin nhắn lệnh !xoatn vừa gõ để sạch chat
        const cmdMsgId = String(message?.data?.msgId || "").trim();
        const cmdCliMsgId = String(message?.data?.cliMsgId || cmdMsgId || Date.now()).trim();
        const cmdUserId = String(message?.data?.uidFrom || "").trim();
        if (cmdMsgId) {
            if (typeof api.undo === "function") {
                await api.undo({ msgId: cmdMsgId, cliMsgId: cmdCliMsgId }, threadId, message.type).catch(() => {});
            }
            await api.deleteMessage(
                { threadId, type: 1, data: { cliMsgId: cmdCliMsgId, msgId: cmdMsgId, uidFrom: cmdUserId } },
                false
            ).catch(() => {});
        }
    } catch (error) {
        console.error("[xoatn] Lỗi khi xoá tin nhắn:", error);
    }
}

module.exports = {
    handleXoaTnCommand,
};
