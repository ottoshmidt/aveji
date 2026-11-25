// @ts-check
/**
 * Front view of the kitchen as SVG text: base cabinets in a row on the
 * floor, wall cabinets in a row above them, both from the left, in list
 * order. A sketch to check the layout against, not a working drawing:
 * legs, worktop and the gap under the wall cabinets use typical sizes.
 *
 * Units are millimetres; the SVG scales to fit its box.
 */

const LEGS = 100;
const WORKTOP = 40;
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
  const base = cabinets.filter((c) => c.kind === 'base');
  const wall = cabinets.filter((c) => c.kind === 'wall');
  if (base.length + wall.length === 0) return '';
  const baseHeight = Math.max(0, ...base.map((c) => c.height));
  const baseWidth = base.reduce((sum, c) => sum + c.width, 0);
  const wallWidth = wall.reduce((sum, c) => sum + c.width, 0);
  // y grows downwards in SVG; work in "height above the floor" and flip.
  const wallBottom = (base.length ? LEGS + baseHeight + WORKTOP : 0) + SPLASH;
  const top = Math.max(base.length ? LEGS + baseHeight + WORKTOP : 0, wall.length ? wallBottom + Math.max(...wall.map((c) => c.height)) : 0);
  const width = Math.max(baseWidth, wallWidth, 1);
  const margin = FONT * 3;
  const y = (/** @type {number} */ h) => top - h;

  /** @type {string[]} */
  const out = [];
  /**
   * One cabinet: outline, doors with handles, name, width below or above.
   * @param {import('./parts.js').Cabinet} c @param {number} x @param {number} bottom height of its underside
   * @param {'below' | 'above'} dimension
   */
  const cabinet = (c, x, bottom, dimension) => {
    const top = bottom + c.height;
    out.push(`<rect class="carcass" x="${x}" y="${y(top)}" width="${c.width}" height="${c.height}"/>`);
    const gap = settings.doorGap;
    const n = c.doors;
    if (n > 0) {
      const doorWidth = (c.width - n * gap) / n;
      for (let i = 0; i < n; i++) {
        const dx = x + gap / 2 + i * (doorWidth + gap);
        out.push(`<rect class="door" x="${dx}" y="${y(top - gap / 2)}" width="${doorWidth}" height="${c.height - gap}"/>`);
        // Handle on the opening side: doors in a pair open from the middle.
        const left = n === 1 ? false : i % 2 === 1;
        const hx = left ? dx + 40 : dx + doorWidth - 40;
        const hy = c.kind === 'wall' ? bottom + 60 : top - 60;
        out.push(`<line class="handle" x1="${hx}" y1="${y(hy)}" x2="${hx}" y2="${y(hy + (c.kind === 'wall' ? 120 : -120))}"/>`);
      }
    }
    out.push(`<text class="name" x="${x + c.width / 2}" y="${y(bottom + c.height / 2)}">${esc(c.name)}</text>`);
    const dy = dimension === 'below' ? y(0) + FONT * 1.6 : y(top) - FONT * 0.8;
    out.push(`<text class="size" x="${x + c.width / 2}" y="${dy}">${c.width}</text>`);
  };

  let x = 0;
  for (const c of base) {
    cabinet(c, x, LEGS, 'below');
    x += c.width;
  }
  if (base.length) {
    out.push(`<rect class="worktop" x="0" y="${y(LEGS + baseHeight + WORKTOP)}" width="${baseWidth}" height="${WORKTOP}"/>`);
  }
  x = 0;
  for (const c of wall) {
    cabinet(c, x, wallBottom, 'above');
    x += c.width;
  }
  out.push(`<line class="floor" x1="${-margin / 2}" y1="${y(0)}" x2="${width + margin / 2}" y2="${y(0)}"/>`);

  const vb = [-margin, -margin, width + 2 * margin, top + 2 * margin].join(' ');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${esc(labels.title)}" style="font-size:${FONT}px">` +
    out.join('') +
    '</svg>'
  );
}
