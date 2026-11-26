import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cell, csvFile, toDelimited } from '../js/csv.js';
import { STRING_KEYS, detectLanguage, t } from '../js/i18n.js';
import { DEFAULT_SETTINGS, mergeParts, projectParts } from '../js/parts.js';
import { newCabinet, newProject, projectFile, readProjectFile, sanitizeProject } from '../js/project.js';
import { COLUMNS, cutListTable, edge } from '../js/table.js';
import { frontView } from '../js/drawing.js';

describe('CSV', () => {
  it('quotes only what needs quoting', () => {
    const o = { delimiter: ';' };
    assert.equal(cell('Side', o), 'Side');
    assert.equal(cell('a;b', o), '"a;b"');
    assert.equal(cell('say "hi"', o), '"say ""hi"""');
    assert.equal(cell('a,b', o), 'a,b');
    assert.equal(cell('a,b', { delimiter: ',' }), '"a,b"');
  });

  it('writes a decimal comma with semicolons, a point with commas', () => {
    assert.equal(cell(397.5, { delimiter: ';' }), '397,5');
    assert.equal(cell(397.5, { delimiter: ',' }), '397.5');
    assert.equal(cell(397.5, { delimiter: '\t', decimalComma: false }), '397.5');
    assert.equal(cell(397.5, { delimiter: '\t', decimalComma: true }), '397,5');
  });

  it('keeps tab-separated cells on one line', () => {
    assert.equal(cell('a\tb\nc', { delimiter: '\t' }), 'a b c');
  });

  it('writes rows with CRLF, and the file with a byte-order mark for Excel', () => {
    assert.equal(toDelimited([['a', 1], ['b', 2.5]], { delimiter: ';' }), 'a;1\r\nb;2,5\r\n');
    assert.ok(csvFile([['ა']], { delimiter: ';' }).startsWith('﻿ა'));
  });
});

describe('cut list table', () => {
  const settings = { ...DEFAULT_SETTINGS, carcassMaterial: 'LDSP', frontMaterial: 'MDF', backMaterial: 'HDF' };
  const cab = { id: 'x', name: 'B1', kind: 'base', width: 600, height: 720, depth: 560, shelves: 1, doors: 1 };

  it('has a translated header in column order', () => {
    const { header } = cutListTable([], 'ka');
    assert.equal(header.length, COLUMNS.length);
    assert.equal(header[1], 'დეტალი');
    assert.equal(cutListTable([], 'ru').header[6], 'Кол-во');
  });

  it('numbers the rows and names merged part types together', () => {
    const wall = { ...cab, kind: 'wall', depth: 300 };
    const { rows } = cutListTable(mergeParts(projectParts([wall], settings)), 'en');
    assert.deepEqual(rows.map((r) => r[0]), rows.map((_, i) => i + 1));
    assert.ok(rows.some((r) => r[1] === 'Top / Bottom'));
  });

  it('turns numeric banding into numbers, so spreadsheets read it in any locale', () => {
    assert.equal(edge('0.4'), 0.4);
    assert.equal(edge(' 0,4 '), 0.4);
    assert.equal(edge('2'), 2);
    assert.equal(edge('ABS 2'), 'ABS 2');
    assert.equal(edge(''), '');
  });
});

describe('project', () => {
  it('starts empty with material names in the chosen language', () => {
    const p = newProject('ru');
    assert.equal(p.settings.carcassMaterial, 'ЛДСП 18 мм');
    assert.deepEqual(p.cabinets, []);
  });

  it('names new cabinets by kind and count', () => {
    const first = newCabinet('wall', [], 'en');
    assert.equal(first.name, 'Wall 1');
    assert.equal(newCabinet('wall', [first], 'en').name, 'Wall 2');
    assert.equal(newCabinet('base', [first], 'ka').name, 'ქვედა 1');
  });

  it('survives a save and reopen', () => {
    const p = newProject('en');
    p.name = 'Kitchen';
    p.cabinets.push(newCabinet('base', [], 'en'));
    assert.deepEqual(readProjectFile(projectFile(p), 'en'), p);
  });

  it('refuses files that are not projects', () => {
    assert.equal(readProjectFile('not json', 'en'), null);
    assert.equal(readProjectFile('{"cabinets": []}', 'en'), null);
  });

  it('keeps the worktop switch, and turns it on for projects from before it existed', () => {
    assert.equal(sanitizeProject({ settings: { worktop: false }, cabinets: [] }, 'en')?.settings.worktop, false);
    assert.equal(sanitizeProject({ settings: {}, cabinets: [] }, 'en')?.settings.worktop, true);
    assert.equal(sanitizeProject({ settings: { worktop: 'yes' }, cabinets: [] }, 'en')?.settings.worktop, true);
  });

  it('repairs damaged data with defaults', () => {
    const p = sanitizeProject({ settings: { board: 'x', doorGap: 2 }, cabinets: [{ kind: 'bogus', width: 500, shelves: -3 }, null] }, 'en');
    assert.equal(p?.settings.board, 18);
    assert.equal(p?.settings.doorGap, 2);
    assert.equal(p?.cabinets.length, 1);
    assert.equal(p?.cabinets[0].kind, 'base');
    assert.equal(p?.cabinets[0].width, 500);
    assert.equal(p?.cabinets[0].shelves, 0);
    assert.ok(p?.cabinets[0].id);
  });
});

