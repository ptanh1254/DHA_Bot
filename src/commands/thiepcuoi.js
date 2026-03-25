const fs = require("fs");

const { createWeddingInviteCard } = require("../design/weddingCard/renderer");
const {
    getMentionedTargets,
    getMessageType,
    pickDisplayName,
    pickAvatarUrl,
    normalizeId,
} = require("../utils/commonHelpers");

function normalizeText(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function detectGender(profile) {
    let maleScore = 0;
    let femaleScore = 0;

    const rawValues = [
        profile?.gender,
        profile?.sex,
        profile?.genderType,
        profile?.zgender,
        profile?.genderStr,
        profile?.genderString,
    ];

    for (const value of rawValues) {
        if (typeof value === "number") {
            if (value === 0) maleScore += 3;
            if (value === 1) femaleScore += 3;
            continue;
        }

        const raw = normalizeText(value);
        if (!raw) continue;
        if (["male", "nam", "boy", "m", "0", "trai", "men"].includes(raw)) {
            maleScore += 2;
        }
        if (["female", "nu", "girl", "f", "1", "gai", "women", "woman"].includes(raw)) {
            femaleScore += 2;
        }
    }

    if (profile?.isMale === true) maleScore += 3;
    if (profile?.isMale === false) femaleScore += 2;
    if (profile?.isFemale === true) femaleScore += 3;

    if (maleScore > femaleScore) return "male";
    if (femaleScore > maleScore) return "female";
    return "unknown";
}


async function resolveRealtimeProfile(api, userId) {
    try {
        const info = await api.getUserInfo(userId);
        const changedProfiles = info?.changed_profiles || {};
        const profile = changedProfiles[userId] || Object.values(changedProfiles)[0];
        return profile && typeof profile === "object" ? profile : null;
    } catch (_) {
        return null;
    }
}

async function buildParticipants(api, targets) {
    const profiles = await Promise.all(
        targets.map((target) => resolveRealtimeProfile(api, target.userId))
    );

    return targets.map((target, index) => {
        const profile = profiles[index] || {};
        const userId = normalizeId(target.userId) || String(target.userId || "").trim();
        const displayName = pickDisplayName(profile, userId) || target.displayName || `UID ${userId}`;
        const avatarUrl = pickAvatarUrl(profile) || "";
        const gender = detectGender(profile || {});

        return {
            userId,
            displayName: String(displayName || "").replace(/^@+/, "").trim() || `UID ${userId}`,
            avatarUrl,
            gender,
        };
    });
}

function pickRandomJoke(jokes) {
    if (!Array.isArray(jokes) || jokes.length === 0) return "";
    return jokes[Math.floor(Math.random() * jokes.length)];
}

async function handleThiepCuoiCommand(api, message, threadId, prefix = "!") {
    const messageType = getMessageType(message);
    const mentionedTargets = getMentionedTargets(message);

    if (mentionedTargets.length !== 2) {
        await api.sendMessage(
            {
                msg: [
                    "⚠️ Tính năng này yêu cầu gắn thẻ đúng 2 người (Chú Rể & Cô Dâu).",
                    `Cách dùng: ${prefix}thiepcuoi @nguoi1 @nguoi2`,
                ].join("\n"),
            },
            threadId,
            messageType
        );
        return;
    }

    const participants = await buildParticipants(api, mentionedTargets);
    
    // Role and Joke detection
    let role1 = "Chú Rể";
    let role2 = "Cô Dâu";
    let p1 = participants[0];
    let p2 = participants[1];

    const jokesList = {
        mixed: [
            "Cô dâu xinh đẹp, chú rể hiền lành, mong sao sau này... đừng đánh nhau.",
            "Thuyền hoa cập bến, từ nay hết kiếp độc thân, bắt đầu kiếp... sợ vợ.",
            "Tình yêu là ánh sáng, hôn nhân là hóa đơn tiền điện. Chúc mừng hai bạn!",
            "Yêu nhau là do duyên số, lấy nhau là do... quá chén. Chúc mừng hai bạn!",
        ],
        male: [
            "Hai người đàn ông, một bầu trời hạnh phúc. Ai làm nóc nhà thì... hên xui.",
            "Tình anh em chắc bền lâu, từ nay về chung một lối, nhậu nhẹt nhớ xin phép nhau.",
            "Đám cưới kim cương: Một người làm chú rể, người kia cũng làm... chú rể.",
            "Chúc mừng hai anh: Từ nay có người đi nhậu cùng, cũng có người... đứng canh cửa cùng.",
        ],
        female: [
            "Hai nàng tiên nữ về chung một nhà, từ nay son phấn dùng chung, váy áo mặc ké.",
            "Tình chị em thắm thiết, từ nay hết mơ mộng soái ca, chỉ cần có nhau là đủ.",
            "Đám cưới bách hợp: Gấp đôi sự xinh đẹp, nhưng cũng gấp đôi sự... tốn tiền mua mỹ phẩm.",
            "Hai bông hoa khoe sắc, từ nay chung một chậu, cùng nhau chăm sóc tổ ấm xinh xui.",
        ],
        general: [
            "Hôn nhân là một cuộc hội thoại dài, thỉnh thoảng lại có một người... ngủ quên.",
            "Chúc mừng bạn đã trúng giải Jackpot: Một chiếc 'gông' đeo cổ trọn đời!",
            "Tình yêu là cổ tích, hôn nhân là hiện thực. Chào mừng bạn đến với thế giới thực!",
            "Ngày hôm nay bạn là nhân vật chính, nhưng từ mai bạn là... nhân viên thực tập tại gia.",
            "Tiệc cưới hôm nay rất ngon, sếp tôi bảo thế, còn tôi thì bận... chúc mừng hai bạn.",
        ]
    };

    let pool = [...jokesList.general];
    if (p1.gender === "male" && p2.gender === "female") {
        pool.push(...jokesList.mixed);
    } else if (p1.gender === "female" && p2.gender === "male") {
        p1 = participants[1];
        p2 = participants[0];
        pool.push(...jokesList.mixed);
    } else if (p1.gender === "male" && p2.gender === "male") {
        role2 = "Chú Rể";
        pool.push(...jokesList.male);
    } else if (p1.gender === "female" && p2.gender === "female") {
        role1 = "Cô Dâu";
        pool.push(...jokesList.female);
    }
    
    const joke = pickRandomJoke(pool);

    // Calculate day + 1 hour
    const weddingDate = new Date();
    weddingDate.setHours(weddingDate.getHours() + 1);

    const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    const dayName = days[weddingDate.getDay()];
    const dateStr = `Ngày ${String(weddingDate.getDate()).padStart(2, "0")} Tháng ${String(
        weddingDate.getMonth() + 1
    ).padStart(2, "0")} Năm ${weddingDate.getFullYear()}`;
    const timeStr = `${String(weddingDate.getHours()).padStart(2, "0")}:${String(
        weddingDate.getMinutes()
    ).padStart(2, "0")}`;

    const payload = {
        title: "LỄ THÀNH HÔN",
        participants: [
            { ...p1, role: role1 },
            { ...p2, role: role2 }
        ],
        date: `${dayName}, ${dateStr}`,
        time: timeStr,
        joke: joke,
    };

    let outputPath = "";
    try {
        await api.sendMessage({ msg: "💌 Đang chuẩn bị thiệp hồng..." }, threadId);
        outputPath = await createWeddingInviteCard(payload);

        if (!outputPath) {
            throw new Error("Failed to generate image");
        }

        await api.sendMessage(
            {
                msg: `🎉 CHÚC MỪNG HẠNH PHÚC: ${p1.displayName} ❤️ ${p2.displayName} 🎉`,
                attachments: [outputPath],
            },
            threadId,
            messageType
        );
    } catch (err) {
        console.error("Wedding Card Error:", err);
        await api.sendMessage({ msg: "❌ Đã xảy ra lỗi khi tạo thiệp cưới." }, threadId);
    } finally {
        if (outputPath && fs.existsSync(outputPath)) {
            try {
                fs.unlinkSync(outputPath);
            } catch (_) {}
        }
    }
}

module.exports = {
    handleThiepCuoiCommand,
};
