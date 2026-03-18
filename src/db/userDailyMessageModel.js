const mongoose = require("mongoose");

const userDailyMessageSchema = new mongoose.Schema(
    {
        groupId: { type: String, required: true, index: true },
        userId: { type: String, required: true, index: true },
        dayKey: { type: String, required: true, index: true }, // YYYY-MM-DD (VN)
        msgCount: { type: Number, default: 0 },
        lastMessageAt: { type: Date, default: null },
    },
    {
        timestamps: true,
    }
);

userDailyMessageSchema.index({ groupId: 1, userId: 1, dayKey: 1 }, { unique: true });
userDailyMessageSchema.index({ groupId: 1, dayKey: 1, userId: 1 });

const UserDailyMessage =
    mongoose.models.UserDailyMessage ||
    mongoose.model("UserDailyMessage", userDailyMessageSchema);

module.exports = {
    UserDailyMessage,
};
