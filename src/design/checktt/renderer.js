const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { FONT_STACK, registerDesignFonts } = require("../shared/registerFonts");

const CHECKTT_THEME = {
    width: 1180,
    height: 660,
    background: {
        top: "#fff8dc",
        bottom: "#fde68a",
        glow: "rgba(245, 158, 11, 0.18)",
    },
    panel: {
        x: 44,
        y: 42,
        width: 1092,
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

function fitText(ctx, text, maxWidth) {
    const input = String(text || "");
    if (ctx.measureText(input).width <= maxWidth) return input;

    let out = input;
    while (out.length > 0 && ctx.measureText(`${out}...`).width > maxWidth) {
        out = out.slice(0, -1);
    }
    return `${out}...`;
}

function formatCount(num) {
    return new Intl.NumberFormat("vi-VN").format(Number(num) || 0);
}

function formatDateTimeVN(dateLike) {
    if (!dateLike) return "Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u";
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) return "Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u";

    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const mo = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
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

function drawBackground(ctx, width, height) {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, CHECKTT_THEME.background.top);
    bg.addColorStop(1, CHECKTT_THEME.background.bottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const radial = ctx.createRadialGradient(220, 120, 10, 220, 120, 360);
    radial.addColorStop(0, CHECKTT_THEME.background.glow);
    radial.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);
}

function drawPanel(ctx) {
    const panel = CHECKTT_THEME.panel;
    roundRect(ctx, panel.x, panel.y, panel.width, panel.height, panel.radius);
    ctx.fillStyle = panel.fill;
    ctx.fill();
    ctx.strokeStyle = panel.stroke;
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
    ctx.font = `800 76px ${FONT_STACK}`;
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

function drawTextBlock(ctx, payload) {
    const { displayName, joinDate, totalMsgCount, userId, addedByLabel } = payload;

    ctx.font = `800 42px ${FONT_STACK}`;
    ctx.fillStyle = "#7c2d12";
    ctx.fillText("TH\u00d4NG TIN TH\u00c0NH VI\u00caN", 392, 128);

    const safeName = fitText(ctx, displayName, 660);
    ctx.font = `800 54px ${FONT_STACK}`;
    ctx.fillStyle = "#451a03";
    ctx.fillText(safeName, 392, 204);

    ctx.font = `600 20px ${FONT_STACK}`;
    ctx.fillStyle = "rgba(120, 53, 15, 0.9)";
    ctx.fillText(`UID: ${userId}`, 394, 236);

    const rows = [
        { label: "Th\u1eddi gian v\u00e0o nh\u00f3m", value: formatDateTimeVN(joinDate) },
        { label: "Ng\u01b0\u1eddi th\u00eam/duy\u1ec7t", value: addedByLabel || "Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u" },
        { label: "T\u1ed5ng tin nh\u1eafn t\u00edch l\u0169y", value: `${formatCount(totalMsgCount)} tin nh\u1eafn` },
    ];

    const rowHeight = 76;
    const rowGap = 18;
    let y = 286;

    for (const row of rows) {
        roundRect(ctx, 392, y - 34, 678, rowHeight, 15);
        ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
        ctx.fill();
        ctx.strokeStyle = "rgba(180, 83, 9, 0.24)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = `600 22px ${FONT_STACK}`;
        ctx.fillStyle = "rgba(120, 53, 15, 0.95)";
        ctx.fillText(row.label, 420, y - 3);

        ctx.font = `700 29px ${FONT_STACK}`;
        ctx.fillStyle = "#7c2d12";
        const valueSafe = fitText(ctx, row.value, 620);
        ctx.fillText(valueSafe, 420, y + 26);

        y += rowHeight + rowGap;
    }
}

async function createCheckTTCard(payload, options = {}) {
    registerDesignFonts();

    const width = options.width || CHECKTT_THEME.width;
    const height = options.height || CHECKTT_THEME.height;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    drawBackground(ctx, width, height);
    drawPanel(ctx);
    await drawAvatar(ctx, payload.avatarUrl, payload.displayName);
    drawTextBlock(ctx, payload);

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

