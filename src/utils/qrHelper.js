const { createCanvas, loadImage } = require('@napi-rs/canvas');
const jsQR = require('jsqr');
const https = require('https');
const http = require('http');

async function downloadImageToBuffer(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`Failed to fetch image, status: ${res.statusCode}`));
            }
            const data = [];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => resolve(Buffer.concat(data)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

/**
 * Kiểm tra xem một bức ảnh có chứa mã QR hay không
 * @param {string} imageUrl URL của ảnh
 * @returns {Promise<boolean>} true nếu có mã QR, false nếu không
 */
async function hasQRCode(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') return false;
    
    try {
        const buffer = await downloadImageToBuffer(imageUrl);
        const image = await loadImage(buffer);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, image.width, image.height);
        const imageData = ctx.getImageData(0, 0, image.width, image.height);
        
        // Quét QR
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        return code !== null;
    } catch (err) {
        console.error("Lỗi khi quét QR code:", err.message);
        return false; // Nếu lỗi (VD: URL k hợp lệ), cứ bỏ qua không xoá
    }
}

module.exports = {
    hasQRCode
};
