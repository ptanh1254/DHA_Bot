function buildHelpMessage(prefix = "!") {
    return [
        "\ud83d\udcd8 H\u01af\u1edaNG D\u1eaaN L\u1ec6NH DHA BOT",
        "",
        "\u2139\ufe0f L\u01b0u \u00fd chung:",
        "- C\u00e1c ch\u1ebf \u0111\u1ed9 `on/off` (\u0060hello\u0060, \u0060kick\u0060) \u00e1p d\u1ee5ng theo t\u1eebng nh\u00f3m hi\u1ec7n t\u1ea1i.",
        "- C\u00e1c l\u1ec7nh c\u1ea7n tag: `checktt`, `thongtin`, `kick`.",
        "",
        "==============================",
        "1) NH\u00d3M CH\u00c0O M\u1eeaNG",
        "==============================",
        `- \`${prefix}hello\``,
        "  Xem tr\u1ea1ng th\u00e1i ch\u00e0o m\u1eebng th\u00e0nh vi\u00ean m\u1edbi trong nh\u00f3m.",
        `- \`${prefix}hello on\``,
        "  B\u1eadt g\u1eedi \u1ea3nh ch\u00e0o m\u1eebng khi c\u00f3 th\u00e0nh vi\u00ean m\u1edbi v\u00e0o.",
        `- \`${prefix}hello off\``,
        "  T\u1eaft \u1ea3nh ch\u00e0o m\u1eebng.",
        "",
        "==============================",
        "2) NH\u00d3M KICK / R\u1edcI NH\u00d3M",
        "==============================",
        `- \`${prefix}kick\``,
        "  Xem tr\u1ea1ng th\u00e1i th\u00f4ng b\u00e1o r\u1eddi nh\u00f3m / b\u1ecb kick.",
        `- \`${prefix}kick on\``,
        "  B\u1eadt th\u00f4ng b\u00e1o r\u1eddi nh\u00f3m / b\u1ecb kick trong nh\u00f3m.",
        `- \`${prefix}kick off\``,
        "  T\u1eaft th\u00f4ng b\u00e1o r\u1eddi nh\u00f3m / b\u1ecb kick.",
        `- \`${prefix}kick @TenNguoiDung\``,
        "  Kick ng\u01b0\u1eddi \u0111\u01b0\u1ee3c tag ra kh\u1ecfi nh\u00f3m (bot c\u00f3 quy\u1ec1n).",
        "",
        "==============================",
        "3) NH\u00d3M TH\u1ed0NG K\u00ca CHAT",
        "==============================",
        `- \`${prefix}xhchat\``,
        "  Xem b\u1ea3ng x\u1ebfp h\u1ea1ng t\u01b0\u01a1ng t\u00e1c (10 ng\u01b0\u1eddi / 1 \u1ea3nh).",
        `- \`${prefix}rschat\``,
        "  Reset \u0111i\u1ec3m chat hi\u1ec7n t\u1ea1i (`msgCount`) v\u1ec1 0 cho c\u1ea3 nh\u00f3m.",
        "  Kh\u00f4ng \u1ea3nh h\u01b0\u1edfng t\u1ed5ng t\u00edch l\u0169y (`totalMsgCount`).",
        "",
        "==============================",
        "4) NH\u00d3M TRA C\u1ee8U TH\u00c0NH VI\u00caN",
        "==============================",
        `- \`${prefix}checktt @TenNguoiDung\``,
        "  Xem card th\u1ed1ng k\u00ea: t\u00ean, avatar, th\u1eddi gian v\u00e0o,",
        "  ng\u01b0\u1eddi th\u00eam/duy\u1ec7t, t\u1ed5ng tin nh\u1eafn t\u00edch l\u0169y.",
        `- \`${prefix}thongtin @TenNguoiDung\``,
        "  Xem card th\u00f4ng tin profile c\u01a1 b\u1ea3n c\u1ee7a ng\u01b0\u1eddi \u0111\u01b0\u1ee3c tag.",
        "",
        "==============================",
        `5) TR\u1ee2 GI\u00daP`,
        "==============================",
        `- \`${prefix}help\``,
        "  M\u1edf l\u1ea1i b\u1ea3ng h\u01b0\u1edbng d\u1eabn n\u00e0y.",
    ].join("\n");
}

async function handleHelpCommand(api, message, threadId, prefix = "!") {
    const msg = buildHelpMessage(prefix);
    await api.sendMessage({ msg }, threadId, message.type);
}

module.exports = {
    handleHelpCommand,
};
