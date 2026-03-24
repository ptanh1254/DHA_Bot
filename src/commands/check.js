const fs = require("fs");

const { createCheckImage } = require("../design/check/renderer");
const { getMentionedUserId, pickDisplayName, pickAvatarUrl, getMessageType } = require("../utils/commonHelpers");

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
            // Zalo map phổ biến: 0 = nam, 1 = nữ
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

function pickRandom(items) {
    if (!Array.isArray(items) || items.length === 0) return "";
    const index = Math.floor(Math.random() * items.length);
    return items[index] || items[0] || "";
}

function pickTeaseLineByBand(lineGroups, percent) {
    const p = Number(percent) || 0;
    const bandIndex = p <= 25 ? 0 : p <= 60 ? 1 : p <= 100 ? 2 : p <= 140 ? 3 : p <= 180 ? 4 : 5;
    const band = Array.isArray(lineGroups?.[bandIndex]) ? lineGroups[bandIndex] : [];
    return pickRandom(band);
}

function buildTeaseResult(displayName, gender, percent) {
    const safeName = String(displayName || "Bạn").trim();
    const p = Math.max(0, Math.min(200, Number(percent) || 0));

    if (gender === "female") {
        const femaleLinesByBand = [
            [
                `${safeName} bánh bèo chính hiệu, dịu dàng thướt tha như mây trời.`,
                `${safeName} level bé ngoan, chưa biết mùi 'soái tỷ' là gì đâu.`,
                `${safeName} hiền khô, vibe này chỉ có thể là công chúa ngủ trong rừng.`,
            ],
            [
                `${safeName} có tí cá tính mạnh, bắt đầu thấy vibe 'nữ cường' rồi nha.`,
                `${safeName} bắt đầu biết ga-lăng với chị em rồi đấy, nghi lắm!`,
                `${safeName} cắt tóc ngắn cái là bao anh ra rìa luôn cho xem.`,
            ],
            [
                `${safeName} ga-lăng phết đấy, chuẩn phong cách 'soái tỷ' khiến chị em mê mẩn.`,
                `${safeName} thần thái 'bách hợp' ngút ngàn, chuẩn bị nhận lời tỏ tình đi nhé.`,
                `${safeName} vừa xinh vừa ngầu, đúng gu của hội chị em cá tính.`,
            ],
            [
                `${safeName} level soái tỷ, nháy mắt cái là chị em auto tự 'đổ' hàng loạt.`,
                `${safeName} khí chất này chỉ có thể là tổng tài trong truyện bách hợp thôi!`,
                `${safeName} bước đi hiên ngang, spotlight 'soái tỷ' là của bạn hết.`,
            ],
            [
                `${safeName} bà trùm ga-lăng, đứng đâu chị em cũng muốn quây quanh xin chữ ký.`,
                `${safeName} độ 'men-lì' vượt trần, anh em đứng cạnh cũng thấy tự ti vì quá ngầu.`,
                `${safeName} radar sắc đẹp quét toàn hội chị em, không trượt phát nào.`,
            ],
            [
                `${safeName} chính thức thành 'Nam Thần' của phái đẹp, độ Less vượt trần!`,
                `${safeName} quỳ rạp hết đi, Boss của hội chị em cá tính đã xuất hiện rồi!`,
                `${safeName} huyền thoại của sự mạnh mẽ, chị em nhìn thấy là 'rụng rời' chân tay.`,
            ],
        ];

        return {
            title: "Kết Quả Check Less",
            comment: pickTeaseLineByBand(femaleLinesByBand, p),
        };
    }

    if (gender === "male") {
        const maleLinesByBand = [
            [
                `${safeName} thẳng như cây thước, không một vết gợn luôn nha.`,
                `${safeName} chuẩn men 100%, radar cong chưa có một tí tín hiệu nào.`,
                `${safeName} cứng như thép, gió thổi không mảy may lay chuyển được.`,
            ],
            [
                `${safeName} có tí xíu 'cong cong' cho đời nó nghệ, nhưng vẫn an toàn.`,
                `${safeName} cười duyên quá, anh em trong nhóm bắt đầu thấy hơi run rinh.`,
                `${safeName} đi đứng bắt đầu có nhịp điệu lả lướt rồi nha, nghi lắm!`,
            ],
            [
                `${safeName} bắt đầu dẻo rồi nha, vibe 'chị em nương tựa' đang trỗi dậy.`,
                `${safeName} đi nhẹ nói khẽ cười duyên nào, chuẩn bị kết nạp hội chị em thôi.`,
                `${safeName} mặn mà quá mức, bắt đầu biết thả thính dạo với các anh rồi.`,
            ],
            [
                `${safeName} độ mặn đang tăng, nhìn xa tưởng idol, nhìn gần thấy... hơi bóng!`,
                `${safeName} nói một câu mà như bắn tim cho các anh, sát thương cực cao.`,
                `${safeName} visual có yếu tố gây nghiện, nhưng mà là cho phái mạnh nha.`,
            ],
            [
                `${safeName} nụ cười tỏa nắng, nhưng sao nghe mùi 'chị em' nồng nặc thế?`,
                `${safeName} aura sáng chói, hội chị em xin kết nạp ngay và không cần phỏng vấn.`,
                `${safeName} dẻo quẹo như kẹo kéo, chuẩn bị đi thi 'Next Top Model' được rồi.`,
            ],
            [
                `${safeName} độ cong vượt trần kỹ thuật, chính thức trở thành 'Nữ Hoàng' của group!`,
                `${safeName} huyền thoại của sự dẻo quẹo, không thể cứu vãn được nữa rồi! 💀`,
                `${safeName} xuất hiện là thành tâm điểm của hội chị em, dẹo quá dẹo!`,
            ],
        ];

        return {
            title: "Kết Quả Check Gay",
            comment: pickTeaseLineByBand(maleLinesByBand, p),
        };
    }

    const neutralLinesByBand = [
        [
            `${safeName} vibe hiền khô, đúng kiểu 'bé ngoan quốc dân'.`,
            `${safeName} 10% đáng yêu, nhẹ nhàng như gió mùa thu.`,
            `${safeName} chưa nhuốm bụi trần, vibe trong sáng tuyệt đối.`,
        ],
        [
            `${safeName} bắt đầu thấy cuốn rồi đó, có tí muối dạo rồi!`,
            `${safeName} nói chuyện bắt đầu 'dính' rồi nha, 40% mặn mà.`,
            `${safeName} vibe tươi mới, làm cả nhóm thấy hứng khởi hẳn lên.`,
        ],
        [
            `${safeName} thần thái ổn áp, vào nhóm là bừng sáng cả khung chat.`,
            `${safeName} 80% cuốn hút, radar sắc đẹp đang báo động đỏ!`,
            `${safeName} vibe hài hước, gánh team bằng những câu đùa cực mặn.`,
        ],
        [
            `${safeName} chính thức trở thành tâm điểm, spotlight tối nay là của bạn!`,
            `${safeName} 120% năng lượng, quẩy banh nóc group luôn đi bạn ơi.`,
            `${safeName} vibe idol, nhan sắc và tài năng đều khiến bot nể phục.`,
        ],
        [
            `${safeName} độ mặn vượt mức cho phép, đề nghị đi bán muối giải nghiệp!`,
            `${safeName} 170% thần thái, đứng đâu cũng thấy sáng lấp lánh như kim cương.`,
            `${safeName} vibe 'người của công chúng', ai nhìn cũng thấy mê mẩn.`,
        ],
        [
            `${safeName} huyền thoại của sự dí dỏm, bot cũng xin bái làm sư phụ!`,
            `${safeName} 200% đỉnh chóp, không còn mỹ từ nào để chê nữa.`,
            `${safeName} vibe 'vũ trụ', sức hút không thể cưỡng lại từ cái nhìn đầu tiên!`,
        ],
    ];

    return {
        title: "Kết Quả Check Vibe",
        comment: pickTeaseLineByBand(neutralLinesByBand, p),
    };
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

function randomPercent() {
    return Math.floor(Math.random() * 201);
}

async function handleCheckCommand(api, message, threadId, prefix = "!") {
    const messageType = getMessageType(message);
    const targetUserId = getMentionedUserId(message);
    if (!targetUserId) {
        await api.sendMessage(
            {
                msg: `Bạn hãy tag 1 người dùng. Ví dụ: ${prefix}check @TenNguoiDung`,
            },
            threadId,
            messageType
        );
        return;
    }

    const profile = await resolveRealtimeProfile(api, targetUserId);
    const displayName = pickDisplayName(profile, targetUserId);
    const avatarUrl = pickAvatarUrl(profile);
    const gender = detectGender(profile || {});
    const percent = randomPercent();
    const teaseResult = buildTeaseResult(displayName, gender, percent);

    let outputPath = "";
    try {
        outputPath = await createCheckImage(
            {
                userId: targetUserId,
                displayName,
                avatarUrl,
                percent,
                title: teaseResult.title,
                comment: teaseResult.comment,
            },
            {
                fileName: `check-${threadId}-${targetUserId}-${Date.now()}.png`,
            }
        );

        await api.sendMessage(
            {
                msg: `${displayName}: ${percent}%\n${teaseResult.comment}`,
                attachments: [outputPath],
            },
            threadId,
            messageType
        );
    } finally {
        if (outputPath && fs.existsSync(outputPath)) {
            try {
                fs.unlinkSync(outputPath);
            } catch (_) {}
        }
    }
}

module.exports = {
    handleCheckCommand,
};
