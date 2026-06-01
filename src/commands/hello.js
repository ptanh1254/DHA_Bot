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
        commandName: "hello",
        messages: {
            enabled: "Loa loa loa! 📣 Đã BẬT còi báo động chào mừng tân binh DHA. Ai vào là réo tên ngay!",
            disabled: "Suỵt! 🤐 Đã TẮT còi báo động chào mừng DHA. Cửa vào đang để chế độ đi nhẹ nói khẽ.",
        },
        statusLabel: "Chế độ welcome hiện tại",
    });
}

module.exports = {
    handleHelloCommand,
};
