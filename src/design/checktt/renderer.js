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
    return `700 ${safeSize}px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
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
        fontSize -= 1;
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
            return { text: raw, fontSize };
        }
        fontSize -= 1;
    }

    ctx.font = withFontSize(baseFont, minFontSize);
    return {
        text: fitText(ctx, raw, maxWidth),
        fontSize: minFontSize,
    };
}

function formatCount(num) {
    return new Intl.NumberFormat("vi-VN").format(Number(num) || 0);
}

function formatDateTimeVN(dateLike) {
    if (!dateLike) return "Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u";
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) return "Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u";

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

function drawPanel(ctx, userId, canvasHeight) {
    const panelCfg = CHECKTT_THEME.panel;
    const specialPanel = getSpecialUserTheme(userId, "checktt");
    const panelTheme = specialPanel?.panel || { fill: panelCfg.fill, stroke: panelCfg.stroke };

    const panelHeight = Math.max(panelCfg.height, canvasHeight - panelCfg.y * 2);
    roundRect(ctx, panelCfg.x, panelCfg.y, panelCfg.width, panelHeight, panelCfg.radius);
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

function drawAvatar(ctx, avatarImage, displayName) {
    const cfg = CHECKTT_THEME.avatar;

    ctx.beginPath();
    ctx.arc(cfg.x, cfg.y, cfg.radius + 9, 0, Math.PI * 2);
    ctx.fillStyle = cfg.ring;
    ctx.fill();

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

    const titleFont = `800 42px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.font = titleFont;
    ctx.fillStyle = colors.titleColor;
    ctx.fillText(fitText(ctx, "TH\u00d4NG TIN TH\u00c0NH VI\u00caN", 880), 392, 128);

    const nameBaseFont = `800 54px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    const nameLayout = fitWrappedTextByFont(ctx, displayName, 880, 2, 54, 30, nameBaseFont);
    ctx.font = withFontSize(nameBaseFont, nameLayout.fontSize);
    ctx.fillStyle = colors.displayNameColor;
    const nameLineHeight = Math.round(nameLayout.fontSize * 1.08);
    let nameY = 204;
    for (const line of nameLayout.lines) {
        ctx.fillText(line, 392, nameY);
        nameY += nameLineHeight;
    }

    const uidFont = `600 20px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.font = uidFont;
    ctx.fillStyle = colors.uidColor;
    const uidY = nameY + 6;
    ctx.fillText(fitText(ctx, `UID: ${payload.userId}`, 880), 394, uidY);

    const rows = [
        { label: "T\u00ean ingame", value: String(ingameName || "").trim() || "Ch\u01b0a set ingame" },
        { label: "Th\u1eddi gian v\u00e0o nh\u00f3m", value: formatDateTimeVN(joinDate) },
        { label: "Ng\u01b0\u1eddi th\u00eam/duy\u1ec7t", value: addedByLabel || "Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u" },
        { label: "T\u1ed5ng tin nh\u1eafn t\u00edch l\u0169y", value: `${formatCount(totalMsgCount)} tin nh\u1eafn` },
    ];

    let rowTop = uidY + 26;
    for (const row of rows) {
        const rowHeight = 76;
        const rowRight = 392 + 898 - 24;
        const labelX = 420;
        const labelMaxWidth = 300;
        const valueMaxWidth = Math.max(220, rowRight - labelX - labelMaxWidth - 16);

        roundRect(ctx, 392, rowTop, 898, rowHeight, 15);
        ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
        ctx.fill();
        ctx.strokeStyle = "rgba(180, 83, 9, 0.24)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = `600 22px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
        ctx.fillStyle = colors.rowLabelColor;
        const safeLabel = fitText(ctx, row.label, labelMaxWidth);
        ctx.fillText(safeLabel, labelX, rowTop + 47);

        const valueBaseFont = `700 29px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
        const valueLayout = fitSingleLineByFont(
            ctx,
            row.value,
            valueMaxWidth,
            29,
            20,
            valueBaseFont
        );
        ctx.font = withFontSize(valueBaseFont, valueLayout.fontSize);
        ctx.fillStyle = colors.rowValueColor;
        const valueWidth = ctx.measureText(valueLayout.text).width;
        ctx.fillText(valueLayout.text, rowRight - valueWidth, rowTop + 47);

        rowTop += rowHeight + 14;
    }

    return rowTop;
}

async function createCheckTTCard(payload, options = {}) {
    registerDesignFonts();

    const width = options.width || CHECKTT_THEME.width;
    const baseHeight = options.height || CHECKTT_THEME.height;

    const avatarImage = await loadRemoteImage(payload.avatarUrl);

    function renderAtHeight(targetHeight) {
        const canvas = createCanvas(width, Math.max(targetHeight, 420));
        const ctx = canvas.getContext("2d");

        drawBackground(ctx, width, canvas.height, payload.userId);
        drawPanel(ctx, payload.userId, canvas.height);
        drawAvatar(ctx, avatarImage, payload.displayName);
        const bottomY = drawTextBlock(ctx, payload, payload.userId);

        return { canvas, bottomY };
    }

    let { canvas, bottomY } = renderAtHeight(baseHeight);
    const requiredHeight = Math.max(baseHeight, Math.ceil(bottomY + 44));
    if (requiredHeight > canvas.height) {
        ({ canvas } = renderAtHeight(requiredHeight));
    }

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
