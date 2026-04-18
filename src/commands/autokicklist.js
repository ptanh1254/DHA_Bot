const fs = require("fs");

const { getMessageType, sendMessage } = require("../utils/commonHelpers");
const { formatCount } = require("../design/chatRanking/template");
const { createAutoKickListImage } = require("../design/autokickList/renderer");

const ROWS_PER_IMAGE = 10;
const IMAGES_PER_MESSAGE = 10;

function pickName(row) {
    const candidates = [
        row?.ingameName,
        row?.lastKnownName,
        row?.firstKnownName,
        row?.displayName,
        row?.userName,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }

    return "Kh\u00f4ng r\u00f5 t\u00ean";
}

function normalizeMemberId(rawId) {
    const value = String(rawId || "").trim();
    if (!value) return "";
    return value.replace(/_\d+$/, "").trim();
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

function pickDisplayName(profile) {
    const candidates = [
        profile?.displayName,
        profile?.dName,
        profile?.zaloName,
        profile?.username,
        profile?.name,
    ];
    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }
    return "";
}

function normalizeKickCount(row) {
    const value = Number(row?.kickCount);
    if (Number.isFinite(value) && value > 0) {
        return Math.floor(value);
    }

    const hasLegacyHistory = Boolean(
        row?.firstKickAt ||
        row?.lastKickAt ||
        row?.firstKnownName ||
        row?.lastKnownName
    );
    return hasLegacyHistory ? 1 : 0;
}

function toTimeValue(value) {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
}

function mergeRows(existing, incoming) {
    if (!existing) return { ...incoming };

    const existingKickCount = normalizeKickCount(existing);
    const incomingKickCount = normalizeKickCount(incoming);
    const existingLatest = Math.max(toTimeValue(existing.lastKickAt), toTimeValue(existing.firstKickAt));
    const incomingLatest = Math.max(toTimeValue(incoming.lastKickAt), toTimeValue(incoming.firstKickAt));

    if (incomingLatest > existingLatest) {
        return {
            ...existing,
            ...incoming,
            kickCount: Math.max(existingKickCount, incomingKickCount),
        };
    }

    return {
        ...incoming,
        ...existing,
        kickCount: Math.max(existingKickCount, incomingKickCount),
    };
}

function chunkArray(values, chunkSize) {
    const out = [];
    for (let i = 0; i < values.length; i += chunkSize) {
        out.push(values.slice(i, i + chunkSize));
    }
    return out;
}

async function buildUserMetaMap(api, userIds) {
    const map = new Map();
    if (!api || typeof api.getUserInfo !== "function") return map;

    const normalizedIds = [...new Set((userIds || []).map((id) => normalizeMemberId(id)).filter(Boolean))];
    if (normalizedIds.length === 0) return map;

    const chunks = chunkArray(normalizedIds, 50);
    for (let i = 0; i < chunks.length; i += 3) {
        const promises = [];
        for (let j = 0; j < 3 && i + j < chunks.length; j += 1) {
            promises.push(
                (async () => {
                    try {
                        const info = await api.getUserInfo(chunks[i + j]);
                        const profiles = info?.changed_profiles || info?.profiles || {};
                        for (const [rawUid, profile] of Object.entries(profiles)) {
                            const uid = normalizeMemberId(profile?.id || rawUid);
                            if (!uid) continue;
                            const displayName = pickDisplayName(profile);
                            const avatarUrl = pickAvatarUrl(profile);

                            const current = map.get(uid) || { displayName: "", avatarUrl: "" };
                            if (displayName) current.displayName = displayName;
                            if (avatarUrl) current.avatarUrl = avatarUrl;
                            map.set(uid, current);
                        }
                    } catch (_) {}
                })()
            );
        }
        await Promise.all(promises);
    }

    return map;
}

