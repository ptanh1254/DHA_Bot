const mongoose = require("mongoose");

const groupKeyMemberSchema = new mongoose.Schema(
    {
        groupId: { type: String, required: true },
        userId: { type: String, required: true },
        userName: { type: String, default: "" },
        verifiedAt: { type: Date, default: Date.now },
    },
    {
        timestamps: false,
    }
);

groupKeyMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });

const GroupKeyMember =
    mongoose.models.GroupKeyMember ||
    mongoose.model("GroupKeyMember", groupKeyMemberSchema);

module.exports = {
    GroupKeyMember,
};
