// @ts-check
/**
 * Front view of the kitchen as SVG text: base and tall cabinets in a row on
 * the floor, wall cabinets in a row above them (skipping the space over tall
 * cabinets), both from the left, in list order. A sketch to check the
 * layout against, not a working drawing: legs, worktop and the gap under the
 * wall cabinets use typical sizes.
 *
 * Units are millimetres; the SVG scales to fit its box.
 */

import { doorArea, drawersAtOf, frontLayout, hasDivider, worktopRuns } from './parts.js';

const LEGS = 100;
/** Gap between the worktop and the wall cabinets. */
const SPLASH = 600;
const FONT = 70;

/** @param {string} text */
const esc = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

/**
 * @param {import('./parts.js').Cabinet[]} cabinets  only buildable ones
 * @param {import('./parts.js').Settings} settings
 * @param {{ title: string }} labels  accessible name of the drawing
 * @returns {string} an <svg> element, or '' with no cabinets
 */
export function frontView(cabinets, settings, labels) {
  const WORKTOP = settings.worktopThickness ?? 38;
  // On the floor (base and tall, in list order) and on the wall.
  const floor = cabinets.filter((c) => c.kind !== 'wall');
  const wall = cabinets.filter((c) => c.kind === 'wall');
  if (cabinets.length === 0) return '';
  const base = floor.filter((c) => c.kind === 'base');
  // Without base cabinets, hang the wall ones as if over standard 720 mm ones.
  const baseHeight = base.length ? Math.max(...base.map((c) => c.height)) : 720;
  const wallBottom = LEGS + baseHeight + WORKTOP + SPLASH;

  // Floor row from the left; wall row from the left, stepping past the
  // space above tall cabinets.
  /** @type {{ c: import('./parts.js').Cabinet, x: number }[]} */
  const placedFloor = [];
  let x = 0;
  for (const c of floor) {
    placedFloor.push({ c, x });
    x += c.width;
  }
  const talls = placedFloor.filter((p) => p.c.kind === 'tall');
  /** @type {{ c: import('./parts.js').Cabinet, x: number }[]} */
  const placedWall = [];
  x = 0;
  for (const c of wall) {
    for (let moved = true; moved; ) {
      moved = false;
      for (const t of talls) {
        if (x < t.x + t.c.width && x + c.width > t.x) {
          x = t.x + t.c.width;
          moved = true;
        }
      }
    }
    placedWall.push({ c, x });
    x += c.width;
  }

  const overhang = worktopRuns(cabinets, settings);
  const left = Math.min(0, ...overhang.map((r) => (placedFloor.find((p) => p.c === r.cabinets[0])?.x ?? 0) - r.before));
  const right = Math.max(
    1,
    ...[...placedFloor, ...placedWall].map((p) => p.x + p.c.width),
    ...overhang.map((r) => (placedFloor.find((p) => p.c === r.cabinets[0])?.x ?? 0) - r.before + r.pieces.reduce((sum, p) => sum + p.length, 0)),
  );
  // y grows downwards in SVG; work in "height above the floor" and flip.
  const top = Math.max(
    ...placedFloor.map((p) => LEGS + p.c.height + (p.c.kind === 'base' ? WORKTOP : 0)),
    ...placedWall.map((p) => wallBottom + p.c.height),
  );
  const margin = FONT * 3;
  const y = (/** @type {number} */ h) => top - h;
  const gap = settings.doorGap;

  /** @type {string[]} */
  const out = [];
  /** @param {number} x1 @param {number} h1 @param {number} x2 @param {number} h2 */
  const handle = (x1, h1, x2, h2) => out.push(`<line class="handle" x1="${x1}" y1="${y(h1)}" x2="${x2}" y2="${y(h2)}"/>`);

  /**
   * One cabinet: outline, drawer faces and doors with handles, partitions,
   * name, and its width below (on the floor) or above (on the wall).
   * @param {import('./parts.js').Cabinet} c @param {number} x @param {number} bottom height of its underside
   */
  const cabinet = (c, x, bottom) => {
    const top = bottom + c.height;
    out.push(`<rect class="carcass" x="${x}" y="${y(top)}" width="${c.width}" height="${c.height}"/>`);
    for (const f of frontLayout(c, settings)) {
      const fx = x + f.x;
      const fBottom = bottom + f.y;
      const fTop = fBottom + f.height;
      out.push(`<rect class="door" x="${fx}" y="${y(fTop)}" width="${f.width}" height="${f.height}"/>`);
      if (f.kind === 'drawer') {
        // A drawer handle runs across, near the top of the face.
        const hy = fTop - Math.min(60, f.height / 2);
        handle(x + c.width / 2 - 80, hy, x + c.width / 2 + 80, hy);
        continue;
      }
      // A door handle is on the opening side (a pair opens from the middle):
      // near the bottom of a wall door, near the top of a base door, and at
      // hand height (about 1 m from the floor) on a tall cabinet's door.
      const left = f.columns === 1 ? false : f.column % 2 === 1;
      const hx = left ? fx + 40 : fx + f.width - 40;
      if (c.kind === 'wall') handle(hx, fBottom + 60, hx, fBottom + 180);
      else if (c.kind === 'tall') {
        const mid = Math.min(fTop - 90, Math.max(fBottom + 90, 1000));
        handle(hx, mid - 60, hx, mid + 60);
      } else handle(hx, fTop - 60, hx, fTop - 180);
    }
    // Partitions, hidden behind the fronts: dashed, like a hidden edge.
    const T = settings.board;
    const area = doorArea(c, settings);
    const p = c.partitions ?? 0;
    if (p > 0) {
      const section = (c.width - 2 * T - p * T) / (p + 1);
      for (let i = 1; i <= p; i++) {
        const px = x + T + i * section + (i - 1) * T + T / 2;
        out.push(`<line class="partition" x1="${px}" y1="${y(bottom + area.start + area.height)}" x2="${px}" y2="${y(bottom + area.start)}"/>`);
      }
    }
    /** @param {number} h  height of a horizontal board's middle above the cabinet's underside */
    const board = (h) => out.push(`<line class="partition" x1="${x + T}" y1="${y(bottom + h)}" x2="${x + c.width - T}" y2="${y(bottom + h)}"/>`);
    for (let i = 1; i < area.rows; i++) board(area.start + i * area.compartment + (i - 1) * T + T / 2);
    if (hasDivider(c)) board(drawersAtOf(c) === 'bottom' ? area.start - T / 2 : area.start + area.height + T / 2);
    out.push(`<text class="name" x="${x + c.width / 2}" y="${y(bottom + c.height / 2)}">${esc(c.name)}</text>`);
    const dy = c.kind === 'wall' ? y(top) - FONT * 0.8 : y(0) + FONT * 1.6;
    out.push(`<text class="size" x="${x + c.width / 2}" y="${dy}">${c.width}</text>`);
  };

  for (const { c, x } of placedFloor) cabinet(c, x, LEGS);
  // The worktop over each run of base cabinets, with its overhangs, and a
  // thin line where two pieces join.
  const worktopY = y(LEGS + baseHeight + WORKTOP);
  for (const run of worktopRuns(cabinets, settings)) {
    const start = (placedFloor.find((p) => p.c === run.cabinets[0])?.x ?? 0) - run.before;
    const length = run.pieces.reduce((sum, p) => sum + p.length, 0);
    out.push(`<rect class="worktop" x="${start}" y="${worktopY}" width="${length}" height="${WORKTOP}"/>`);
    let seam = start;
    for (const piece of run.pieces.slice(0, -1)) {
      seam += piece.length;
      out.push(`<line class="seam" x1="${seam}" y1="${worktopY}" x2="${seam}" y2="${worktopY + WORKTOP}"/>`);
    }
  }
  for (const { c, x } of placedWall) cabinet(c, x, wallBottom);
  out.push(`<line class="floor" x1="${left - margin / 2}" y1="${y(0)}" x2="${right + margin / 2}" y2="${y(0)}"/>`);

  const vb = [left - margin, -margin, right - left + 2 * margin, top + 2 * margin].join(' ');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${esc(labels.title)}" style="font-size:${FONT}px">` +
    out.join('') +
    '</svg>'
  );
}
