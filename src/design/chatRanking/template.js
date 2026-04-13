function formatCount(num) {
    return new Intl.NumberFormat("vi-VN").format(Number(num) || 0);
}

const CHAT_RANKING_THEME = {
    header: " B\u1ea2NG X\u1ebeP H\u1ea0NG T\u01af\u01a0NG T\u00c1C ",
    divider: "",
    footer: " Developed by PTADev",
    icons: {
        top1: "",
        top2: "",
        top3: "",
        member: "",
        message: "",
        stats: "",
        group: ""
    }
};

function buildXepHangMessage(rankingRows, page, totalPages, totalMembers) {
    const { icons } = CHAT_RANKING_THEME;
    
    // Header
    const header = [
        CHAT_RANKING_THEME.header,
        `${icons.group} T\u1ed5ng: ${totalMembers} th\u00e0nh vi\u00ean`,
        `${icons.stats} Trang: ${page}/${totalPages}`,
        CHAT_RANKING_THEME.divider
    ];

    // Body
    const lines = rankingRows.map((row) => {
        let rankIcon = "";
        // G\u1eafn icon \u0111\u1eb7c bi\u1ec7t cho Top 3
        switch (row.rank) {
            case 1: rankIcon = icons.top1; break;
            case 2: rankIcon = icons.top2; break;
            case 3: rankIcon = icons.top3; break;
            default: rankIcon = `[${String(row.rank).padStart(2, "0")}]`; break;
        }

        const ingameName = String(row?.ingameName || "").trim();
        const ingameText = ingameName ? `ingame: ${ingameName}` : "ingame: ch\u01b0a c\u1eadp nh\u1eadt";
        const joinedDays = Number(row?.joinedDays);
        const joinedText =
            Number.isFinite(joinedDays) && joinedDays > 0
                ? `\u0111\u00e3 gia nh\u1eadp: ${formatCount(joinedDays)} ng\u00e0y`
                : "\u0111\u00e3 gia nh\u1eadp: kh\u00f4ng r\u00f5";
        return `${rankIcon} ${row.displayName} (${ingameText}) (${joinedText}) | ${formatCount(row.msgCount)} ${icons.message}`;
    });

    // Footer
    const footer = [
        CHAT_RANKING_THEME.divider,
        CHAT_RANKING_THEME.footer
    ];

    return [...header, ...lines, ...footer].join("\n");
}

module.exports = {
    CHAT_RANKING_THEME,
    formatCount,
    buildXepHangMessage,
};
