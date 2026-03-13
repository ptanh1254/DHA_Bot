const fs = require("fs");
const { GlobalFonts } = require("@napi-rs/canvas");

let initialized = false;

const FONT_FAMILY_SANS = "DHA Sans";
const FONT_FAMILY_EMOJI = "DHA Emoji";
const FONT_STACK =
    `'${FONT_FAMILY_SANS}', 'Arial', 'Tahoma', 'Liberation Sans', 'DejaVu Sans', sans-serif`;
const FONT_STACK_EMOJI =
    `'${FONT_FAMILY_EMOJI}', 'Segoe UI Emoji', 'Noto Color Emoji', 'Apple Color Emoji', sans-serif`;

function registerFontIfExists(filePath, family) {
    if (!filePath || !family) return false;
    try {
        if (!fs.existsSync(filePath)) return false;
        return GlobalFonts.registerFromPath(filePath, family) === true;
    } catch (_) {
        return false;
    }
}

function registerFirstAvailableFont(paths, family) {
    for (const filePath of paths) {
        if (registerFontIfExists(filePath, family)) {
            return true;
        }
    }
    return false;
}

function registerDesignFonts() {
    if (initialized) return;
    initialized = true;

    registerFirstAvailableFont(
        [
            process.env.BOT_FONT_REGULAR,
            process.env.BOT_FONT_BOLD,
            "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
            "/usr/share/fonts/truetype/noto/NotoSansDisplay-Regular.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
            "C:\\Windows\\Fonts\\arial.ttf",
            "C:\\Windows\\Fonts\\tahoma.ttf",
        ],
        FONT_FAMILY_SANS
    );

    registerFirstAvailableFont(
        [
            process.env.BOT_FONT_EMOJI,
            "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
            "/usr/share/fonts/truetype/emoji/NotoColorEmoji.ttf",
            "C:\\Windows\\Fonts\\seguiemj.ttf",
        ],
        FONT_FAMILY_EMOJI
    );
}

module.exports = {
    FONT_STACK,
    FONT_STACK_EMOJI,
    registerDesignFonts,
};
