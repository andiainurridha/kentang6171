/* KENTANG6171 - dashboard dinamis dari sheet Monitoring */
(function () {
  "use strict";

  function numberValue(value) {
    if (typeof value === "number") return value;
    const text = String(value == null ? "" : value).trim();
    if (!text) return 0;
    const normalized = text.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatNumber(value) {
    return Math.round(numberValue(value)).toLocaleString("id-ID");
  }

  function percent(value, total) {
    if (!total) return "0%";
    const result = (numberValue(value) / numberValue(total)) * 100;
    if (Math.abs(result - 100) < 0.005) return "100%";
    return result.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
  }

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function showDashboardError(message) {
    const content = document.querySelector(".content");
    if (!content) return;
    const alert = document.createElement("div");
    alert.className = "alert alert-danger";
    alert.textContent = "Data dashboard gagal dimuat dari Google Spreadsheet: " + message;
    content.prepend(alert);
  }

  function renderDashboard(data) {
    if (!data || !Array.isArray(data.petugas) || !Array.isArray(data.kecamatan)) {
      throw new Error("Struktur data dashboard dari Spreadsheet tidak sesuai.");
    }
    const petugas = data.petugas || [];
    const kecamatan = data.kecamatan || [];
    const totalPetugas = petugas[7] || [];

    const summaryValues = [totalPetugas[2], totalPetugas[3], totalPetugas[7], totalPetugas[8]];
    document.querySelectorAll(".summary-card .summary-value").forEach(function (element, index) {
      if (summaryValues[index] !== undefined) setText(element, formatNumber(summaryValues[index]));
    });

    const scan = numberValue(totalPetugas[4]);
    const geo = numberValue(totalPetugas[5]);
    const upload = numberValue(totalPetugas[6]);
    const titik = numberValue(totalPetugas[8]);
    const targetSls = numberValue(totalPetugas[2]);
    const progressValues = [
      [scan, targetSls], [geo, targetSls], [upload, targetSls], [titik, targetSls]
    ];

    document.querySelectorAll(".progress-card").forEach(function (card, index) {
      const values = progressValues[index];
      if (!values) return;
      const value = values[0];
      const denominator = values[1];
      const percentage = denominator ? (value / denominator) * 100 : 0;
      setText(card.querySelector(".progress-percent"), percent(value, denominator));
      setText(card.querySelector(".progress-info"), formatNumber(value) + " / " + formatNumber(denominator) + " SLS");
      const bar = card.querySelector(".progress-bar");
      if (bar) bar.style.width = Math.max(0, Math.min(100, percentage)) + "%";
    });

    // Filter tanggal mengikuti nilai C1 pada sheet Monitoring.
    const dateFilter = document.querySelector(".heading-actions select");
    if (dateFilter) {
      dateFilter.innerHTML = "";
      const option = document.createElement("option");
      option.textContent = "Tanggal: " + (data.dateFilter || "—");
      option.value = data.dateFilter || "";
      dateFilter.appendChild(option);
      dateFilter.disabled = true;
      dateFilter.title = "Mengikuti Filter Tanggal pada sheet Monitoring";
    }

    renderPetugas(petugas.slice(1, 7));
    renderKecamatan(kecamatan.slice(1, 7));
    renderKelurahan(data.kelurahan || []);
  }

  function renderPetugas(rows) {
    const tbody = document.querySelector(".petugas-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    rows.forEach(function (row) {
      const tr = document.createElement("tr");
      [row[1], formatNumber(row[5]), formatNumber(row[6]), formatNumber(row[8])].forEach(function (value, index) {
        const td = document.createElement("td");
        td.textContent = value == null ? "—" : value;
        if (index > 0) td.className = "text-end";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function renderKecamatan(rows) {
    // Kolom Monitoring A:K: nama kecamatan = B, total SLS = D,
    // Scan = E, Georeferencing = F, Upload = G, Pengolahan Titik = I.
    const validRows = (Array.isArray(rows) ? rows : []).filter(function (row) {
      return row && row[1] && String(row[1]).trim() !== "";
    });
    const labels = validRows.map(function (row) { return row[1]; });
    const metrics = {
      titik: {
        label: "Pengolahan Titik",
        counts: validRows.map(function (row) { return numberValue(row[8]); }),
        totals: validRows.map(function (row) { return numberValue(row[3]); })
      },
      georef: {
        label: "Georeferencing",
        counts: validRows.map(function (row) { return numberValue(row[5]); }),
        totals: validRows.map(function (row) { return numberValue(row[3]); })
      },
      upload: {
        label: "Upload Georeferenced",
        counts: validRows.map(function (row) { return numberValue(row[6]); }),
        totals: validRows.map(function (row) { return numberValue(row[3]); })
      },
      scan: {
        label: "Scan Peta",
        counts: validRows.map(function (row) { return numberValue(row[4]); }),
        totals: validRows.map(function (row) { return numberValue(row[3]); })
      }
    };

    Object.keys(metrics).forEach(function (key) {
      metrics[key].data = metrics[key].counts.map(function (count, index) {
        const total = metrics[key].totals[index];
        return total > 0 ? (count / total) * 100 : 0;
      });
    });

    const select = document.getElementById("pilihIndikator");
    const canvas = document.getElementById("grafikKecamatan");
    if (!select || !canvas || typeof Chart === "undefined") return;

    function selectedMetric() { return metrics[select.value] || metrics.titik; }
    function formatPercent(value) {
      return Number(value || 0).toLocaleString("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }) + "%";
    }
    function formatTotal(value) {
      return Math.round(numberValue(value)).toLocaleString("id-ID");
    }

    const initial = selectedMetric();
    const chart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: initial.label,
          data: initial.data,
          backgroundColor: "#795238",
          borderRadius: 5,
          barThickness: 17,
          counts: initial.counts,
          totals: initial.totals
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: function (items) {
                return items.length ? items[0].label : "";
              },
              label: function (context) {
                const dataset = context.dataset;
                const index = context.dataIndex;
                const count = dataset.counts[index] || 0;
                const total = dataset.totals[index] || 0;
                return [
                  dataset.label + ": " + formatPercent(context.raw),
                  "Total: " + formatTotal(count) + " dari " + formatTotal(total) + " SLS"
                ];
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            min: 0,
            max: 100,
            grid: { color: "#edf1f6" },
            ticks: {
              font: { size: 9 },
              callback: function (value) { return value + "%"; }
            }
          },
          y: { grid: { display: false }, ticks: { font: { size: 9 } } }
        }
      }
    });

    select.addEventListener("change", function () {
      const metric = selectedMetric();
      chart.data.datasets[0].label = metric.label;
      chart.data.datasets[0].data = metric.data;
      chart.data.datasets[0].counts = metric.counts;
      chart.data.datasets[0].totals = metric.totals;
      chart.update();
    });
  }


  function renderKelurahan(rows) {
    const tbody = document.querySelector("#tabelKelurahan tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    const validRows = (Array.isArray(rows) ? rows : []).slice(1).filter(function (row) {
      return row && row[0] && String(row[0]).toLowerCase() !== "iddesa" && row[1];
    });

    if (!validRows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 7;
      td.className = "text-center text-muted py-4";
      td.textContent = "Data progres kelurahan tidak tersedia pada Spreadsheet.";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    const fragment = document.createDocumentFragment();
    validRows.forEach(function (row) {
      const tr = document.createElement("tr");
      // Struktur Monitoring A:K; tampilkan tujuh indikator yang digunakan.
      const values = [
        row[1], // Nama kelurahan
        row[3], // Jumlah SLS
        row[4], // Scan
        row[5], // Georeferencing
        row[6], // Upload georeferenced
        row[8], // Pengolahan titik
        row[7]  // Perubahan batas
      ];

      values.forEach(function (value, index) {
        const td = document.createElement("td");
        td.textContent = index === 0 ? (value || "—") : formatNumber(value);
        td.className = index === 0 ? "primary-cell" : "text-center";
        tr.appendChild(td);
      });
      fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);

    const search = document.getElementById("cariKelurahan");
    if (search && !search.dataset.bound) {
      search.dataset.bound = "true";
      search.addEventListener("input", function () {
        const keyword = search.value.trim().toLocaleLowerCase("id");
        tbody.querySelectorAll("tr").forEach(function (row) {
          const name = row.cells[0] ? row.cells[0].textContent.toLocaleLowerCase("id") : "";
          row.style.display = name.includes(keyword) ? "" : "none";
        });
      });
    }
  }

  window.KentangAPI.read("dashboard")
    .then(function (response) {
      try {
        renderDashboard(response.dashboard || {});
      } catch (error) {
        showDashboardError(error.message);
      }
    })
    .catch(function (error) { showDashboardError(error.message); });
})();
