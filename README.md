# Aveji

Kitchen cabinets and cut lists for the workshop, in Georgian, English and
Russian. A designer describes the cabinets; Aveji works out every part and
exports the cut list for the carpenter. Planned home: <https://aveji.aac.ge>.

Plain HTML, CSS and JavaScript (ES modules), no build step and no
dependencies. Everything runs in the browser; projects are kept in the
browser and can be saved to and opened from a file.

```sh
npm start      # then open http://localhost:8080
npm test       # unit tests (Node.js)
```

## How parts are worked out

One common construction, with the numbers under "Construction and materials":

- Sides run the full height; the other carcass parts sit between them.
- A base cabinet has a bottom and two rails (front and back) instead of a top.
- A wall cabinet has a top and a bottom.
- Partitions (vertical boards) split the inside into equal sections; they
  stand on the bottom and reach the top or the rails, full depth.
- Shelves sit on pins in each section (2 mm play), set back from the front;
  the shelf count is per section.
- The back (HDF) is nailed on, a little smaller than the cabinet.
- Doors are full overlay, with the door gap between and around them.

A part's length runs along the grain. Edge banding is per edge: L1 and L2
along the length (L1 is the front edge), W1 and W2 along the width.

## Cut list

- The table combines identical parts (same material, size, grain and
  banding) unless "Combine identical parts" is off.
- **Download CSV** writes a file Excel opens directly: with `;` and a decimal
  comma for Georgian and Russian Excel, or `,` and a decimal point for
  English Excel, and a byte-order mark so Georgian text shows correctly.
- **Copy the table** puts tab-separated text on the clipboard, to paste into
  Excel or Google Sheets.
- **Print** prints the front view and the cut list.

## Files

```
index.html         the page
css/style.css      layout, dark mode, print layout
js/main.js         the page logic: forms, storage, files, export
js/parts.js        cabinets -> parts, merging, totals (unit-tested)
js/project.js      the project data: new, check, save, open
js/table.js        the cut list as rows and columns
js/csv.js          CSV and tab-separated text
js/drawing.js      front view as SVG
js/i18n.js         strings in three languages
scripts/serve.mjs  development server (npm start)
tests/             unit tests (node --test)
```
