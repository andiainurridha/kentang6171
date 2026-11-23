/**
 * KENTANG6171 - Google Apps Script API
 * Spreadsheet ID: 1mcu4zojVayqG31hJqojkB7BW82VISDS81F1Y5lWJg50
 *
 * Catatan keamanan:
 * Endpoint ini dapat diakses publik sesuai keputusan pemilik website.
 * Siapa pun yang mengetahui URL dapat membaca data dan memperbarui kolom
 * yang diizinkan. Jangan gunakan untuk data yang harus privat.
 */

const SPREADSHEET_ID = '1mcu4zojVayqG31hJqojkB7BW82VISDS81F1Y5lWJg50';
const DB_SHEET_NAME = 'DB';
const MONITORING_SHEET_NAME = 'Monitoring';
const KEY_HEADER = 'idsubsls';

const EDITABLE_FIELDS = {
  'Sudah Terima Peta': 'boolean',
  'Sudah Scan Rename': 'dropdown',
  'Nama Penerima Peta': 'dropdown',
  'Petugas Scan Rename': 'dropdown',
  'Petugas Pengolahan': 'dropdown',
  'Sudah Georeferenced': 'boolean',
  'Sudah Upload Hasil Georeferenced': 'boolean',
  'Ada Perubahan Batas?': 'boundary',
  'Catatan Petugas Pengolahan': 'text',
  'Sudah Pengolahan Titik': 'boolean',
  'Catatan Pemeriksa': 'text'
};

// Kolom tanggal yang sudah memiliki formula di Spreadsheet.
// Script hanya membaca hasil formula; tidak menulis atau mengubah formula.
const DATE_FIELDS = {
  'Sudah Terima Peta': 'Tanggal Terima',
  'Sudah Georeferenced': 'Tanggal Georeferenced',
  'Sudah Pengolahan Titik': 'Tanggal Pengolahan Titik'
};

const FIELDS_BY_PAGE = {
  batching: [
    'idsubsls', 'nmsls', 'nmkec', 'nmdesa', 'ppl', 'pml', 'pj-kuda',
    'Sudah Terima Peta', 'Nama Penerima Peta', 'Tanggal Terima',
    'Sudah Scan Rename', 'Petugas Scan Rename'
  ],
  peta: [
    'idsubsls', 'nmsls', 'nmkec', 'nmdesa', 'ppl', 'pml', 'pj-kuda',
    'Petugas Pengolahan', 'Sudah Georeferenced',
    'Sudah Upload Hasil Georeferenced', 'Tanggal Georeferenced',
    'Ada Perubahan Batas?', 'Catatan Petugas Pengolahan', 'Catatan Pemeriksa'
  ],
  titik: [
    'idsubsls', 'nmsls', 'nmkec', 'nmdesa', 'ppl', 'pml', 'pj-kuda',
    'Petugas Pengolahan', 'Sudah Pengolahan Titik',
    'Tanggal Pengolahan Titik', 'Catatan Pemeriksa'
  ]
};

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const action = params.action || 'read';
  let result;

  try {
    if (action === 'read') {
      result = readData_(params.page || 'all');
    } else if (action === 'update') {
      result = updateData_(params);
    } else {
      throw new Error('Aksi tidak dikenal.');
    }
  } catch (err) {
    result = { success: false, message: err.message || String(err) };
  }

  return output_(result, params.callback);
}

