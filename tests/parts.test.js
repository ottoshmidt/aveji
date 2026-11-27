import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cabinetParts,
  cabinetProblems,
  DEFAULT_CABINETS,
  doorArea,
  frontLayout,
  hasDivider,
  DEFAULT_SETTINGS,
  frontHeights,
  hasShelves,
  mergeParts,
  projectParts,
  round,
  runnerLength,
  totals,
} from '../js/parts.js';

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

  it('has a hanging rail at the back, unless its width is 0', () => {
    const rail = find(parts, 'hangingRail');
    assert.deepEqual([rail.length, rail.width, rail.qty, rail.material], [764, 80, 1, 'LDSP 18']);
    assert.deepEqual(rail.edges, { L1: '', L2: '', W1: '', W2: '' });
    assert.equal(find(cabinetParts(wall, { ...settings, hangingRail: 0 }), 'hangingRail'), undefined);
    assert.equal(find(cabinetParts(base, settings), 'hangingRail'), undefined);
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

describe('partitions', () => {
  const split = { ...base, width: 800, partitions: 1, shelves: 2, doors: 2 };
  const parts = cabinetParts(split, settings);

  it('stand between the bottom and the rails, full depth, banded at the front', () => {
    const p = find(parts, 'partition');
    assert.deepEqual([p.length, p.width, p.qty], [684, 560, 1]);
    assert.equal(p.edges.L1, '0.4');
  });

  it('split the shelves into equal sections, with shelves counted per section', () => {
    const shelf = find(parts, 'shelf');
    // Inside 800 - 2*18 = 764, less one partition = 746, two sections of 373.
    assert.deepEqual([shelf.length, shelf.qty], [371, 4]);
  });

  it('are absent by default and from old projects', () => {
    assert.equal(find(cabinetParts(base, settings), 'partition'), undefined);
    const { partitions, ...old } = split;
    assert.equal(find(cabinetParts(old, settings), 'partition'), undefined);
  });

  it('cannot leave sections narrower than 50 mm', () => {
    assert.deepEqual(cabinetProblems({ ...split, partitions: 15, doors: 1 }, settings), ['problem.tooManyPartitions']);
  });
});

describe('drawers', () => {
  const s = settings;
  const chest = { ...base, drawers: 3, doors: 0 };
  const parts = cabinetParts(chest, s);

  it('share the height equally when there are no doors, faces banded all round', () => {
    const face = find(parts, 'drawerFace');
    // (720 - 3 * 3) / 3 = 237; the grain runs across the cabinet.
    assert.deepEqual([face.length, face.width, face.qty, face.material], [597, 237, 3, 'MDF 18']);
    assert.deepEqual(face.edges, { L1: '1', L2: '1', W1: '1', W2: '1' });
  });

  it('have boxes between the runners, as deep as the longest runner that fits', () => {
    // Inside 564, less 2 * 13 for runners = 538 box width; 550 mm runner in 560.
    // Sides and ends are the carcass material, the bottom the back material.
    const side = find(parts, 'boxSide');
    const end = find(parts, 'boxEnd');
    const bottom = find(parts, 'boxBottom');
    assert.deepEqual([side.length, side.width, side.qty, side.material], [550, 197, 6, 'LDSP 18']);
    // Box ends between the sides, of the carcass board: 538 - 2 * 18.
    assert.deepEqual([end.length, end.width, end.qty, end.material], [502, 197, 6, 'LDSP 18']);
    assert.deepEqual([bottom.length, bottom.width, bottom.qty, bottom.material, bottom.grain], [550, 538, 3, 'HDF 3', false]);
    assert.equal(side.edges.L1, '0.4');
  });

  it('pick standard runner lengths', () => {
    assert.equal(runnerLength(560), 550);
    assert.equal(runnerLength(559), 500);
    assert.equal(runnerLength(300), 250);
    assert.equal(runnerLength(259), undefined);
  });

  it('leave out shelves when they fill the cabinet', () => {
    assert.equal(find(parts, 'shelf'), undefined);
    assert.equal(hasShelves(chest), false);
  });

  it('sit above the doors at the set height, the doors taking the rest', () => {
    const mixed = cabinetParts({ ...base, drawers: 1, doors: 1 }, s);
    assert.deepEqual([find(mixed, 'drawerFace').width, find(mixed, 'drawerFace').qty], [150, 1]);
    // 720 - (150 + 3) - 3
    assert.equal(find(mixed, 'door').length, 564);
    assert.equal(find(mixed, 'shelf').qty, 1);
    assert.deepEqual(frontHeights({ ...base, drawers: 1, doors: 1 }, s), { drawerHeight: 150, doorHeight: 564, rows: 1 });
  });

  it('refuse what cannot be built', () => {
    assert.deepEqual(cabinetProblems({ ...chest, partitions: 1 }, s), ['problem.drawersAndPartitions']);
    assert.deepEqual(cabinetProblems({ ...chest, depth: 250 }, s), ['problem.tooShallowForDrawers']);
    assert.deepEqual(cabinetProblems({ ...chest, width: 130 }, s), ['problem.tooNarrowForDrawers']);
    assert.deepEqual(cabinetProblems({ ...chest, drawers: 9 }, s), ['problem.tooManyDrawers']);
    assert.deepEqual(cabinetProblems({ ...base, drawers: 5, doors: 1 }, s), ['problem.tooManyDrawers']);
  });
});

describe('tall cabinet', () => {
  const tall = { id: 't', name: 'T1', kind: 'tall', ...DEFAULT_CABINETS.tall };
  const parts = cabinetParts(tall, settings);

  it('reaches the top of the wall cabinets by default', () => {
    // legs + carcass = 100 + 2080 = 2180 = 100 + 720 + 40 + 600 + 720
    assert.equal(100 + tall.height, 100 + 720 + 40 + 600 + 720);
  });

  it('has a top and a bottom like a wall cabinet, and a full-height door', () => {
    assert.equal(find(parts, 'side').length, 2080);
    assert.equal(find(parts, 'top').length, 564);
    assert.equal(find(parts, 'railFront'), undefined);
    assert.equal(find(parts, 'door').length, 2077);
    assert.equal(find(parts, 'shelf').qty, 4);
  });
});

describe('drawers above or below the doors', () => {
  it('go above in base and wall cabinets, and below in tall ones, by default', () => {
    const f = frontLayout({ ...base, drawers: 1, doors: 1 }, settings);
    assert.deepEqual(f.map((x) => [x.kind, x.y]), [['drawer', 568.5], ['door', 1.5]]);
    const tall = { id: 't', name: 'T', kind: 'tall', ...DEFAULT_CABINETS.tall, drawers: 2 };
    assert.deepEqual(frontLayout(tall, settings).map((x) => [x.kind, x.y]), [['door', 307.5], ['drawer', 154.5], ['drawer', 1.5]]);
  });

  it('follow the choice, with the same sizes either way', () => {
    const below = { ...base, drawers: 1, doors: 1, drawersAt: 'bottom' };
    assert.deepEqual(frontLayout(below, settings).map((x) => [x.kind, x.y, x.height]), [['door', 154.5, 564], ['drawer', 1.5, 150]]);
    assert.deepEqual(cabinetParts(below, settings), cabinetParts({ ...below, drawersAt: 'top' }, settings));
  });

  it('leave 1.5 mm at the top and bottom and 3 mm between fronts', () => {
    const f = frontLayout({ ...base, drawers: 3, doors: 0 }, settings);
    assert.equal(f[0].y + f[0].height, 720 - 1.5);
    assert.equal(f.at(-1).y, 1.5);
  });
});

describe('tall cabinet compartments', () => {
  const tall = { id: 't', name: 'T', kind: 'tall', ...DEFAULT_CABINETS.tall };

  it('split the door area with horizontal partitions, each compartment with its own doors', () => {
    const parts = cabinetParts({ ...tall, hPartitions: 1, doors: 2 }, settings);
    const h = find(parts, 'hPartition');
    assert.deepEqual([h.length, h.width, h.qty, h.edges.L1], [564, 560, 1, '0.4']);
    const door = find(parts, 'door');
    // (2080 - 2 * 3) / 2 = 1037 high; 2 side by side in each of 2 rows.
    assert.deepEqual([door.length, door.width, door.qty], [1037, 297, 4]);
    // Shelves per section, in each compartment.
    assert.equal(find(parts, 'shelf').qty, 8);
  });

  it('cut vertical partitions to fit inside each compartment', () => {
    const p = find(cabinetParts({ ...tall, hPartitions: 1, partitions: 1 }, settings), 'partition');
    // Inside 2044, less one board, in two: 1013.
    assert.deepEqual([p.length, p.qty], [1013, 2]);
  });

  it('stacks the doors one above the other in the layout', () => {
    const f = frontLayout({ ...tall, hPartitions: 2 }, settings);
    assert.equal(f.length, 3);
    assert.ok(f[0].y > f[1].y && f[1].y > f[2].y);
  });

  it('has a board between drawers and doors', () => {
    const withDrawers = { ...tall, drawers: 2 };
    const parts = cabinetParts(withDrawers, settings);
    assert.equal(find(parts, 'hPartition').qty, 1);
    assert.equal(find(parts, 'door').length, 1771);
    assert.equal(hasDivider(withDrawers), true);
    // The door area starts above the drawers: 2 * (150 + 3).
    assert.deepEqual(doorArea(withDrawers, settings), { start: 306, height: 1756, compartment: 1756, rows: 1 });
    // No board in a base cabinet with a drawer above a door.
    assert.equal(find(cabinetParts({ ...base, drawers: 1 }, settings), 'hPartition'), undefined);
  });

  it('are only for tall cabinets', () => {
    assert.equal(find(cabinetParts({ ...wall, hPartitions: 2 }, settings), 'hPartition'), undefined);
    assert.equal(find(cabinetParts({ ...wall, hPartitions: 2 }, settings), 'door').qty, 2);
  });

  it('cannot be too many for the height', () => {
    assert.deepEqual(cabinetProblems({ ...tall, hPartitions: 30 }, settings), ['problem.tooManyHPartitions']);
    assert.deepEqual(cabinetProblems({ ...tall, hPartitions: 3 }, settings), []);
  });
});

describe('worktop', () => {
  const s = { ...settings, worktop: true, worktopMaterial: 'Worktop 38' };
  const cab = (name, kind, width) => ({ ...base, id: name, name, kind, width });
  const worktops = (cabinets, settings = s) => projectParts(cabinets, settings).filter((p) => p.type === 'worktop');

  it('is one piece per run of base cabinets, as long as the run', () => {
    const tops = worktops([cab('B1', 'base', 600), cab('B2', 'base', 800), cab('W1', 'wall', 600), cab('B3', 'base', 450)]);
    // Wall cabinets do not break a run.
    assert.equal(tops.length, 1);
    assert.deepEqual([tops[0].length, tops[0].width, tops[0].material, tops[0].cabinet], [1850, 600, 'Worktop 38', 'B1, B2, B3']);
  });

  it('starts a new piece after a tall cabinet', () => {
    const tops = worktops([cab('B1', 'base', 600), cab('T1', 'tall', 600), cab('B2', 'base', 900)]);
    assert.deepEqual(tops.map((t) => t.length), [600, 900]);
  });

  it('is left out when switched off, or without base cabinets', () => {
    assert.deepEqual(worktops([cab('B1', 'base', 600)], { ...s, worktop: false }), []);
    assert.deepEqual(worktops([cab('W1', 'wall', 600)]), []);
  });

  it('overhangs at the ends of the kitchen, but not against a tall cabinet', () => {
    const o = { ...s, worktopOverhangLeft: 20, worktopOverhangRight: 30 };
    assert.deepEqual(worktops([cab('B1', 'base', 600), cab('B2', 'base', 600)], o).map((t) => t.length), [1250]);
    // Tall cabinet on the right: no overhang there.
    assert.deepEqual(worktops([cab('B1', 'base', 600), cab('T1', 'tall', 600)], o).map((t) => t.length), [620]);
    // Tall cabinet in the middle: each run overhangs only at its outer end.
    assert.deepEqual(worktops([cab('B1', 'base', 600), cab('T1', 'tall', 600), cab('B2', 'base', 600)], o).map((t) => t.length), [620, 630]);
  });

  it('is cut into pieces no longer than the material, joining over a cabinet side', () => {
    const run = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'].map((n) => cab(n, 'base', 800)); // 5600 mm
    const tops = worktops(run, { ...s, worktopMaxLength: 3050 });
    assert.deepEqual(tops.map((t) => t.length), [2400, 2400, 800]);
    assert.deepEqual(tops.map((t) => t.cabinet), ['B1, B2, B3', 'B4, B5, B6', 'B7']);
    assert.ok(tops.every((t) => t.length <= 3050));
  });

  it('counts the overhangs when cutting', () => {
    const run = [cab('B1', 'base', 1000), cab('B2', 'base', 1000), cab('B3', 'base', 1000)];
    // 20 + 3000 + 20 = 3040 fits in one 3050 piece; with 40 mm ends it does not.
    assert.deepEqual(worktops(run, { ...s, worktopMaxLength: 3050, worktopOverhangLeft: 20, worktopOverhangRight: 20 }).map((t) => t.length), [3040]);
    assert.deepEqual(worktops(run, { ...s, worktopMaxLength: 3050, worktopOverhangLeft: 40, worktopOverhangRight: 40 }).map((t) => t.length), [2040, 1040]);
  });

  it('splits a single cabinet longer than the material into equal pieces', () => {
    assert.deepEqual(worktops([cab('B1', 'base', 5000)], { ...s, worktopMaxLength: 3050 }).map((t) => t.length), [2500, 2500]);
  });

  it('follows the depth setting, and skips cabinets with problems', () => {
    const tops = worktops([cab('B1', 'base', 600), cab('B2', 'base', 0)], { ...s, worktopDepth: 650 });
    assert.deepEqual([tops[0].length, tops[0].width], [600, 650]);
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
    // The same parts as one cabinet (the worktop is off by default).
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
