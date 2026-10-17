// NodeRunner - app.js
// =========================
// Core: state, persistence (assignments.json via the local backend), scan
// polling, anomaly detection, the topology map (drag&drop hosts + rooms),
// and the device details drawer. Loaded LAST (after icons.js, registry.js,
// settings.js) since this is the file that actually boots the app at the
// bottom (render(); loadState()...).
//
// Sibling modules (loaded before this one, same global scope, no bundler):
//   icons.js    - device-type catalogue + the SVG icon library
//   registry.js - the Host Registry panel (whitelist / historical reference)
//   settings.js - the Settings panel (custom types/vendors/rooms)

/* ============================================================================
   APP LOGIC
   ========================================================================== */

// Validate server data, browser caches and imported backups before using them.
// Read legacy browser settings without deleting them. New values, including
// an explicitly cleared token, take precedence over the previous namespace.
function readBrowserSetting(key) {
  const current = localStorage.getItem('noderunner_' + key);
  return current !== null ? current : localStorage.getItem('hns_' + key);
}
function writeBrowserSetting(key, value) {
  localStorage.setItem('noderunner_' + key, value);
}

const NR_MAX_BODY_BYTES = 2 * 1024 * 1024;
const NR_RESERVED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function dataObject(value, name, limit = 10000) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(name + ' must be an object');
  const keys = Object.keys(value);
  if (keys.length > limit || keys.some((k) => !k || k.length > 128 || NR_RESERVED_KEYS.has(k))) {
    throw new Error(name + ' contains too many entries or an invalid key');
  }
  return value;
}
function dataText(value, name, limit = 1024) {
  if (typeof value !== 'string' || value.length > limit) throw new Error('Invalid ' + name);
  return value;
}
function dataTimestamp(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) throw new Error('Invalid timestamp');
  return value;
}
function validateAssignments(input) {
  const data = dataObject(input, 'assignments');
  const overrides = Object.create(null), known = Object.create(null);
  const strings = ['alias', 'name', 'typeOverride', 'vendorOverride', 'room', 'lastIp',
    'lastMac', 'lastHostname', 'vendorAuto', 'typeAuto'];
  Object.entries(dataObject(data.overrides === undefined ? {} : data.overrides, 'overrides')).forEach(([id, value]) => {
    const entry = dataObject(value, 'device override', 30), clean = Object.create(null);
    strings.forEach((key) => { if (entry[key] !== undefined) clean[key] = dataText(entry[key], key); });
    ['trusted', 'flagged', 'blocked'].forEach((key) => {
      if (entry[key] === undefined) return;
      if (typeof entry[key] !== 'boolean') throw new Error('Invalid ' + key);
      clean[key] = entry[key];
    });
    if (entry.conn !== undefined) {
      if (!['wifi', 'wired', 'unset'].includes(entry.conn)) throw new Error('Invalid connection type');
      clean.conn = entry.conn;
    }
    if (entry.lastSeen !== undefined) clean.lastSeen = dataTimestamp(entry.lastSeen);
    if (entry.lastPorts !== undefined) {
      if (!Array.isArray(entry.lastPorts) || entry.lastPorts.length > 65535 ||
          entry.lastPorts.some((p) => !Number.isInteger(p) || p < 1 || p > 65535)) throw new Error('Invalid port list');
      clean.lastPorts = entry.lastPorts.slice();
    }
    if (entry.pos != null) {
      const pos = dataObject(entry.pos, 'position', 2);
      if (Object.keys(pos).length !== 2 || [pos.xPct, pos.yPct].some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100)) {
        throw new Error('Invalid position');
      }
      clean.pos = { xPct: pos.xPct, yPct: pos.yPct };
    }
    overrides[id] = clean;
  });
  Object.entries(dataObject(data.known === undefined ? {} : data.known, 'known')).forEach(([id, ts]) => { known[id] = dataTimestamp(ts); });
  if (data.baseline !== undefined && typeof data.baseline !== 'boolean') throw new Error('Invalid baseline');
  const source = dataObject(data.config === undefined ? {} : data.config, 'config', 20);
  const config = { customTypes: Object.create(null), customVendors: [], scanTarget: '' };
  Object.entries(dataObject(source.customTypes === undefined ? {} : source.customTypes, 'customTypes', 500)).forEach(([key, value]) => {
    const type = dataObject(value, 'custom type', 2);
    config.customTypes[key] = { label: dataText(type.label === undefined ? '' : type.label, 'type label', 120),
      icon: dataText(type.icon === undefined ? '' : type.icon, 'type icon', 20000) };
  });
  const vendors = source.customVendors === undefined ? [] : source.customVendors;
  if (!Array.isArray(vendors) || vendors.length > 500) throw new Error('Invalid vendor list');
  config.customVendors = vendors.map((v) => dataText(v, 'vendor', 120));
  if (source.scanTarget !== undefined) config.scanTarget = dataText(source.scanTarget, 'scan target', 128);
  if (source.rooms !== undefined) {
    config.rooms = Object.create(null);
    Object.entries(dataObject(source.rooms, 'rooms', 100)).forEach(([key, value]) => {
      const room = dataObject(value, 'room', 20); // legacy backups include layout metadata
      config.rooms[key] = { label: dataText(room.label === undefined ? '' : room.label, 'room label', 120) };
      if (room.gridSize !== undefined) {
        if (![2, 3, 4].includes(room.gridSize)) throw new Error('Invalid room grid size');
        config.rooms[key].gridSize = room.gridSize;
      }
    });
  }
  return { overrides, known, baseline: data.baseline === true, config };
}
function backendBase(locationInfo, servedByBackend) {
  if (servedByBackend) return '';
  if (locationInfo.protocol === 'file:') return 'http://localhost:8000';
  const url = new URL(locationInfo.href);
  if (url.port === '8000') return '';
  url.port = '8000';
  return url.origin;
}

// ---- where to read data from -------------------------------------------------
// Backend-served pages use their own origin (including custom ports/proxies).
// Static Apache/file:// pages retain the :8000 fallback, preserving HTTPS.
const API_BASE = backendBase(location, !!(document.querySelector('meta[name="noderunner-backend"][content="same-origin"]') || document.querySelector('meta[name="hns-backend"][content="same-origin"]')));

const AUTO_REFRESH_MS = 0;   // set e.g. 30000 to auto-rescan every 30s; 0 = off

const THEMES = ['light', 'phosphor', 'ion'];
// Numbered development releases; earlier work is consolidated in v0.1.0.
// Add new releases at the beginning; the visible version comes from this list.
const APP_RELEASES = [{
  version: '0.1.2',
  date: '2026-10-17',
  summary: 'Configurable room grids, shared map controls and an experimental Fedora RPM.',
  changes: [
    { title: 'Map', items: [
      'Choose a 2×2, 3×3 or 4×4 minimum grid per room; rooms and canvas adapt to their contents.',
      'Room titles show the mapped host count alongside grid size.',
      'Expand map hides the side lists and restores their previous visibility; available only in Map.',
    ] },
    { title: 'Toolbar', items: [
      'One shared gear-icon Settings button, aligned with the view controls.',
      'Last-scan status appears in a framed box with a clock icon.',
    ] },
    { title: 'Installation', items: [
      'Separate application assets and private state with configurable installation paths.',
      'Experimental Fedora 44 RPM with an unprivileged localhost-only service; installation does not start scans.',
    ] },
  ],
}, {
  version: '0.1.1',
  date: '2026-10-17',
  summary: 'Official NodeRunner artwork and optimized application icons.',
  changes: [
    { title: 'Branding', items: [
      'The NR artwork is now the application icon, with a simplified NR favicon.',
      'README banner, GitHub social preview and downloadable wallpaper.',
      'Original artwork is preserved separately from optimized web assets.',
    ] },
    { title: 'Compatibility', items: [
      'PNG app icons and an updated web app manifest.',
      'Only explicitly allowed branding files are served by the backend.',
    ] },
  ],
}, {
  version: '0.1.0',
  date: '2026-10-17',
  summary: 'First numbered NodeRunner development release.',
  changes: [
    { title: 'Interface', items: [
      'Shared Map / Registry navigation, with Run scan always available.',
      'Light, Phosphor and Ion themes with previews and saved preferences.',
      'A visible version and release history, available from the NodeRunner name.',
    ] },
    { title: 'Map and registry', items: [
      'Room grids start at 16 places. Drag hosts freely without realigning their neighbours.',
      'Gateway room assignment and separate space for the Wi-Fi and Wired panels.',
      'Editable vendor, connection and room fields, sortable columns and grouped tables.',
      'Excel export and yellow highlighting for devices missing from the latest scan.',
    ] },
    { title: 'Reliability', items: [
      'Clear scan errors, protection against duplicate scans and safer data validation.',
      'Existing device assignments, tokens and browser preferences remain compatible.',
    ] },
  ],
}];
const APP_VERSION = APP_RELEASES[0].version;

function closeThemeMenu(restoreFocus = false) {
  const menu = document.getElementById('theme-menu');
  const wasOpen = menu.open;
  menu.open = false;
  if (restoreFocus && wasOpen) document.getElementById('theme-trigger').focus();
}

