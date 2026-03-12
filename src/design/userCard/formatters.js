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
    if (!seconds) return "Chưa có";
    const d = new Date(seconds * 1000);
    if (Number.isNaN(d.getTime())) return "Chưa có";

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
    if (!dobNum) return "Chưa cập nhật";

    const raw = String(Math.trunc(dobNum));
    if (raw.length === 8) {
        const yyyy = raw.slice(0, 4);
        const mm = raw.slice(4, 6);
        const dd = raw.slice(6, 8);
        return `${dd}/${mm}/${yyyy}`;
    }

    return formatDateTimeVN(dobNum).split(" ")[1] || "Chưa cập nhật";
}

function genderText(gender) {
    if (gender === 0) return "Nam";
    if (gender === 1) return "Nữ";
    return "Khác";
}

function businessText(bizPkg) {
    if (!bizPkg || typeof bizPkg !== "object") return "Chưa đăng ký";
    return Object.keys(bizPkg).length > 0 ? "Đã đăng ký" : "Chưa đăng ký";
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
