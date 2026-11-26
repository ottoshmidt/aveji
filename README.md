# Aveji

Kitchen cabinets and cut lists for the workshop, in Georgian, English and
Russian. A designer describes the cabinets; Aveji works out every part and
exports the cut list for the carpenter. Planned home: <https://aveji.aac.ge>.

Plain HTML, CSS and JavaScript (ES modules), no build step and no
dependencies. Everything runs in the browser.

## Projects

Every project is kept in the browser (localStorage), listed under "My
projects", most recently changed first: new, duplicate, delete, switch.
They survive closing the browser and restarting, but not clearing the
site's data, private windows, or (in Safari) 7 days without a visit; on
the first change the app asks the browser to keep its storage. Two open tabs
stay in step.

"Back up all projects" saves every project in one `.aveji.json` file, for a
backup or to move them to another device. "Restore from file" adds the
projects it does not have and replaces a project only with a newer copy, so
it never deletes or rolls back work; on a new device it replaces the empty
starting project. A single-project file from the first version restores too.
To send a kitchen to the workshop, use the export (CSV, copy or PDF).

```sh
npm start      # then open http://localhost:8080
npm test       # unit tests (Node.js)
```

## How parts are worked out

One common construction, with the numbers under "Construction and materials":

- Sides run the full height; the other carcass parts sit between them.
- A base cabinet has a bottom and two rails (front and back) instead of a top.
- A wall cabinet has a top and a bottom, and a hanging rail (80 mm wide by
  default, 0 for none): a strip between the sides, at the back under the
  top, that it hangs on. So does a tall cabinet, which stands
  on the floor and by default (2080 mm + 100 mm legs) reaches the top of the
  wall cabinets; in the front view, wall cabinets hang beside it.
- Partitions (vertical boards) split the inside into equal sections; they
  stand on the bottom and reach the top or the rails, full depth.
- Shelves sit on pins in each section (2 mm play), set back from the front;
  the shelf count ("Shelves") is per section.
- The back (HDF) is nailed on, a little smaller than the cabinet.
- Doors are full overlay, with the door gap between and around them.
- Drawers go above or below the doors ("Drawers" on each cabinet; below by
  default in a tall cabinet): with doors, each drawer face is 150 mm high
  and the doors fill the rest; without doors the drawers share the height
  (and the cabinet has no shelves). Partitions and drawers in one cabinet
  are not supported yet.
- A tall cabinet can have horizontal partitions: fixed boards between the
  sides that split the door area into equal compartments, one above the
  other, each with its own row of doors ("Doors" is per row). Vertical
  partitions are then cut to fit inside each compartment, and "Shelves" is
  per section of each compartment. A tall cabinet with drawers and doors
  also has a board between the two.
- A drawer box has two sides and two ends of the carcass board, banded on
  the top edge, on an HDF bottom, running on ball-bearing runners with 13 mm on each
  side. It is as deep as the longest standard runner (250-600 mm, in 50 mm
  steps) that fits the cabinet, and 40 mm lower than its face.

The worktop covers each run of base cabinets side by side (a tall cabinet
starts a new run), 600 mm deep by default, in its own material. It
overhangs the left and right ends of the kitchen by the overhang settings
(0 against a wall), never against a tall cabinet. A run longer than the
longest piece (4100 mm by default) is cut into pieces that join over a
cabinet side, as many whole cabinets per piece as fit. Untick "Worktop"
when it is made elsewhere (stone, for example); the drawing shows it
either way, with its joints.

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
js/library.js      every project in the browser, the open one, backup and restore
js/table.js        the cut list as rows and columns
js/csv.js          CSV and tab-separated text
js/drawing.js      front view as SVG
js/i18n.js         strings in three languages
scripts/serve.mjs  development server (npm start)
tests/             unit tests (node --test)
```
