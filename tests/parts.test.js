import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cabinetParts, cabinetProblems, DEFAULT_SETTINGS, mergeParts, projectParts, round, totals } from '../js/parts.js';

const settings = { ...DEFAULT_SETTINGS, carcassMaterial: 'LDSP 18', frontMaterial: 'MDF 18', backMaterial: 'HDF 3' };
const base = { id: 'a', name: 'B1', kind: 'base', width: 600, height: 720, depth: 560, shelves: 1, doors: 1 };
const wall = { id: 'b', name: 'W1', kind: 'wall', width: 800, height: 720, depth: 300, shelves: 2, doors: 2 };

/** @param {any[]} parts @param {string} type */
const find = (parts, type) => parts.find((p) => p.type === type);

describe('base cabinet parts', () => {
  const parts = cabinetParts(base, settings);

  it('has full-height sides with a banded front edge', () => {
    assert.deepEqual(find(parts, 'side'), {
      type: 'side', cabinet: 'B1', material: 'LDSP 18', length: 720, width: 560, qty: 2, grain: true,
      edges: { L1: '0.4', L2: '', W1: '', W2: '' },
    });
  });

  it('has a bottom and two rails between the sides, and no top', () => {
    assert.equal(find(parts, 'bottom').length, 564);
    assert.equal(find(parts, 'bottom').width, 560);
    assert.deepEqual([find(parts, 'railFront').length, find(parts, 'railFront').width], [564, 100]);
    assert.equal(find(parts, 'railFront').edges.L1, '0.4');
    assert.equal(find(parts, 'railBack').edges.L1, '');
    assert.equal(find(parts, 'top'), undefined);
  });

  it('has shelves with play between the sides, set back from the front', () => {
    assert.deepEqual([find(parts, 'shelf').length, find(parts, 'shelf').width, find(parts, 'shelf').qty], [562, 540, 1]);
  });

  it('has a back slightly smaller than the cabinet, without grain or banding', () => {
    const back = find(parts, 'back');
    assert.deepEqual([back.length, back.width, back.material, back.grain], [716, 596, 'HDF 3', false]);
    assert.deepEqual(back.edges, { L1: '', L2: '', W1: '', W2: '' });
  });

  it('has a full-overlay door banded all round', () => {
    const door = find(parts, 'door');
    assert.deepEqual([door.length, door.width, door.qty, door.material], [717, 597, 1, 'MDF 18']);
    assert.deepEqual(door.edges, { L1: '1', L2: '1', W1: '1', W2: '1' });
  });
});

describe('wall cabinet parts', () => {
  const parts = cabinetParts(wall, settings);

  it('has a top and a bottom, and no rails', () => {
    assert.equal(find(parts, 'top').length, 764);
    assert.equal(find(parts, 'bottom').width, 300);
    assert.equal(find(parts, 'railFront'), undefined);
  });

  it('splits the width between two doors, leaving the gaps', () => {
    const door = find(parts, 'door');
    assert.deepEqual([door.length, door.width, door.qty], [717, 397, 2]);
    assert.equal(door.width * 2 + 2 * settings.doorGap, wall.width);
  });

  it('leaves out shelves and doors when there are none', () => {
    const bare = cabinetParts({ ...wall, shelves: 0, doors: 0 }, settings);
    assert.equal(find(bare, 'shelf'), undefined);
    assert.equal(find(bare, 'door'), undefined);
  });

  it('follows the settings', () => {
    const thick = cabinetParts(wall, { ...settings, board: 16, doorGap: 4 });
    assert.equal(find(thick, 'top').length, 768);
    assert.deepEqual([find(thick, 'door').length, find(thick, 'door').width], [716, 396]);
  });
});

describe('problems', () => {
  it('finds none in a normal cabinet', () => {
    assert.deepEqual(cabinetProblems(base, settings), []);
  });

  it('asks for missing sizes', () => {
    assert.deepEqual(cabinetProblems({ ...base, width: 0, depth: NaN }, settings), ['problem.width', 'problem.depth']);
  });

  it('refuses impossible cabinets', () => {
    assert.deepEqual(cabinetProblems({ ...base, width: 37, doors: 0 }, settings), ['problem.tooNarrow']);
    assert.deepEqual(cabinetProblems({ ...base, depth: 15 }, settings), ['problem.tooShallow']);
    assert.deepEqual(cabinetProblems({ ...base, doors: 12 }, settings), ['problem.tooManyDoors']);
  });

  it('leaves such cabinets out of the project parts', () => {
    const parts = projectParts([base, { ...wall, width: 0 }], settings);
    assert.ok(parts.every((p) => p.cabinet === 'B1'));
  });
});

describe('merging and totals', () => {
  it('rounds to half a millimetre', () => {
    assert.equal(round(197.3333), 197.5);
    assert.equal(round(197.2), 197);
  });

  it('adds up identical parts and names every cabinet they come from', () => {
    const twin = { ...base, id: 'c', name: 'B2' };
    const merged = mergeParts(projectParts([base, twin], settings));
    const sides = merged.find((p) => p.type === 'side');
    assert.equal(sides.qty, 4);
    assert.equal(sides.cabinet, 'B1, B2');
    assert.equal(merged.length, cabinetParts(base, settings).length);
  });

  it('keeps parts apart when their banding differs', () => {
    const merged = mergeParts(cabinetParts(base, settings));
    // Front and back rails are the same size but banded differently.
    assert.equal(merged.filter((p) => p.length === 564 && p.width === 100).length, 2);
  });

  it('combines different part types of the same cut', () => {
    // A wall cabinet's top and bottom are cut the same way.
    const merged = mergeParts(cabinetParts(wall, settings));
    const both = merged.find((p) => p.type.includes('top'));
    assert.equal(both.type, 'top,bottom');
    assert.equal(both.qty, 2);
  });

  it('sums area per material and banding per type', () => {
    const parts = cabinetParts({ ...base, shelves: 0, doors: 0 }, settings);
    const { materials, banding } = totals(parts);
    assert.equal(materials.get('HDF 3').count, 1);
    assert.ok(Math.abs(materials.get('HDF 3').area - 0.716 * 0.596) < 1e-9);
    // Front edges: 2 sides (720), bottom (564), front rail (564), each + 20 mm.
    assert.ok(Math.abs(banding.get('0.4') - (2 * 740 + 584 + 584) / 1000) < 1e-9);
  });
});
