// @ts-check
/**
 * Cabinets -> parts. Pure functions, no DOM, so they are unit-tested.
 *
 * Construction (one common way; the numbers live in Settings):
 *   - Sides run the full height; everything else sits between them.
 *   - Base cabinet: a bottom, and two rails (front and back) instead of a top,
 *     since the worktop covers it.
 *   - Wall and tall cabinets: a top and a bottom. A tall cabinet stands on the
 *     floor and reaches the top of the wall cabinets. A wall cabinet also has a
 *     hanging rail (`hangingRail` wide, 0 for none): a strip between the sides,
 *     at the back under the top, that it hangs on.
 *   - Partitions (vertical boards) split the inside into equal sections. They
 *     stand on the bottom and reach the top (or the rails), full depth.
 *   - A tall cabinet can also have horizontal partitions: fixed boards between
 *     the sides that split the door area into equal compartments stacked one
 *     above the other, each with its own row of doors. Vertical partitions are
 *     then cut to fit inside each compartment. A tall cabinet with drawers and
 *     doors has one more such board between the drawers and the doors.
 *   - Shelves sit on pins in each section, set back from the front. With
 *     drawers and no doors, the drawers fill the cabinet and there are none.
 *   - The back (HDF) is nailed onto the back edges, slightly smaller than the
 *     cabinet so it does not show.
 *   - Fronts are full overlay, with `doorGap` between them and around them.
 *     Drawers go above or below the doors (`drawersAt`; below by default in a
 *     tall cabinet), `drawerFrontHeight` each, and the doors fill the rest;
 *     drawers alone share the height equally.
 *   - A drawer is a face (the visible front) on a box: two sides and two ends
 *     of the carcass board, on a bottom of the back material, running on
 *     ball-bearing runners that need `runnerClearance` on each side. The box
 *     is as deep as the longest standard runner that fits, and 40 mm lower
 *     than its face.
 *
 * The worktop covers each run of base cabinets side by side (a tall cabinet
 * between them starts a new run), `worktopDepth` deep. At the two ends of
 * the kitchen it overhangs by `worktopOverhangLeft` / `Right` (0 against a
 * wall); next to a tall cabinet it does not. A run longer than
 * `worktopMaxLength` is cut into pieces that join over a cabinet side. The
 * worktop can be left out of the list when it comes from elsewhere (stone,
 * for example).
 *
 * A part's `length` always runs along the grain (the board's texture) and
 * `width` across it. Edge banding is given per edge: L1 and L2 are the two
 * edges along the length, W1 and W2 the two along the width. L1 is the front
 * (for drawer box parts, the top edge).
 */

/**
 * @typedef {object} Settings
 * @property {number} board          carcass board thickness, mm
 * @property {number} doorGap        gap between fronts and around them, mm
 * @property {number} shelfSetback   how far shelves sit back from the front, mm
 * @property {number} railWidth      width of a base cabinet's top rails, mm
 * @property {number} hangingRail    width of a wall cabinet's hanging rail, mm (0: none)
 * @property {number} backReveal     how much smaller the back is on each side, mm
 * @property {number} drawerFrontHeight  a drawer face's height above doors, mm
 * @property {number} runnerClearance  space for a drawer runner on each side, mm
 * @property {boolean} worktop        include the worktop in the cut list
 * @property {number} worktopDepth   mm
 * @property {number} worktopThickness  mm (for the drawing)
 * @property {number} worktopOverhangLeft   past the left end of the kitchen, mm
 * @property {number} worktopOverhangRight  past the right end of the kitchen, mm
 * @property {number} worktopMaxLength  longest piece the material comes in, mm
 * @property {string} carcassMaterial
 * @property {string} frontMaterial
 * @property {string} backMaterial   also the drawer bottoms (drawer sides and ends are carcass)
 * @property {string} worktopMaterial
 * @property {string} carcassEdge    edge banding on carcass parts, e.g. '0.4'
 * @property {string} frontEdge      edge banding on doors, e.g. '1'
 */

