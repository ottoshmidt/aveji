// @ts-check
/**
 * Turning a table into text a spreadsheet opens: CSV for a file, and
 * tab-separated text for pasting straight into Excel or Google Sheets.
 *
 * Excel in Georgian and Russian locales expects `;` between fields and a
 * decimal comma; in English, `,` and a decimal point. So the delimiter is a
 * choice, and with `;` numbers get a decimal comma.
 */

/**
 * @typedef {object} CsvOptions
 * @property {',' | ';' | '\t'} delimiter
 * @property {boolean} [decimalComma]  write 2,5 instead of 2.5 (default: when the delimiter is not ',')
 */

/**
 * One cell as text.
 * @param {string | number | boolean | null | undefined} value
 * @param {CsvOptions} options
 */
export function cell(value, { delimiter, decimalComma = delimiter !== ',' }) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'number' && decimalComma) text = text.replace('.', ',');
  if (delimiter === '\t') return text.replace(/[\t\r\n]+/g, ' ');
  return /["\r\n]/.test(text) || text.includes(delimiter) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The whole table, rows separated by CRLF (what Excel writes).
 * @param {(string | number | boolean | null | undefined)[][]} rows
 * @param {CsvOptions} options
 */
export function toDelimited(rows, options) {
  return rows.map((row) => row.map((v) => cell(v, options)).join(options.delimiter)).join('\r\n') + '\r\n';
}

/**
 * The CSV file's bytes as a string: with a byte-order mark, without which
 * Excel reads UTF-8 as a legacy code page and Georgian turns into garbage.
 * @param {(string | number | boolean | null | undefined)[][]} rows
 * @param {CsvOptions} options
 */
export function csvFile(rows, options) {
  return '﻿' + toDelimited(rows, options);
}
