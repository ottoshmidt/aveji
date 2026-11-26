import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addProject,
  backupFile,
  copyProject,
  currentEntry,
  emptyLibrary,
  readBackupFile,
  removeCurrent,
  restore,
  sanitizeLibrary,
  sortedEntries,
} from '../js/library.js';
import { newCabinet, newProject, projectFile } from '../js/project.js';

/** @param {string} name */
const named = (name) => ({ ...newProject('en'), name });

describe('project library', () => {
  it('starts with one empty project, open', () => {
    const lib = emptyLibrary('en');
    assert.equal(lib.entries.length, 1);
    assert.equal(currentEntry(lib).id, lib.currentId);
    assert.deepEqual(currentEntry(lib).project.cabinets, []);
  });

  it('keeps the project the first version stored', () => {
    const old = named('Old kitchen');
    old.cabinets.push(newCabinet('base', [], 'en'));
    const lib = sanitizeLibrary({ lang: 'en', project: old, merge: true }, 'en');
    assert.equal(lib.entries.length, 1);
    assert.equal(currentEntry(lib).project.name, 'Old kitchen');
    assert.equal(currentEntry(lib).project.cabinets.length, 1);
  });

  it('reads stored projects and which one was open, skipping broken ones', () => {
    const lib = sanitizeLibrary(
      {
        currentId: 'b',
        projects: [
          { id: 'a', updatedAt: 1, project: named('A') },
          { id: 'b', updatedAt: 2, project: named('B') },
          { id: 'c', updatedAt: 3, project: 'garbage' },
        ],
      },
      'en',
    );
    assert.deepEqual(lib.entries.map((e) => e.id), ['a', 'b']);
    assert.equal(currentEntry(lib).project.name, 'B');
  });

  it('opens the first project when the open one is missing, and is never empty', () => {
    const lib = sanitizeLibrary({ currentId: 'gone', projects: [{ id: 'a', updatedAt: 1, project: named('A') }] }, 'en');
    assert.equal(lib.currentId, 'a');
    assert.equal(sanitizeLibrary(null, 'en').entries.length, 1);
    assert.equal(sanitizeLibrary({ projects: [] }, 'en').entries.length, 1);
  });

  it('gives duplicate ids new ones', () => {
    const lib = sanitizeLibrary({ projects: [{ id: 'a', project: named('A') }, { id: 'a', project: named('B') }] }, 'en');
    assert.equal(new Set(lib.entries.map((e) => e.id)).size, 2);
  });

  it('adds projects and opens them', () => {
    const lib = emptyLibrary('en');
    const entry = addProject(lib, named('New'));
    assert.equal(lib.entries.length, 2);
    assert.equal(lib.currentId, entry.id);
  });

  it('lists the most recently changed first', () => {
    const lib = sanitizeLibrary({ projects: [{ id: 'a', updatedAt: 1, project: named('A') }, { id: 'b', updatedAt: 5, project: named('B') }] }, 'en');
    assert.deepEqual(sortedEntries(lib).map((e) => e.id), ['b', 'a']);
  });

  it('removes the open project and opens the most recent other one', () => {
    const lib = sanitizeLibrary(
      {
        currentId: 'b',
        projects: [
          { id: 'a', updatedAt: 1, project: named('A') },
          { id: 'b', updatedAt: 5, project: named('B') },
          { id: 'c', updatedAt: 3, project: named('C') },
        ],
      },
      'en',
    );
    removeCurrent(lib, 'en');
    assert.deepEqual(lib.entries.map((e) => e.id), ['a', 'c']);
    assert.equal(lib.currentId, 'c');
  });

  it('starts a fresh project when the last one is removed', () => {
    const lib = emptyLibrary('en');
    const before = lib.currentId;
    removeCurrent(lib, 'en');
    assert.equal(lib.entries.length, 1);
    assert.notEqual(lib.currentId, before);
  });

  it('copies a project without sharing anything with it', () => {
    const original = named('A');
    original.cabinets.push(newCabinet('base', [], 'en'));
    const copy = copyProject(original, 'A (copy)');
    copy.cabinets[0].width = 999;
    copy.settings.board = 16;
    assert.equal(copy.name, 'A (copy)');
    assert.equal(original.name, 'A');
    assert.equal(original.cabinets[0].width, 600);
    assert.equal(original.settings.board, 18);
  });
});

describe('backup and restore', () => {
  const library = () =>
    sanitizeLibrary(
      {
        currentId: 'a',
        projects: [
          { id: 'a', updatedAt: 10, project: named('A') },
          { id: 'b', updatedAt: 20, project: named('B') },
        ],
      },
      'en',
    );

  it('saves every project and reads them all back', () => {
    const lib = library();
    const entries = readBackupFile(backupFile(lib), 'en');
    assert.deepEqual(entries, lib.entries);
  });

  it('also reads a single project saved by an earlier version', () => {
    const entries = readBackupFile(projectFile(named('Old')), 'en');
    assert.equal(entries?.length, 1);
    assert.equal(entries?.[0].project.name, 'Old');
  });

  it('refuses other files, and reads an empty backup as no projects', () => {
    assert.equal(readBackupFile('not json', 'en'), null);
    assert.equal(readBackupFile('{"format":"something-else"}', 'en'), null);
    assert.deepEqual(readBackupFile('{"format":"aveji-backup","projects":[]}', 'en'), []);
  });

  it('adds new projects, replaces older copies, and keeps newer ones', () => {
    const lib = library();
    const result = restore(lib, [
      { id: 'a', updatedAt: 5, project: named('A old') }, // older: kept as is
      { id: 'b', updatedAt: 30, project: named('B newer') }, // newer: replaces
      { id: 'c', updatedAt: 1, project: named('C') }, // new: added
    ]);
    assert.deepEqual(result, { added: 1, updated: 1 });
    assert.deepEqual(lib.entries.map((e) => e.project.name), ['A', 'B newer', 'C']);
    assert.equal(lib.currentId, 'a', 'the open project stays open');
  });

  it('on a new device, replaces the one empty project and opens the newest restored one', () => {
    const lib = emptyLibrary('en');
    restore(lib, library().entries);
    assert.deepEqual(lib.entries.map((e) => e.id), ['a', 'b']);
    assert.equal(lib.currentId, 'b');
  });

  it('keeps an empty project that has a name', () => {
    const lib = emptyLibrary('en');
    lib.entries[0].project.name = 'Started';
    restore(lib, library().entries);
    assert.equal(lib.entries.length, 3);
  });
});
