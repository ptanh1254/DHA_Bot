const { createCanvas, loadImage } = require("@napi-rs/canvas");
const path = require("path");
const { PassThrough } = require("stream");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");

// Set ffmpeg path to the static binary
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Generates a lucky wheel video spinning and stopping at the winner.
 * @param {object[]} participants - Array of participants with displayName and avatarUrl
 * @param {number} winnerIndex - Index of the winning name
 * @returns {Promise<string>} - Path to the generated mp4 video
 */
async function createLuckyWheelVideo(participants, winnerIndex) {
    // Decrease FPS and size to make GIF smaller (< 2MB) so Zalo doesn't reject it
    const width = 300;
    const height = 300;
    const fps = 15;
    const duration = 4; // 4 seconds spin
    const pauseDuration = 2.5; // 2.5 seconds pause at the end
    const totalFrames = fps * (duration + pauseDuration);
    const radius = 150; // 300x300 resolution
    const names = participants.map(p => p.displayName);

    // Use a unique output path with .gif extension
    const outputPath = path.join(process.cwd(), `wheel_${Date.now()}_${Math.floor(Math.random() * 1000)}.gif`);
    
    const sliceAngle = (Math.PI * 2) / participants.length;
    const winnerSliceCenter = (winnerIndex * sliceAngle) + (sliceAngle / 2);
    
    // Spin 5 full rounds + the remaining angle to land the winner at 0 rad (right side)
    const spins = 5;
    const targetRotation = (Math.PI * 2 * spins) + (Math.PI * 2 - winnerSliceCenter);
    
    // Preload avatars
    const avatars = await Promise.all(participants.map(async (p) => {
        if (!p.avatarUrl) return null;
        try {
            return await loadImage(p.avatarUrl);
        } catch (e) {
            return null;
        }
    }));

    return new Promise((resolve, reject) => {
        const stream = new PassThrough();
        
        ffmpeg()
            .input(stream)
            .inputFormat("image2pipe")
            .inputFPS(fps)
            .outputOptions([
                "-vf", "split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=single[p];[s1][p]paletteuse=dither=none", // Flat colors, no dither for small file size
                "-loop", "0"
            ])
            .output(outputPath)
            .on("end", () => resolve(outputPath))
            .on("error", (err) => reject(err))
            .run();

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");
        
        let frameCount = 0;

        function processNextFrame() {
            if (frameCount >= totalFrames) {
                stream.end();
                return;
            }

            let t = frameCount / (fps * duration);
            if (t > 1) t = 1;
            // easeOutQuad
            const easeOut = 1 - (1 - t) * (1 - t);
            const currentRotation = targetRotation * easeOut;

            // Flat background for better GIF compression
            ctx.fillStyle = "#1a252f";
            ctx.fillRect(0, 0, width, height);

            // Wheel shadow (simplified or removed for GIF size)
            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            
            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.rotate(currentRotation);

            for (let j = 0; j < participants.length; j++) {
                const start = j * sliceAngle;
                const end = (j + 1) * sliceAngle;

                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, radius, start, end);
                
                // Premium slice colors
                const hue = (j * 360) / participants.length;
                ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
                ctx.fill();
                
                ctx.lineWidth = 3;
                ctx.strokeStyle = "#ffffff";
                ctx.stroke();

                ctx.save();
                const angle = start + (end - start) / 2;
                ctx.rotate(angle);
                
                // Remove text, draw only Avatar
                const avatar = avatars[j];
                const avatarRadius = 40;
                const avatarOffset = radius * 0.65;
                
                if (angle > Math.PI / 2 && angle < 3 * Math.PI / 2) {
                    ctx.rotate(Math.PI);

                    if (avatar) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(-avatarOffset, 0, avatarRadius, 0, Math.PI * 2);
                        ctx.clip();
                        ctx.drawImage(avatar, -avatarOffset - avatarRadius, -avatarRadius, avatarRadius * 2, avatarRadius * 2);
                        ctx.restore();
                        
                        ctx.beginPath();
                        ctx.arc(-avatarOffset, 0, avatarRadius, 0, Math.PI * 2);
                        ctx.lineWidth = 3;
                        ctx.strokeStyle = "#fff";
                        ctx.stroke();
                    }
                } else {
                    if (avatar) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(avatarOffset, 0, avatarRadius, 0, Math.PI * 2);
                        ctx.clip();
                        ctx.drawImage(avatar, avatarOffset - avatarRadius, -avatarRadius, avatarRadius * 2, avatarRadius * 2);
                        ctx.restore();
                        
                        ctx.beginPath();
                        ctx.arc(avatarOffset, 0, avatarRadius, 0, Math.PI * 2);
                        ctx.lineWidth = 3;
                        ctx.strokeStyle = "#fff";
                        ctx.stroke();
                    }
                }
                ctx.restore();
            }
            ctx.restore();

            // Draw center dot/pin with premium gradient
            ctx.save();
            ctx.translate(width / 2, height / 2);
            
            // Outer center circle
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            
            // Inner center gradient
            ctx.beginPath();
            ctx.arc(0, 0, 24, 0, Math.PI * 2);
            const centerGradient = ctx.createLinearGradient(-24, -24, 24, 24);
            centerGradient.addColorStop(0, "#ececec");
            centerGradient.addColorStop(1, "#8e8e8e");
            ctx.fillStyle = centerGradient;
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.restore();
            
            // Pointer (pointing inward on the right side)
            ctx.save();
            ctx.translate(width / 2, height / 2);
            
            // Pointer bounce effect based on slicing
            const pointerAnglePos = (currentRotation % sliceAngle);
            const bounce = Math.abs(Math.sin((pointerAnglePos / sliceAngle) * Math.PI)) * 10; 
            
            ctx.translate(radius + 15 + bounce, 0); 
            ctx.beginPath();
            ctx.moveTo(-35, 0); // Point inward
            ctx.lineTo(15, -20);
            ctx.lineTo(15, 20);
            ctx.closePath();
            
            ctx.fillStyle = "#e74c3c";
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.shadowBlur = 8;
            ctx.fill();
            
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();

            const buffer = canvas.toBuffer("image/jpeg", { quality: 0.8 });
            
            if (!stream.write(buffer)) {
                stream.once("drain", () => {
                    frameCount++;
                    setImmediate(processNextFrame);
                });
            } else {
                frameCount++;
                setImmediate(processNextFrame);
            }
        }

        processNextFrame();
    });
}

module.exports = {
    createLuckyWheelVideo,
};
