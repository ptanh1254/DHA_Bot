FROM ghcr.io/railwayapp/nixpacks:ubuntu-latest

# Cài đặt font chữ hỗ trợ tiếng Việt
RUN apt-get update && apt-get install -y \
    fonts-liberation \
    fontconfig \
    bzip2 \
    && apt-get clean

# Lệnh này giúp cập nhật lại cache font
RUN fc-cache -f -v

# Lệnh chạy app của bạn (ví dụ npm start)
CMD ["npm", "start"]
