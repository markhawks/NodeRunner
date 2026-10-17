'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = process.env.NODERUNNER_SOURCE || process.env.HNS_SOURCE || path.resolve(__dirname, '..');
class Element {
  constructor(tag) { this.tagName=tag; this.children=[]; this.style={}; this.dataset={}; this.listeners={}; this.innerHTML=''; this.classList={contains:name=>(this.className||'').split(' ').includes(name),toggle:(name,on)=>{this[name]=on;}}; }
  get innerHTML() { return this._html; }
  set innerHTML(value) { this._html=value; this.children=[]; }
  appendChild(child) { this.children.push(child); child.parent=this; return child; }
  setAttribute(name,value) { this[name]=value; }
  getAttribute(name) { return this[name]; }
  querySelector(selector) { return selector === '.card' && this.innerHTML.includes('class="card') ? new Element('div') : null; }
  querySelectorAll() { return []; }
  addEventListener(name, callback) { this.listeners[name]=callback; }
  closest() { return this.parent; }
  getBoundingClientRect() { return {width:this.clientWidth,height:this.clientHeight}; }
  focus() { sandbox.document.activeElement=this; }
  click() { this.clicked=true; }
  contains(node) { return this===node || this.children.some(child=>child.contains(node)); }
  remove() { if(this.parent) this.parent.children=this.parent.children.filter(child=>child!==this); }
  after() {}
}
const elements = new Map([['save-status',new Element('div')],['registry-root',new Element('div')],['regbtn',new Element('button')],['mapbtn',new Element('button')],['theme-menu',new Element('details')],['theme-trigger',new Element('summary')],['theme-current',new Element('strong')],['brand-button',new Element('button')],['app-version',new Element('span')],['changelog-dialog',new Element('dialog')],['changelog-content',new Element('div')],['changelog-close',new Element('button')],['scanbtn',new Element('button')],['scan-label',new Element('span')],['lastscan',new Element('span')]]);
const themeButtons=['light','phosphor','ion'].map(theme=>{
  const button=new Element('button');button.setAttribute('data-theme-option',theme);return button;
});
elements.get('theme-menu').appendChild(elements.get('theme-trigger'));
for(const button of themeButtons)elements.get('theme-menu').appendChild(button);
elements.get('changelog-dialog').showModal=function(){this.open=true;};
elements.get('changelog-dialog').close=function(){this.open=false;if(this.onclose)this.onclose();};
const storage = new Map();
const sandbox = {
  URL, console, setTimeout, clearTimeout,
  location: {protocol:'http:',href:'http://localhost:8080/',port:'8080',hostname:'localhost'},
  localStorage: {getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
  document: {querySelector:()=>({}),querySelectorAll:selector=>selector==='[data-theme-option]'?themeButtons:[],
    body:new Element('body'),documentElement:new Element('html'),getElementById:id=>elements.get(id),createElement:tag=>new Element(tag)},
  fetch:async()=>({ok:true}), confirm:()=>true, alert:()=>{},
};
vm.createContext(sandbox);
for (const name of ['icons.js','registry.js','app.js']) {
  let source=fs.readFileSync(path.join(root,'static',name),'utf8');
  if (name==='app.js') source=source.split('// ---- wire up controls + boot')[0];
  vm.runInContext(source,sandbox,{filename:name});
}
const run=code=>vm.runInContext(code,sandbox);
let tests=0;
function check(name,fn) { fn(); ++tests; console.log('OK',name); }
function reset() { run('state.overrides=Object.create(null);state.known=Object.create(null);state.prevHosts={};state.config=normalizeConfig({rooms:{}});state.baseline=false;state.assignmentsLoaded=false;state.devices=[];state.registryScope="all";state.registryFilter="";state.registrySort="ip";state.registrySortDirection="asc";state.source="connecting";'); }
function findElement(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.children) {
    const match = findElement(child, predicate);
    if (match) return match;
  }
  return null;
}
function withoutRendering(fn) {
  const original = run('render');
  sandbox.render = () => {};
  try { fn(); } finally { sandbox.render = original; }
}

check('Room sorting renders distinct tables with headings and counts and reverses group order',()=>{
  reset();
  run(`state.known={a:1,b:1,c:1,d:1};state.overrides={a:{room:'kitchen'},b:{room:'study'},c:{room:'kitchen'},d:{}};
    state.config.rooms={kitchen:{label:'Kitchen'},study:{label:'Study'}};sortRegistryBy('room');`);
  let body=run('buildRegistryBody()');
  assert.equal(body.children.length,3);
  assert.ok(body.children.every(section=>section.className==='reg-group'));
  assert.equal(body.children[0].children[0].children[0].textContent,'Room · Kitchen');
  assert.equal(body.children[0].children[0].children[1].textContent,'2 devices');
  assert.equal(body.children[2].children[0].children[0].textContent,'Unassigned room');
  assert.ok(body.children.every(section=>section.children[1].tagName==='table'));
  run('sortRegistryBy("room")');body=run('buildRegistryBody()');
  assert.equal(body.children[0].children[0].children[0].textContent,'Room · Study');
  assert.equal(body.children[2].children[0].children[0].textContent,'Unassigned room');
});
check('Connection sorting separates Gateway, Wi-Fi, Wired and unassigned devices',()=>{
  reset();
  run(`state.known={gw:1,a:1,b:1,c:1,d:1};state.overrides={gw:{},a:{conn:'wifi'},b:{conn:'wired'},c:{conn:'wifi'},d:{}};
    sortRegistryBy('conn');`);
  const body=run('buildRegistryBody()');
  assert.equal(body.children.length,4);
  assert.equal(body.children.map(section=>section.children[0].children[0].textContent).join(','),'Gateway,Unassigned connection,Wi-Fi,Wired');
  assert.equal(body.children[2].children[0].children[1].textContent,'2 devices');
  const connection=findElement(body,node=>node.getAttribute('aria-label')==='Connection type for a');
  withoutRendering(()=>{connection.value='wired';connection.onchange();});
  assert.equal(run('registryGroups(registryRowIds()).find(group=>group.key==="wifi").ids.length'),1);
  assert.equal(run('registryGroups(registryRowIds()).find(group=>group.key==="wired").ids.length'),2);
});
check('grouping follows filters and switching to another sort restores a single table',()=>{
  reset();
  run(`state.known={a:1,b:1};state.overrides={a:{room:'kitchen',vendorAuto:'Alpha'},b:{room:'study',vendorAuto:'Beta'}};
    state.config.rooms={kitchen:{label:'Kitchen'},study:{label:'Study'}};
    state.registryFilter='Alpha';sortRegistryBy('room');`);
  let body=run('buildRegistryBody()');
  assert.equal(body.children.length,1);assert.equal(body.children[0].className,'reg-group');
  assert.equal(body.children[0].children[0].children[1].textContent,'1 device');
  run('state.registryFilter="missing"');
  body=run('buildRegistryBody()');assert.equal(findElement(body,node=>node.tagName==='table'),null);
  run('state.registryFilter="";sortRegistryBy("vendor");');
  body=run('buildRegistryBody()');assert.equal(body.children.length,1);assert.equal(body.children[0].tagName,'table');
});
check('rooms with identical labels keep distinct groups and Excel follows the rendered row order',()=>{
  reset();
  run(`state.known={a:1,b:1,c:1};state.overrides={a:{room:'one',lastIp:'192.0.2.1',name:'A'},
    b:{room:'two',lastIp:'192.0.2.2',name:'B'},c:{room:'one',lastIp:'192.0.2.3',name:'C'}};
    state.config.rooms={one:{label:'Room'},two:{label:'Room'}};sortRegistryBy('room');`);
  assert.equal(run('registryGroups(registryRowIds()).length'),2);
  assert.equal(run('registryExportRows().map(row=>row[3]).join(",")'),'A,C,B');
});

