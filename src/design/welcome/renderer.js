const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { FONT_STACK, FONT_STACK_EMOJI, registerDesignFonts } = require("../shared/registerFonts");

const WELCOME_THEME = {
    width: 1500,
    height: 680,
    sideWidth: 360,
    centerPadding: 32,
    centerPanelRadius: 24,
    avatarRadius: 88,
    textColor: "#7c2d12",
    centerPanelColor: "rgba(255, 252, 235, 0.86)",
    centerPanelStroke: "rgba(180, 83, 9, 0.32)",
    backgroundGradient: [
        { stop: 0, color: "#fff8dc" },
        { stop: 0.52, color: "#fef3c7" },
        { stop: 1, color: "#fde68a" },
    ],
    avatarRingColor: "#fffbeb",
    avatarBgColor: "#fef9c3",
};

const SIDE_IMAGE_LINKS = {
    left: "https://drive.google.com/file/d/1-xcxkv8nPkieYiccM1SqYTvlOojd1249/view?usp=drive_link",
    right: "https://drive.google.com/file/d/1dDCf5KIi-vo-N-5zhdZJXDQz60Ee9ckI/view?usp=drive_link",
};

const SIDE_IMAGE_CACHE = new Map();
const SIDE_IMAGE_CACHE_LIMIT = 4;
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

async function fetchRemoteImage(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        return await loadImage(Buffer.from(arrayBuffer));
    } catch (_) {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

async function loadRemoteImageCached(inputUrl, { cache = false } = {}) {
    const url = toDirectDriveUrl(inputUrl);
    if (!url) return null;

    if (!cache) {
        return fetchRemoteImage(url);
    }

    if (!SIDE_IMAGE_CACHE.has(url)) {
        rememberSideImageCache(url, fetchRemoteImage(url));
    }

    return SIDE_IMAGE_CACHE.get(url);
}

function fitTextWithSize(ctx, text, maxWidth, maxFontSize, minFontSize) {
    const safeText = String(text || "");
    let fontSize = maxFontSize;

    while (fontSize > minFontSize) {
        ctx.font = `800 ${fontSize}px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
        if (ctx.measureText(safeText).width <= maxWidth) {
            break;
        }
        fontSize -= 2;
    }

    return {
        text: safeText,
        fontSize,
    };
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

function trimLineWithEllipsis(ctx, text, maxWidth) {
    const input = String(text || "");
    if (ctx.measureText(input).width <= maxWidth) return input;

    let out = input;
    while (out.length > 0 && ctx.measureText(`${out}...`).width > maxWidth) {
        out = out.slice(0, -1);
    }
    return `${out}...`;
}

function fitTextWithWrap(ctx, text, maxWidth, maxFontSize, minFontSize, maxLines) {
    const safeText = String(text || "").trim();
    let fontSize = maxFontSize;

    while (fontSize > minFontSize) {
        ctx.font = `800 ${fontSize}px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
        const lines = wrapTextByWords(ctx, safeText, maxWidth);
        if (lines.length <= maxLines) {
            return { lines, fontSize };
        }
        fontSize -= 2;
    }

    ctx.font = `800 ${minFontSize}px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    const rawLines = wrapTextByWords(ctx, safeText, maxWidth);
    const lines = rawLines.slice(0, maxLines);
    if (rawLines.length > maxLines && lines.length > 0) {
        const rest = rawLines.slice(maxLines - 1).join(" ");
        lines[maxLines - 1] = trimLineWithEllipsis(ctx, rest, maxWidth);
    }

    return { lines, fontSize: minFontSize };
}

function drawFallbackSide(ctx, x, y, width, height, isLeft) {
    const grad = ctx.createLinearGradient(x, y, x + width, y + height);
    if (isLeft) {
        grad.addColorStop(0, "#fde68a");
        grad.addColorStop(1, "#fcd34d");
    } else {
        grad.addColorStop(0, "#fcd34d");
        grad.addColorStop(1, "#fbbf24");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, width, height);
}

function drawCenterBackground(ctx, width, height) {
    const centerX = WELCOME_THEME.sideWidth;
    const centerWidth = width - WELCOME_THEME.sideWidth * 2;
    const centerY = 26;
    const centerHeight = height - 52;

    roundRect(
        ctx,
        centerX + WELCOME_THEME.centerPadding,
        centerY,
        centerWidth - WELCOME_THEME.centerPadding * 2,
        centerHeight,
        WELCOME_THEME.centerPanelRadius
    );
    ctx.fillStyle = WELCOME_THEME.centerPanelColor;
    ctx.fill();
    ctx.strokeStyle = WELCOME_THEME.centerPanelStroke;
    ctx.lineWidth = 1.4;
    ctx.stroke();
}

function drawAvatar(ctx, avatarImage, centerX, centerY, displayName) {
    const radius = WELCOME_THEME.avatarRadius;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 9, 0, Math.PI * 2);
    ctx.fillStyle = WELCOME_THEME.avatarRingColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = WELCOME_THEME.avatarBgColor;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 4, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (avatarImage) {
        ctx.drawImage(
            avatarImage,
            centerX - radius + 4,
            centerY - radius + 4,
            (radius - 4) * 2,
            (radius - 4) * 2
        );
    } else {
        const fallback = ctx.createLinearGradient(
            centerX - radius,
            centerY - radius,
            centerX + radius,
            centerY + radius
        );
        fallback.addColorStop(0, "#fef3c7");
        fallback.addColorStop(1, "#f59e0b");
        ctx.fillStyle = fallback;
        ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

        const letter = String(displayName || "?").trim()[0] || "?";
        ctx.font = `800 64px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
        ctx.fillStyle = "#7c2d12";
        const textWidth = ctx.measureText(letter.toUpperCase()).width;
        ctx.fillText(letter.toUpperCase(), centerX - textWidth / 2, centerY + 22);
    }

    ctx.restore();
}

