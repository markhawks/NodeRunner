// NodeRunner - registry.js
// =============================
// The Host Registry panel: a table of every host ever seen, editable
// in-place (alias, hostname, vendor, connection, type, room, trusted flag). Reads/writes
// state.overrides[id] - the SAME object the device drawer (app.js) edits, so
// the two stay in sync automatically. Depends on helpers from app.js
// (state, el, setOverride, escapeHtml, statusColor...) and icons.js
// (typeLabel, iconFor, allTypeOptions) - fine since none of that is touched
// until the user actually opens the panel, by which point every module has
// finished loading.

// ---- Host Registry panel (whitelist / historical reference) -----------------
// (device-type catalogue lives earlier, near BUILTIN_TYPE_LABELS/iconFor)

// curated list of common home-network brands for the vendor dropdown; the
// scanner can't know about anything not in this list, so there is always a
// "custom" fallback that reveals a free-text input. Custom vendors added via
// Settings (state.config.customVendors) are appended by allVendorOptions().
const BUILTIN_VENDOR_OPTIONS = [
  'Apple', 'Samsung Electronics', 'Google', 'Xiaomi', 'Huawei', 'OnePlus',
  'TP-Link', 'Netgear', 'ASUS', 'D-Link', 'Ubiquiti', 'MikroTik', 'Zyxel', 'AVM (Fritz!Box)',
  'Synology', 'QNAP', 'Western Digital',
  'Sony', 'Nintendo', 'Microsoft',
  'LG Electronics', 'Samsung TV', 'Hisense', 'TCL', 'Vizio', 'Roku', 'Amazon',
  'Hikvision', 'Dahua', 'Reolink', 'Axis Communications', 'Wyze',
  'Philips / Signify', 'Shelly', 'Sonoff', 'Tuya', 'Espressif', 'Amazon (Echo/Alexa)', 'Google Nest', 'Tapo',
  'Raspberry Pi Foundation', 'RaspberryPi',
  'Dell', 'HP', 'Lenovo', 'Intel', 'Gigabyte', 'MSI', 'ASUS PC',
  'Brother', 'Canon', 'Epson', 'Xerox',
  'Daikin', 'Mitsubishi Electric', 'Midea', 'Gree', 'Haier',
  'Ariston', 'Vaillant', 'Nibe', 'Stiebel Eltron', 'Viessmann',
  'SolarEdge', 'Fronius', 'SMA Solar', 'Growatt', 'GoodWe', 'Sungrow', 'Enphase',
];
function allVendorOptions() {
  return BUILTIN_VENDOR_OPTIONS.concat((state.config.customVendors || []).filter((v) => BUILTIN_VENDOR_OPTIONS.indexOf(v) < 0));
}

// Shared vendor control for the device drawer and registry: a dropdown of
// known brands, falling back to a free-text input for anything else. Writes
// into the SAME overrides[id].vendorOverride field the Registry panel reads.
function vendorFieldGroup(d, compact = false) {
  const o = state.overrides[d.id] || {};
  const current = o.vendorOverride || '';
  const auto = o.vendorAuto || d.vendor || '';
  const matched = current && allVendorOptions().indexOf(current) >= 0;

  const wrap = el('div', compact ? 'reg-vendor-field' : null, null);
  wrap.style.marginBottom = compact ? '0' : '18px';

  const sel = el('select');
  sel.setAttribute('aria-label', 'Vendor for ' + d.id);
  sel.style.width = '100%';
  const blankOpt = document.createElement('option');
  blankOpt.value = '';
  blankOpt.textContent = auto ? ('(auto-detected) ' + auto) : '(not detected by the scan)';
  if (!current) blankOpt.selected = true;
  sel.appendChild(blankOpt);
  allVendorOptions().forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v;
    if (current === v) opt.selected = true;
    sel.appendChild(opt);
  });
  const customOpt = document.createElement('option');
  customOpt.value = '__custom__';
  customOpt.textContent = 'Other (type it in)\u2026';
  if (current && !matched) customOpt.selected = true;
  sel.appendChild(customOpt);

  const customInput = el('input', 'rename');
  customInput.type = 'text';
  customInput.setAttribute('aria-label', 'Custom vendor for ' + d.id);
  customInput.style.cssText = 'width:100%;margin-top:8px;font-size:' + (compact ? '14' : '12') + 'px;font-weight:400;';
  customInput.placeholder = 'custom vendor name';
  customInput.style.display = (current && !matched) ? 'block' : 'none';
  if (current && !matched) customInput.value = current;

  sel.onchange = () => {
    if (sel.value === '__custom__') {
      customInput.style.display = 'block';
      customInput.focus();
      return;   // wait for the user to actually type something
    }
    customInput.style.display = 'none';
    setOverride(d.id, { vendorOverride: sel.value });   // '' clears the override
  };
  const commitCustom = () => {
    const v = customInput.value.trim();
    if (v) setOverride(d.id, { vendorOverride: v });
  };
  customInput.onkeydown = (e) => { if (e.key === 'Enter') { commitCustom(); customInput.blur(); } };
  customInput.onblur = commitCustom;

  wrap.appendChild(sel);
  wrap.appendChild(customInput);
  return wrap;
}

