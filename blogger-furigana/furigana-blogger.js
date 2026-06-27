/**
 * ============================================================
 * Furigana for Blogger — JavaScript (Web Worker Edition)
 * Tự động thêm furigana (ふりがな) cho chữ Kanji trong blog
 * Dựa trên logic của dự án furigana4subtitles (C/MeCab)
 *
 * Giải pháp: Chạy Kuroshiro + Kuromoji hoàn toàn trên Web Worker
 * để tránh khóa Main Thread gây treo trình duyệt trên Blogger.
 * ============================================================
 */

(function () {
  'use strict';

  // Tránh chạy trùng lặp khi script bị chèn nhiều lần trên Blogger
  if (window.__FuriganaBloggerLoaded) {
    console.log('[Furigana] Thư viện đã được tải trước đó. Bỏ qua chạy lại.');
    return;
  }
  window.__FuriganaBloggerLoaded = true;

  /* ── Default Configuration ── */
  var DEFAULT_CONFIG = {
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

    // CDN URLs cho Kuroshiro và KuromojiAnalyzer (Worker sẽ tải chúng nội bộ)
    kuroshiroUrl: 'https://cdn.jsdelivr.net/npm/kuroshiro@1.2.0/dist/kuroshiro.min.js',
    analyzerUrl: 'https://cdn.jsdelivr.net/npm/kuroshiro-analyzer-kuromoji@1.1.0/dist/kuroshiro-analyzer-kuromoji.min.js',

    // Dict path cho Kuromoji (UNPKG chạy qua Cloudflare, tốc độ cao tại VN)
    dictPath: 'https://unpkg.com/kuromoji@0.1.2/dict/',

    // Label cho nút toggle
    toggleLabelOn: 'ふりがな ON',
    toggleLabelOff: 'ふりがな OFF',

    // Bật animation stagger khi furigana xuất hiện
    animateOnLoad: true,

    // Timeout (ms) cho quá trình khởi tạo Worker + từ điển
    initTimeout: 30000,

    // Callback sau khi hoàn thành
    onComplete: null,
    onError: null,
  };

  /* ── State ── */
  var config = {};
  for (var k in DEFAULT_CONFIG) config[k] = DEFAULT_CONFIG[k];
  var worker = null;
  var isInitialized = false;
  var isFuriganaVisible = true;
  var pendingCallbacks = {};
  var callbackId = 0;

  /* ── DOM Helpers ── */

  function createElement(html) {
    var template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
  }

  function createLoadingUI() {
    return createElement(
      '<div class="furigana-loading" id="furigana-loading">' +
        '<div class="furigana-spinner"></div>' +
        '<div class="furigana-loading-text">' +
          '<strong>ふりがな</strong> — Đang tải bộ phân tích tiếng Nhật...' +
        '</div>' +
      '</div>'
    );
  }

  function createErrorUI(message) {
    return createElement(
      '<div class="furigana-error" id="furigana-error">' +
        '<span class="furigana-error-icon">⚠️</span>' +
        '<span>' + message + '</span>' +
      '</div>'
    );
  }

  function createControlsUI() {
    return createElement(
      '<div class="furigana-controls" id="furigana-controls" style="display:none;">' +
        '<button class="furigana-toggle-btn" id="furigana-toggle" data-state="on" title="Bật/tắt hiển thị furigana">' +
          '<span class="furigana-toggle-icon">あ</span>' +
          '<span class="furigana-toggle-label">' + config.toggleLabelOn + '</span>' +
        '</button>' +
        '<span class="furigana-status" id="furigana-status">' +
          '<span class="furigana-status-dot"></span>' +
          '<span id="furigana-status-text">Đã thêm furigana</span>' +
        '</span>' +
      '</div>'
    );
  }

  function updateLoadingText(text) {
    var el = document.getElementById('furigana-loading');
    if (el) {
      var textEl = el.querySelector('.furigana-loading-text');
      if (textEl) {
        textEl.innerHTML = '<strong>ふりがな</strong> — ' + text;
      }
    }
  }

  function hideLoading() {
    var el = document.getElementById('furigana-loading');
    if (el) el.classList.add('furigana-loading-hidden');
  }

  function showControls() {
    var el = document.getElementById('furigana-controls');
    if (el) el.style.display = '';
    setTimeout(function () {
      var status = document.getElementById('furigana-status');
      if (status) status.classList.add('visible');
    }, 300);
  }

  function showError(message) {
    hideLoading();
    var container = document.querySelector(config.controlsContainer);
    var insertBefore = document.querySelector(config.controlsInsertBefore);
    if (container && insertBefore) {
      container.insertBefore(createErrorUI(message), insertBefore);
    }
    if (typeof config.onError === 'function') config.onError(message);
  }

  /* ── Toggle Logic ── */

  function toggleFurigana() {
    isFuriganaVisible = !isFuriganaVisible;
    var target = document.querySelector(config.toggleTarget) || document.body;
    var btn = document.getElementById('furigana-toggle');

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

  /* ── Web Worker: Tạo và quản lý Worker chạy Kuroshiro ── */

  /**
   * Tạo mã nguồn Worker dưới dạng chuỗi.
   * Worker sẽ tự tải Kuroshiro + KuromojiAnalyzer qua importScripts()
   * và xử lý phân tích hình thái hoàn toàn trên luồng nền.
   */
  function buildWorkerSource() {
    return [
      '/* Furigana Worker */',
      'var kuroshiro = null;',
      'var initialized = false;',
      '',
      'function resolveConstructor(obj) {',
      '  if (typeof obj === "function") return obj;',
      '  if (obj && typeof obj.default === "function") return obj.default;',
      '  if (obj && typeof obj === "object") {',
      '    for (var key in obj) {',
      '      if (obj.hasOwnProperty(key) && typeof obj[key] === "function") return obj[key];',
      '    }',
      '  }',
      '  return null;',
      '}',
      '',
      'self.onmessage = function(e) {',
      '  var data = e.data;',
      '',
      '  if (data.type === "init") {',
      '    try {',
      '      importScripts(data.kuroshiroUrl);',
      '      importScripts(data.analyzerUrl);',
      '    } catch (err) {',
      '      self.postMessage({ type: "init_error", error: "Không thể tải thư viện từ CDN: " + err.message });',
      '      return;',
      '    }',
      '',
      '    var KuroshiroClass = resolveConstructor(self.Kuroshiro || Kuroshiro);',
      '    var AnalyzerClass = resolveConstructor(self.KuromojiAnalyzer || KuromojiAnalyzer);',
      '',
      '    if (!KuroshiroClass || !AnalyzerClass) {',
      '      self.postMessage({ type: "init_error", error: "Không tìm thấy Kuroshiro/KuromojiAnalyzer constructor." });',
      '      return;',
      '    }',
      '',
      '    kuroshiro = new KuroshiroClass();',
      '    kuroshiro.init(new AnalyzerClass({ dictPath: data.dictPath }))',
      '      .then(function() {',
      '        initialized = true;',
      '        self.postMessage({ type: "init_done" });',
      '      })',
      '      .catch(function(err) {',
      '        self.postMessage({ type: "init_error", error: "Lỗi khởi tạo từ điển: " + err.message });',
      '      });',
      '  }',
      '',
      '  if (data.type === "convert") {',
      '    if (!initialized || !kuroshiro) {',
      '      self.postMessage({ type: "convert_result", id: data.id, error: "Chưa khởi tạo xong." });',
      '      return;',
      '    }',
      '    kuroshiro.convert(data.text, { to: "hiragana", mode: "furigana" })',
      '      .then(function(html) {',
      '        self.postMessage({ type: "convert_result", id: data.id, html: html });',
      '      })',
      '      .catch(function(err) {',
      '        self.postMessage({ type: "convert_result", id: data.id, error: err.message });',
      '      });',
      '  }',
      '};'
    ].join('\n');
  }

  /**
   * Khởi tạo Web Worker từ Blob URL
   */
  function createWorker() {
    var source = buildWorkerSource();
    var blob = new Blob([source], { type: 'application/javascript' });
    var url = URL.createObjectURL(blob);
    var w = new Worker(url);
    URL.revokeObjectURL(url);
    return w;
  }

  /**
   * Gửi lệnh khởi tạo tới Worker và chờ kết quả với timeout
   */
  function initWorker() {
    return new Promise(function (resolve, reject) {
      worker = createWorker();

      var timeoutId = setTimeout(function () {
        reject(new Error(
          'Quá thời gian khởi tạo (' + (config.initTimeout / 1000) + 's). ' +
          'Kiểm tra kết nối mạng hoặc tắt Adblock rồi tải lại trang.'
        ));
      }, config.initTimeout);

      worker.onmessage = function (e) {
        var data = e.data;

        if (data.type === 'init_done') {
          clearTimeout(timeoutId);
          isInitialized = true;
          resolve();
        }

        if (data.type === 'init_error') {
          clearTimeout(timeoutId);
          reject(new Error(data.error));
        }

        if (data.type === 'convert_result') {
          var cb = pendingCallbacks[data.id];
          if (cb) {
            delete pendingCallbacks[data.id];
            if (data.error) {
              cb.reject(new Error(data.error));
            } else {
              cb.resolve(data.html);
            }
          }
        }
      };

      worker.onerror = function (e) {
        clearTimeout(timeoutId);
        reject(new Error('Worker lỗi: ' + (e.message || 'Unknown error')));
      };

      // Gửi lệnh init tới Worker, kèm theo URLs và dictPath
      worker.postMessage({
        type: 'init',
        kuroshiroUrl: config.kuroshiroUrl,
        analyzerUrl: config.analyzerUrl,
        dictPath: config.dictPath,
      });
    });
  }

  /**
   * Gửi text tới Worker để convert, trả về Promise<HTML>
   */
  function convertText(text) {
    return new Promise(function (resolve, reject) {
      var id = ++callbackId;
      pendingCallbacks[id] = { resolve: resolve, reject: reject };
      worker.postMessage({ type: 'convert', id: id, text: text });
    });
  }

  /* ── Core: Text Processing ── */

  function containsKanji(text) {
    return /[\u4E00-\u9FAF\u3400-\u4DBF\u3005-\u3007]/.test(text);
  }

  function processElement(element) {
    var originalText = element.textContent;

    if (!containsKanji(originalText)) return Promise.resolve(false);
    if (element.getAttribute('data-furigana-processed') === 'true') return Promise.resolve(false);

    return convertText(originalText)
      .then(function (html) {
        element.innerHTML = html;
        element.setAttribute('data-furigana-processed', 'true');
        return true;
      })
      .catch(function (err) {
        console.warn('[Furigana] Lỗi khi xử lý element:', err, element);
        return false;
      });
  }

  function processAllElements() {
    var elements = document.querySelectorAll(config.selector);
    var totalCount = elements.length;

    if (totalCount === 0) {
      updateLoadingText('Không tìm thấy nội dung tiếng Nhật để xử lý.');
      return Promise.resolve(0);
    }

    updateLoadingText('Đang thêm furigana cho ' + totalCount + ' đoạn văn...');

    var successCount = 0;
    var processedCount = 0;

    // Xử lý tuần tự từng element (tránh gửi quá nhiều message cùng lúc)
    var chain = Promise.resolve();
    for (var i = 0; i < elements.length; i++) {
      (function (idx) {
        chain = chain.then(function () {
          return processElement(elements[idx]).then(function (success) {
            if (success) successCount++;
            processedCount++;
            if (processedCount % 5 === 0 || processedCount === totalCount) {
              updateLoadingText('Đang xử lý... ' + processedCount + '/' + totalCount + ' đoạn văn');
            }
          });
        });
      })(i);
    }

    return chain.then(function () {
      var statusText = document.getElementById('furigana-status-text');
      if (statusText) {
        statusText.textContent = 'Đã thêm furigana cho ' + successCount + '/' + totalCount + ' đoạn';
      }
      return successCount;
    });
  }

  /* ── Main Initialization ── */

  function init(userConfig) {
    if (userConfig) {
      for (var key in userConfig) {
        if (userConfig.hasOwnProperty(key)) config[key] = userConfig[key];
      }
    }

    // Chèn UI vào DOM
    var container = document.querySelector(config.controlsContainer);
    var insertBefore = document.querySelector(config.controlsInsertBefore);

    if (container && insertBefore) {
      if (config.showLoading) {
        container.insertBefore(createLoadingUI(), insertBefore);
      }
      if (config.showToggle) {
        container.insertBefore(createControlsUI(), insertBefore);
      }
    }

    updateLoadingText('Đang khởi tạo bộ phân tích hình thái (Web Worker)...');

    // Khởi tạo Worker (tất cả xử lý nặng chạy trên luồng nền)
    initWorker()
      .then(function () {
        updateLoadingText('Bộ phân tích sẵn sàng! Đang xử lý văn bản...');
        return processAllElements();
      })
      .then(function (successCount) {
        hideLoading();
        var totalCount = document.querySelectorAll(config.selector).length;

        if (config.showToggle && successCount > 0) {
          showControls();
          var toggleBtn = document.getElementById('furigana-toggle');
          if (toggleBtn) toggleBtn.addEventListener('click', toggleFurigana);
        }

        if (config.animateOnLoad) {
          var target = document.querySelector(config.toggleTarget) || document.body;
          target.classList.add('furigana-animate', 'furigana-visible');
          setTimeout(function () {
            target.classList.remove('furigana-animate');
          }, 1500);
        }

        if (typeof config.onComplete === 'function') {
          config.onComplete(successCount, totalCount);
        }

        console.log('[Furigana] ✅ Hoàn thành! Đã xử lý ' + successCount + '/' + totalCount + ' đoạn văn.');
      })
      .catch(function (err) {
        console.error('[Furigana] ❌ Lỗi:', err);
        showError('Không thể tải furigana: ' + err.message + '. Vui lòng tải lại trang.');
      });
  }

  /* ── Public API ── */

  window.FuriganaBlogger = {
    init: init,
    toggle: toggleFurigana,

    reprocess: function () {
      if (!isInitialized) {
        console.warn('[Furigana] Chưa khởi tạo. Hãy gọi init() trước.');
        return Promise.resolve(0);
      }
      var els = document.querySelectorAll('[data-furigana-processed]');
      for (var i = 0; i < els.length; i++) els[i].removeAttribute('data-furigana-processed');
      return processAllElements();
    },

    processElement: function (element) {
      if (!isInitialized) {
        console.warn('[Furigana] Chưa khởi tạo. Hãy gọi init() trước.');
        return Promise.resolve(false);
      }
      return processElement(element);
    },

    isReady: function () { return isInitialized; },
    version: '2.0.0',
  };

  /* ── Auto Init ── */

  if (DEFAULT_CONFIG.autoInit) {
    var doInit = function () {
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
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', doInit);
    } else {
      doInit();
    }
  }
})();
