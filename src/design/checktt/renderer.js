const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { FONT_STACK, FONT_STACK_EMOJI, registerDesignFonts } = require("../shared/registerFonts");
const { getSpecialUserTheme } = require("../specialUsersConfig");

const CHECKTT_THEME = {
    width: 1400,
    height: 660,
    background: {
        top: "#fff8dc",
        bottom: "#fde68a",
        glow: "rgba(245, 158, 11, 0.18)",
    },
    panel: {
        x: 44,
        y: 42,
        width: 1312,
        height: 576,
        radius: 28,
        fill: "rgba(255, 252, 235, 0.92)",
        stroke: "rgba(161, 98, 7, 0.28)",
    },
    avatar: {
        x: 218,
        y: 330,
        radius: 112,
        ring: "#fffbeb",
        fallbackTop: "#fef3c7",
        fallbackBottom: "#fcd34d",
    },
};

const SPECIAL_USER_CHECKTT_THEME = Object.values(require("../specialUsersConfig").SPECIAL_USERS)[0]?.themes?.checktt || {
    background: {
        top: "#ffc0cb",
        bottom: "#ffb6c1",
        glow: "rgba(255, 105, 180, 0.18)",
    },
    panel: {
        fill: "rgba(255, 192, 203, 0.95)",
        stroke: "rgba(219, 39, 119, 0.28)",
    },
};

function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function wrapTextByWords(ctx, text, maxWidth) {
    const words = String(text || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (words.length === 0) return [""];

    const lines = [];
    let current = words[0];

    for (let i = 1; i < words.length; i += 1) {
        const next = `${current} ${words[i]}`;
        if (ctx.measureText(next).width <= maxWidth) {
            current = next;
        } else {
            lines.push(current);
            current = words[i];
        }
    }
    lines.push(current);
    return lines;
}

function formatCount(num) {
    return new Intl.NumberFormat("vi-VN").format(Number(num) || 0);
}

function formatDateTimeVN(dateLike) {
    if (!dateLike) return "Chưa có dữ liệu";
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) return "Chưa có dữ liệu";

    const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const map = Object.create(null);
    for (const part of parts) {
        if (part.type !== "literal") {
            map[part.type] = part.value;
        }
    }
    const hh = String(map.hour || "00");
    const mm = String(map.minute || "00");
    const dd = String(map.day || "00");
    const mo = String(map.month || "00");
    const yyyy = String(map.year || "");
    return `${hh}:${mm} ${dd}/${mo}/${yyyy}`;
}

async function loadRemoteImage(url) {
    if (!url || typeof url !== "string") return null;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        return await loadImage(Buffer.from(arrayBuffer));
    } catch (_) {
        return null;
    }
}

function getMergedCheckttThemeForUser(userId) {
    const specialTheme = getSpecialUserTheme(userId, "checktt");
    if (!specialTheme) {
        return {
            titleColor: "#7c2d12",
            displayNameColor: "#451a03",
            uidColor: "rgba(120, 53, 15, 0.9)",
            rowLabelColor: "rgba(120, 53, 15, 0.95)",
            rowValueColor: "#7c2d12",
        };
    }

    return {
        titleColor: specialTheme.title || "#7c2d12",
        displayNameColor: specialTheme.displayName || "#451a03",
        uidColor: specialTheme.uid || "rgba(120, 53, 15, 0.9)",
        rowLabelColor: specialTheme.rowLabel || "rgba(120, 53, 15, 0.95)",
        rowValueColor: specialTheme.rowValue || "#7c2d12",
    };
}

function drawBackground(ctx, width, height, userId) {
    const specialBg = getSpecialUserTheme(userId, "checktt");
    const bgTheme = specialBg?.background || CHECKTT_THEME.background;
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, bgTheme.top);
    bg.addColorStop(1, bgTheme.bottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const radial = ctx.createRadialGradient(220, 120, 10, 220, 120, 360);
    radial.addColorStop(0, bgTheme.glow);
    radial.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);
}

