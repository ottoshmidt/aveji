// @ts-check
/**
 * The page: the project form, the cabinet list, the drawing and the cut
 * list. Everything is kept in the browser (localStorage); a project can also
 * be saved to and opened from a file.
 */

import { csvFile, toDelimited } from './csv.js';
import { frontView } from './drawing.js';
import { detectLanguage, LANGUAGES, t } from './i18n.js';
import { cabinetProblems, hasShelves, KINDS, mergeParts, projectParts, totals } from './parts.js';
import { addProject, backupFile, copyProject, currentEntry, readBackupFile, removeCurrent, restore, sanitizeLibrary, sortedEntries } from './library.js';
import { newCabinet, newId, newProject } from './project.js';
import { COLUMNS, cutListTable, NUMERIC } from './table.js';

// Still v1: the library reads the single project the first version stored.
const STORAGE_KEY = 'aveji.state.v1';

/** @param {string} selector */
const $ = (selector) => /** @type {HTMLElement} */ (document.querySelector(selector));

/**
 * @typedef {object} State
 * @property {string} lang
 * @property {import('./library.js').Library} library  every project in this browser
 * @property {import('./project.js').Project} project  the open one (a view into library)
 * @property {boolean} merge       combine identical parts in the list
 * @property {',' | ';'} delimiter  CSV flavour
 */

/** @returns {State} */
function loadState() {
  const fallbackLang = detectLanguage(navigator.language);
  /** @type {any} */
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    // Unreadable or blocked storage: start fresh.
  }
  const lang = raw && raw.lang in LANGUAGES ? raw.lang : fallbackLang;
  const library = sanitizeLibrary(raw, lang);
  return {
    lang,
    library,
    get project() {
      return currentEntry(this.library).project;
    },
    merge: raw?.merge !== false,
    delimiter: raw?.delimiter === ',' ? ',' : raw?.delimiter === ';' ? ';' : lang === 'en' ? ',' : ';',
  };
}

let state = loadState();

function save() {
  try {
    const { lang, merge, delimiter, library } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lang, merge, delimiter, currentId: library.currentId, projects: library.entries }));
  } catch {
    // Storage can be blocked (private mode); the projects then last this visit.
  }
}

let persistAsked = false;
/** The open project changed: note when, store, and ask once to keep storage. */
function changed() {
  currentEntry(state.library).updatedAt = Date.now();
  save();
  if (!persistAsked) {
    persistAsked = true;
    // Asks the browser not to clear the projects when space runs low.
    navigator.storage?.persist?.().catch(() => {});
  }
}

// Another tab changed the projects: take its version, so neither tab
// overwrites the other's work.
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY) return;
  state = loadState();
  renderAll();
});

const tr = (/** @type {string} */ key, /** @type {Record<string, string | number>} */ vars = {}) => t(state.lang, key, vars);

// ---- Rendering ----------------------------------------------------------------

function renderLanguages() {
  const nav = $('#languages');
  nav.replaceChildren(
    ...Object.entries(LANGUAGES).map(([code, name]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = name;
      b.lang = code;
      b.setAttribute('aria-pressed', String(code === state.lang));
      b.addEventListener('click', () => {
        state.lang = code;
        save();
        renderAll();
      });
      return b;
    }),
  );
}

function renderTexts() {
  document.documentElement.lang = state.lang;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = tr(el.getAttribute('data-i18n') ?? '');
}

/** A project's name, or "Untitled" if it has none. @param {import('./project.js').Project} project */
const projectLabel = (project) => project.name.trim() || tr('untitled');

/** The project menu: every project, the most recently changed first. */
function renderProjectList() {
  const select = /** @type {HTMLSelectElement} */ ($('#project-select'));
  const date = (/** @type {number} */ ms) => (ms ? new Date(ms).toLocaleDateString(state.lang === 'en' ? 'en-GB' : state.lang) : '');
  select.replaceChildren(
    ...sortedEntries(state.library).map((entry) => {
      const option = document.createElement('option');
      option.value = entry.id;
      const when = date(entry.updatedAt);
      option.textContent = when ? `${projectLabel(entry.project)} · ${when}` : projectLabel(entry.project);
      return option;
    }),
  );
  select.value = state.library.currentId;
}

