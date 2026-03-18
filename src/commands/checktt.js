const fs = require("fs");

const { createCheckTTCard } = require("../design/checktt/renderer");
const { UserNote } = require("../db/userNoteModel");
const { getMentionedUserId, pickDisplayName, pickAvatarUrl, getMessageType } = require("../utils/commonHelpers");

function formatCount(num) {
    return new Intl.NumberFormat("vi-VN").format(Number(num) || 0);
}

function formatJoinDateVN(dateLike) {
    if (!dateLike) return "Chưa có dữ liệu";
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) return "Chưa có dữ liệu";

    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const mo = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${hh}:${mm} ${dd}/${mo}/${yyyy}`;
}

function formatAddedByLabel(addedByName, addedByUserId) {
    const safeName = typeof addedByName === "string" ? addedByName.trim() : "";
    const safeId = String(addedByUserId || "").trim();

    if (safeName && safeId && safeName !== `UID ${safeId}`) {
        return `${safeName} (UID: ${safeId})`;
    }
    if (safeName) return safeName;
    if (safeId) return `UID ${safeId}`;
    return "Chưa có dữ liệu";
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

async function aggregateUserStats(User, threadId, userId) {
    const rows = await User.aggregate([
        { $match: { groupId: threadId, userId } },
        {
            $group: {
                _id: null,
                msgCount: { $sum: { $ifNull: ["$msgCount", 0] } },
                totalMsgCount: { $sum: { $ifNull: ["$totalMsgCount", 0] } },
                joinDate: { $min: "$joinDate" },
                displayName: { $max: "$displayName" },
                avatarUrl: { $max: "$avatarUrl" },
                addedByUserId: { $max: "$addedByUserId" },
                addedByName: { $max: "$addedByName" },
                ingameName: { $max: "$ingameName" },
            },
        },
    ]);

    return rows[0] || null;
}

async function handleCheckTTCommand(api, message, threadId, User, prefix = "!") {
    const messageType = getMessageType(message);
    const targetUserId = getMentionedUserId(message);
    if (!targetUserId) {
        await api.sendMessage(
            { msg: `Bạn hãy tag 1 người dùng. Ví dụ: ${prefix}checktt @TenNguoiDung` },
            threadId,
            messageType
        );
        return;
    }

    const realtimeProfile = await resolveRealtimeProfile(api, targetUserId);
    const realtimeName = pickDisplayName(realtimeProfile, targetUserId);
    const realtimeAvatar = pickAvatarUrl(realtimeProfile);

    const now = new Date();
    const update = {
        $setOnInsert: {
            groupId: threadId,
            userId: targetUserId,
            msgCount: 0,
            totalMsgCount: 0,
            joinDate: now,
        },
    };
    if (realtimeName || realtimeAvatar) {
        update.$set = {};
        if (realtimeName) {
            update.$set.displayName = realtimeName;
        }
        if (realtimeAvatar) {
            update.$set.avatarUrl = realtimeAvatar;
        }
    }

    await User.findOneAndUpdate({ groupId: threadId, userId: targetUserId }, update, {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
    });

    const aggregated = await aggregateUserStats(User, threadId, targetUserId);
    const displayName = realtimeName || aggregated?.displayName || `UID ${targetUserId}`;
    const avatarUrl = realtimeAvatar || aggregated?.avatarUrl || "";
    const totalMsgCount = Number(aggregated?.totalMsgCount) || 0;
    const joinDate = aggregated?.joinDate || now;
    const addedByLabel = formatAddedByLabel(aggregated?.addedByName, aggregated?.addedByUserId);
    const ingameName = String(aggregated?.ingameName || "").trim();

    // Get user note
    const userNoteRecord = await UserNote.findOne({ groupId: threadId, userId: targetUserId });
    const userNote = userNoteRecord?.note || "";

    let outputPath = "";
    try {
        outputPath = await createCheckTTCard({
            userId: targetUserId,
            displayName,
            avatarUrl,
            totalMsgCount,
            joinDate,
            addedByLabel,
            ingameName,
            userNote,
        });

        const messageLines = [
            `${displayName}`,
            `Ingame: ${ingameName || "Chưa cập nhật"}`,
            `Vào nhóm: ${formatJoinDateVN(joinDate)}`,
            `Người thêm/duyệt: ${addedByLabel}`,
            `Tổng tin nhận tích lũy: ${formatCount(totalMsgCount)}`,
        ];

        if (userNote) {
            let noteDisplay = `Ghi chú: ${userNote}`;
            const noteParts = [];
            
            if (userNoteRecord?.createdByName && String(userNoteRecord.createdByName).trim()) {
                noteParts.push(userNoteRecord.createdByName);
            }
            if (userNoteRecord?.updatedAt) {
                noteParts.push(formatJoinDateVN(userNoteRecord.updatedAt));
            }
            
            if (noteParts.length > 0) {
                noteDisplay += ` (${noteParts.join(" - ")})`;
            }
            messageLines.push(noteDisplay);
        }

        await api.sendMessage(
            {
                msg: messageLines.join("\n"),
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
    handleCheckTTCommand,
};