function dismissThemeMenu(event) {
  const menu = document.getElementById('theme-menu');
  if (menu.open && !menu.contains(event.target)) closeThemeMenu();
}

function buildChangelog() {
  const content = el('div');
  APP_RELEASES.forEach((release) => {
    const section = el('section', 'release-entry');
    const heading = el('div', 'release-heading');
    const version = el('h3'); version.textContent = 'v' + release.version;
    const date = el('time'); date.dateTime = release.date;
    date.textContent = new Date(release.date + 'T12:00:00Z').toLocaleDateString('en-GB', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
    });
    heading.appendChild(version); heading.appendChild(date); section.appendChild(heading);
    const summary = el('p'); summary.textContent = release.summary; section.appendChild(summary);
    release.changes.forEach((group) => {
      const title = el('h4'); title.textContent = group.title; section.appendChild(title);
      const list = el('ul');
      group.items.forEach((item) => { const li = el('li'); li.textContent = item; list.appendChild(li); });
      section.appendChild(list);
    });
    content.appendChild(section);
  });
  return content;
}

function openChangelog() {
  closeThemeMenu();
  const dialog = document.getElementById('changelog-dialog');
  if (!dialog.open) dialog.showModal();
}

function initializeReleaseInfo() {
  const brand = document.getElementById('brand-button');
  document.getElementById('app-version').textContent = 'v' + APP_VERSION + ' · Changelog';
  brand.setAttribute('aria-label', 'NodeRunner v' + APP_VERSION + ' — Open changelog');
  brand.onclick = openChangelog;
  const dialog = document.getElementById('changelog-dialog');
  if (dialog.dataset.ready) return;
  document.getElementById('changelog-content').appendChild(buildChangelog());
  document.getElementById('changelog-close').onclick = () => dialog.close();
  dialog.onclose = () => brand.focus();
  dialog.onclick = (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  };
  dialog.dataset.ready = '1';
}
function readTheme() {
  try {
    const theme = readBrowserSetting('theme');
    return THEMES.includes(theme) ? theme : 'phosphor';
  } catch (e) { return 'phosphor'; }
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  const label = state.theme === 'light' ? 'Light' : state.theme === 'ion' ? 'Ion' : 'Phosphor';
  document.getElementById('theme-current').textContent = label;
  document.getElementById('theme-trigger').title = 'Theme: ' + label;
  document.querySelectorAll('[data-theme-option]').forEach((button) => {
    const selected = button.getAttribute('data-theme-option') === state.theme;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.onclick = () => setTheme(button.getAttribute('data-theme-option'));
  });
  document.getElementById('theme-menu').onkeydown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); closeThemeMenu(true); }
  };
}
function setTheme(theme) {
  if (!THEMES.includes(theme)) return;
  state.theme = theme;
  try { writeBrowserSetting('theme', theme); } catch (e) { /* usable for this session */ }
  // CSS changes in place: preserve table scroll, edited fields and focus.
  applyTheme();
  closeThemeMenu(true);
}

// ---- backend access token ----------------------------------------------------
// Every /api/* request must carry this as the X-NodeRunner-Token header, or the
// backend rejects it with 403. Kept in localStorage (per browser/device, NOT
// synced through assignments.json - that endpoint is itself gated by the
// token, so storing it there would be circular, and it must never be
// readable by an unauthenticated request anyway). Pasted once from the
// terminal output of noderunner.py into Settings -> Connection.
function getToken() { return readBrowserSetting('token') || ''; }
function setToken(v) { writeBrowserSetting('token', (v || '').trim()); }
function authHeaders(extra) {
  const h = Object.assign({}, extra || {});
  const t = getToken();
  if (t) h['X-NodeRunner-Token'] = t;
  return h;
}

// the topology SVG's coordinate system: every node's pixel position is first
// expressed as a 0-1040 x 0-720 "viewBox" coordinate, then converted to a %
// of the stage element so it scales with the window. Drag&drop (deviceNode)
// and the auto-layout (renderStage) both need these, hence module-level.
const STAGE_W = 1040, STAGE_H = 720, STAGE_CX = 520, STAGE_CY = 360;

// ---- in-memory state ---------------------------------------------------------
const state = {
  source: 'connecting',   // 'connecting' | 'live' | 'error'
  errorMsg: '',
  scanning: false,
  subnet: '',
  lastScan: null,
  devices: [],            // normalized device list from the backend
  overrides: {},          // per-device user data (conn type, name, flag, block) - loaded from server
  assignmentsLoaded: false, // true once loadState() has actually pulled real data from the backend -
                             // saveState() refuses to POST until then, so a stale/empty in-memory
                             // state (e.g. loaded while the access token was still invalid) can never
                             // clobber the real assignments.json once the token starts working again
  known: {},              // map id -> first-seen timestamp (baseline of known hosts)
  baseline: false,        // true once the first scan established the known set
  prevHosts: {},          // hosts seen in the previous scan (for disappear detection)
  anomalies: [],          // anomalies found on the last scan
  scanClean: false,       // true if last scan found no anomalies (and baseline existed)
  anomalyDismissed: false,
  selectedId: null,
  theme: readTheme(),
  registryOpen: location.hash === '#registry', // dedicated full-page view
  registryFilter: '',     // text filter for the registry table
  registrySort: 'ip',
  registrySortDirection: 'asc',
  settingsOpen: false,    // true when the Settings panel is shown
  mapPanelRestore: null,  // panel visibility before expanding the map
  config: {                // GLOBAL app settings, not tied to any single host
    customTypes: {},       // { key: { label, icon } } - icon = inner SVG markup
    customVendors: [],     // [ name, ... ]
    rooms: {},              // { key: { label, gridSize? } } - position/size are computed, see roomsLayout()
  },
};

// ---- persistence (saved on the PC, by the backend, in assignments.json) -----
// We load assignments + the known-hosts baseline from the backend so they are
// shared across browsers/devices/origins. localStorage is only a fallback cache
// for when the backend can't be reached.
async function loadState() {
  try {
    const r = await fetch(API_BASE + '/api/assignments', { cache: 'no-store', headers: authHeaders() });
    if (r.ok) {
      const j = validateAssignments(await r.json());
      state.overrides = j.overrides || {};
      state.known = j.known || {};
      state.baseline = !!j.baseline;
      state.config = normalizeConfig(j.config);
      state.assignmentsLoaded = true;
      mirrorLocal();
      return;
    }
  } catch (e) { /* backend unreachable - fall back to local cache */ }
  // loadState() can be in flight more than once at a time (once at page boot
  // with no token yet, again right after the token is saved in Settings) and
  // the two calls can resolve out of order. If a later, successful call
  // already installed real data (assignmentsLoaded), this - possibly slower,
  // failing - call must NOT clobber it with the (likely empty) local cache.
  if (state.assignmentsLoaded) return;
  try {
    const c = validateAssignments(JSON.parse(readBrowserSetting('state_v2') || '{}'));
    state.overrides = c.overrides || {};
    state.known = c.known || {};
    state.baseline = !!c.baseline;
    state.config = normalizeConfig(c.config);
  } catch (e) {}
}
function normalizeConfig(c) {
  c = validateAssignments({ config: c || {} }).config;
  return {
    customTypes: (c.customTypes && typeof c.customTypes === 'object') ? c.customTypes : {},
    customVendors: Array.isArray(c.customVendors) ? c.customVendors : [],
    // IMPORTANT: only seed the default rooms when "rooms" was never set at all
    // (c.rooms === undefined). An explicit {} means the user deleted every
    // room on purpose, and must NOT be re-seeded on the next load.
    rooms: (c.rooms && typeof c.rooms === 'object') ? c.rooms : DEFAULT_ROOMS(),
    scanTarget: c.scanTarget,
  };
}
function DEFAULT_ROOMS() {
  // position/size are never stored - roomsLayout() divides the stage evenly
  // among however many rooms exist. Optional gridSize controls the minimum. Add or
  // remove rooms from Settings; the layout re-divides itself automatically.
  return {
    cucina:   { label: 'Kitchen' },
    camera1:  { label: 'Bedroom 1' },
    camera2:  { label: 'Bedroom 2' },
    bagno:    { label: 'Bathroom' },
    garage:   { label: 'Garage' },
    soffitta: { label: 'Attic' },
  };
}
let pendingSave = null;
let savingState = false;
function saveStatus(message) {
  let box = document.getElementById('save-status');
  if (!box) {
    box = document.createElement('div');
    box.id = 'save-status';
    box.setAttribute('role', 'status');
    box.style.cssText = 'color:var(--warn);padding:0 16px;font-size:12px;';
    document.getElementById('anomaly-bar').after(box);
  }
  box.textContent = message;
}
async function flushStateSaves() {
  if (savingState) return;
  savingState = true;
  try {
    while (pendingSave !== null) {
      const body = pendingSave;
      pendingSave = null;
      const r = await fetch(API_BASE + '/api/assignments', {
        method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body,
      });
      if (!r.ok) throw new Error('http ' + r.status);
      saveStatus('');
    }
  } catch (e) {
    saveStatus('Changes could not be saved on the server. Check the connection/token and retry your edit.');
  } finally {
    savingState = false;
  }
}
function saveState() {
  mirrorLocal();
  // Refuse to push to the backend until we've actually loaded its real data
  // at least once - otherwise a page that booted with an empty/invalid token
  // (state.overrides still {}) could overwrite the real assignments.json the
  // moment the token starts working, before ever re-fetching it.
  if (!state.assignmentsLoaded) {
    saveStatus('Changes are saved only in this browser: the server registry could not be loaded. Check the token, connection and server data.');
    return;
  }
  // Serialize writes so a slower old request cannot overwrite a newer edit.
  pendingSave = JSON.stringify({ overrides: state.overrides, known: state.known, baseline: state.baseline, config: state.config });
  flushStateSaves();
}
function mirrorLocal() {
  try { writeBrowserSetting('state_v2', JSON.stringify({ overrides: state.overrides, known: state.known, baseline: state.baseline, config: state.config })); }
  catch (e) {}
}
function setOverride(id, patch) {
  state.overrides[id] = Object.assign({}, state.overrides[id], patch);
  saveState();
  render();
}

