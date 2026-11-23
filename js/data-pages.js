/* KENTANG6171 - pemuatan tabel, filter, pagination, dan penyimpanan */
(function () {
  "use strict";

  const PAGE_CONFIG = {
    "batching.html": {
      page: "batching",
      columns: [
        ["idsubsls", "text"], ["nmsls", "text"], ["nmkec", "text"], ["nmdesa", "text"],
        ["ppl", "text"], ["pml", "text"], ["pj-kuda", "text"],
        ["Sudah Terima Peta", "status"], ["Nama Penerima Peta", "dropdown"], ["Tanggal Terima", "text"],
        ["Sudah Scan Rename", "dropdown-status"], ["Petugas Scan Rename", "dropdown"]
      ],
      editable: { 7: "Sudah Terima Peta", 8: "Nama Penerima Peta", 10: "Sudah Scan Rename", 11: "Petugas Scan Rename" },
      complete: function (item) {
        return isDone(item["Sudah Terima Peta"]) && isDone(item["Sudah Scan Rename"]);
      }
    },
    "pengolahan-peta.html": {
      page: "peta",
      columns: [
        ["idsubsls", "text"], ["nmsls", "text"], ["nmkec", "text"], ["nmdesa", "text"],
        ["ppl", "text"], ["pml", "text"], ["pj-kuda", "text"], ["Petugas Pengolahan", "dropdown"],
        ["Sudah Georeferenced", "status"], ["Sudah Upload Hasil Georeferenced", "status"],
        ["Tanggal Georeferenced", "text"], ["Ada Perubahan Batas?", "boundary"],
        ["Catatan Petugas Pengolahan", "note"], ["Catatan Pemeriksa", "note"]
      ],
      editable: { 7: "Petugas Pengolahan", 8: "Sudah Georeferenced", 9: "Sudah Upload Hasil Georeferenced", 11: "Ada Perubahan Batas?", 12: "Catatan Petugas Pengolahan", 13: "Catatan Pemeriksa" },
      complete: function (item) {
        return isDone(item["Sudah Georeferenced"]) && isDone(item["Sudah Upload Hasil Georeferenced"]);
      }
    },
    "pengolahan-titik.html": {
      page: "titik",
      columns: [
        ["idsubsls", "text"], ["nmsls", "text"], ["nmkec", "text"], ["nmdesa", "text"],
        ["ppl", "text"], ["pml", "text"], ["pj-kuda", "text"], ["Petugas Pengolahan", "dropdown"],
        ["Sudah Pengolahan Titik", "status"], ["Tanggal Pengolahan Titik", "text"], ["Catatan Pemeriksa", "note"]
      ],
      editable: { 7: "Petugas Pengolahan", 8: "Sudah Pengolahan Titik", 10: "Catatan Pemeriksa" },
      complete: function (item) { return isDone(item["Sudah Pengolahan Titik"]); }
    }
  };

  const PAGE_SIZE = 50;
  const fileName = location.pathname.split("/").pop() || "index.html";
  const config = PAGE_CONFIG[fileName];
  if (!config) return;

  const table = document.querySelector("table.batching-table");
  if (!table) return;
  const tbody = table.querySelector("tbody");
  const headers = Array.from(table.querySelectorAll("thead th"));
  // Tandai kolom catatan secara eksplisit. Baris tabel dibuat ulang oleh
  // JavaScript saat data Spreadsheet dimuat, jadi styling tidak hanya
  // bergantung pada markup awal atau urutan nth-child.
  headers.forEach(function (th, index) {
    if (config.columns[index] && config.columns[index][1] === "note") {
      th.classList.add("note-column");
    }
  });
  const searchInput = document.querySelector(".search-box");
  const kecamatanFilter = document.querySelector(".filter-select");
  const filterButton = document.querySelector(".filters .btn");
  const pagination = document.querySelector(".panel-footer .pagination");

  let allRows = [];
  let filteredRows = [];
  let currentPage = 1;
  let columnFilters = [];
  let dropdownOptions = {};

  function textValue(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function isDone(value) {
    return value === true || value === 1 ||
      ["true", "1", "sudah", "ya"].includes(textValue(value).toLowerCase());
  }

  function displayStatus(value) {
    return isDone(value) ? "Sudah" : "Belum";
  }

  function displayBoundary(value) {
    const normalized = textValue(value).toUpperCase();
    return normalized === "YA" || normalized === "ADA" ? "Ada" : "Tidak";
  }

  function getItemValue(item, index) {
    const column = config.columns[index];
    if (!column) return "";
    const value = item[column[0]];
    if (column[1] === "status" || column[1] === "dropdown-status") return displayStatus(value);
    if (column[1] === "boundary") return displayBoundary(value);
    return textValue(value);
  }

  function makeCell(item, index, field, type) {
    const td = document.createElement("td");
    if (type === "note") td.classList.add("note-cell");
    if (index === 0) td.classList.add("freeze-col", "freeze-1");
    if (index === 1) td.classList.add("primary-cell", "freeze-col", "freeze-2");

    const value = item[field];
    if (type === "status" || type === "boundary" || type === "dropdown" || type === "dropdown-status") {
      const select = document.createElement("select");
      select.className = "status-select";
      let options;
      if (type === "boundary") {
        options = ["Ada", "Tidak"];
      } else if (type === "status" || type === "dropdown-status") {
        options = dropdownOptions[field] && dropdownOptions[field].length
          ? dropdownOptions[field]
          : ["Sudah", "Belum"];
      } else {
        options = dropdownOptions[field] || [];
      }

      const currentValue = type === "boundary"
        ? displayBoundary(value)
        : ((type === "status" || type === "dropdown-status") ? displayStatus(value) : textValue(value));

      if (currentValue && !options.includes(currentValue)) options = options.concat([currentValue]);
      if (type === "dropdown" && !currentValue) {
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Pilih nama...";
        select.appendChild(placeholder);
      }
      if (!options.length) options = [""];
      options.forEach(function (entry) {
        const option = document.createElement("option");
        option.value = entry;
        option.textContent = entry || "—";
        select.appendChild(option);
      });
      select.value = currentValue;
      select.dataset.lastSaved = select.value;
      if (type === "status" || type === "dropdown-status") {
        select.classList.add(select.value === "Sudah" ? "done" : "pending");
      }
      td.appendChild(select);
    } else if (type === "note") {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "note-input";
      input.placeholder = "Tulis catatan...";
      input.value = textValue(value);
      input.maxLength = 2000;
      input.dataset.lastSaved = input.value;
      td.appendChild(input);
    } else {
      td.textContent = textValue(value) || "—";
    }
    return td;
  }

  function updateRowColor(row, item) {
    row.classList.toggle("row-complete", config.complete(item));
  }

  function showLoading() {
    tbody.innerHTML = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = headers.length;
    td.className = "text-center py-4";
    td.textContent = "Memuat data dari Google Spreadsheet...";
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function saveControl(control, row, item, field, value, previousValue) {
    control.disabled = true;
    control.title = "Menyimpan perubahan...";
    window.KentangAPI.update(row.dataset.id, field, value)
      .then(function (response) {
        item[field] = response.value;
        if (response && response.dateField) {
          item[response.dateField] = response.dateValue || "";
        }
        control.dataset.lastSaved = control.matches("input")
          ? control.value
          : (field === "Ada Perubahan Batas?"
              ? displayBoundary(response.value)
              : (field === "Sudah Scan Rename" || field === "Sudah Terima Peta"
                  ? displayStatus(response.value)
                  : textValue(response.value)));
        if (control.matches("select") && (field === "Sudah Scan Rename" || field === "Sudah Terima Peta")) {
          control.classList.toggle("done", control.value === "Sudah");
          control.classList.toggle("pending", control.value !== "Sudah");
        }
        control.title = "Perubahan berhasil disimpan ke Google Spreadsheet";
        applyFilters();
      })
      .catch(function (error) {
        control.value = previousValue;
        control.dataset.lastSaved = previousValue;
        if (control.matches("select") && (field === "Sudah Terima Peta" ||
            field === "Sudah Scan Rename" || field === "Sudah Georeferenced" ||
            field === "Sudah Upload Hasil Georeferenced" ||
            field === "Sudah Pengolahan Titik")) {
          control.classList.remove("done", "pending");
          control.classList.add(previousValue === "Sudah" ? "done" : "pending");
        }
        control.title = "Gagal menyimpan perubahan";
        alert("Perubahan tidak berhasil disimpan.\n" + error.message);
      })
      .finally(function () {
        control.disabled = false;
      });
  }

  function bindEditableControls(tr, item) {
    Object.keys(config.editable).forEach(function (indexText) {
      const index = Number(indexText);
      const field = config.editable[index];
      const control = tr.cells[index].querySelector("select, input");
      if (!control) return;

      if (control.matches("select")) {
        control.addEventListener("change", function () {
          const previous = control.dataset.lastSaved || control.value;
          const current = control.value;
          if (current === previous) return;
          if (["Sudah Terima Peta", "Sudah Scan Rename", "Sudah Georeferenced",
              "Sudah Upload Hasil Georeferenced", "Sudah Pengolahan Titik"].includes(field)) {
            control.classList.toggle("done", current === "Sudah");
            control.classList.toggle("pending", current === "Belum");
          } else {
            control.classList.remove("done", "pending");
          }
          const apiValue = field === "Ada Perubahan Batas?"
            ? (current === "Ada" ? "YA" : "TIDAK")
            : current;
          saveControl(control, tr, item, field, apiValue, previous);
        });
      } else {
        control.addEventListener("change", function () {
          const previous = control.dataset.lastSaved || "";
          if (control.value === previous) return;
          saveControl(control, tr, item, field, control.value, previous);
        });
      }
    });
  }

  function setupFilters() {
    columnFilters = [];
    headers.forEach(function (th, index) {
      if (index >= config.columns.length) return;
      const oldFilter = th.querySelector(".column-filter");
      const filter = document.createElement("select");
      filter.className = "column-filter";
      filter.dataset.filterCol = String(index);
      filter.setAttribute("aria-label", "Filter " + (th.querySelector("span")?.textContent || th.textContent).trim());

      const all = document.createElement("option");
      all.value = "";
      all.textContent = "Semua";
      filter.appendChild(all);

      const unique = new Set(allRows.map(function (item) { return getItemValue(item, index); }).filter(Boolean));
      Array.from(unique).sort(function (a, b) {
        return a.localeCompare(b, "id", { numeric: true, sensitivity: "base" });
      }).forEach(function (value) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        filter.appendChild(option);
      });

      if (oldFilter) oldFilter.replaceWith(filter);
      else th.appendChild(filter);
      columnFilters.push(filter);
      filter.addEventListener("change", function () { currentPage = 1; applyFilters(); });
    });
  }

  function populateKecamatan() {
    if (!kecamatanFilter) return;
    kecamatanFilter.innerHTML = "";
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "Semua Kecamatan";
    kecamatanFilter.appendChild(all);

    const values = Array.from(new Set(allRows.map(function (item) {
      return textValue(item.nmkec);
    }).filter(Boolean))).sort();
    values.forEach(function (value) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      kecamatanFilter.appendChild(option);
    });
  }

  function applyFilters() {
    const keyword = searchInput ? searchInput.value.trim().toLocaleLowerCase("id") : "";
    const kecamatan = kecamatanFilter ? kecamatanFilter.value : "";
    filteredRows = allRows.filter(function (item) {
      const matchesColumns = columnFilters.every(function (filter) {
        if (!filter.value) return true;
        return getItemValue(item, Number(filter.dataset.filterCol)) === filter.value;
      });
      const searchableText = config.columns.map(function (column, index) {
        return getItemValue(item, index);
      }).join(" ").toLocaleLowerCase("id");
      const matchesSearch = !keyword || searchableText.includes(keyword);
      const matchesKecamatan = !kecamatan || textValue(item.nmkec) === kecamatan;
      return matchesColumns && matchesSearch && matchesKecamatan;
    });
    renderPage();
  }

  function renderPage() {
    const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(currentPage, 1), pageCount);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filteredRows.slice(start, start + PAGE_SIZE);
    const fragment = document.createDocumentFragment();
    tbody.innerHTML = "";

    pageRows.forEach(function (item) {
      const tr = document.createElement("tr");
      tr.dataset.id = textValue(item.idsubsls);
      config.columns.forEach(function (column, index) {
        tr.appendChild(makeCell(item, index, column[0], column[1]));
      });
      updateRowColor(tr, item);
      bindEditableControls(tr, item);
      fragment.appendChild(tr);
    });

    if (!pageRows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = headers.length;
      td.className = "text-center py-4";
      td.textContent = "Data tidak ditemukan.";
      tr.appendChild(td);
      fragment.appendChild(tr);
    }
    tbody.appendChild(fragment);

    if (!pagination) return;
    pagination.innerHTML = "";
    addPageItem("‹", currentPage - 1, currentPage === 1);
    const first = Math.max(1, currentPage - 2);
    const last = Math.min(pageCount, currentPage + 2);
    for (let page = first; page <= last; page++) {
      addPageItem(String(page), page, false, page === currentPage);
    }
    addPageItem("›", currentPage + 1, currentPage === pageCount);
  }

  function addPageItem(label, page, disabled, active) {
    const li = document.createElement("li");
    li.className = "page-item" + (disabled ? " disabled" : "") + (active ? " active" : "");
    const a = document.createElement("a");
    a.className = "page-link";
    a.href = "#";
    a.textContent = label;
    a.addEventListener("click", function (event) {
      event.preventDefault();
      if (disabled) return;
      currentPage = page;
      renderPage();
      table.closest(".table-wrap")?.scrollTo({ top: 0, behavior: "smooth" });
    });
    li.appendChild(a);
    pagination.appendChild(li);
  }

  if (searchInput) searchInput.addEventListener("input", function () { currentPage = 1; applyFilters(); });
  if (kecamatanFilter) kecamatanFilter.addEventListener("change", function () { currentPage = 1; applyFilters(); });
  if (filterButton) filterButton.addEventListener("click", function () { currentPage = 1; applyFilters(); });

  showLoading();
  window.KentangAPI.read(config.page)
    .then(function (response) {
      allRows = response.rows || [];
      dropdownOptions = response.dropdownOptions || {};

      // Fallback: bila API belum mengirimkan daftar validasi dropdown,
      // bentuk pilihan dari nama petugas unik yang sudah ada pada data DB.
      if (config.page === "peta" || config.page === "titik") {
        const field = "Petugas Pengolahan";
        const fromRows = allRows
          .map(function (item) { return textValue(item[field]); })
          .filter(Boolean);
        const fromApi = Array.isArray(dropdownOptions[field])
          ? dropdownOptions[field]
          : [];
        dropdownOptions[field] = Array.from(new Set(fromApi.concat(fromRows)));
      }

      setupFilters();
      populateKecamatan();
      applyFilters();
    })
    .catch(function (error) {
      tbody.innerHTML = "";
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = headers.length;
      td.className = "text-center text-danger py-4";
      td.textContent = "Gagal memuat data: " + error.message;
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
})();
