const { getMessageType, sendMessage } = require("../utils/commonHelpers");

// UID được phép dùng lệnh !imlang (chỉ định từ user request, nếu sau này cần cấu hình thì đưa ra config riêng)
const ALLOWED_UIDS = [
    "9030208052692663539" // Thêm các UID khác vào đây nếu muốn
];

async function handleImlangCommand(
    api,
    message,
    threadId,
    MutedMember,
    prefix = "!"
) {
    const messageType = getMessageType(message);
    const userId = String(message?.data?.uidFrom || "").trim();
    const userName = typeof message?.data?.dName === "string" && message.data.dName.trim()
        ? message.data.dName.trim()
        : "Người dùng";

    // Kiểm tra quyền
    if (!ALLOWED_UIDS.includes(userId)) {
        await sendMessage(
            api,
            { msg: "Bạn không nằm trong danh sách được phép sử dụng lệnh này." },
            threadId,
            messageType
        );
        return;
    }

    // Khoá mõm bản thân vô thời hạn (cần qtv mở)
    const muteUntil = null;
    const requiresManualUnmute = true;
    const muteReason = "Tự khoá mõm (lệnh !imlang)";

    const updateOp = {
        updateOne: {
            filter: { groupId: threadId, userId },
            update: {
                $set: {
                    mutedByUserId: userId, // Tự khoá
                    mutedByName: userName,
                    mutedAt: new Date(),
                    muteUntil,
                    requiresManualUnmute,
                    muteSource: "imlang",
                    muteReason,
                    blockedMsgCount: 0,
                },
                $setOnInsert: {
                    groupId: threadId,
                    userId,
                },
            },
            upsert: true,
        },
    };

    await MutedMember.bulkWrite([updateOp], { ordered: false });

    await sendMessage(
        api,
        { msg: `${userName} đã tự khoá mõm mình` },
        threadId,
        messageType
    );
}

module.exports = {
    handleImlangCommand,
    ALLOWED_UIDS
};
