/**
 * HƯỚNG DẪN SỬ DỤNG CẤU HÌNH UID ĐẶC BIỆT
 * 
 * Tất cả các UID đặc biệt và màu sắc của chúng được quản lý TẬP TRUNG
 * trong file này: src/design/specialUsersConfig.js
 * 
 * === THÊM UID MỚI ===
 * 
 * 1. Mở file: src/design/specialUsersConfig.js
 * 
 * 2. Thêm entry mới vào object SPECIAL_USERS:
 * 
 *    "8073429320276439081": {
 *        name: "Tên miêu tả",
 *        colors: {
 *            primary: "#821616",      // Màu chính (hex)
 *            secondary: "#1c1a1a",    // Màu phụ (hex)
 *        },
 *        themes: {
 *            userCard: {              // Thẻ thông tin
 *                background: {
 *                    gradient: [
 *                        { stop: 0, color: "#a6251e" },
 *                        { stop: 0.55, color: "#821616" },
 *                        { stop: 1, color: "#5c0f0f" },
 *                    ],
 *                    // ... (xem cấu trúc đầy đủ trong file)
 *                },
 *                // ...
 *            },
 *            checktt: { ... },   // Thẻ check thời tiết
 *            check: { ... },     // Thẻ check info
 *            chatRanking: { ... },  // Bảng xếp hạng chat
 *        },
 *    },
 * 
 * 3. Cấu trúc gradient harmonious với 2 màu:
 *    - Làm nhạt primary color (~+50% lightness) = gradient[0]
 *    - Grade primary color (x0.5 adjustment) = gradient[1]
 *    - Làm tối primary color (~-30% lightness) = gradient[2]
 * 
 *    Công cụ: Dùng https://www.learnui.design/tools/accessible-colors.html
 *    hoặc tính toán màu complement bằng công thức CSS/JS
 * 
 * === SỬA ĐỔI CÓ HIỆU LỰC NGAY ===
 * 
 * Sau khi thêm/sửa UID trong specialUsersConfig.js:
 * - thongtin (userCard) sẽ tự động áp dụng màu mới
 * - checktt sẽ tự động áp dụng màu mới
 * - ranking/xếp hạng sẽ tự động áp dụng màu mới
 * - check command sẽ tự động áp dụng màu mới
 * 
 * === XOÁ UID ===
 * 
 * Chỉ cần xoá entry của UID đó khỏi object SPECIAL_USERS
 * User sẽ quay trở lại theme mặc định
 * 
 * === CÁC FILE LIÊN QUAN (đã được tự động cập nhật) ===
 * 
 * Bạn KHÔNG cần chỉnh sửa những file này, chúng sẽ tự động
 * sử dụng cấu hình từ specialUsersConfig.js:
 * 
 * ✓ src/design/userCard/renderer.js
 * ✓ src/design/userCard/theme.js
 * ✓ src/design/checktt/renderer.js
 * ✓ src/design/check/renderer.js
 * ✓ src/design/chatRanking/renderer.js
 * 
 * === THÔNG TIN CẤU HÌNH UID 8073429320276439081 ===
 * 
 * Tên: Special User 2
 * Màu chính: #821616 (đỏ nâu)
 * Màu phụ: #1c1a1a (đen)
 * 
 * Gradient cho userCard/check:
 *   #a6251e → #821616 → #5c0f0f
 *   (nhạt       gốc      tối)
 * 
 * Background checktt:
 *   Top: #a6251e
 *   Bottom: #821616
 * 
 * Indicator trên ranking: ♦ (viên kim cương)
 */

module.exports = {};