function renderProjectForm() {
  renderProjectList();
  /** @type {HTMLInputElement} */ ($('#project-name')).value = state.project.name;
  for (const input of /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll('[data-setting]'))) {
    const value = /** @type {Record<string, unknown>} */ (state.project.settings)[input.dataset.setting ?? ''];
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = String(value);
  }
  /** @type {HTMLInputElement} */ ($('#merge')).checked = state.merge;
  /** @type {HTMLSelectElement} */ ($('#delimiter')).value = state.delimiter;
}

const INTEGER_FIELDS = new Set(['partitions', 'shelves', 'doors', 'drawers']);
const CABINET_FIELDS = /** @type {const} */ (['width', 'height', 'depth', 'partitions', 'shelves', 'doors', 'drawers']);

/** @param {import('./parts.js').Cabinet} cab @param {number} index */
function cabinetCard(cab, index) {
  const li = document.createElement('li');
  li.className = `cabinet ${cab.kind}`;
  li.dataset.id = cab.id;
  const last = index === state.project.cabinets.length - 1;
  const fields = CABINET_FIELDS.map((key) => {
    const integer = INTEGER_FIELDS.has(key);
    const unit = integer ? '' : `<span>${tr('mm')}</span>`;
    return `<label class="field"><span>${tr(key)}</span><span class="unit"><input data-field="${key}" type="number" min="0" step="${integer ? 1 : 0.5}" inputmode="${integer ? 'numeric' : 'decimal'}" value="${cab[key]}" />${unit}</span></label>`;
  }).join('');
  li.innerHTML = `
    <div class="cabinet-head">
      <span class="kind">${tr(`kind.${cab.kind}`)}</span>
      <input class="cabinet-name" data-field="name" type="text" aria-label="${tr('name')}" />
      <span class="actions">
        <button type="button" data-action="up" title="${tr('moveUp')}" aria-label="${tr('moveUp')}" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" data-action="down" title="${tr('moveDown')}" aria-label="${tr('moveDown')}" ${last ? 'disabled' : ''}>↓</button>
        <button type="button" data-action="duplicate">${tr('duplicate')}</button>
        <button type="button" data-action="remove" class="danger">${tr('remove')}</button>
      </span>
    </div>
    <div class="grid fields">${fields}</div>
    <p class="problem" hidden></p>
    <p class="note" hidden></p>`;
  /** @type {HTMLInputElement} */ (li.querySelector('.cabinet-name')).value = cab.name;
  return li;
}

function renderCabinets() {
  const list = $('#cabinets');
  list.replaceChildren(...state.project.cabinets.map(cabinetCard));
  $('#no-cabinets').hidden = state.project.cabinets.length > 0;
  renderProblems();
}

/** Problems shown under each cabinet. */
function renderProblems() {
  for (const cab of state.project.cabinets) {
    const p = /** @type {HTMLElement | null} */ (document.querySelector(`.cabinet[data-id="${cab.id}"] .problem`));
    if (!p) continue;
    const problems = cabinetProblems(cab, state.project.settings);
    p.hidden = problems.length === 0;
    p.textContent = problems.length ? [...problems.map((k) => tr(k)), tr('skipped')].join(' ') : '';
    const note = /** @type {HTMLElement} */ (p.nextElementSibling);
    const noShelves = !hasShelves(cab) && cab.shelves > 0;
    note.hidden = !noShelves;
    note.textContent = noShelves ? tr('noShelvesWithDrawers') : '';
  }
}

function currentParts() {
  const parts = projectParts(state.project.cabinets, state.project.settings);
  return state.merge ? mergeParts(parts) : parts;
}

/** The number in a cell as people write it in this language. */
const formatNumber = (/** @type {number} */ n, digits = 1) =>
  n.toLocaleString(state.lang === 'en' ? 'en-US' : state.lang, { maximumFractionDigits: digits, useGrouping: false });

