const { getMessageType, handleToggleCommand } = require("../utils/commonHelpers");

async function handlePreventRecallCommand(api, message, threadId, GroupSetting, argsText, prefix = "!") {
    await handleToggleCommand(api, message, threadId, GroupSetting, argsText, prefix, {
        settingKey: "preventRecallEnabled",
        messages: {
            enabled: "✅ Đã bật chế độ 'Chống thu hồi'\n\nTừ giờ, tin nhắn bị thu hồi sẽ được bot gửi lại nội dung.",
            disabled: "❌ Đã tắt chế độ 'Chống thu hồi'\n\nTin nhắn bị thu hồi sẽ không được gửi lại nào.",
        },
        statusLabel: "Chế độ 'Chống thu hồi' hiện tại",
    });
    console.log(`[chongthuhoi] Đổi trạng thái chế độ chống thu hồi cho nhóm ${threadId}`);
}

module.exports = {
    handlePreventRecallCommand,
};
