// NodeRunner - icons.js
// =========================
// Device-type catalogue (built-in labels + order) and the SVG icon library.
// typeLabel()/iconFor()/allTypeOptions() transparently merge these built-ins
// with whatever custom types the user created in Settings (state.config.customTypes)
// - the rest of the app should only ever call those three functions, never
// read BUILTIN_* directly. Loaded first: no dependency on any other module.

// ---- device types: built-in catalogue + user-defined custom types -----------
// typeLabel()/iconFor()/allTypeOptions() are the ONLY places that should be
// used anywhere else in the app to read type info — they transparently merge
// the built-ins below with whatever the user created in Settings, so the
// rest of the codebase never has to know the difference.
const BUILTIN_TYPE_LABELS = {
  router:'Router / Gateway', desktop:'Desktop computer', nas:'NAS / Storage',
  tv:'Smart TV', console:'Game console', phone:'Smartphone', laptop:'Laptop / Notebook',
  tablet:'Tablet', iot:'IoT device', camera:'IP camera', printer:'Printer',
  raspberry:'Raspberry Pi', aircon:'Air conditioner', waterheater:'Water heater / heat pump',
  inverter:'Solar inverter', meter:'Energy meter (Shelly EM, etc.)', unknown:'Unidentified',
};
const BUILTIN_TYPE_ORDER = ['router','desktop','laptop','phone','tablet','tv','console','nas',
  'camera','printer','raspberry','iot','aircon','waterheater','inverter','meter','unknown'];

// Small monochrome line icons (24x24, stroke=currentColor) so they inherit
// whatever status color the badge already uses. To add a BUILT-IN icon by
// hand you'd add an entry here + to BUILTIN_TYPE_ORDER/LABELS above — but for
// anyone using the app (not editing source), the Settings panel does this
// for you and stores the icon as raw SVG markup in state.config.customTypes.
const BUILTIN_ICONS = {
  router:      '<rect x="3" y="9" width="18" height="7" rx="1.5"/><path d="M7 9V6m5 3V4m5 5V6"/><circle cx="7.5" cy="13" r=".6" fill="currentColor" stroke="none"/><circle cx="11.5" cy="13" r=".6" fill="currentColor" stroke="none"/>',
  desktop:     '<rect x="4" y="4" width="16" height="11" rx="1"/><path d="M9 19h6M12 15v4"/>',
  laptop:      '<rect x="5" y="5" width="14" height="9" rx="1"/><path d="M3 18h18l-1.5-3h-15z"/>',
  phone:       '<rect x="7.5" y="2.5" width="9" height="19" rx="2"/><path d="M11 19.2h2"/>',
  tablet:      '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M11 18h2"/>',
  tv:          '<rect x="3" y="5" width="18" height="12" rx="1.5"/><path d="M8 21h8M12 17v4"/>',
  console:     '<rect x="3" y="8" width="18" height="9" rx="4"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="16" cy="11.5" r=".8" fill="currentColor" stroke="none"/><circle cx="18" cy="13.5" r=".8" fill="currentColor" stroke="none"/>',
  nas:         '<rect x="4" y="4" width="16" height="6" rx="1"/><rect x="4" y="14" width="16" height="6" rx="1"/><circle cx="7" cy="7" r=".7" fill="currentColor" stroke="none"/><circle cx="7" cy="17" r=".7" fill="currentColor" stroke="none"/>',
  camera:      '<rect x="3" y="7" width="14" height="11" rx="2"/><path d="M17 10l4-2v9l-4-2z"/><circle cx="10" cy="12.5" r="3"/>',
  iot:         '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.45 1.1 1.1 1.1 1.9v.3h5v-.3c0-.8.5-1.45 1.1-1.9A6 6 0 0 0 12 3z"/>',
  printer:     '<rect x="6" y="3" width="12" height="6" rx="1"/><rect x="4" y="9" width="16" height="8" rx="1.5"/><rect x="8" y="15" width="8" height="6" rx=".5"/>',
  raspberry:   '<rect x="4" y="6" width="16" height="12" rx="1.5"/><path d="M7 6V3M11 6V3M13 6V3M17 6V3M7 18v3M11 18v3M13 18v3M17 18v3"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/>',
  aircon:      '<rect x="2.5" y="6" width="19" height="7" rx="1.5"/><path d="M6 16c0 1.5 1 2 1 3.5M11 16c0 1.5 1 2 1 3.5M16 16c0 1.5 1 2 1 3.5"/>',
  waterheater: '<rect x="7" y="3" width="10" height="18" rx="3"/><path d="M12 8.2c-1.1 1.4-1.1 2.2 0 3.6 1.1-1.4 1.1-2.2 0-3.6z" fill="currentColor" stroke="none"/><path d="M9 16h6"/>',
  inverter:    '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M13 7l-4 6h3l-1 4 5-7h-3z" fill="currentColor" stroke="none"/>',
  meter:       '<circle cx="12" cy="13" r="8"/><path d="M12 13l3.2-3.2M8.5 16.5l.1-.1"/><path d="M5 21l1-2M19 21l-1-2"/>',
  unknown:     '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.2 1-1.2 2"/><circle cx="12" cy="16.2" r=".4" fill="currentColor" stroke="none"/>',
};

