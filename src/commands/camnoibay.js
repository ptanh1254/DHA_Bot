function buildStatusMessage(prefix, isEnabled) {
    const statusText = isEnabled ? "BẬT" : "TẮT";
    return [
        `Chế độ auto mute từ cấm hiện tại: ${statusText}`,
        `Dùng \`${prefix}camnoibay on\` để bật`,
        `Dùng \`${prefix}camnoibay off\` để tắt`,
    ].join("\n");
}

async function handleCamNoiBayCommand(
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
        const statusMessage = buildStatusMessage(prefix, setting?.bannedWordMuteEnabled !== false);
        await api.sendMessage({ msg: statusMessage }, threadId, messageType);
        return;
    }

    if (normalizedArgs !== "on" && normalizedArgs !== "off") {
        await api.sendMessage(
            {
                msg: `Sai cú pháp. Dùng \`${prefix}camnoibay on\` hoặc \`${prefix}camnoibay off\`.`,
            },
            threadId,
            messageType
        );
        return;
    }

    const shouldEnable = normalizedArgs === "on";
    await GroupSetting.findOneAndUpdate(
        { groupId: threadId },
        { $set: { bannedWordMuteEnabled: shouldEnable } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    await api.sendMessage(
        {
            msg: shouldEnable
                ? "Đã bật auto mute khi dùng từ cấm trong nhóm này."
                : "Đã tắt auto mute từ cấm trong nhóm này.",
        },
        threadId,
        messageType
    );
}

module.exports = {
    handleCamNoiBayCommand,
};
