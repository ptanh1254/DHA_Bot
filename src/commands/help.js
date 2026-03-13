function buildHelpPart1(prefix = "!") {
    return [
        "📘 HƯỚNG DẪN LỆNH DHA BOT",
        "",
        "⚡ LƯỚI ÝCHUNG:",
        "• Các chế độ on/off (hello, kick) áp dụng theo từng nhóm",
        "• Lệnh cần tag: check, checktt, thongtin, kick, mute, unmute",
        "• Mặc định: chủ nhóm/phó nhóm được dùng lệnh admin",
        "• Người dùng phổ thông bị cảnh báo 5 lần = bị kick",
    ].join("\n");
}

function buildHelpPart2(prefix = "!") {
    return [
        "🎉 1. NHÓM CHÀO MỪNG",
        "",
        `${prefix}hello - Xem trạng thái chào mừng`,
        `${prefix}hello on - Bật chào mừng thành viên mới`,
        `${prefix}hello off - Tắt chào mừng`,
    ].join("\n");
}

function buildHelpPart3(prefix = "!") {
    return [
        "🚀 2. NHÓM KICK / RỜI NHÓM",
        "",
        `${prefix}kick - Xem trạng thái thông báo kick`,
        `${prefix}kick on - Bật thông báo kick`,
        `${prefix}kick off - Tắt thông báo kick`,
        `${prefix}kick @user - Kick người dùng được tag`,
        `${prefix}autokick - Xem trạng thái auto kick`,
        `${prefix}autokick on/off - Bật/tắt auto kick`,
        `${prefix}autokicklist - Danh sách auto kick`,
        `${prefix}autokickremove <uid> - Gỡ UID khỏi auto kick`,
    ].join("\n");
}

function buildHelpPart4(prefix = "!") {
    return [
        "🔇 3. NHÓM KIỂM SOÁT CHAT",
        "",
        `${prefix}mute @user - Mute người dùng`,
        `${prefix}unmute @user - Gỡ mute`,
        `${prefix}camnoibay - Xem trạng thái auto mute từ cấm`,
        `${prefix}camnoibay on - Bật auto mute từ cấm`,
        `${prefix}camnoibay off - Tắt auto mute từ cấm`,
    ].join("\n");
}

function buildHelpPart5(prefix = "!") {
    return [
        "👨‍💼 4. NHÓM PHÂN QUYỀN LỆNH",
        "",
        `${prefix}addqtv @user - Thêm người vào danh sách bot`,
        `${prefix}removeqtv @user - Gỡ người khỏi danh sách bot`,
    ].join("\n");
}

function buildHelpPart6(prefix = "!") {
    return [
        "📊 5. NHÓM THỐNG KÊ CHAT",
        "",
        `${prefix}xhchat - Top chat theo ngày (reset 0h VN)`,
        `${prefix}xhchatthang - Top chat theo tháng`,
        `${prefix}xhchattong - Top chat tổng tích lũy`,
        `${prefix}rschat - Reset điểm chat hiện tại`,
    ].join("\n");
}

function buildHelpPart7(prefix = "!") {
    return [
        "👤 6. NHÓM TRA CỨU THÀNH VIÊN",
        "",
        `${prefix}checktt @user - Xem card thống kê chi tiết`,
        `${prefix}check @user - Lệnh trêu vui (random %)`,
        `${prefix}ingame <tên> - Lưu tên ingame của bạn`,
        `${prefix}xoaingame @user - Xóa ingame thành viên`,
        `${prefix}thongtin @user - Xem thông tin profile`,
    ].join("\n");
}

function buildHelpPart8(prefix = "!") {
    return [
        "❓ 7. TRỢ GIÚP",
        "",
        `${prefix}help - Hiển thị bảng hướng dẫn này`,
    ].join("\n");
}

async function handleHelpCommand(api, message, threadId, prefix = "!") {
    const messageType = Number(message?.type) || 1;
    const parts = [
        buildHelpPart1(prefix),
        buildHelpPart2(prefix),
        buildHelpPart3(prefix),
        buildHelpPart4(prefix),
        buildHelpPart5(prefix),
        buildHelpPart6(prefix),
        buildHelpPart7(prefix),
        buildHelpPart8(prefix),
    ];
    
    for (const part of parts) {
        try {
            await api.sendMessage({ msg: part }, threadId, messageType);
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
            console.error("Lỗi gửi help:", error);
        }
    }
}

module.exports = {
    handleHelpCommand,
};
