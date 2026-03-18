const { getMessageType, sendMessage, handleToggleCommand } = require("../utils/commonHelpers");

async function handleHelloCommand(
    api,
    message,
    threadId,
    GroupSetting,
    argsText,
    prefix = "!"
) {
    await handleToggleCommand(api, message, threadId, GroupSetting, argsText, prefix, {
        settingKey: "welcomeEnabled",
        messages: {
            enabled: "Đã bật chào mừng thành viên mới cho nhóm này.",
            disabled: "Đã tắt chào mừng thành viên mới cho nhóm này.",
        },
        statusLabel: "Chế độ welcome hiện tại",
    });
}

module.exports = {
    handleHelloCommand,
};
