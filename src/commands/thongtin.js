const fs = require("fs");

const { createUserInfoCard } = require("../design/userCard/renderer");
const { getMentionedUserId, getMessageType } = require("../utils/commonHelpers");

async function handleThongTinCommand(api, message, threadId) {
    const messageType = getMessageType(message);
    const senderUserId = String(message?.data?.uidFrom || "").replace(/_\d+$/, "").trim();
    const mentionedUserId = getMentionedUserId(message);
    // Nếu không tag ai → xem thông tin của chính mình
    const targetUserId = mentionedUserId || senderUserId;

    if (!targetUserId) {
        await api.sendMessage(
            { msg: "Không xác định được người dùng. Vui lòng thử lại!" },
            threadId,
            messageType
        );
        return;
    }

    let outputPath;
    try {
        const userInfo = await api.getUserInfo(targetUserId);
        const changedProfiles = userInfo?.changed_profiles || {};
        const profile = changedProfiles[targetUserId] || Object.values(changedProfiles)[0];

        if (!profile) {
            await api.sendMessage(
                { msg: "Không lấy được thông tin người được tag. Thử lại nhé!" },
                threadId,
                messageType
            );
            return;
        }

        outputPath = await createUserInfoCard(profile);
        await api.sendMessage(
            {
                msg: `Thông tin của ${profile.displayName || profile.zaloName || targetUserId}`,
                attachments: [outputPath],
            },
            threadId,
            messageType
        );
        console.log(`Đã gửi card thông tin cho user ${targetUserId}`);
    } catch (error) {
        console.error("Lỗi command !thongtin:", error);
        await api.sendMessage(
            { msg: "Lỗi tạo ảnh thông tin. Thử lại sau nhé!" },
            threadId,
            messageType
        );
    } finally {
        if (outputPath && fs.existsSync(outputPath)) {
            try {
                fs.unlinkSync(outputPath);
            } catch (_) {}
        }
    }
}

module.exports = {
    handleThongTinCommand,
};

