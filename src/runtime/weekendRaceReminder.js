const { VN_TIMEZONE } = require("../utils/vnTime");

const CHECK_INTERVAL_MS = 10 * 1000;
const START_MINUTE = 19 * 60 + 59; // 19:59
const END_MINUTE = 20 * 60 + 5; // 20:05
const REMIND_INTERVAL_MINUTES = 2;

const WEEKEND_REMINDER_TEXT = 
    "⚠️ **THÔNG BÁO ĐUA ĐỘI - LƯU Ý GIỜ VÀO ĐUA**\n\n" +
    "⏰ **Thời gian bắt đầu:** Đúng **20h05**.\n\n" +
    "🚫 **CẢNH BÁO:** Để trải nghiệm tốt nhất cho cả đội, tuyệt đối không vào sớm. Phát hiện vi phạm sẽ bị kick.\n\n" +
    "🙏 *Đây là tin nhắn nhắc nhở tự động 2 phút/lần (19h59 - 20h05). Rất xin lỗi nếu làm phiền cả nhà DHA, chúc toàn bộ anh em tổ lái đua tốt!*";

const WEEKEND_START_TEXT = "🚀 **GIỜ G ĐÃ ĐẾN!** Cả nhà vào đua đội ngay thôi nào! Chúc anh em cuối tuần rực rỡ! 🔥";

function parseVNClock(date = new Date()) {
    const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: VN_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
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
    const hour = Number(map.hour || 0);
    const minute = Number(map.minute || 0);
    const dayKey = `${year}-${month}-${day}`;

    // JS getUTCDay: Sunday=0...Saturday=6.
    const utcNoon = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));
    const weekday = utcNoon.getUTCDay();

    return {
        dayKey,
        hour,
        minute,
        weekday,
        minuteOfDay: hour * 60 + minute,
    };
}

function buildSchedulePayload(date = new Date()) {
    const vnClock = parseVNClock(date);
    const isWeekend = vnClock.weekday === 0 || vnClock.weekday === 6;
    if (!isWeekend) return null;

    if (vnClock.minuteOfDay < START_MINUTE || vnClock.minuteOfDay > END_MINUTE) {
        return null;
    }

    const isStartMinute = vnClock.minuteOfDay === END_MINUTE;
    if (!isStartMinute) {
        const diffFromStart = vnClock.minuteOfDay - START_MINUTE;
        if (diffFromStart % REMIND_INTERVAL_MINUTES !== 0) {
            return null;
        }
    }

    return {
        minuteKey: `${vnClock.dayKey} ${String(vnClock.hour).padStart(2, "0")}:${String(
            vnClock.minute
        ).padStart(2, "0")}`,
        content: isStartMinute ? WEEKEND_START_TEXT : WEEKEND_REMINDER_TEXT,
    };
}

async function listTargetGroupIds(api, GroupSetting) {
    const groupIds = new Set();

    try {
        const allGroups = await api.getAllGroups();
        const map = allGroups?.gridVerMap || {};
        for (const groupId of Object.keys(map)) {
            const normalized = String(groupId || "").trim();
            if (normalized) groupIds.add(normalized);
        }
    } catch (error) {
        console.error("[weekend-reminder] Loi lay danh sach nhom tu getAllGroups:", error);
    }

    if (groupIds.size === 0 && GroupSetting) {
        try {
            const fromSettings = await GroupSetting.distinct("groupId");
            for (const groupId of fromSettings || []) {
                const normalized = String(groupId || "").trim();
                if (normalized) groupIds.add(normalized);
            }
        } catch (error) {
            console.error("[weekend-reminder] Loi lay danh sach nhom tu GroupSetting:", error);
        }
    }

    return [...groupIds];
}

function buildMentionPayload(content) {
    const mentionToken = "@all";
    return {
        msg: `${mentionToken} ${content}`,
        mentions: [
            {
                uid: "-1",
                pos: 0,
                len: Array.from(mentionToken).length,
            },
        ],
    };
}

async function sendReminderToGroup(api, groupId, content) {
    const payload = buildMentionPayload(content);

    try {
        await api.sendMessage(payload, groupId, 1);
    } catch (error) {
        console.error(`[weekend-reminder] Loi gui nhac nho o nhom ${groupId}:`, error);
        if (payload?.mentions) {
            try {
                await api.sendMessage({ msg: content }, groupId, 1);
            } catch (_) {}
        }
    }
}

function createWeekendRaceReminder({ api, GroupSetting, targetGroupIds = [] }) {
    let timer = null;
    let lastMinuteKey = "";
    const fixedGroupIds = Array.isArray(targetGroupIds)
        ? targetGroupIds
              .map((groupId) => String(groupId || "").trim())
              .filter(Boolean)
        : [];

    async function tick() {
        const schedulePayload = buildSchedulePayload(new Date());
        if (!schedulePayload) return;
        if (schedulePayload.minuteKey === lastMinuteKey) return;

        lastMinuteKey = schedulePayload.minuteKey;

        const groupIds =
            fixedGroupIds.length > 0
                ? fixedGroupIds
                : await listTargetGroupIds(api, GroupSetting);
        if (groupIds.length === 0) {
            console.warn("[weekend-reminder] Khong co nhom nao de gui nhac nho.");
            return;
        }

        for (const groupId of groupIds) {
            await sendReminderToGroup(api, groupId, schedulePayload.content);
        }
    }

    return {
        start() {
            if (timer) return;

            tick().catch((error) => {
                console.error("[weekend-reminder] Loi tick lan dau:", error);
            });

            timer = setInterval(() => {
                tick().catch((error) => {
                    console.error("[weekend-reminder] Loi tick:", error);
                });
            }, CHECK_INTERVAL_MS);

            if (typeof timer.unref === "function") {
                timer.unref();
            }
        },
        stop() {
            if (!timer) return;
            clearInterval(timer);
            timer = null;
        },
        _debug: {
            buildSchedulePayload,
            buildMentionPayload,
            parseVNClock,
        },
    };
}

module.exports = {
    createWeekendRaceReminder,
};
