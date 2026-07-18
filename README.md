# Furigana4Subtitles

Một công cụ mã nguồn mở hữu ích dành cho người học tiếng Nhật khi xem anime/phim có phụ đề tiếng Nhật.

**Furigana4Subtitles** tự động chuyển đổi phụ đề định dạng `.srt` sang định dạng `.ass` với cách đọc Hiragana (ふりがな) được hiển thị căn chỉnh ngay trên đầu chữ Kanji tương ứng.

Dự án hiện tại hỗ trợ cả việc chạy biên dịch cục bộ (Native C) và chạy hoàn toàn trên container thông qua **Docker** (tích hợp sẵn FFmpeg để **burn-in** phụ đề trực tiếp vào video).

![Alt text](furigana4subtitles.png)

---

## 🌟 Các tính năng nổi bật mới nhất

* **Sử dụng Docker tiện lợi:** Chạy trực tiếp trên mọi nền tảng (macOS, Windows, Linux) mà không cần cài đặt các thư viện C phức tạp (như MeCab) trên máy chủ.
* **Tự động Burn-in (Gắn cứng phụ đề):** Tích hợp sẵn công cụ **FFmpeg** bên trong Docker để tự động chuyển đổi và gắn cứng phụ đề Furigana trực tiếp vào video của bạn.
* **Căn chỉnh hoàn hảo trên macOS:** Sử dụng font đơn cách mặc định **`Osaka-Mono`** giúp khắc phục hoàn toàn lỗi lệch chữ Furigana (do sai số tích lũy của font tỷ lệ).
* **Màu sắc hiển thị tối ưu:** Màu chữ phụ đề được thiết lập là **Đen** và viền **Trắng** giúp hiển thị rõ ràng và nổi bật trên mọi cảnh phim.
* **Kích thước chữ lớn & cân đối hơn:** Tăng 20% kích thước chữ (chữ chính 62px, furigana 31px) và dịch chuyển vị trí phụ đề lên trên (baseline Y = 800) giúp dễ đọc hơn.
* **Hỗ trợ Furigana gắn sẵn trong ngoặc vuông:** Bật biến môi trường `USE_BRACKETS=1` để xử lý phụ đề định dạng `Kanji[Furigana]` mà không cần qua thư viện MeCab.
* **GitHub Actions CI/CD:** Tự động build Docker image hỗ trợ Multi-platform (`linux/amd64` và `linux/arm64`) đẩy lên Docker Hub khi cập nhật code.

---

## 🐳 Hướng dẫn sử dụng với Docker (Khuyên dùng)

### 1. Chuẩn bị Docker Image
Bạn có thể tự build image cục bộ từ mã nguồn:
```bash
docker build -t furigana4subtitles .
```
Hoặc tải trực tiếp image đã được build sẵn từ Docker Hub:
```bash
docker pull huy8895/furigana4subtitles:latest
```

### 2. Các chế độ chạy cụ thể

Do Docker chạy trong môi trường cô lập, bạn cần liên kết (mount) thư mục chứa video/phụ đề vào thư mục `/data` của container.

#### Chế độ 1: Chỉ tạo file phụ đề `.ass` (không ghép vào video)
* **macOS / Linux / Windows PowerShell:**
  ```bash
  docker run --rm -v "$(pwd)":/data huy8895/furigana4subtitles /data/subtitle.srt
  ```
* **Windows CMD:**
  ```cmd
  docker run --rm -v "%cd%":/data huy8895/furigana4subtitles /data/subtitle.srt
  ```
*(Kết quả file `subtitle.ass` sẽ được lưu cùng thư mục với file `.srt` gốc).*

#### Chế độ 2: Tạo phụ đề và tự động Burn-in (Gắn cứng) vào video
* **macOS / Linux / Windows PowerShell:**
  ```bash
  docker run --rm -v "$(pwd)":/data huy8895/furigana4subtitles /data/subtitle.srt /data/video.mp4
  ```
* **Windows CMD:**
  ```cmd
  docker run --rm -v "%cd%":/data huy8895/furigana4subtitles /data/subtitle.srt /data/video.mp4
  ```
*(Kết quả file video hardsub `video_furigana.mp4` sẽ được tạo ra tại thư mục hiện tại của bạn).*

#### Chế độ 3: Chỉ định rõ tên file video đầu ra mong muốn
```bash
docker run --rm -v "$(pwd)":/data huy8895/furigana4subtitles /data/subtitle.srt /data/video.mp4 /data/output_hardsub.mp4
```

