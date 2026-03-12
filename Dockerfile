# Sử dụng image Node.js chính thức
FROM node:18-bullseye

# Cài đặt font tiếng Việt (fonts-noto-cjk) và các thư viện cần thiết
RUN apt-get update && apt-get install -y \
    fonts-noto-cjk \
    fontconfig \
    bzip2 \
    && apt-get clean

# Cập nhật cache font cho hệ thống
RUN fc-cache -f -v

# Thiết lập thư mục làm việc
WORKDIR /app

# Cài đặt thư viện
COPY package*.json ./
RUN npm install

# Copy toàn bộ code vào
COPY . .

# Chạy bot
CMD ["npm", "start"]
