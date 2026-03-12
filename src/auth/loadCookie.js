const fs = require("fs");
const path = require("path");

function stripBom(text) {
    return text.replace(/^\uFEFF/, "");
}

function parseCookieText(rawCookie) {
    return rawCookie
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
    const cookieJsonPath = path.resolve("cookie.json");
    const cookieTxtPath = path.resolve("cookie.txt");

    if (fs.existsSync(cookieJsonPath)) {
        const raw = stripBom(fs.readFileSync(cookieJsonPath, "utf8"));
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            if (parsed.length === 0) {
                throw new Error("cookie.json phải là mảng cookie không rỗng");
            }
            return parsed;
        }
        if (parsed && Array.isArray(parsed.cookies) && parsed.cookies.length > 0) {
            return parsed;
        }
        throw new Error("cookie.json phải là mảng cookie hoặc object { url, cookies }");
    }

    if (fs.existsSync(cookieTxtPath)) {
        const raw = fs.readFileSync(cookieTxtPath, "utf8").trim();
        const parsed = parseCookieText(raw);
        if (parsed.length === 0) {
            throw new Error("cookie.txt rỗng hoặc sai định dạng");
        }
        return parsed;
    }

    throw new Error("Không tìm thấy cookie.json hoặc cookie.txt");
}

module.exports = {
    loadCookie,
};
