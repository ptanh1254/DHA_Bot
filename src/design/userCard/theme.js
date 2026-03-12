const USER_CARD_THEME = {
    size: {
        width: 1280,
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
        width: 1184,
        height: 632,
        radius: 30,
        fill: "rgba(255, 252, 235, 0.9)",
        stroke: "rgba(161, 98, 7, 0.24)",
        lineWidth: 1.6,
        blurShadow: "rgba(120, 53, 15, 0.2)",
    },
    title: {
        text: "HỒ SƠ THÀNH VIÊN",
        subText: "Cộng đồng Dân Tổ DHA",
        x: 370,
        y: 130,
        titleFont: "800 46px 'Bahnschrift', 'Segoe UI Variable', 'Segoe UI', sans-serif",
        subFont: "500 22px 'Bahnschrift', 'Segoe UI Variable', 'Segoe UI', sans-serif",
        titleColor: "#7c2d12",
        subColor: "rgba(120, 53, 15, 0.9)",
    },
    divider: {
        x: 370,
        y: 158,
        width: 800,
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
        maxWidth: 320,
        font: "700 42px 'Bahnschrift', 'Segoe UI Variable', 'Segoe UI', sans-serif",
        color: "#451a03",
    },
    userId: {
        y: 544,
        font: "500 20px 'Bahnschrift', 'Segoe UI Variable', 'Segoe UI', sans-serif",
        color: "rgba(120, 53, 15, 0.9)",
    },
    rows: {
        boxX: 370,
        boxY: 194,
        boxWidth: 820,
        rowHeight: 66,
        rowGap: 12,
        radius: 16,
        fill: "rgba(255, 255, 255, 0.72)",
        stroke: "rgba(180, 83, 9, 0.22)",
        labelFont: "600 20px 'Bahnschrift', 'Segoe UI Variable', 'Segoe UI', sans-serif",
        labelColor: "rgba(120, 53, 15, 0.92)",
        valueFont: "700 24px 'Bahnschrift', 'Segoe UI Variable', 'Segoe UI', sans-serif",
        valueMaxWidth: 560,
    },
    footer: {
        text: "PTADEV 2026",
        x: 1134,
        y: 650,
        font: "600 16px 'Bahnschrift', 'Segoe UI Variable', 'Segoe UI', sans-serif",
        color: "rgba(120, 53, 15, 0.7)",
    },
};

const USER_CARD_ROW_CONFIG = [
    { key: "username", label: "Tài khoản", color: "#451a03" },
    { key: "birthDate", label: "Ngày sinh", color: "#451a03" },
    { key: "gender", label: "Giới tính", color: "#451a03" },
    { key: "createdAt", label: "Tham gia", color: "#451a03" },
    { key: "lastActive", label: "Hoạt động", color: "#451a03" },
    { key: "status", label: "Trạng thái", color: "#b45309" },
];

module.exports = {
    USER_CARD_THEME,
    USER_CARD_ROW_CONFIG,
};
