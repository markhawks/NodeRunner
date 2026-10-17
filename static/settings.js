// NodeRunner - settings.js
// =============================
// The Settings panel: lets anyone running the app (no code editing) add
// custom device types with their own icon, custom vendors, and manage rooms
// for the topology map. This is what keeps the project usable as an
// open-source tool where contributors/users shouldn't have to touch JS just
// to support a new gadget or room layout.

// ---- Settings panel (custom device types + custom vendors) ------------------
// Anyone running the app (no code editing required) can add a device type
// that doesn't exist yet: pick a label + an icon from the built-in palette
// (or paste their own SVG path markup for full control), and it becomes
// usable everywhere a type can be set (drawer, Registry) immediately. This
// is what keeps the project usable as an open-source tool where contributors
// shouldn't have to touch JS just to support a new gadget.
function slugify(label) {
  return (label || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'custom';
}

function buildAddTypeForm() {
  const form = el('div', 'setform');
  let chosenIcon = ICON_PALETTE.generic;

  const labelField = el('div', 'field');
  labelField.innerHTML = '<label>Label</label>';
  const labelInput = el('input'); labelInput.type = 'text'; labelInput.placeholder = 'e.g. "Irrigation valve"';
  labelField.appendChild(labelInput);

  const prevField = el('div', 'field');
  prevField.innerHTML = '<label>Icon</label>';
  const prev = el('span', 'seticonprev', iconSvg(chosenIcon));
  prevField.appendChild(prev);

  const pickField = el('div', 'field');
  pickField.innerHTML = '<label>Pick from palette</label>';
  const pick = el('div', 'iconpick');
  Object.keys(ICON_PALETTE).forEach((key) => {
    const b = el('button', key === 'generic' ? 'on' : '', iconSvg(ICON_PALETTE[key]));
    b.type = 'button';
    b.title = key;
    b.onclick = () => {
      chosenIcon = ICON_PALETTE[key];
      prev.innerHTML = iconSvg(chosenIcon);
      advInput.value = '';
      pick.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    };
    pick.appendChild(b);
  });
  pickField.appendChild(pick);

  const advField = el('div', 'field');
  advField.style.flex = '1 1 220px';
  advField.innerHTML = '<label>Or paste custom SVG path data (advanced)</label>';
  const advInput = el('textarea');
  advInput.placeholder = '<path d="..."/> \u2014 raw inner SVG markup, viewBox is 0 0 24 24, use stroke="currentColor"';
  advInput.oninput = () => {
    if (advInput.value.trim()) {
      // sanitize here too (not just at save time) so the live preview never
      // executes whatever was just pasted - see sanitizeIconSvg() in icons.js
      chosenIcon = sanitizeIconSvg(advInput.value.trim());
      prev.innerHTML = iconSvg(chosenIcon);
      pick.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    }
  };
  advField.appendChild(advInput);

  const addBtn = el('button', 'addbtn', '+ ADD TYPE');
  addBtn.type = 'button';
  addBtn.onclick = () => {
    const label = labelInput.value.trim();
    if (!label) { labelInput.focus(); return; }
    let key = slugify(label);
    const taken = new Set(allTypeOptions());
    let n = 2;
    while (taken.has(key) || NR_RESERVED_KEYS.has(key)) { key = slugify(label) + '-' + n; n++; }
    const cfg = Object.assign({}, state.config);
    cfg.customTypes = Object.assign({}, cfg.customTypes, {});
    // re-sanitize regardless of source (palette icons are already safe, this
    // is only a no-op for them) - the save path must never trust chosenIcon
    cfg.customTypes[key] = { label, icon: sanitizeIconSvg(chosenIcon) };
    state.config = cfg;
    saveState();
    labelInput.value = ''; advInput.value = '';
    chosenIcon = ICON_PALETTE.generic;
    renderSettings();
  };

  form.appendChild(labelField);
  form.appendChild(pickField);
  form.appendChild(prevField);
  form.appendChild(advField);
  form.appendChild(addBtn);
  return form;
}
function iconSvg(inner) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
}

