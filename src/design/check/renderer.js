const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const { FONT_STACK, FONT_STACK_EMOJI, registerDesignFonts } = require("../shared/registerFonts");
const { getSpecialUserTheme } = require("../specialUsersConfig");

const CHECK_THEME = {
    width: 1500,
    height: 760,
    sideWidth: 340,
    centerPadding: 32,
    centerPanelRadius: 24,
    avatarRadius: 98,
    backgroundGradient: [
        { stop: 0, color: "#ffe8f2" },
        { stop: 0.5, color: "#ffd7e9" },
        { stop: 1, color: "#ffc5de" },
    ],
    centerPanelColor: "rgba(255, 247, 252, 0.9)",
    centerPanelStroke: "rgba(190, 24, 93, 0.28)",
    titleColor: "#7e0c46",
    labelColor: "#a10f5c",
    valueColor: "#9f1239",
    bodyColor: "#6b214b",
    avatarRingColor: "#fff5fb",
    avatarBgColor: "#fff0f7",
};

const SPECIAL_USER_THEME = Object.values(require("../specialUsersConfig").SPECIAL_USERS)[0]?.themes?.check || {
    backgroundGradient: [
        { stop: 0, color: "#ffc0cb" },
        { stop: 0.5, color: "#ffb6c1" },
        { stop: 1, color: "#ff69b4" },
    ],
};

const CHECK_SIDE_IMAGE_LINK =
    "https://drive.google.com/file/d/1EStfOFpFsBvP6kLw9aJkdS5gAvzGgyKz/view?usp=drive_link";

const SIDE_IMAGE_CACHE = new Map();
const SIDE_IMAGE_CACHE_LIMIT = 6;
const IMAGE_FETCH_TIMEOUT_MS =
    Number(process.env.IMAGE_FETCH_TIMEOUT_MS) > 0
        ? Number(process.env.IMAGE_FETCH_TIMEOUT_MS)
        : 12000;

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

function extractDriveFileId(input) {
    const text = String(input || "").trim();
    if (!text) return "";

    const idFromPath = text.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (idFromPath?.[1]) return idFromPath[1];

    const idFromQuery = text.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idFromQuery?.[1]) return idFromQuery[1];

    return "";
}

function toDirectDriveUrl(input) {
    const id = extractDriveFileId(input);
    if (!id) return String(input || "");
    return `https://drive.google.com/uc?export=download&id=${id}`;
}

function rememberSideImageCache(key, valuePromise) {
    if (!SIDE_IMAGE_CACHE.has(key) && SIDE_IMAGE_CACHE.size >= SIDE_IMAGE_CACHE_LIMIT) {
        const oldestKey = SIDE_IMAGE_CACHE.keys().next().value;
        if (oldestKey) {
            SIDE_IMAGE_CACHE.delete(oldestKey);
        }
    }
    SIDE_IMAGE_CACHE.set(key, valuePromise);
}

