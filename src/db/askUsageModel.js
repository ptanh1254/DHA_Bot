const mongoose = require("mongoose");

const askUsageSchema = new mongoose.Schema(
    {
        groupId: { type: String, required: true },
        userId: { type: String, required: true },
        dayKey: { type: String, required: true }, // YYYY-MM-DD theo giờ VN
        usageCount: { type: Number, default: 0 },
        lastUsedAt: { type: Date, default: Date.now },
    },
    {
        timestamps: false,
    }
);

askUsageSchema.index({ groupId: 1, userId: 1, dayKey: 1 }, { unique: true });

const AskUsage = mongoose.models.AskUsage || mongoose.model("AskUsage", askUsageSchema);

module.exports = {
    AskUsage,
};
