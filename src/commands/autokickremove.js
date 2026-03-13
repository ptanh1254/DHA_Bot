function normalizeId(rawId) {
    if (rawId === null || rawId === undefined) return "";
    return String(rawId).replace(/_0$/, "").trim();
}

function parseUidArg(rawArgs) {
    const value = String(rawArgs || "").trim();
    if (!value) return "";

    const firstToken = value.split(/\s+/)[0];
    return normalizeId(firstToken);
}

async function handleAutoKickRemoveCommand(
    api,
    message,
    threadId,
    KickHistory,
    argsText,
    prefix = "!"
) {
    const messageType = Number(message?.type) || 1;
    if (!KickHistory) {
        await api.sendMessage(
            { msg: "Chưa khởi tạo được dữ liệu autokick." },
            threadId,
            messageType
        );
        return;
    }

    const targetUid = parseUidArg(argsText);
    if (!targetUid) {
        await api.sendMessage(
            {
                msg: `Nhập UID cần gỡ autokick. Ví dụ: ${prefix}autokickremove 123456789`,
            },
            threadId,
            messageType
        );
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
