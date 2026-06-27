/**
 * ============================================================
 * Furigana for Blogger — JavaScript
 * Tự động thêm furigana (ふりがな) cho chữ Kanji trong blog
 * Dựa trên logic của dự án furigana4subtitles (C/MeCab)
 * 
 * Sử dụng: Kuroshiro + Kuromoji.js (client-side)
 * ============================================================
 */

(function () {
  'use strict';

  // Tránh chạy trùng lặp khi script bị chèn nhiều lần trên Blogger (Ví dụ: ở cả theme và trong bài viết)
  if (window.__FuriganaBloggerLoaded) {
    console.log('[Furigana] Thư viện đã được tải trước đó. Bỏ qua chạy lại.');
    return;
  }
  window.__FuriganaBloggerLoaded = true;

  /* ── Default Configuration ── */
  const DEFAULT_CONFIG = {
    // CSS selector cho các element chứa text tiếng Nhật cần thêm furigana
    selector: '.transcript-content p.zh',

    // Container để chèn controls (toggle, loading)
    controlsContainer: '.transcript',

    // Element chèn controls trước nó (thường là .transcript-content)
    controlsInsertBefore: '.transcript-content',

    // Nơi thêm class toggle (furigana-visible / furigana-hidden)
    toggleTarget: 'body',

    // Hiển thị nút bật/tắt furigana
    showToggle: true,

    // Hiển thị loading indicator
    showLoading: true,

    // Tự động chạy khi DOM ready
    autoInit: true,

    // Dict path cho Kuromoji (Dùng UNPKG chạy qua Cloudflare để tăng tốc tại Việt Nam, tránh bị nghẽn như jsDelivr)
    dictPath: 'https://unpkg.com/kuromoji@0.1.2/dict/',

    // Label cho nút toggle
    toggleLabelOn: 'ふりがな ON',
    toggleLabelOff: 'ふりがな OFF',

    // Bật animation stagger khi furigana xuất hiện
    animateOnLoad: true,

    // Callback sau khi hoàn thành
    onComplete: null,
    onError: null,
  };

  /* ── State ── */
  let config = { ...DEFAULT_CONFIG };
  let kuroshiroInstance = null;
  let isInitialized = false;
  let isFuriganaVisible = true;
  let processedCount = 0;
  let totalCount = 0;

  /* ── DOM Helpers ── */

  /**
   * Tạo element HTML từ template string
   */
  function createElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
  }

  /**
   * Tạo loading indicator UI
   */
  function createLoadingUI() {
    return createElement(`
      <div class="furigana-loading" id="furigana-loading">
        <div class="furigana-spinner"></div>
        <div class="furigana-loading-text">
          <strong>ふりがな</strong> — Đang tải bộ phân tích tiếng Nhật...
        </div>
      </div>
    `);
  }

  /**
   * Tạo error UI
   */
  function createErrorUI(message) {
    return createElement(`
      <div class="furigana-error" id="furigana-error">
        <span class="furigana-error-icon">⚠️</span>
        <span>${message}</span>
      </div>
    `);
  }

  /**
   * Tạo controls UI (toggle button + status badge)
   */
  function createControlsUI() {
    return createElement(`
      <div class="furigana-controls" id="furigana-controls" style="display:none;">
        <button class="furigana-toggle-btn" id="furigana-toggle" data-state="on" title="Bật/tắt hiển thị furigana">
          <span class="furigana-toggle-icon">あ</span>
          <span class="furigana-toggle-label">${config.toggleLabelOn}</span>
        </button>
        <span class="furigana-status" id="furigana-status">
          <span class="furigana-status-dot"></span>
          <span id="furigana-status-text">Đã thêm furigana</span>
        </span>
      </div>
    `);
  }

  /**
   * Cập nhật loading text
   */
  function updateLoadingText(text) {
    const el = document.getElementById('furigana-loading');
    if (el) {
      const textEl = el.querySelector('.furigana-loading-text');
      if (textEl) {
        textEl.innerHTML = `<strong>ふりがな</strong> — ${text}`;
      }
    }
  }

  /**
   * Ẩn loading indicator
   */
  function hideLoading() {
    const el = document.getElementById('furigana-loading');
    if (el) {
      el.classList.add('furigana-loading-hidden');
    }
  }

  /**
   * Hiện controls
   */
  function showControls() {
    const el = document.getElementById('furigana-controls');
    if (el) {
      el.style.display = '';
    }
    // Hiện status badge với delay
    setTimeout(function () {
      const status = document.getElementById('furigana-status');
      if (status) {
        status.classList.add('visible');
      }
    }, 300);
  }

  /**
   * Hiện error
   */
  function showError(message) {
    hideLoading();
    const container = document.querySelector(config.controlsContainer);
    const insertBefore = document.querySelector(config.controlsInsertBefore);
    if (container && insertBefore) {
      container.insertBefore(createErrorUI(message), insertBefore);
    }
    if (typeof config.onError === 'function') {
      config.onError(message);
    }
  }

  /* ── Toggle Logic ── */

  function toggleFurigana() {
    isFuriganaVisible = !isFuriganaVisible;

    const target = document.querySelector(config.toggleTarget) || document.body;
    const btn = document.getElementById('furigana-toggle');

    if (isFuriganaVisible) {
      target.classList.remove('furigana-hidden');
      target.classList.add('furigana-visible');
      if (btn) {
        btn.setAttribute('data-state', 'on');
        btn.querySelector('.furigana-toggle-label').textContent = config.toggleLabelOn;
      }
    } else {
      target.classList.remove('furigana-visible');
      target.classList.add('furigana-hidden');
      if (btn) {
        btn.setAttribute('data-state', 'off');
        btn.querySelector('.furigana-toggle-label').textContent = config.toggleLabelOff;
      }
    }
  }

  /* ── Core: Kuroshiro Initialization ── */

  /**
   * Resolve constructor từ CDN export.
   * CDN builds thường export dạng { default: Constructor } thay vì Constructor trực tiếp.
   */
  function resolveConstructor(obj) {
    if (typeof obj === 'function') return obj;
    if (obj && typeof obj.default === 'function') return obj.default;
    if (obj && typeof obj === 'object') {
      // Tìm key đầu tiên là function (fallback)
      for (var key in obj) {
        if (obj.hasOwnProperty(key) && typeof obj[key] === 'function') {
          return obj[key];
        }
      }
    }
    return null;
  }

  /**
   * Tải và khởi tạo Kuroshiro + Kuromoji Analyzer
   */
  async function initKuroshiro() {
    if (isInitialized && kuroshiroInstance) {
      return kuroshiroInstance;
    }

    // Kiểm tra dependencies
    if (typeof Kuroshiro === 'undefined') {
      throw new Error('Kuroshiro chưa được tải. Hãy thêm script kuroshiro.min.js trước.');
    }
    if (typeof KuromojiAnalyzer === 'undefined') {
      throw new Error('KuromojiAnalyzer chưa được tải. Hãy thêm script kuroshiro-analyzer-kuromoji.min.js trước.');
    }

    // Resolve constructors (CDN export dạng { default: Class })
    var KuroshiroClass = resolveConstructor(Kuroshiro);
    var AnalyzerClass = resolveConstructor(KuromojiAnalyzer);

    if (!KuroshiroClass) {
      throw new Error('Không tìm thấy Kuroshiro constructor. Kiểm tra lại phiên bản CDN.');
    }
    if (!AnalyzerClass) {
      throw new Error('Không tìm thấy KuromojiAnalyzer constructor. Kiểm tra lại phiên bản CDN.');
    }

    updateLoadingText('Đang khởi tạo bộ phân tích hình thái...');

    kuroshiroInstance = new KuroshiroClass();

    await kuroshiroInstance.init(
      new AnalyzerClass({
        dictPath: config.dictPath,
      })
    );

    isInitialized = true;
    return kuroshiroInstance;
  }

  /* ── Core: Text Processing ── */

  /**
   * Kiểm tra text có chứa Kanji không
   * Tương tự hàm is_kanji() trong utils.c của codebase gốc
   */
  function containsKanji(text) {
    // CJK Unified Ideographs: U+4E00 - U+9FAF
    // CJK Extension A: U+3400 - U+4DBF
    // Ideographic iteration marks: U+3005 - U+3007
    return /[\u4E00-\u9FAF\u3400-\u4DBF\u3005-\u3007]/.test(text);
  }

  /**
   * Xử lý một element: convert text thành HTML với ruby annotations
   * Logic tương tự analyze_text_with_mecab() trong mecab_helpers.c
   */
  async function processElement(element) {
    const originalText = element.textContent;

    // Bỏ qua nếu không chứa Kanji
    if (!containsKanji(originalText)) {
      return false;
    }

    // Bỏ qua nếu đã xử lý
    if (element.getAttribute('data-furigana-processed') === 'true') {
      return false;
    }

    try {
      // Xử lý từng text node riêng biệt để giữ nguyên cấu trúc
      // Nhưng trong trường hợp đơn giản (chỉ text), convert toàn bộ
      const html = await kuroshiroInstance.convert(originalText, {
        to: 'hiragana',
        mode: 'furigana',
      });

      element.innerHTML = html;
      element.setAttribute('data-furigana-processed', 'true');
      return true;
    } catch (err) {
      console.warn('[Furigana] Lỗi khi xử lý element:', err, element);
      return false;
    }
  }

  /**
   * Quét và xử lý tất cả elements khớp selector
   */
  async function processAllElements() {
    const elements = document.querySelectorAll(config.selector);
    totalCount = elements.length;
    processedCount = 0;

    if (totalCount === 0) {
      updateLoadingText('Không tìm thấy nội dung tiếng Nhật để xử lý.');
      return;
    }

    updateLoadingText(`Đang thêm furigana cho ${totalCount} đoạn văn...`);

    let successCount = 0;

    for (let i = 0; i < elements.length; i++) {
      const success = await processElement(elements[i]);
      if (success) successCount++;
      processedCount = i + 1;

      // Cập nhật progress mỗi 5 elements
      if (processedCount % 5 === 0 || processedCount === totalCount) {
        updateLoadingText(
          `Đang xử lý... ${processedCount}/${totalCount} đoạn văn`
        );
      }
    }

    // Cập nhật status
    const statusText = document.getElementById('furigana-status-text');
    if (statusText) {
      statusText.textContent = `Đã thêm furigana cho ${successCount}/${totalCount} đoạn`;
    }

    return successCount;
  }

  /* ── Main Initialization ── */

  /**
   * Khởi chạy toàn bộ quy trình
   */
  async function init(userConfig) {
    // Merge user config
    if (userConfig) {
      config = { ...DEFAULT_CONFIG, ...userConfig };
    }

    // Chèn UI vào DOM
    const container = document.querySelector(config.controlsContainer);
    const insertBefore = document.querySelector(config.controlsInsertBefore);

    if (container && insertBefore) {
      // Loading indicator
      if (config.showLoading) {
        container.insertBefore(createLoadingUI(), insertBefore);
      }

      // Controls (toggle + status) — ẩn cho đến khi xong
      if (config.showToggle) {
        container.insertBefore(createControlsUI(), insertBefore);
      }
    }

    try {
      // Khởi tạo Kuroshiro
      await initKuroshiro();

      updateLoadingText('Bộ phân tích sẵn sàng! Đang xử lý văn bản...');

      // Xử lý tất cả elements
      const successCount = await processAllElements();

      // Ẩn loading, hiện controls
      hideLoading();

      if (config.showToggle && successCount > 0) {
        showControls();

        // Bind toggle event
        const toggleBtn = document.getElementById('furigana-toggle');
        if (toggleBtn) {
          toggleBtn.addEventListener('click', toggleFurigana);
        }
      }

      // Thêm class animate
      if (config.animateOnLoad) {
        const target = document.querySelector(config.toggleTarget) || document.body;
        target.classList.add('furigana-animate', 'furigana-visible');

        // Xóa class animate sau khi animation hoàn tất
        setTimeout(function () {
          target.classList.remove('furigana-animate');
        }, 1500);
      }

      // Callback
      if (typeof config.onComplete === 'function') {
        config.onComplete(successCount, totalCount);
      }

      console.log(
        `[Furigana] ✅ Hoàn thành! Đã xử lý ${successCount}/${totalCount} đoạn văn.`
      );
    } catch (err) {
      console.error('[Furigana] ❌ Lỗi:', err);
      showError(
        `Không thể tải furigana: ${err.message}. Vui lòng tải lại trang.`
      );
    }
  }

  /* ── Public API ── */

  /**
   * API công khai cho người dùng
   * 
   * Sử dụng:
   *   FuriganaBlogger.init({ selector: '.my-class' });
   *   FuriganaBlogger.toggle();
   *   FuriganaBlogger.reprocess();
   */
  window.FuriganaBlogger = {
    /**
     * Khởi tạo thư viện với cấu hình tùy chỉnh
     * @param {Object} userConfig - Cấu hình tùy chỉnh
     */
    init: init,

    /**
     * Bật/tắt hiển thị furigana
     */
    toggle: toggleFurigana,

    /**
     * Xử lý lại tất cả elements (dùng khi DOM thay đổi)
     */
    reprocess: async function () {
      if (!isInitialized) {
        console.warn('[Furigana] Chưa khởi tạo. Hãy gọi init() trước.');
        return;
      }

      // Reset processed flag
      document.querySelectorAll('[data-furigana-processed]').forEach(function (el) {
        el.removeAttribute('data-furigana-processed');
      });

      return await processAllElements();
    },

    /**
     * Xử lý một element cụ thể
     * @param {HTMLElement} element - Element cần xử lý
     */
    processElement: async function (element) {
      if (!isInitialized) {
        console.warn('[Furigana] Chưa khởi tạo. Hãy gọi init() trước.');
        return;
      }
      return await processElement(element);
    },

    /**
     * Kiểm tra trạng thái
     */
    isReady: function () {
      return isInitialized;
    },

    /**
     * Lấy version
     */
    version: '1.0.0',
  };

  /* ── Auto Init ── */

  // Tự động chạy khi DOM ready (nếu autoInit = true)
  if (DEFAULT_CONFIG.autoInit) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        // Kiểm tra xem có data attribute config không
        var scriptTag = document.querySelector('script[data-furigana-config]');
        var userCfg = null;
        if (scriptTag) {
          try {
            userCfg = JSON.parse(scriptTag.getAttribute('data-furigana-config'));
          } catch (e) {
            console.warn('[Furigana] Config không hợp lệ:', e);
          }
        }
        init(userCfg);
      });
    } else {
      // DOM đã sẵn sàng
      var scriptTag = document.querySelector('script[data-furigana-config]');
      var userCfg = null;
      if (scriptTag) {
        try {
          userCfg = JSON.parse(scriptTag.getAttribute('data-furigana-config'));
        } catch (e) {
          console.warn('[Furigana] Config không hợp lệ:', e);
        }
      }
      init(userCfg);
    }
  }
})();
