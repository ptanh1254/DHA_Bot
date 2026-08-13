const mongoose = require("mongoose");

const botSettingSchema = new mongoose.Schema(
    {
        settingId: { type: String, required: true, unique: true, default: "global" },
        deleteQrEnabled: { type: Boolean, default: true },
        protectedOwnerUids: { type: [String], default: [] },
        protectedTimUids: { type: [String], default: [] },
    },
    {
        timestamps: { createdAt: false, updatedAt: true },
    }
);

const BotSetting = mongoose.models.BotSetting || mongoose.model("BotSetting", botSettingSchema);

module.exports = {
    BotSetting,
};
