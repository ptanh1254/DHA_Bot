const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { FONT_STACK, FONT_STACK_EMOJI, registerDesignFonts } = require("../shared/registerFonts");

const WEDDING_CARD_THEME = {
    width: 1500,
    height: 1000,
    contentX: 100,
    contentWidth: 1300,
    avatarRadius: 100,
    borderColor: "#D4AF37", // Gold
    titleColor: "#9f1239", // Deep Red
    textColor: "#333333",
};

/**
 * Renders a premium wedding invitation card for a couple.
 */
async function createWeddingInviteCard(payload, options = {}) {
    registerDesignFonts();
    const participants = Array.isArray(payload?.participants) ? payload.participants : [];
    
    // Standard wedding is for 2 people
    const couple = participants.slice(0, 2);
    if (couple.length < 2) {
        // Fallback or error handling
        return null;
    }

    const width = options.width || WEDDING_CARD_THEME.width;
    const height = options.height || WEDDING_CARD_THEME.height;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // 1. Draw Background
    const bgPath = path.join(__dirname, "assets", "wedding_bg.png");
    let bgImage = null;
    try {
        if (fs.existsSync(bgPath)) {
            bgImage = await loadImage(bgPath);
        }
    } catch (_) {}

    if (bgImage) {
        ctx.drawImage(bgImage, 0, 0, width, height);
    } else {
        // Fallback elegant gradient
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, "#FFF9F0");
        grad.addColorStop(1, "#FDEBD0");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
    }

    // 2. Draw Title
    ctx.textAlign = "center";
    ctx.font = `italic 400 42px ${FONT_STACK}`;
    ctx.fillStyle = "#A67C00"; // Dark Gold
    ctx.fillText("Trân trọng kính mời tới dự", width / 2, 140);

    ctx.font = `bold 100px ${FONT_STACK}`;
    ctx.fillStyle = WEDDING_CARD_THEME.titleColor;
    ctx.fillText("LỄ THÀNH HÔN", width / 2, 250);

    // 3. Draw Couple
    const spacing = 380;
    const centerY = 500;
    
    // Load avatars
    const avatars = await Promise.all(
        couple.map(p => loadRemoteImage(p.avatarUrl))
    );

    // Groom / Person 1
    await drawPerson(ctx, couple[0], avatars[0], width / 2 - spacing, centerY, couple[0].role || "Chú Rể");
    
    // Heart Icon or "&" between them
    ctx.font = `bold 120px ${FONT_STACK_EMOJI}`;
    ctx.fillStyle = "#E11D48";
    ctx.fillText("❤", width / 2, centerY - 20);

    // Bride / Person 2
    await drawPerson(ctx, couple[1], avatars[1], width / 2 + spacing, centerY, couple[1].role || "Cô Dâu");

    // 4. Draw Details
    const detailsY = 760;
    ctx.font = `bold 38px ${FONT_STACK}`;
    ctx.fillStyle = "#333333";
    ctx.fillText("HÔN LỄ ĐƯỢC CỬ HÀNH VÀO LÚC", width / 2, detailsY);

    ctx.font = `bold 50px ${FONT_STACK}`;
    ctx.fillStyle = "#7f1d1d";
    const dateText = `${payload.time || "11:00"} - ${payload.date || "Ngày 14 Tháng 02 Năm 2026"}`;
    ctx.fillText(dateText, width / 2, detailsY + 70);

    // Dynamic Joke / Blessing
    ctx.font = `italic 400 34px ${FONT_STACK}`;
    ctx.fillStyle = "#555555";
    ctx.fillText(payload.joke || "Đất trời se duyên - Trăm năm hạnh phúc", width / 2, detailsY + 115);

    ctx.font = `bold 38px ${FONT_STACK}`;
    ctx.fillStyle = "#333333";
    ctx.fillText("TẠI: TRUNG TÂM HỘI NGHỊ TIỆC CƯỚI SAPPHIRE", width / 2, detailsY + 190);

    // 5. Footer
    ctx.font = `italic 400 28px ${FONT_STACK}`;
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillText("Sự hiện diện của quý vị là niềm vinh hạnh của gia đình chúng tôi!", width / 2, height - 80);

    // Save
    const tempDir = path.resolve(options.tempDir || "tmp");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = options.fileName || `thiepcuoi-${Date.now()}.png`;
    const outputPath = path.join(tempDir, fileName);
    fs.writeFileSync(outputPath, canvas.toBuffer("image/png"));
    return outputPath;
}

async function drawPerson(ctx, person, avatarImg, x, y, label) {
    const radius = WEDDING_CARD_THEME.avatarRadius;
    
    // Avatar border (Gold circle)
    ctx.beginPath();
    ctx.arc(x, y, radius + 10, 0, Math.PI * 2);
    ctx.fillStyle = "#D4AF37";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    // Mask for avatar
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();

    if (avatarImg) {
        ctx.drawImage(avatarImg, x - radius, y - radius, radius * 2, radius * 2);
    } else {
        ctx.fillStyle = "#F3F4F6";
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        ctx.font = `bold 60px ${FONT_STACK}`;
        ctx.fillStyle = "#9CA3AF";
        ctx.textAlign = "center";
        ctx.fillText(person.displayName[0].toUpperCase(), x, y + 20);
    }
    ctx.restore();

    // Role Label (Chú Rể / Cô Dâu)
    ctx.font = `bold 32px ${FONT_STACK}`;
    ctx.fillStyle = "#9f1239";
    ctx.textAlign = "center";
    ctx.fillText(label.toUpperCase(), x, y + radius + 50);

    // Name
    ctx.font = `bold 42px ${FONT_STACK}`;
    ctx.fillStyle = "#000000";
    ctx.fillText(person.displayName, x, y + radius + 110);
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

module.exports = {
    WEDDING_CARD_THEME,
    createWeddingInviteCard,
};
