function buildStatusMessage(prefix, isEnabled) {
    const statusText = isEnabled ? "BẬT" : "TẮT";
    return [
        `Chế độ welcome hiện tại: ${statusText}`,
        `Dùng \`${prefix}hello on\` để bật`,
        `Dùng \`${prefix}hello off\` để tắt`,
    ].join("\n");
}

async function handleHelloCommand(
    api,
    message,
    threadId,
    GroupSetting,
    argsText,
    prefix = "!"
) {
    const normalizedArgs = String(argsText || "").trim().toLowerCase();

    if (!normalizedArgs) {
        const setting = await GroupSetting.findOne({ groupId: threadId }).lean();
        const statusMessage = buildStatusMessage(prefix, setting?.welcomeEnabled !== false);
        await api.sendMessage({ msg: statusMessage }, threadId, message.type);
        return;
    }

    if (normalizedArgs !== "on" && normalizedArgs !== "off") {
        await api.sendMessage(
            {
                msg: `Sai cú pháp. Dùng \`${prefix}hello on\` hoặc \`${prefix}hello off\`.`,
            },
            threadId,
            message.type
        );
        return;
    }

    const shouldEnable = normalizedArgs === "on";
    await GroupSetting.findOneAndUpdate(
        { groupId: threadId },
        { $set: { welcomeEnabled: shouldEnable } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    await api.sendMessage(
        {
            msg: shouldEnable
                ? "Đã bật chào mừng thành viên mới cho nhóm này."
                : "Đã tắt chào mừng thành viên mới cho nhóm này.",
        },
        threadId,
        message.type
    );
}

module.exports = {
    handleHelloCommand,
};
