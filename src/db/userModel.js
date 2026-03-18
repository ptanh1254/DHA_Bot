const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    groupId: String,
    userId: String,
    displayName: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    msgCount: { type: Number, default: 0 },
    totalMsgCount: { type: Number, default: 0 },
    dailyMsgCount: { type: Number, default: 0 },
    monthlyMsgCount: { type: Number, default: 0 },
    dayKey: { type: String, default: "" },
    monthKey: { type: String, default: "" },
    addedByUserId: { type: String, default: "" },
    addedByName: { type: String, default: "" },
    ingameName: { type: String, default: "" },
    ingameSetAt: { type: Date, default: null },
    joinDate: Date,
    lastMessageAt: { type: Date, default: null },
});

const User = mongoose.models.User || mongoose.model("User", userSchema);

module.exports = {
    User,
};
