// @ts-check
/**
 * The project library: every project kept in this browser, and which one is
 * open. Pure functions, so they are unit-tested; js/main.js stores the result
 * in localStorage.
 */

import { newProject, sanitizeProject } from './project.js';

/**
 * @typedef {object} Entry
 * @property {string} id
 * @property {number} updatedAt  ms since 1970, for sorting
 * @property {import('./project.js').Project} project
 */

/**
 * @typedef {object} Library
 * @property {string} currentId  the open project
 * @property {Entry[]} entries
 */

let counter = 0;
export function newProjectId() {
  counter += 1;
  return `p${Date.now().toString(36)}${counter.toString(36)}`;
}

/**
 * @param {import('./project.js').Project} project
 * @returns {Entry}
 */
export function newEntry(project) {
  return { id: newProjectId(), updatedAt: Date.now(), project };
}

/**
 * A library holding one new, empty project.
 * @param {string} lang
 * @returns {Library}
 */
export function emptyLibrary(lang) {
  const entry = newEntry(newProject(lang));
  return { currentId: entry.id, entries: [entry] };
}

/**
 * The library from stored data. Also reads what the first version stored
 * (a single `project`), so nothing is lost on upgrade. Never empty.
 * @param {unknown} raw  the stored state
 * @param {string} lang
 * @returns {Library}
 */
export function sanitizeLibrary(raw, lang) {
  const r = /** @type {Record<string, any> | null} */ (raw && typeof raw === 'object' ? raw : null);
  /** @type {Entry[]} */
  const entries = [];
  const seen = new Set();
  for (const e of Array.isArray(r?.projects) ? r.projects : []) {
    const project = sanitizeProject(e?.project, lang);
    if (!project) continue;
    let id = typeof e.id === 'string' && e.id ? e.id : newProjectId();
    if (seen.has(id)) id = newProjectId();
    seen.add(id);
    entries.push({ id, updatedAt: Number.isFinite(e.updatedAt) ? e.updatedAt : 0, project });
  }
  if (entries.length === 0 && r?.project) {
    const project = sanitizeProject(r.project, lang);
    if (project) entries.push(newEntry(project));
  }
  if (entries.length === 0) return emptyLibrary(lang);
  const currentId = entries.some((e) => e.id === r?.currentId) ? r?.currentId : entries[0].id;
  return { currentId, entries };
}

/**
 * The open project's entry.
 * @param {Library} library
 */
export function currentEntry(library) {
  return library.entries.find((e) => e.id === library.currentId) ?? library.entries[0];
}

/**
 * Entries for the project list: the most recently changed first.
 * @param {Library} library
 */
export function sortedEntries(library) {
  return [...library.entries].sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Add a project and open it.
 * @param {Library} library
 * @param {import('./project.js').Project} project
 * @returns {Entry}
 */
export function addProject(library, project) {
  const entry = newEntry(project);
  library.entries.push(entry);
  library.currentId = entry.id;
  return entry;
}

/**
 * Remove the open project and open the most recent other one (or a new,
 * empty one if it was the last).
 * @param {Library} library
 * @param {string} lang
 */
export function removeCurrent(library, lang) {
  library.entries = library.entries.filter((e) => e.id !== library.currentId);
  if (library.entries.length === 0) {
    const fresh = emptyLibrary(lang);
    library.entries = fresh.entries;
    library.currentId = fresh.currentId;
  } else {
    library.currentId = sortedEntries(library)[0].id;
  }
}

/**
 * A copy of a project under another name.
 * @param {import('./project.js').Project} project
 * @param {string} copyName  the copy's name
 * @returns {import('./project.js').Project}
 */
export function copyProject(project, copyName) {
  const copy = structuredClone(project);
  copy.name = copyName;
  return copy;
}