check('clickable Vendor header sorts the displayed vendor and reverses on the next click',()=>{
  reset();
  run(`state.known={a:1,b:1,c:1};state.overrides={
    a:{lastIp:'192.0.2.1',vendorAuto:'Alpha',vendorOverride:'Zebra'},
    b:{lastIp:'192.0.2.2',vendorAuto:'Beta'},c:{lastIp:'192.0.2.3'}};`);
  const button=findElement(run('buildRegistryHeader()'),node=>node.getAttribute('data-registry-sort')==='vendor');
  button.onclick();
  assert.equal(run('registryRowIds().join(",")'),'b,a,c');
  assert.equal(run('state.registrySortDirection'),'asc');
  let active=findElement(run('buildRegistryHeader()'),node=>node.getAttribute('data-registry-sort')==='vendor');
  assert.equal(active.parent.getAttribute('aria-sort'),'ascending');
  active.onclick();
  assert.equal(run('registryRowIds().join(",")'),'a,b,c');
  active=findElement(run('buildRegistryHeader()'),node=>node.getAttribute('data-registry-sort')==='vendor');
  assert.equal(active.parent.getAttribute('aria-sort'),'descending');
});
check('Room sorting uses room labels with natural numbers rather than internal keys',()=>{
  reset();
  run(`state.known={a:1,b:1,c:1};state.overrides={
    a:{room:'a'},b:{room:'z'},c:{}};state.config.rooms={a:{label:'Room 10'},z:{label:'Room 2'}};
    sortRegistryBy('room');`);
  assert.equal(run('registryRowIds().join(",")'),'b,a,c');
  run('sortRegistryBy("room")');
  assert.equal(run('registryRowIds().join(",")'),'a,b,c');
});
check('IP and last-seen ordering are numeric and empty dates stay last',()=>{
  reset();
  run(`state.known={a:1,b:1,c:1};state.overrides={a:{lastIp:'192.0.2.100',lastSeen:100},
    b:{lastIp:'192.0.2.9',lastSeen:900},c:{lastIp:'192.0.2.10'}};`);
  assert.equal(run('registryRowIds().join(",")'),'b,c,a');
  run('sortRegistryBy("ip")');
  assert.equal(run('registryRowIds().join(",")'),'a,c,b');
  run('sortRegistryBy("lastSeen")');
  assert.equal(run('registryRowIds().join(",")'),'a,b,c');
  run('sortRegistryBy("lastSeen")');
  assert.equal(run('registryRowIds().join(",")'),'b,a,c');
});
check('filtered Excel export follows the column order selected in the registry',()=>{
  reset();
  run(`state.known={a:1,b:1,c:1};state.overrides={a:{name:'Alpha',vendorAuto:'Vendor'},
    b:{name:'Zulu',vendorAuto:'Vendor'},c:{name:'Other'}};state.registryFilter='Vendor';
    sortRegistryBy('name');sortRegistryBy('name');`);
  assert.equal(run('registryExportRows().map(row=>row[3]).join(",")'),'Zulu,Alpha');
  assert.equal(run('state.registrySortDirection'),'desc');
});
check('registry headers replace the three Sort buttons and leave Actions unsortable',()=>{
  reset();run('state.registryOpen=true;renderRegistry();');
  const panel=elements.get('registry-root');
  assert.equal(findElement(panel,node=>node.className==='rsortbar'),null);
  const head=run('buildRegistryHeader()');
  assert.equal(head.children[0].children.length,13);
  assert.equal(head.children[0].children[12].textContent,'Actions');
  assert.equal(head.children[0].children[12].children.length,0);
  for(const key of ['vendor','room','conn','name','ip','mac','type','ports','lastSeen','trusted','status','alias']) {
    assert.ok(findElement(head,node=>node.getAttribute('data-registry-sort')===key));
  }
});

