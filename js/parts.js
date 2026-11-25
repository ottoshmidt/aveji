// @ts-check
/**
 * Cabinets -> parts. Pure functions, no DOM, so they are unit-tested.
 *
 * Construction (one common way; the numbers live in Settings):
 *   - Sides run the full height; everything else sits between them.
 *   - Base cabinet: a bottom, and two rails (front and back) instead of a top,
 *     since the worktop covers it.
 *   - Wall cabinet: a top and a bottom.
 *   - Shelves sit on pins between the sides, set back from the front.
 *   - The back (HDF) is nailed onto the back edges, slightly smaller than the
 *     cabinet so it does not show.
 *   - Doors are full overlay, with `doorGap` between doors and around them.
 *
 * A part's `length` always runs along the grain (the board's texture) and
 * `width` across it. Edge banding is given per edge: L1 and L2 are the two
 * edges along the length, W1 and W2 the two along the width. L1 is the front.
 */

/**
 * @typedef {object} Settings
 * @property {number} board          carcass board thickness, mm
 * @property {number} doorGap        gap between doors and around them, mm
 * @property {number} shelfSetback   how far shelves sit back from the front, mm
 * @property {number} railWidth      width of a base cabinet's top rails, mm
 * @property {number} backReveal     how much smaller the back is on each side, mm
 * @property {string} carcassMaterial
 * @property {string} frontMaterial
 * @property {string} backMaterial
 * @property {string} carcassEdge    edge banding on carcass parts, e.g. '0.4'
 * @property {string} frontEdge      edge banding on doors, e.g. '1'
 */

/**
 * @typedef {object} Cabinet
 * @property {string} id
 * @property {string} name
 * @property {'base' | 'wall'} kind  base: stands on the floor; wall: hangs
 * @property {number} width
 * @property {number} height  carcass height, without legs
 * @property {number} depth
 * @property {number} shelves
 * @property {number} doors
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
 * @property {string} type      side, bottom, top, railFront, railBack, shelf, back, door
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
  backReveal: 2,
  carcassMaterial: '',
  frontMaterial: '',
  backMaterial: '',
  carcassEdge: '0.4',
  frontEdge: '1',
});

/** Typical sizes for a new cabinet of each kind. */
export const DEFAULT_CABINETS = Object.freeze({
  base: Object.freeze({ width: 600, height: 720, depth: 560, shelves: 1, doors: 1 }),
  wall: Object.freeze({ width: 600, height: 720, depth: 300, shelves: 2, doors: 1 }),
});

/** Round to half a millimetre, which is as fine as a panel saw cuts. */
export const round = (/** @type {number} */ mm) => Math.round(mm * 2) / 2;

const NO_EDGES = Object.freeze({ L1: '', L2: '', W1: '', W2: '' });

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
  // Shelves on pins need a little play between the sides.
  add('shelf', s.carcassMaterial, inner - 2, D - s.shelfSetback, cab.shelves, true, front);
  add('back', s.backMaterial, H - 2 * s.backReveal, W - 2 * s.backReveal, 1, false, NO_EDGES);
  const n = cab.doors;
  if (n > 0) {
    const doorWidth = (W - n * s.doorGap) / n;
    const all = { L1: s.frontEdge, L2: s.frontEdge, W1: s.frontEdge, W2: s.frontEdge };
    add('door', s.frontMaterial, H - s.doorGap, doorWidth, n, true, all);
  }
  return parts;
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
  if (cab.depth - s.shelfSetback <= 0 && cab.shelves > 0) problems.push('problem.tooShallow');
  if (cab.doors > 0 && (cab.width - cab.doors * s.doorGap) / cab.doors < 50) problems.push('problem.tooManyDoors');
  return problems;
}

/**
 * Every part of a project, cabinet by cabinet. Cabinets with problems are
 * left out (the form shows why).
 * @param {Cabinet[]} cabinets
 * @param {Settings} s
 */
export function projectParts(cabinets, s) {
  return cabinets.filter((c) => cabinetProblems(c, s).length === 0).flatMap((c) => cabinetParts(c, s));
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