/**
 * @typedef {object} Cabinet
 * @property {string} id
 * @property {string} name
 * @property {'base' | 'wall' | 'tall'} kind  base: on the floor, under the worktop;
 *   wall: hangs; tall: on the floor, up to the top of the wall cabinets
 * @property {number} width
 * @property {number} height  carcass height, without legs
 * @property {number} depth
 * @property {number} partitions  vertical boards splitting the inside into sections
 * @property {number} [hPartitions]  tall only: horizontal boards splitting the door area
 *   into compartments one above the other
 * @property {number} shelves     per section (of every compartment)
 * @property {number} doors       side by side (in every compartment)
 * @property {number} drawers
 * @property {'top' | 'bottom'} [drawersAt]  drawers above or below the doors
 */

/**
 * @typedef {object} Edges
 * @property {string} L1
 * @property {string} L2
 * @property {string} W1
 * @property {string} W2
 */

/**
 * @typedef {object} Part
 * @property {string} type      side, bottom, top, railFront, railBack, hangingRail, partition, hPartition, shelf, back, door,
 *   drawerFace, boxSide, boxEnd, boxBottom, worktop
 * @property {string} cabinet   the cabinet's name (several, comma-separated, once merged)
 * @property {string} material
 * @property {number} length    along the grain, mm
 * @property {number} width     across the grain, mm
 * @property {number} qty
 * @property {boolean} grain    whether the grain direction matters
 * @property {Edges} edges
 */

/** @type {Readonly<Settings>} */
export const DEFAULT_SETTINGS = Object.freeze({
  board: 18,
  doorGap: 3,
  shelfSetback: 20,
  railWidth: 100,
  hangingRail: 80,
  backReveal: 2,
  drawerFrontHeight: 150,
  runnerClearance: 13,
  // Off by default: worktops often come from elsewhere (stone, for example).
  worktop: false,
  worktopDepth: 600,
  worktopThickness: 38,
  worktopOverhangLeft: 0,
  worktopOverhangRight: 0,
  worktopMaxLength: 4100,
  carcassMaterial: '',
  frontMaterial: '',
  backMaterial: '',
  worktopMaterial: '',
  carcassEdge: '0.4',
  frontEdge: '1',
});

/** Typical sizes for a new cabinet of each kind. */
export const DEFAULT_CABINETS = Object.freeze({
  base: Object.freeze({ width: 600, height: 720, depth: 560, partitions: 0, hPartitions: 0, shelves: 1, doors: 1, drawers: 0, drawersAt: 'top' }),
  wall: Object.freeze({ width: 600, height: 720, depth: 300, partitions: 0, hPartitions: 0, shelves: 2, doors: 1, drawers: 0, drawersAt: 'top' }),
  // 100 mm legs + 2080 = 2180: the top of a 720 mm wall cabinet hung above a
  // 720 mm base cabinet, a 40 mm worktop and a 600 mm gap.
  tall: Object.freeze({ width: 600, height: 2080, depth: 560, partitions: 0, hPartitions: 0, shelves: 4, doors: 1, drawers: 0, drawersAt: 'bottom' }),
});

export const KINDS = /** @type {const} */ (['base', 'wall', 'tall']);

/** Standard drawer runner lengths, mm. */
export const RUNNER_LENGTHS = Object.freeze([250, 300, 350, 400, 450, 500, 550, 600]);

/** How much lower a drawer box is than its face, mm. */
const BOX_BELOW_FACE = 40;

/** Round to half a millimetre, which is as fine as a panel saw cuts. */
export const round = (/** @type {number} */ mm) => Math.round(mm * 2) / 2;

const NO_EDGES = Object.freeze({ L1: '', L2: '', W1: '', W2: '' });

/**
 * The longest standard runner for a cabinet `depth` deep, leaving 10 mm at
 * the back; undefined if even the shortest does not fit.
 * @param {number} depth
 */
