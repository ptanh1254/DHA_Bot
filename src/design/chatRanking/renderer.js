const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const { formatCount } = require("./template");
const { FONT_STACK, registerDesignFonts } = require("../shared/registerFonts");

const CHAT_RANKING_IMAGE_THEME = {
    width: 1320,
    headerHeight: 174,
    footerHeight: 60,
    contentPadding: 34,
    rowHeight: 98,
    rowGap: 12,
    bg: {
        gradient: [
            { stop: 0, color: "#fff8dc" },
            { stop: 0.52, color: "#fef3c7" },
            { stop: 1, color: "#fde68a" },
        ],
        glow: [
            { x: 0.18, y: 0.12, radius: 320, color: "rgba(250, 204, 21, 0.28)" },
            { x: 0.86, y: 0.82, radius: 300, color: "rgba(245, 158, 11, 0.2)" },
        ],
    },
    panel: {
        radius: 28,
        fill: "rgba(255, 252, 235, 0.86)",
        stroke: "rgba(161, 98, 7, 0.28)",
    },
    title: {
        text: "X\u1ebfp H\u1ea1ng D\u00e2n T\u1ed5 DHA",
        font: `800 44px ${FONT_STACK}`,
        color: "#7c2d12",
        subFont: `600 22px ${FONT_STACK}`,
        subColor: "rgba(120, 53, 15, 0.88)",
    },
    row: {
        radius: 18,
        fill: "rgba(255, 255, 255, 0.78)",
        stroke: "rgba(180, 83, 9, 0.18)",
        rankFont: `700 28px ${FONT_STACK}`,
        rankColor: "#7c2d12",
        nameFont: `700 29px ${FONT_STACK}`,
        nameColor: "#451a03",
        userFont: `600 18px ${FONT_STACK}`,
        userColor: "rgba(120, 53, 15, 0.76)",
        countFont: `700 24px ${FONT_STACK}`,
        countColor: "#78350f",
        badgeBg: "rgba(254, 243, 199, 0.95)",
    },
};