function buildCustomTypesList() {
  const keys = Object.keys(state.config.customTypes || {});
  if (!keys.length) return el('div', 'sethint', 'No custom device types yet.');
  const list = el('div', 'setlist');
  keys.forEach((key) => {
    const t = state.config.customTypes[key];
    const row = el('div', 'setrow');
    const ic = el('span', 'seticonprev', iconFor(key));
    ic.style.width = '28px'; ic.style.height = '28px';
    row.appendChild(ic);
    const lbl = el('div', 'lbl', escapeHtml(t.label) + ' <span class="key">(' + escapeHtml(key) + ')</span>');
    row.appendChild(lbl);
    const rm = el('button', 'rm', '&#215;');
    rm.title = 'Delete this custom type';
    rm.onclick = () => {
      const inUse = Object.values(state.overrides || {}).some((o) => o && o.typeOverride === key);
      if (inUse && !confirm('Some hosts are currently using "' + t.label + '". Delete the type anyway? Those hosts will fall back to the auto-detected type.')) return;
      const cfg = Object.assign({}, state.config);
      cfg.customTypes = Object.assign({}, cfg.customTypes);
      delete cfg.customTypes[key];
      state.config = cfg;
      saveState();
      renderSettings();
    };
    row.appendChild(rm);
    list.appendChild(row);
  });
  return list;
}

function buildCustomVendorsBlock() {
  const wrap = el('div', null, null);
  const form = el('div', 'setform');
  const field = el('div', 'field'); field.style.flex = '1 1 200px';
  field.innerHTML = '<label>Vendor name</label>';
  const input = el('input'); input.type = 'text'; input.placeholder = 'e.g. "Shelly" or a custom brand';
  field.appendChild(input);
  const addBtn = el('button', 'addbtn', '+ ADD VENDOR');
  addBtn.type = 'button';
  const commit = () => {
    const v = input.value.trim();
    if (!v) { input.focus(); return; }
    if (allVendorOptions().indexOf(v) >= 0) { input.value = ''; return; }
    const cfg = Object.assign({}, state.config);
    cfg.customVendors = (cfg.customVendors || []).concat([v]);
    state.config = cfg;
    saveState();
    input.value = '';
    renderSettings();
  };
  addBtn.onclick = commit;
  input.onkeydown = (e) => { if (e.key === 'Enter') commit(); };
  form.appendChild(field);
  form.appendChild(addBtn);
  wrap.appendChild(form);

  const customVendors = state.config.customVendors || [];
  if (customVendors.length) {
    const chips = el('div', 'vendorchips');
    customVendors.forEach((v) => {
      const chip = el('span', 'vendorchip');
      chip.appendChild(document.createTextNode(v));
      const rm = el('button', 'rm', '&#215;');
      rm.onclick = () => {
        const cfg = Object.assign({}, state.config);
        cfg.customVendors = (cfg.customVendors || []).filter((x) => x !== v);
        state.config = cfg;
        saveState();
        renderSettings();
      };
      chip.appendChild(rm);
      chips.appendChild(chip);
    });
    wrap.appendChild(chips);
  } else {
    wrap.appendChild(el('div', 'sethint', 'No custom vendors added yet \u2014 the dropdown already includes ~50 common brands.'));
  }
  return wrap;
}

