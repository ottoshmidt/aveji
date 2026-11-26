import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addProject, copyProject, currentEntry, emptyLibrary, removeCurrent, sanitizeLibrary, sortedEntries } from '../js/library.js';
import { newCabinet, newProject } from '../js/project.js';

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
