const {
    getMessageType,
    getMentionedTargets,
    buildIdVariants,
    normalizeId,
} = require("../utils/commonHelpers");

function stableHash(text) {
    // FNV-1a 32-bit hash: stable across restarts and environments.
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

function calculateLovePercentage(userId1, userId2) {
    const base1 = normalizeId(userId1) || String(userId1 || "").trim();
    const base2 = normalizeId(userId2) || String(userId2 || "").trim();
    const [id1, id2] = [base1, base2].sort((a, b) => a.localeCompare(b));
    const hash = stableHash(`${id1}|${id2}`);
    return (hash % 81) + 20; // 20-100%
}

function getLoveMessage(percentage) {
    if (percentage >= 98) return "Coi chừng! Độ hợp nhau này là báo động đỏ cho một đám cưới linh đình rồi đó! 💍";
    if (percentage >= 90) return "Tình trong như đã mặt ngoài còn e, hai bạn không cưới thì bot đi cưới hộ cho! ❤️";
    if (percentage >= 80) return "Chỉ số tương hợp cực cao! Một người là chìa khóa, người kia là ổ khóa luôn rồi. ✨";
    if (percentage >= 70) return "Cũng ra gì và này nọ đấy! Đẩy nhẹ cái là dính như keo 502 luôn. 😉";
    if (percentage >= 60) return "Tầm này là trên tình bạn dưới tình yêu rồi, thiếu mỗi cái gật đầu thôi. 🤭";
    if (percentage >= 50) return "Nửa nạc nửa mỡ, nếu cố gắng thì cũng thành cơm thành cháo đó. 🥣";
    if (percentage >= 40) return "Hơi lệch một tí, nhưng biết đâu âm dương hút nhau thì sao? 🔋";
    if (percentage >= 30) return "Friendzone đang vẫy gọi, nhưng đừng bỏ cuộc, người tính không bằng trời tính! 😅";
    if (percentage >= 20) return "Vibe này là 'anh em nương tựa' rồi, khó mà tiến xa hơn được. 👬";
    if (percentage >= 10) return "Tương hợp kiểu... nước sông không phạm nước giếng. Đau lòng quá! 🌊";
    return "Friendzone vĩnh cửu! Kiếp này coi như mình làm anh em tốt cho nó bền. 💀";
}

function getSenderInfo(message) {
    const rawId = String(message?.data?.uidFrom || "").trim();
    const senderId = normalizeId(rawId) || rawId;
    const senderNameRaw =
        typeof message?.data?.dName === "string" ? message.data.dName.trim() : "";
    return {
        userId: senderId,
        displayName: senderNameRaw || `UID ${senderId || "unknown"}`,
    };
}

function getQuotedTarget(message) {
    const quoteOwnerRaw = String(message?.data?.quote?.ownerId || "").trim();
    const quoteOwner = normalizeId(quoteOwnerRaw) || quoteOwnerRaw;
    if (!quoteOwner) return null;

    const quotedName =
        typeof message?.data?.quote?.fromD === "string"
            ? message.data.quote.fromD.trim()
            : "";

    return {
        userId: quoteOwner,
        displayName: quotedName || `UID ${quoteOwner}`,
    };
}

function sanitizeDisplayName(name, fallbackUserId) {
    const value = String(name || "")
        .replace(/^@+/, "")
        .replace(/\s+/g, " ")
        .trim();
    if (value) return value;
    return `UID ${fallbackUserId}`;
}

function pickParticipants(message) {
    const sender = getSenderInfo(message);
    if (!sender.userId) return { error: "missing_sender" };

    const mentions = getMentionedTargets(message);
    if (mentions.length >= 2) {
        return {
            first: {
                userId: normalizeId(mentions[0].userId) || mentions[0].userId,
                displayName: sanitizeDisplayName(mentions[0].displayName, mentions[0].userId),
            },
            second: {
                userId: normalizeId(mentions[1].userId) || mentions[1].userId,
                displayName: sanitizeDisplayName(mentions[1].displayName, mentions[1].userId),
            },
        };
    }

    if (mentions.length === 1) {
        const target = mentions[0];
        return {
            first: {
                userId: sender.userId,
                displayName: sanitizeDisplayName(sender.displayName, sender.userId),
            },
            second: {
                userId: normalizeId(target.userId) || target.userId,
                displayName: sanitizeDisplayName(target.displayName, target.userId),
            },
        };
    }

    const quoted = getQuotedTarget(message);
    if (quoted) {
        return {
            first: {
                userId: sender.userId,
                displayName: sanitizeDisplayName(sender.displayName, sender.userId),
            },
            second: {
                userId: quoted.userId,
                displayName: sanitizeDisplayName(quoted.displayName, quoted.userId),
            },
        };
    }

    return { error: "no_target" };
}

async function enrichDisplayNames(User, threadId, participants) {
    const ids = [participants.first.userId, participants.second.userId].filter(Boolean);
    const queryIds = [...new Set(ids.flatMap((id) => buildIdVariants(id)))];

    if (queryIds.length === 0) {
        return participants;
    }

    const rows = await User.find(
        { groupId: threadId, userId: { $in: queryIds } },
        { userId: 1, displayName: 1 }
    ).lean();

    const displayById = new Map();
    for (const row of rows || []) {
        const rawId = String(row?.userId || "").trim();
        if (!rawId) continue;
        const normalized = normalizeId(rawId);
        const safeName = sanitizeDisplayName(row?.displayName, normalized || rawId);
        displayById.set(rawId, safeName);
        if (normalized) {
            displayById.set(normalized, safeName);
        }
    }

    const firstName =
        displayById.get(participants.first.userId) || participants.first.displayName;
    const secondName =
        displayById.get(participants.second.userId) || participants.second.displayName;

    return {
        first: { ...participants.first, displayName: firstName },
        second: { ...participants.second, displayName: secondName },
    };
}

async function handleLoveCommand(api, message, threadId, User, prefix = "!") {
    const messageType = getMessageType(message);
    const picked = pickParticipants(message);

    if (picked.error === "missing_sender") {
        return;
    }

    if (picked.error === "no_target") {
        await api.sendMessage(
            {
                msg: [
                    `Cách dùng: ${prefix}love @user1 @user2`,
                    `Hoặc: ${prefix}love @user (bot sẽ ghép với người gửi).`,
                    `Bạn cũng có thể reply tin nhắn rồi dùng ${prefix}love.`,
                ].join("\n"),
            },
            threadId,
            messageType
        );
        return;
    }

    const firstId = normalizeId(picked.first.userId) || picked.first.userId;
    const secondId = normalizeId(picked.second.userId) || picked.second.userId;

    if (!firstId || !secondId) {
        await api.sendMessage(
            { msg: "Không đọc được thông tin người dùng để tính love." },
            threadId,
            messageType
        );
        return;
    }

    if (firstId === secondId) {
        await api.sendMessage(
            { msg: "Hai đầu vào đang là cùng một người, hãy chọn 2 người khác nhau." },
            threadId,
            messageType
        );
        return;
    }

    const participants = await enrichDisplayNames(User, threadId, picked);
    const percentage = calculateLovePercentage(firstId, secondId);
    const messageResult = getLoveMessage(percentage);

    const response = [
        "KIỂM TRA TƯƠNG HỢP",
        `${participants.first.displayName} <3 ${participants.second.displayName}`,
        "",
        `Độ tương hợp: ${percentage}%`,
        messageResult,
    ].join("\n");

    await api.sendMessage({ msg: response }, threadId, messageType);
}

module.exports = {
    handleLoveCommand,
};
