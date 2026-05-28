---
name: Pannellum hotspot styling
description: How to correctly style custom hotspots in pannellum without breaking positioning
---

## Rule

Never use `container.style.cssText = '...'` inside a pannellum `createTooltipFunc`.

## Why

Pannellum sets `position:absolute` on every hotspot div and continuously updates `style.left` / `style.top` in its render loop. Using `cssText` wipes ALL inline styles at once — including pannellum's `position:absolute` — replacing it with whatever is in the string (e.g. `position:relative`). With `position:relative`, pannellum's `left`/`top` offsets move the element relative to its document-flow origin rather than the panorama viewport, so every pin lands off-screen.

## How to apply

Set individual properties instead:

```javascript
function createPin(container, args) {
  container.style.background = args.color;
  container.style.width = '36px';
  container.style.height = '36px';
  container.style.borderRadius = '50%';
  // ... etc — one property at a time
  container.style.marginLeft = '-18px';  // center: negative half-width
  container.style.marginTop  = '-18px';  // center: negative half-height
  container.innerHTML = args.icon;       // emoji/text only — no <img> tags
}
```

Also avoid `transform: translateY(-50%)` for centering — use negative margins instead, which don't interact with pannellum's positioning updates.

## Icon safety

Pannellum hotspot icons must be emoji/Unicode text only — no `<img>` or HTML tags. HTML tags embedded in the icon string (even through `container.innerHTML`) inside a `<script>` block's JSON can confuse the HTML parser. Use `PIN_ICONS_PANO` (emoji map) for pannellum, `PIN_ICONS` (HTML map with NAV_ICON_HTML) for the flat viewers only.