function buildRoomsList() {
  const ids = Object.keys(state.config.rooms || {});
  if (!ids.length) return el('div', 'sethint', 'No rooms yet \u2014 add one below.');
  const list = el('div', 'setlist room-list');
  ids.forEach((id) => {
    const r = state.config.rooms[id];
    const row = el('div', 'setrow');
    const labelInput = el('input');
    labelInput.type = 'text'; labelInput.value = r.label;
    labelInput.style.cssText = 'background:var(--bg);border:1px solid var(--panelLine);color:var(--txt);font-size:12px;padding:6px 8px;flex:1 1 160px;min-width:0;outline:none;';
    const commit = () => {
      const v = labelInput.value.trim();
      if (v) { state.config.rooms[id] = Object.assign({}, state.config.rooms[id], { label: v }); saveState(); }
    };
    labelInput.onkeydown = (e) => { if (e.key === 'Enter') { commit(); labelInput.blur(); } };
    labelInput.onblur = commit;
    row.appendChild(labelInput);
    const grid = el('select', 'room-grid-select');
    grid.setAttribute('aria-label', 'Grid size for ' + r.label);
    [2, 3, 4].forEach((side) => {
      const option = el('option');
      option.value = String(side);
      option.textContent = side + '×' + side + ' · ' + side * side + ' places';
      grid.appendChild(option);
    });
    grid.value = String(r.gridSize || 4);
    grid.onchange = () => {
      const side = Number(grid.value);
      if (![2, 3, 4].includes(side)) return;
      state.config.rooms[id] = Object.assign({}, state.config.rooms[id], { gridSize: side });
      saveState();
      render();
    };
    row.appendChild(grid);
    const rm = el('button', 'rm', '&#215;');
    rm.title = 'Delete this room';
    rm.onclick = () => {
      const used = Object.values(state.overrides || {}).some((o) => o && o.room === id);
      if (used && !confirm('Some hosts are assigned to "' + r.label + '". Delete the room anyway? Those hosts keep their current position but lose the room tag.')) return;
      const rooms = Object.assign({}, state.config.rooms);
      delete rooms[id];
      state.config.rooms = rooms;
      saveState();
      renderSettings();
    };
    row.appendChild(rm);
    list.appendChild(row);
  });
  return list;
}

function buildAddRoomForm() {
  const form = el('div', 'setform');
  const field = el('div', 'field'); field.style.flex = '1 1 200px';
  field.innerHTML = '<label>Room name</label>';
  const input = el('input'); input.type = 'text'; input.placeholder = 'e.g. "Cantina" or "Studio"';
  field.appendChild(input);
  const addBtn = el('button', 'addbtn', '+ ADD ROOM');
  addBtn.type = 'button';
  const commit = () => {
    const label = input.value.trim();
    if (!label) { input.focus(); return; }
    let key = slugify(label);
    const taken = new Set(Object.keys(state.config.rooms || {}));
    let n = 2;
    while (taken.has(key) || NR_RESERVED_KEYS.has(key)) { key = slugify(label) + '-' + n; n++; }
    // no position/size to compute - roomsLayout() (app.js) re-divides the
    // stage according to the room grids, every render
    state.config.rooms = Object.assign({}, state.config.rooms, {});
    state.config.rooms[key] = { label };
    saveState();
    input.value = '';
    renderSettings();
  };
  addBtn.onclick = commit;
  input.onkeydown = (e) => { if (e.key === 'Enter') commit(); };
  form.appendChild(field);
  form.appendChild(addBtn);
  return form;
}