async function createWelcomeImage(profile, options = {}) {
    registerDesignFonts();

    const width = options.width || WELCOME_THEME.width;
    const height = options.height || WELCOME_THEME.height;
    const displayName = String(
        profile?.displayName || profile?.zaloName || "B\u1ea1n"
    ).trim();

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, width, height);
    for (const stop of WELCOME_THEME.backgroundGradient) {
        bg.addColorStop(stop.stop, stop.color);
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const [leftImage, rightImage, avatarImage] = await Promise.all([
        loadRemoteImageCached(SIDE_IMAGE_LINKS.left, { cache: true }),
        loadRemoteImageCached(SIDE_IMAGE_LINKS.right, { cache: true }),
        loadRemoteImageCached(profile?.avatar, { cache: false }),
    ]);

    const sideWidth = WELCOME_THEME.sideWidth;
    if (leftImage) {
        ctx.drawImage(leftImage, 0, 0, sideWidth, height);
    } else {
        drawFallbackSide(ctx, 0, 0, sideWidth, height, true);
    }

    if (rightImage) {
        ctx.drawImage(rightImage, width - sideWidth, 0, sideWidth, height);
    } else {
        drawFallbackSide(ctx, width - sideWidth, 0, sideWidth, height, false);
    }

    drawCenterBackground(ctx, width, height);

    const centerX = width / 2;
    drawAvatar(ctx, avatarImage, centerX, 228, displayName);

    const text = `Ch\u00e0o m\u1eebng ${displayName} \u0111\u1ebfn v\u1edbi khu gi\u1ea3i tr\u00ed DHA`;
    const textAreaWidth = width - sideWidth * 2 - 110;
    const textLayout = fitTextWithWrap(ctx, text, textAreaWidth, 52, 30, 3);
    ctx.font = `800 ${textLayout.fontSize}px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = WELCOME_THEME.textColor;
    const lineHeight = Math.round(textLayout.fontSize * 1.2);
    const firstLineY = 422 - ((textLayout.lines.length - 1) * lineHeight) / 2;
    for (let i = 0; i < textLayout.lines.length; i += 1) {
        const line = textLayout.lines[i];
        const lineWidth = ctx.measureText(line).width;
        ctx.fillText(line, centerX - lineWidth / 2, firstLineY + i * lineHeight);
    }

    ctx.font = `600 24px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = "rgba(120, 53, 15, 0.92)";
    const subText = "Ch\u00fac b\u1ea1n c\u00f3 nh\u1eefng ph\u00fat gi\u00e2y vui v\u1ebb c\u00f9ng c\u1ed9ng \u0111\u1ed3ng";
    const subWidth = ctx.measureText(subText).width;
    const subY = firstLineY + textLayout.lines.length * lineHeight + 42;
    ctx.fillText(subText, centerX - subWidth / 2, subY);

    const tempDir = path.resolve(options.tempDir || "tmp");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName =
        options.fileName ||
        `welcome-${profile?.userId || "member"}-${Date.now()}-${Math.random()
            .toString(16)
            .slice(2, 8)}.png`;
    const outputPath = path.join(tempDir, fileName);
    fs.writeFileSync(outputPath, canvas.toBuffer("image/png"));

    return outputPath;
}

module.exports = {
    WELCOME_THEME,
    SIDE_IMAGE_LINKS,
    createWelcomeImage,
};

