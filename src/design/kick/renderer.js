const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const {
    FONT_STACK,
    FONT_STACK_EMOJI,
    registerDesignFonts,
} = require("../shared/registerFonts");

const { SIDE_IMAGE_LINKS } = require("../welcome/renderer");

const KICK_IMAGE_THEME = {
    width: 1500,
    height: 680,
    sideWidth: 360,
    centerPadding: 32,
    centerPanelRadius: 24,
    textColor: "#7c2d12",
    centerPanelColor: "rgba(255, 252, 235, 0.9)",
    centerPanelStroke: "rgba(180, 83, 9, 0.32)",
    backgroundGradient: [
        { stop: 0, color: "#fff8dc" },
        { stop: 0.52, color: "#fef3c7" },
        { stop: 1, color: "#fde68a" },
    ],
    avatarRadius: 72,
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
        ctx.font = `800 ${fontSize}px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
        const lines = wrapTextByWords(ctx, safeText, maxWidth);
        if (lines.length <= maxLines) {
            return { lines, fontSize };
        }
        fontSize -= 2;
    }

    ctx.font = `800 ${minFontSize}px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    const lines = wrapTextByWords(ctx, safeText, maxWidth).slice(0, maxLines);
    if (lines.length === maxLines) {
        lines[maxLines - 1] = fitText(ctx, lines[maxLines - 1], maxWidth);
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

function drawBackground(ctx, width, height) {
    const bg = ctx.createLinearGradient(0, 0, width, height);
    for (const stop of KICK_IMAGE_THEME.backgroundGradient) {
        bg.addColorStop(stop.stop, stop.color);
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
}

function drawCenterPanel(ctx, width, height) {
    const centerX = KICK_IMAGE_THEME.sideWidth;
    const centerWidth = width - KICK_IMAGE_THEME.sideWidth * 2;
    const centerY = 26;
    const centerHeight = height - 52;

    roundRect(
        ctx,
        centerX + KICK_IMAGE_THEME.centerPadding,
        centerY,
        centerWidth - KICK_IMAGE_THEME.centerPadding * 2,
        centerHeight,
        KICK_IMAGE_THEME.centerPanelRadius
    );
    ctx.fillStyle = KICK_IMAGE_THEME.centerPanelColor;
    ctx.fill();
    ctx.strokeStyle = KICK_IMAGE_THEME.centerPanelStroke;
    ctx.lineWidth = 1.4;
    ctx.stroke();
}

function drawAvatar(ctx, image, x, y, radius, displayName) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 7, 0, Math.PI * 2);
    ctx.fillStyle = "#fff9d4";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#fef3c7";
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius - 3, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (image) {
        ctx.drawImage(image, x - radius + 3, y - radius + 3, (radius - 3) * 2, (radius - 3) * 2);
    } else {
        const grad = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
        grad.addColorStop(0, "#fef3c7");
        grad.addColorStop(1, "#f59e0b");
        ctx.fillStyle = grad;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

        const letter = String(displayName || "?").trim()[0] || "?";
        ctx.font = `800 56px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
        ctx.fillStyle = "#7c2d12";
        const width = ctx.measureText(letter.toUpperCase()).width;
        ctx.fillText(letter.toUpperCase(), x - width / 2, y + 20);
    }

    ctx.restore();
}

function drawKickSymbol(ctx, x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 48, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fill();
    ctx.strokeStyle = "rgba(180, 83, 9, 0.3)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.font = `800 68px ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = "#b45309";
    const symbol = "\ud83e\uddb6";
    const width = ctx.measureText(symbol).width;
    ctx.fillText(symbol, x - width / 2, y + 24);
}

function drawNameTag(ctx, text, x, y, maxWidth) {
    ctx.font = `700 30px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = "#6b2a10";
    const safeText = fitText(ctx, text, maxWidth);
    const width = ctx.measureText(safeText).width;
    ctx.fillText(safeText, x - width / 2, y);
}

async function createKickEventImage(payload, options = {}) {
    registerDesignFonts();

    const width = options.width || KICK_IMAGE_THEME.width;
    const height = options.height || KICK_IMAGE_THEME.height;

    const kickerName = String(
        payload?.kicker?.displayName || payload?.kicker?.userId || "Ng\u01b0\u1eddi kick"
    );
    const targetName = String(
        payload?.target?.displayName || payload?.target?.userId || "Th\u00e0nh vi\u00ean"
    );
    const actionText =
        payload?.actionText ||
        `${targetName} \u0111\u00e3 b\u1ecb ${kickerName} s\u00fat kh\u1ecfi nh\u00f3m GE`;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    drawBackground(ctx, width, height);

    const [leftImage, rightImage, kickerAvatar, targetAvatar] = await Promise.all([
        loadRemoteImageCached(SIDE_IMAGE_LINKS.left, { isDrive: true, cache: true }),
        loadRemoteImageCached(SIDE_IMAGE_LINKS.right, { isDrive: true, cache: true }),
        loadRemoteImageCached(payload?.kicker?.avatar || "", { cache: false }),
        loadRemoteImageCached(payload?.target?.avatar || "", { cache: false }),
    ]);

    const sideWidth = KICK_IMAGE_THEME.sideWidth;
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

    drawCenterPanel(ctx, width, height);

    const centerX = width / 2;
    ctx.font = `900 54px ${FONT_STACK}`;
    ctx.fillStyle = KICK_IMAGE_THEME.textColor;
    const title = "KICKED OUT MEMBER";
    const titleWidth = ctx.measureText(title).width;
    ctx.fillText(title, centerX - titleWidth / 2, 146);

    const textAreaWidth = width - sideWidth * 2 - 110;
    const bodyLayout = fitWrapText(ctx, actionText, textAreaWidth, 42, 28, 2);
    ctx.font = `800 ${bodyLayout.fontSize}px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = "#7c2d12";
    const lineHeight = Math.round(bodyLayout.fontSize * 1.2);
    const firstLineY = 214;
    for (let i = 0; i < bodyLayout.lines.length; i += 1) {
        const line = bodyLayout.lines[i];
        const w = ctx.measureText(line).width;
        ctx.fillText(line, centerX - w / 2, firstLineY + i * lineHeight);
    }

    const avatarY = 356;
    const leftAvatarX = centerX - 164;
    const rightAvatarX = centerX + 164;
    drawAvatar(ctx, kickerAvatar, leftAvatarX, avatarY, KICK_IMAGE_THEME.avatarRadius, kickerName);
    drawAvatar(ctx, targetAvatar, rightAvatarX, avatarY, KICK_IMAGE_THEME.avatarRadius, targetName);
    drawKickSymbol(ctx, centerX, avatarY + 4);

    drawNameTag(ctx, kickerName, leftAvatarX, 476, 230);
    drawNameTag(ctx, targetName, rightAvatarX, 476, 230);

    ctx.font = `700 26px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = "#9a3412";
    const leftRole = "Ng\u01b0\u1eddi kick";
    const rightRole = "Ng\u01b0\u1eddi b\u1ecb kick";
    const leftRoleW = ctx.measureText(leftRole).width;
    const rightRoleW = ctx.measureText(rightRole).width;
    ctx.fillText(leftRole, leftAvatarX - leftRoleW / 2, 520);
    ctx.fillText(rightRole, rightAvatarX - rightRoleW / 2, 520);

    const subText = "Drama c\u00f3 ki\u1ec3m so\u00e1t, gi\u1eef v\u0103n minh nha c\u1ea3 nh\u00e0!";
    ctx.font = `600 24px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = "rgba(120, 53, 15, 0.92)";
    const subTextW = ctx.measureText(subText).width;
    ctx.fillText(subText, centerX - subTextW / 2, 578);

    const tempDir = path.resolve(options.tempDir || "tmp");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName =
        options.fileName ||
        `kick-${payload?.target?.userId || "member"}-${Date.now()}-${Math.random()
            .toString(16)
            .slice(2, 8)}.png`;
    const outputPath = path.join(tempDir, fileName);
    fs.writeFileSync(outputPath, canvas.toBuffer("image/png"));
    return outputPath;
}

async function createLeaveEventImage(payload, options = {}) {
    registerDesignFonts();

    const width = options.width || KICK_IMAGE_THEME.width;
    const height = options.height || KICK_IMAGE_THEME.height;

    const memberName = String(
        payload?.member?.displayName || payload?.member?.userId || "Th\u00e0nh vi\u00ean"
    );
    const actionText =
        payload?.actionText || `${memberName} \u0111\u00e3 x\u00e1ch d\u00e9p r\u1eddi nh\u00f3m GE`;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    drawBackground(ctx, width, height);

    const [leftImage, rightImage, memberAvatar] = await Promise.all([
        loadRemoteImageCached(SIDE_IMAGE_LINKS.left, { isDrive: true, cache: true }),
        loadRemoteImageCached(SIDE_IMAGE_LINKS.right, { isDrive: true, cache: true }),
        loadRemoteImageCached(payload?.member?.avatar || "", { cache: false }),
    ]);

    const sideWidth = KICK_IMAGE_THEME.sideWidth;
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

    drawCenterPanel(ctx, width, height);

    const centerX = width / 2;
    ctx.font = `900 54px ${FONT_STACK}`;
    ctx.fillStyle = KICK_IMAGE_THEME.textColor;
    const title = "T\u1ea0M BI\u1ec6T TH\u00c0NH VI\u00caN";
    const titleWidth = ctx.measureText(title).width;
    ctx.fillText(title, centerX - titleWidth / 2, 146);

    const textAreaWidth = width - sideWidth * 2 - 120;
    const bodyLayout = fitWrapText(ctx, actionText, textAreaWidth, 42, 28, 2);
    ctx.font = `800 ${bodyLayout.fontSize}px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = "#7c2d12";
    const lineHeight = Math.round(bodyLayout.fontSize * 1.2);
    const firstLineY = 220;
    for (let i = 0; i < bodyLayout.lines.length; i += 1) {
        const line = bodyLayout.lines[i];
        const lineW = ctx.measureText(line).width;
        ctx.fillText(line, centerX - lineW / 2, firstLineY + i * lineHeight);
    }

    const avatarY = 360;
    drawAvatar(ctx, memberAvatar, centerX, avatarY, 90, memberName);
    drawNameTag(ctx, memberName, centerX, 500, 360);

    ctx.font = `700 26px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = "#9a3412";
    const roleText = "Ng\u01b0\u1eddi r\u1eddi nh\u00f3m";
    const roleWidth = ctx.measureText(roleText).width;
    ctx.fillText(roleText, centerX - roleWidth / 2, 548);

    const subText = "H\u1eb9n g\u1eb7p l\u1ea1i \u1edf m\u1ed9t drama g\u1ea7n nh\u1ea5t!";
    ctx.font = `600 24px ${FONT_STACK}, ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = "rgba(120, 53, 15, 0.92)";
    const subWidth = ctx.measureText(subText).width;
    ctx.fillText(subText, centerX - subWidth / 2, 594);

    const tempDir = path.resolve(options.tempDir || "tmp");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName =
        options.fileName ||
        `leave-${payload?.member?.userId || "member"}-${Date.now()}-${Math.random()
            .toString(16)
            .slice(2, 8)}.png`;
    const outputPath = path.join(tempDir, fileName);
    fs.writeFileSync(outputPath, canvas.toBuffer("image/png"));
    return outputPath;
}

module.exports = {
    KICK_IMAGE_THEME,
    createKickEventImage,
    createLeaveEventImage,
};


