// Các emoji theo chủ đề
const EMOJIS = {
    // Status
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
    
    // Màu sắc
    pink: "💗",
    red: "❤️",
    orange: "🧡",
    yellow: "💛",
    green: "💚",
    blue: "💙",
    purple: "💜",
    
    // Hành động
    send: "📤",
    receive: "📥",
    delete: "🗑️",
    update: "🔄",
    ban: "🚫",
    kick: "👢",
    mute: "🔇",
    unmute: "🔊",
    
    // Game/Entertainment
    game: "🎮",
    crown: "👑",
    trophy: "🏆",
    medal: "🥇",
    star: "⭐",
    fire: "🔥",
    
    // Chat
    chat: "💬",
    message: "📬",
    recall: "↩️",
    pin: "📌",
    search: "🔍",
    
    // People
    leader: "👨‍💼",
    user: "👤",
    group: "👥",
    admin: "🛡️",
    
    // Other
    arrow: "➡️",
    link: "🔗",
    list: "📋",
    settings: "⚙️",
    heart: "❤️",
};

function wrapWithEmoji(text, emoji) {
    if (!emoji) return text;
    return `${emoji} ${text}`;
}

function wrapMessage(text, type = "info") {
    const emojiMap = {
        success: EMOJIS.success,
        error: EMOJIS.error,
        warning: EMOJIS.warning,
        info: EMOJIS.info,
        kick: EMOJIS.kick,
        mute: EMOJIS.mute,
        game: EMOJIS.game,
        chat: EMOJIS.chat,
    };
    
    const emoji = emojiMap[type] || EMOJIS.info;
    return wrapWithEmoji(text, emoji);
}

function buildColorfulMessage(lines, emoji = EMOJIS.info) {
    if (!Array.isArray(lines)) {
        return wrapWithEmoji(String(lines), emoji);
    }
    
    return lines.map((line, idx) => {
        // Thêm emoji cho dòng đầu
        if (idx === 0) {
            return wrapWithEmoji(line, emoji);
        }
        return line;
    }).join("\n");
}

module.exports = {
    EMOJIS,
    wrapWithEmoji,
    wrapMessage,
    buildColorfulMessage,
};