// A small library of generic, reusable shapes offered in the Settings "add
// custom type" form, so a non-developer can pick something sensible without
// having to hand-write SVG path data. Anyone is still free to paste their own
// raw SVG markup instead (see the "advanced" field in Settings).
const ICON_PALETTE = {
  bolt:    '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
  plug:    '<path d="M9 2v6M15 2v6"/><rect x="6" y="8" width="12" height="8" rx="2"/><path d="M12 16v3a3 3 0 0 1-3 3H7"/>',
  gauge:   '<path d="M4 16a8 8 0 0 1 16 0"/><path d="M12 16l4-4"/><circle cx="12" cy="16" r="1"/>',
  speaker: '<rect x="6" y="2" width="12" height="20" rx="2"/><circle cx="12" cy="8" r="2.4"/><circle cx="12" cy="16" r="1.2"/>',
  lock:    '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  sensor:  '<circle cx="12" cy="12" r="3"/><path d="M5 12a7 7 0 0 1 14 0M2 12a10 10 0 0 1 20 0"/>',
  fan:     '<circle cx="12" cy="12" r="1.6"/><path d="M12 12c0-4 2-7 5-7s2 4-1 6M12 12c-4 0-7 2-7 5s4 2 6-1M12 12c0 4-2 7-5 7s-2-4 1-6M12 12c4 0 7-2 7-5s-4-2-6 1"/>',
  drop:    '<path d="M12 3c4 5 7 8.5 7 12a7 7 0 0 1-14 0c0-3.5 3-7 7-12z"/>',
  box:     '<rect x="4" y="6" width="16" height="14" rx="1.5"/><path d="M4 10h16M9 6v4M15 6v4"/>',
  bell:    '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 3H4z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  generic: '<circle cx="12" cy="12" r="9"/>',
};

function isCustomType(t) { return !Object.prototype.hasOwnProperty.call(BUILTIN_TYPE_LABELS, t) && state.config.customTypes && Object.prototype.hasOwnProperty.call(state.config.customTypes, t); }
function allTypeOptions() {
  return BUILTIN_TYPE_ORDER.concat(Object.keys(state.config.customTypes || {}));
}
function typeLabel(t) {
  if (Object.prototype.hasOwnProperty.call(BUILTIN_TYPE_LABELS, t)) return BUILTIN_TYPE_LABELS[t];
  const c = (state.config.customTypes || {})[t];
  return (c && c.label) || t;
}

// Custom type icons come from the Settings "paste custom SVG" field (see
// settings.js buildAddTypeForm) - raw markup typed by whoever holds the API
// token, synced via assignments.json to every browser/device on this
// backend (loadState() in app.js), then dropped straight into innerHTML by
// iconFor() below. Without this whitelist a saved <image onerror=...> or
// onload= handler would run in every OTHER viewer's session and could read
// their X-NodeRunner-Token out of localStorage. Only shape tags + geometry/paint
// attributes survive - no script/image/foreignObject/use/href/style/on*,
// so there is no way to smuggle a handler or an external resource load
// through here. The backend applies the same whitelist server-side
// (sanitize_icon_svg in noderunner.py) since this is a defense-in-depth
// copy, not the authoritative one - a direct POST to /api/assignments would
// skip this entirely.
const ICON_SAFE_TAGS = new Set(['path', 'circle', 'rect', 'line', 'ellipse', 'polygon', 'polyline', 'g']);
const ICON_SAFE_ATTRS = new Set([
  'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'points',
  'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
  'stroke-miterlimit', 'transform', 'opacity', 'fill-rule', 'clip-rule',
]);
function sanitizeIconNode(src, depth = 0) {
  if (depth > 32) return null;
  const tag = src.tagName ? src.tagName.toLowerCase() : '';
  if (!ICON_SAFE_TAGS.has(tag)) return null;
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Array.from(src.attributes || []).forEach((attr) => {
    const name = attr.name.toLowerCase();
    if (ICON_SAFE_ATTRS.has(name) && !/url\s*\(|[\\\x00-\x1f]/i.test(attr.value)) node.setAttribute(name, attr.value);
  });
  Array.from(src.children || []).forEach((child) => {
    const clean = sanitizeIconNode(child, depth + 1);
    if (clean) node.appendChild(clean);
  });
  return node;
}
function sanitizeIconSvg(markup) {
  const raw = String(markup == null ? '' : markup).trim();
  // DOCTYPE/ENTITY/processing-instructions are never needed for a plain
  // shape snippet and are how XML parsers get abused (entity-expansion
  // DoS, external entity/stylesheet loads) - reject outright rather than
  // trying to parse them safely.
  if (!raw || raw.length > 20000 || raw.indexOf('<!') >= 0 || raw.indexOf('<?') >= 0) return '';
  let doc;
  try {
    doc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + raw + '</svg>', 'image/svg+xml');
  } catch (e) { return ''; }
  if (!doc || doc.getElementsByTagName('parsererror').length) return '';
  const out = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  Array.from(doc.documentElement.children).forEach((child) => {
    const clean = sanitizeIconNode(child);
    if (clean) out.appendChild(clean);
  });
  return new XMLSerializer().serializeToString(out).replace(/^<g[^>]*>/, '').replace(/<\/g>$/, '');
}

function iconFor(type) {
  let inner = Object.prototype.hasOwnProperty.call(BUILTIN_ICONS, type) ? BUILTIN_ICONS[type] : '';
  if (!inner) {
    const c = (state.config.customTypes || {})[type];
    inner = (c && sanitizeIconSvg(c.icon)) || BUILTIN_ICONS.unknown;
  }
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
}