// ---- room layout: automatic rectangles sized to each room's grid ----------
// Grid sizes are minimums; additional occupants expand a room automatically.
// Rows and columns share the canvas in proportion to the required card space.
// Saved manual host coordinates remain unchanged; grids place unpositioned hosts.
const ROOM_GRID_GAP = 2; // % of stage between adjacent room rectangles

function roomsLayout(deviceIds = state.devices.map((d) => d.id)) {
  const ids = Object.keys(state.config.rooms || {});
  const n = ids.length;
  const layout = {};
  if (!n) return layout;
  // bias column count toward the stage's aspect ratio so rooms come out
  // roughly rectangular instead of tall slivers or a single wide strip
  const cols = Math.max(1, Math.min(n, Math.round(Math.sqrt(n * (STAGE_W / STAGE_H)))));
  const rows = Math.ceil(n / cols);
  const roomWidth = (id) => roomGridSize(id, deviceIds) * 190 + 32;
  const rowHeights = Array.from({ length: rows }, (_, r) =>
    Math.max(...ids.slice(r * cols, (r + 1) * cols).map((id) => roomGridSize(id, deviceIds) * 116 + 48)));
  const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0);
  let y = 0;
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    const rowCount = Math.min(cols, n - idx);
    const rowWidth = ids.slice(idx, idx + rowCount).reduce((sum, id) => sum + roomWidth(id), 0);
    const height = (100 - rows * ROOM_GRID_GAP) * rowHeights[r] / totalHeight;
    let x = 0;
    for (let c = 0; c < rowCount; c++) {
      const id = ids[idx++];
      const width = (100 - rowCount * ROOM_GRID_GAP) * roomWidth(id) / rowWidth;
      layout[id] = {
        x: x + ROOM_GRID_GAP / 2,
        y: y + ROOM_GRID_GAP / 2,
        w: width,
        h: height,
      };
      x += width + ROOM_GRID_GAP;
    }
    y += height + ROOM_GRID_GAP;
  }
  return layout;
}

// which room (if any) contains a given stage point - used both to highlight
// a drop target while dragging and to decide, on drop, whether a host
// changed rooms.
function roomAtPoint(xPct, yPct) {
  const layout = roomsLayout();
  return Object.keys(layout).find((id) => {
    const r = layout[id];
    return xPct >= r.x && xPct <= r.x + r.w && yPct >= r.y && yPct <= r.y + r.h;
  }) || null;
}

// Keep the selected minimum grid, defaulting to 4×4 for existing rooms.
// Larger populations expand the square automatically; no host is discarded.
function roomGridSize(roomId, deviceIds = state.devices.map((d) => d.id)) {
  const count = deviceIds.filter((id) => (state.overrides[id] || {}).room === roomId).length;
  const room = (state.config.rooms || {})[roomId] || {};
  return Math.max(room.gridSize || 4, Math.ceil(Math.sqrt(count)));
}

function mapMinimumSize(deviceIds) {
  const layout = roomsLayout(deviceIds);
  let width = 420, height = 300;
  Object.entries(layout).forEach(([id, rect]) => {
    const side = roomGridSize(id, deviceIds);
    width = Math.max(width, (side * 190 + 32) * 100 / rect.w);
    height = Math.max(height, (side * 116 + 48) * 100 / rect.h);
  });
  return { width: Math.ceil(width), height: Math.ceil(height) };
}

function roomGridSlots(roomId, deviceIds) {
  const rect = roomsLayout(deviceIds)[roomId];
  if (!rect) return [];
  const side = roomGridSize(roomId, deviceIds);
  const stage = document.getElementById('stage');
  const minimum = mapMinimumSize(deviceIds);
  const width = (stage && stage.clientWidth) || minimum.width;
  const height = (stage && stage.clientHeight) || minimum.height;
  const padX = 16 / width * 100, padTop = 32 / height * 100, padBottom = 16 / height * 100;
  const cellW = (rect.w - 2 * padX) / side;
  const cellH = (rect.h - padTop - padBottom) / side;
  const scale = Math.min(1, cellW * width / 100 / 190, cellH * height / 100 / 116);
  return Array.from({ length: side * side }, (_, i) => ({
    xPct: rect.x + padX + cellW * (i % side + 0.5),
    yPct: rect.y + padTop + cellH * (Math.floor(i / side) + 0.5),
    scale,
  }));
}

function nearestRoomSlot(slots, pos) {
  if (!pos) return 0;
  const stage = document.getElementById('stage');
  const width = (stage && stage.clientWidth) || 900;
  const height = (stage && stage.clientHeight) || 620;
  let best = 0, distance = Infinity;
  slots.forEach((slot, i) => {
    const d = Math.hypot((slot.xPct - pos.xPct) * width, (slot.yPct - pos.yPct) * height);
    if (d < distance) { best = i; distance = d; }
  });
  return best;
}

// Keep manual coordinates exactly; the grid only places hosts without a position.
// Reserve nearby cells first so new hosts avoid manually arranged neighbours.
function roomHostPositions(deviceIds, gridDeviceIds = deviceIds) {
  const positions = {};
  Object.keys(state.config.rooms || {}).forEach((roomId) => {
    const slots = roomGridSlots(roomId, gridDeviceIds);
    const ids = deviceIds.filter((id) => (state.overrides[id] || {}).room === roomId);
    ids.sort((a, b) => Number(!!(state.overrides[b] || {}).pos) - Number(!!(state.overrides[a] || {}).pos) || a.localeCompare(b));
    ids.forEach((id) => {
      const index = nearestRoomSlot(slots, (state.overrides[id] || {}).pos);
      const slot = slots.splice(index, 1)[0];
      const saved = (state.overrides[id] || {}).pos;
      positions[id] = saved ? { xPct: saved.xPct, yPct: saved.yPct, scale: 1 } : slot;
    });
  });
  return positions;
}

// Preserve neighbours when the dragged card leaves a hole in the grid.
// This is committed together with the dragged host by setOverride below.
function pinRoomOccupants(roomId, draggedId) {
  const positions = roomHostPositions(state.devices.map((d) => d.id));
  Object.entries(positions).forEach(([id, pos]) => {
    const override = state.overrides[id] || {};
    if (id !== draggedId && override.room === roomId && !override.pos) {
      state.overrides[id] = Object.assign({}, override, { pos: { xPct: pos.xPct, yPct: pos.yPct } });
    }
  });
}

// Freeze visible automatic positions before moving a card, including hosts
// outside rooms whose radial layout would otherwise compact on the next render.
function pinMapOccupants(stage, draggedId) {
  stage.querySelectorAll('.node').forEach((node) => {
    const id = node.dataset.deviceId;
    if (!id || id === draggedId || (state.overrides[id] || {}).pos) return;
    const xPct = parseFloat(node.style.left), yPct = parseFloat(node.style.top);
    if (!Number.isFinite(xPct) || !Number.isFinite(yPct)) return;
    state.overrides[id] = Object.assign({}, state.overrides[id], { pos: { xPct, yPct } });
  });
}

// assigns (or clears, if roomId is '') a host to a room via the drawer/
// Registry dropdown. An unpinned host takes the next available grid cell.
function assignHostToRoom(id, roomId) {
  const currentRoom = (state.overrides[id] || {}).room;
  if (currentRoom === (roomId || undefined)) return;
  if (currentRoom) pinRoomOccupants(currentRoom, id);
  if (roomId) pinRoomOccupants(roomId, id);
  setOverride(id, { room: roomId || undefined, pos: undefined });
}

// keeps a per-host historical cache (ip, mac, vendor, ports, last seen) inside
// overrides[id], independent of whether the host is trusted/flagged/etc.
// This is what powers the Host Registry panel and the IP-change anomaly.
function updateRegistryCache(curList) {
  curList.forEach((d) => {
    const prev = state.overrides[d.id] || {};
    if (d.id === 'gw' && !state.known.gw) state.known.gw = state.scanTimestamp || Date.now();
    state.overrides[d.id] = Object.assign({}, prev, {
      lastIp: d.ip,
      lastMac: d.mac,
      lastHostname: d.hostname === undefined ? d.name : d.hostname,
      lastPorts: d.ports || [],
      // An inferred gateway is not evidence that the router answered a probe.
      lastSeen: d.id === 'gw' && d.status !== 'online' ? prev.lastSeen : state.scanTimestamp || Date.now(),
      vendorAuto: d.vendor,   // auto-detected value, kept separate from vendorOverride
      typeAuto: d.type,       // auto-detected value, kept separate from typeOverride
    });
  });
  saveState();
}