function renderOutput() {
  const { settings, cabinets } = state.project;
  const buildable = cabinets.filter((c) => cabinetProblems(c, settings).length === 0);
  $('#drawing').innerHTML = frontView(buildable, settings, { title: tr('drawing') });
  $('#print-title').textContent = state.project.name;

  const parts = currentParts();
  const { header, rows } = cutListTable(parts, state.lang);
  const table = /** @type {HTMLTableElement} */ ($('#parts-table'));
  const WRAPS = new Set(['part', 'cabinet', 'material']);
  const cls = (/** @type {number} */ i) => (NUMERIC.has(COLUMNS[i]) ? ' class="num"' : WRAPS.has(COLUMNS[i]) ? '' : ' class="nowrap"');
  const esc = (/** @type {unknown} */ v) => String(v).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
  table.tHead.innerHTML = `<tr>${header.map((h, i) => `<th${cls(i)}>${esc(h)}</th>`).join('')}</tr>`;
  table.tBodies[0].innerHTML = rows
    .map((row) => `<tr>${row.map((v, i) => `<td${cls(i)}>${esc(typeof v === 'number' ? formatNumber(v) : v)}</td>`).join('')}</tr>`)
    .join('');
  table.hidden = rows.length === 0;
  $('#no-parts').hidden = rows.length > 0;

  const sums = totals(parts);
  const lines = [
    ...[...sums.materials].map(([material, m]) => `<li><b>${esc(material)}</b>: ${esc(tr('totalParts', { count: m.count, area: formatNumber(m.area, 2) }))}</li>`),
    ...[...sums.banding].map(([band, length]) => `<li>${esc(tr('totalBanding', { band: `${band} ${tr('mm')}`, length: formatNumber(length, 1) }))}</li>`),
  ];
  $('#totals').innerHTML = lines.length ? `<h3>${esc(tr('totals'))}</h3><ul>${lines.join('')}</ul>` : '';
}

function renderAll() {
  renderLanguages();
  renderTexts();
  renderProjectForm();
  renderCabinets();
  renderOutput();
}

// ---- Editing -------------------------------------------------------------------

/** A number from an input; NaN while it is empty or half typed. */
const readNumber = (/** @type {HTMLInputElement} */ input) => (input.value.trim() === '' ? NaN : Number(input.value.replace(',', '.')));

$('#project-name').addEventListener('input', (e) => {
  state.project.name = /** @type {HTMLInputElement} */ (e.target).value;
  changed();
  $('#print-title').textContent = state.project.name;
  renderProjectList();
});

$('#settings').addEventListener('input', (e) => {
  const input = /** @type {HTMLInputElement} */ (e.target);
  const key = input.dataset.setting;
  if (!key) return;
  const settings = /** @type {Record<string, unknown>} */ (state.project.settings);
  if (input.type === 'checkbox') settings[key] = input.checked;
  else if (input.type === 'number') {
    const n = readNumber(input);
    if (!Number.isFinite(n)) return; // keep the last good value while typing
    settings[key] = n;
  } else {
    settings[key] = input.value;
  }
  changed();
  renderProblems();
  renderOutput();
});

$('#cabinets').addEventListener('input', (e) => {
  const input = /** @type {HTMLInputElement} */ (e.target);
  const id = /** @type {HTMLElement} */ (input.closest('.cabinet'))?.dataset.id;
  const cab = state.project.cabinets.find((c) => c.id === id);
  const key = input.dataset.field;
  if (!cab || !key) return;
  if (key === 'name') cab.name = input.value;
  else {
    const n = readNumber(input);
    // An empty size counts as 0, so the cabinet shows "enter the width".
    /** @type {Record<string, number>} */ (/** @type {unknown} */ (cab))[key] = Number.isFinite(n) ? (INTEGER_FIELDS.has(key) ? Math.max(0, Math.round(n)) : n) : 0;
  }
  changed();
  renderProblems();
  renderOutput();
});

$('#cabinets').addEventListener('click', (e) => {
  const button = /** @type {HTMLElement} */ (e.target).closest('button[data-action]');
  if (!button) return;
  const cabinets = state.project.cabinets;
  const index = cabinets.findIndex((c) => c.id === /** @type {HTMLElement} */ (button.closest('.cabinet')).dataset.id);
  if (index < 0) return;
  const action = /** @type {HTMLElement} */ (button).dataset.action;
  if (action === 'remove') cabinets.splice(index, 1);
  else if (action === 'duplicate') {
    cabinets.splice(index + 1, 0, { ...cabinets[index], id: newId(), name: `${cabinets[index].name} (2)` });
  } else if (action === 'up' && index > 0) cabinets.splice(index - 1, 0, ...cabinets.splice(index, 1));
  else if (action === 'down' && index < cabinets.length - 1) cabinets.splice(index + 1, 0, ...cabinets.splice(index, 1));
  changed();
  renderCabinets();
  renderOutput();
});

