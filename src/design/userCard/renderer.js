const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { FONT_STACK, registerDesignFonts } = require("../shared/registerFonts");

const { USER_CARD_THEME } = require("./theme");
const { getSpecialUserTheme } = require("../specialUsersConfig");
const { buildUserCardRows } = require("./formatters");

function createRainbowGradient(ctx, x, textWidth, colors) {
    const grad = ctx.createLinearGradient(x, 0, x + Math.max(textWidth, 1), 0);
    const steps = colors.length;
    for (let i = 0; i < steps; i++) {
        grad.addColorStop(i / (steps - 1), colors[i]);
    }
    return grad;
}

function getMergedThemeForUser(userId) {
    const specialTheme = getSpecialUserTheme(userId, "userCard");
    if (!specialTheme) return USER_CARD_THEME;

    const merged = JSON.parse(JSON.stringify(USER_CARD_THEME));

    if (specialTheme.title) {
        merged.title = { ...merged.title, ...specialTheme.title };
    }
    if (specialTheme.avatar?.placeholderText) {
        merged.avatar.placeholderText = specialTheme.avatar.placeholderText;
    }
    if (specialTheme.name) {
        merged.name = { ...merged.name, ...specialTheme.name };
    }
    if (specialTheme.userId) {
        merged.userId = { ...merged.userId, ...specialTheme.userId };
    }
    if (specialTheme.rows) {
        merged.rows = { ...merged.rows, ...specialTheme.rows };
    }
    if (specialTheme.footer) {
        merged.footer = { ...merged.footer, ...specialTheme.footer };
    }

    return merged;
}

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
    if (!maxWidth || maxWidth <= 0) return "";
    if (ctx.measureText(input).width <= maxWidth) return input;

    let out = input;
    while (out.length > 0 && ctx.measureText(`${out}...`).width > maxWidth) {
        out = out.slice(0, -1);
    }

    return `${out}...`;
}

function extractFontSize(font, fallback = 24) {
    const match = String(font || "").match(/(\d+(?:\.\d+)?)px/i);
    if (!match) return fallback;
    const size = Number(match[1]);
    return Number.isFinite(size) && size > 0 ? size : fallback;
}

function withFontSize(font, size) {
    const safeSize = Math.max(8, Math.round(Number(size) || 0));
    if (String(font || "").match(/(\d+(?:\.\d+)?)px/i)) {
        return String(font).replace(/(\d+(?:\.\d+)?)px/i, `${safeSize}px`);
    }
    return `700 ${safeSize}px ${FONT_STACK}`;
}

function splitLongToken(ctx, token, maxWidth) {
    const out = [];
    let current = "";
    const chars = Array.from(String(token || ""));

    for (const ch of chars) {
        const next = `${current}${ch}`;
        if (current && ctx.measureText(next).width > maxWidth) {
            out.push(current);
            current = ch;
        } else {
            current = next;
        }
    }

    if (current) out.push(current);
    return out.length > 0 ? out : [""];
}

function wrapTextByWords(ctx, text, maxWidth) {
    const safeText = String(text || "").trim();
    if (!safeText) return [""];

    const words = safeText.split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";

    for (const word of words) {
        if (ctx.measureText(word).width > maxWidth) {
            const pieces = splitLongToken(ctx, word, maxWidth);
            for (const piece of pieces) {
                if (!current) {
                    current = piece;
                } else {
                    lines.push(current);
                    current = piece;
                }
            }
            continue;
        }

        const next = current ? `${current} ${word}` : word;
        if (!current || ctx.measureText(next).width <= maxWidth) {
            current = next;
        } else {
            lines.push(current);
            current = word;
        }
    }

    if (current) lines.push(current);
    return lines.length > 0 ? lines : [""];
}

function fitWrappedTextByFont(ctx, text, maxWidth, maxLines, maxFontSize, minFontSize, baseFont) {
    let fontSize = Math.max(minFontSize, maxFontSize);

    while (fontSize >= minFontSize) {
        ctx.font = withFontSize(baseFont, fontSize);
        const lines = wrapTextByWords(ctx, text, maxWidth);
        if (lines.length <= maxLines) {
            return { fontSize, lines };
        }
        fontSize -= 2;
    }

    ctx.font = withFontSize(baseFont, minFontSize);
    const lines = wrapTextByWords(ctx, text, maxWidth).slice(0, maxLines);
    if (lines.length > 0) {
        lines[lines.length - 1] = fitText(ctx, lines[lines.length - 1], maxWidth);
    }

    return { fontSize: minFontSize, lines };
}

