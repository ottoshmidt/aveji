// @ts-check
/**
 * The cut list as a table: one header row and one row per part, in the
 * column order of the screen, the CSV and the copied text alike.
 */

import { t } from './i18n.js';

export const COLUMNS = Object.freeze(['num', 'part', 'cabinet', 'material', 'length', 'width', 'qty', 'grain', 'L1', 'L2', 'W1', 'W2']);

/** Column indexes holding numbers (aligned right on screen). */
export const NUMERIC = Object.freeze(new Set(['num', 'length', 'width', 'qty']));

/**
 * An edge banding cell: a number when it is one ('0.4' or '0,4'), so a
 * spreadsheet treats it as a number in any locale; otherwise the text.
 * @param {string} band
 */
export function edge(band) {
  const text = band.trim();
  return /^\d+([.,]\d+)?$/.test(text) ? Number(text.replace(',', '.')) : text;
}

/**
 * @param {import('./parts.js').Part[]} parts
 * @param {string} lang
 * @returns {{ header: string[], rows: (string | number)[][] }}
 */
export function cutListTable(parts, lang) {
  const header = COLUMNS.map((c) => t(lang, `col.${c}`));
  const rows = parts.map((p, i) => [
    i + 1,
    p.type
      .split(',')
      .map((type) => t(lang, `part.${type}`))
      .join(' / '),
    p.cabinet,
    p.material,
    p.length,
    p.width,
    p.qty,
    t(lang, p.grain ? 'grainYes' : 'grainNo'),
    edge(p.edges.L1),
    edge(p.edges.L2),
    edge(p.edges.W1),
    edge(p.edges.W2),
  ]);
  return { header, rows };
}
