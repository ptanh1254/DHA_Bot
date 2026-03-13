const mongoose = require("mongoose");

const groupSettingSchema = new mongoose.Schema(
    {
        groupId: { type: String, required: true, unique: true },
        welcomeEnabled: { type: Boolean, default: true },
        kickEnabled: { type: Boolean, default: true },
        autoKickRejoinEnabled: { type: Boolean, default: true },
        bannedWordMuteEnabled: { type: Boolean, default: true },
        preventRecallEnabled: { type: Boolean, default: false },
    },
    {
        timestamps: { createdAt: false, updatedAt: true },
    }
);

const GroupSetting =
    mongoose.models.GroupSetting || mongoose.model("GroupSetting", groupSettingSchema);

module.exports = {
    GroupSetting,
};
