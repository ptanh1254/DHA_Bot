const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { FONT_STACK, registerDesignFonts } = require("../shared/registerFonts");

const { USER_CARD_THEME } = require("./theme");
const { buildUserCardRows } = require("./formatters");

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

async function loadAvatarImage(url) {
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
    const bg = ctx.createLinearGradient(0, 0, width, height);
    for (const stop of USER_CARD_THEME.background.gradient) {
        bg.addColorStop(stop.stop, stop.color);
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    for (const glow of USER_CARD_THEME.background.glow) {
        const radial = ctx.createRadialGradient(
            width * glow.x,
            height * glow.y,
            0,
            width * glow.x,
            height * glow.y,
            glow.radius
        );
        radial.addColorStop(0, glow.color);
        radial.addColorStop(1, "rgba(0,0,0,0)");

        ctx.fillStyle = radial;
        ctx.fillRect(0, 0, width, height);
    }

    const dots = USER_CARD_THEME.background.dots;
    ctx.fillStyle = dots.color;
    for (let y = dots.step / 2; y < height; y += dots.step) {
        for (let x = dots.step / 2; x < width; x += dots.step) {
            ctx.beginPath();
            ctx.arc(x, y, dots.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawContainer(ctx) {
    const card = USER_CARD_THEME.card;

    ctx.save();
    ctx.shadowColor = card.blurShadow;
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 18;
    roundRect(ctx, card.x, card.y, card.width, card.height, card.radius);
    ctx.fillStyle = card.fill;
    ctx.fill();
    ctx.restore();

    roundRect(ctx, card.x, card.y, card.width, card.height, card.radius);
    ctx.strokeStyle = card.stroke;
    ctx.lineWidth = card.lineWidth;
    ctx.stroke();
}

function drawTitle(ctx) {
    const title = USER_CARD_THEME.title;
    const divider = USER_CARD_THEME.divider;

    ctx.font = title.titleFont;
    ctx.fillStyle = title.titleColor;
    ctx.fillText(title.text, title.x, title.y);

    ctx.font = title.subFont;
    ctx.fillStyle = title.subColor;
    ctx.fillText(title.subText, title.x, title.y + 36);

    ctx.beginPath();
    ctx.moveTo(divider.x, divider.y);
    ctx.lineTo(divider.x + divider.width, divider.y);
    ctx.strokeStyle = divider.color;
    ctx.lineWidth = divider.lineWidth;
    ctx.stroke();
}

async function drawAvatar(ctx, profile) {
    const cfg = USER_CARD_THEME.avatar;

    ctx.save();
    ctx.shadowColor = cfg.shadow;
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;
    ctx.beginPath();
    ctx.arc(cfg.x, cfg.y, cfg.radius + 6, 0, Math.PI * 2);
    ctx.strokeStyle = cfg.ring.color;
    ctx.lineWidth = cfg.ring.width;
    ctx.stroke();
    ctx.restore();

    const avatarImage = await loadAvatarImage(profile.avatar);
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
        const fallback = ctx.createLinearGradient(0, cfg.y - cfg.radius, 0, cfg.y + cfg.radius);
        fallback.addColorStop(0, cfg.placeholderTop);
        fallback.addColorStop(1, cfg.placeholderBottom);
        ctx.fillStyle = fallback;
        ctx.fillRect(cfg.x - cfg.radius, cfg.y - cfg.radius, cfg.radius * 2, cfg.radius * 2);

        const fallbackName = String(profile.displayName || profile.zaloName || "?").trim();
        const firstChar = fallbackName ? fallbackName[0].toUpperCase() : "?";

        ctx.font = `700 76px ${FONT_STACK}`;
        ctx.fillStyle = cfg.placeholderText;
        const textWidth = ctx.measureText(firstChar).width;
        ctx.fillText(firstChar, cfg.x - textWidth / 2, cfg.y + 28);
    }

    ctx.restore();

    const statusCfg = cfg.status;
    const dotColor = profile.isActive ? statusCfg.active : statusCfg.idle;
    ctx.beginPath();
    ctx.arc(
        cfg.x + cfg.radius + statusCfg.offsetX,
        cfg.y + cfg.radius + statusCfg.offsetY,
        statusCfg.radius,
        0,
        Math.PI * 2
    );
    ctx.fillStyle = dotColor;
    ctx.fill();
    ctx.lineWidth = statusCfg.lineWidth;
    ctx.strokeStyle = statusCfg.stroke;
    ctx.stroke();
}

function drawName(ctx, profile) {
    const nameCfg = USER_CARD_THEME.name;
    const uidCfg = USER_CARD_THEME.userId;
    const avatarX = USER_CARD_THEME.avatar.x;

    const displayName = String(
        profile.displayName || profile.zaloName || "Ng\u01b0\u1eddi d\u00f9ng"
    ).trim();

    ctx.font = nameCfg.font;
    ctx.fillStyle = nameCfg.color;
    const nameSafe = fitText(ctx, displayName, nameCfg.maxWidth);
    const nameWidth = ctx.measureText(nameSafe).width;
    ctx.fillText(nameSafe, avatarX - nameWidth / 2, nameCfg.y);

    const userId = String(profile.userId || profile.uid || "").trim();
    if (userId) {
        const uidText = `UID: ${userId}`;
        ctx.font = uidCfg.font;
        ctx.fillStyle = uidCfg.color;
        const uidWidth = ctx.measureText(uidText).width;
        ctx.fillText(uidText, avatarX - uidWidth / 2, uidCfg.y);
    }
}

function drawRows(ctx, profile) {
    const cfg = USER_CARD_THEME.rows;
    const rows = buildUserCardRows(profile);

    let rowY = cfg.boxY;
    for (const row of rows) {
        roundRect(ctx, cfg.boxX, rowY, cfg.boxWidth, cfg.rowHeight, cfg.radius);
        ctx.fillStyle = cfg.fill;
        ctx.fill();
        ctx.strokeStyle = cfg.stroke;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = cfg.labelFont;
        ctx.fillStyle = cfg.labelColor;
        ctx.fillText(row.label, cfg.boxX + 24, rowY + 41);

        ctx.font = cfg.valueFont;
        ctx.fillStyle = row.color;
        const valueSafe = fitText(ctx, String(row.value || "Không rõ"), cfg.valueMaxWidth);
        const textWidth = ctx.measureText(valueSafe).width;
        ctx.fillText(valueSafe, cfg.boxX + cfg.boxWidth - 24 - textWidth, rowY + 41);

        rowY += cfg.rowHeight + cfg.rowGap;
    }
}

function drawFooter(ctx) {
    const footer = USER_CARD_THEME.footer;
    ctx.font = footer.font;
    ctx.fillStyle = footer.color;

    const width = ctx.measureText(footer.text).width;
    ctx.fillText(footer.text, footer.x - width, footer.y);
}

async function createUserInfoCard(profile, options = {}) {
    registerDesignFonts();

    const width = options.width || USER_CARD_THEME.size.width;
    const height = options.height || USER_CARD_THEME.size.height;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    drawBackground(ctx, width, height);
    drawContainer(ctx);
    drawTitle(ctx);
    await drawAvatar(ctx, profile);
    drawName(ctx, profile);
    drawRows(ctx, profile);
    drawFooter(ctx);

    const tempDir = path.resolve(options.tempDir || "tmp");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = options.fileName || `thongtin-${profile.userId || "user"}-${Date.now()}.png`;
    const outputPath = path.join(tempDir, fileName);
    fs.writeFileSync(outputPath, canvas.toBuffer("image/png"));

    return outputPath;
}

module.exports = {
    USER_CARD_THEME,
    createUserInfoCard,
};