function fitSingleLineByFont(ctx, text, maxWidth, maxFontSize, minFontSize, baseFont) {
    const raw = String(text || "");
    let fontSize = Math.max(minFontSize, maxFontSize);

    while (fontSize >= minFontSize) {
        ctx.font = withFontSize(baseFont, fontSize);
        if (ctx.measureText(raw).width <= maxWidth) {
            return { fontSize, text: raw };
        }
        fontSize -= 1;
    }

    ctx.font = withFontSize(baseFont, minFontSize);
    return {
        fontSize: minFontSize,
        text: fitText(ctx, raw, maxWidth),
    };
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

function drawBackground(ctx, width, height, userId) {
    const specialTheme = getSpecialUserTheme(userId, "userCard");
    const theme = specialTheme || USER_CARD_THEME;
    const bgGradient = theme.background.gradient;
    const bgGlow = theme.background.glow;
    const bgDots = theme.background.dots;

    const bg = ctx.createLinearGradient(0, 0, width, height);
    for (const stop of bgGradient) {
        bg.addColorStop(stop.stop, stop.color);
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    for (const glow of bgGlow) {
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

    ctx.fillStyle = bgDots.color;
    for (let y = bgDots.step / 2; y < height; y += bgDots.step) {
        for (let x = bgDots.step / 2; x < width; x += bgDots.step) {
            ctx.beginPath();
            ctx.arc(x, y, bgDots.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawContainer(ctx, userId) {
    const card = USER_CARD_THEME.card;
    const specialCardTheme = getSpecialUserTheme(userId, "userCard");
    const cardTheme = specialCardTheme?.card || { fill: card.fill, stroke: card.stroke };

    ctx.save();
    ctx.shadowColor = card.blurShadow;
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 18;
    roundRect(ctx, card.x, card.y, card.width, card.height, card.radius);
    ctx.fillStyle = cardTheme.fill;
    ctx.fill();
    ctx.restore();

    roundRect(ctx, card.x, card.y, card.width, card.height, card.radius);
    ctx.strokeStyle = cardTheme.stroke;
    ctx.lineWidth = card.lineWidth;
    ctx.stroke();
}

function drawTitle(ctx, userId) {
    const mergedTheme = getMergedThemeForUser(userId);
    const title = mergedTheme.title;
    const divider = mergedTheme.divider;

    ctx.font = title.titleFont;
    ctx.fillStyle = title.titleColor;
    const titleText = fitText(ctx, title.text, divider.width - 20);
    ctx.fillText(titleText, title.x, title.y);

    ctx.font = title.subFont;
    ctx.fillStyle = title.subColor;
    const subtitleText = fitText(ctx, title.subText, divider.width - 20);
    ctx.fillText(subtitleText, title.x, title.y + 36);

    ctx.beginPath();
    ctx.moveTo(divider.x, divider.y);
    ctx.lineTo(divider.x + divider.width, divider.y);
    ctx.strokeStyle = divider.color;
    ctx.lineWidth = divider.lineWidth;
    ctx.stroke();
}

async function drawAvatar(ctx, profile, userId) {
    const mergedTheme = getMergedThemeForUser(userId);
    const cfg = mergedTheme.avatar;

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

function drawName(ctx, profile, userId) {
    const mergedTheme = getMergedThemeForUser(userId);
    const nameCfg = mergedTheme.name;
    const uidCfg = mergedTheme.userId;
    const leftBound = USER_CARD_THEME.card.x + 22;
    const rightBound = Math.max(leftBound + 120, mergedTheme.rows.boxX - 24);
    const nameMaxWidth = Math.max(180, rightBound - leftBound);
    const nameCenterX = leftBound + nameMaxWidth / 2;

    const displayName = String(
        profile.displayName || profile.zaloName || "Ng\u01b0\u1eddi d\u00f9ng"
    ).trim();

    const specialTheme = getSpecialUserTheme(userId, "userCard");
    const isRainbow = specialTheme?.rainbow === true && Array.isArray(specialTheme.colors);
    const rainbowColors = isRainbow ? specialTheme.colors : null;

    const nameBaseSize = extractFontSize(nameCfg.font, 42);
    const nameLayout = fitWrappedTextByFont(
        ctx,
        displayName,
        nameMaxWidth,
        2,
        nameBaseSize,
        26,
        nameCfg.font
    );
    ctx.font = withFontSize(nameCfg.font, nameLayout.fontSize);
    const lineHeight = Math.round(nameLayout.fontSize * 1.15);
    let nameY = nameCfg.y;
    for (const line of nameLayout.lines) {
        const nameWidth = ctx.measureText(line).width;
        if (isRainbow) {
            ctx.fillStyle = createRainbowGradient(ctx, nameCenterX - nameWidth / 2, nameWidth, rainbowColors);
        } else {
            ctx.fillStyle = nameCfg.color;
        }
        ctx.fillText(line, nameCenterX - nameWidth / 2, nameY);
        nameY += lineHeight;
    }

    const uid = String(profile.userId || profile.uid || "").trim();
    if (uid) {
        const uidText = `UID: ${uid}`;
        const uidBaseSize = extractFontSize(uidCfg.font, 20);
        const uidLayout = fitSingleLineByFont(ctx, uidText, nameMaxWidth, uidBaseSize, 14, uidCfg.font);
        ctx.font = withFontSize(uidCfg.font, uidLayout.fontSize);
        const uidWidth = ctx.measureText(uidLayout.text).width;
        const uidY = Math.max(uidCfg.y, nameCfg.y + nameLayout.lines.length * lineHeight + 12);
        if (isRainbow) {
            ctx.fillStyle = createRainbowGradient(ctx, nameCenterX - uidWidth / 2, uidWidth, rainbowColors);
        } else {
            ctx.fillStyle = uidCfg.color;
        }
        ctx.fillText(uidLayout.text, nameCenterX - uidWidth / 2, uidY);
    }
}

function drawRows(ctx, profile, userId) {
    const mergedTheme = getMergedThemeForUser(userId);
    const cfg = mergedTheme.rows;
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

        const valueBaseSize = extractFontSize(cfg.valueFont, 24);
        const valueText = String(row.value || "Kh\u00f4ng r\u00f5");
        const fittedValue = fitSingleLineByFont(
            ctx,
            valueText,
            cfg.valueMaxWidth,
            valueBaseSize,
            16,
            cfg.valueFont
        );
        ctx.font = withFontSize(cfg.valueFont, fittedValue.fontSize);
        ctx.fillStyle = cfg.valueColor || row.color;
        const textWidth = ctx.measureText(fittedValue.text).width;
        const valueY = rowY + Math.round(cfg.rowHeight / 2) + Math.round(fittedValue.fontSize * 0.35);
        ctx.fillText(fittedValue.text, cfg.boxX + cfg.boxWidth - 24 - textWidth, valueY);

        rowY += cfg.rowHeight + cfg.rowGap;
    }
}

function drawFooter(ctx, userId) {
    const mergedTheme = getMergedThemeForUser(userId);
    const footer = mergedTheme.footer;
    ctx.font = footer.font;
    ctx.fillStyle = footer.color;

    const cardRight = USER_CARD_THEME.card.x + USER_CARD_THEME.card.width - 20;
    const text = fitText(ctx, footer.text, 260);
    const width = ctx.measureText(text).width;
    const x = Math.min(footer.x - width, cardRight - width);
    ctx.fillText(text, x, footer.y);
}

async function createUserInfoCard(profile, options = {}) {
    registerDesignFonts();

    const width = options.width || USER_CARD_THEME.size.width;
    const height = options.height || USER_CARD_THEME.size.height;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const userId = String(profile.userId || profile.uid || "").trim();
    drawBackground(ctx, width, height, userId);
    drawContainer(ctx, userId);
    drawTitle(ctx, userId);
    await drawAvatar(ctx, profile, userId);
    drawName(ctx, profile, userId);
    drawRows(ctx, profile, userId);
    drawFooter(ctx, userId);

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
