const mongoose = require("mongoose");

const userWeeklyMessageSchema = new mongoose.Schema(
    {
        groupId: { type: String, required: true, index: true },
        userId: { type: String, required: true, index: true },
        weekKey: { type: String, required: true, index: true }, // Monday dayKey (YYYY-MM-DD)
        weekStartDayKey: { type: String, default: "" }, // Monday
        weekEndDayKey: { type: String, default: "" }, // Sunday
        msgCount: { type: Number, default: 0 },
        lastMessageAt: { type: Date, default: null },
    },
    {
        timestamps: true,
    }
);

userWeeklyMessageSchema.index({ groupId: 1, userId: 1, weekKey: 1 }, { unique: true });
userWeeklyMessageSchema.index({ groupId: 1, weekKey: 1, userId: 1 });

const UserWeeklyMessage =
    mongoose.models.UserWeeklyMessage ||
    mongoose.model("UserWeeklyMessage", userWeeklyMessageSchema);

module.exports = {
    UserWeeklyMessage,
};