check('registry vendor dropdown shares map overrides and supports custom vendors',()=>{
  reset();
  run('state.known.host=1;state.overrides.host={vendorAuto:"Apple"};state.config.customVendors=["My custom brand"];');
  const body=run('buildRegistryBody()');
  const select=findElement(body,node=>node.getAttribute('aria-label')==='Vendor for host');
  const input=findElement(body,node=>node.getAttribute('aria-label')==='Custom vendor for host');
  assert.ok(select.children.some(option=>option.value==='Apple'));
  assert.ok(select.children.some(option=>option.value==='My custom brand'));
  assert.equal(select.children[0].textContent,'(auto-detected) Apple');
  withoutRendering(()=>{
    select.value='My custom brand';select.onchange();
    assert.equal(run('vendorOf({id:"host",vendor:"Apple"})'),'My custom brand');
    assert.equal(run('registryExportRows()[0][6]'),'My custom brand');
    select.value='__custom__';select.onchange();
    assert.equal(input.style.display,'block');
    input.value='Another brand';input.onblur();
    assert.equal(run('state.overrides.host.vendorOverride'),'Another brand');
    assert.equal(JSON.parse(storage.get('noderunner_state_v2')).overrides.host.vendorOverride,'Another brand');
    select.value='';select.onchange();
    assert.equal(run('vendorOf({id:"host",vendor:"Apple"})'),'Apple');
  });
});
check('registry Connection dropdown updates the same Wi-Fi/Wired field as the map and Excel',()=>{
  reset();
  run('state.known.host=1;state.overrides.host={conn:"wired"};');
  const select=findElement(run('buildRegistryBody()'),node=>node.getAttribute('aria-label')==='Connection type for host');
  assert.ok(select);
  assert.equal(select.children.find(option=>option.value==='wired').selected,true);
  withoutRendering(()=>{
    for (const [value,label] of [['wifi','Wi-Fi'],['wired','Wired'],['unset','Unassigned']]) {
      select.value=value;select.onchange();
      assert.equal(run('connOf({id:"host"})'),value);
      assert.equal(run('registryExportRows()[0][9]'),label);
      assert.equal(JSON.parse(storage.get('noderunner_state_v2')).overrides.host.conn,value);
    }
  });
});

check('theme dropdown persists selection without rebuilding either view',()=>{
  run('setTheme("light")');
  assert.equal(storage.get('noderunner_theme'),'light');
  assert.equal(sandbox.document.documentElement.getAttribute('data-theme'),'light');
  assert.equal(run('readTheme()'),'light');
  assert.equal(elements.get('theme-current').textContent,'Light');
  assert.equal(elements.get('theme-trigger').title,'Theme: Light');
  const menu=elements.get('theme-menu');menu.open=true;
  const current=elements.get('registry-root').children[0];
  themeButtons[2].onclick();
  assert.equal(menu.open,false);
  assert.equal(elements.get('theme-current').textContent,'Ion');
  assert.equal(elements.get('theme-trigger').title,'Theme: Ion');
  assert.equal(sandbox.document.activeElement,elements.get('theme-trigger'));
  assert.equal(elements.get('registry-root').children[0],current);
  for(const button of themeButtons)assert.equal(button.getAttribute('aria-pressed'),String(button.getAttribute('data-theme-option')==='ion'));
  assert.equal(run('readTheme()'),'ion');
});
check('theme choices close with Escape or an outside click and preserve inside interaction',()=>{
  const menu=elements.get('theme-menu');menu.open=true;
  run('dismissThemeMenu({target:document.getElementById("theme-trigger")})');
  assert.equal(menu.open,true);
  let prevented=false;menu.onkeydown({key:'Escape',preventDefault:()=>{prevented=true;}});
  assert.equal(menu.open,false);assert.equal(prevented,true);
  assert.equal(sandbox.document.activeElement,elements.get('theme-trigger'));
  menu.open=true;run('dismissThemeMenu({target:document.body})');assert.equal(menu.open,false);
});
check('version and dated changelog share release data and initialize only once',()=>{
  run('initializeReleaseInfo();initializeReleaseInfo();');
  assert.equal(elements.get('app-version').textContent,'v'+run('APP_VERSION')+' · Changelog');
  assert.ok(elements.get('brand-button').getAttribute('aria-label').includes('v'+run('APP_VERSION')));
  const content=elements.get('changelog-content');
  assert.equal(content.children.length,1);
  assert.equal(content.children[0].children.length,run('APP_RELEASES.length'));
  const version=findElement(content,n=>n.tagName==='h3');
  const date=findElement(content,n=>n.tagName==='time');
  assert.equal(version.textContent,'v'+run('APP_VERSION'));
  assert.equal(date.dateTime,'2026-10-17');
  assert.match(date.textContent,/17 October 2026/);
});
check('brand opens the changelog from either view and close restores focus without changing route',()=>{
  const dialog=elements.get('changelog-dialog'),brand=elements.get('brand-button');
  for(const registryOpen of [false,true]) {
    sandbox.releaseView=registryOpen;run('state.registryOpen=releaseView;');
    const hash=sandbox.location.hash;
    elements.get('theme-menu').open=true;brand.onclick();
    assert.equal(dialog.open,true);assert.equal(elements.get('theme-menu').open,false);
    assert.equal(run('state.registryOpen'),registryOpen);
    assert.equal(sandbox.location.hash,hash);
    elements.get('changelog-close').onclick();
    assert.equal(dialog.open,false);assert.equal(sandbox.document.activeElement,brand);
  }
  delete sandbox.releaseView;
});
check('invalid saved themes fall back safely and invalid selections are ignored',()=>{
  storage.set('noderunner_theme','invalid');
  assert.equal(run('readTheme()'),'phosphor');
  run('setTheme("light");setTheme("invalid")');
  assert.equal(run('state.theme'),'light');
  assert.equal(storage.get('noderunner_theme'),'light');
});
check('registry distinguishes last-scan presence from unavailable scan results',()=>{
  reset();
  run('state.devices=[{id:"host",status:"online"}];state.source="live";');
  assert.equal(run('registryStatus("host").key'),'seen');
  assert.equal(run('registryStatus("other").key'),'absent');
  run('state.source="error"');
  assert.equal(run('registryStatus("host").key'),'unknown');
  assert.equal(run('registryStatus("other").key'),'unknown');
});
check('registry filters combine scan status, trust, room search and unfiltered totals',()=>{
  reset();
  run(`state.source='live';state.known={a:1,b:1};state.overrides={
    a:{lastIp:'192.0.2.1',trusted:true,room:'office'},b:{lastIp:'192.0.2.2'}};
    state.config.rooms={office:{label:'Study'}};state.devices=[{id:'a',status:'online'}];`);
  assert.equal(run('registryRowIds().join(",")'),'a,b');
  run('state.registryScope="seen"');
  assert.equal(run('registryRowIds().join(",")'),'a');
  run('state.registryScope="absent"');
  assert.equal(run('registryRowIds().join(",")'),'b');
  run('state.registryScope="trusted";state.registryFilter="Study"');
  assert.equal(run('registryRowIds().join(",")'),'a');
  run('state.registryFilter="missing"');
  assert.equal(run('registryRowIds().length'),0);
  assert.equal(run('registryRowIds(false).length'),2);
});
check('registry is a dedicated page with map navigation and no modal backdrop',()=>{
  reset();
  run('state.registryOpen=true;renderRegistry();');
  assert.equal(sandbox.document.body['registry-view'],true);
  const panel=elements.get('registry-root').children[0];
  assert.equal(panel.tagName,'section');
  assert.equal(elements.get('registry-root').children.length,1);
  assert.equal(panel.getAttribute('aria-modal'),undefined);
  assert.match(sandbox.document.title,/Host registry/);
  const mapButton=elements.get('mapbtn');
  assert.equal(mapButton.getAttribute('aria-pressed'),'false');
  assert.equal(elements.get('regbtn').getAttribute('aria-current'),'page');
  mapButton.onclick();
  assert.equal(sandbox.location.hash,'map');
  run('state.registryOpen=false;renderRegistry();');
  assert.equal(sandbox.document.body['registry-view'],false);
});
check('the shared Map and Registry switch keeps its identity and marks the active view',()=>{
  reset();
  const map=elements.get('mapbtn'),registry=elements.get('regbtn');
  run('renderRegistry()');
  assert.equal(map.getAttribute('aria-current'),'page');
  assert.equal(map['is-active'],true);
  assert.equal(registry.getAttribute('aria-pressed'),'false');
  registry.onclick();assert.equal(sandbox.location.hash,'registry');
  run('state.registryOpen=true;renderRegistry();');
  assert.equal(elements.get('mapbtn'),map);
  assert.equal(elements.get('regbtn'),registry);
  assert.equal(registry.getAttribute('aria-current'),'page');
  assert.equal(registry['is-active'],true);
  assert.equal(map['is-active'],false);
  map.onclick();assert.equal(sandbox.location.hash,'map');
  run('state.registryOpen=false;renderRegistry();');
  assert.equal(map.getAttribute('aria-current'),'page');
  assert.equal(registry.getAttribute('aria-current'),'false');
});
check('registry route follows browser navigation and restores map focus',()=>{
  const render=run('render');
  sandbox.originalRender=render;
  run('render=()=>{};location.hash="#registry";syncRegistryRoute();');
  assert.equal(run('state.registryOpen'),true);
  run('location.hash="#map";syncRegistryRoute();');
  assert.equal(run('state.registryOpen'),false);
  assert.equal(sandbox.document.activeElement,elements.get('mapbtn'));
  run('render=originalRender;');
});
check('Excel rows follow active filters and keep device-provided values as text',()=>{
  reset();
  run(`state.source='live';state.known={a:1,b:1};state.overrides={
    a:{lastIp:'192.0.2.1',trusted:true,alias:'=1+1',lastHostname:'Caffè & Office',room:'study',lastPorts:[22,80],lastSeen:123000},
    b:{lastIp:'192.0.2.2'}};
    state.config.rooms={study:{label:'Study'}};state.devices=[{id:'a',status:'online'}];state.registryScope='seen';`);
  const rows=run('registryExportRows()');
  assert.equal(rows.length,1); assert.equal(rows[0].length,14);
  assert.equal(rows[0][2],'=1+1'); assert.equal(rows[0][3],'Caffè & Office');
  assert.equal(rows[0][8],'Study'); assert.equal(rows[0][10],'22, 80');
  assert.equal(rows[0][11],'1970-01-01T00:02:03.000Z');
  assert.ok(rows[0].every(value=>typeof value==='string'));
  run('state.registryFilter="missing"');
  assert.equal(run('registryExportRows().length'),0);
});

