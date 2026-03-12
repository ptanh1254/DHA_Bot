function formatCount(num) {
    return new Intl.NumberFormat("vi-VN").format(Number(num) || 0);
}

const CHAT_RANKING_THEME = {
    header: "🏆 BẢNG XẾP HẠNG TƯƠNG TÁC 🏆",
    divider: "──────────────────────",
    footer: "💻 Developed by PTADev",
    icons: {
        top1: "🥇",
        top2: "🥈",
        top3: "🥉",
        member: "👤",
        message: "💬",
        stats: "📊",
        group: "👥"
    }
};

function buildXepHangMessage(rankingRows, page, totalPages, totalMembers) {
    const { icons } = CHAT_RANKING_THEME;
    
    // Header
    const header = [
        CHAT_RANKING_THEME.header,
        `${icons.group} Tổng: ${totalMembers} thành viên`,
        `${icons.stats} Trang: ${page}/${totalPages}`,
        CHAT_RANKING_THEME.divider
    ];

    // Body
    const lines = rankingRows.map((row) => {
        let rankIcon = "";
        // Gán icon đặc biệt cho Top 3
        switch (row.rank) {
            case 1: rankIcon = icons.top1; break;
            case 2: rankIcon = icons.top2; break;
            case 3: rankIcon = icons.top3; break;
            default: rankIcon = `[${String(row.rank).padStart(2, "0")}]`; break;
        }

        return `${rankIcon} ${row.displayName}┈➤ ${formatCount(row.msgCount)} ${icons.message}`;
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