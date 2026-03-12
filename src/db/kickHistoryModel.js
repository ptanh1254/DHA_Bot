const mongoose = require("mongoose");

const kickHistorySchema = new mongoose.Schema(
    {
        groupId: { type: String, required: true },
        userId: { type: String, required: true },
        kickCount: { type: Number, default: 0 },

        firstKickedByUserId: { type: String, default: "" },
        firstKickedByName: { type: String, default: "" },
        firstKnownName: { type: String, default: "" },
        firstKickAt: { type: Date, default: null },

        lastKickedByUserId: { type: String, default: "" },
        lastKickedByName: { type: String, default: "" },
        lastKnownName: { type: String, default: "" },
        lastKickAt: { type: Date, default: null },
    },
    {
        timestamps: false,
    }
);

kickHistorySchema.index({ groupId: 1, userId: 1 }, { unique: true });

const KickHistory =
    mongoose.models.KickHistory || mongoose.model("KickHistory", kickHistorySchema);

module.exports = {
    KickHistory,
};
