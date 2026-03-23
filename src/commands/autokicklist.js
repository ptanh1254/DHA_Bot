const { getMessageType } = require("../utils/commonHelpers");

function pickName(row) {
    const candidates = [
        row?.ingameName,
        row?.lastKnownName,
        row?.firstKnownName,
        row?.displayName,
        row?.userName,
    ];

    for (let candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }

    return "Không rõ tên";
}

async function handleAutoKickListCommand(api, message, threadId, KickHistory, prefix = "!") {
    const messageType = getMessageType(message);
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
                    "Khi có người bị kick hoặc tự rời nhóm, bot sẽ tự động lưu vào danh sách này.",
                ].join("\n"),
            },
            threadId,
            messageType
        );
        return;
    }

    const maxRows = 50;
    const limited = rows.slice(0, maxRows);

    // Send header with instruction
    const extra = rows.length > maxRows ? rows.length - maxRows : 0;
    const headerMsg = [
        `Danh sách autokick (${rows.length} người)${extra > 0 ? ` - showing ${maxRows}, ${extra} more hidden` : ""}:`,
        `Dùng \`${prefix}autokickremove <uid>\` để gỡ autokick theo UID.`,
    ].join("\n");
    await api.sendMessage({ msg: headerMsg }, threadId, messageType);

    // Send each person as separate message
    for (let i = 0; i < limited.length; i++) {
        const row = limited[i];
        const uid = String(row?.userId || "").trim();
        const name = pickName(row);
        const msg = `${i + 1}. ${name} - ${uid}`;
        await api.sendMessage({ msg }, threadId, messageType);
    }
}

module.exports = {
    handleAutoKickListCommand,
};
