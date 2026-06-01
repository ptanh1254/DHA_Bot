const mongoose = require("mongoose");

const reminderSettingSchema = new mongoose.Schema(
    {
        groupId: { type: String, required: true, unique: true },
        enabled: { type: Boolean, default: true },
        reminderType: { type: String, enum: ["recurring", "once"], default: "recurring" },
        onceDate: { type: String, default: "" }, // YYYY-MM-DD for one-time reminders
        startHour: { type: Number, default: 19 },
        startMinute: { type: Number, default: 59 },
        endHour: { type: Number, default: 20 },
        endMinute: { type: Number, default: 5 },
        intervalMinutes: { type: Number, default: 2 },
        daysOfWeek: { type: [Number], default: [0, 6] }, // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        reminderMessage: {
            type: String,
            default:
                "⚠️ **THÔNG BÁO ĐUA ĐỘI - LƯU Ý GIỜ VÀO ĐUA**\n\n" +
                "⏰ **Thời gian bắt đầu:** Đúng **20h05**.\n\n" +
                "🚫 **CẢNH BÁO:** Để trải nghiệm tốt nhất cho cả đội, tuyệt đối không vào sớm. Phát hiện vi phạm sẽ bị kick.\n\n" +
                "🙏 *Đây là tin nhắn nhắc nhở tự động. Chúc toàn bộ anh em tổ lái đua tốt!*",
        },
        startMessage: {
            type: String,
            default: "🚀 **GIỜ G ĐÃ ĐẾN!** Cả nhà vào đua đội ngay thôi nào! Chúc anh em cuối tuần rực rỡ! 🔥",
        },
    },
    { timestamps: true }
);

const ReminderSetting =
    mongoose.models.ReminderSetting || mongoose.model("ReminderSetting", reminderSettingSchema);

module.exports = {
    ReminderSetting,
};
