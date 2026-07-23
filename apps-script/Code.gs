/**
 * COLDEM Admissions — Backend compartido para EOD
 *
 * 1) Crea un Google Sheet vacío.
 * 2) Extensiones > Apps Script.
 * 3) Pega este archivo y reemplaza SPREADSHEET_ID.
 * 4) Ejecuta setup() una vez.
 * 5) Implementar > Nueva implementación > Aplicación web.
 *    Ejecutar como: tú. Acceso: cualquier usuario con el enlace.
 * 6) Pega la URL /exec en config.js del dashboard.
 */

const SPREADSHEET_ID = 'PEGA_AQUI_EL_ID_DEL_GOOGLE_SHEET';
const SHEET_NAME = 'EOD_Entries';

const HEADERS = [
  'id', 'date', 'owner', 'paidLeads', 'organicLeads', 'contactWhatsApp', 'calls',
  'responses', 'qualified', 'noQualified', 'tourBooked', 'tourAttended',
  'passDayBooked', 'passDayAttended', 'feedbacks', 'enrolled', 'pendingEnd',
  'weekendBacklogStart', 'notes', 'source', 'updatedAt'
];

function setup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#0b6b55')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }

  sheet.autoResizeColumns(1, HEADERS.length);
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'list';
    if (action !== 'list') return json_({ ok: false, error: 'Acción GET no válida.' });
    return json_({ ok: true, entries: listEntries_() });
  } catch (error) {
    return json_({ ok: false, error: String(error.message || error) });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (payload.action === 'upsert') {
      if (!payload.entry || !payload.entry.id) throw new Error('La captura no incluye un ID válido.');
      upsertEntry_(payload.entry);
      return json_({ ok: true });
    }

    if (payload.action === 'delete') {
      deleteEntry_(payload.id);
      return json_({ ok: true });
    }

    return json_({ ok: false, error: 'Acción POST no válida.' });
  } catch (error) {
    return json_({ ok: false, error: String(error.message || error) });
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName(SHEET_NAME);
  }
  return sheet;
}

function listEntries_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  return rows
    .filter(row => row[0])
    .map(row => {
      const entry = {};
      HEADERS.forEach((header, index) => {
        let value = row[index];
        if (header === 'date' && value instanceof Date) {
          value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        }
        entry[header] = value;
      });
      return entry;
    });
}

function upsertEntry_(entry) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    const lastRow = sheet.getLastRow();
    const ids = lastRow >= 2
      ? sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat()
      : [];
    const index = ids.indexOf(String(entry.id));
    const row = HEADERS.map(header => entry[header] === undefined ? '' : entry[header]);

    if (index >= 0) {
      sheet.getRange(index + 2, 1, 1, HEADERS.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
  } finally {
    lock.releaseLock();
  }
}

function deleteEntry_(id) {
  if (!id) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat();
    const index = ids.indexOf(String(id));
    if (index >= 0) sheet.deleteRow(index + 2);
  } finally {
    lock.releaseLock();
  }
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
