const { createCanvas, loadImage } = require('@napi-rs/canvas');
const jsQR = require('jsqr');
const https = require('https');
const http = require('http');

async function downloadImageToBuffer(url) {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) {
        throw new Error(`Failed to fetch image, status: ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

function scanImageData(imageData) {
    if (!imageData || !imageData.data) return null;
    return jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth",
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
        console.log(`[🔍 QR Scan] Đang tải ảnh từ URL: ${imageUrl.substring(0, 80)}...`);
        const buffer = await downloadImageToBuffer(imageUrl);
        const image = await loadImage(buffer);
        console.log(`[🔍 QR Scan] Đã tải ảnh thành công (${image.width}x${image.height}px)`);

        // 1. Quét ở kích thước gốc
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, image.width, image.height);
        let imageData = ctx.getImageData(0, 0, image.width, image.height);
        
        let code = scanImageData(imageData);
        if (code) {
            console.log(`[✅ QR Scan] Tìm thấy mã QR (gốc): ${code.data}`);
            return true;
        }

        // 2. Nếu ảnh lớn, thử resize xuống tối đa 800px để jsQR dễ nhận diện
        const maxDim = Math.max(image.width, image.height);
        if (maxDim > 800) {
            const scale = 800 / maxDim;
            const targetW = Math.round(image.width * scale);
            const targetH = Math.round(image.height * scale);

            const scaledCanvas = createCanvas(targetW, targetH);
            const scaledCtx = scaledCanvas.getContext('2d');
            scaledCtx.drawImage(image, 0, 0, targetW, targetH);
            let scaledData = scaledCtx.getImageData(0, 0, targetW, targetH);

            code = scanImageData(scaledData);
            if (code) {
                console.log(`[✅ QR Scan] Tìm thấy mã QR (sau khi resize 800px): ${code.data}`);
                return true;
            }
        }

        // 3. Thử thêm scale 500px nếu vẫn chưa ra (dành cho ảnh màn hình điện thoại chụp full HD)
        if (maxDim > 500) {
            const scale = 500 / maxDim;
            const targetW = Math.round(image.width * scale);
            const targetH = Math.round(image.height * scale);

            const scaledCanvas = createCanvas(targetW, targetH);
            const scaledCtx = scaledCanvas.getContext('2d');
            scaledCtx.drawImage(image, 0, 0, targetW, targetH);
            let scaledData = scaledCtx.getImageData(0, 0, targetW, targetH);

            code = scanImageData(scaledData);
            if (code) {
                console.log(`[✅ QR Scan] Tìm thấy mã QR (sau khi resize 500px): ${code.data}`);
                return true;
            }
        }

        console.log(`[❌ QR Scan] Không phát hiện mã QR trong ảnh`);
        return false;
    } catch (err) {
        console.error("Lỗi khi quét QR code:", err.message);
        return false; // Nếu lỗi, bỏ qua không xoá
    }
}

module.exports = {
    hasQRCode
};
