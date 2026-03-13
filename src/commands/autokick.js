function buildAutoKickStatusMessage(prefix, isEnabled) {
    const statusText = isEnabled ? "BẬT" : "TẮT";
    return [
        `Chế độ auto kick người từng bị kick hiện tại: ${statusText}`,
        `Dùng \`${prefix}autokick on\` để bật`,
        `Dùng \`${prefix}autokick off\` để tắt`,
    ].join("\n");
}

async function handleAutoKickCommand(
    api,
    message,
    threadId,
    GroupSetting,
    argsText,
    prefix = "!"
) {
    const normalizedArgs = String(argsText || "").trim().toLowerCase();

    const messageType = Number(message?.type) || 1;

    if (!normalizedArgs) {
        const setting = await GroupSetting.findOne({ groupId: threadId }).lean();
        const statusMessage = buildAutoKickStatusMessage(
            prefix,
            setting?.autoKickRejoinEnabled !== false
        );
        await api.sendMessage({ msg: statusMessage }, threadId, messageType);
        return;
    }

    if (normalizedArgs !== "on" && normalizedArgs !== "off") {
        await api.sendMessage(
            {
                msg: `Sai cú pháp. Dùng \`${prefix}autokick on\` hoặc \`${prefix}autokick off\`.`,
            },
            threadId,
            messageType
        );
        return;
    }

    const shouldEnable = normalizedArgs === "on";
    await GroupSetting.findOneAndUpdate(
        { groupId: threadId },
        { $set: { autoKickRejoinEnabled: shouldEnable } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    await api.sendMessage(
        {
            msg: shouldEnable
                ? "Đã bật auto kick: ai từng bị kick vào lại sẽ bị kick tiếp."
                : "Đã tắt auto kick người từng bị kick.",
        },
        threadId,
        messageType
    );
}

module.exports = {
    handleAutoKickCommand,
};
