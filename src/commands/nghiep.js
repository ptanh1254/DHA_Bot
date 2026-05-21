const fs = require("fs");
const { createCheckImage } = require("../design/check/renderer");
const { getMentionedUserId, pickDisplayName, pickAvatarUrl, getMessageType } = require("../utils/commonHelpers");
const { getProtectedRandomPercent, isProtectedBossUid } = require("../config/protectedUsers");

function pickRandom(items) {
    if (!Array.isArray(items) || items.length === 0) return "";
    const index = Math.floor(Math.random() * items.length);
    return items[index] || items[0] || "";
}

function getKarmaMessage(percent, displayName) {
    const safeName = String(displayName || "Bạn").trim();
    const p = Number(percent) || 0;

    const bands = [
        [
            `${safeName} hiền như cục đất, nghiệp báo chắc chưa tìm thấy địa chỉ rồi.`,
            `${safeName} tâm hồn trong sáng, nghiệp tụ vành môi nhưng môi chỉ nói lời hay.`,
            `${safeName} vibe thánh thiện, kiếp này chắc đi tu quá!`,
            `${safeName} hiền quá mức, chắc nghiệp cũng lười tìm bạn quá.`,
            `${safeName} nhìn hiền vậy chứ cũng có lúc để nghiệp ngủ quên.`,
        ],
        [
            `${safeName} có tí nghiệp nhẹ hều, đủ để bị muỗi đốt vài cái thôi.`,
            `${safeName} sống lỗi nhẹ, nhưng vẫn còn cứu vãn được nha.`,
            `${safeName} nghiệp này chỉ tầm 'ăn vụng không chùi mép'.`,
            `${safeName} nghiệp như gió thoảng, qua rồi là hết.`,
            `${safeName} đôi khi làm xấu chút thôi, còn có thể sửa được.`,
        ],
        [
            `${safeName} nghiệp bắt đầu dày rồi đó, đi đứng cẩn thận kẻo tuột xích xe.`,
            `${safeName} bắt đầu thấy mùi nghiệp quật quanh đây rồi nha.`,
            `${safeName} level nghiệp trung cấp, chuẩn bị nhận 'quà' từ vũ trụ.`,
            `${safeName} nghiệp dính nhẹ như keo, chừa chỗ để tỉnh ngộ.`,
            `${safeName} có vẻ hay gây chuyện nhỏ, chú ý lời ăn tiếng nói nha.`,
        ],
        [
            `${safeName} gánh nghiệp cho cả group hay sao mà nhiều thế?`,
            `${safeName} nghiệp quật hơi đau nha, đề nghị bớt tạo khẩu nghiệp lại.`,
            `${safeName} vibe này là chuẩn bị lên bảng vàng danh dự ngành 'nghiệp'.`,
            `${safeName} nghiệp sáng bừng, ai gặp cũng phải né cho xa.`,
            `${safeName} đang đứng ở top trending của nghiệp rồi đó.`,
        ],
        [
            `${safeName} nghiệp dày như từ điển Tiếng Việt, đề nghị đi chùa gấp!`,
            `${safeName} level nghiệp thượng thừa, bot cũng không dám đứng gần.`,
            `${safeName} coi chừng! Nghiệp nhiều đến mức báo động đỏ luôn rồi.`,
            `${safeName} nghiệp dày như núi, chặng đường tu hành còn dài.`,
            `${safeName} tối nay có lẽ nên cúng dâng một chút để nhẹ lòng.`,
        ],
        [
            `${safeName} chính thức thành 'Trùm Nghiệp', quật phát nào là thốn phát đó!`,
            `${safeName} huyền thoại của sự sống lỗi, nghiệp tụ thành núi luôn rồi.`,
            `${safeName} 💀 Báo động: Nghiệp này chỉ có thể là do kiếp trước phá đình phá chùa.`,
            `${safeName} không ai dám đứng gần, nghiệp bạn quá ghê gớm rồi.`,
            `${safeName} nếu có bốc thăm trúng nghiệp thì bạn đã trúng jackpot.`,
        ],
    ];

    const idx = p <= 20 ? 0 : p <= 40 ? 1 : p <= 60 ? 2 : p <= 80 ? 3 : p <= 95 ? 4 : 5;
    const group = bands[idx] || bands[0];
    return pickRandom(group);
}

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

