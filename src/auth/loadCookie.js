const fs = require("fs");
const path = require("path");

function stripBom(text) {
    return String(text || "").replace(/^\uFEFF/, "");
}

function normalizeEnvJson(rawValue) {
    const trimmed = stripBom(rawValue).trim();
    if (!trimmed) return "";

    const wrappedBySingleQuote = trimmed.startsWith("'") && trimmed.endsWith("'");
    const wrappedByDoubleQuote = trimmed.startsWith('"') && trimmed.endsWith('"');

    if (wrappedBySingleQuote || wrappedByDoubleQuote) {
        return trimmed.slice(1, -1).trim();
    }

    return trimmed;
}

function parseCookiePayload(payload, sourceLabel) {
    let parsed;
    try {
        parsed = JSON.parse(payload);
    } catch (_) {
        throw new Error(`${sourceLabel} khong phai JSON hop le`);
    }

    if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
            throw new Error(`${sourceLabel} phai la mang cookie khong rong`);
        }
        return parsed;
    }

    if (parsed && Array.isArray(parsed.cookies) && parsed.cookies.length > 0) {
        return parsed;
    }

    throw new Error(`${sourceLabel} phai la mang cookie hoac object { url, cookies }`);
}

function parseCookieText(rawCookie) {
    return String(rawCookie || "")
        .split(";")
        .map((item) => {
            const [name, ...rest] = item.split("=");
            const value = rest.join("=").trim();
            if (!name?.trim() || !value) return null;
            return { name: name.trim(), value };
        })
        .filter(Boolean);
}

function loadCookie() {
    const envCookieRaw = normalizeEnvJson(process.env.ZALO_COOKIE_JSON);
    if (envCookieRaw) {
        return parseCookiePayload(envCookieRaw, "ZALO_COOKIE_JSON");
    }

    const cookieJsonPath = path.resolve("cookie.json");
    const cookieTxtPath = path.resolve("cookie.txt");

    if (fs.existsSync(cookieJsonPath)) {
        const raw = stripBom(fs.readFileSync(cookieJsonPath, "utf8"));
        return parseCookiePayload(raw, "cookie.json");
    }

    if (fs.existsSync(cookieTxtPath)) {
        const raw = fs.readFileSync(cookieTxtPath, "utf8").trim();
        const parsed = parseCookieText(raw);
        if (parsed.length === 0) {
            throw new Error("cookie.txt rong hoac sai dinh dang");
        }
        return parsed;
    }

    throw new Error(
        "Khong tim thay cookie. Hay them ZALO_COOKIE_JSON trong .env hoac tao cookie.json/cookie.txt"
    );
}

module.exports = {
    loadCookie,
};