// ---- Connection / backend access token ----------------------------------------
// The backend rejects every /api/* request without a matching X-NodeRunner-Token
// header (see noderunner.py load_or_create_token()). The token is
// printed to the terminal the moment the backend starts and only needs to
// be pasted here once per browser/device - it is kept in localStorage, never
// synced through assignments.json (see getToken()/setToken() in app.js).
function buildConnectionSection() {
  const wrap = document.createElement('div');

  const statusDiv = el('div', 'sethint');
  statusDiv.style.marginBottom = '12px';
  statusDiv.textContent = getToken()
    ? 'A token is saved on this browser.'
    : 'No token saved yet on this browser — the backend will refuse every request until one is set.';
  wrap.appendChild(statusDiv);

  const form = el('div', 'setform');

  const tokField = el('div', 'field');
  tokField.style.flex = '1 1 260px';
  tokField.innerHTML = '<label>Backend token</label>';
  const tokInput = el('input');
  tokInput.type = 'password';
  tokInput.placeholder = 'paste the token printed by noderunner.py';
  tokInput.value = getToken();
  tokField.appendChild(tokInput);

  const showBtn = el('button', 'addbtn', 'SHOW');
  showBtn.type = 'button';
  showBtn.style.fontSize = '11px';
  showBtn.onclick = () => {
    const showing = tokInput.type === 'text';
    tokInput.type = showing ? 'password' : 'text';
    showBtn.textContent = showing ? 'SHOW' : 'HIDE';
  };

  const errMsg = el('div', null, '');
  errMsg.style.cssText = 'color:var(--danger);font-size:11px;margin-top:8px;min-height:16px;';

  const saveBtn = el('button', 'addbtn', 'SAVE TOKEN');
  saveBtn.type = 'button';
  saveBtn.onclick = () => {
    setToken(tokInput.value);
    saveBtn.disabled = true;
    saveBtn.textContent = 'CHECKING…';
    errMsg.textContent = '';
    fetch(API_BASE + '/api/devices', { cache: 'no-store', headers: authHeaders() }).then((r) => {
      saveBtn.disabled = false;
      saveBtn.textContent = 'SAVE TOKEN';
      if (r.ok) {
        statusDiv.textContent = 'Token saved and accepted by the backend.';
        // re-pull overrides/known/config too, not just the device list - a
        // token that only just started working never got a chance to load
        // the real saved customizations on initial page load (see loadState()).
        loadState().then(() => runScan(true));
      } else {
        errMsg.textContent = 'Backend rejected this token — check the terminal output of noderunner.py and try again.';
      }
    }).catch(() => {
      saveBtn.disabled = false;
      saveBtn.textContent = 'SAVE TOKEN';
      errMsg.textContent = 'Backend unreachable.';
    });
  };

  form.appendChild(tokField);
  form.appendChild(showBtn);
  form.appendChild(saveBtn);
  wrap.appendChild(form);
  wrap.appendChild(errMsg);
  return wrap;
}

// ---- Network / VLAN scan target section --------------------------------------
function buildNetworkSection() {
  const wrap = document.createElement('div');

  const currentDiv = el('div', 'sethint');
  currentDiv.style.marginBottom = '12px';
  currentDiv.textContent = 'Current scan target: ' + (state.subnet || '(auto-detected on startup)');
  wrap.appendChild(currentDiv);

  const form = el('div', 'setform');

  const presetField = el('div', 'field');
  presetField.innerHTML = '<label>Presets</label>';
  const presetRow = document.createElement('div');
  presetRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';

  const cidrInput = el('input');
  cidrInput.type = 'text';
  cidrInput.placeholder = 'e.g. 10.0.0.0/24';
  cidrInput.value = state.subnet || '';

  var PRESETS = [
    { label: 'KVM', cidr: '192.168.124.0/24' },
    { label: 'Home', cidr: '192.168.1.0/24' },
  ];
  PRESETS.forEach(function(p) {
    var btn = el('button', 'addbtn', p.label + ' ' + p.cidr);
    btn.type = 'button';
    btn.style.fontSize = '11px';
    btn.onclick = (function(cidr) { return function() { cidrInput.value = cidr; }; })(p.cidr);
    presetRow.appendChild(btn);
  });
  presetField.appendChild(presetRow);

  const cidrField = el('div', 'field');
  cidrField.style.flex = '1 1 180px';
  cidrField.innerHTML = '<label>Custom CIDR</label>';
  cidrField.appendChild(cidrInput);

  const errMsg = el('div', null, '');
  errMsg.style.cssText = 'color:var(--danger);font-size:11px;margin-top:8px;min-height:16px;';

  const applyBtn = el('button', 'addbtn', 'APPLY & RESCAN');
  applyBtn.type = 'button';
  applyBtn.style.alignSelf = 'flex-end';
  applyBtn.onclick = function() {
    var target = cidrInput.value.trim();
    if (!target) { cidrInput.focus(); return; }
    applyBtn.disabled = true;
    applyBtn.textContent = 'APPLYING…';
    errMsg.textContent = '';
    fetch(API_BASE + '/api/config', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ scanTarget: target }),
    }).then(function(r) { return r.json(); }).then(function(j) {
      if (j.ok) {
        state.settingsOpen = false;
        runScan(true);
      } else {
        errMsg.textContent = j.error || 'Invalid CIDR';
        applyBtn.disabled = false;
        applyBtn.textContent = 'APPLY & RESCAN';
      }
    }).catch(function() {
      errMsg.textContent = 'Backend unreachable';
      applyBtn.disabled = false;
      applyBtn.textContent = 'APPLY & RESCAN';
    });
  };

  form.appendChild(presetField);
  form.appendChild(cidrField);
  form.appendChild(applyBtn);
  wrap.appendChild(form);
  wrap.appendChild(errMsg);
  return wrap;
}