// ---- anomaly detection (runs after every successful scan) -------------------
// A locally-administered (often randomized) MAC has bit 1 of the first octet
// set -> the second hex digit is one of 2/6/A/E. Useful as a soft hint.
function isRandomMac(mac) {
  if (!mac || mac === '\u2014') return false;
  return ['2', '6', 'A', 'E'].indexOf((mac[1] || '').toUpperCase()) >= 0;
}

// A matching hostname is only a suggestion for manual review. It cannot
// establish identity or transfer trust to a device with a new MAC address.
function findHostnameTwin(d, curIds) {
  if (!isRandomMac(d.mac) || !d.name) return null;
  const name = d.name.toLowerCase();
  const oldId = Object.keys(state.overrides).find((k) => {
    if (k === d.id || curIds.indexOf(k) >= 0) return false;   // skip itself / still-live hosts
    const o = state.overrides[k];
    if (!o || (!o.alias && !o.room)) return false;             // only auto-link deliberately configured hosts
    return (o.lastHostname || '').toLowerCase() === name;
  });
  return oldId || null;
}

function detectAnomalies(list) {
  const cur = list.filter((d) => d.id !== 'gw');
  const curIds = cur.map((d) => d.id);
  const anomalies = [];
  const wasBaseline = state.baseline;

  if (!wasBaseline) {
    // first scan ever: record everything as "known" without alarming
    cur.forEach((d) => { state.known[d.id] = Date.now(); });
    state.baseline = true;
  } else {
    // hosts never seen before
    cur.forEach((d) => {
      if (!state.known[d.id]) {
        const twinId = findHostnameTwin(d, curIds);
        if (twinId) {
          // A hostname is unauthenticated: never transfer trust or identity.
          anomalies.push({ sev: 'warn', id: d.id, text: 'Possible hostname match; verify this new device manually \u2014 ' + nameOf(d) + '   ' + d.ip });
        }
        state.known[d.id] = Date.now();
        const sev = (isRandomMac(d.mac) || d.type === 'unknown') ? 'danger' : 'warn';
        anomalies.push({ sev, id: d.id, text: 'New host \u2014 ' + nameOf(d) + '   ' + d.ip + '   ' + d.mac });
      }
    });
    // hosts that were present last scan but are gone now \u2014 skipped for
    // trusted hosts (flickering laptops/phones/tablets are expected to drop
    // off and reappear, that is not an anomaly once whitelisted).
    Object.keys(state.prevHosts || {}).forEach((id) => {
      if (curIds.indexOf(id) < 0 && !isTrusted(id)) {
        const h = state.prevHosts[id];
        anomalies.push({ sev: 'info', id: null, text: 'Host disappeared \u2014 ' + h.name + '   ' + h.ip });
      }
    });
    // IP changed since the last time we saw this host \u2014 useful even (especially)
    // for trusted hosts: DHCP renewal is normal, but a sudden IP change can also
    // mean a MAC was cloned/spoofed onto a different machine.
    cur.forEach((d) => {
      const o = state.overrides[d.id];
      const prevIp = o && o.lastIp;
      if (prevIp && prevIp !== d.ip) {
        anomalies.push({
          sev: isTrusted(d.id) ? 'info' : 'warn',
          id: d.id,
          text: 'IP changed \u2014 ' + nameOf(d) + '   ' + prevIp + ' \u2192 ' + d.ip,
        });
      }
    });
  }
  // a blocked host that is still answering
  cur.forEach((d) => {
    if (isBlocked(d)) anomalies.push({ sev: 'danger', id: d.id, text: 'Blocked host is online \u2014 ' + nameOf(d) + '   ' + d.ip });
  });

  // remember this scan's hosts for the next comparison
  const pv = {};
  cur.forEach((d) => { pv[d.id] = { name: nameOf(d), ip: d.ip }; });
  state.prevHosts = pv;

  updateRegistryCache(list);  // include the gateway in the registry, outside host anomaly checks

  state.anomalies = anomalies;
  state.scanClean = wasBaseline && anomalies.length === 0;
  state.anomalyDismissed = false;
  saveState();
}

// ---- small helpers -----------------------------------------------------------
function ipKey(ip) {
  return (ip || '').split('.').reduce((a, p) => a * 256 + (parseInt(p, 10) || 0), 0);
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function nowClock() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}
// connection type for a device = user override if set, else 'unset'
function connOf(d) {
  if (d.id === 'gw') return 'gateway';
  const o = state.overrides[d.id];
  return (o && o.conn) || 'unset';
}
function nameOf(d) {
  const o = state.overrides[d.id];
  return (o && o.name) || d.name;
}
function aliasOf(d) {
  const o = state.overrides[d.id];
  return (o && o.alias) || '';
}
// "effective" type/vendor = manual override (set in the Registry) if present,
// else what the scan/heuristics guessed.
function typeOf(d) {
  const o = state.overrides[d.id];
  return (o && o.typeOverride) || d.type;
}
function vendorOf(d) {
  const o = state.overrides[d.id];
  return (o && o.vendorOverride) || d.vendor;
}
function isTrusted(id) { const o = state.overrides[id]; return !!(o && o.trusted); }
function isFlagged(d) { const o = state.overrides[d.id]; return !!(o && o.flagged); }
function isBlocked(d) { const o = state.overrides[d.id]; return !!(o && o.blocked); }

function statusColor(d) {
  if (isBlocked(d)) return 'var(--danger)';
  if (isFlagged(d)) return 'var(--warn)';
  if (d.status !== 'online') return 'var(--dim)';
  if (connOf(d) === 'unset') return 'var(--dim)';
  return 'var(--accent2)';
}
function statusTag(d) {
  if (isBlocked(d)) return 'BLOCKED';
  if (isFlagged(d)) return 'SUSPECT';
  if (d.status === 'offline') return 'OFFLINE';
  if (d.status !== 'online') return 'UNVERIFIED';
  if (connOf(d) === 'unset') return 'UNSET';
  return 'ONLINE';
}

// ---- talk to the backend -----------------------------------------------------
// force=true hits /api/scan (fresh scan); otherwise /api/devices (cached).
async function fetchDevices(force) {
  const url = API_BASE + (force ? '/api/scan' : '/api/devices');
  const r = await fetch(url, { cache: 'no-store', headers: authHeaders() });
  if (!r.ok) {
    const error = await r.json().catch(() => ({}));
    throw new Error('http ' + r.status + (error.error ? ': ' + error.error : ''));
  }
  const j = await r.json();
  const list = normalize(j);
  return { list, subnet: j.subnet || '', ts: j.ts, portsScanned: j.portsScanned !== false };
}

// turn the backend JSON into a flat device array the UI understands
function normalize(j) {
  const out = [];
  const g = j.gateway;
  const gwIp = g && g.ip ? g.ip : null;
  if (g && g.ip) {
    out.push({ id:'gw', name:'Gateway Router', hostname:g.hostname || '', model: g.vendor || '\u2014',
      ip: g.ip, mac: g.mac || '\u2014', vendor: g.vendor || '\u2014', type:'router',
      status:g.status || 'unknown', ports: g.ports || [] });
  }
  (j.devices || []).forEach((d) => {
    if (gwIp && d.ip === gwIp) return;          // don't duplicate the gateway
    const type = d.type || 'unknown';
    out.push({
      id: (d.mac && d.mac !== '\u2014') ? d.mac : ('ip-' + d.ip),  // MAC is the stable key
      name: d.hostname || d.vendor || d.ip,
      model: d.vendor || '\u2014',
      ip: d.ip, mac: d.mac || '\u2014',
      vendor: d.vendor || 'Unknown', type,
      status: d.status || 'online', ports: d.ports || [],
    });
  });
  if (!out.some((x) => x.id === 'gw') && gwIp) {
    out.unshift({ id:'gw', name:'Gateway', model:'\u2014', ip:gwIp, mac:'\u2014',
      vendor:'\u2014', type:'router', status:'online', ports:[] });
  }
  return out;
}

// ---- run a scan --------------------------------------------------------------
let scanTimer = null;
async function runScan(force) {
  if (state.scanning) return;
  state.scanning = true;
  state.source = 'connecting';
  state.errorMsg = '';
  render();
  try {
    const { list, subnet, ts, portsScanned } = await fetchDevices(force);
    state.devices = list;
    state.subnet = subnet;
    state.source = 'live';
    state.lastScan = new Date(ts * 1000).toLocaleTimeString();
    state.scanTimestamp = ts * 1000;
    state.portsScanned = portsScanned;
    detectAnomalies(list);          // flag new / gone / blocked-online hosts
  } catch (e) {
    // NO demo fallback — surface the error in the center of the screen.
    state.devices = [];
    state.source = 'error';
    state.errorMsg = (e && /http 403/.test(e.message))
      ? 'Backend token missing or invalid. Open Settings → Connection and paste the token shown in the noderunner.py terminal output.'
      : (e && /http 502/.test(e.message)) ? e.message.replace(/^http 502: /, '')
      : 'Scanner unavailable. Check the backend address, terminal output and connection, then retry.';
  }
  state.scanning = false;
  render();
}