async function handleAutoKickListCommand(api, message, threadId, KickHistory, prefix = "!") {
    const messageType = getMessageType(message);
    if (!KickHistory) {
        await sendMessage(
            api,
            { msg: "Ch\u01b0a kh\u1edfi t\u1ea1o \u0111\u01b0\u1ee3c d\u1eef li\u1ec7u autokick." },
            threadId,
            messageType
        );
        return;
    }

    const outputPaths = [];
    try {
        const rawRows = await KickHistory.find({ groupId: threadId }).lean();
        const rowMap = new Map();

        for (const row of rawRows) {
            const normalizedUid = normalizeMemberId(row?.userId);
            if (!normalizedUid) continue;
            if (normalizeKickCount(row) <= 0) continue;

            const existing = rowMap.get(normalizedUid);
            rowMap.set(normalizedUid, mergeRows(existing, { ...row, userId: normalizedUid }));
        }

        const rows = [...rowMap.values()].sort((a, b) => {
            const aTime = Math.max(toTimeValue(a?.lastKickAt), toTimeValue(a?.firstKickAt));
            const bTime = Math.max(toTimeValue(b?.lastKickAt), toTimeValue(b?.firstKickAt));
            if (bTime !== aTime) return bTime - aTime;
            return String(a?.userId || "").localeCompare(String(b?.userId || ""));
        });

        const userMetaMap = await buildUserMetaMap(
            api,
            rows.map((row) => row?.userId)
        );

        if (rows.length === 0) {
            await sendMessage(
                api,
                {
                    msg: [
                        "Danh s\u00e1ch autokick hi\u1ec7n \u0111ang r\u1ed7ng.",
                        "Khi c\u00f3 ng\u01b0\u1eddi b\u1ecb kick ho\u1eb7c t\u1ef1 r\u1eddi nh\u00f3m, bot s\u1ebd t\u1ef1 \u0111\u1ed9ng l\u01b0u v\u00e0o danh s\u00e1ch n\u00e0y.",
                    ].join("\n"),
                },
                threadId,
                messageType
            );
            return;
        }

        const rankingRows = rows.map((row, index) => {
            const uid = String(row?.userId || "").trim();
            const meta = userMetaMap.get(normalizeMemberId(uid)) || {};
            return {
                rank: index + 1,
                userId: uid,
                displayName: meta.displayName || pickName(row),
                avatarUrl: meta.avatarUrl || "",
                kickCount: normalizeKickCount(row),
            };
        });

        const totalKickCount = rankingRows.reduce(
            (sum, row) => sum + (Number(row.kickCount) || 0),
            0
        );
        const totalPages = Math.max(1, Math.ceil(rankingRows.length / ROWS_PER_IMAGE));

        const renderTasks = [];
        for (let i = 0; i < rankingRows.length; i += ROWS_PER_IMAGE) {
            const pageRows = rankingRows.slice(i, i + ROWS_PER_IMAGE);
            const page = Math.floor(i / ROWS_PER_IMAGE) + 1;
            renderTasks.push({
                page,
                pageRows,
                fileName: `autokicklist-${threadId}-${page}-${Date.now()}.png`,
            });
        }

        for (let i = 0; i < renderTasks.length; i += 2) {
            const promises = [
                createAutoKickListImage(renderTasks[i].pageRows, {
                    page: renderTasks[i].page,
                    totalPages,
                    totalMembers: rankingRows.length,
                    totalKickCount,
                    rankingTitle: "Danh S\u00e1ch AutoKick",
                    periodLabel: "T\u1ef1 \u0111\u1ed9ng ph\u00e1t hi\u1ec7n user t\u1eebng b\u1ecb kick/r\u1eddi nh\u00f3m",
                    fileName: renderTasks[i].fileName,
                }),
            ];

            if (i + 1 < renderTasks.length) {
                promises.push(
                    createAutoKickListImage(renderTasks[i + 1].pageRows, {
                        page: renderTasks[i + 1].page,
                        totalPages,
                        totalMembers: rankingRows.length,
                        totalKickCount,
                        rankingTitle: "Danh S\u00e1ch AutoKick",
                        periodLabel: "T\u1ef1 \u0111\u1ed9ng ph\u00e1t hi\u1ec7n user t\u1eebng b\u1ecb kick/r\u1eddi nh\u00f3m",
                        fileName: renderTasks[i + 1].fileName,
                    })
                );
            }

            const createdPaths = await Promise.all(promises);
            outputPaths.push(...createdPaths);
        }

        const attachmentChunks = chunkArray(outputPaths, IMAGES_PER_MESSAGE);
        for (let i = 0; i < attachmentChunks.length; i += 1) {
            const startPage = i * IMAGES_PER_MESSAGE + 1;
            const endPage = Math.min((i + 1) * IMAGES_PER_MESSAGE, totalPages);
            const msgText =
                i === 0
                    ? `Danh s\u00e1ch autokick (${formatCount(rankingRows.length)} UID) - ${totalPages} \u1ea3nh`
                    : `Danh s\u00e1ch autokick ti\u1ebfp theo (${startPage}-${endPage}/${totalPages})`;

            await api.sendMessage(
                {
                    msg: msgText,
                    attachments: attachmentChunks[i],
                },
                threadId,
                messageType
            );
        }
    } catch (error) {
        console.error("[autokicklist] Loi khi tai danh sach:", error);
        await sendMessage(
            api,
            { msg: "Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c danh s\u00e1ch autokick, b\u1ea1n th\u1eed l\u1ea1i sau nh\u00e9." },
            threadId,
            messageType
        );
    } finally {
        for (const outputPath of outputPaths) {
            if (outputPath && fs.existsSync(outputPath)) {
                try {
                    fs.unlinkSync(outputPath);
                } catch (_) {}
            }
        }
    }
}

module.exports = {
    handleAutoKickListCommand,
};
