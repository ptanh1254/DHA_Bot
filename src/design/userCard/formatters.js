const { USER_CARD_ROW_CONFIG } = require("./theme");

function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function normalizeUnixSeconds(value) {
    const num = toNumber(value);
    if (!num || num <= 0) return null;
    return num > 1e12 ? Math.floor(num / 1000) : Math.floor(num);
}

function formatDateTimeVN(value) {
    const seconds = normalizeUnixSeconds(value);
    if (!seconds) return "Ch\u01b0a c\u00f3";
    const d = new Date(seconds * 1000);
    if (Number.isNaN(d.getTime())) return "Ch\u01b0a c\u00f3";

    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${hh}:${mm} ${dd}/${mo}/${yyyy}`;
}

function formatBirthDate(profile) {
    if (typeof profile?.sdob === "string" && profile.sdob.trim()) {
        return profile.sdob.trim();
    }

    const dobNum = toNumber(profile?.dob);
    if (!dobNum) return "Ch\u01b0a c\u1eadp nh\u1eadt";

    const raw = String(Math.trunc(dobNum));
    if (raw.length === 8) {
        const yyyy = raw.slice(0, 4);
        const mm = raw.slice(4, 6);
        const dd = raw.slice(6, 8);
        return `${dd}/${mm}/${yyyy}`;
    }

    return formatDateTimeVN(dobNum).split(" ")[1] || "Ch\u01b0a c\u1eadp nh\u1eadt";
}

function genderText(gender) {
    if (gender === 0) return "Nam";
    if (gender === 1) return "N\u1eef";
    return "Kh\u00e1c";
}

function businessText(bizPkg) {
    if (!bizPkg || typeof bizPkg !== "object") return "Ch\u01b0a \u0111\u0103ng k\u00fd";
    return Object.keys(bizPkg).length > 0 ? "\u0110\u00e3 \u0111\u0103ng k\u00fd" : "Ch\u01b0a \u0111\u0103ng k\u00fd";
}

function getRowValueMap(profile) {
    return {
        username: profile.username || profile.zaloName || profile.userId || "Không rõ",
        birthDate: formatBirthDate(profile),
        gender: genderText(profile.gender),
        business: businessText(profile.bizPkg),
        createdAt: formatDateTimeVN(profile.createdTs),
        lastActive: formatDateTimeVN(profile.lastActionTime),
        status: profile.status || "Không có",
    };
}

function buildUserCardRows(profile) {
    const valueMap = getRowValueMap(profile);
    return USER_CARD_ROW_CONFIG.map((item) => ({
        label: item.label,
        color: item.color,
        value: valueMap[item.key] || "Không rõ",
    }));
}

module.exports = {
    buildUserCardRows,
};