describe('front view', () => {
  const settings = { ...DEFAULT_SETTINGS };
  it('is empty without cabinets', () => {
    assert.equal(frontView([], settings, { title: 'x' }), '');
  });

  it('puts tall cabinets on the floor and hangs wall cabinets beside them, not over them', () => {
    const cab = (id, kind, width, height, extra = {}) => ({ id, name: id, kind, width, height, depth: 560, partitions: 0, shelves: 0, doors: 1, drawers: 0, ...extra });
    const svg = frontView([cab('B', 'base', 600, 720), cab('T', 'tall', 600, 2080), cab('W1', 'wall', 600, 720), cab('W2', 'wall', 400, 720)], settings, { title: 'x' });
    const xOf = (name) => Number(svg.match(new RegExp(`<text class="name" x="([\\d.]+)" [^>]*>${name}<`))[1]);
    assert.equal(xOf('T'), 900);
    assert.equal(xOf('W1'), 300);
    assert.equal(xOf('W2'), 1400); // after the tall cabinet (600..1200)
    // The worktop covers only the base cabinet.
    assert.match(svg, /class="worktop" x="0" [^>]*width="600"/);
  });

  it('draws drawer faces above the doors', () => {
    const svg = frontView([{ id: 'a', name: 'A', kind: 'base', width: 600, height: 720, depth: 560, partitions: 0, shelves: 0, doors: 1, drawers: 2 }], settings, { title: 'x' });
    assert.equal(svg.match(/class="door"/g)?.length, 3);
    assert.ok(!svg.includes('NaN'));
  });

  it('draws partitions as dashed lines', () => {
    const svg = frontView([{ id: 'a', name: 'A', kind: 'base', width: 900, height: 720, depth: 560, partitions: 2, shelves: 0, doors: 3 }], settings, { title: 'x' });
    assert.equal(svg.match(/class="partition"/g)?.length, 2);
  });

  it('draws each cabinet and escapes names', () => {
    const svg = frontView(
      [
        { id: 'a', name: 'A<1>', kind: 'base', width: 600, height: 720, depth: 560, shelves: 0, doors: 2 },
        { id: 'b', name: 'B', kind: 'wall', width: 400, height: 720, depth: 300, shelves: 0, doors: 1 },
      ],
      settings,
      { title: 'Front' },
    );
    assert.equal(svg.match(/class="carcass"/g)?.length, 2);
    assert.equal(svg.match(/class="door"/g)?.length, 3);
    assert.equal(svg.match(/class="partition"/g), null);
    assert.ok(svg.includes('A&lt;1&gt;'));
    // Every attribute is a plain quoted value (no stray quotes).
    assert.doesNotMatch(svg, /=""|"[^"\s=<>]*"[^\s/>]/);
    assert.match(svg, /<text class="name" x="300" /);
    assert.ok(!svg.includes('NaN'));
  });
});

describe('languages', () => {
  it('have the same strings', () => {
    for (const lang of ['ka', 'ru']) assert.deepEqual([...STRING_KEYS[lang]].sort(), [...STRING_KEYS.en].sort(), lang);
  });

  it('fill in values', () => {
    assert.equal(t('en', 'newName.base', { n: 3 }), 'Base 3');
  });

  it('default to Georgian', () => {
    assert.equal(detectLanguage('ru-RU'), 'ru');
    assert.equal(detectLanguage('de-DE'), 'ka');
    assert.equal(detectLanguage(undefined), 'ka');
  });
});