function timeAgo(ts) {
  if (!ts) return '\u2014';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  const m = Math.floor(diff / 60000);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

// builds a <td><input></td> editable cell that commits on blur/Enter into
// overrides[id][field], used by the registry table for alias/name/vendor.
function regTextCell(id, field, value, placeholder) {
  const td = el('td');
  const inp = el('input');
  inp.type = 'text'; inp.value = value; inp.placeholder = placeholder || '';
  inp.setAttribute('aria-label', field + ' for ' + id);
  const commit = () => { const patch = {}; patch[field] = inp.value.trim(); setOverride(id, patch); };
  inp.onkeydown = (e) => {
    if (e.key === 'Enter') { commit(); inp.blur(); }
    if (e.key === 'Escape') { inp.value = value; inp.blur(); }
  };
  inp.onblur = commit;
  td.appendChild(inp);
  return td;
}

function registryScanIds() {
  if (state.source !== 'live') return null;
  return new Set(state.devices.filter((d) => d.status === 'online').map((d) => d.id));
}

function registryStatus(id, scanIds = registryScanIds()) {
  if (scanIds === null) return { key: 'unknown', label: 'Not verified' };
  if (id === 'gw' && state.devices.some((d) => d.id === 'gw' && d.status !== 'online')) {
    return { key: 'unknown', label: 'Not verified' };
  }
  return scanIds.has(id) ? { key: 'seen', label: 'Seen in scan' } : { key: 'absent', label: 'Not in scan' };
}

function registryMac(id) {
  const mac = id === 'gw' ? (state.overrides.gw || {}).lastMac : id.startsWith('ip-') ? '' : id;
  return mac && mac !== '\u2014' ? mac : '';
}

const REGISTRY_COLUMNS = [
  ['trusted', 'Trust'], ['status', 'Scan status'], ['conn', 'Connection'], ['alias', 'Alias'],
  ['name', 'Hostname'], ['ip', 'IP address'], ['mac', 'MAC address'], ['vendor', 'Vendor'],
  ['type', 'Type'], ['room', 'Room'], ['ports', 'Ports'], ['lastSeen', 'Last seen'],
  [null, 'Actions'],
];
const REGISTRY_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function registrySortValue(id, key, scanIds) {
  const o = state.overrides[id] || {};
  switch (key) {
    case 'trusted': return o.trusted ? 1 : 0;
    case 'status': return registryStatus(id, scanIds).label;
    case 'conn': return id === 'gw' ? 'Gateway' : o.conn === 'wifi' ? 'Wi-Fi' : o.conn === 'wired' ? 'Wired' : 'Unassigned';
    case 'alias': return o.alias || '';
    case 'name': return o.name || (id === 'gw' ? 'Gateway Router' : o.lastHostname) || '';
    case 'ip': {
      const ip = o.lastIp || (id.startsWith('ip-') ? id.slice(3) : '');
      return ip ? ipKey(ip) : null;
    }
    case 'mac': return registryMac(id);
    case 'vendor': return o.vendorOverride || o.vendorAuto || '';
    case 'type': return typeLabel(id === 'gw' ? 'router' : o.typeOverride || o.typeAuto || 'unknown');
    case 'room': return ((state.config.rooms || {})[o.room] || {}).label || '';
    case 'ports': return (o.lastPorts || []).join(', ');
    case 'lastSeen': return o.lastSeen || null;
    default: return null;
  }
}

function sortRegistryBy(key) {
  if (!REGISTRY_COLUMNS.some(([column]) => column !== null && column === key)) return;
  state.registrySortDirection = (state.registrySort || 'ip') === key && state.registrySortDirection !== 'desc' ? 'desc' : 'asc';
  state.registrySort = key;
  renderRegistry();
  const button = document.getElementById('registry-root').querySelector('[data-registry-sort="' + key + '"]');
  if (button) button.focus({ preventScroll: true });
}

function buildRegistryHeader() {
  const head = el('thead');
  const row = el('tr');
  REGISTRY_COLUMNS.forEach(([key, label]) => {
    const th = el('th', key ? 'reg-sortable' : '');
    th.setAttribute('scope', 'col');
    if (key) {
      const active = (state.registrySort || 'ip') === key;
      const descending = state.registrySortDirection === 'desc';
      th.setAttribute('aria-sort', active ? descending ? 'descending' : 'ascending' : 'none');
      const button = el('button', 'reg-sort');
      button.type = 'button';
      button.setAttribute('data-registry-sort', key);
      button.title = 'Sort by ' + label + ' ' + (active && !descending ? 'descending' : 'ascending');
      const caption = el('span'); caption.textContent = label;
      const indicator = el('span', 'reg-sort-indicator');
      indicator.textContent = active ? descending ? '↓' : '↑' : '↕';
      indicator.setAttribute('aria-hidden', 'true');
      button.appendChild(caption); button.appendChild(indicator);
      button.onclick = () => sortRegistryBy(key);
      th.appendChild(button);
    } else { th.textContent = label; }
    row.appendChild(th);
  });
  head.appendChild(row);
  return head;
}

function registryRowIds(applyFilters = true) {
  // Prefer the gateway role, then a MAC-keyed entry, over an IP-only duplicate.
  const ipToBestKey = Object.create(null);
  const orphans = [];
  Object.keys(state.known).forEach((id) => {
    const o = state.overrides[id] || {};
    const ip = o.lastIp || (id.startsWith('ip-') ? id.slice(3) : null);
    if (!ip) { orphans.push(id); return; }
    const cur = ipToBestKey[ip];
    if (!cur || id === 'gw' || (cur !== 'gw' && cur.startsWith('ip-') && !id.startsWith('ip-'))) {
      ipToBestKey[ip] = id;
    }
  });
  const unique = Object.values(ipToBestKey).concat(orphans);

  // Sort effective displayed values; keep empty cells last in either direction.
  const sort = state.registrySort || 'ip';
  const direction = state.registrySortDirection === 'desc' ? -1 : 1;
  const scanIds = registryScanIds();
  unique.sort((a, b) => {
    const va = registrySortValue(a, sort, scanIds), vb = registrySortValue(b, sort, scanIds);
    const emptyA = va == null || va === '', emptyB = vb == null || vb === '';
    if (emptyA !== emptyB) return emptyA ? 1 : -1;
    const result = emptyA ? 0 : typeof va === 'number' && typeof vb === 'number'
      ? va - vb : REGISTRY_COLLATOR.compare(String(va), String(vb));
    if (result) return result * direction;
    const oa = state.overrides[a] || {}, ob = state.overrides[b] || {};
    return ipKey(oa.lastIp) - ipKey(ob.lastIp) || REGISTRY_COLLATOR.compare(a, b);
  });

  const filter = (state.registryFilter || '').toLowerCase().trim();
  const scope = state.registryScope || 'all';
  return unique.filter((id) => {
    if (!applyFilters) return true;
    const o = state.overrides[id] || {};
    if (scope === 'trusted' && !o.trusted) return false;
    if (scope === 'seen' && registryStatus(id, scanIds).key !== 'seen') return false;
    if (scope === 'absent' && registryStatus(id, scanIds).key !== 'absent') return false;
    if (!filter) return true;
    const room = (state.config.rooms || {})[o.room];
    const hay = [id, id === 'gw' ? 'Gateway Router' : '', registryMac(id), o.alias, o.name, o.lastHostname, o.lastIp, o.vendorOverride, o.vendorAuto,
      o.typeOverride, o.typeAuto, room && room.label]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.indexOf(filter) >= 0;
  });
}

function uniqueHostCount() {
  const seen = new Set();
  Object.keys(state.known).forEach((id) => {
    const ip = (state.overrides[id] || {}).lastIp || (id.startsWith('ip-') ? id.slice(3) : id);
    seen.add(ip);
  });
  return seen.size;
}

function purgeIpDuplicates() {
  // removes ip-xxx keys for which a MAC key with the same lastIp already exists
  const macByIp = {};
  Object.keys(state.known).forEach((id) => {
    if (id.startsWith('ip-') || id === 'gw') return;
    const ip = (state.overrides[id] || {}).lastIp;
    if (ip) macByIp[ip] = id;
  });
  let removed = 0;
  Object.keys(state.known).forEach((id) => {
    if (!id.startsWith('ip-')) return;
    const ip = id.slice(3);
    if (macByIp[ip]) {
      delete state.known[id];
      delete state.overrides[id];
      removed++;
    }
  });
  return removed;
}

function buildRegistryBody() {
  const scanIds = registryScanIds();
  const ids = registryRowIds();
  const body = el('div', 'rbody');
  if (!ids.length) {
    const empty = Object.keys(state.known).length ? 'No host matches that filter.' : 'No hosts scanned yet \u2014 run a scan first.';
    body.appendChild(el('div', 'regempty', empty));
    return body;
  }
  const grouped = state.registrySort === 'room' || state.registrySort === 'conn';
  registryGroups(ids).forEach((group, index) => {
    if (!grouped) {
      body.appendChild(buildRegistryTable(group.ids, scanIds));
      return;
    }
    const section = el('section', 'reg-group');
    const heading = el('div', 'reg-group-head');
    const title = el('h3');
    title.id = 'registry-group-' + index;
    title.textContent = group.label;
    title.title = group.label;
    section.setAttribute('aria-labelledby', title.id);
    heading.appendChild(title);
    const count = el('span', 'reg-group-count');
    count.textContent = group.ids.length + (group.ids.length === 1 ? ' device' : ' devices');
    heading.appendChild(count);
    section.appendChild(heading);
    section.appendChild(buildRegistryTable(group.ids, scanIds, group.label));
    body.appendChild(section);
  });
  return body;
}

function registryGroups(ids) {
  const key = state.registrySort;
  if (key !== 'room' && key !== 'conn') return [{ key: 'all', label: '', ids }];
  const groups = new Map();
  ids.forEach((id) => {
    const o = state.overrides[id] || {};
    const room = (state.config.rooms || {})[o.room];
    const groupKey = key === 'room' ? (room ? 'room:' + o.room : 'unassigned')
      : id === 'gw' ? 'gateway' : o.conn === 'wifi' ? 'wifi' : o.conn === 'wired' ? 'wired' : 'unassigned';
    const label = key === 'room' ? (room ? 'Room · ' + room.label : 'Unassigned room')
      : id === 'gw' ? 'Gateway' : o.conn === 'wifi' ? 'Wi-Fi' : o.conn === 'wired' ? 'Wired' : 'Unassigned connection';
    if (!groups.has(groupKey)) groups.set(groupKey, { key: groupKey, label, ids: [] });
    groups.get(groupKey).ids.push(id);
  });
  return Array.from(groups.values());
}

function buildRegistryTable(ids, scanIds, label = '') {
  const table = el('table', 'regtable');
  table.setAttribute('aria-label', label || 'Known devices and last scan results');
  // Fixed column widths keep separate tables aligned while they share scrolling.
  if (label) {
    const columns = el('colgroup');
    [70, 155, 150, 175, 220, 155, 185, 210, 210, 180, 160, 150, 85].forEach((width) => {
      const col = el('col'); col.style.width = width + 'px'; columns.appendChild(col);
    });
    table.appendChild(columns);
  }
  table.appendChild(buildRegistryHeader());
  const tbody = el('tbody');
  ids.forEach((id) => {
    const o = state.overrides[id] || {};
    const trusted = !!o.trusted;
    const status = registryStatus(id, scanIds);
    const tr = el('tr', [trusted ? 'is-trusted' : '', status.key === 'absent' ? 'is-absent' : ''].filter(Boolean).join(' '));

    const tdTrust = el('td');
    const cb = el('input'); cb.type = 'checkbox'; cb.className = 'trustbox'; cb.checked = trusted;
    cb.title = 'Mark as trusted / whitelisted \u2014 silences flicker & downgrades IP-change alerts';
    cb.setAttribute('aria-label', 'Mark ' + (o.alias || o.name || o.lastIp || id) + ' as trusted');
    cb.onchange = () => setOverride(id, { trusted: cb.checked });
    tdTrust.appendChild(cb);
    tr.appendChild(tdTrust);

    const tdStatus = el('td');
    const badge = el('span', 'reg-status ' + status.key);
    badge.textContent = status.label;
    tdStatus.appendChild(badge);
    if (id === 'gw') tdStatus.appendChild(el('span', 'reg-gateway', 'Gateway'));
    tr.appendChild(tdStatus);

    const tdConnection = el('td');
    const connection = el('select', 'reg-connection');
    connection.setAttribute('aria-label', 'Connection type for ' + id);
    connection.title = 'Connection type is assigned manually, as on the map';
    (id === 'gw' ? [['gateway', 'Gateway']] : [['unset', 'Unassigned'], ['wifi', 'Wi-Fi'], ['wired', 'Wired']]).forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value; option.textContent = label;
      option.selected = id === 'gw' || (o.conn || 'unset') === value;
      connection.appendChild(option);
    });
    connection.disabled = id === 'gw';
    if (id === 'gw') connection.title = 'Gateway is the router role; Wi-Fi/Wired is assigned to other hosts';
    connection.onchange = () => setOverride(id, { conn: connection.value });
    tdConnection.appendChild(connection);
    tr.appendChild(tdConnection);

    tr.appendChild(regTextCell(id, 'alias', o.alias || '', 'alias\u2026'));
    tr.appendChild(regTextCell(id, 'name', o.name || '', id === 'gw' ? 'Gateway Router' : o.lastHostname || '(auto)'));
    if (id === 'gw' && o.lastHostname) {
      const detected = el('span', 'reg-hostname');
      detected.textContent = 'Detected: ' + o.lastHostname;
      tr.children[tr.children.length - 1].appendChild(detected);
    }

    const tdIp = el('td', null, '<span class="reg-ip">' + escapeHtml(o.lastIp || '\u2014') + '</span>');
    tr.appendChild(tdIp);
    const tdMac = el('td', null, '<span class="reg-mac">' + escapeHtml(registryMac(id) || '\u2014') + '</span>');
    tr.appendChild(tdMac);

    const tdVendor = el('td');
    tdVendor.appendChild(vendorFieldGroup({ id, vendor: o.vendorAuto || '' }, true));
    tr.appendChild(tdVendor);

    const tdType = el('td');
    const typeField = el('div', 'reg-type-field');
    const selectedType = id === 'gw' ? 'router' : o.typeOverride || o.typeAuto || 'unknown';
    const iconPrev = el('span', 'regtype-icon', iconFor(selectedType));
    typeField.appendChild(iconPrev);
    const sel = el('select');
    sel.setAttribute('aria-label', 'Device type for ' + id);
    allTypeOptions().forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = typeLabel(t);
      if (selectedType === t) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.disabled = id === 'gw';
    sel.onchange = () => setOverride(id, { typeOverride: sel.value });
    typeField.appendChild(sel);
    tdType.appendChild(typeField);
    tr.appendChild(tdType);

    const tdRoom = el('td');
    const roomSel = el('select');
    roomSel.setAttribute('aria-label', 'Room for ' + id);
    const noneOpt = document.createElement('option');
    noneOpt.value = ''; noneOpt.textContent = '(none)';
    if (!o.room) noneOpt.selected = true;
    roomSel.appendChild(noneOpt);
    Object.keys(state.config.rooms || {}).forEach((rid) => {
      const opt = document.createElement('option');
      opt.value = rid; opt.textContent = state.config.rooms[rid].label;
      if (o.room === rid) opt.selected = true;
      roomSel.appendChild(opt);
    });
    roomSel.onchange = () => assignHostToRoom(id, roomSel.value);
    tdRoom.appendChild(roomSel);
    tr.appendChild(tdRoom);

    const portsTxt = (o.lastPorts && o.lastPorts.length) ? o.lastPorts.join(', ') : '\u2014';
    const tdPorts = el('td', null, '<span class="reg-ports" title="' + escapeHtml(portsTxt) + '">' + escapeHtml(portsTxt) + '</span>');
    tr.appendChild(tdPorts);

    const tdSeen = el('td', null, '<span class="reg-seen">' + timeAgo(o.lastSeen) + '</span>');
    tr.appendChild(tdSeen);

    const tdDel = el('td');
    const delBtn = el('button', 'reg-del', '&#215;');
    delBtn.title = 'Remove this entry from the registry';
    delBtn.setAttribute('aria-label', 'Remove ' + (o.alias || o.name || o.lastIp || id) + ' from the registry');
    delBtn.onclick = () => {
      const label = o.alias || o.name || o.lastIp || id;
      if (!confirm('Remove "' + label + '" from the registry?\nCustomizations will be lost.')) return;
      delete state.known[id];
      delete state.overrides[id];
      // also remove the twin MAC key with the same lastIp, if any
      if (!id.startsWith('ip-')) {
        const ipKey = 'ip-' + (o.lastIp || '');
        if (ipKey !== 'ip-') { delete state.known[ipKey]; delete state.overrides[ipKey]; }
      }
      saveState();
      renderRegistry();
    };
    tdDel.appendChild(delBtn);
    tr.appendChild(tdDel);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

// ---- export / import --------------------------------------------------------
// Fields the user sets manually — these are what import restores.
// Auto-detected fields (lastIp, lastMac, lastPorts, lastSeen, vendorAuto,
// typeAuto) are intentionally excluded: the current scan knows better.
const MANUAL_FIELDS = ['alias', 'name', 'typeOverride', 'vendorOverride', 'room', 'trusted', 'pos', 'conn', 'flagged', 'blocked'];

function exportAssignments() {
  const data = {
    overrides: state.overrides,
    known: state.known,
    baseline: state.baseline,
    config: state.config,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'noderunner-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function registryExportRows() {
  const scanIds = registryScanIds();
  return registryGroups(registryRowIds()).flatMap((group) => group.ids).map((id) => {
    const o = state.overrides[id] || {};
    const room = (state.config.rooms || {})[o.room];
    const lastSeen = o.lastSeen ? new Date(o.lastSeen) : null;
    return [
      o.trusted ? 'Yes' : 'No', registryStatus(id, scanIds).label, o.alias || '',
      o.name || o.lastHostname || '', o.lastIp || (id.startsWith('ip-') ? id.slice(3) : ''),
      registryMac(id), o.vendorOverride || o.vendorAuto || '',
      typeLabel(id === 'gw' ? 'router' : o.typeOverride || o.typeAuto || 'unknown'), room ? room.label : '',
      id === 'gw' ? 'Gateway' : o.conn === 'wifi' ? 'Wi-Fi' : o.conn === 'wired' ? 'Wired' : 'Unassigned',
      (o.lastPorts || []).join(', '), lastSeen && Number.isFinite(lastSeen.getTime()) ? lastSeen.toISOString() : '',
      o.flagged ? 'Yes' : 'No', o.blocked ? 'Yes' : 'No',
    ].map(String);
  });
}

async function exportRegistryExcel(button) {
  if (button.disabled) return;
  button.disabled = true;
  button.textContent = 'Exporting…';
  try {
    const response = await fetch(API_BASE + '/api/export.xlsx', {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ rows: registryExportRows() }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(response.status === 404 ? 'Restart the updated Python backend to enable Excel export.'
        : error.error || 'Check the connection and backend token.');
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = 'noderunner-registry-' + new Date().toISOString().slice(0, 10) + '.xlsx';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    alert('Excel export failed: ' + error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Export Excel (.xlsx)';
  }
}

function importAssignments(file) {
  if (file.size > NR_MAX_BODY_BYTES) { alert('Backup is too large (maximum 2 MiB).'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    let data;
    try {
      data = JSON.parse(e.target.result);
      if (!data || data.overrides === undefined) throw new Error('Missing overrides');
      data = validateAssignments(data);
    } catch (_) { alert('Invalid backup: check its structure and field types.'); return; }
    const impOverrides = data.overrides || {};
    const impKnown    = data.known    || {};
    const impConfig   = data.config   || {};
    const allIds  = Object.keys(impOverrides);
    const newCnt  = allIds.filter((id) => !state.known[id]).length;
    const updCnt  = allIds.length - newCnt;
    const msg = [
      'Import backup: ' + allIds.length + ' total host(s)',
      '  • ' + newCnt + ' new (added to the registry)',
      '  • ' + updCnt + ' existing (customizations restored)',
      '',
      'Auto-detected data (IP, MAC, ports, last seen) stays as currently scanned.',
      'Continue?',
    ].join('\n');
    if (!confirm(msg)) return;

    // Merge overrides: restore manual fields from backup, keep auto-detected current
    allIds.forEach((id) => {
      const imp    = impOverrides[id];
      const merged = Object.assign({}, state.overrides[id] || {});
      MANUAL_FIELDS.forEach((f) => {
        // import the field if the backup has a meaningful value for it
        // (false is meaningful for 'trusted'; null/undefined/'' are skipped)
        if (imp[f] !== undefined && imp[f] !== null && imp[f] !== '') merged[f] = imp[f];
      });
      state.overrides[id] = merged;
    });

    // Merge known: add hosts from backup not currently in the registry
    Object.keys(impKnown).forEach((id) => {
      if (!state.known[id]) state.known[id] = impKnown[id];
    });

    // Merge config: add custom items not already present (never overwrite)
    if (impConfig.customTypes && typeof impConfig.customTypes === 'object') {
      if (!state.config.customTypes) state.config.customTypes = {};
      Object.keys(impConfig.customTypes).forEach((k) => {
        if (!state.config.customTypes[k]) state.config.customTypes[k] = impConfig.customTypes[k];
      });
    }
    if (Array.isArray(impConfig.customVendors)) {
      if (!state.config.customVendors) state.config.customVendors = [];
      impConfig.customVendors.forEach((v) => {
        if (state.config.customVendors.indexOf(v) < 0) state.config.customVendors.push(v);
      });
    }
    if (impConfig.rooms && typeof impConfig.rooms === 'object') {
      if (!state.config.rooms) state.config.rooms = {};
      Object.keys(impConfig.rooms).forEach((k) => {
        if (!state.config.rooms[k]) state.config.rooms[k] = impConfig.rooms[k];
      });
    }

    saveState();
    render();
    alert('Import complete:\n  • ' + newCnt + ' new host(s)\n  • ' + updCnt + ' customization(s) updated');
  };
  reader.onerror = () => alert('Could not read the backup file.');
  reader.readAsText(file);
}

function registrySubtitle() {
  const total = registryRowIds(false).length;
  const visible = registryRowIds().length;
  const scan = state.source === 'live' && state.lastScan
    ? 'Last scan: ' + state.lastScan : 'Scan results unavailable';
  return visible + ' of ' + total + ' devices shown · ' + scan;
}

function buildRegistrySummary() {
  const ids = registryRowIds(false);
  const scanIds = registryScanIds();
  const seen = scanIds === null ? '—' : ids.filter((id) => scanIds.has(id)).length;
  const trusted = ids.filter((id) => isTrusted(id)).length;
  const summary = el('div', 'rsummary');
  [['Known devices', ids.length], ['Seen in last scan', seen], ['Trusted devices', trusted]].forEach(([label, count]) => {
    const metric = el('div', 'rmetric');
    const value = el('strong'); value.textContent = String(count);
    const caption = el('span'); caption.textContent = label;
    metric.appendChild(value); metric.appendChild(caption);
    summary.appendChild(metric);
  });
  return summary;
}

function renderRegistry() {
  const root = document.getElementById('registry-root');
  updateViewNavigation();
  document.body.classList.toggle('registry-view', state.registryOpen);
  document.title = state.registryOpen ? 'Host registry · NodeRunner' : 'NodeRunner';
  if (!state.registryOpen) { root.innerHTML = ''; return; }

  // Preserve the search cursor and table position while filtering.
  const existing = root.querySelector('.registry-panel');
  const previousBody = existing && existing.querySelector('.rbody');
  const scrollLeft = previousBody ? previousBody.scrollLeft : 0;
  const scrollTop = previousBody ? previousBody.scrollTop : 0;
  if (existing && document.activeElement && existing.contains(document.activeElement) && document.activeElement.classList.contains('rsearch')) {
    const oldBody = existing.querySelector('.rbody');
    if (oldBody) {
      const nextBody = buildRegistryBody();
      const left = oldBody.scrollLeft, top = oldBody.scrollTop;
      oldBody.replaceWith(nextBody);
      nextBody.scrollLeft = left; nextBody.scrollTop = top;
    }
    const sub = existing.querySelector('.rsub');
    if (sub) sub.textContent = registrySubtitle();
    const summary = existing.querySelector('.rsummary');
    if (summary) summary.replaceWith(buildRegistrySummary());
    return;
  }

  const panel = el('section', 'regpanel registry-panel');
  panel.setAttribute('aria-labelledby', 'registry-title');
  panel.onkeydown = (event) => {
    if (event.key === 'Escape') {
      location.hash = 'map';
    }
  };

  const head = el('div', 'rhead');
  const heading = el('div', 'rheading');
  const h2 = el('h2'); h2.id = 'registry-title'; h2.textContent = 'Host registry';
  heading.appendChild(h2);
  const sub = el('div', 'rsub'); sub.textContent = registrySubtitle();
  heading.appendChild(sub);
  head.appendChild(heading);
  panel.appendChild(head);
  panel.appendChild(buildRegistrySummary());

  const toolbar = el('div', 'rtoolbar');
  const search = el('input', 'rsearch');
  search.type = 'search';
  search.placeholder = 'Search name, alias, IP, MAC, vendor or room…';
  search.setAttribute('aria-label', 'Search devices in registry');
  search.value = state.registryFilter;
  search.oninput = () => { state.registryFilter = search.value; renderRegistry(); };
  toolbar.appendChild(search);

  const filter = el('label', 'rfilter');
  const filterText = el('span'); filterText.textContent = 'Show';
  filter.appendChild(filterText);
  const scope = el('select');
  [['all', 'All devices'], ['seen', 'Seen in last scan'], ['absent', 'Not in last scan'], ['trusted', 'Trusted']].forEach(([key, label]) => {
    const option = document.createElement('option');
    option.value = key; option.textContent = label;
    option.selected = (state.registryScope || 'all') === key;
    scope.appendChild(option);
  });
  scope.onchange = () => { state.registryScope = scope.value; renderRegistry(); };
  filter.appendChild(scope);
  toolbar.appendChild(filter);

  panel.appendChild(toolbar);
  panel.appendChild(buildRegistryBody());

  const footer = el('div', 'rfoot');
  const tools = el('div', 'rtools');
  const hint = el('span');
  hint.textContent = 'Click a column heading to sort; click again to reverse. Edit fields directly. Status refers to the last successful scan.';
  footer.appendChild(hint);

  const excelBtn = el('button', 'rsortbtn export-btn', 'Export Excel (.xlsx)');
  excelBtn.title = 'Export the displayed devices, with the current filters and order';
  excelBtn.onclick = () => exportRegistryExcel(excelBtn);
  tools.appendChild(excelBtn);

  const exportBtn = el('button', 'rsortbtn export-btn', 'Export JSON');
  exportBtn.title = 'Download the full backup (customizations + registry)';
  exportBtn.onclick = exportAssignments;
  tools.appendChild(exportBtn);
  const importInput = document.createElement('input');
  importInput.type = 'file'; importInput.accept = '.json,application/json'; importInput.style.display = 'none';
  importInput.onchange = () => {
    if (importInput.files && importInput.files[0]) importAssignments(importInput.files[0]);
    importInput.value = '';
  };
  tools.appendChild(importInput);
  const importBtn = el('button', 'rsortbtn import-btn', 'Import JSON');
  importBtn.title = 'Restore customizations from a JSON backup';
  importBtn.onclick = () => importInput.click();
  tools.appendChild(importBtn);
  const cleanBtn = el('button', 'rsortbtn', 'Clean duplicates');
  cleanBtn.title = 'Remove IP-only entries with a matching MAC entry';
  cleanBtn.onclick = () => {
    const n = purgeIpDuplicates();
    if (n === 0) { alert('No duplicates found.'); return; }
    saveState(); renderRegistry();
  };
  tools.appendChild(cleanBtn);
  footer.appendChild(tools);
  panel.appendChild(footer);

  root.innerHTML = '';
  root.appendChild(panel);
  const body = panel.querySelector('.rbody');
  if (body) { body.scrollLeft = scrollLeft; body.scrollTop = scrollTop; }
  search.focus({ preventScroll: true });
}