// ============================================================================
//  RENDERING  (rebuilds the DOM from state — simple and easy to follow)
// ============================================================================
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

function render() {
  applyTheme();

  const all = state.devices;
  const others = all.filter((d) => d.id !== 'gw');
  const byIp = (a, b) => ipKey(a.ip) - ipKey(b.ip);
  const wifi = others.filter((d) => connOf(d) === 'wifi').sort(byIp);
  const wired = others.filter((d) => connOf(d) === 'wired').sort(byIp);
  const unset = others.filter((d) => connOf(d) === 'unset').sort(byIp);

  renderStats(all, wifi, wired, unset);
  renderScanBtn();
  renderAnomalies();
  renderSidePanels(wifi, wired);
  renderStage(all, wifi, wired, unset);
  renderDrawer(all);
  renderRegistry();
  renderSettings();
}

function renderStats(all, wifi, wired, unset) {
  const online = all.filter((d) => d.status === 'online' && !isBlocked(d)).length;
  const threats = all.filter((d) => isFlagged(d) && !isBlocked(d)).length;
  const items = [
    ['Online', online + '<small>/' + all.length + '</small>', 'var(--accent2)'],
    ['WiFi', wifi.length, 'var(--txt)'],
    ['Wired', wired.length, 'var(--txt)'],
    ['Unset', unset.length, 'var(--dim)'],
    ['Threats', threats, threats > 0 ? 'var(--warn)' : 'var(--dim)'],
  ];
  const box = document.getElementById('stats');
  box.innerHTML = '';
  items.forEach(([k, v, col]) => {
    const s = el('div', 'stat');
    s.innerHTML = '<div class="k">' + k + '</div><div class="v" style="color:' + col + '">' + v + '</div>';
    box.appendChild(s);
  });
  document.getElementById('wifi-cnt').textContent = wifi.length;
  document.getElementById('wired-cnt').textContent = wired.length;
}

function renderScanBtn() {
  const b = document.getElementById('scanbtn');
  b.className = 'view-tab scan-action' + (state.scanning ? ' busy' : '');
  b.disabled = state.scanning;
  b.setAttribute('aria-busy', String(state.scanning));
  b.onclick = () => runScan(true);
  document.getElementById('scan-label').textContent = state.scanning ? 'Scanning…' : 'Run scan';
  document.getElementById('lastscan').textContent = state.scanning ? 'Scan in progress'
    : state.source === 'error' ? 'Scan failed · retry'
    : state.lastScan ? ('Last scan: ' + state.lastScan) : 'No scans yet';
}

// the anomaly bar under the header
function renderAnomalies() {
  const bar = document.getElementById('anomaly-bar');
  const a = state.anomalies || [];
  if (state.anomalyDismissed || (!a.length && !state.scanClean)) {
    bar.style.display = 'none'; bar.innerHTML = ''; return;
  }
  bar.style.display = 'flex';
  const addClose = () => {
    const x = el('button', 'ab-x', '\u00d7');
    x.onclick = () => { state.anomalyDismissed = true; renderAnomalies(); };
    bar.appendChild(x);
  };
  if (!a.length && state.scanClean) {
    bar.className = 'anomaly clean';
    bar.innerHTML = '<span class="ab-ic">\u2714</span><div class="ab-msg">Scan clean \u2014 no anomalies detected.</div>';
    addClose(); return;
  }
  const worst = a.some((x) => x.sev === 'danger') ? 'danger' : a.some((x) => x.sev === 'warn') ? 'warn' : 'info';
  bar.className = 'anomaly ' + worst;
  const lines = a.slice(0, 4).map((x) =>
    '<div class="ab-line ab-' + x.sev + '"' + (x.id ? ' data-id="' + x.id + '"' : '') + '>' + escapeHtml(x.text) + '</div>').join('');
  const more = a.length > 4 ? '<div class="ab-line">+' + (a.length - 4) + ' more\u2026</div>' : '';
  bar.innerHTML = '<span class="ab-ic">\u26a0</span><div class="ab-msg"><b>' + a.length +
    ' anomal' + (a.length > 1 ? 'ies' : 'y') + ' on last scan</b>' + lines + more + '</div>';
  addClose();
  // clicking a host line opens its details
  bar.querySelectorAll('.ab-line[data-id]').forEach((ln) => {
    ln.style.cursor = 'pointer';
    ln.onclick = () => { state.selectedId = ln.getAttribute('data-id'); render(); };
  });
}

// one list card (used in the left/right panels)
function listCard(d) {
  const col = statusColor(d);
  const card = el('div', 'lcard');
  card.style.borderLeft = '3px solid ' + col;
  if (isBlocked(d)) card.style.opacity = '.55';
  const cn = connOf(d);
  const right = cn === 'wifi' ? (d.signal != null ? d.signal + '%' : '\u2014')
              : (d.status === 'offline' ? 'down' : 'speed unknown');
  card.innerHTML =
    '<div class="top">' +
      '<span class="badge" style="border-color:' + col + ';color:' + col + '" title="' + escapeHtml(typeLabel(typeOf(d))) + '">' + iconFor(typeOf(d)) + '</span>' +
      '<div style="flex:1;min-width:0;">' +
        '<div class="nm">' + escapeHtml(nameOf(d)) + '</div>' +
        '<div class="ip">' + escapeHtml(d.ip) + '</div>' +
        (aliasOf(d) ? '<div class="alias">' + escapeHtml(aliasOf(d)) + '</div>' : '') +
      '</div>' +
      '<div>' +
        '<div class="tag" style="color:' + col + '">' + statusTag(d) + '</div>' +
        '<div class="sub2">' + right + '</div>' +
      '</div>' +
    '</div>';
  card.onclick = () => { state.selectedId = d.id; render(); };
  return card;
}

function renderSidePanels(wifi, wired) {
  const wl = document.getElementById('wifi-list');
  const rl = document.getElementById('wired-list');
  wl.innerHTML = ''; rl.innerHTML = '';
  if (wifi.length) wifi.forEach((d) => wl.appendChild(listCard(d)));
  else wl.appendChild(el('div', 'empty', 'No hosts set to WiFi yet.<br>Open a host and set its<br>connection type.'));
  if (wired.length) wired.forEach((d) => rl.appendChild(listCard(d)));
  else rl.appendChild(el('div', 'empty', 'No hosts set to Wired yet.<br>Open a host and set its<br>connection type.'));
}

// the center: error / connecting overlay, or the topology
// draws the room rectangles behind the topology - purely a rendering of
// roomsLayout(), no drag/resize of the ROOMS themselves (their rect is
// always computed, see roomsLayout()). Hosts are still draggable within/
// between rooms (makeNodeDraggable) - dataset.roomId here lets that drag
// highlight whichever room div the pointer is currently over.
function renderRoomLayer(stage) {
  const rooms = state.config.rooms || {};
  const layout = roomsLayout();
  Object.keys(rooms).forEach((id) => {
    const rect = layout[id];
    if (!rect) return;
    const div = el('div', 'room');
    div.dataset.roomId = id;
    div.style.left = rect.x + '%'; div.style.top = rect.y + '%';
    div.style.width = rect.w + '%'; div.style.height = rect.h + '%';
    const side = roomGridSize(id);
    const count = state.devices.filter((device) => (state.overrides[device.id] || {}).room === id).length;
    div.appendChild(el('span', 'rlabel', escapeHtml(rooms[id].label) + ' · ' + side + '×' + side + ' (' + side * side + ') · ' + count + (count === 1 ? ' host' : ' hosts')));
    const grid = el('div', 'room-slots');
    grid.style.gridTemplateColumns = 'repeat(' + side + ', 1fr)';
    grid.style.gridTemplateRows = 'repeat(' + side + ', 1fr)';
    for (let i = 0; i < side * side; i++) grid.appendChild(el('span', 'room-slot', String(i + 1)));
    div.appendChild(grid);
    stage.appendChild(div);
  });
}

function toggleMapPanel(side, open) {
  state.mapPanelRestore = null;
  const viewport = document.querySelector('.map-viewport');
  const left = viewport ? viewport.scrollLeft : 0;
  const right = viewport ? left + viewport.clientWidth : 0;
  const top = viewport ? viewport.scrollTop : 0;
  writeBrowserSetting(side + 'Panel', open ? '0' : '1');
  render();
  if (viewport) {
    // Resizing the viewport must not hide the right-hand rooms behind the
    // newly opened Wired panel. Only pan the view; never move saved hosts.
    const target = side === 'right' ? right - viewport.clientWidth : left;
    viewport.scrollLeft = Math.max(0, Math.min(target, viewport.scrollWidth - viewport.clientWidth));
    viewport.scrollTop = top;
  }
}