for (const kind of KINDS) {
  $(`#add-${kind}`).addEventListener('click', () => {
    const cab = newCabinet(kind, state.project.cabinets, state.lang);
    state.project.cabinets.push(cab);
    changed();
    renderCabinets();
    renderOutput();
    /** @type {HTMLInputElement | null} */ (document.querySelector(`.cabinet[data-id="${cab.id}"] [data-field="width"]`))?.focus();
  });
}

$('#merge').addEventListener('change', (e) => {
  state.merge = /** @type {HTMLInputElement} */ (e.target).checked;
  save();
  renderOutput();
});

$('#delimiter').addEventListener('change', (e) => {
  state.delimiter = /** @type {HTMLSelectElement} */ (e.target).value === ',' ? ',' : ';';
  save();
});

// ---- Files ---------------------------------------------------------------------

/** A file name from the project name, safe on every system. */
function baseName() {
  const name = state.project.name.trim().replace(/[\\/:*?"<>|]+/g, '-');
  return name || 'aveji';
}

/** @param {string} text @param {string} name @param {string} type */
function download(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function tableForExport() {
  const { header, rows } = cutListTable(currentParts(), state.lang);
  return [header, ...rows];
}

/** @param {string} key */
function status(key) {
  const el = $('#status');
  el.textContent = tr(key);
  setTimeout(() => {
    if (el.textContent === tr(key)) el.textContent = '';
  }, 5000);
}

$('#download-csv').addEventListener('click', () => {
  download(csvFile(tableForExport(), { delimiter: state.delimiter }), `${baseName()}.csv`, 'text/csv;charset=utf-8');
});

$('#copy-table').addEventListener('click', async () => {
  const text = toDelimited(tableForExport(), { delimiter: '\t', decimalComma: state.delimiter === ';' });
  try {
    await navigator.clipboard.writeText(text);
    status('copied');
  } catch {
    status('copyFailed');
  }
});

$('#print').addEventListener('click', () => window.print());

// Browsers name a saved PDF after the page title, so use the project name
// while printing (also for Ctrl+P).
window.addEventListener('beforeprint', () => {
  document.title = state.project.name.trim() || 'Aveji';
});
window.addEventListener('afterprint', () => {
  document.title = 'Aveji';
});

$('#save-file').addEventListener('click', () => {
  const day = new Date().toISOString().slice(0, 10);
  download(backupFile(state.library), `aveji-${day}.aveji.json`, 'application/json');
});

$('#open-file').addEventListener('click', () => $('#file-input').click());

$('#file-input').addEventListener('change', async (e) => {
  const input = /** @type {HTMLInputElement} */ (e.target);
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const entries = readBackupFile(await file.text(), state.lang);
  if (!entries) {
    alert(tr('openFailed'));
    return;
  }
  const { added, updated } = restore(state.library, entries);
  save();
  renderAll();
  const note = $('#project-status');
  note.textContent = tr('restored', { added, updated });
  setTimeout(() => {
    if (note.textContent === tr('restored', { added, updated })) note.textContent = '';
  }, 8000);
});

// ---- Project list --------------------------------------------------------------

$('#project-select').addEventListener('change', (e) => {
  state.library.currentId = /** @type {HTMLSelectElement} */ (e.target).value;
  save();
  renderAll();
});

$('#new-project').addEventListener('click', () => {
  addProject(state.library, newProject(state.lang));
  save();
  renderAll();
  $('#project-name').focus();
});

$('#duplicate-project').addEventListener('click', () => {
  addProject(state.library, copyProject(state.project, tr('copyName', { name: projectLabel(state.project) })));
  save();
  renderAll();
});

$('#delete-project').addEventListener('click', () => {
  if (!confirm(tr('deleteConfirm', { name: projectLabel(state.project) }))) return;
  removeCurrent(state.library, state.lang);
  save();
  renderAll();
});

renderAll();