export function runnerLength(depth) {
  return [...RUNNER_LENGTHS].reverse().find((length) => length <= depth - 10);
}

/** Horizontal partitions: only tall cabinets have them. @param {Cabinet} cab */
export const hPartitionsOf = (cab) => (cab.kind === 'tall' ? cab.hPartitions ?? 0 : 0);

/** Where the drawers go. @param {Cabinet} cab @returns {'top' | 'bottom'} */
export const drawersAtOf = (cab) => cab.drawersAt ?? DEFAULT_CABINETS[cab.kind].drawersAt;

/** A tall cabinet with drawers and doors has a fixed board between them. @param {Cabinet} cab */
export const hasDivider = (cab) => cab.kind === 'tall' && (cab.drawers ?? 0) > 0 && cab.doors > 0;

/**
 * Heights of a cabinet's fronts. Doors come in `rows` (compartments of a
 * tall cabinet), all of `doorHeight`.
 * @param {Cabinet} cab
 * @param {Settings} s
 * @returns {{ drawerHeight: number, doorHeight: number, rows: number }}  heights 0 where there are none
 */
export function frontHeights(cab, s) {
  const n = cab.drawers ?? 0;
  const gap = s.doorGap;
  const rows = hPartitionsOf(cab) + 1;
  if (n > 0 && cab.doors === 0) return { drawerHeight: (cab.height - n * gap) / n, doorHeight: 0, rows };
  const drawerHeight = n > 0 ? s.drawerFrontHeight : 0;
  const doorZone = cab.height - n * (drawerHeight + gap);
  return { drawerHeight, doorHeight: cab.doors > 0 ? (doorZone - rows * gap) / rows : 0, rows };
}

/**
 * @typedef {object} Front
 * @property {'drawer' | 'door'} kind
 * @property {number} x        from the cabinet's left side, mm
 * @property {number} y        from the cabinet's underside, mm
 * @property {number} width
 * @property {number} height
 * @property {number} column   0-based, for doors in a row
 * @property {number} columns  doors in its row
 */

/**
 * Every front of a cabinet, placed: drawers and door rows stacked from the
 * top down, in the order `drawersAt` gives.
 * @param {Cabinet} cab
 * @param {Settings} s
 * @returns {Front[]}
 */
export function frontLayout(cab, s) {
  const gap = s.doorGap;
  const { drawerHeight, doorHeight, rows } = frontHeights(cab, s);
  /** @type {('drawer' | 'door')[]} */
  const drawers = Array((cab.drawers ?? 0)).fill('drawer');
  /** @type {('drawer' | 'door')[]} */
  const doorRows = cab.doors > 0 ? Array(rows).fill('door') : [];
  const slots = drawersAtOf(cab) === 'top' ? [...drawers, ...doorRows] : [...doorRows, ...drawers];
  /** @type {Front[]} */
  const fronts = [];
  let top = cab.height - gap / 2;
  for (const kind of slots) {
    const height = kind === 'drawer' ? drawerHeight : doorHeight;
    const y = top - height;
    if (kind === 'drawer') fronts.push({ kind, x: gap / 2, y, width: cab.width - gap, height, column: 0, columns: 1 });
    else {
      const n = cab.doors;
      const width = (cab.width - n * gap) / n;
      for (let i = 0; i < n; i++) fronts.push({ kind, x: gap / 2 + i * (width + gap), y, width, height, column: i, columns: n });
    }
    top = y - gap;
  }
  return fronts;
}

/**
 * The inside of a cabinet's door area: where it starts (from the underside),
 * how tall it is, and the height of each compartment.
 * @param {Cabinet} cab
 * @param {Settings} s
 * @returns {{ start: number, height: number, compartment: number, rows: number }}
 */
export function doorArea(cab, s) {
  const T = s.board;
  const rows = hPartitionsOf(cab) + 1;
  let start = T;
  let height = cab.height - 2 * T;
  if (hasDivider(cab)) {
    // The divider's face lines up with where the fronts change, `zone` from
    // the drawer end of the cabinet.
    const zone = (cab.drawers ?? 0) * (s.drawerFrontHeight + s.doorGap);
    height = cab.height - T - zone;
    start = drawersAtOf(cab) === 'bottom' ? zone : T;
  }
  return { start, height, compartment: (height - (rows - 1) * T) / rows, rows };
}