const TOP_COLORS = {
    1: "#ca8a04",
    2: "#64748b",
    3: "#b45309",
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

function drawBackground(ctx, width, height) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    for (const stop of CHAT_RANKING_IMAGE_THEME.bg.gradient) {
        gradient.addColorStop(stop.stop, stop.color);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (const glow of CHAT_RANKING_IMAGE_THEME.bg.glow) {
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
}

function drawPanel(ctx, width, height) {
    const panel = CHAT_RANKING_IMAGE_THEME.panel;

    roundRect(ctx, 26, 24, width - 52, height - 48, panel.radius);
    ctx.fillStyle = panel.fill;
    ctx.fill();

    roundRect(ctx, 26, 24, width - 52, height - 48, panel.radius);
    ctx.strokeStyle = panel.stroke;
    ctx.lineWidth = 1.4;
    ctx.stroke();
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

function drawHeader(ctx, meta, width) {
    const title = CHAT_RANKING_IMAGE_THEME.title;
    const titleText = String(meta.rankingTitle || title.text || "").trim();
    const periodLabel = String(meta.periodLabel || "").trim();

    ctx.font = title.font;
    ctx.fillStyle = title.color;
    ctx.fillText(titleText || title.text, 70, 106);

    ctx.font = title.subFont;
    ctx.fillStyle = title.subColor;
    const details = [
        periodLabel,
        `Trang ${meta.page}/${meta.totalPages}`,
        `T\u1ed5ng th\u00e0nh vi\u00ean: ${formatCount(meta.totalMembers)}`,
    ].filter(Boolean);
    const pageText = details.join("  |  ");
    ctx.fillText(pageText, 72, 142);

    ctx.beginPath();
    ctx.moveTo(70, CHAT_RANKING_IMAGE_THEME.headerHeight);
    ctx.lineTo(width - 70, CHAT_RANKING_IMAGE_THEME.headerHeight);
    ctx.strokeStyle = "rgba(180, 83, 9, 0.28)";
    ctx.lineWidth = 1;
    ctx.stroke();
}

function drawAvatarCircle(ctx, image, x, y, radius, fallbackText) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (image) {
        ctx.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
    } else {
        const fill = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
        fill.addColorStop(0, "#fef3c7");
        fill.addColorStop(1, "#fcd34d");
        ctx.fillStyle = fill;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

        const letter = String(fallbackText || "?").trim()[0] || "?";
        ctx.font = `700 30px ${FONT_STACK}`;
        ctx.fillStyle = "#7c2d12";
        const letterWidth = ctx.measureText(letter.toUpperCase()).width;
        ctx.fillText(letter.toUpperCase(), x - letterWidth / 2, y + 10);
    }

    ctx.restore();
}

function drawRow(ctx, row, y, width, avatarImage) {
    const cfg = CHAT_RANKING_IMAGE_THEME.row;

    const left = CHAT_RANKING_IMAGE_THEME.contentPadding + 32;
    const right = width - (CHAT_RANKING_IMAGE_THEME.contentPadding + 32);
    const rowWidth = right - left;

    roundRect(ctx, left, y, rowWidth, CHAT_RANKING_IMAGE_THEME.rowHeight, cfg.radius);
    ctx.fillStyle = cfg.fill;
    ctx.fill();
    ctx.strokeStyle = cfg.stroke;
    ctx.lineWidth = 1;
    ctx.stroke();

    const rankColor = TOP_COLORS[row.rank] || cfg.rankColor;
    ctx.fillStyle = rankColor;
    ctx.font = cfg.rankFont;
    const rankText = `#${row.rank}`;
    const rankWidth = ctx.measureText(rankText).width;
    ctx.fillText(rankText, left + 24, y + 60);

    const avatarX = left + 44 + rankWidth + 36;
    const avatarY = y + CHAT_RANKING_IMAGE_THEME.rowHeight / 2;
    drawAvatarCircle(ctx, avatarImage, avatarX, avatarY, 33, row.displayName || row.userId);

    const countText = `${formatCount(row.msgCount)} tin nh\u1eafn`;
    ctx.font = cfg.countFont;
    const countTextWidth = ctx.measureText(countText).width;
    const countBadgeWidth = Math.min(340, Math.max(210, countTextWidth + 36));
    const countBadgeX = right - countBadgeWidth - 20;
    const countBadgeY = y + 20;

    roundRect(ctx, countBadgeX, countBadgeY, countBadgeWidth, 58, 14);
    ctx.fillStyle = cfg.badgeBg;
    ctx.fill();

    ctx.fillStyle = cfg.countColor;
    ctx.fillText(countText, countBadgeX + countBadgeWidth - 18 - countTextWidth, countBadgeY + 38);

    const nameX = avatarX + 46;
    const nameMaxWidth = Math.max(180, countBadgeX - nameX - 26);

    ctx.font = cfg.nameFont;
    ctx.fillStyle = cfg.nameColor;
    const nameText = fitText(ctx, row.displayName || `UID ${row.userId}`, nameMaxWidth);
    ctx.fillText(nameText, nameX, y + 44);

    ctx.font = cfg.userFont;
    ctx.fillStyle = cfg.userColor;
    ctx.fillText(`UID: ${row.userId}`, nameX, y + 73);
}

function drawFooter(ctx, width, height) {
    ctx.font = `600 16px ${FONT_STACK}`;
    ctx.fillStyle = "rgba(120, 53, 15, 0.78)";

    const footerText = "B\u1ea3ng x\u1ebfp h\u1ea1ng t\u01b0\u01a1ng t\u00e1c";
    const textWidth = ctx.measureText(footerText).width;
    ctx.fillText(footerText, width - 66 - textWidth, height - 24);
}

async function createChatRankingImage(rows, meta = {}) {
    registerDesignFonts();

    const rowCount = rows.length;
    const width = CHAT_RANKING_IMAGE_THEME.width;
    const height =
        CHAT_RANKING_IMAGE_THEME.headerHeight +
        CHAT_RANKING_IMAGE_THEME.contentPadding +
        rowCount * CHAT_RANKING_IMAGE_THEME.rowHeight +
        Math.max(0, rowCount - 1) * CHAT_RANKING_IMAGE_THEME.rowGap +
        CHAT_RANKING_IMAGE_THEME.footerHeight +
        56;

    const canvas = createCanvas(width, Math.max(height, 420));
    const ctx = canvas.getContext("2d");

    drawBackground(ctx, width, canvas.height);
    drawPanel(ctx, width, canvas.height);
    drawHeader(
        ctx,
        {
            page: meta.page || 1,
            totalPages: meta.totalPages || 1,
            totalMembers: meta.totalMembers || rows.length,
            rankingTitle: meta.rankingTitle || "",
            periodLabel: meta.periodLabel || "",
        },
        width
    );

    const avatarImages = new Array(rows.length).fill(null);
    await Promise.all(
        rows.map(async (row, index) => {
            avatarImages[index] = await loadRemoteImage(row.avatarUrl);
        })
    );

    let rowY = CHAT_RANKING_IMAGE_THEME.headerHeight + 24;
    for (let i = 0; i < rows.length; i += 1) {
        drawRow(ctx, rows[i], rowY, width, avatarImages[i]);
        rowY += CHAT_RANKING_IMAGE_THEME.rowHeight + CHAT_RANKING_IMAGE_THEME.rowGap;
    }

    drawFooter(ctx, width, canvas.height);

    const tempDir = path.resolve(meta.tempDir || "tmp");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName =
        meta.fileName || `xephang-${meta.page || 1}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.png`;
    const outputPath = path.join(tempDir, fileName);
    fs.writeFileSync(outputPath, canvas.toBuffer("image/png"));

    return outputPath;
}

module.exports = {
    CHAT_RANKING_IMAGE_THEME,
    createChatRankingImage,
};


