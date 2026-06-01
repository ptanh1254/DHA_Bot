const fs = require("fs");
const path = require("path");
const { loadImage } = require("@napi-rs/canvas");

async function imageMetadataGetter(filePath) {
    try {
        const resolvedPath = path.resolve(filePath);
        const fileBuffer = await fs.promises.readFile(resolvedPath);
        const [stats, image] = await Promise.all([
            fs.promises.stat(resolvedPath),
            loadImage(fileBuffer),
        ]);

        const width = Math.round(Number(image.width) || 0);
        const height = Math.round(Number(image.height) || 0);
        if (!width || !height) return null;

        return {
            width,
            height,
            size: stats.size,
        };
    } catch (_) {
        return null;
    }
}

module.exports = {
    imageMetadataGetter,
};
