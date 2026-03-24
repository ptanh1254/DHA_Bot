const { FONT_STACK } = require("../shared/registerFonts");
const { SPECIAL_USERS } = require("../specialUsersConfig");

const USER_CARD_THEME = {
    size: {
        width: 1500,
        height: 720,
    },
    background: {
        gradient: [
            { stop: 0, color: "#fff8dc" },
            { stop: 0.55, color: "#fef3c7" },
            { stop: 1, color: "#fde68a" },
        ],
        glow: [
            { x: 0.14, y: 0.18, radius: 360, color: "rgba(250, 204, 21, 0.18)" },
            { x: 0.84, y: 0.74, radius: 320, color: "rgba(245, 158, 11, 0.14)" },
        ],
        dots: {
            color: "rgba(146, 64, 14, 0.12)",
            step: 40,
            size: 1.2,
        },
    },
    card: {
        x: 48,
        y: 44,
        width: 1404,
        height: 632,
        radius: 30,
        fill: "rgba(255, 252, 235, 0.9)",
        stroke: "rgba(161, 98, 7, 0.24)",
        lineWidth: 1.6,
        blurShadow: "rgba(120, 53, 15, 0.2)",
    },
    title: {
        text: "H\u1ed2 S\u01a0 TH\u00c0NH VI\u00caN",
        subText: "C\u1ed9ng \u0111\u1ed3ng D\u00e2n T\u1ed5 DHA",
        x: 370,
        y: 130,
        titleFont: `800 46px ${FONT_STACK}`,
        subFont: `500 22px ${FONT_STACK}`,
        titleColor: "#7c2d12",
        subColor: "rgba(120, 53, 15, 0.9)",
    },
    divider: {
        x: 370,
        y: 158,
        width: 1020,
        color: "rgba(180, 83, 9, 0.28)",
        lineWidth: 1,
    },
    avatar: {
        x: 200,
        y: 322,
        radius: 126,
        ring: {
            width: 6,
            color: "rgba(180, 83, 9, 0.42)",
        },
        shadow: "rgba(120, 53, 15, 0.2)",
        placeholderTop: "#fef3c7",
        placeholderBottom: "#fcd34d",
        placeholderText: "#7c2d12",
        status: {
            active: "#22c55e",
            idle: "#f59e0b",
            stroke: "#fef3c7",
            radius: 17,
            lineWidth: 4,
            offsetX: -10,
            offsetY: -10,
        },
    },
    name: {
        y: 505,
        maxWidth: 540,
        font: `700 42px ${FONT_STACK}`,
        color: "#451a03",
    },
    userId: {
        y: 544,
        font: `500 20px ${FONT_STACK}`,
        color: "rgba(120, 53, 15, 0.9)",
    },
    rows: {
        boxX: 370,
        boxY: 194,
        boxWidth: 1040,
        rowHeight: 66,
        rowGap: 12,
        radius: 16,
        fill: "rgba(255, 255, 255, 0.72)",
        stroke: "rgba(180, 83, 9, 0.22)",
        labelFont: `600 20px ${FONT_STACK}`,
        labelColor: "rgba(120, 53, 15, 0.92)",
        valueFont: `700 24px ${FONT_STACK}`,
        valueMaxWidth: 560,
    },
    footer: {
        text: "PTADEV 2026",
        x: 1354,
        y: 650,
        font: `600 16px ${FONT_STACK}`,
        color: "rgba(120, 53, 15, 0.7)",
    },
};

// Get first special user's userCard theme for fallback
const SPECIAL_USER_CARD_THEME = Object.values(SPECIAL_USERS)[0]?.themes?.userCard || {
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
};

const USER_CARD_ROW_CONFIG = [
    { key: "username", label: "T\u00e0i kho\u1ea3n", color: "#451a03" },
    { key: "birthDate", label: "Ng\u00e0y sinh", color: "#451a03" },
    { key: "gender", label: "Gi\u1edbi t\u00ednh", color: "#451a03" },
    { key: "createdAt", label: "Tham gia", color: "#451a03" },
    { key: "lastActive", label: "Ho\u1ea1t \u0111\u1ed9ng", color: "#451a03" },
    { key: "status", label: "Tr\u1ea1ng th\u00e1i", color: "#b45309" },
];

module.exports = {
    USER_CARD_THEME,
    USER_CARD_ROW_CONFIG,
    SPECIAL_USERS,
    SPECIAL_USER_CARD_THEME,
};