check('current persisted data and legacy room metadata are accepted',()=>{
  const registry=path.join(root,'assignments.json');
  sandbox.actual=fs.existsSync(registry)?JSON.parse(fs.readFileSync(registry,'utf8')):{};
  assert.equal(typeof run('validateAssignments(actual).overrides'),'object');
});
check('malformed data and reserved keys fail before import',()=>{
  for (const value of ['[]','{"overrides":[]}','{"config":null}','{"known":{"x":null}}',
    '{"overrides":{"__proto__":{"trusted":true}}}','{"overrides":{"x":{"trusted":"false"}}}',
    '{"config":{"rooms":{"constructor":{"label":"x"}}}}','{"config":{"customTypes":{"prototype":{}}}}']) {
    sandbox.bad=value; assert.throws(()=>run('validateAssignments(JSON.parse(bad))'));
  }
  assert.equal(run('({}).trusted'),undefined);
});
check('map prototypes cannot supply trusted device flags',()=>{
  assert.equal(run('Object.getPrototypeOf(validateAssignments({overrides:{x:{}}}).overrides)'),null);
  assert.equal(run('Object.getPrototypeOf(validateAssignments({overrides:{x:{}}}).overrides.x)'),null);
});
check('ports, positions, booleans and timestamps are validated',()=>{
  assert.throws(()=>run('validateAssignments({overrides:{x:{lastPorts:["80"]}}})'));
  assert.throws(()=>run('validateAssignments({overrides:{x:{pos:{xPct:NaN,yPct:1}}}})'));
  assert.throws(()=>run('validateAssignments({known:{x:Infinity}})'));
  assert.equal(run('validateAssignments({overrides:{x:{trusted:false,pos:{xPct:0,yPct:100}}}}).overrides.x.trusted'),false);
});
check('nine attic hosts use sixteen distinct places with empty cells available',()=>{
  reset();
  run(`state.config.rooms={attic:{label:'Attic'}};
    state.devices=Array.from({length:9},(_,i)=>({id:'host'+i}));
    state.devices.forEach(d=>state.overrides[d.id]={room:'attic'});`);
  assert.equal(run('roomGridSlots("attic",state.devices.map(d=>d.id)).length'),16);
  const positions=run('Object.values(roomHostPositions(state.devices.map(d=>d.id)))');
  assert.equal(positions.length,9);
  assert.equal(new Set(positions.map(p=>p.xPct+','+p.yPct)).size,9);
  assert.ok(positions.every(p=>p.scale===1));
});
check('a freely positioned host keeps exact off-grid coordinates after validation and reload',()=>{
  const result=run(`(() => {
    const ids=state.devices.map(d=>d.id), target=roomGridSlots('attic',ids)[15];
    const dropped={xPct:target.xPct+1.23,yPct:target.yPct-0.87};
    target.xPct=dropped.xPct;target.yPct=dropped.yPct;
    state.overrides.host0.pos=dropped;
    const clean=validateAssignments(JSON.parse(JSON.stringify({overrides:state.overrides,config:state.config})));
    state.overrides=clean.overrides;state.config=clean.config;
    return {target,actual:roomHostPositions(ids).host0};
  })()`);
  assert.equal(result.actual.xPct,result.target.xPct);
  assert.equal(result.actual.yPct,result.target.yPct);
});
check('manual positions are not relocated even when close to another card',()=>{
  const result=run(`(() => {
    pinRoomOccupants('attic','host1');
    const ids=state.devices.map(d=>d.id), before=roomHostPositions(ids);
    state.overrides.host1.pos={xPct:before.host0.xPct+0.1,yPct:before.host0.yPct+0.1};
    return {before,after:roomHostPositions(ids)};
  })()`);
  for(const [id,pos] of Object.entries(result.before)) {
    if(id!=='host1') assert.deepEqual(result.after[id],pos);
  }
  assert.equal(result.after.host1.xPct,result.before.host0.xPct+0.1);
  assert.equal(result.after.host1.yPct,result.before.host0.yPct+0.1);
});
check('the seventeenth host expands the grid and can occupy the last cell',()=>{
  run(`state.devices=Array.from({length:17},(_,i)=>({id:'host'+i}));
    state.devices.forEach(d=>state.overrides[d.id]={room:'attic'});`);
  assert.equal(run('roomGridSlots("attic",state.devices.map(d=>d.id)).length'),25);
  const result=run(`(() => {
    const ids=state.devices.map(d=>d.id),target=roomGridSlots('attic',ids)[24];
    state.overrides.host16.pos={xPct:target.xPct,yPct:target.yPct};
    return {target,actual:roomHostPositions(ids).host16,count:Object.keys(roomHostPositions(ids)).length};
  })()`);
  assert.equal(result.count,17);
  assert.equal(result.actual.xPct,result.target.xPct);
  assert.equal(result.actual.yPct,result.target.yPct);
});
check('many rooms grow the scrollable canvas and keep full-size cards apart',()=>{
  reset();
  const stage=new Element('div');elements.set('stage',stage);
  run(`state.config.rooms=Object.fromEntries(Array.from({length:20},(_,i)=>['room'+i,{label:'Room '+i}]));
    state.devices=Array.from({length:20},(_,i)=>({id:'host'+i}));
    state.devices.forEach((d,i)=>state.overrides[d.id]={room:'room'+i});`);
  const size=run('mapMinimumSize(state.devices.map(d=>d.id))');
  stage.clientWidth=size.width;stage.clientHeight=size.height;
  assert.ok(size.width>900 && size.height>620);
  for(let i=0;i<20;i++) {
    const cells=run(`roomGridSlots('room${i}',state.devices.map(d=>d.id))`);
    assert.ok(cells.every(p=>p.scale===1));
    assert.ok((cells[1].xPct-cells[0].xPct)*size.width/100>=189.9);
    assert.ok((cells[4].yPct-cells[0].yPct)*size.height/100>=115.9);
  }
  elements.delete('stage');
});
check('gateway reserves a room cell and its registry room selector is enabled',()=>{
  reset();
  run(`state.config.rooms={attic:{label:'Attic'}};state.devices=[{id:'gw',name:'Gateway',ip:'192.0.2.1',ports:[]}];
    state.overrides.gw={room:'attic'};state.known.gw=1;`);
  assert.equal(run('Object.keys(roomHostPositions(["gw"])).length'),1);
  const body=run('buildRegistryBody()');
  const select=findElement(body,n=>n.tagName==='select' && String(n['aria-label']).includes('Room'));
  assert.ok(select);
  assert.ok(!select.disabled);
});
check('gateway drag keeps the exact off-grid release point, neighbours and edges',()=>{
  reset();
  const stage=new Element('div'),center=new Element('div'),main=new Element('main');
  stage.parent=center;stage.clientWidth=900;stage.clientHeight=620;elements.set('stage',stage);
  const oldQuery=sandbox.document.querySelector;
  sandbox.document.querySelector=()=>main;
  sandbox.document.createElementNS=(_,tag)=>new Element(tag);
  run(`state.config.rooms={attic:{label:'Attic'}};
    state.devices=[{id:'gw',name:'Router',ip:'192.0.2.1',ports:[],status:'online'},
      {id:'host',name:'Host',ip:'192.0.2.2',ports:[],status:'online'}];
    state.overrides.gw={room:'attic'};state.overrides.host={room:'attic'};
    renderStage(state.devices,[],[],[state.devices[1]]);`);
  const grid=findElement(stage,n=>n.className==='room-slots');
  assert.equal(grid.children.length,16);
  const gateway=findElement(stage,n=>(n.className||'').split(' ').includes('gw'));
  gateway.classList.add=()=>{};gateway.classList.remove=()=>{};
  const cell=run('roomGridSlots("attic",["gw","host"])[15]');
  cell.xPct-=1.15;cell.yPct-=0.73;
  const neighbour=run('roomHostPositions(["gw","host"]).host');
  const start={x:parseFloat(gateway.style.left)*9,y:parseFloat(gateway.style.top)*6.2};
  gateway.listeners.pointerdown({button:0,clientX:start.x,clientY:start.y,pointerId:1});
  gateway.listeners.pointermove({clientX:cell.xPct*9,clientY:cell.yPct*6.2,pointerId:1});
  assert.equal(Number(run('state._lineEls.host.x1')),cell.xPct/100*1040);
  run('globalThis.savedRender=render;render=()=>{};');
  try { gateway.listeners.pointerup({pointerId:1}); }
  finally { run('render=globalThis.savedRender;delete globalThis.savedRender;'); }
  assert.equal(run('state.overrides.gw.pos.xPct'),cell.xPct);
  assert.equal(run('state.overrides.gw.pos.yPct'),cell.yPct);
  assert.equal(run('roomHostPositions(["gw","host"]).host.xPct'),neighbour.xPct);
  assert.equal(run('roomHostPositions(["gw","host"]).host.yPct'),neighbour.yPct);
  sandbox.document.querySelector=oldQuery;
  delete sandbox.document.createElementNS;elements.delete('stage');
});
check('dragging also freezes unassigned neighbours without replacing existing manual positions',()=>{
  reset();
  const stage=new Element('div');
  const nodes=['moving','automatic','manual'].map((id,i)=>{
    const node=new Element('div');node.dataset.deviceId=id;
    node.style.left=String(25+i*10)+'%';node.style.top='40%';return node;
  });
  stage.querySelectorAll=()=>nodes;sandbox.testMapStage=stage;
  run(`state.overrides.manual={pos:{xPct:12.3,yPct:45.6}};
    pinMapOccupants(testMapStage,'moving');`);
  assert.equal(run('state.overrides.moving'),undefined);
  assert.equal(run('state.overrides.automatic.pos.xPct'),35);
  assert.equal(run('state.overrides.manual.pos.xPct'),12.3);
  delete sandbox.testMapStage;
});
check('growing a room grid leaves manual coordinates unchanged',()=>{
  reset();
  run(`state.config.rooms={attic:{label:'Attic'}};
    state.devices=[{id:'fixed'}];state.overrides.fixed={room:'attic',pos:{xPct:37.12,yPct:63.45}};
    state.devices.push(...Array.from({length:16},(_,i)=>({id:'new'+i})));
    state.devices.forEach(d=>{if(d.id!=='fixed')state.overrides[d.id]={room:'attic'};});`);
  assert.equal(run('roomGridSize("attic")'),5);
  assert.equal(run('roomHostPositions(state.devices.map(d=>d.id)).fixed.xPct'),37.12);
  assert.equal(run('roomHostPositions(state.devices.map(d=>d.id)).fixed.yPct'),63.45);
});
check('opening and closing Wired preserves the visible right edge without moving hosts',()=>{
  reset();
  const viewport={scrollLeft:1200,scrollTop:180,clientWidth:1000,scrollWidth:2600};
  const oldQuery=sandbox.document.querySelector;
  sandbox.document.querySelector=()=>viewport;
  sandbox.testViewport=viewport;
  run(`state.overrides.fixed={room:'attic',pos:{xPct:72.3,yPct:46.8}};
    globalThis.savedRender=render;render=()=>{testViewport.clientWidth=700;};`);
  try {
    run('toggleMapPanel("right",false)');
    assert.equal(viewport.scrollLeft+viewport.clientWidth,2200);
    assert.equal(viewport.scrollTop,180);
    assert.equal(storage.get('noderunner_rightPanel'),'1');
    assert.equal(run('state.overrides.fixed.pos.xPct'),72.3);
    run('render=()=>{testViewport.clientWidth=1000;};toggleMapPanel("right",true)');
    assert.equal(viewport.scrollLeft,1200);
    assert.equal(viewport.scrollTop,180);
    assert.equal(storage.get('noderunner_rightPanel'),'0');
    assert.equal(run('state.overrides.fixed.pos.yPct'),46.8);
  } finally {
    run('render=globalThis.savedRender;delete globalThis.savedRender;');
    sandbox.document.querySelector=oldQuery;delete sandbox.testViewport;
  }
});
check('panel navigation clamps scrolling and preserves the left edge for Wi-Fi',()=>{
  const viewport={scrollLeft:10,scrollTop:30,clientWidth:700,scrollWidth:2600};
  const oldQuery=sandbox.document.querySelector;
  sandbox.document.querySelector=()=>viewport;sandbox.testViewport=viewport;
  run('globalThis.savedRender=render;render=()=>{testViewport.clientWidth=1000;};');
  try {
    run('toggleMapPanel("right",true)');
    assert.equal(viewport.scrollLeft,0);
    viewport.scrollLeft=500;
    run('render=()=>{testViewport.clientWidth=700;};toggleMapPanel("left",false)');
    assert.equal(viewport.scrollLeft,500);
    assert.equal(viewport.scrollTop,30);
    assert.equal(storage.get('noderunner_leftPanel'),'1');
    viewport.scrollLeft=2400;
    run('toggleMapPanel("left",true)');
    assert.equal(viewport.scrollLeft,1900);
  } finally {
    run('render=globalThis.savedRender;delete globalThis.savedRender;');
    sandbox.document.querySelector=oldQuery;delete sandbox.testViewport;
  }
});
check('NodeRunner reads legacy browser settings while new writes take precedence',()=>{
  const saved=new Map(storage);storage.clear();
  try {
    storage.set('hns_theme','light');storage.set('hns_token','legacy-token');
    storage.set('hns_leftPanel','0');storage.set('hns_rightPanel','0');
    storage.set('hns_state_v2',JSON.stringify({overrides:{host:{room:'attic',pos:{xPct:21.5,yPct:47.8}}}}));
    assert.equal(run('readTheme()'),'light');assert.equal(run('getToken()'),'legacy-token');
    assert.equal(run('readBrowserSetting("leftPanel")'),'0');
    assert.equal(run('readBrowserSetting("rightPanel")'),'0');
    assert.equal(run('validateAssignments(JSON.parse(readBrowserSetting("state_v2"))).overrides.host.pos.xPct'),21.5);
    run('setTheme("ion");setToken("new-token");');
    assert.equal(storage.get('noderunner_theme'),'ion');
    assert.equal(run('readTheme()'),'ion');assert.equal(run('getToken()'),'new-token');
    assert.equal(storage.get('hns_token'),'legacy-token');
    run('setToken("")');assert.equal(run('getToken()'),'');
    assert.equal(run('authHeaders()["X-NodeRunner-Token"]'),undefined);
  } finally {storage.clear();for(const [key,value] of saved)storage.set(key,value);}
});
check('NodeRunner API requests use the renamed authentication header',()=>{
  const saved=new Map(storage);
  try {
    run('setToken("test-token")');
    assert.equal(run('authHeaders()["X-NodeRunner-Token"]'),'test-token');
    assert.equal(run('authHeaders()["X-HNS-Token"]'),undefined);
  } finally {storage.clear();for(const [key,value] of saved)storage.set(key,value);}
});
check('missing rooms keep defaults and explicit empty rooms stay empty',()=>{
  assert.ok(run('Object.keys(normalizeConfig({}).rooms).length')>0);
  assert.equal(run('Object.keys(normalizeConfig({rooms:{}}).rooms).length'),0);
});
check('custom backend ports and reverse proxies use the page origin',()=>{
  assert.equal(run('backendBase(location,true)'),'');
  assert.equal(run('API_BASE'),'');
});
check('Apache and file fallbacks preserve protocol and handle IPv6 host syntax',()=>{
  assert.equal(run('backendBase({protocol:"file:"},false)'),'http://localhost:8000');
  assert.equal(run('backendBase({protocol:"https:",href:"https://example.test/app/"},false)'),'https://example.test:8000');
  assert.equal(run('backendBase({protocol:"http:",href:"http://[::1]/"},false)'),'http://[::1]:8000');
});
check('hostname spoofing never inherits another MAC address identity or trust',()=>{
  reset();
  run(`state.baseline=true; state.known.old=1; state.overrides.old={alias:'configured',trusted:true,lastHostname:'same-host',lastIp:'192.168.1.2'};
    detectAnomalies([{id:'02:11:22:33:44:55',mac:'02:11:22:33:44:55',name:'same-host',ip:'192.168.1.3',type:'phone',ports:[]}]);`);
  assert.equal(run('isTrusted("02:11:22:33:44:55")'),false);
  assert.equal(run('state.overrides.old.trusted'),true);
  assert.equal(run('state.known.old'),1);
  assert.ok(run('state.anomalies.some(x=>x.text.includes("verify"))'));
  assert.ok(run('state.anomalies.some(x=>x.text.includes("New host"))'));
});
check('cached scan timestamps never pretend a device was just seen',()=>{
  reset();
  run('state.scanTimestamp=123000; updateRegistryCache([{id:"x",ip:"1.2.3.4",mac:"x",ports:[],name:"host",vendor:"v",type:"unknown"}]);');
  assert.equal(run('state.overrides.x.lastSeen'),123000);
});
check('registry escapes attacker-controlled IPs and device IDs',()=>{
  reset();
  run(`state.known['<img src=x onerror=alert(1)>']=1;
    state.overrides['<img src=x onerror=alert(1)>']={lastIp:'<svg onload=alert(1)>',lastPorts:[]};`);
  const body=run('buildRegistryBody()');
  function html(node) {return node.innerHTML+node.children.map(html).join('');}
  const content=html(body);
  assert.ok(content.includes('&lt;img'));
  assert.ok(content.includes('&lt;svg'));
  assert.ok(!content.includes('<img'));
  assert.ok(!content.includes('<svg onload'));
});
check('unverified gateways are labeled accurately',()=>{
  assert.equal(run('statusTag({id:"gw",status:"unknown"})'),'UNVERIFIED');
});
check('gateway has a readable label while retaining the hostname returned by Nmap',()=>{
  reset();
  const devices=run('normalize({gateway:{ip:"192.0.2.1",hostname:"www.adsl.vf",status:"online",ports:[]},devices:[]})');
  assert.equal(devices[0].name,'Gateway Router');
  assert.equal(devices[0].hostname,'www.adsl.vf');
  sandbox.gatewayDevice=devices[0];
  run('state.overrides.gw={name:"My router"};');
  assert.equal(run('nameOf(gatewayDevice)'),'My router');
});
check('gateway joins the registry and Excel with its real MAC without host anomaly alerts',()=>{
  reset();
  run(`state.source='live';state.baseline=true;state.scanTimestamp=123000;
    state.devices=normalize({gateway:{ip:'192.0.2.1',mac:'00:11:22:33:44:55',hostname:'www.adsl.vf',vendor:'Example',status:'online',ports:[80]},devices:[]});
    detectAnomalies(state.devices);`);
  assert.equal(run('registryRowIds().join(",")'),'gw');
  assert.equal(run('state.overrides.gw.lastHostname'),'www.adsl.vf');
  assert.equal(run('state.overrides.gw.lastSeen'),123000);
  assert.equal(run('registryStatus("gw").key'),'seen');
  assert.equal(run('state.anomalies.length'),0);
  const row=run('registryExportRows()[0]');
  assert.equal(row[3],'www.adsl.vf');
  assert.equal(row[5],'00:11:22:33:44:55');
  assert.equal(row[7],'Router / Gateway');
  assert.equal(row[9],'Gateway');
  const body=run('buildRegistryBody()');
  const conn=findElement(body,node=>node.getAttribute('aria-label')==='Connection type for gw');
  assert.equal(conn.disabled,true);
  assert.equal(conn.children[0].textContent,'Gateway');
  const detected=findElement(body,node=>node.className==='reg-hostname');
  assert.equal(detected.textContent,'Detected: www.adsl.vf');
});
check('an inferred gateway never gains a successful last-seen timestamp',()=>{
  reset();
  run(`state.source='live';state.scanTimestamp=123000;
    state.devices=normalize({gateway:{ip:'192.0.2.1',hostname:'Gateway Router',status:'unknown',ports:[]},devices:[]});
    detectAnomalies(state.devices);`);
  assert.equal(run('registryStatus("gw").key'),'unknown');
  assert.equal(run('state.overrides.gw.lastSeen'),undefined);
  assert.equal(run('registryExportRows()[0][11]'),'');
  run('state.overrides.gw.lastSeen=1000;updateRegistryCache(state.devices);');
  assert.equal(run('state.overrides.gw.lastSeen'),1000);
});
check('gateway row wins duplicate IP entries and remains searchable by detected hostname and MAC',()=>{
  reset();
  run(`state.known={'00:11:22:33:44:55':1,gw:1};state.overrides={
    '00:11:22:33:44:55':{lastIp:'192.0.2.1'},gw:{lastIp:'192.0.2.1',lastMac:'00:11:22:33:44:55',lastHostname:'www.adsl.vf'}};`);
  assert.equal(run('registryRowIds().join(",")'),'gw');
  for(const query of ['gateway','www.adsl.vf','00:11:22:33:44:55']) {
    sandbox.query=query;run('state.registryFilter=query;');
    assert.equal(run('registryRowIds().join(",")'),'gw');
  }
});