function readData_(page) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  if (page === 'dashboard') {
    return {
      success: true,
      page: page,
      dashboard: readMonitoring_(ss)
    };
  }

  const db = ss.getSheetByName(DB_SHEET_NAME);
  if (!db) throw new Error('Sheet DB tidak ditemukan.');

  const lastRow = db.getLastRow();
  const lastCol = db.getLastColumn();
  if (lastCol < 1) throw new Error('Sheet DB tidak memiliki header.');

  const headers = db.getRange(1, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map(function (value) { return String(value || '').trim(); });

  const index = {};
  headers.forEach(function (name, i) {
    if (name) index[name] = i;
  });

  if (index[KEY_HEADER] === undefined) {
    throw new Error('Kolom idsubsls tidak ditemukan.');
  }

  const selected = FIELDS_BY_PAGE[page] || headers.filter(Boolean);
  const selectedColumns = selected
    .map(function (name) { return index[name]; })
    .filter(function (column) { return column !== undefined; });

  if (lastRow < 2 || selectedColumns.length === 0) {
    return { success: true, page: page, headers: selected, rows: [], total: 0 };
  }

  // Satu kali pembacaan rentang untuk mengurangi round-trip ke Spreadsheet.
  // Rentang dibatasi pada kolom terluar yang dibutuhkan halaman.
  const minColumn = Math.min.apply(null, selectedColumns);
  const maxColumn = Math.max.apply(null, selectedColumns);
  const values = db.getRange(
    2,
    minColumn + 1,
    lastRow - 1,
    maxColumn - minColumn + 1
  ).getDisplayValues();

  const idOffset = index[KEY_HEADER] - minColumn;
  const rows = [];

  for (let r = 0; r < values.length; r++) {
    const id = values[r][idOffset];
    if (id === '' || id === null || id === undefined) continue;

    const item = {};
    selected.forEach(function (name) {
      const col = index[name];
      if (col !== undefined) {
        item[name] = values[r][col - minColumn];
      }
    });
    rows.push(item);
  }

  const response = {
    success: true,
    page: page,
    headers: selected,
    rows: rows,
    total: rows.length
  };

  if (page === 'batching') {
    response.dropdownOptions = {
      'Nama Penerima Peta': getDropdownOptions_(db, index['Nama Penerima Peta'] + 1, lastRow),
      'Petugas Scan Rename': getDropdownOptions_(db, index['Petugas Scan Rename'] + 1, lastRow),
      'Sudah Scan Rename': getDropdownOptions_(db, index['Sudah Scan Rename'] + 1, lastRow)
    };
  } else if (page === 'peta' || page === 'titik') {
    const petugasColumn = index['Petugas Pengolahan'];
    response.dropdownOptions = {
      'Petugas Pengolahan': petugasColumn === undefined
        ? []
        : getDropdownOptions_(db, petugasColumn + 1, lastRow)
    };
  }

  return response;
}

/**
 * Mengambil pilihan dropdown dari aturan validasi data di Spreadsheet.
 * Jika kolom tidak memiliki aturan validasi, pilihan diambil dari nilai
 * unik yang sudah tersedia pada kolom tersebut.
 */
function getDropdownOptions_(sheet, column, lastRow) {
  if (!column) return [];
  const rowCount = Math.max(lastRow - 1, 1);
  const range = sheet.getRange(2, column, rowCount, 1);
  const validations = range.getDataValidations();
  let rule = null;

  for (let i = 0; i < validations.length; i++) {
    if (validations[i][0]) {
      rule = validations[i][0];
      break;
    }
  }

  if (rule) {
    const criteria = rule.getCriteriaType();
    const args = rule.getCriteriaValues();

    if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
      const listed = (args[0] || []).map(function (value) {
        return String(value == null ? '' : value).trim();
      }).filter(Boolean);
      if (listed.length) return listed;
    }

    if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
      const listed = args[0].getDisplayValues().flat()
        .map(function (value) { return String(value || '').trim(); })
        .filter(Boolean)
        .filter(function (value, index, values) { return values.indexOf(value) === index; });
      if (listed.length) return listed;
    }

    if (criteria === SpreadsheetApp.DataValidationCriteria.CHECKBOX) {
      return ['Sudah', 'Belum'];
    }
  }

  const values = range.getDisplayValues().flat()
    .map(function (value) { return String(value || '').trim(); })
    .filter(Boolean);
  const unique = values.filter(function (value, index) {
    return values.indexOf(value) === index;
  }).sort();

  if (unique.length && unique.every(function (value) {
    return ['TRUE', 'FALSE', '1', '0'].includes(value.toUpperCase());
  })) {
    return ['Sudah', 'Belum'];
  }
  return unique;
}

function readMonitoring_(ss) {
  const sheet = ss.getSheetByName(MONITORING_SHEET_NAME);
  if (!sheet) throw new Error('Sheet Monitoring tidak ditemukan.');

  // Data kelurahan dimulai dari baris 27. Nilai dibaca apa adanya
  // dari Spreadsheet; formula dan struktur sheet tidak diubah.
  const lastRow = sheet.getLastRow();
  const kelurahan = lastRow >= 27
    ? sheet.getRange(27, 1, lastRow - 26, 11).getDisplayValues()
    : [];

  return {
    dateFilter: sheet.getRange('C1').getDisplayValue(),
    petugas: sheet.getRange('A3:K11').getDisplayValues(),
    kecamatan: sheet.getRange('A15:K23').getDisplayValues(),
    kelurahan: kelurahan
  };
}

