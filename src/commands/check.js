const fs = require("fs");

const { createCheckImage } = require("../design/check/renderer");

function getMentionedUserId(message) {
    const mentions = message?.data?.mentions;
    if (!Array.isArray(mentions) || mentions.length === 0) return "";
    const uid = mentions[0]?.uid;
    return uid ? String(uid).trim() : "";
}

function pickDisplayName(profile, fallbackUserId) {
    const candidates = [
        profile?.displayName,
        profile?.dName,
        profile?.zaloName,
        profile?.username,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }

    return `UID ${fallbackUserId}`;
}

function pickAvatarUrl(profile) {
    const candidates = [profile?.avatar, profile?.avatar_120, profile?.avatar_240, profile?.avatar_25];
    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }
    return "";
}

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
                `${safeName} dịu như gió đầu mùa.`,
                `${safeName} nhẹ như mây trôi ngang tim.`,
                `${safeName} cười cái là cả nhóm dịu lại.`,
                `${safeName} level “bé ngoan quốc dân”.`,
                `${safeName} đáng yêu như sticker mèo.`,
                `${safeName} nói chuyện duyên phát mê.`,
                `${safeName} hiền mà vẫn rất cuốn.`,
                `${safeName} nhìn phát thấy bình yên.`,
            ],
            [
                `${safeName} duyên dáng có bằng lái.`,
                `${safeName} vibe bánh bèo có kiểm soát.`,
                `${safeName} ngọt như trà đào ít đá.`,
                `${safeName} cười phát là tim lạc nhịp.`,
                `${safeName} xinh kiểu tự nhiên mà gắt.`,
                `${safeName} đang bật mode “cute nguy hiểm”.`,
                `${safeName} ai gặp cũng auto mềm lòng.`,
                `${safeName} đủ làm nhóm rung rinh.`,
            ],
            [
                `${safeName} xinh xẻo chuẩn chỉnh.`,
                `${safeName} nói câu nào dính câu đó.`,
                `${safeName} thần thái nữ chính tập cuối.`,
                `${safeName} nhìn là thấy có mùa xuân.`,
                `${safeName} duyên dáng full công suất.`,
                `${safeName} bước vào là bừng sáng khung chat.`,
                `${safeName} độ cuốn đang lên rất cao.`,
                `${safeName} combo đẹp - duyên - mặn đủ cả.`,
            ],
            [
                `${safeName} nháy mắt cái là xao xuyến.`,
                `${safeName} style “nhẹ nhàng mà sát thương”.`,
                `${safeName} nói chuyện thôi cũng viral.`,
                `${safeName} khí chất sang khỏi bàn.`,
                `${safeName} ảnh chụp kiểu nào cũng xinh.`,
                `${safeName} timeline gặp là đứng hình.`,
                `${safeName} vào group là bật mood liền.`,
                `${safeName} đỉnh chóp của sự duyên.`,
            ],
            [
                `${safeName} cute quá nên bị nghi hack game.`,
                `${safeName} giơ tay chào là nhóm dậy sóng.`,
                `${safeName} thần thái làm tim xếp hàng.`,
                `${safeName} level hoa hậu thân thiện.`,
                `${safeName} đi tới đâu là sáng tới đó.`,
                `${safeName} vừa xinh vừa bén vừa mặn.`,
                `${safeName} đụng nhẹ cũng thương.`,
                `${safeName} khó mà không mê.`,
            ],
            [
                `${safeName} radar dễ thương quét full map.`,
                `${safeName} nhan sắc biết nói chuyện.`,
                `${safeName} cả nhóm xin 1 vé làm fan.`,
                `${safeName} độ duyên vượt trần cho phép.`,
                `${safeName} xuất hiện là thành trend.`,
                `${safeName} đẹp xinh yêu mặn đủ combo.`,
                `${safeName}  hệ “không thể không quý”.`,
                `${safeName} hìn lâu dễ quên lối về.`,
            ],
        ];

        return {
            title: "K\u1ebft Qu\u1ea3 Check Less Gay",
            comment: pickTeaseLineByBand(femaleLinesByBand, p),
        };
    }

    if (gender === "male") {
        const maleLinesByBand = [
            [
                `${safeName} còn bình tĩnh được.`,
                `${safeName} mới cong nhẹ phần tâm hồn.`,
                `${safeName} radar thính vừa khởi động.`,
                `${safeName} tim rung theo nhịp beat.`,
                `${safeName} chưa gắt nhưng có tín hiệu.`,
                `${safeName} level “đẹp trai mà mềm”.`,
                `${safeName} bắt đầu có vibe lả lướt.`,
                `${safeName} nhìn gương thấy hơi nghệ.`,
            ],
            [
                `${safeName} đi đứng đã có tiết tấu.`,
                `${safeName} gặp nhạc hay là lắc vai.`,
                `${safeName} nói chuyện duyên như MC.`,
                `${safeName} thả thính nhẹ mà dính sâu.`,
                `${safeName} cười lên cái là tim ai đó lệch nhịp.`,
                `${safeName} bật mode “tỏa sáng âm thầm”.`,
                `${safeName} chưa max nhưng rất gì này nọ.`,
                `${safeName} khí chất cong vừa đủ gây nhớ.`,
            ],
            [
                `${safeName} radar tình yêu quét cực mượt.`,
                `${safeName} nhìn xa tưởng idol mới debut.`,
                `${safeName} đi tới đâu spotlight tới đó.`,
                `${safeName} vừa mặn vừa duyên vừa cuốn.`,
                `${safeName} cười phát là nhóm mất tập trung.`,
                `${safeName} mềm mà không yếu, chất đấy.`,
                `${safeName} nội lực thả thính cực cao.`,
                `${safeName}  chuẩn hệ “đỉnh của chóp”.`,
            ],    [        `${safeName}  đi ngang qua là có người quay đầu.`,
                `${safeName}  nói một câu mà như bắn tim.`,
                `${safeName}  độ cong được hội bạn xác nhận.`,
                `${safeName}  visual có yếu tố gây nghiện.`,
                `${safeName}  thần thái khiến camera tự lấy nét.`,
                `${safeName}  drama ở đâu thần thái ở đó.`,
                `${safeName}  bật mode “quét sạch ánh nhìn”.`,
                `${safeName}  level chạm nhẹ là dính.`,
            ],    [        `${safeName}  tỏa sáng như biển đèn concert.`,
                `${safeName}  nụ cười sát thương diện rộng.`,
                `${safeName}  bước vào là thành chủ đề nóng.`,
                `${safeName}  độ mặn vượt chuẩn an toàn.`,
                `${safeName}  tim người khác xếp hàng chờ lượt.`,
                `${safeName}  phong thái khiến nhóm nể phục.`,
                `${safeName}  thả thính là auto dính.`,
                `${safeName}  hội đồng chấm điểm xin tuyệt đối.`,
            ],    [        `${safeName}  đẹp trai kiểu gây thương nhớ.`,
                `${safeName}  aura sáng hơn đèn sân khấu.`,
                `${safeName}  mood “ai rồi cũng thành fan”.`,
                `${safeName}  độ cong vượt trần kỹ thuật.`,
                `${safeName}  nói chuyện thôi cũng thành trend.`,
                `${safeName}  huyền thoại sống của sự cuốn.`,
                `${safeName} hệ “xuất hiện là bùng nổ”.`,
                `${safeName} xin phép gọi là tượng đài.`,
            ],
        ];

        return {
            title: "K\u1ebft Qu\u1ea3 Check Gay",
            comment: pickTeaseLineByBand(maleLinesByBand, p),
        };
    }

    const neutralLinesByBand = [
        [
            `${safeName} vibe 6%, hiền như cục bông.`,
            `${safeName} vibe 10%, đáng yêu kín tiếng.`,
            `${safeName} vibe 14%, nhỏ nhẹ mà có lực.`,
            `${safeName} vibe 18%, ai gặp cũng thấy quý.`,
            `${safeName} vibe 22%, chuẩn người tốt việc tốt.`,
            `${safeName} vibe 25%, nhẹ mà thấm.`,
        ],
        [
            `${safeName} vibe 31%, bắt đầu cuốn rồi đó.`,
            `${safeName} vibe 36%, nhìn phát là có thiện cảm.`,
            `${safeName} vibe 42%, nói chuyện duyên ghê.`,
            `${safeName} vibe 48%, đi tới đâu vui tới đó.`,
            `${safeName} vibe 53%, tươi như nắng mới.`,
            `${safeName} vibe 60%, vừa đủ làm nhóm cười.`,
        ],
        [
            `${safeName} vibe 68%, khí chất đang tăng tốc.`,
            `${safeName} vibe 74%, thần thái ổn áp tuyệt đối.`,
            `${safeName} vibe 81%, vào nhóm là bật không khí.`,
            `${safeName} vibe 87%, nói câu nào dính câu đó.`,
            `${safeName} vibe 92%, độ cuốn vượt mức trung bình.`,
            `${safeName} vibe 100%, hôm nay quá hợp để tỏa sáng.`,
        ],
        [
            `${safeName} vibe 109%, đội cổ vũ đã sẵn sàng.`,
            `${safeName} vibe 116%, có tố chất làm tâm điểm.`,
            `${safeName} vibe 122%, vừa vui vừa mặn.`,
            `${safeName} vibe 128%, gánh team bằng nụ cười.`,
            `${safeName} vibe 133%, vào là nhóm sáng bừng.`,
            `${safeName} vibe 140%, mức siêu cuốn đã bật.`,
        ],
        [
            `${safeName} vibe 151%, hội bạn xin theo học.`,
            `${safeName} vibe 158%, nói chuyện như phát nhạc hay.`,
            `${safeName} vibe 164%, hài mà không hề vô duyên.`,
            `${safeName} vibe 169%, năng lượng dồi dào không tưởng.`,
            `${safeName} vibe 173%, thần thái khó thay thế.`,
            `${safeName} vibe 180%, đúng kiểu người của công chúng.`,
        ],
        [
            `${safeName} vibe 186%, ai gặp cũng muốn kết bạn.`,
            `${safeName} vibe 191%, độ cuốn vượt tầm kiểm soát.`,
            `${safeName} vibe 194%, trend nào cũng theo kịp.`,
            `${safeName} vibe 197%, xuất hiện là bùng nổ.`,
            `${safeName} vibe 199%, tim ai đó vừa báo động.`,
            `${safeName} vibe 200%, chính thức thành huyền thoại.`,
        ],
    ];

    return {
        title: "K\u1ebft Qu\u1ea3 Check Vibe",
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
    const targetUserId = getMentionedUserId(message);
    if (!targetUserId) {
        await api.sendMessage(
            {
                msg: `B\u1ea1n h\u00e3y tag 1 ng\u01b0\u1eddi d\u00f9ng. V\u00ed d\u1ee5: ${prefix}check @TenNguoiDung`,
            },
            threadId,
            message.type
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
            message.type
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
