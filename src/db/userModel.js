const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    groupId: String,
    userId: String,
    displayName: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    msgCount: { type: Number, default: 0 },
    totalMsgCount: { type: Number, default: 0 },
    addedByUserId: { type: String, default: "" },
    addedByName: { type: String, default: "" },
    joinDate: Date,
});

const User = mongoose.models.User || mongoose.model("User", userSchema);

module.exports = {
    User,
};