function updateData_(params) {
  const id = String(params.id || '').trim();
  const field = String(params.field || '').trim();
  let value = params.value;

  if (!id) throw new Error('ID SLS tidak boleh kosong.');
  if (!Object.prototype.hasOwnProperty.call(EDITABLE_FIELDS, field)) {
    throw new Error('Kolom tidak diizinkan untuk diperbarui: ' + field);
  }

  const type = EDITABLE_FIELDS[field];

  if (type === 'boolean') {
    const normalized = String(value).toLowerCase();
    if (['true', 'sudah', '1'].includes(normalized)) value = true;
    else if (['false', 'belum', '0'].includes(normalized)) value = false;
    else throw new Error('Nilai status harus Sudah atau Belum.');
  } else if (type === 'dropdown') {
    value = String(value == null ? '' : value).trim();
    if (value.length > 200) throw new Error('Nilai dropdown terlalu panjang.');
  } else if (type === 'boundary') {
    const normalized = String(value).trim().toUpperCase();
    if (['ADA', 'YA'].includes(normalized)) value = 'YA';
    else if (['TIDAK', 'TIDAK ADA'].includes(normalized)) value = 'TIDAK';
    else throw new Error('Nilai perubahan batas harus Ada atau Tidak.');
  } else {
    value = String(value == null ? '' : value).trim();
    if (value.length > 2000) {
      throw new Error('Catatan terlalu panjang (maksimal 2.000 karakter).');
    }
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DB_SHEET_NAME);
    if (!sheet) throw new Error('Sheet DB tidak ditemukan.');

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol)
      .getDisplayValues()[0]
      .map(function (header) { return String(header || '').trim(); });

    const idCol = headers.indexOf(KEY_HEADER) + 1;
    const targetCol = headers.indexOf(field) + 1;
    if (!idCol || !targetCol) {
      throw new Error('Kolom ID atau kolom tujuan tidak ditemukan.');
    }

    const finder = sheet.getRange(2, idCol, Math.max(lastRow - 1, 1), 1)
      .createTextFinder(id)
      .matchEntireCell(true)
      .findNext();

    if (!finder) throw new Error('ID SLS tidak ditemukan: ' + id);

    const targetRow = finder.getRow();

    if (type === 'dropdown') {
      const targetCell = sheet.getRange(targetRow, targetCol);
      const rule = targetCell.getDataValidation();
      if (rule) {
        const criteria = rule.getCriteriaType();
        const args = rule.getCriteriaValues();

        if (criteria === SpreadsheetApp.DataValidationCriteria.CHECKBOX) {
          const normalized = String(value).toLowerCase();
          if (['sudah', 'true', '1'].includes(normalized)) {
            value = args.length > 0 ? args[0] : true;
          } else if (['belum', 'false', '0'].includes(normalized)) {
            value = args.length > 1 ? args[1] : false;
          } else {
            throw new Error('Pilih status Sudah atau Belum.');
          }
        } else {
          const allowed = getDropdownOptions_(sheet, targetCol, lastRow);
          if (allowed.length && allowed.indexOf(String(value)) === -1) {
            throw new Error('Pilihan tidak sesuai dengan dropdown pada Spreadsheet.');
          }
        }
      }
    }

    sheet.getRange(targetRow, targetCol).setValue(value);
    SpreadsheetApp.flush();

    // Ambil hasil formula tanggal setelah perubahan disimpan.
    // Formula pada Spreadsheet tidak disentuh oleh script.
    const dateField = DATE_FIELDS[field] || '';
    let dateValue = '';
    if (dateField) {
      const dateCol = headers.indexOf(dateField) + 1;
      if (dateCol > 0) {
        // Beri waktu singkat untuk formula turunan memperbarui hasil tampilannya.
        Utilities.sleep(300);
        SpreadsheetApp.flush();
        dateValue = sheet.getRange(targetRow, dateCol).getDisplayValue();
      }
    }

    return {
      success: true,
      message: 'Perubahan berhasil disimpan.',
      id: id,
      field: field,
      value: value,
      dateField: dateField,
      dateValue: dateValue
    };
  } finally {
    lock.releaseLock();
  }
}

function output_(data, callback) {
  const json = JSON.stringify(data);

  if (callback) {
    if (!/^[a-zA-Z_$][0-9a-zA-Z_$\.\[\]]*$/.test(callback)) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Callback tidak valid.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
