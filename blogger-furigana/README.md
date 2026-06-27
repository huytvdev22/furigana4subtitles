# Furigana for Blogger

Thư viện JS/CSS nhẹ để tự động thêm **furigana** (ふりがな) cho chữ Kanji trong bài viết trên Blogger.

Dựa trên logic phân tích hình thái tiếng Nhật của dự án [furigana4subtitles](https://github.com/remisimaer/furigana4subtitles), chuyển sang chạy hoàn toàn **client-side** trên trình duyệt.

---

## 🚀 Bắt đầu nhanh

### 1. Thêm vào template Blogger

Mở **Blogger Dashboard** → **Theme** → **Edit HTML**, thêm đoạn sau **trước thẻ `</body>`**:

```html
<!-- Furigana for Blogger - CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/YOUR_GITHUB/furigana4subtitles@main/blogger-furigana/furigana-blogger.css" />

<!-- Dependencies -->
<script src="https://cdn.jsdelivr.net/npm/kuroshiro@1.2.0/dist/kuroshiro.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/kuroshiro-analyzer-kuromoji@1.1.0/dist/kuroshiro-analyzer-kuromoji.min.js"></script>

<!-- Furigana for Blogger - JS -->
<script src="https://cdn.jsdelivr.net/gh/YOUR_GITHUB/furigana4subtitles@main/blogger-furigana/furigana-blogger.js"></script>
```

> ⚠️ Thay `YOUR_GITHUB` bằng username GitHub của bạn.

### 2. Cấu trúc HTML bài viết

Thư viện tự động quét các `<p class="zh">` bên trong `.transcript-content`:

```html
<section class="transcript">
  <h2>📄 トランスクリプト / Transcript</h2>
  <div class="transcript-content">
    <p class="zh">春樹: 皆さん、こんにちは。春樹です。</p>
    <p class="zh">結衣: こんにちは！結衣です。</p>
  </div>
</section>
```

**Kết quả:** Chữ Kanji sẽ tự động có furigana hiển thị phía trên.

---

## ⚙️ Cấu hình

### Cấu hình mặc định

| Thuộc tính | Mặc định | Mô tả |
|---|---|---|
| `selector` | `.transcript-content p.zh` | CSS selector cho elements chứa text Nhật |
| `controlsContainer` | `.transcript` | Container chèn controls |
| `controlsInsertBefore` | `.transcript-content` | Chèn controls trước element này |
| `showToggle` | `true` | Hiển thị nút bật/tắt furigana |
| `showLoading` | `true` | Hiển thị loading indicator |
| `autoInit` | `true` | Tự động chạy khi DOM ready |
| `animateOnLoad` | `true` | Animation khi furigana xuất hiện |
| `dictPath` | CDN UNPKG | Đường dẫn dictionary Kuromoji |
| `toggleLabelOn` | `ふりがな ON` | Label nút khi furigana bật |
| `toggleLabelOff` | `ふりがな OFF` | Label nút khi furigana tắt |

### Tùy chỉnh qua JavaScript

```javascript
// Tắt autoInit và gọi thủ công
FuriganaBlogger.init({
  selector: '.my-japanese-text',
  showToggle: true,
  showLoading: true,
  onComplete: function(success, total) {
    console.log(`Đã xử lý ${success}/${total} đoạn`);
  }
});
```

### Tùy chỉnh qua data attribute

```html
<script src="furigana-blogger.js" 
  data-furigana-config='{"selector": ".jp-text", "showToggle": false}'></script>
```

### Tùy chỉnh CSS

```css
:root {
  --furigana-color: #e74c8b;      /* Màu furigana */
  --furigana-size: 0.5em;         /* Kích thước furigana */
  --furigana-base-size: 1.15em;   /* Kích thước text chính */
  --furigana-line-height: 2.2;    /* Khoảng cách dòng */
}
```

---

## 📖 API

### `FuriganaBlogger.init(config)`
Khởi tạo thư viện với cấu hình tùy chỉnh.

### `FuriganaBlogger.toggle()`
Bật/tắt hiển thị furigana.

### `FuriganaBlogger.reprocess()`
Xử lý lại tất cả elements (dùng khi DOM thay đổi, ví dụ AJAX load thêm nội dung).

### `FuriganaBlogger.processElement(element)`
Xử lý một element cụ thể.

### `FuriganaBlogger.isReady()`
Kiểm tra thư viện đã khởi tạo xong chưa.

---

## 🔧 Troubleshooting

### Furigana không hiển thị

1. **Kiểm tra Console**: Mở DevTools (F12) → Console, tìm lỗi `[Furigana]`
2. **Kiểm tra selector**: Đảm bảo HTML có đúng class `.transcript-content` và `p.zh`
3. **Kiểm tra thứ tự script**: Kuroshiro và KuromojiAnalyzer phải được tải **trước** `furigana-blogger.js`

### Tải chậm lần đầu

Dictionary Kuromoji ~20MB, được tải lần đầu rồi cache. Các lần sau sẽ nhanh hơn.

### Furigana sai cho tên riêng

Đây là hạn chế chung của phân tích hình thái tự động. Tên riêng (人名、地名) đôi khi bị đọc sai. Có thể dùng `<ruby>` thủ công cho các trường hợp đặc biệt:

```html
<p class="zh" data-furigana-processed="true">
  <ruby>春樹<rt>はるき</rt></ruby>: 皆さん、こんにちは。
</p>
```

Thêm `data-furigana-processed="true"` để thư viện bỏ qua element này.

---

## 📝 License

GPL-3.0-or-later (giống dự án gốc furigana4subtitles)
