const { sendMessage } = require("../utils/commonHelpers");
const { CommandAlias } = require("../db/commandAliasModel");
const { loadAliases } = require("../runtime/aliasManager");

async function handleAliasCommand(
    api,
    message,
    threadId,
    argsText,
    userId,
    isSuperAdminUser
) {
    // Chỉ BQT hoặc Super Admin được dùng lệnh này (đã được lọc ở createMessageHandler)
    
    // argsText: "nghiep ng" hoặc "!nghiep !ng"
    const parts = argsText.trim().split(/\s+/);
    
    if (parts.length < 2) {
        await sendMessage(api, "⚠️ Sai cú pháp! Vui lòng dùng: !alias <lệnh_gốc> <lệnh_mới>\nVí dụ: !alias nghiep ng", threadId);
        return;
    }

    let originalCmd = parts[0].toLowerCase();
    let customAlias = parts[1].toLowerCase();

    // Tự động thêm dấu ! nếu người dùng quên
    if (!originalCmd.startsWith("!")) originalCmd = "!" + originalCmd;
    if (!customAlias.startsWith("!")) customAlias = "!" + customAlias;

    try {
        await CommandAlias.findOneAndUpdate(
            { alias: customAlias },
            {
                $set: {
                    alias: customAlias,
                    originalCommand: originalCmd,
                    description: `Tạo từ chat bởi ${userId}`
                }
            },
            { upsert: true }
        );

        // Nạp lại alias vào bộ nhớ để có hiệu lực tức thì
        await loadAliases();

        await sendMessage(api, `✅ Đã tạo alias thành công!\nTừ giờ gõ ${customAlias} sẽ có tác dụng như ${originalCmd}`, threadId);
    } catch (error) {
        console.error("Lỗi khi tạo alias:", error);
        await sendMessage(api, "⚠️ Đã có lỗi xảy ra khi lưu alias vào hệ thống.", threadId);
    }
}

module.exports = {
    handleAliasCommand,
};