function toggleMapExpansion() {
  if (state.registryOpen) return;
  const leftOpen = readBrowserSetting('leftPanel') !== '0';
  const rightOpen = readBrowserSetting('rightPanel') !== '0';
  const expanded = !leftOpen && !rightOpen;
  const restore = expanded ? (state.mapPanelRestore || { left: true, right: true }) : null;
  state.mapPanelRestore = expanded ? null : { left: leftOpen, right: rightOpen };
  const viewport = document.querySelector('.map-viewport');
  const center = viewport ? viewport.scrollLeft + viewport.clientWidth / 2 : 0;
  const top = viewport ? viewport.scrollTop : 0;
  writeBrowserSetting('leftPanel', restore && restore.left ? '1' : '0');
  writeBrowserSetting('rightPanel', restore && restore.right ? '1' : '0');
  render();
  if (viewport) {
    viewport.scrollLeft = Math.max(0, Math.min(center - viewport.clientWidth / 2,
      viewport.scrollWidth - viewport.clientWidth));
    viewport.scrollTop = top;
  }
}

function updateMapExpansionControl() {
  const button = document.getElementById('map-expandbtn');
  const expanded = readBrowserSetting('leftPanel') === '0' && readBrowserSetting('rightPanel') === '0';
  button.hidden = state.registryOpen;
  button.disabled = state.registryOpen;
  button.setAttribute('aria-pressed', String(expanded));
  button.title = expanded ? 'Restore side lists' : 'Hide side lists to expand the map';
  document.getElementById('map-expand-label').textContent = expanded ? 'Restore lists' : 'Expand map';
  button.onclick = toggleMapExpansion;
}

function renderStage(all, wifi, wired, unset) {
  const stage = document.getElementById('stage');
  stage.innerHTML = '';

  // side-panel collapse/expand tabs — live on .center (parent of stage)
  // so they are never clipped by stage overflow:hidden
  const _main   = document.querySelector('main');
  const _center = stage.closest('.center');
  const _lOpen  = readBrowserSetting('leftPanel')  !== '0';
  const _rOpen  = readBrowserSetting('rightPanel') !== '0';
  _main.classList.toggle('left-collapsed',  !_lOpen);
  _main.classList.toggle('right-collapsed', !_rOpen);
  _center.querySelectorAll('.panel-toggle').forEach((n) => n.remove());
  const _mkTab = (side, open) => {
    const b = el('button', 'panel-toggle ' + side,
      (side === 'left') === open ? '&#8249;' : '&#8250;');
    b.title = open ? 'Nascondi pannello' : 'Mostra pannello';
    b.setAttribute('aria-expanded', String(open));
    b.setAttribute('aria-controls', side === 'right' ? 'wired-panel' : 'wifi-panel');
    b.onclick = (e) => {
      e.stopPropagation();
      toggleMapPanel(side, open);
    };
    return b;
  };
  _center.appendChild(_mkTab('left',  _lOpen));
  _center.appendChild(_mkTab('right', _rOpen));

  const minimum = mapMinimumSize(all.map((d) => d.id));
  stage.style.minWidth = minimum.width + 'px';
  stage.style.minHeight = minimum.height + 'px';

  // ambient rings + radar sweep
  stage.appendChild(el('div', 'ring'));
  stage.appendChild(el('div', 'ring b'));
  if (state.scanning) stage.appendChild(el('div', 'sweep'));

  // room layout: rendered FIRST (so it always shows, even with no scan data
  // yet) and BEFORE the error/connecting early-returns below.
  renderRoomLayer(stage);

  // ---- error state: message in the center, no topology ----
  if (state.source === 'error') {
    const o = el('div', 'overlay');
    const box = el('div', 'errbox');
    box.innerHTML =
      '<div class="ic">&#9888;</div>' +
      '<h2>Scanner offline</h2>' +
      '<p>' + escapeHtml(state.errorMsg) + '</p>';
    const btn = el('button', null, '&#8635; RETRY');
    btn.onclick = () => runScan(true);
    box.appendChild(btn);
    o.appendChild(box);
    stage.appendChild(o);
    return;
  }

  // ---- connecting / no data yet ----
  if (!all.length) {
    const o = el('div', 'overlay');
    o.innerHTML = '<div class="connecting">Connecting to scanner&#8230;</div><div>reading /api/devices</div>';
    stage.appendChild(o);
    return;
  }

  // ---- topology ----
  const roomPositions = roomHostPositions(all.map((d) => d.id));
  const gatewayPos = roomPositions.gw || (state.overrides.gw || {}).pos;
  const cx = gatewayPos ? gatewayPos.xPct / 100 * STAGE_W : STAGE_CX;
  const cy = gatewayPos ? gatewayPos.yPct / 100 * STAGE_H : STAGE_CY;
  // scale the cards with the stage width so they spread out on big screens and
  // shrink (instead of overlapping) on small ones.
  const stageW = stage.clientWidth || 900;
  state._nodeScale = Math.max(0.6, Math.min(1.25, stageW / 1000));
  const RADII = [210, 300, 392];          // concentric rings (in viewBox units)
  const VSQUASH = 0.82;                   // flatten vertically -> wide, roomy spread
  const total = wifi.length + wired.length + unset.length;
  const ARC_START = -78, ARC_END = 258;   // ~336 deg usable, small gap at the top
  const usable = ARC_END - ARC_START;

  // lay a group of hosts onto one angular band, spread across as many rings as
  // needed so they never pile up on top of each other.
  function placeBand(group, a0, a1, out) {
    const n = group.length;
    if (!n) return;
    const nRings = Math.min(RADII.length, Math.max(1, Math.ceil(n / 4)));
    const pad = (a1 - a0) * 0.05;
    const lo = a0 + pad, hi = a1 - pad;
    for (let i = 0; i < n; i++) {
      const ring = i % nRings;                                   // interleave radii
      const inRing = Math.floor(n / nRings) + (ring < (n % nRings) ? 1 : 0);
      const order = Math.floor(i / nRings);                      // index within the ring
      const t = inRing === 1 ? 0.5 : order / (inRing - 1);
      let ang = lo + (hi - lo) * t;
      if (ring % 2 === 1) ang += (hi - lo) / Math.max(1, inRing) * 0.5; // stagger rings
      const rad = ang * Math.PI / 180;
      out.push({ d: group[i], x: STAGE_CX + RADII[ring] * Math.cos(rad), y: STAGE_CY + RADII[ring] * VSQUASH * Math.sin(rad) });
    }
  }

  // Room hosts retain exact manual positions; hosts the user has otherwise dragged
  // to a custom spot keep that spot on every scan; everyone else goes
  // through the automatic arc layout below.
  function pinnedPos(d) {
    if (roomPositions[d.id]) return roomPositions[d.id];
    const o = state.overrides[d.id];
    return (o && o.pos) ? o.pos : null;
  }
  function splitPinned(group) {
    const pinned = [], free = [];
    group.forEach((d) => { (pinnedPos(d) ? pinned : free).push(d); });
    return { pinned, free };
  }

  // give each group an angular band proportional to its size, arranged so that
  // wired sits on the right, unset across the bottom, wifi on the left.
  // (pinned hosts in the group skip placeBand entirely and use their saved %.)
  const placed = [];
  let cursor = ARC_START;
  [['wired', wired], ['unset', unset], ['wifi', wifi]].forEach(function (pair) {
    const span = total ? usable * (pair[1].length / total) : 0;
    const { pinned, free } = splitPinned(pair[1]);
    pinned.forEach((d) => {
      const pos = pinnedPos(d);
      placed.push({ d, x: pos.xPct / 100 * STAGE_W, y: pos.yPct / 100 * STAGE_H, scale: pos.scale });
    });
    placeBand(free, cursor, cursor + span, placed);
    cursor += span;
  });

  // connection lines (SVG) \u2014 kept in state._lineEls so drag handlers can
  // update a host's line live, without a full re-render on every mouse move.
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + STAGE_W + ' ' + STAGE_H);
  svg.setAttribute('preserveAspectRatio', 'none');
  state._lineEls = {};
  placed.forEach((p) => {
    const d = p.d, cn = connOf(d);
    const faint = d.status === 'offline' || isBlocked(d) || cn === 'unset';
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', cx); line.setAttribute('y1', cy);
    line.setAttribute('x2', p.x); line.setAttribute('y2', p.y);
    line.setAttribute('stroke', statusColor(d));
    line.setAttribute('stroke-width', cn === 'wired' ? 1.7 : 1.2);
    line.setAttribute('stroke-dasharray', cn === 'wifi' ? '4 7' : (cn === 'unset' ? '2 6' : '0'));
    line.setAttribute('opacity', faint ? 0.2 : 0.45);
    svg.appendChild(line);
    state._lineEls[d.id] = line;
  });
  stage.appendChild(svg);

  // Gateway uses its room cell, saved free position, or the default center.
  const gwD = all.find((d) => d.id === 'gw');
  if (gwD) stage.appendChild(gatewayNode(gwD, cx, cy, gatewayPos && gatewayPos.scale));

  // device nodes
  placed.forEach((p) => stage.appendChild(deviceNode(p.d, p.x, p.y, p.scale)));


}

