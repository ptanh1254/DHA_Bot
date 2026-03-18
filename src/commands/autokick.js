const { normalizeId, parseUidArg, getMessageType, sendMessage, buildErrorMessage } = require("../utils/commonHelpers");

function buildAutoKickStatusMessage(prefix, isEnabled) {
    const statusText = isEnabled ? "BẬT" : "TẮT";
    return [
        `Chế độ auto kick người từng bị kick/rời nhóm hiện tại: ${statusText}`,
        `Dùng \`${prefix}autokick on\` để bật`,
        `Dùng \`${prefix}autokick off\` để tắt`,
        `Dùng \`${prefix}autokick <uid>\` để thêm uid vào danh sách autokick`,
    ].join("\n");
}

async function handleAutoKickCommand(
    api,
    message,
    threadId,
    GroupSetting,
    KickHistory,
    argsText,
    prefix = "!"
) {
    const normalizedArgs = String(argsText || "").trim().toLowerCase();
    const messageType = getMessageType(message);

    // No args - show status
    if (!normalizedArgs) {
        const setting = await GroupSetting.findOne({ groupId: threadId }).lean();
        const statusMessage = buildAutoKickStatusMessage(
            prefix,
            setting?.autoKickRejoinEnabled !== false
        );
        await api.sendMessage({ msg: statusMessage }, threadId, messageType);
        return;
    }

    // "on" or "off" - toggle auto kick mode
    if (normalizedArgs === "on" || normalizedArgs === "off") {
        const shouldEnable = normalizedArgs === "on";
        await GroupSetting.findOneAndUpdate(
            { groupId: threadId },
            { $set: { autoKickRejoinEnabled: shouldEnable } },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        );

        await api.sendMessage(
            {
                msg: shouldEnable
                    ? "Đã bật auto kick: ai từng bị kick/rời nhóm vào lại sẽ bị kick tiếp."
                    : "Đã tắt auto kick người từng bị kick/rời nhóm.",
            },
            threadId,
            messageType
        );
        return;
    }

    // Otherwise treat as UID to add to autokick list
    if (!KickHistory) {
        console.error(`[autokick] KickHistory model không khả dụng`);
        await api.sendMessage(
            { msg: "❌ Chưa khởi tạo được dữ liệu autokick." },
            threadId,
            messageType
        );
        return;
    }

    const targetUid = parseUidArg(argsText);
    if (!targetUid) {
        await api.sendMessage(
            {
                msg: `Nhập UID cần thêm vào autokick. Ví dụ: ${prefix}autokick 123456789`,
            },
            threadId,
            messageType
        );
        return;
    }

    try {
        console.log(`[autokick] Attempting to add UID ${targetUid} to autokick for group ${threadId}`);
        
        const now = new Date();
        const result = await KickHistory.findOneAndUpdate(
            { groupId: threadId, userId: targetUid },
            {
                $setOnInsert: {
                    groupId: threadId,
                    userId: targetUid,
                    kickCount: 1,
                    firstKickAt: now,
                    lastKickAt: now,
                    firstKnownName: "Không rõ tên",
                },
            },
            { upsert: true, returnDocument: "after" }
        );

        console.log(`[autokick] Successfully added UID ${targetUid}, result:`, result ? "OK" : "FAILED");
        
        await api.sendMessage(
            {
                msg: `✅ Đã thêm UID ${targetUid} vào danh sách autokick.`,
            },
            threadId,
            messageType
        );
    } catch (error) {
        console.error(`[autokick] Error adding uid ${targetUid}:`, error.message || error);
        await api.sendMessage(
            {
                msg: `❌ Lỗi khi thêm UID vào danh sách autokick: ${error.message || "Lỗi không xác định"}`,
            },
            threadId,
            messageType
        );
    }
}

module.exports = {
    handleAutoKickCommand,
};
