/* KENTANG6171 - koneksi Google Apps Script */
(function () {
  "use strict";

  const API_URL =
    "https://script.google.com/macros/s/AKfycbxrUrwAkylOvCGE5vh92uNfrVStmmMYsIffwYbDHW0u/dev";
  const CACHE_PREFIX = "kentang6171:cache:";
  const CACHE_TTL = 3000;
  const REQUEST_TIMEOUT = 90000;
  let callbackCounter = 0;

  function jsonp(params) {
    return new Promise(function (resolve, reject) {
      const callbackName = "Kentang6171Callback" + ++callbackCounter;
      const script = document.createElement("script");
      let timeoutId;

      function cleanup() {
        if (timeoutId) window.clearTimeout(timeoutId);
        delete window[callbackName];
        script.remove();
      }

      window[callbackName] = function (response) {
        cleanup();
        if (!response || response.success !== true) {
          reject(
            new Error(
              (response && response.message) || "Respons API tidak valid.",
            ),
          );
          return;
        }
        resolve(response);
      };

      script.onerror = function () {
        cleanup();
        reject(
          new Error(
            "Tidak dapat menghubungi Google Apps Script. Periksa deployment dan koneksi internet.",
          ),
        );
      };

      const query = new URLSearchParams({
        ...params,
        callback: callbackName,
        _ts: String(Date.now()),
      });
      script.src = API_URL + "?" + query.toString();

      timeoutId = window.setTimeout(function () {
        cleanup();
        reject(
          new Error(
            "Google Apps Script belum merespons dalam 90 detik. Coba muat ulang halaman.",
          ),
        );
      }, REQUEST_TIMEOUT);

      document.head.appendChild(script);
    });
  }

  function invalidateCache() {
    try {
      Object.keys(sessionStorage).forEach(function (key) {
        if (key.indexOf(CACHE_PREFIX) === 0) sessionStorage.removeItem(key);
      });
    } catch (error) {
      // Cache hanya optimasi.
    }
  }

  function read(page) {
    const key = CACHE_PREFIX + page;
    try {
      const cached = JSON.parse(sessionStorage.getItem(key) || "null");
      if (cached && Date.now() - cached.savedAt < CACHE_TTL) {
        return Promise.resolve(cached.response);
      }
    } catch (error) {
      // Abaikan cache yang tidak valid.
    }

    return jsonp({ action: "read", page: page }).then(function (response) {
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify({
            savedAt: Date.now(),
            response: response,
          }),
        );
      } catch (error) {
        // Abaikan jika sessionStorage tidak tersedia/penuh.
      }
      return response;
    });
  }

  function update(id, field, value) {
    // Update tidak memakai cache. Setelah berhasil, cache baca di tab ini dibersihkan.
    return jsonp({
      action: "update",
      id: id,
      field: field,
      value: value,
    }).then(function (response) {
      invalidateCache();
      return response;
    });
  }

  window.KentangAPI = {
    read: read,
    update: update,
    refresh: invalidateCache,
  };
})();
