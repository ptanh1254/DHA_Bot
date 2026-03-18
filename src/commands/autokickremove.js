const { parseUidArg, getMessageType, sendMessage, buildErrorMessage } = require("../utils/commonHelpers");

async function handleAutoKickRemoveCommand(
    api,
    message,
    threadId,
    KickHistory,
    argsText,
    prefix = "!"
) {
    const messageType = getMessageType(message);
    if (!KickHistory) {
        await sendMessage(api, { msg: "Chưa khởi tạo được dữ liệu autokick." }, threadId, messageType);
        return;
    }

    const targetUid = parseUidArg(argsText);
    if (!targetUid) {
        await sendMessage(api, buildErrorMessage(`Nhập UID cần gỡ autokick. Ví dụ: ${prefix}autokickremove 123456789`), threadId, messageType);
        return;
    }

    const result = await KickHistory.deleteOne({ groupId: threadId, userId: targetUid });
    if (!result || result.deletedCount <= 0) {
        await api.sendMessage(
            {
                msg: `Không tìm thấy UID ${targetUid} trong danh sách autokick.`,
            },
            threadId,
            messageType
        );
        return;
    }

    await api.sendMessage(
        {
            msg: `Đã gỡ autokick cho UID ${targetUid}.`,
        },
        threadId,
        messageType
    );
}

module.exports = {
    handleAutoKickRemoveCommand,
};