/** Whether a cabinet has shelves: not when drawers fill it. @param {Cabinet} cab */
export const hasShelves = (cab) => !((cab.drawers ?? 0) > 0 && cab.doors === 0);

/**
 * The parts of one cabinet.
 * @param {Cabinet} cab
 * @param {Settings} s
 * @returns {Part[]}
 */
export function cabinetParts(cab, s) {
  const { width: W, height: H, depth: D } = cab;
  const T = s.board;
  const inner = W - 2 * T;
  const front = { ...NO_EDGES, L1: s.carcassEdge };
  const all = { L1: s.frontEdge, L2: s.frontEdge, W1: s.frontEdge, W2: s.frontEdge };
  /** @type {Part[]} */
  const parts = [];
  /** @param {string} type @param {string} material @param {number} length @param {number} width @param {number} qty @param {boolean} grain @param {Edges} edges */
  const add = (type, material, length, width, qty, grain, edges) => {
    if (qty > 0) parts.push({ type, cabinet: cab.name, material, length: round(length), width: round(width), qty, grain, edges: { ...edges } });
  };

  add('side', s.carcassMaterial, H, D, 2, true, front);
  if (cab.kind === 'base') {
    add('bottom', s.carcassMaterial, inner, D, 1, true, front);
    add('railFront', s.carcassMaterial, inner, s.railWidth, 1, true, front);
    add('railBack', s.carcassMaterial, inner, s.railWidth, 1, true, NO_EDGES);
  } else {
    add('top', s.carcassMaterial, inner, D, 1, true, front);
    add('bottom', s.carcassMaterial, inner, D, 1, true, front);
  }
  // Hidden inside at the back, so no banding.
  if (cab.kind === 'wall' && s.hangingRail > 0) add('hangingRail', s.carcassMaterial, inner, s.hangingRail, 1, true, NO_EDGES);
  const p = cab.partitions ?? 0;
  const area = doorArea(cab, s);
  const rows = area.rows;
  add('hPartition', s.carcassMaterial, inner, D, rows - 1 + (hasDivider(cab) ? 1 : 0), true, front);
  // With compartments, vertical partitions are cut to fit inside each one.
  add('partition', s.carcassMaterial, rows > 1 ? area.compartment : H - 2 * T, D, p * rows, true, front);
  // Shelves on pins need a little play between the sides.
  if (hasShelves(cab)) add('shelf', s.carcassMaterial, sectionWidth(cab, s) - 2, D - s.shelfSetback, cab.shelves * (p + 1) * rows, true, front);
  add('back', s.backMaterial, H - 2 * s.backReveal, W - 2 * s.backReveal, 1, false, NO_EDGES);

  const { drawerHeight, doorHeight } = frontHeights(cab, s);
  const n = cab.doors;
  if (n > 0) add('door', s.frontMaterial, doorHeight, (W - n * s.doorGap) / n, n * rows, true, all);

  const d = cab.drawers ?? 0;
  if (d > 0) {
    // Drawer faces: the grain runs across the cabinet.
    add('drawerFace', s.frontMaterial, W - s.doorGap, drawerHeight, d, true, all);
    // The box is made of the carcass board.
    const t = T;
    const boxWidth = inner - 2 * s.runnerClearance;
    const boxDepth = runnerLength(D) ?? 0;
    const boxHeight = drawerHeight - BOX_BELOW_FACE;
    const top = { ...NO_EDGES, L1: s.carcassEdge };
    add('boxSide', s.carcassMaterial, boxDepth, boxHeight, 2 * d, true, top);
    add('boxEnd', s.carcassMaterial, boxWidth - 2 * t, boxHeight, 2 * d, true, top);
    add('boxBottom', s.backMaterial, boxDepth, boxWidth, d, false, NO_EDGES);
  }
  return parts;
}

