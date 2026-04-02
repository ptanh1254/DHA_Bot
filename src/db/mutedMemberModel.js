const mongoose = require("mongoose");

const mutedMemberSchema = new mongoose.Schema(
    {
        groupId: { type: String, required: true },
        userId: { type: String, required: true },
        mutedByUserId: { type: String, default: "" },
        mutedByName: { type: String, default: "" },
        mutedAt: { type: Date, default: Date.now },
        muteUntil: { type: Date, default: null },
        requiresManualUnmute: { type: Boolean, default: false },
        muteSource: { type: String, default: "manual" },
        muteReason: { type: String, default: "" },
        blockedMsgCount: { type: Number, default: 0 },
    },
    {
        timestamps: false,
    }
);

mutedMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });

const MutedMember =
    mongoose.models.MutedMember || mongoose.model("MutedMember", mutedMemberSchema);

module.exports = {
    MutedMember,
};
