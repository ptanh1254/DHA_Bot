const VN_TIMEZONE = "Asia/Ho_Chi_Minh";

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

module.exports = {
    VN_TIMEZONE,
    getVNDateParts,
};
