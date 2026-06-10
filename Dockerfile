FROM ubuntu:22.04

# Tránh các câu hỏi tương tác trong quá trình cài đặt package
ENV DEBIAN_FRONTEND=noninteractive

# Cài đặt các gói phụ thuộc cần thiết, ffmpeg, curl và fontconfig
RUN apt-get update && apt-get install -y \
    build-essential \
    mecab \
    libmecab-dev \
    mecab-ipadic-utf8 \
    locales \
    ffmpeg \
    curl \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt locale ja_JP.UTF-8 (cần thiết cho xử lý tiếng Nhật UTF-8)
RUN locale-gen ja_JP.UTF-8
ENV LANG ja_JP.UTF-8
ENV LANGUAGE ja_JP:ja
ENV LC_ALL ja_JP.UTF-8

# Tạo thư mục font và sao chép toàn bộ font từ thư mục fonts local
RUN mkdir -p /usr/share/fonts/truetype/custom
COPY fonts/ /usr/share/fonts/truetype/custom/
RUN fc-cache -f -v

WORKDIR /app

# Sao chép toàn bộ mã nguồn vào container
COPY . .

# Biên dịch chương trình C
RUN make clean && make

# Cấp quyền thực thi cho file entrypoint.sh
RUN chmod +x entrypoint.sh

# Điểm chạy mặc định của container sẽ là script entrypoint
ENTRYPOINT ["./entrypoint.sh"]
