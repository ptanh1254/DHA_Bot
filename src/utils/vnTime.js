const VN_TIMEZONE = "Asia/Ho_Chi_Minh";
const DAY_MS = 24 * 60 * 60 * 1000;

function getVNDateParts(date = new Date()) {
    const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: VN_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });

    const parts = formatter.formatToParts(date);
    const map = Object.create(null);
    for (const part of parts) {
        if (part.type !== "literal") {
            map[part.type] = part.value;
        }
    }

    const year = String(map.year || "");
    const month = String(map.month || "").padStart(2, "0");
    const day = String(map.day || "").padStart(2, "0");

    return {
        year,
        month,
        day,
        dayKey: `${year}-${month}-${day}`,
        monthKey: `${year}-${month}`,
        dayLabel: `${day}/${month}/${year}`,
        monthLabel: `${month}/${year}`,
    };
}

function getVNTimeString(date = new Date()) {
    const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: VN_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    return formatter.format(date);
}

function getVNDateTimeFormatted(date = new Date()) {
    const formatter = new Intl.DateTimeFormat("vi-VN", {
        timeZone: VN_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
    return formatter.format(date);
}

function pad2(value) {
    return String(value || "").padStart(2, "0");
}

function formatDayKeyFromUTCDate(date) {
    const year = String(date.getUTCFullYear());
    const month = pad2(date.getUTCMonth() + 1);
    const day = pad2(date.getUTCDate());
    return `${year}-${month}-${day}`;
}

function formatDayLabelFromUTCDate(date) {
    const year = String(date.getUTCFullYear());
    const month = pad2(date.getUTCMonth() + 1);
    const day = pad2(date.getUTCDate());
    return `${day}/${month}/${year}`;
}

function getVNWeekInfo(date = new Date()) {
    const vnDate = getVNDateParts(date);
    const year = Number(vnDate.year);
    const month = Number(vnDate.month);
    const day = Number(vnDate.day);
    const utcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

    // JS: Sunday=0...Saturday=6, convert so Monday=0...Sunday=6
    const weekday = utcNoon.getUTCDay();
    const diffToMonday = (weekday + 6) % 7;

    const mondayUtcNoon = new Date(utcNoon.getTime() - diffToMonday * DAY_MS);
    const sundayUtcNoon = new Date(mondayUtcNoon.getTime() + 6 * DAY_MS);

    const weekStartDayKey = formatDayKeyFromUTCDate(mondayUtcNoon);
    const weekEndDayKey = formatDayKeyFromUTCDate(sundayUtcNoon);

    return {
        weekKey: weekStartDayKey,
        weekStartDayKey,
        weekEndDayKey,
        weekStartLabel: formatDayLabelFromUTCDate(mondayUtcNoon),
        weekEndLabel: formatDayLabelFromUTCDate(sundayUtcNoon),
    };
}

module.exports = {
    VN_TIMEZONE,
    getVNDateParts,
    getVNTimeString,
    getVNDateTimeFormatted,
    getVNWeekInfo,
};