function gatewayNode(d, x = STAGE_CX, y = STAGE_CY, roomScale) {
  const node = el('div', 'node gw' + (state.selectedId === 'gw' ? ' sel' : ''));
  node.dataset.deviceId = d.id;
  node.title = d.hostname ? 'Gateway router · Detected hostname: ' + d.hostname : 'Gateway router';
  node.style.left = (x / STAGE_W * 100) + '%';
  node.style.top = (y / STAGE_H * 100) + '%';
  node.style.transform = 'translate(-50%,-50%) scale(' + (roomScale || state._nodeScale || 1) + ')';
  const dot = '<span class="dot" style="width:9px;height:9px;background:' + statusColor(d) + '"></span>';
  node.innerHTML =
    '<div class="card">' +
      '<div class="row" style="justify-content:space-between"><span class="gwbadge">GATEWAY</span>' + dot + '</div>' +
      '<div class="nm">' + escapeHtml(nameOf(d)) + '</div>' +
      '<div class="ip">' + escapeHtml(d.ip) + '</div>' +
      (aliasOf(d) ? '<div class="alias">' + escapeHtml(aliasOf(d)) + '</div>' : '') +
      '<div class="meta"><span>GATEWAY</span><span>' + statusTag(d) + '</span></div>' +
    '</div>';
  node.querySelector('.card').onclick = () => { if (!node.__dragMoved) { state.selectedId = 'gw'; render(); } };
  makeNodeDraggable(node, d);
  return node;
}

function deviceNode(d, x, y, roomScale) {
  const col = statusColor(d), cn = connOf(d);
  const pinned = !!(state.overrides[d.id] && state.overrides[d.id].pos);
  const node = el('div', 'node' + (state.selectedId === d.id ? ' sel' : '') + (pinned ? ' pinned' : ''));
  node.dataset.deviceId = d.id;
  node.style.left = (x / STAGE_W * 100) + '%';
  node.style.top = (y / STAGE_H * 100) + '%';
  node.style.transform = 'translate(-50%,-50%) scale(' + (roomScale || state._nodeScale || 1) + ')';
  const border = isFlagged(d) ? 'var(--warn)' : isBlocked(d) ? 'var(--danger)' : 'var(--panelLine)';
  const metaLeft = cn === 'wifi' ? 'WiFi' : cn === 'wired' ? 'ETH' : 'UNSET';
  const metaRight = cn === 'wifi' ? (d.signal != null ? d.signal + '%' : '\u2014')
                  : cn === 'wired' ? (d.status === 'offline' ? 'down' : 'speed unknown') : 'set type';
  const dot = '<span class="dot" style="background:' + col + ';box-shadow:0 0 9px ' + col +
              (d.status === 'offline' ? '' : ';animation:blink 2.4s ease-in-out infinite') + '"></span>';
  node.innerHTML =
    '<div class="card" style="border-color:' + (state.selectedId === d.id ? 'var(--accent2)' : border) + (isBlocked(d) ? ';opacity:.5' : '') + '">' +
      '<div class="row">' +
        '<span class="badge" style="border-color:' + col + ';color:' + col + '" title="' + escapeHtml(typeLabel(typeOf(d))) + '">' + iconFor(typeOf(d)) + '</span>' +
        '<span class="nm">' + escapeHtml(nameOf(d)) + '</span>' + dot +
        (pinned ? '<span class="pin" title="Position pinned by you">&#128204;</span>' : '') +
      '</div>' +
      '<div class="ip">' + escapeHtml(d.ip) + '</div>' +
      (aliasOf(d) ? '<div class="alias">' + escapeHtml(aliasOf(d)) + '</div>' : '') +
      '<div class="meta"><span>' + metaLeft + '</span><span style="color:' + (cn === 'wifi' ? col : 'var(--dim)') + '">' + metaRight + '</span></div>' +
      (isFlagged(d) && !isBlocked(d) ? '<div class="suspect">&#9650; SUSPECT</div>' : '') +
    '</div>';
  const card = node.querySelector('.card');
  card.onclick = () => { if (!node.__dragMoved) { state.selectedId = d.id; render(); } };
  // right-click always opens the details drawer, regardless of any in-progress
  // drag state \u2014 a deliberate, unambiguous "edit this host" shortcut, since
  // left-click can occasionally get swallowed by the drag-threshold logic.
  node.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    state.selectedId = d.id;
    render();
  });
  makeNodeDraggable(node, d);
  return node;
}

// drag&drop for map nodes: while dragging we move the node (and its
// connecting line) directly via inline styles \u2014 NOT via render(), which
// would tear down the DOM mid-drag. The new position is only persisted
// (setOverride -> backend) on release, same "commit on end" pattern used by
// the text inputs elsewhere in the app.
//
// Dropping inside a room (any room, whether or not the host already
// belonged to one) reassigns it to that room and saves the exact drop point.
// The grid is only an initial layout. Dropping outside every room clears
// the room tag and the host goes back to free placement at the drop point.
function makeNodeDraggable(node, d) {
  let dragging = false, startX = 0, startY = 0, startPctX = 0, startPctY = 0, stageRect = null, stageEl = null;

  const DRAG_THRESHOLD = 4; // px, before a press counts as a drag instead of a click

  const clearRoomHighlight = () => {
    if (stageEl) stageEl.querySelectorAll('.room.drop-target').forEach((r) => r.classList.remove('drop-target'));
  };

  node.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return; // left mouse button / touch only
    stageEl = document.getElementById('stage');
    stageRect = stageEl.getBoundingClientRect();
    startX = e.clientX; startY = e.clientY;
    startPctX = parseFloat(node.style.left);
    startPctY = parseFloat(node.style.top);
    dragging = true;
    node.__dragMoved = false;
    try { node.setPointerCapture(e.pointerId); } catch (err) {}
  });

  node.addEventListener('pointermove', (e) => {
    if (!dragging || !stageRect) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!node.__dragMoved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    node.__dragMoved = true;
    node.classList.add('dragging');
    const pctX = Math.max(2, Math.min(98, startPctX + (dx / stageRect.width) * 100));
    const pctY = Math.max(2, Math.min(98, startPctY + (dy / stageRect.height) * 100));
    node.style.left = pctX + '%';
    node.style.top = pctY + '%';
    const line = state._lineEls && state._lineEls[d.id];
    if (line) {
      line.setAttribute('x2', pctX / 100 * STAGE_W);
      line.setAttribute('y2', pctY / 100 * STAGE_H);
    }
    if (d.id === 'gw') Object.values(state._lineEls || {}).forEach((edge) => {
      edge.setAttribute('x1', pctX / 100 * STAGE_W);
      edge.setAttribute('y1', pctY / 100 * STAGE_H);
    });
    const overRoom = roomAtPoint(pctX, pctY);
    clearRoomHighlight();
    if (overRoom) {
      stageEl.querySelectorAll('.room').forEach((div) => {
        if (div.dataset.roomId === overRoom) div.classList.add('drop-target');
      });
    }
  });

  const finish = (e) => {
    if (!dragging) return;
    dragging = false;
    node.classList.remove('dragging');
    clearRoomHighlight();
    try { node.releasePointerCapture(e.pointerId); } catch (err) {}
    if (node.__dragMoved) {
      const pctX = parseFloat(node.style.left), pctY = parseFloat(node.style.top);
      const targetRoom = roomAtPoint(pctX, pctY);
      const currentRoom = (state.overrides[d.id] || {}).room || null;
      pinMapOccupants(stageEl, d.id);
      if (currentRoom) pinRoomOccupants(currentRoom, d.id);
      if (targetRoom && targetRoom !== currentRoom) pinRoomOccupants(targetRoom, d.id);
      const pos = { xPct: pctX, yPct: pctY };
      const patch = { pos };
      if (targetRoom !== currentRoom) patch.room = targetRoom || undefined;
      setOverride(d.id, patch);   // saves + re-renders
    }
  };
  node.addEventListener('pointerup', finish);
  node.addEventListener('pointercancel', (e) => {
    node.__dragMoved = false;
    finish(e);
    render();
  });
}

