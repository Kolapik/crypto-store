# Catalogue and Full-Screen Filter Design Specification

## 1. Purpose

This document specifies a luxury-product catalogue and advanced filter experience inspired by the interaction model and spatial rhythm of Bucherer’s Certified Pre-Owned listing page, adapted for the existing Kolapik/crypto-store ocean CRT visual theme.

It is not a brand clone. Use neutral branding, original copy, and non-Bucherer product assets.

Reference page:
- https://www.bucherer.com/ch/en/buy-certifiedpreowned

## 2. Evidence and confidence

| Finding | Confidence | Basis |
|---|---:|---|
| Commerce backend is Salesforce Commerce Cloud | High | Public Salesforce customer material and Bucherer cookie documentation reference Commerce Cloud / Demandware. |
| The rendered UI uses Chakra-style generated CSS and custom theme variables | High | Rendered HTML exposes generated `.css-*` classes, `chakra-ui-dark` selectors, and `--buc-*` tokens. |
| The storefront is likely based on Salesforce PWA Kit / Retail React App | Medium-high | Inference from the Salesforce Commerce stack plus React/Chakra signatures; verify in browser source and bundles before treating as fact. |
| Wide-desktop catalogue uses four equal columns | High | Supplied desktop screenshot. |
| Product media uses a warm off-white stage and centered contained imagery | High | Supplied screenshot and rendered image CSS. |
| Desktop filter opens as a full-viewport workspace with two panes | High | Supplied filter screenshot. |
| Filter changes are staged until “View Results” | Medium | Strongly suggested by the persistent apply action; verify live behavior. |
| Desktop breakpoint is around 1024 px | High | Rendered CSS includes repeated `min-width: 1024px` rules. |
| Crypto-store uses an Ocean CRT theme | High | Inspected `index.css` showing scanlines, glitch effects, deep blue/teal colors, and monospace highlights. |

## 3. Experience principles

1. **Editorial density:** show many products without making the page feel like a dashboard.
2. **Ocean CRT luxury:** deep space background, subtle scanlines, high-contrast borders, teal/accent highlights, and monospace metadata.
3. **Progressive commitment:** users can explore many filter options in a dedicated workspace, then apply once.
4. **Stable geometry:** filtering, image loading, and hover states must not shift card layout.
5. **Data-first controls:** product count, sorting, stock, and active filters remain easy to scan.
6. **Accessible restraint:** minimalist visuals must still provide clear focus, labels, and state changes.

## 4. Page anatomy

```text
Application shell
├── Global header / compact sticky header
└── Catalogue page
    ├── Catalogue toolbar
    │   ├── contextual collection control or chip
    │   ├── All Filters trigger
    │   ├── dynamic product count / active-filter area
    │   └── Sort menu
    ├── Active filter chips, when applicable
    ├── Product grid
    │   └── Product cards
    └── Loading / empty / error / pagination state

Filter workspace, full viewport
├── Sticky filter top bar
│   ├── FILTER label
│   └── Hide Filter control
├── Filter body
│   ├── Desktop section navigator
│   └── Scrollable filter content pane
└── Sticky action bar
    └── View Results button
```

## 5. Core dimensions & Theme Integration

The project already defines an ocean CRT theme in `index.css`. We will map Bucherer's spatial dimensions onto these existing colors.

```css
:root {
  /* Existing theme colors to reuse */
  --bg-base:        #0d1117;
  --bg-surface:     #131b24;
  --bg-elevated:    #1a2535;
  --bg-card:        rgba(19, 27, 36, 0.80);
  --text-primary:   #e8edf2;
  --text-secondary: #8fa3b4;
  --text-muted:     #4a6070;
  --border:         rgba(255,255,255,0.10);
  --border-strong:  rgba(255,255,255,0.20);
  --accent:         #3d7aad;
  --accent-hover:   #4d8fc7;
  --teal:           #2a7a6e;
  --error:          #c0392b;
  --success:        #27ae60;
  --radius:         6px;
  --radius-lg:      12px;

  /* Bucherer-inspired dimensions */
  --filter-topbar-h: 54px;
  --filter-rail-w: 228px;
  --filter-actionbar-h: 76px;
  --control-h: 44px;
  --select-h: 55px;
  --apply-button-w: 170px;
  --apply-button-h: 52px;
}
```

### Desktop catalogue estimate

- Wide viewport: four equal columns.
- Image-panel gutter: approximately 8 px.
- Image panel: visually close to 3:4 portrait, with CRT grid overlay (`linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)`).
- Card metadata side padding: approximately 14–16 px.
- Gap between grid rows: approximately 28–32 px after metadata.
- Main side padding: fluid; visually generous on very wide screens.

### Filter workspace estimate

- Full viewport modal over the CRT background.
- Top bar: 54 px, `--bg-surface`, bottom 1 px `--border`.
- Left rail: 228 px, `--bg-surface`, right 1 px `--border`.
- Main content padding: 24 px.
- Bottom action bar: 76 px, `--bg-surface`, top 1 px `--border`.
- Apply button: 170 × 52 px, `--accent`, square or `--radius` corners, right aligned.

## 6. Typography

Use the project’s existing font stack: `'Space Grotesk', 'Helvetica Neue', Arial, sans-serif;`
Use monospace (`'Courier New', monospace`) for reference numbers, hash placeholders, and data-heavy fields.

