const { VN_TIMEZONE } = require("../utils/vnTime");
const { ReminderSetting } = require("../db/reminderSettingModel");

const CHECK_INTERVAL_MS = 10 * 1000; // Check every 10 seconds

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
        console.error(`[reminder] Loi gui nhac nho o nhom ${groupId}:`, error);
        if (payload?.mentions) {
            try {
                await api.sendMessage({ msg: content }, groupId, 1);
            } catch (_) {}
        }
    }
}

function createWeekendRaceReminder({ api, GroupSetting, targetGroupIds = [] }) {
    let timer = null;
    const sentKeys = new Map(); // groupId -> lastMinuteKey

    async function tick() {
        const vnClock = parseVNClock(new Date());

        // Load all enabled reminder configs from DB
        let configs = [];
        try {
            configs = await ReminderSetting.find({ enabled: true }).lean();
        } catch (err) {
            console.error("[reminder] Loi doc cau hinh tu DB:", err);
            return;
        }

        // If no DB configs, fall back to legacy hardcoded behavior
        if (configs.length === 0) {
            return;
        }

        for (const cfg of configs) {
            const isOnce = cfg.reminderType === "once";

            if (isOnce) {
                // ONE-TIME REMINDER: check exact date + time
                if (!cfg.onceDate || cfg.onceDate !== vnClock.dayKey) continue;

                const targetMin = (cfg.startHour || 0) * 60 + (cfg.startMinute || 0);
                if (vnClock.minuteOfDay !== targetMin) continue;

                // Prevent duplicate
                const minuteKey = `once-${cfg.groupId}-${cfg.onceDate}-${targetMin}`;
                if (sentKeys.get(cfg.groupId) === minuteKey) continue;
                sentKeys.set(cfg.groupId, minuteKey);

                const content = cfg.reminderMessage || "⏰ Nhắc nhở từ DHA Bot";
                console.log(`[reminder] Gui nhac 1 lan den nhom ${cfg.groupId}`);
                await sendReminderToGroup(api, cfg.groupId, content);

                // Auto-disable after sending
                try {
                    await ReminderSetting.updateOne({ _id: cfg._id }, { $set: { enabled: false } });
                    console.log(`[reminder] Da tu dong tat nhac 1 lan cho nhom ${cfg.groupId}`);
                } catch (e) {
                    console.error("[reminder] Loi tat nhac 1 lan:", e);
                }
                continue;
            }

            // RECURRING REMINDER
            // Check day of week
            if (Array.isArray(cfg.daysOfWeek) && cfg.daysOfWeek.length > 0) {
                if (!cfg.daysOfWeek.includes(vnClock.weekday)) continue;
            }

            const startMinOfDay = (cfg.startHour || 0) * 60 + (cfg.startMinute || 0);
            const endMinOfDay = (cfg.endHour || 0) * 60 + (cfg.endMinute || 0);
            const interval = cfg.intervalMinutes || 2;

            // Check if current time is within the window
            if (vnClock.minuteOfDay < startMinOfDay || vnClock.minuteOfDay > endMinOfDay) {
                continue;
            }

            // Build a unique minute key to prevent duplicate sends
            const minuteKey = `${vnClock.dayKey} ${String(vnClock.hour).padStart(2, "0")}:${String(vnClock.minute).padStart(2, "0")}`;
            const lastKey = sentKeys.get(cfg.groupId);
            if (lastKey === minuteKey) continue;

            // Check if this is the "start" minute (end of window = go time)
            const isStartMinute = vnClock.minuteOfDay === endMinOfDay;

            if (!isStartMinute) {
                // Check interval
                const diffFromStart = vnClock.minuteOfDay - startMinOfDay;
                if (diffFromStart % interval !== 0) continue;
            }

            // Mark as sent
            sentKeys.set(cfg.groupId, minuteKey);

            // Determine which message to send
            const content = isStartMinute
                ? (cfg.startMessage || "🚀 **GIỜ G ĐÃ ĐẾN!** Cả nhà vào đua đội ngay thôi nào! 🔥")
                : (cfg.reminderMessage || "⚠️ Nhắc nhở tự động từ DHA Bot");

            console.log(`[reminder] Gui nhac nho den nhom ${cfg.groupId} (${minuteKey})`);
            await sendReminderToGroup(api, cfg.groupId, content);
        }
    }

    return {
        start() {
            if (timer) return;

            tick().catch((error) => {
                console.error("[reminder] Loi tick lan dau:", error);
            });

            timer = setInterval(() => {
                tick().catch((error) => {
                    console.error("[reminder] Loi tick:", error);
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
            buildMentionPayload,
            parseVNClock,
        },
    };
}

module.exports = {
    createWeekendRaceReminder,
};