// ---- drawer (device details + actions) --------------------------------------
function renderDrawer(all) {
  const root = document.getElementById('drawer-root');
  const d = all.find((x) => x.id === state.selectedId);
  if (!d) { root.innerHTML = ''; return; }

  const col = statusColor(d), cn = connOf(d);
  const scrim = el('div', 'scrim');
  scrim.onclick = () => { state.selectedId = null; render(); };

  const drawer = el('div', 'drawer');

  // header
  const head = el('div', 'dhead');
  head.innerHTML =
    '<div style="display:flex;gap:12px;align-items:center;min-width:0;">' +
      '<span class="badge" style="border-color:' + col + ';color:' + col + '" title="' + escapeHtml(typeLabel(typeOf(d))) + '">' + iconFor(typeOf(d)) + '</span>' +
      '<div style="min-width:0;"><h3>' + escapeHtml(nameOf(d)) + '</h3><div class="model">' + escapeHtml(d.model || '\u2014') + '</div></div>' +
    '</div>';
  const close = el('button', 'close', '&#215;');
  close.onclick = () => { state.selectedId = null; render(); };
  head.appendChild(close);
  drawer.appendChild(head);

  // body
  const body = el('div', 'dbody');

  const sl = el('div', 'statusline');
  sl.innerHTML = '<span class="tag" style="border-color:' + col + ';color:' + col + '">' + statusTag(d) + '</span>' +
    '<span class="lbl">' + (cn === 'gateway' ? 'GATEWAY \u00b7 ROUTER'
      : cn === 'wifi' ? 'WIRELESS \u00b7 set manually'
      : cn === 'wired' ? 'WIRED \u00b7 set manually'
      : 'UNASSIGNED \u00b7 center map only') + '</span>';
  body.appendChild(sl);

  // alias — short editable label shown under the IP everywhere on the map
  body.appendChild(el('div', 'section-lbl', 'Alias &#183; shown under IP on the map'));
  const aliasWrap = el('div', null, null);
  aliasWrap.style.marginBottom = '18px';
  const aliasInput = el('input', 'rename');
  aliasInput.style.width = '100%';
  aliasInput.style.fontSize = '12px';
  aliasInput.style.fontWeight = '400';
  aliasInput.placeholder = 'e.g. "living room TV" or "kid\'s laptop"';
  aliasInput.value = aliasOf(d);
  aliasInput.maxLength = 40;
  const commitAlias = () => {
    const v = aliasInput.value.trim();
    setOverride(d.id, { alias: v });
  };
  aliasInput.onkeydown = (e) => {
    if (e.key === 'Enter') { commitAlias(); aliasInput.blur(); }
    if (e.key === 'Escape') { aliasInput.value = aliasOf(d); aliasInput.blur(); }
  };
  aliasInput.onblur = commitAlias;
  aliasWrap.appendChild(aliasInput);
  body.appendChild(aliasWrap);

  // connection type selector (not for the gateway)
  if (d.id !== 'gw') {
    body.appendChild(el('div', 'section-lbl', 'Connection type &#183; set manually'));
    const seg = el('div', 'seg');
    const mk = (key, label, onCls) => {
      const b = el('button', cn === key ? onCls : '', label);
      b.onclick = () => setOverride(d.id, { conn: key });
      return b;
    };
    seg.appendChild(mk('wifi', ')))&nbsp;WiFi', 'on-wifi'));
    seg.appendChild(mk('wired', '&#9644;&nbsp;Wired', 'on-wired'));
    seg.appendChild(mk('unset', '?&nbsp;Unset', 'on-unset'));
    body.appendChild(seg);

    // device type \u2014 dropdown, always editable; the icon next to it (and
    // everywhere else on the map) updates the instant you pick a new value.
    // Auto-detection from nmap is best-effort only \u2014 this is the real
    // source of truth, and it's the SAME field the Registry panel edits.
    body.appendChild(el('div', 'section-lbl', 'Device type &#183; icon shown on the map'));
    const typeWrap = el('div', null, null);
    typeWrap.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:18px;';
    const typeIcon = el('span', 'typeicon', iconFor(typeOf(d)));
    typeIcon.style.color = col;
    const typeSel = el('select');
    typeSel.style.flex = '1';
    allTypeOptions().forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = typeLabel(t);
      if (typeOf(d) === t) opt.selected = true;
      typeSel.appendChild(opt);
    });
    typeSel.onchange = () => setOverride(d.id, { typeOverride: typeSel.value });
    typeWrap.appendChild(typeIcon);
    typeWrap.appendChild(typeSel);
    body.appendChild(typeWrap);
  }

  // vendor \u2014 dropdown of common home-network brands + "custom" free text
  // fallback for anything not in the list. Also saved into the SAME
  // overrides[id].vendorOverride field the Registry panel uses.
  body.appendChild(el('div', 'section-lbl', 'Vendor &#183; nmap guess is often wrong, correct it here'));
  body.appendChild(vendorFieldGroup(d));

  // room \u2014 picking one AUTO-PLACES the host inside it (same logic the
  // Registry panel's Room column uses: assignHostToRoom()).
  {
    body.appendChild(el('div', 'section-lbl', 'Room &#183; picking one moves the host there'));
    const roomWrap = el('div', null, null);
    roomWrap.style.marginBottom = '18px';
    const roomSel = el('select');
    const noneOpt = document.createElement('option');
    noneOpt.value = ''; noneOpt.textContent = '(none)';
    if (!(state.overrides[d.id] || {}).room) noneOpt.selected = true;
    roomSel.appendChild(noneOpt);
    Object.keys(state.config.rooms || {}).forEach((rid) => {
      const opt = document.createElement('option');
      opt.value = rid; opt.textContent = state.config.rooms[rid].label;
      if ((state.overrides[d.id] || {}).room === rid) opt.selected = true;
      roomSel.appendChild(opt);
    });
    roomSel.onchange = () => assignHostToRoom(d.id, roomSel.value);
    roomWrap.appendChild(roomSel);
    body.appendChild(roomWrap);
  }

  // info grid
  const signalVal = cn === 'gateway' ? 'host AP'
    : d.signal == null ? '\u2014'
    : cn === 'wifi' ? (d.signal + '%') : 'wired link';
  const grid = el('div', 'grid');
  const cell = (k, v, cy) => '<div class="cell"><div class="k">' + escapeHtml(k) + '</div><div class="v' + (cy ? ' cy' : '') + '">' + escapeHtml(v) + '</div></div>';
  grid.innerHTML =
    cell('IP address', d.ip, true) +
    cell('MAC address', d.mac) +
    cell('Status', d.status) +
    cell('Signal', signalVal);
  if (d.id === 'gw') grid.innerHTML += cell('Detected hostname', d.hostname || '\u2014');
  body.appendChild(grid);

  // open ports
  body.appendChild(el('div', 'section-lbl', 'Open ports'));
  if (d.ports && d.ports.length) {
    const pts = el('div', 'ports');
    d.ports.forEach((p) => pts.appendChild(el('span', null, String(p))));
    body.appendChild(pts);
  } else {
    body.appendChild(el('div', null, '<span style="font-size:11px;color:var(--dim)">' +
      (state.portsScanned === false ? 'Port scan was disabled' : 'No open ports detected among the ports tested') + '</span>'));
  }
  drawer.appendChild(body);

  // footer actions
  const foot = el('div', 'dfoot');
  const renameBtn = el('button', null, 'RENAME');
  renameBtn.onclick = () => startRename(d, head);
  const flagBtn = el('button', 'act-flag' + (isFlagged(d) ? ' act-on' : ''), isFlagged(d) ? 'CLEAR FLAG' : 'FLAG SUSPECT');
  flagBtn.onclick = () => setOverride(d.id, { flagged: !isFlagged(d) });
  const blockBtn = el('button', 'act-block' + (isBlocked(d) ? ' act-on' : ''), isBlocked(d) ? 'CLEAR BLOCK MARK' : 'MARK BLOCKED');
  blockBtn.title = 'Registry label only; this does not block network access on the router or firewall';
  blockBtn.onclick = () => setOverride(d.id, { blocked: !isBlocked(d) });
  foot.appendChild(renameBtn); foot.appendChild(flagBtn); foot.appendChild(blockBtn);
  if (d.id !== 'gw' && state.overrides[d.id] && state.overrides[d.id].pos) {
    const unpinBtn = el('button', null, 'UNPIN POSITION');
    unpinBtn.title = 'Forget the manually-dragged spot and let auto-layout place it again';
    unpinBtn.onclick = () => setOverride(d.id, { pos: undefined });
    foot.appendChild(unpinBtn);
  }
  drawer.appendChild(foot);

  root.innerHTML = '';
  root.appendChild(scrim);
  root.appendChild(drawer);
}

// inline rename inside the drawer header
function startRename(d, head) {
  const titleWrap = head.querySelector('div > div');
  const h3 = head.querySelector('h3');
  const input = el('input', 'rename');
  input.value = nameOf(d);
  h3.replaceWith(input);
  input.focus();
  input.select();
  const commit = () => {
    const v = input.value.trim();
    if (v) setOverride(d.id, { name: v }); else render();
  };
  input.onkeydown = (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') render();
  };
  input.onblur = commit;
}



function updateViewNavigation() {
  updateMapExpansionControl();
  [['map', 'mapbtn'], ['registry', 'regbtn']].forEach(([view, id]) => {
    const button = document.getElementById(id);
    const active = state.registryOpen === (view === 'registry');
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
    button.setAttribute('aria-pressed', String(active));
    button.onclick = () => { location.hash = view; };
  });
}

function syncRegistryRoute() {
  state.registryOpen = location.hash === '#registry';
  state.selectedId = null;
  state.settingsOpen = false;
  render();
  document.getElementById(state.registryOpen ? 'regbtn' : 'mapbtn').focus();
}

// ---- wire up controls + boot -------------------------------------------------
initializeReleaseInfo();
document.addEventListener('pointerdown', dismissThemeMenu);
window.addEventListener('hashchange', syncRegistryRoute);
document.getElementById('settingsbtn').onclick = () => { state.settingsOpen = true; render(); };

render();                              // paint initial (connecting) state
loadState().then(() => runScan(false)); // load saved assignments, then scan
if (AUTO_REFRESH_MS > 0) setInterval(() => { if (!state.scanning) runScan(true); }, AUTO_REFRESH_MS);
