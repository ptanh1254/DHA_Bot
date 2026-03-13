function pickName(row) {
    const candidates = [
        row?.lastKnownName,
        row?.firstKnownName,
        row?.displayName,
        row?.userName,
    ];

    for (const value of candidates) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }

    return "Không rõ tên";
}

async function handleAutoKickListCommand(api, message, threadId, KickHistory, prefix = "!") {
    const messageType = Number(message?.type) || 1;
    if (!KickHistory) {
        await api.sendMessage(
            { msg: "Chưa khởi tạo được dữ liệu autokick." },
            threadId,
            messageType
        );
        return;
    }

    const rows = await KickHistory.find({
        groupId: threadId,
        kickCount: { $gt: 0 },
    })
        .sort({ lastKickAt: -1, firstKickAt: -1 })
        .lean();

    if (!rows || rows.length === 0) {
        await api.sendMessage(
            {
                msg: [
                    "Danh sách autokick hiện đang rỗng.",
                    "Khi có người bị kick, bot sẽ tự động lưu vào danh sách này.",
                ].join("\n"),
            },
            threadId,
            messageType
        );
        return;
    }

    const maxRows = 50;
    const limited = rows.slice(0, maxRows);

    const lines = limited.map((row, index) => {
        const uid = String(row?.userId || "").trim();
        const name = pickName(row);
        return `${index + 1}. ${name} | UID: ${uid}`;
    });

    const extra = rows.length > maxRows ? rows.length - maxRows : 0;

    const msgLines = [
        `Danh sách autokick (${rows.length} người):`,
        ...lines,
        `Dùng \`${prefix}autokickremove <uid>\` để gỡ autokick theo UID.`,
    ];

    if (extra > 0) {
        msgLines.push(`... và ${extra} người nữa (ẩn bớt).`);
    }

    await api.sendMessage(
        {
            msg: msgLines.join("\n"),
        },
        threadId,
        messageType
    );
}

module.exports = {
    handleAutoKickListCommand,
};
