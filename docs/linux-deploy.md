# Linux Deploy Notes (Font + RAM)

## 1) Cài font để không lỗi chữ tiếng Việt

Trên Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y fonts-noto-core fonts-noto-color-emoji fonts-dejavu-core fontconfig
fc-cache -f -v
```

Bot đang dùng stack font Linux-friendly:

- `Noto Sans`
- `Liberation Sans`
- `DejaVu Sans`
- `Noto Color Emoji` (cho emoji)

Sau khi cài, restart bot để Canvas nhận font mới.

Nếu server dùng đường dẫn font khác, có thể set env để bot tự register:

```bash
BOT_FONT_REGULAR=/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf
BOT_FONT_BOLD=/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf
BOT_FONT_EMOJI=/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf
```

## 2) Chạy bot với giới hạn RAM ổn định

Script production:

```bash
npm run start:prod
```

Script này chạy với:

- `--max-old-space-size=384`

Nếu VPS mạnh hơn, có thể nâng lên `512` hoặc `768`.

## 3) Giảm RAM do cache ảnh

Code đã tối ưu:

- Chỉ cache ảnh nền cố định (left/right) cho welcome/kick.
- Không cache avatar động của user (tránh phình RAM theo thời gian).
- Có timeout khi fetch ảnh (mặc định 12s).

Có thể chỉnh timeout bằng env:

```bash
IMAGE_FETCH_TIMEOUT_MS=12000
```

## 4) Gợi ý chạy bằng PM2

```bash
npm i -g pm2
pm2 start npm --name dhabot -- run start:prod
pm2 save
pm2 startup
```
