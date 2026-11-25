// @ts-check
/**
 * The page: the project form, the cabinet list, the drawing and the cut
 * list. Everything is kept in the browser (localStorage); a project can also
 * be saved to and opened from a file.
 */

import { csvFile, toDelimited } from './csv.js';
import { frontView } from './drawing.js';
import { detectLanguage, LANGUAGES, t } from './i18n.js';
import { cabinetProblems, mergeParts, projectParts, totals } from './parts.js';
import { newCabinet, newId, newProject, projectFile, readProjectFile, sanitizeProject } from './project.js';
import { COLUMNS, cutListTable, NUMERIC } from './table.js';

const STORAGE_KEY = 'aveji.state.v1';

/** @param {string} selector */
const $ = (selector) => /** @type {HTMLElement} */ (document.querySelector(selector));

/**
 * @typedef {object} State
 * @property {string} lang
 * @property {import('./project.js').Project} project
 * @property {boolean} merge       combine identical parts in the list
 * @property {',' | ';'} delimiter  CSV flavour
 */

/** @returns {State} */
function loadState() {
  const fallbackLang = detectLanguage(navigator.language);
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    const lang = raw && raw.lang in LANGUAGES ? raw.lang : fallbackLang;
    return {
      lang,
      project: sanitizeProject(raw?.project, lang) ?? newProject(lang),
      merge: raw?.merge !== false,
      delimiter: raw?.delimiter === ',' ? ',' : ';',
    };
  } catch {
    return { lang: fallbackLang, project: newProject(fallbackLang), merge: true, delimiter: fallbackLang === 'en' ? ',' : ';' };
  }
}

const state = loadState();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be blocked (private mode); the project then lasts this visit.
  }
}

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

function renderProjectForm() {
  /** @type {HTMLInputElement} */ ($('#project-name')).value = state.project.name;
  for (const input of /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll('[data-setting]'))) {
    input.value = String(/** @type {Record<string, unknown>} */ (state.project.settings)[input.dataset.setting ?? '']);
  }
  /** @type {HTMLInputElement} */ ($('#merge')).checked = state.merge;
  /** @type {HTMLSelectElement} */ ($('#delimiter')).value = state.delimiter;
}

const CABINET_FIELDS = /** @type {const} */ (['width', 'height', 'depth', 'shelves', 'doors']);

/** @param {import('./parts.js').Cabinet} cab @param {number} index */
function cabinetCard(cab, index) {
  const li = document.createElement('li');
  li.className = `cabinet ${cab.kind}`;
  li.dataset.id = cab.id;
  const last = index === state.project.cabinets.length - 1;
  const fields = CABINET_FIELDS.map((key) => {
    const integer = key === 'shelves' || key === 'doors';
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
    <p class="problem" hidden></p>`;
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
  }
}

function currentParts() {
  const parts = projectParts(state.project.cabinets, state.project.settings);
  return state.merge ? mergeParts(parts) : parts;
}

/** The number in a cell as people write it in this language. */
const formatNumber = (/** @type {number} */ n, digits = 1) =>
  n.toLocaleString(state.lang === 'en' ? 'en-US' : state.lang, { maximumFractionDigits: digits });

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
  save();
  $('#print-title').textContent = state.project.name;
});

$('#settings').addEventListener('input', (e) => {
  const input = /** @type {HTMLInputElement} */ (e.target);
  const key = input.dataset.setting;
  if (!key) return;
  const settings = /** @type {Record<string, unknown>} */ (state.project.settings);
  if (input.type === 'number') {
    const n = readNumber(input);
    if (!Number.isFinite(n)) return; // keep the last good value while typing
    settings[key] = n;
  } else {
    settings[key] = input.value;
  }
  save();
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
    /** @type {Record<string, number>} */ (/** @type {unknown} */ (cab))[key] = Number.isFinite(n) ? (key === 'shelves' || key === 'doors' ? Math.max(0, Math.round(n)) : n) : 0;
  }
  save();
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
  save();
  renderCabinets();
  renderOutput();
});

for (const kind of /** @type {const} */ (['base', 'wall'])) {
  $(`#add-${kind}`).addEventListener('click', () => {
    const cab = newCabinet(kind, state.project.cabinets, state.lang);
    state.project.cabinets.push(cab);
    save();
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

$('#save-file').addEventListener('click', () => {
  download(projectFile(state.project), `${baseName()}.aveji.json`, 'application/json');
});

$('#open-file').addEventListener('click', () => $('#file-input').click());

$('#file-input').addEventListener('change', async (e) => {
  const input = /** @type {HTMLInputElement} */ (e.target);
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const project = readProjectFile(await file.text(), state.lang);
  if (!project) {
    alert(tr('openFailed'));
    return;
  }
  state.project = project;
  save();
  renderAll();
});

$('#new-project').addEventListener('click', () => {
  if (state.project.cabinets.length > 0 && !confirm(tr('newProjectConfirm'))) return;
  state.project = newProject(state.lang);
  save();
  renderAll();
});

renderAll();
