const { getMessageType, sendMessage, handleToggleCommand } = require("../utils/commonHelpers");

async function handleCamNoiBayCommand(
    api,
    message,
    threadId,
    GroupSetting,
    argsText,
    prefix = "!"
) {
    await handleToggleCommand(api, message, threadId, GroupSetting, argsText, prefix, {
        settingKey: "bannedWordMuteEnabled",
        messages: {
            enabled: "Đã bật auto mute khi dùng từ cấm trong nhóm này.",
            disabled: "Đã tắt auto mute từ cấm trong nhóm này.",
        },
        statusLabel: "Chế độ auto mute từ cấm hiện tại",
    });
}

module.exports = {
    handleCamNoiBayCommand,
};