/**
 * Inside width of one section: the space between the sides, less the
 * partitions, shared equally.
 * @param {Cabinet} cab
 * @param {Settings} s
 */
export function sectionWidth(cab, s) {
  const p = cab.partitions ?? 0;
  return (cab.width - 2 * s.board - p * s.board) / (p + 1);
}

/**
 * Problems that make a cabinet impossible to build, as message keys.
 * @param {Cabinet} cab
 * @param {Settings} s
 * @returns {string[]}
 */
export function cabinetProblems(cab, s) {
  const problems = [];
  for (const key of /** @type {const} */ (['width', 'height', 'depth'])) {
    if (!(cab[key] > 0)) problems.push(`problem.${key}`);
  }
  if (problems.length) return problems;
  if (cab.width - 2 * s.board <= 2) problems.push('problem.tooNarrow');
  else if ((cab.partitions ?? 0) > 0 && sectionWidth(cab, s) < 50) problems.push('problem.tooManyPartitions');
  if (cab.height - 2 * s.board <= 0) problems.push('problem.tooLow');
  if (cab.depth - s.shelfSetback <= 0 && cab.shelves > 0 && hasShelves(cab)) problems.push('problem.tooShallow');
  if (cab.doors > 0 && (cab.width - cab.doors * s.doorGap) / cab.doors < 50) problems.push('problem.tooManyDoors');
  const d = cab.drawers ?? 0;
  const { drawerHeight, doorHeight } = frontHeights(cab, s);
  if (d > 0) {
    if ((cab.partitions ?? 0) > 0) problems.push('problem.drawersAndPartitions');
    if (runnerLength(cab.depth) === undefined) problems.push('problem.tooShallowForDrawers');
    if (cab.width - 2 * s.board - 2 * s.runnerClearance - 2 * s.board < 50) problems.push('problem.tooNarrowForDrawers');
    if (drawerHeight - BOX_BELOW_FACE < 50 || (cab.doors > 0 && hPartitionsOf(cab) === 0 && doorHeight < 100)) problems.push('problem.tooManyDrawers');
  }
  if (hPartitionsOf(cab) > 0 && (doorArea(cab, s).compartment < 100 || (cab.doors > 0 && doorHeight < 100))) {
    problems.push('problem.tooManyHPartitions');
  }
  return problems;
}

/**
 * Every part of a project, cabinet by cabinet. Cabinets with problems are
 * left out (the form shows why).
 * @param {Cabinet[]} cabinets
 * @param {Settings} s
 */
export function projectParts(cabinets, s) {
  const buildable = cabinets.filter((c) => cabinetProblems(c, s).length === 0);
  const parts = buildable.flatMap((c) => cabinetParts(c, s));
  if (s.worktop) {
    for (const run of worktopRuns(buildable, s)) {
      for (const piece of run.pieces) {
        parts.push({
          type: 'worktop',
          cabinet: piece.cabinets.map((c) => c.name).join(', '),
          material: s.worktopMaterial,
          length: round(piece.length),
          width: round(s.worktopDepth),
          qty: 1,
          grain: true,
          edges: { ...NO_EDGES },
        });
      }
    }
  }
  return parts;
}

/**
 * @typedef {object} WorktopRun
 * @property {Cabinet[]} cabinets  base cabinets side by side
 * @property {number} before  overhang past the first cabinet, mm
 * @property {number} after   overhang past the last cabinet, mm
 * @property {{ length: number, cabinets: Cabinet[] }[]} pieces  left to right
 */

/**
 * The worktop over each run of base cabinets standing side by side on the
 * floor, in list order. Wall cabinets are not on the floor and do not break
 * a run; a tall one does, and the worktop stops flush against it.
 * @param {Cabinet[]} cabinets
 * @param {Settings} s
 * @returns {WorktopRun[]}
 */