#### Chế độ 4: Điều chỉnh tốc độ hàng loạt cho các file âm thanh trong thư mục hiện tại
* **macOS / Linux / Windows PowerShell:**
  ```bash
  docker run --rm -v "$(pwd)":/data huy8895/furigana4subtitles speed <tốc_độ> [phần_mở_rộng]
  ```
* **Ví dụ làm chậm tất cả file `.mp3` xuống tốc độ `0.9`:**
  ```bash
  docker run --rm -v "$(pwd)":/data huy8895/furigana4subtitles speed 0.9 mp3
  ```
  *(Các file kết quả sẽ được tạo với hậu tố `_speed0.9.mp3` tại thư mục hiện tại).*

> ⚠️ **Lưu ý quan trọng khi dùng Docker:** Cả file phụ đề `.srt`, file video `.mp4` hoặc các file âm thanh đầu vào phải nằm trong cùng thư mục (hoặc thư mục con) nơi bạn chạy lệnh Terminal để Docker có thể ánh xạ đúng dữ liệu.

#### 3. Chế độ sử dụng Furigana gắn sẵn trong ngoặc vuông (Bracketed Mode)
Nếu tệp phụ đề `.srt` của bạn đã được soạn sẵn cách đọc trong dấu ngoặc vuông dạng `Kanji[Furigana]` (Ví dụ: `漢字[かんじ]` hoặc `食[た]べた`), bạn có thể bật biến môi trường `USE_BRACKETS=1` để bỏ qua việc phân tích tự động bằng MeCab:

* **Sử dụng cục bộ:**
  ```bash
  USE_BRACKETS=1 ./furigana4subtitles subtitle.srt
  ```
* **Sử dụng Docker (Chỉ sinh phụ đề .ass):**
  ```bash
  docker run --rm -e USE_BRACKETS=1 -v "$(pwd)":/data huy8895/furigana4subtitles /data/subtitle.srt
  ```
* **Sử dụng Docker (Sinh phụ đề và gắn cứng (burn-in) vào video):**
  ```bash
  docker run --rm -e USE_BRACKETS=1 -v "$(pwd)":/data huy8895/furigana4subtitles /data/subtitle.srt /data/video.mp4
  ```
Khi bật chế độ này, chương trình sẽ tự động bóc tách các cặp ngoặc vuông, trả lại phụ đề chữ sạch và căn chỉnh chính xác Furigana trên đầu các chữ Kanji tương ứng.

> 💡 **Khuyên dùng (Highly Recommended):** Nên ưu tiên sử dụng chế độ này kết hợp với mô hình AI (ChatGPT, Claude, Gemini...) để xử lý trước tệp `.srt`. Vì AI hiểu rõ ngữ cảnh của cuộc hội thoại, độ chính xác của cách đọc Furigana do AI tạo ra sẽ cao hơn nhiều so với việc phân tích tự động bằng thư viện từ điển MeCab.
>
> Bạn có thể sử dụng Prompt dưới đây để yêu cầu AI gán Furigana cho tệp `.srt`:
>
> ```markdown
> Bạn là một trợ lý AI chuyên về ngôn ngữ tiếng Nhật và dịch thuật phụ đề. 
> 
> Tôi sẽ cung cấp cho bạn một nội dung tệp phụ đề định dạng `.srt` tiếng Nhật. Nhiệm vụ của bạn là thêm cách đọc Hiragana (Furigana) cho tất cả các chữ Kanji xuất hiện trong phần văn bản phụ đề, theo đúng các quy tắc nghiêm ngặt dưới đây:
> 
> ### ⚠️ QUY TẮC BẮT BUỘC KHI ĐẶT NGOẶC VUÔNG FURIGANA:
> 1. Đặt cách đọc Hiragana trong cặp ngoặc vuông `[...]` ngay sau (các) ký tự Kanji được chú thích.
> 2. Dấu ngoặc vuông PHẢI đứng NGAY SAU ký tự Kanji cuối cùng của từ đó. KHÔNG được đặt sau ký tự Kana (Hiragana/Katakana) đi kèm (Okurigana).
>    - Đúng: 食[た]べた (Chữ "食" là Kanji nên ngoặc vuông đặt ngay sau nó).
>    - Sai: 食べた[た] (Đặt sau chữ "べ" là Hiragana là SAI, chương trình sẽ không hiểu).
>    - Đúng: 新[あたら]しい (Ngoặc vuông đặt ngay sau Kanji "新").
>    - Sai: 新しい[あたら] (Đặt sau chữ "し" hoặc "い" là SAI).
> 3. Đối với các cụm Kanji liền nhau (danh từ ghép), có thể gom chung một ngoặc vuông cho cả cụm:
>    - Đúng: 日本語[にほんご]
>    - Đúng: 映画館[えいがかん]
> 4. Đối với các từ có Kanji xen kẽ Kana, hãy đặt ngoặc vuông tương ứng cho từng chữ Kanji đơn lẻ:
>    - Đúng: お見[み]舞[ま]い (Chữ "お" và "い" là Hiragana để bên ngoài, ngoặc vuông đặt ngay sau "見" và "舞").
>    - Sai: お見舞い[みまい] (Đặt ở cuối từ là SAI).
> 
> ### 📋 YÊU CẦU VỀ ĐỊNH DẠNG:
> - Giữ nguyên 100% cấu trúc tệp phụ đề `.srt` (Không thay đổi số thứ tự, mốc thời gian `-->` hay các thẻ định dạng HTML/phụ đề khác nếu có).
> - Chỉ viết cách đọc bằng chữ Hiragana bên trong ngoặc vuông (Không dùng Katakana, không dùng Romaji).
> - Không thêm bất kỳ lời giải thích nào khác ngoài tệp phụ đề kết quả.
> 
> 
> **Đầu vào (Input):**
> [Dán nội dung tệp .srt của bạn vào đây]
> ```