function drawPanel(ctx, userId) {
    const panelCfg = CHECKTT_THEME.panel;
    const specialPanel = getSpecialUserTheme(userId, "checktt");
    const panelTheme = specialPanel?.panel || { fill: panelCfg.fill, stroke: panelCfg.stroke };
    ctx.fillStyle = panelTheme.fill;
    ctx.fill();
    ctx.strokeStyle = panelTheme.stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

function drawAvatarFallback(ctx, displayName) {
    const cfg = CHECKTT_THEME.avatar;
    const fallback = ctx.createLinearGradient(
        cfg.x - cfg.radius,
        cfg.y - cfg.radius,
        cfg.x + cfg.radius,
        cfg.y + cfg.radius
    );
    fallback.addColorStop(0, cfg.fallbackTop);
    fallback.addColorStop(1, cfg.fallbackBottom);
    ctx.fillStyle = fallback;
    ctx.fillRect(cfg.x - cfg.radius, cfg.y - cfg.radius, cfg.radius * 2, cfg.radius * 2);

    const letter = String(displayName || "?").trim()[0] || "?";
    ctx.font = `800 76px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = "#78350f";
    const width = ctx.measureText(letter.toUpperCase()).width;
    ctx.fillText(letter.toUpperCase(), cfg.x - width / 2, cfg.y + 28);
}

async function drawAvatar(ctx, avatarUrl, displayName) {
    const cfg = CHECKTT_THEME.avatar;

    ctx.beginPath();
    ctx.arc(cfg.x, cfg.y, cfg.radius + 9, 0, Math.PI * 2);
    ctx.fillStyle = cfg.ring;
    ctx.fill();

    const avatarImage = await loadRemoteImage(avatarUrl);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cfg.x, cfg.y, cfg.radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (avatarImage) {
        ctx.drawImage(
            avatarImage,
            cfg.x - cfg.radius,
            cfg.y - cfg.radius,
            cfg.radius * 2,
            cfg.radius * 2
        );
    } else {
        drawAvatarFallback(ctx, displayName);
    }

    ctx.restore();
}

function drawTextBlock(ctx, payload, userId) {
    const { displayName, joinDate, totalMsgCount, addedByLabel, ingameName } = payload;
    const colors = getMergedCheckttThemeForUser(userId);

    ctx.font = `800 42px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = colors.titleColor;
    ctx.fillText("THÔNG TIN THÀNH VIÊN", 392, 128);

    // Draw displayName with wrapping
    ctx.font = `800 54px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = colors.displayNameColor;
    const nameLines = wrapTextByWords(ctx, displayName, 880);
    const maxNameLines = 2; // Allow up to 2 lines for name
    let nameY = 204;
    for (let i = 0; i < Math.min(nameLines.length, maxNameLines); i += 1) {
        ctx.fillText(nameLines[i], 392, nameY);
        nameY += 60; // Line height for 54px font
    }

    ctx.font = `600 20px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = colors.uidColor;
    ctx.fillText(`UID: ${payload.userId}`, 394, 236 + (Math.max(0, nameLines.length - 1) * 60));

    let rows = [
        { label: "Tên ingame", value: String(ingameName || "").trim() || "Chưa set ingame" },
        { label: "Thời gian vào nhóm", value: formatDateTimeVN(joinDate) },
        { label: "Người thêm/duyệt", value: addedByLabel || "Chưa có dữ liệu" },
        { label: "Tổng tin nhận tích lũy", value: `${formatCount(totalMsgCount)} tin nhận` },
    ];

    const rowHeight = 76;
    const rowGap = 18;
    let y = 286 + (Math.max(0, nameLines.length - 1) * 60);

    for (const row of rows) {
        roundRect(ctx, 392, y - 34, 898, rowHeight, 15);
        ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
        ctx.fill();
        ctx.strokeStyle = "rgba(180, 83, 9, 0.24)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = `600 22px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
        ctx.fillStyle = colors.rowLabelColor;
        ctx.fillText(row.label, 420, y - 3);

        ctx.font = `700 29px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
        ctx.fillStyle = colors.rowValueColor;
        const valueLines = wrapTextByWords(ctx, row.value, 620);
        const maxValueLines = 2;
        let valueY = y + 26;
        for (let i = 0; i < Math.min(valueLines.length, maxValueLines); i += 1) {
            ctx.fillText(valueLines[i], 420, valueY);
            valueY += 35; // Line height for 29px font
        }

        y += rowHeight + rowGap;
    }
}

async function createCheckTTCard(payload, options = {}) {
    registerDesignFonts();

    const width = options.width || CHECKTT_THEME.width;
    const baseHeight = options.height || CHECKTT_THEME.height;
    const height = baseHeight;

    const canvas = createCanvas(width, Math.max(height, 420));
    const ctx = canvas.getContext("2d");

    drawBackground(ctx, width, canvas.height, payload.userId);
    drawPanel(ctx, payload.userId);
    await drawAvatar(ctx, payload.avatarUrl, payload.displayName);
    drawTextBlock(ctx, payload, payload.userId);

    const tempDir = path.resolve(options.tempDir || "tmp");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName =
        options.fileName ||
        `checktt-${payload.userId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.png`;
    const outputPath = path.join(tempDir, fileName);
    fs.writeFileSync(outputPath, canvas.toBuffer("image/png"));

    return outputPath;
}

module.exports = {
    CHECKTT_THEME,
    createCheckTTCard,
};