| Role | Size | Weight | Line height | Tracking | Case |
|---|---:|---:|---:|---:|---|
| Filter workspace title | 11–12 px | 700 | 16 px | 0.12em | Uppercase |
| Filter section eyebrow | 11–12 px | 700 | 16 px | 0.14em | Uppercase |
| Rail item | 14 px | 500 | 20 px | normal | Sentence case |
| Active rail item | 14 px | 700 | 20 px | normal | Sentence case (Accent color) |
| Control label | 14 px | 500 | 20 px | normal | Sentence case |
| Product brand | 10 px | 700 | 18 px | 0.18em | Uppercase |
| Product model | 16 px | 500 | 18–20 px | normal | Sentence case |
| Product price | 16 px | 600 | 20 px | normal | Currency format |
| Stock label | 10–11 px | 500 | 14 px | normal | Sentence case |
| Sort label | 11–12 px | 500 | 16 px | normal | Sentence case |

## 7. Catalogue toolbar

### Layout

- Compact horizontal toolbar above the product grid.
- Contextual controls near the center/left of the grid area.
- Sort control aligned to the right.
- Product count is dynamic and must never be hard-coded.
- Controls use `--bg-elevated` surfaces and thin `--border`s.

## 8. Product grid

### Wide desktop

- Four equal columns.
- Approximately 8 px horizontal gutter.
- Grid gap 1.5rem.

### Proposed responsive baseline

```css
.catalogue-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr));
  gap: 1.5rem;
}

@media (max-width: 700px) {
  .catalogue-grid {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 0.75rem;
  }
}

@media (max-width: 380px) {
  .catalogue-grid {
    grid-template-columns: 1fr !important;
  }
}
```

## 9. Product card

### Media stage

- Background: `--bg-elevated`.
- Visual ratio: approximately 1:1 or 3:4.
- Pixel-grid overlay on image frames.
- Product image centered both axes.
- Image element uses `object-fit: cover` or `contain`.
- Hash placeholder for no-image watches.

### Metadata

```text
BRAND                                  Favourite
Model line
Ref · Year · Condition                 • In stock
Price
```

## 10. Full-screen filter workspace

### Modal model

- Covers the entire viewport.
- Locks background scrolling.
- Uses a focus trap.
- Returns focus to the trigger on close.
- Escape closes it.
- Top and bottom bars are sticky or fixed within the dialog.
- Only the main filter pane scrolls on desktop.

### Top bar

```text
FILTER                                                   ‹ Hide Filter
```

### Desktop body

```text
┌──────────────────────┬─────────────────────────────────────────────┐
│ Section navigator    │ Scrollable filter content                  │
│ 228 px               │ flexible width                             │
│                      │                                             │
│ │ Available          │ AVAILABLE                                  │
│   Brand              │ □ Online available                         │
│   Collection         │                                             │
│   Price              │ BRAND                                      │
│   Dial Colour        │ [ Omega                                   ] │
│   Shape              │                                             │
│   Box and Paper      │ COLLECTION                                 │
│   Diameter           │ [ Collection                             v ] │
│   Material           │                                             │
│   Movement           │ PRICE                                      │
│   Year               │ histogram + dual slider + numeric fields   │
└──────────────────────┴─────────────────────────────────────────────┘
```

## 11. Filter control specifications

- Checkbox rows: visual box approximately 18 × 18 px.
- Flat option tiles: height approximately 44 px, background `--bg-elevated`.
- Price filter: histogram + dual slider.
- Collection select: full main-pane width, height approximately 55 px.

## 12. Filter state model

Maintain two independent states:

```ts
type FilterState = {
  status: string;
  brand: string;
  category: string;
  condition: string;
  currency: string;
  priceMin: string;
  priceMax: string;
  yearMin: string;
  yearMax: string;
  material: string;
  movement: string;
  dialColor: string;
  braceletMaterial: string;
  boxPapers: string;
  featuredOnly: boolean;
  hypeOnly: boolean;
  newOnly: boolean;
};
```

1. Open filter workspace: clone `appliedFilters` into `draftFilters`.
2. Edit controls: update only `draftFilters`.
3. View Results: normalize, commit to `appliedFilters`, serialize URL, close workspace.
4. Close/cancel: discard draft changes.

## 13. Acceptance criteria

1. **Ocean CRT integration:** The catalogue and filter workspace must use the existing dark/ocean color palette, fonts, and grid lines.
2. **Four-column grid:** The desktop catalogue must display a wide four-column grid.
3. **Full-screen filter:** The desktop filter must open as a full-viewport modal with a left section navigator and sticky action bar.
4. **Draft state:** Filter changes inside the workspace must not apply to the grid until "View Results" is clicked.
5. **Responsiveness:** The layout must adapt gracefully to mobile screens, dropping the left rail in the filter workspace.
6. **Accessibility:** The filter workspace must trap focus, handle Escape to close, and use semantic controls.

## 14. Open questions and implementation assumptions

- **Assumption:** The `index.css` and existing components (like `WatchCard`) provide enough foundation, but we will create a new `FilterWorkspace` component to handle the full-screen modal behavior.
- **Assumption:** We will use `framer-motion` or standard CSS transitions for the modal if no Radix primitive perfectly fits the full-screen layout, though `Dialog` could be adapted.
- **Assumption:** We will map the Bucherer fields to the existing Drizzle DB fields (e.g., `brand`, `category`, `condition`, `material`, `movement`, `dialColor`, `braceletMaterial`, `boxPapers`).
