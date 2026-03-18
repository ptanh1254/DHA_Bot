/**
 * Centralized configuration for special users with custom themes
 * Thêm/xoá UID đặc biệt và màu sắc của họ tại đây
 */

const SPECIAL_USERS = {
    // UID cũ - Theme hồng
    "9095318723300347162": {
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
        name: "Special User 2",
        colors: {
            primary: "#ff0303",
            secondary: "",
            textColor: "#ffffff",
        },
        themes: {
            userCard: {
                background: {
                    gradient: [
                        { stop: 0, color: "#a6251e" },
                        { stop: 0.55, color: "#821616" },
                        { stop: 1, color: "#5c0f0f" },
                    ],
                    glow: [
                        { x: 0.14, y: 0.18, radius: 360, color: "rgba(130, 22, 22, 0.18)" },
                        { x: 0.84, y: 0.74, radius: 320, color: "rgba(92, 15, 15, 0.14)" },
                    ],
                    dots: {
                        color: "rgba(28, 26, 26, 0.15)",
                        step: 40,
                        size: 1.2,
                    },
                },
                card: {
                    fill: "rgba(130, 22, 22, 0.92)",
                    stroke: "rgba(28, 26, 26, 0.32)",
                },
                title: {
                    titleColor: "#ffffff",
                    subColor: "rgba(255, 255, 255, 0.9)",
                },
                avatar: {
                    placeholderText: "#ffffff",
                },
                name: {
                    color: "#ffffff",
                },
                userId: {
                    color: "rgba(255, 255, 255, 0.9)",
                },
                rows: {
                    labelColor: "rgba(255, 255, 255, 0.92)",
                    valueColor: "#ffffff",
                },
                footer: {
                    color: "rgba(255, 255, 255, 0.7)",
                },
            },
            checktt: {
                background: {
                    top: "#a6251e",
                    bottom: "#821616",
                    glow: "rgba(130, 22, 22, 0.18)",
                },
                panel: {
                    fill: "rgba(130, 22, 22, 0.94)",
                    stroke: "rgba(28, 26, 26, 0.30)",
                },
                title: "#ffffff",
                displayName: "#ffffff",
                uid: "rgba(255, 255, 255, 0.9)",
                rowLabel: "rgba(255, 255, 255, 0.92)",
                rowValue: "#ffffff",
            },
            check: {
                backgroundGradient: [
                    { stop: 0, color: "#a6251e" },
                    { stop: 0.5, color: "#821616" },
                    { stop: 1, color: "#5c0f0f" },
                ],
            },
            chatRanking: {
                indicator: "♦",
                color: "#ff0303",
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
            chatRanking: {
                indicator: "★",
                color: "#ff0303",
            }
        }
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
