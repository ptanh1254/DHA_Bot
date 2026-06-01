const { BotResponse } = require("../db/botResponseModel");

const responsesMap = {};

const DEFAULT_RESPONSES = [
    {
        key: "hello_msg",
        text: "Chào cậu {userName}! Mình là DHA Bot.\nĐể biết cách sử dụng, hãy gõ {prefix}help nha!",
        description: "Lời chào khi dùng lệnh !hello",
        category: "Lệnh Tương Tác"
    },
    {
        key: "hello_enabled",
        text: "Đã bật chào mừng thành viên mới cho nhóm này.",
        description: "Lời thông báo khi bật tính năng chào mừng",
        category: "Lệnh Cấu Hình"
    },
    {
        key: "hello_disabled",
        text: "Đã tắt chào mừng thành viên mới cho nhóm này.",
        description: "Lời thông báo khi tắt tính năng chào mừng",
        category: "Lệnh Cấu Hình"
    },
    {
        key: "random_success",
        text: "🎉 Chúc mừng @{userName} đã được vòng quay gọi tên! 🎉",
        description: "Lời chúc mừng khi lệnh !random chọn được người",
        category: "Lệnh Tương Tác"
    },
    {
        key: "random_fail",
        text: "❌ Đã xảy ra lỗi khi tạo vòng quay may mắn.",
        description: "Lời thông báo khi vòng quay bị lỗi",
        category: "Lệnh Tương Tác"
    },
    {
        key: "help_msg",
        text: "📜 Hướng dẫn sử dụng DHABot:",
        description: "Tiêu đề của lệnh !help",
        category: "Lệnh Tương Tác"
    },
    {
        key: "kick_success",
        text: "Đã đá {userName} ra khỏi nhóm!",
        description: "Thông báo khi kick thành công",
        category: "Quản Lý & Kiểm Duyệt"
    },
    {
        key: "kick_fail",
        text: "Không thể kick {userName}. Bot chưa đủ quyền quản trị viên!",
        description: "Thông báo khi kick thất bại",
        category: "Quản Lý & Kiểm Duyệt"
    },
    {
        key: "mute_success",
        text: "Đã cấm chat {userName}.",
        description: "Thông báo khi cấm chat thành công",
        category: "Quản Lý & Kiểm Duyệt"
    },
    {
        key: "unmute_success",
        text: "Đã bỏ cấm chat cho {userName}.",
        description: "Thông báo khi bỏ cấm chat",
        category: "Quản Lý & Kiểm Duyệt"
    },
    {
        key: "afk_on",
        text: "{userName} đã treo máy. Lý do: {reason}",
        description: "Thông báo khi bật AFK",
        category: "Lệnh Tương Tác"
    },
    {
        key: "afk_off",
        text: "Chào mừng {userName} đã quay trở lại!",
        description: "Thông báo khi tắt AFK",
        category: "Lệnh Tương Tác"
    },
    {
        key: "autokick_fail",
        text: "AutoKick thất bại với {userName}.",
        description: "Thông báo khi AutoKick thất bại",
        category: "Quản Lý & Kiểm Duyệt"
    },
    {
        key: "autokick_leave",
        text: "🚫 {userName} đã từng rời nhóm và vừa bị auto kick khi vào lại.\nNgười này đã tự rời nhóm trước đó.",
        description: "Thông báo auto kick khi thành viên cũ tự rời nhóm vào lại",
        category: "Sự Kiện Nhóm"
    },
    {
        key: "autokick_kicked",
        text: "🚫 {userName} đã từng bị kick và vừa bị auto kick.\nNgười này đã từng bị kick bởi: {kickedBy}",
        description: "Thông báo auto kick khi thành viên đã từng bị kick vào lại",
        category: "Sự Kiện Nhóm"
    },
    {
        key: "antijoin_kick",
        text: "Bật chế độ Anti-Join: Đã chặn {userName} vào nhóm.",
        description: "Thông báo khi Anti-Join tự động chặn thành viên",
        category: "Sự Kiện Nhóm"
    },
    {
        key: "welcome_msg",
        text: "Chào mừng {userName} đã gia nhập nhóm!",
        description: "Lời chào mừng thành viên mới mặc định",
        category: "Sự Kiện Nhóm"
    },
    {
        key: "leave_msg",
        text: "{userName} đã rời khỏi nhóm.",
        description: "Thông báo khi có người tự rời nhóm mặc định",
        category: "Sự Kiện Nhóm"
    },
    {
        key: "mute_notice",
        text: "{mentionText} đang bị mute {remainingLabel}.\nTin nhắn vi phạm đã bị xóa ({strikeCount}).",
        description: "Cảnh báo khi người bị mute cố tình chat",
        category: "Quản Lý & Kiểm Duyệt"
    },
    {
        key: "auto_mute_notice",
        text: "{mentionText} vừa dùng từ cấm \"{matchedWord}\".\nLần vi phạm từ cấm: {strikeCount}.\n{muteLabel}",
        description: "Thông báo khi bị Auto Mute do vi phạm từ cấm",
        category: "Quản Lý & Kiểm Duyệt"
    }
];

async function loadBotResponses() {
    try {
        const responses = await BotResponse.find({}).lean();
        
        // Xóa map cũ
        for (const key in responsesMap) {
            delete responsesMap[key];
        }

        const existingKeys = new Set();
        for (const r of responses) {
            responsesMap[r.key] = r.text;
            existingKeys.add(r.key);
        }

        // Seed missing default responses
        let newAdded = 0;
        for (const def of DEFAULT_RESPONSES) {
            if (!existingKeys.has(def.key)) {
                await BotResponse.create(def);
                responsesMap[def.key] = def.text;
                newAdded++;
            }
        }
        
        console.log(`[BotResponse] Đã nạp ${Object.keys(responsesMap).length} lời thoại (${newAdded} lời thoại mới).`);
    } catch (e) {
        console.error("[BotResponse] Lỗi nạp lời thoại từ DB:", e);
    }
}

function getBotResponse(key, variables = {}) {
    let text = responsesMap[key];
    
    // Nếu chưa có trong DB, tìm trong default
    if (!text) {
        const def = DEFAULT_RESPONSES.find(r => r.key === key);
        text = def ? def.text : key;
    }

    // Thay thế biến (VD: {userName} -> giá trị)
    for (const [vKey, vValue] of Object.entries(variables)) {
        const regex = new RegExp(`{${vKey}}`, 'g');
        text = text.replace(regex, String(vValue));
    }
    
    return text;
}

module.exports = {
    loadBotResponses,
    getBotResponse,
    DEFAULT_RESPONSES
};
