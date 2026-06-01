const fs = require("fs");
const { getMentionedTargets, getMessageType, pickDisplayName, pickAvatarUrl, normalizeId } = require("../utils/commonHelpers");
const { createLuckyWheelVideo } = require("../design/luckyWheel/renderer");

async function resolveRealtimeProfile(api, userId) {
    try {
        const info = await api.getUserInfo(userId);
        const changedProfiles = info?.changed_profiles || {};
        const profile = changedProfiles[userId] || Object.values(changedProfiles)[0];
        return profile && typeof profile === "object" ? profile : null;
    } catch (_) {
        return null;
    }
}

async function buildParticipants(api, targets) {
    const profiles = await Promise.all(
        targets.map((target) => resolveRealtimeProfile(api, target.userId))
    );

    return targets.map((target, index) => {
        const profile = profiles[index] || {};
        const userId = normalizeId(target.userId) || String(target.userId || "").trim();
        const displayName = pickDisplayName(profile, userId) || target.displayName || `UID ${userId}`;

        const avatarUrl = pickAvatarUrl(profile) || "";

        return {
            userId,
            displayName: String(displayName || "").replace(/^@+/, "").trim() || `UID ${userId}`,
            avatarUrl
        };
    });
}

async function handleRandomCommand(api, message, threadId, prefix = "!") {
    const messageType = getMessageType(message);
    const mentionedTargets = getMentionedTargets(message);

    if (mentionedTargets.length < 2) {
        await api.sendMessage(
            {
                msg: `⚠️ Lệnh này cần tag ít nhất 2 người để chơi vòng quay may mắn.\nCách dùng: ${prefix}random @nguoi1 @nguoi2 ...`,
            },
            threadId,
            messageType
        );
        return;
    }

    let videoPath = "";
    try {
        const preparingMsgRes = await api.sendMessage({ msg: "🎬 Đang chuẩn bị vòng quay may mắn, đợi xíu nhé..." }, threadId, messageType);

        const participants = await buildParticipants(api, mentionedTargets);
        
        // Pick winner
        const winnerIndex = Math.floor(Math.random() * participants.length);
        const winner = participants[winnerIndex];

        // Generate video with full participants (for names and avatars)
        videoPath = await createLuckyWheelVideo(participants, winnerIndex);
        
        // Send text message first
        const msgText = `🎉 Đinh đinh đinh đàng đàng đàng! Chúc mừng tân lang tân nương @${winner.displayName} đã được vòng quay gọi tên! Đãi tiệc đi nào! 🍻`;
        
        // Delete the preparing message
        try {
            if (preparingMsgRes && preparingMsgRes.message && preparingMsgRes.message.data) {
                await api.undo(preparingMsgRes.message.data, threadId, messageType);
            }
        } catch (e) {
            console.error("Failed to undo preparing message:", e);
        }

        const textMsgRes = await api.sendMessage(
            {
                msg: msgText,
                mentions: [
                    {
                        pos: msgText.indexOf(`@${winner.displayName}`),
                        len: `@${winner.displayName}`.length,
                        uid: String(winner.userId)
                    }
                ]
            },
            threadId,
            messageType
        );

        // Send the generated gif directly
        // ZCA-JS will automatically upload and format it as a native animated image
        const videoMsgRes = await api.sendMessage({ msg: "Vòng Quay May Mắn", attachments: [videoPath] }, threadId, messageType);
        
        // Clean up video locally
        try { fs.unlinkSync(videoPath); } catch(e) {}

        // Schedule deletion of the bot's messages after 60 seconds
        setTimeout(async () => {
            try {
                if (textMsgRes && textMsgRes.message && textMsgRes.message.data) {
                    await api.undo(textMsgRes.message.data, threadId, messageType);
                }
                if (videoMsgRes && videoMsgRes.message && videoMsgRes.message.data) {
                    await api.undo(videoMsgRes.message.data, threadId, messageType);
                } else if (videoMsgRes && videoMsgRes.attachment && videoMsgRes.attachment.length > 0 && videoMsgRes.attachment[0].data) {
                    await api.undo(videoMsgRes.attachment[0].data, threadId, messageType);
                }
            } catch (err) {
                console.error("Failed to auto-delete random messages:", err);
            }
        }, 60000);

    } catch (err) {
        console.error("Lỗi khi tạo vòng quay may mắn:", err);
        await api.sendMessage({ msg: "❌ Đã xảy ra lỗi khi tạo vòng quay may mắn." }, threadId);
    } finally {
        // Cleanup
        if (videoPath && fs.existsSync(videoPath)) {
            try {
                fs.unlinkSync(videoPath);
            } catch (cleanupErr) {
                console.error("Failed to delete temp video file:", cleanupErr);
            }
        }
    }
}

module.exports = {
    handleRandomCommand
};
