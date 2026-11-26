// @ts-check
/**
 * The project: its name, settings and cabinets. Pure functions for making
 * one and for checking one read from storage or from a file.
 */

import { DEFAULT_CABINETS, DEFAULT_SETTINGS, KINDS } from './parts.js';
import { t } from './i18n.js';

/**
 * @typedef {object} Project
 * @property {string} name
 * @property {import('./parts.js').Settings} settings
 * @property {import('./parts.js').Cabinet[]} cabinets
 */

/** Marks a saved project file, so other JSON files are refused. */
export const FILE_FORMAT = 'aveji-project';
export const FILE_VERSION = 1;

let counter = 0;
/** A short unique id for a cabinet. */
export function newId() {
  counter += 1;
  return `c${Date.now().toString(36)}${counter.toString(36)}`;
}

/**
 * An empty project, with material names in `lang`.
 * @param {string} lang
 * @returns {Project}
 */
export function newProject(lang) {
  return {
    name: '',
    settings: {
      ...DEFAULT_SETTINGS,
      carcassMaterial: t(lang, 'default.carcassMaterial'),
      frontMaterial: t(lang, 'default.frontMaterial'),
      backMaterial: t(lang, 'default.backMaterial'),
      drawerMaterial: t(lang, 'default.drawerMaterial'),
      worktopMaterial: t(lang, 'default.worktopMaterial'),
    },
    cabinets: [],
  };
}

/**
 * A new cabinet of `kind`, named after how many of that kind exist.
 * @param {'base' | 'wall' | 'tall'} kind
 * @param {import('./parts.js').Cabinet[]} cabinets  existing ones
 * @param {string} lang
 * @returns {import('./parts.js').Cabinet}
 */
export function newCabinet(kind, cabinets, lang) {
  const n = cabinets.filter((c) => c.kind === kind).length + 1;
  return { id: newId(), name: t(lang, `newName.${kind}`, { n }), kind, ...DEFAULT_CABINETS[kind] };
}

const num = (/** @type {unknown} */ v, /** @type {number} */ fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (/** @type {unknown} */ v, /** @type {string} */ fallback) => (typeof v === 'string' ? v : fallback);

/**
 * A project from untrusted data (storage, a file), with anything missing or
 * of the wrong type replaced by defaults. Null if it is not a project at all.
 * @param {unknown} raw
 * @param {string} lang  for default material names
 * @returns {Project | null}
 */
export function sanitizeProject(raw, lang) {
  if (!raw || typeof raw !== 'object') return null;
  const r = /** @type {Record<string, any>} */ (raw);
  if (!Array.isArray(r.cabinets) || !r.settings || typeof r.settings !== 'object') return null;
  const base = newProject(lang);
  /** @type {Record<string, any>} */
  const settings = { ...base.settings };
  for (const [key, fallback] of Object.entries(base.settings)) {
    const value = r.settings[key];
    if (typeof fallback === 'boolean') settings[key] = typeof value === 'boolean' ? value : fallback;
    else settings[key] = typeof fallback === 'number' ? num(value, fallback) : str(value, fallback);
  }
  const cabinets = r.cabinets
    .filter((/** @type {unknown} */ c) => c && typeof c === 'object')
    .map((/** @type {Record<string, any>} */ c) => {
      const kind = KINDS.includes(c.kind) ? c.kind : 'base';
      const d = DEFAULT_CABINETS[kind];
      return {
        id: str(c.id, '') || newId(),
        name: str(c.name, ''),
        kind,
        width: num(c.width, d.width),
        height: num(c.height, d.height),
        depth: num(c.depth, d.depth),
        partitions: Math.max(0, Math.round(num(c.partitions, d.partitions))),
        hPartitions: Math.max(0, Math.round(num(c.hPartitions, d.hPartitions))),
        shelves: Math.max(0, Math.round(num(c.shelves, d.shelves))),
        doors: Math.max(0, Math.round(num(c.doors, d.doors))),
        drawers: Math.max(0, Math.round(num(c.drawers, d.drawers))),
        drawersAt: c.drawersAt === 'top' || c.drawersAt === 'bottom' ? c.drawersAt : d.drawersAt,
      };
    });
  return { name: str(r.name, ''), settings: /** @type {any} */ (settings), cabinets };
}

/**
 * The project as the text of a saved file.
 * @param {Project} project
 */
export function projectFile(project) {
  return JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION, ...project }, null, 2);
}

/**
 * A project from a saved file's text, or null if it is not one.
 * @param {string} text
 * @param {string} lang
 */
export function readProjectFile(text, lang) {
  try {
    const data = JSON.parse(text);
    if (data?.format !== FILE_FORMAT) return null;
    return sanitizeProject(data, lang);
  } catch {
    return null;
  }
}