async function handleNghiepCommand(api, message, threadId, prefix = "!") {
    const messageType = getMessageType(message);
    const targetUserId = getMentionedUserId(message);
    
    if (!targetUserId) {
        await api.sendMessage(
            {
                msg: `Hãy tag người bạn muốn check nghiệp. Ví dụ: ${prefix}nghiep @Tag`,
            },
            threadId,
            messageType
        );
        return;
    }

    const senderUserId = String(message?.data?.uidFrom || "");
    const isBossSender = senderUserId && isProtectedBossUid(senderUserId);
    const isBossTarget = targetUserId && isProtectedBossUid(targetUserId);

    if (isBossSender) {
        const targetProfile = await resolveRealtimeProfile(api, targetUserId);
        const targetDisplayName = pickDisplayName(targetProfile, targetUserId);
        const targetAvatarUrl = pickAvatarUrl(targetProfile);
        const percent = 300;
        const comment = getKarmaMessage(percent, targetDisplayName);

        let outputPath = "";
        try {
            outputPath = await createCheckImage(
                {
                    userId: targetUserId,
                    displayName: targetDisplayName,
                    avatarUrl: targetAvatarUrl,
                    percent,
                    title: "Kết Quả Check Nghiệp",
                    comment,
                },
                {
                    fileName: `nghiep-${threadId}-${targetUserId}-${Date.now()}.png`,
                }
            );

            await api.sendMessage(
                {
                    msg: `Nghiệp của ${targetDisplayName} là ${percent}%\n${comment}`,
                    attachments: [outputPath],
                },
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
        return;
    }

    if (isBossTarget && senderUserId && senderUserId !== targetUserId) {
        const senderProfile = await resolveRealtimeProfile(api, senderUserId);
        const senderDisplayName = pickDisplayName(senderProfile, senderUserId);
        const senderAvatarUrl = pickAvatarUrl(senderProfile);
        const percent = 300;
        const comment = getKarmaMessage(percent, senderDisplayName);

        let outputPath = "";
        try {
            outputPath = await createCheckImage(
                {
                    userId: senderUserId,
                    displayName: senderDisplayName,
                    avatarUrl: senderAvatarUrl,
                    percent,
                    title: "Kết Quả Check Nghiệp",
                    comment,
                },
                {
                    fileName: `nghiep-${threadId}-${senderUserId}-${Date.now()}.png`,
                }
            );

            await api.sendMessage(
                {
                    msg: `Nghiệp của ${senderDisplayName} là ${percent}%\n${comment}`,
                    attachments: [outputPath],
                },
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
        return;
    }

    const profile = await resolveRealtimeProfile(api, targetUserId);
    const displayName = pickDisplayName(profile, targetUserId);
    const avatarUrl = pickAvatarUrl(profile);

    const p = getProtectedRandomPercent(senderUserId, targetUserId);
    const percent = Number.isFinite(p) && p !== null ? p : Math.floor(Math.random() * 101);
    const comment = getKarmaMessage(percent, displayName);

    let outputPath = "";
    try {
        outputPath = await createCheckImage(
            {
                userId: targetUserId,
                displayName,
                avatarUrl,
                percent,
                title: "Kết Quả Check Nghiệp",
                comment: comment,
            },
            {
                fileName: `nghiep-${threadId}-${targetUserId}-${Date.now()}.png`,
            }
        );

        await api.sendMessage(
            {
                msg: `Nghiệp của ${displayName} là ${percent}%\n${comment}`,
                attachments: [outputPath],
            },
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
    handleNghiepCommand,
};