export function worktopRuns(cabinets, s) {
  const floor = cabinets.filter((c) => c.kind !== 'wall');
  /** @type {WorktopRun[]} */
  const runs = [];
  for (let i = 0; i < floor.length; ) {
    if (floor[i].kind !== 'base') {
      i++;
      continue;
    }
    const first = i;
    while (i < floor.length && floor[i].kind === 'base') i++;
    const run = floor.slice(first, i);
    const before = first === 0 ? s.worktopOverhangLeft : 0;
    const after = i === floor.length ? s.worktopOverhangRight : 0;
    runs.push({ cabinets: run, before, after, pieces: splitWorktop(run, before, after, s.worktopMaxLength) });
  }
  return runs;
}

/**
 * Cut a run's worktop into pieces no longer than `max`, joining over a
 * cabinet side: as many whole cabinets per piece as fit. A single cabinet
 * longer than `max` (unusual) is split into equal pieces.
 * @param {Cabinet[]} run
 * @param {number} before  overhang at the start
 * @param {number} after   overhang at the end
 * @param {number} max
 */
export function splitWorktop(run, before, after, max) {
  const limit = max > 0 ? max : Infinity;
  /** @type {{ length: number, cabinets: Cabinet[] }[]} */
  const pieces = [];
  /** @type {{ length: number, cabinets: Cabinet[] } | null} */
  let piece = null;
  run.forEach((c, i) => {
    const span = c.width + (i === 0 ? before : 0) + (i === run.length - 1 ? after : 0);
    if (piece && piece.length + span <= limit) {
      piece.length += span;
      piece.cabinets.push(c);
    } else {
      piece = { length: span, cabinets: [c] };
      pieces.push(piece);
    }
  });
  return pieces.flatMap((p) => {
    if (p.length <= limit) return [p];
    const n = Math.ceil(p.length / limit);
    return Array.from({ length: n }, () => ({ length: p.length / n, cabinets: p.cabinets }));
  });
}

/**
 * Combine parts that are cut the same way (same material, size, grain and
 * banding), adding up their quantities: what a workshop wants to cut from.
 * Order: by material, then largest first.
 * @param {Part[]} parts
 * @returns {Part[]}
 */
export function mergeParts(parts) {
  /** @type {Map<string, Part & { cabinets: Set<string>, types: Set<string> }>} */
  const groups = new Map();
  for (const p of parts) {
    const e = p.edges;
    const key = [p.material, p.length, p.width, p.grain, e.L1, e.L2, e.W1, e.W2].join('|');
    const g = groups.get(key);
    if (g) {
      g.qty += p.qty;
      g.cabinets.add(p.cabinet);
      g.types.add(p.type);
    } else {
      groups.set(key, { ...p, edges: { ...e }, cabinets: new Set([p.cabinet]), types: new Set([p.type]) });
    }
  }
  return [...groups.values()]
    .map(({ cabinets, types, ...p }) => ({ ...p, type: [...types].join(','), cabinet: [...cabinets].join(', ') }))
    .sort((a, b) => a.material.localeCompare(b.material) || b.length * b.width - a.length * a.width);
}

/**
 * Totals for buying material: area per material (m²) and banding length per
 * banding type (m). Banding gets 2 cm extra per edge for trimming.
 * @param {Part[]} parts
 */
export function totals(parts) {
  /** @type {Map<string, { count: number, area: number }>} */
  const materials = new Map();
  /** @type {Map<string, number>} */
  const banding = new Map();
  for (const p of parts) {
    const m = materials.get(p.material) ?? { count: 0, area: 0 };
    m.count += p.qty;
    m.area += (p.length * p.width * p.qty) / 1e6;
    materials.set(p.material, m);
    for (const [edge, band] of Object.entries(p.edges)) {
      if (!band) continue;
      const along = edge.startsWith('L') ? p.length : p.width;
      banding.set(band, (banding.get(band) ?? 0) + ((along + 20) * p.qty) / 1000);
    }
  }
  return { materials, banding };
}
