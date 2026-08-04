const mongoose = require("mongoose");

const botSettingSchema = new mongoose.Schema(
    {
        settingId: { type: String, required: true, unique: true, default: "global" },
        deleteQrEnabled: { type: Boolean, default: true },
    },
    {
        timestamps: { createdAt: false, updatedAt: true },
    }
);

const BotSetting = mongoose.models.BotSetting || mongoose.model("BotSetting", botSettingSchema);

module.exports = {
    BotSetting,
};
