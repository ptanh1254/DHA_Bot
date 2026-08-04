const { BotSetting } = require("../db/botSettingModel");
const { getMessageType } = require("../utils/commonHelpers");

async function handleXoaQrCommand(api, message, threadId, argsText, isSuperAdminUser, prefix = "!") {
    if (!isSuperAdminUser) {
        const messageType = getMessageType(message);
        await api.sendMessage({ msg: "❌ Chỉ Admin Bot (Tứn Anh) mới được dùng lệnh này!" }, threadId, messageType);
        return;
    }

    const arg = argsText.toLowerCase().trim();
    let setting = await BotSetting.findOne({ settingId: "global" }).lean();
    if (!setting) {
        setting = { deleteQrEnabled: true };
    }

    let newState = setting.deleteQrEnabled;
    if (arg === "on") newState = true;
    else if (arg === "off") newState = false;
    else newState = !setting.deleteQrEnabled; // toggle

    await BotSetting.findOneAndUpdate(
        { settingId: "global" },
        { $set: { deleteQrEnabled: newState } },
        { upsert: true, new: true }
    );

    const msg = newState
        ? "✅ Đã BẬT chức năng ngầm xoá QR trên toàn bộ hệ thống Bot.\n\nẢnh chứa mã QR từ các UID bị hạn chế sẽ tự động bị xoá ở bất kỳ nhóm nào."
        : "❌ Đã TẮT chức năng ngầm xoá QR trên toàn bộ hệ thống Bot.\n\nCác UID bị hạn chế có thể gửi ảnh chứa QR bình thường ở mọi nhóm.";

    const messageType = getMessageType(message);
    await api.sendMessage({ msg }, threadId, messageType);
    console.log(`[xoaqr] Đã ${newState ? "BẬT" : "TẮT"} chức năng xoá QR toàn cục`);
}

module.exports = {
    handleXoaQrCommand,
};