(async()=>{
  // Exercise the real scan lifecycle with synthetic results and the shared button.
  for(const registryOpen of [false,true]) {
    reset();sandbox.scanMode=registryOpen;
    let resolveScan,requests=0,forced;
    sandbox.toolbarScanFetch=force=>{++requests;forced=force;return new Promise(resolve=>{resolveScan=resolve;});};
    run(`state.registryOpen=scanMode;state.lastScan=null;
      globalThis.savedRender=render;globalThis.savedFetchDevices=fetchDevices;
      render=()=>renderScanBtn();fetchDevices=toolbarScanFetch;renderScanBtn();`);
    try {
      const scan=elements.get('scanbtn');
      const pending=scan.onclick();
      assert.equal(requests,1);assert.equal(forced,true);
      assert.equal(scan.disabled,true);
      assert.equal(scan.getAttribute('aria-busy'),'true');
      assert.equal(elements.get('scan-label').textContent,'Scanning…');
      await scan.onclick();assert.equal(requests,1);
      run('state.registryOpen=!state.registryOpen;renderRegistry();');
      assert.equal(elements.get('scanbtn'),scan);
      assert.equal(scan.disabled,true);
      resolveScan({list:[],subnet:'192.0.2.0/24',ts:123,portsScanned:true});await pending;
      assert.equal(scan.disabled,false);
      assert.equal(scan.getAttribute('aria-busy'),'false');
      assert.equal(elements.get('scan-label').textContent,'Run scan');
      assert.match(elements.get('lastscan').textContent,/^Last scan:/);
      assert.equal(run('state.registryOpen'),!registryOpen);
    } finally {
      run('render=globalThis.savedRender;fetchDevices=globalThis.savedFetchDevices;delete globalThis.savedRender;delete globalThis.savedFetchDevices;');
      delete sandbox.toolbarScanFetch;delete sandbox.scanMode;
    }
    ++tests;console.log('OK shared toolbar scan works from '+(registryOpen?'Registry':'Map')+' and remains busy across view changes');
  }
  reset();
  run(`globalThis.savedRender=render;globalThis.savedFetchDevices=fetchDevices;
    render=()=>renderScanBtn();fetchDevices=async()=>{throw new Error('offline');};renderScanBtn();`);
  try {
    await elements.get('scanbtn').onclick();
    assert.equal(elements.get('scanbtn').disabled,false);
    assert.equal(elements.get('scan-label').textContent,'Run scan');
    assert.equal(elements.get('lastscan').textContent,'Scan failed · retry');
    assert.equal(run('state.source'),'error');
  } finally {
    run('render=globalThis.savedRender;fetchDevices=globalThis.savedFetchDevices;delete globalThis.savedRender;delete globalThis.savedFetchDevices;');
  }
  ++tests;console.log('OK failed scans restore the shared action and show a retry status');
  let exportedBody;
  sandbox.fetch=async(url,options)=>{exportedBody=JSON.parse(options.body);return{ok:true,blob:async()=>({})};};
  const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
  let filename;
  URL.createObjectURL=()=> 'blob:test';URL.revokeObjectURL=()=>{};
  sandbox.document.body.appendChild=(element)=>{filename=element.download;return element;};
  const button=new Element('button');sandbox.exportButton=button;
  await run('exportRegistryExcel(exportButton)');
  assert.match(filename,/^noderunner-registry-.*\.xlsx$/);
  assert.ok(Array.isArray(exportedBody.rows));assert.equal(button.disabled,false);
  URL.createObjectURL=originalCreate;
  // Restore revoke after its deferred callback so no real browser URL is used.
  setTimeout(()=>{URL.revokeObjectURL=originalRevoke;},1100);
  ++tests;console.log('OK Excel download uses the authenticated endpoint and an xlsx filename');
  let exportError='';sandbox.alert=message=>{exportError=message;};
  sandbox.fetch=async()=>({ok:false,status:404,json:async()=>({})});
  await run('exportRegistryExcel(exportButton)');
  assert.match(exportError,/Restart the updated Python backend/);assert.equal(button.disabled,false);
  ++tests;console.log('OK an old backend produces an actionable export error');
  sandbox.fetch=async()=>({ok:true,json:async()=>({devices:[],gateway:null,ts:123,subnet:'10.0.0.0/24'})});
  const empty=await run('fetchDevices(false)');
  assert.equal(empty.list.length,0);
  ++tests; console.log('OK a successful scan with no devices remains a successful result');
  reset(); run('state.assignmentsLoaded=true;');
  const bodies=[]; const resolvers=[]; let active=0,maxActive=0;
  sandbox.fetch=(url,options)=>{
    bodies.push(JSON.parse(options.body)); ++active; maxActive=Math.max(maxActive,active);
    return new Promise(resolve=>resolvers.push(()=>{--active;resolve({ok:true});}));
  };
  run('state.overrides.x={alias:"first"};saveState();state.overrides.x.alias="second";saveState();state.overrides.x.alias="last";saveState();');
  assert.equal(bodies.length,1);
  resolvers.shift()(); await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(bodies.length,2); assert.equal(bodies[1].overrides.x.alias,'last'); assert.equal(maxActive,1);
  resolvers.shift()(); await new Promise(resolve=>setTimeout(resolve,0));
  ++tests; console.log('OK consecutive edits are serialized and latest changes are saved');
  sandbox.fetch=async()=>({ok:false,status:500});
  run('saveState()'); await new Promise(resolve=>setTimeout(resolve,0));
  assert.match(elements.get('save-status').textContent,/could not be saved/);
  ++tests; console.log('OK failed server saves are visible');
  reset(); let requests=0;sandbox.fetch=async()=>{++requests;return{ok:true}};
  run('saveState()'); await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(requests,0); assert.match(elements.get('save-status').textContent,/only in this browser/);
  ++tests; console.log('OK an unloaded registry cannot overwrite server data');
  console.log(`${tests} frontend checks passed`);
})().catch(error=>{console.error(error);process.exitCode=1;});