#### 4. Tùy chọn Font chữ khi chạy Docker (Osaka-Mono, MS Gothic, v.v.)
Mặc định, công cụ sử dụng font **`Osaka-Mono`**. Nếu bạn muốn sử dụng các font khác (như **`MS Gothic`**):

1. **Chuẩn bị font:** Bỏ file font bạn muốn dùng (ví dụ: `msgothic.ttc`) vào thư mục `fonts/` ở local (không cần và không nên commit file font này lên GitHub).
2. **Build lại Docker Image:**
   ```bash
   docker build -t furigana4subtitles .
   ```
3. **Chạy Docker với biến môi trường `-e FONT_NAME`:**
   * **Sử dụng font MS Gothic:**
     ```bash
     docker run --rm -e FONT_NAME="MS Gothic" -v "$(pwd)":/data huy8895/furigana4subtitles /data/subtitle.srt /data/video.mp4
     ```
   * **Sử dụng font Osaka-Mono:**
     ```bash
     docker run --rm -e FONT_NAME="Osaka-Mono" -v "$(pwd)":/data huy8895/furigana4subtitles /data/subtitle.srt /data/video.mp4
     ```

---

## 🛠️ Hướng dẫn cài đặt & Biên dịch cục bộ (Không dùng Docker)

### Yêu cầu hệ thống
* **macOS:** Cài đặt font `Osaka-Mono` từ Font Book của hệ thống.
* **GNU/Linux / Windows WSL2:**
  ```bash
  sudo apt update
  sudo apt install build-essential git mecab libmecab-dev mecab-ipadic-utf8
  ```

### Biên dịch mã nguồn
```bash
make
```
Lệnh này sẽ tạo ra 2 chương trình thực thi cục bộ:
* `furigana4subtitles` : Bản chạy dòng lệnh truyền tham số trực tiếp.
* `furigana4subtitles-cli` : Bản chạy giao diện menu tương tác trên Terminal.

### Sử dụng bản cục bộ
* **Chạy bản Command-line:**
  ```bash
  ./furigana4subtitles subtitle.srt
  # Hoặc quét cả thư mục
  ./furigana4subtitles ./subfolder/
  ```
* **Chạy bản tương tác:**
  ```bash
  ./furigana4subtitles-cli
  ```

---

## 📂 Cấu trúc dự án

```
include/                # File tiêu đề (.h)
src/
  ├── utils.c           # Xử lý tệp tin, cấu hình font
  ├── srt.c             # Bộ phân tích phụ đề SRT
  ├── ass.c             # Bộ tạo phụ đề định dạng ASS
  ├── mecab_helpers.c   # Tích hợp MeCab và tính toán vị trí Furigana
  └── cli.c             # Xử lý giao diện CLI tương tác
fonts/
  └── OsakaMono.ttf     # File font monospace dùng cho Docker build
.github/workflows/
  └── docker-publish.yml # Cấu hình tự động build & push Docker Hub
Dockerfile              # Cấu hình đóng gói container
entrypoint.sh           # Script điều phối chính cho Docker
main.c                  # Điểm khởi chạy Command-line
main_cli.c              # Điểm khởi chạy Interactive CLI
Makefile                # Cấu hình biên dịch mã nguồn C
```

---

## 📝 Bản quyền & Giấy phép

Dự án được phân phối dưới giấy phép [GNU General Public License v3.0 hoặc muộn hơn](LICENSE).

## ✍️ Tác giả gốc

Rémi SIMAER - <rsimaer@gmail.com>