function renderSettings() {
  const root = document.getElementById('settings-root');
  if (!state.settingsOpen) { root.innerHTML = ''; return; }

  const scrim = el('div', 'scrim');
  scrim.onclick = () => { state.settingsOpen = false; render(); };

  const panel = el('div', 'regpanel');

  const head = el('div', 'rhead');
  head.appendChild(el('h2', null, '&#9881; NodeRunner settings'));
  head.appendChild(el('div', 'rsub', 'Add device types &amp; vendors the scanner doesn\u2019t know about \u2014 no code editing required.'));
  const close = el('button', 'close', '&#215;');
  close.onclick = () => { state.settingsOpen = false; render(); };
  head.appendChild(close);
  panel.appendChild(head);

  const body = el('div', 'rbody');

  const sConn = el('div', 'setsection');
  sConn.appendChild(el('h3', null, 'Connection'));
  sConn.appendChild(el('div', 'sethint',
    'The backend only accepts requests carrying this token, so a random webpage can’t drive your scanner. ' +
    'Copy it from the terminal where you started noderunner.py, paste it below once per browser/device.'));
  sConn.appendChild(buildConnectionSection());
  body.appendChild(sConn);

  const sNet = el('div', 'setsection');
  sNet.appendChild(el('h3', null, 'Scan Network'));
  sNet.appendChild(el('div', 'sethint',
    'Change the subnet the scanner probes. Default: auto-detected from your local IP. ' +
    'Pick a preset or enter any valid CIDR, then click APPLY\u202fto rescan immediately.'));
  sNet.appendChild(buildNetworkSection());
  body.appendChild(sNet);

  const s0 = el('div', 'setsection');
  s0.appendChild(el('h3', null, 'Rooms'));
  s0.appendChild(el('div', 'sethint',
    'Six default rooms are created the first time you open this app (2x bedroom, kitchen, bathroom, garage, attic) \u2014 ' +
    'add, rename or delete as needed. Choose a minimum grid for each room: 2×2, 3×3 or 4×4. ' +
    'Rooms and the map resize to fit their grids, expanding automatically when more hosts need space. ' +
    'Drag hosts, including the gateway, anywhere in a room; exact positions are saved without grid snapping. Scroll the map to explore all rooms.'));
  s0.appendChild(buildAddRoomForm());
  s0.appendChild(buildRoomsList());
  body.appendChild(s0);

  const s1 = el('div', 'setsection');
  s1.appendChild(el('h3', null, 'Custom device types'));
  s1.appendChild(el('div', 'sethint',
    'Create a new device category with its own icon (e.g. an irrigation controller, a pool pump). ' +
    'Once added it shows up in every Type dropdown (host drawer, Registry) and on the map.'));
  s1.appendChild(buildAddTypeForm());
  s1.appendChild(buildCustomTypesList());
  body.appendChild(s1);

  const s2 = el('div', 'setsection');
  s2.appendChild(el('h3', null, 'Custom vendors'));
  s2.appendChild(el('div', 'sethint', 'Add a brand that isn\u2019t in the built-in vendor list so it shows up directly in the dropdown instead of needing "Other".'));
  s2.appendChild(buildCustomVendorsBlock());
  body.appendChild(s2);

  panel.appendChild(body);

  root.innerHTML = '';
  root.appendChild(scrim);
  root.appendChild(panel);
}
