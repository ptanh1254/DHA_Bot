/**
 * Centralized configuration for special users with custom themes
 * Thêm/xoá UID đặc biệt và màu sắc của họ tại đây
 */

const SPECIAL_USERS = {
    // UID cũ - Theme hồng
    "": {
        name: "Special User 1",
        colors: {
            primary: "#ff69b4",
            secondary: "#ffb6c1",
        },
        themes: {
            userCard: {
                background: {
                    gradient: [
                        { stop: 0, color: "#ffc0cb" },
                        { stop: 0.55, color: "#ffb6c1" },
                        { stop: 1, color: "#ff69b4" },
                    ],
                    glow: [
                        { x: 0.14, y: 0.18, radius: 360, color: "rgba(255, 105, 180, 0.18)" },
                        { x: 0.84, y: 0.74, radius: 320, color: "rgba(255, 105, 180, 0.14)" },
                    ],
                    dots: {
                        color: "rgba(220, 20, 60, 0.12)",
                        step: 40,
                        size: 1.2,
                    },
                },
                card: {
                    fill: "rgba(255, 192, 203, 0.95)",
                    stroke: "rgba(219, 39, 119, 0.24)",
                },
            },
            checktt: {
                background: {
                    top: "#ffc0cb",
                    bottom: "#ffb6c1",
                    glow: "rgba(255, 105, 180, 0.18)",
                },
                panel: {
                    fill: "rgba(255, 192, 203, 0.95)",
                    stroke: "rgba(219, 39, 119, 0.28)",
                },
            },
            check: {
                backgroundGradient: [
                    { stop: 0, color: "#ffc0cb" },
                    { stop: 0.5, color: "#ffb6c1" },
                    { stop: 1, color: "#ff69b4" },
                ],
            },
            chatRanking: {
                indicator: "♦",
                color: "#ff69b4",
            },
        },
    },

    "2370937689986813380": {
        themes: {
            userCard: {
                background: {
                    gradient: [
                        { stop: 0, color: "#070012" },
                        { stop: 0.22, color: "#14103f" },
                        { stop: 0.45, color: "#002f3c" },
                        { stop: 0.68, color: "#36115a" },
                        { stop: 1, color: "#090013" },
                    ],
                    glow: [
                        { x: 0.16, y: 0.14, radius: 460, color: "rgba(0, 245, 255, 0.28)" },
                        { x: 0.78, y: 0.28, radius: 430, color: "rgba(255, 42, 170, 0.24)" },
                        { x: 0.52, y: 0.88, radius: 520, color: "rgba(255, 213, 74, 0.18)" },
                    ],
                    dots: {
                        color: "rgba(255, 255, 255, 0.16)",
                        step: 34,
                        size: 1.35,
                    },
                },
                card: {
                    fill: "rgba(8, 6, 24, 0.82)",
                    fillGradient: {
                        from: { x: 0, y: 0 },
                        to: { x: 1, y: 1 },
                        colors: [
                            { stop: 0, color: "rgba(255, 255, 255, 0.18)" },
                            { stop: 0.38, color: "rgba(10, 8, 38, 0.88)" },
                            { stop: 1, color: "rgba(255, 42, 170, 0.16)" },
                        ],
                    },
                    stroke: "rgba(255, 213, 74, 0.9)",
                    strokeGradient: {
                        from: { x: 0, y: 0 },
                        to: { x: 1, y: 0 },
                        colors: ["#FFD54A", "#00F5FF", "#FF2AAA", "#B8FF5A"],
                    },
                    lineWidth: 3.2,
                    shadow: "rgba(0, 245, 255, 0.32)",
                    shadowBlur: 58,
                    shadowOffsetY: 20,
                },
                title: {
                    titleColor: "#fff7c2",
                    subColor: "rgba(194, 255, 252, 0.9)",
                },
                avatar: {
                    placeholderText: "#fff7c2",
                },
                name: {
                    color: "#fff7c2",
                },
                userId: {
                    color: "rgba(194, 255, 252, 0.88)",
                },
                rows: {
                    fill: "rgba(255, 255, 255, 0.10)",
                    stroke: "rgba(0, 245, 255, 0.22)",
                    labelColor: "rgba(194, 255, 252, 0.9)",
                    valueColor: "#fff7c2",
                },
                footer: {
                    color: "rgba(255, 213, 74, 0.72)",
                },
                rainbow: true,
                colors: ["#FFF7C2", "#FFD54A", "#B8FF5A", "#00F5FF", "#7A7CFF", "#FF2AAA", "#FFF7C2"],
            },
            checktt: {
                background: {
                    top: "#070012",
                    bottom: "#002f3c",
                    glow: "rgba(0, 245, 255, 0.28)",
                },
                panel: {
                    fill: "rgba(8, 6, 24, 0.84)",
                    stroke: "rgba(255, 213, 74, 0.82)",
                },
                title: "#fff7c2",
                displayName: "#fff7c2",
                uid: "rgba(194, 255, 252, 0.9)",
                rowLabel: "rgba(194, 255, 252, 0.9)",
                rowValue: "#fff7c2",
                rowFill: "rgba(255, 255, 255, 0.10)",
                rowStroke: "rgba(0, 245, 255, 0.24)",
                noteFill: "rgba(255, 255, 255, 0.09)",
                noteStroke: "rgba(255, 213, 74, 0.32)",
                rainbow: true,
                colors: ["#FFF7C2", "#FFD54A", "#B8FF5A", "#00F5FF", "#7A7CFF", "#FF2AAA", "#FFF7C2"],
            },
            check: {
                backgroundGradient: [
                    { stop: 0, color: "#FF6B6B" },
                    { stop: 0.25, color: "#FDCB6E" },
                    { stop: 0.5, color: "#55EFC4" },
                    { stop: 0.75, color: "#74B9FF" },
                    { stop: 1, color: "#A29BFE" },
                ],
                rainbow: true,
                colors: ["#FF0000", "#FF7F00", "#FFD700", "#00CC44", "#1E90FF", "#4B0082", "#8B00FF"],
            },
            chatRanking: {
                indicator: "🌈",
                rainbow: true,
                colors: ["#FF0000", "#FF7F00", "#FFD700", "#00CC44", "#1E90FF", "#4B0082", "#8B00FF"],
            },
        },
    },

    "7789551180391709753": {
        themes: {
            chatRanking: {
                indicator: "★",
                color: "#f39200",
            }
        }
    },
    "8073429320276439081": {
        themes: {
            userCard: {
                background: {
                    gradient: [
                        { stop: 0, color: "#070012" },
                        { stop: 0.22, color: "#14103f" },
                        { stop: 0.45, color: "#002f3c" },
                        { stop: 0.68, color: "#36115a" },
                        { stop: 1, color: "#090013" },
                    ],
                    glow: [
                        { x: 0.16, y: 0.14, radius: 460, color: "rgba(0, 245, 255, 0.28)" },
                        { x: 0.78, y: 0.28, radius: 430, color: "rgba(255, 42, 170, 0.24)" },
                        { x: 0.52, y: 0.88, radius: 520, color: "rgba(255, 213, 74, 0.18)" },
                    ],
                    dots: {
                        color: "rgba(255, 255, 255, 0.16)",
                        step: 34,
                        size: 1.35,
                    },
                },
                card: {
                    fill: "rgba(8, 6, 24, 0.82)",
                    fillGradient: {
                        from: { x: 0, y: 0 },
                        to: { x: 1, y: 1 },
                        colors: [
                            { stop: 0, color: "rgba(255, 255, 255, 0.18)" },
                            { stop: 0.38, color: "rgba(10, 8, 38, 0.88)" },
                            { stop: 1, color: "rgba(255, 42, 170, 0.16)" },
                        ],
                    },
                    stroke: "rgba(255, 213, 74, 0.9)",
                    strokeGradient: {
                        from: { x: 0, y: 0 },
                        to: { x: 1, y: 0 },
                        colors: ["#FFD54A", "#00F5FF", "#FF2AAA", "#B8FF5A"],
                    },
                    lineWidth: 3.2,
                    shadow: "rgba(0, 245, 255, 0.32)",
                    shadowBlur: 58,
                    shadowOffsetY: 20,
                },
                title: {
                    titleColor: "#fff7c2",
                    subColor: "rgba(194, 255, 252, 0.9)",
                },
                avatar: {
                    placeholderText: "#fff7c2",
                },
                name: {
                    color: "#fff7c2",
                },
                userId: {
                    color: "rgba(194, 255, 252, 0.88)",
                },
                rows: {
                    fill: "rgba(255, 255, 255, 0.10)",
                    stroke: "rgba(0, 245, 255, 0.22)",
                    labelColor: "rgba(194, 255, 252, 0.9)",
                    valueColor: "#fff7c2",
                },
                footer: {
                    color: "rgba(255, 213, 74, 0.72)",
                },
                rainbow: true,
                colors: ["#FFF7C2", "#FFD54A", "#B8FF5A", "#00F5FF", "#7A7CFF", "#FF2AAA", "#FFF7C2"],
            },
            checktt: {
                background: {
                    top: "#070012",
                    bottom: "#002f3c",
                    glow: "rgba(0, 245, 255, 0.28)",
                },
                panel: {
                    fill: "rgba(8, 6, 24, 0.84)",
                    stroke: "rgba(255, 213, 74, 0.82)",
                },
                title: "#fff7c2",
                displayName: "#fff7c2",
                uid: "rgba(194, 255, 252, 0.9)",
                rowLabel: "rgba(194, 255, 252, 0.9)",
                rowValue: "#fff7c2",
                rowFill: "rgba(255, 255, 255, 0.10)",
                rowStroke: "rgba(0, 245, 255, 0.24)",
                noteFill: "rgba(255, 255, 255, 0.09)",
                noteStroke: "rgba(255, 213, 74, 0.32)",
                rainbow: true,
                colors: ["#FFF7C2", "#FFD54A", "#B8FF5A", "#00F5FF", "#7A7CFF", "#FF2AAA", "#FFF7C2"],
            },
            check: {
                backgroundGradient: [
                    { stop: 0, color: "#FF6B6B" },
                    { stop: 0.25, color: "#FDCB6E" },
                    { stop: 0.5, color: "#55EFC4" },
                    { stop: 0.75, color: "#74B9FF" },
                    { stop: 1, color: "#A29BFE" },
                ],
                rainbow: true,
                colors: ["#FF0000", "#FF7F00", "#FFD700", "#00CC44", "#1E90FF", "#4B0082", "#8B00FF"],
            },
            chatRanking: {
                indicator: "🌈",
                rainbow: true,
                colors: ["#FF0000", "#FF7F00", "#FFD700", "#00CC44", "#1E90FF", "#4B0082", "#8B00FF"],
            },
        },
    },
    "9095318723300347162": {
        themes: {
            userCard: {
                background: {
                    gradient: [
                        { stop: 0, color: "#FF6B6B" },
                        { stop: 0.17, color: "#FF9F43" },
                        { stop: 0.33, color: "#FFEAA7" },
                        { stop: 0.5, color: "#55EFC4" },
                        { stop: 0.67, color: "#74B9FF" },
                        { stop: 0.83, color: "#A29BFE" },
                        { stop: 1, color: "#FD79A8" },
                    ],
                    glow: [
                        { x: 0.14, y: 0.18, radius: 360, color: "rgba(255, 127, 0, 0.18)" },
                        { x: 0.84, y: 0.74, radius: 320, color: "rgba(75, 0, 130, 0.14)" },
                    ],
                    dots: {
                        color: "rgba(255, 255, 255, 0.12)",
                        step: 40,
                        size: 1.2,
                    },
                },
                card: {
                    fill: "rgba(255, 255, 255, 0.88)",
                    stroke: "rgba(130, 80, 200, 0.28)",
                },
                rainbow: true,
                colors: ["#FF0000", "#FF7F00", "#FFD700", "#00CC44", "#1E90FF", "#4B0082", "#8B00FF"],
            },
            checktt: {
                background: {
                    top: "#FF6B6B",
                    bottom: "#A29BFE",
                    glow: "rgba(130, 80, 200, 0.18)",
                },
                panel: {
                    fill: "rgba(255, 255, 255, 0.90)",
                    stroke: "rgba(130, 80, 200, 0.28)",
                },
                rainbow: true,
                colors: ["#FF0000", "#FF7F00", "#FFD700", "#00CC44", "#1E90FF", "#4B0082", "#8B00FF"],
            },
            check: {
                backgroundGradient: [
                    { stop: 0, color: "#FF6B6B" },
                    { stop: 0.25, color: "#FDCB6E" },
                    { stop: 0.5, color: "#55EFC4" },
                    { stop: 0.75, color: "#74B9FF" },
                    { stop: 1, color: "#A29BFE" },
                ],
                rainbow: true,
                colors: ["#FF0000", "#FF7F00", "#FFD700", "#00CC44", "#1E90FF", "#4B0082", "#8B00FF"],
            },
            chatRanking: {
                indicator: "ðŸŒˆ",
                rainbow: true,
                colors: ["#FF0000", "#FF7F00", "#FFD700", "#00CC44", "#1E90FF", "#4B0082", "#8B00FF"],
            },
        },
    },
};

/**
 * Lấy theme cho một user
 * @param {string} userId - User ID
 * @param {string} designType - Loại design (userCard, checktt, check, chatRanking)
 * @returns {object|null} - Theme object hoặc null nếu không có theme đặc biệt
 */
function getSpecialUserTheme(userId, designType) {
    const user = SPECIAL_USERS[String(userId || "").trim()];
    if (!user) return null;
    return user.themes[designType] || null;
}

/**
 * Kiểm tra xem user có phải là special user không
 * @param {string} userId - User ID
 * @returns {boolean}
 */
function isSpecialUser(userId) {
    return !!SPECIAL_USERS[String(userId || "").trim()];
}

/**
 * Lấy tất cả special user IDs
 * @returns {string[]} - Mảng các UID
 */
function getSpecialUserIds() {
    return Object.keys(SPECIAL_USERS);
}

module.exports = {
    SPECIAL_USERS,
    getSpecialUserTheme,
    isSpecialUser,
    getSpecialUserIds,
};