async function fetchRemoteImage(normalizedUrl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(normalizedUrl, { signal: controller.signal });
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        return await loadImage(Buffer.from(arrayBuffer));
    } catch (_) {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

async function loadRemoteImageCached(url, { isDrive = false, cache = false } = {}) {
    const normalizedUrl = isDrive ? toDirectDriveUrl(url) : String(url || "");
    if (!normalizedUrl) return null;

    if (!cache) {
        return fetchRemoteImage(normalizedUrl);
    }

    if (!SIDE_IMAGE_CACHE.has(normalizedUrl)) {
        rememberSideImageCache(normalizedUrl, fetchRemoteImage(normalizedUrl));
    }

    return SIDE_IMAGE_CACHE.get(normalizedUrl);
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

function fitWrapText(ctx, text, maxWidth, maxFontSize, minFontSize, maxLines) {
    const safeText = String(text || "").trim();
    let fontSize = maxFontSize;

    while (fontSize > minFontSize) {
        ctx.font = `700 ${fontSize}px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
        const lines = wrapTextByWords(ctx, safeText, maxWidth);
        if (lines.length <= maxLines) {
            return { lines, fontSize };
        }
        fontSize -= 2;
    }

    ctx.font = `700 ${minFontSize}px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    const lines = wrapTextByWords(ctx, safeText, maxWidth).slice(0, maxLines);
    if (lines.length === maxLines) {
        lines[maxLines - 1] = fitText(ctx, lines[maxLines - 1], maxWidth);
    }

    return { lines, fontSize: minFontSize };
}

function drawBackground(ctx, width, height, userId) {
    const specialTheme = getSpecialUserTheme(userId, "check");
    const theme = specialTheme || CHECK_THEME;
    const bg = ctx.createLinearGradient(0, 0, width, height);
    for (const stop of theme.backgroundGradient) {
        bg.addColorStop(stop.stop, stop.color);
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
}

function drawFallbackSide(ctx, x, y, width, height, isLeft) {
    const grad = ctx.createLinearGradient(x, y, x + width, y + height);
    if (isLeft) {
        grad.addColorStop(0, "#ffb9d8");
        grad.addColorStop(1, "#ff94c2");
    } else {
        grad.addColorStop(0, "#ff9ec9");
        grad.addColorStop(1, "#ff74b1");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, width, height);
}

function drawCenterPanel(ctx, width, height) {
    const panelX = CHECK_THEME.sideWidth + CHECK_THEME.centerPadding;
    const panelY = 26;
    const panelW = width - CHECK_THEME.sideWidth * 2 - CHECK_THEME.centerPadding * 2;
    const panelH = height - 52;

    roundRect(ctx, panelX, panelY, panelW, panelH, CHECK_THEME.centerPanelRadius);
    ctx.fillStyle = CHECK_THEME.centerPanelColor;
    ctx.fill();
    ctx.strokeStyle = CHECK_THEME.centerPanelStroke;
    ctx.lineWidth = 1.4;
    ctx.stroke();
}

function drawAvatar(ctx, image, x, y, radius, displayName) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 9, 0, Math.PI * 2);
    ctx.fillStyle = CHECK_THEME.avatarRingColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = CHECK_THEME.avatarBgColor;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius - 4, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (image) {
        ctx.drawImage(image, x - radius + 4, y - radius + 4, (radius - 4) * 2, (radius - 4) * 2);
    } else {
        const grad = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
        grad.addColorStop(0, "#ffc4e0");
        grad.addColorStop(1, "#ec4899");
        ctx.fillStyle = grad;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

        const safeLetter = letter.toUpperCase();
        ctx.font = `800 68px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
        ctx.fillStyle = "#5f1240";
        const letterW = ctx.measureText(safeLetter).width;
        ctx.fillText(safeLetter, x - letterW / 2, y + 22);
    }

    ctx.restore();
}

function drawDot(ctx, x, y, color) {
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
}

async function createCheckImage(payload, options = {}) {
    registerDesignFonts();

    const width = options.width || CHECK_THEME.width;
    const height = options.height || CHECK_THEME.height;
    const displayName = String(payload?.displayName || "B\u1ea1n").trim();
    const title = String(payload?.title || "K\u1ebft Qu\u1ea3 Check").trim();
    const comment = String(payload?.comment || "").trim();
    const percent = Math.max(0, Math.min(200, Number(payload?.percent) || 0));

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    drawBackground(ctx, width, height, payload?.userId);

    const [sideImage, avatarImage] = await Promise.all([
        loadRemoteImageCached(CHECK_SIDE_IMAGE_LINK, { isDrive: true, cache: true }),
        loadRemoteImageCached(payload?.avatarUrl || "", { cache: false }),
    ]);

    const sideWidth = CHECK_THEME.sideWidth;
    if (sideImage) {
        ctx.drawImage(sideImage, 0, 0, sideWidth, height);
    } else {
        drawFallbackSide(ctx, 0, 0, sideWidth, height, true);
    }

    if (sideImage) {
        ctx.drawImage(sideImage, width - sideWidth, 0, sideWidth, height);
    } else {
        drawFallbackSide(ctx, width - sideWidth, 0, sideWidth, height, false);
    }

    drawCenterPanel(ctx, width, height);

    const centerLeft = sideWidth + CHECK_THEME.centerPadding;
    const centerWidth = width - sideWidth * 2 - CHECK_THEME.centerPadding * 2;
    const centerX = width / 2;

    ctx.font = `900 66px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = CHECK_THEME.titleColor;
    const titleText = fitText(ctx, title, centerWidth - 80);
    const titleWidth = ctx.measureText(titleText).width;
    ctx.fillText(titleText, centerX - titleWidth / 2, 140);

    const avatarX = centerLeft + 170;
    const avatarY = 360;
    drawAvatar(ctx, avatarImage, avatarX, avatarY, CHECK_THEME.avatarRadius, displayName);

    const infoLeftX = centerLeft + 310;
    const infoWidth = centerWidth - 360;

    drawDot(ctx, infoLeftX, 252, "#ec4899");
    ctx.font = `800 48px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = CHECK_THEME.labelColor;
    ctx.fillText("T\u00ean:", infoLeftX + 24, 266);

    ctx.font = `800 50px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = CHECK_THEME.valueColor;
    const safeName = fitText(ctx, displayName, infoWidth - 120);
    ctx.fillText(safeName, infoLeftX + 178, 266);

    drawDot(ctx, infoLeftX, 338, "#db2777");
    ctx.font = `800 48px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = CHECK_THEME.labelColor;
    ctx.fillText("M\u1ee9c \u0111\u1ed9:", infoLeftX + 24, 352);

    ctx.font = `900 68px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = "#be185d";
    ctx.fillText(`${percent}%`, infoLeftX + 244, 360);

    drawDot(ctx, infoLeftX, 422, "#be185d");
    ctx.font = `800 48px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = CHECK_THEME.labelColor;
    ctx.fillText("Nh\u1eadn x\u00e9t:", infoLeftX + 24, 436);

    const commentWidth = infoWidth;
    const commentLayout = fitWrapText(ctx, comment, commentWidth, 45, 30, 4);
    ctx.font = `700 ${commentLayout.fontSize}px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = CHECK_THEME.bodyColor;
    const lineHeight = Math.round(commentLayout.fontSize * 1.22);
    const commentStartY = 492;
    for (let i = 0; i < commentLayout.lines.length; i += 1) {
        ctx.fillText(commentLayout.lines[i], infoLeftX + 24, commentStartY + i * lineHeight);
    }

    const tempDir = path.resolve(options.tempDir || "tmp");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName =
        options.fileName ||
        `check-${payload?.userId || "member"}-${Date.now()}-${Math.random()
            .toString(16)
            .slice(2, 8)}.png`;
    const outputPath = path.join(tempDir, fileName);
    fs.writeFileSync(outputPath, canvas.toBuffer("image/png"));
    return outputPath;
}

module.exports = {
    CHECK_THEME,
    createCheckImage,
};
