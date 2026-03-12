const mongoose = require("mongoose");

const groupSettingSchema = new mongoose.Schema(
    {
        groupId: { type: String, required: true, unique: true },
        welcomeEnabled: { type: Boolean, default: false },
        kickEnabled: { type: Boolean, default: false },
        autoKickRejoinEnabled: { type: Boolean, default: false },
        bannedWordMuteEnabled: { type: Boolean, default: false },
        commandAccessEnabled: { type: Boolean, default: false },
        commandAccessKey: { type: String, default: "" },
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
