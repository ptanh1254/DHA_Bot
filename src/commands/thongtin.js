const fs = require("fs");

const { createUserInfoCard } = require("../design/userCard/renderer");

function getMentionedUserId(message) {
    const mentions = message?.data?.mentions;
    if (!Array.isArray(mentions) || mentions.length === 0) return null;

    const uid = mentions[0]?.uid;
    return uid ? String(uid) : null;
}

async function handleThongTinCommand(api, message, threadId) {
    const messageType = Number(message?.type) || 1;
    const mentionedUserId = getMentionedUserId(message);

    if (!mentionedUserId) {
        await api.sendMessage(
            { msg: "Bạn hãy tag 1 người dùng. Ví dụ: !thongtin @TenNguoiDung" },
            threadId,
            messageType
        );
        return;
    }

    let outputPath;
    try {
        const userInfo = await api.getUserInfo(mentionedUserId);
        const changedProfiles = userInfo?.changed_profiles || {};
        const profile = changedProfiles[mentionedUserId] || Object.values(changedProfiles)[0];

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
                msg: `Thông tin của ${profile.displayName || profile.zaloName || mentionedUserId}`,
                attachments: [outputPath],
            },
            threadId,
            messageType
        );
        console.log(`Đã gửi card thông tin cho user ${mentionedUserId}`);
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

