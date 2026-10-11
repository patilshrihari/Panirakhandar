/* ==========================================================================
   Panirakhandar - Smart Village Water Management
   app.js : shared data storage, calculations and utility functions.
   Every page loads this file first, then runs its own small script.
   ========================================================================== */
(function (global) {
  'use strict';

  var KEY = 'panirakhandar.v1';
  var ACRES_PER_HA = 2.471054;
  var NOT_ENTERED = 'Data not entered yet';
  var IRRIGATION = ['Drip', 'Sprinkler', 'Furrow', 'Flood'];
  var STAGES = ['Germination / initial', 'Tillering', 'Grand growth', 'Maturity / ripening'];
  var SOILS = [['dry', 'Dry'], ['moderate', 'Moderate'], ['wet', 'Wet']];
  var WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var DEFAULT_CROPS = ['Sugarcane', 'Banana', 'Paddy (rice)', 'Vegetables', 'Fodder', 'Other'];

  /* ---------------------------------------------------------------- storage */
  var memoryStore = null; // used only if the browser blocks localStorage

  function blankStream() {
    return { mode: 'measure', width: null, depth: null, velocity: null, hours: null, days: null,
             capture: null, seasonalVolume: null, entered: false, source: null };
  }
  function blankPond() {
    return { mode: 'capacity', capacity: null, length: null, width: null, depth: null,
             loss: null, reserve: null, entered: false, source: null };
  }
  function blankCrops() {
    var c = {};
    DEFAULT_CROPS.forEach(function (n) { c[n] = { perHaDay: null, source: null }; });
    return c;
  }
  function defaultRules() {
    return {
      rainThresholdMm: 25,                                   // weekly rain at/above which irrigation is skipped
      soilFactor: { dry: 1, moderate: 0.6, wet: 0 },          // wet soil is always skipped
      stageFactor: { 'Germination / initial': 0.6, 'Tillering': 0.8, 'Grand growth': 1, 'Maturity / ripening': 0.5 },
      turnsPerWeek: { Drip: 4, Sprinkler: 3, Furrow: 2, Flood: 2 },
      morning: { start: 5, end: 9 },
      evening: { start: 17, end: 21 }
    };
  }
  function emptyData() {
    return {
      version: 1,
      planningDays: null,
      stream: { monsoon: blankStream(), summer: blankStream() },
      crops: blankCrops(),
      farmers: [],
      ponds: blankPond(),
      planner: { available: null, reserve: null, source: null },
      rules: defaultRules()
    };
  }
  function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  function deepMerge(base, over) {
    Object.keys(over || {}).forEach(function (k) {
      if (isObj(base[k]) && isObj(over[k])) deepMerge(base[k], over[k]);
      else base[k] = over[k];
    });
    return base;
  }
  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return emptyData();
      return deepMerge(emptyData(), JSON.parse(raw));
    } catch (e) {
      if (memoryStore) return deepMerge(emptyData(), JSON.parse(memoryStore));
      return emptyData();
    }
  }
  function save(d) {
    var txt = JSON.stringify(d);
    try { global.localStorage.setItem(KEY, txt); }
    catch (e) {
      memoryStore = txt;
      toast('Your browser blocked saving. Data will be lost when you leave this page. Try Chrome/Edge or run a local server (see README).', 'err');
    }
  }
  function clearAll() {
    memoryStore = null;
    try { global.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------------- helpers */
  function num(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string') { v = v.trim(); if (v === '') return null; }
    var n = Number(v);
    return isFinite(n) ? n : null;
  }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid(p) { return p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function fmt(n, dec) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return Number(n).toLocaleString('en-IN', { maximumFractionDigits: dec === undefined ? 0 : dec });
  }
  function hhmm(x) {
    var h = Math.floor(x + 1e-9), m = Math.round((x - h) * 60);
    if (m === 60) { h += 1; m = 0; }
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  function badge(src) {
    if (src === 'demo') return '<span class="badge demo" title="Example data, not real measurements">Demo</span>';
    if (src === 'user') return '<span class="badge user" title="Entered by you">Yours</span>';
    return '';
  }
  function farmName(fr, f) {
    var i = fr.farms.indexOf(f);
    return f.label ? f.label : 'Farm ' + (i + 1);
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function toast(msg, type) {
    var box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    var t = document.createElement('div');
    t.className = 'toast ' + (type || 'ok');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(function () { t.classList.add('hide'); }, 3600);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4200);
  }
  function renderErrors(el, list) {
    if (!el) return;
    if (!list || !list.length) { el.innerHTML = ''; el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<strong>Please fix the following:</strong><ul>' +
      list.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>';
  }

  /* ----------------------------------------------------------- stream maths */
  // Validation works on raw numeric input (null = missing).
  function validateStream(i) {
    var e = [];
    function pos(v, label) { if (v === null) e.push(label + ' is required.'); else if (v <= 0) e.push(label + ' must be greater than 0.'); }
    if (i.mode === 'volume') {
      pos(i.seasonalVolume, 'Total seasonal water volume (m³)');
    } else {
      pos(i.width, 'Stream width (m)');
      pos(i.depth, 'Average water depth (m)');
      pos(i.velocity, 'Average flow velocity (m/s)');
      if (i.hours === null) e.push('Flowing hours per day is required.');
      else if (i.hours <= 0 || i.hours > 24) e.push('Flowing hours per day must be above 0 and at most 24.');
      if (i.days === null) e.push('Number of days is required.');
      else if (i.days < 1 || Math.floor(i.days) !== i.days) e.push('Number of days must be a whole number of 1 or more.');
      else if (i.days > 366) e.push('Number of days cannot be more than 366.');
    }
    if (i.capture === null) e.push('Capture percentage is required.');
    else if (i.capture <= 0 || i.capture > 100) e.push('Capture percentage must be above 0 and at most 100.');
    return e;
  }
  function calcStream(s) {
    if (!s || !s.entered) return null;
    var cap = num(s.capture), flow = null, vol;
    if (cap === null) return null;
    if (s.mode === 'volume') {
      vol = num(s.seasonalVolume);
      if (vol === null) return null;
    } else {
      var w = num(s.width), d = num(s.depth), v = num(s.velocity), h = num(s.hours), n = num(s.days);
      if ([w, d, v, h, n].some(function (x) { return x === null; })) return null;
      flow = w * d * v;                 // m³/s
      vol = flow * h * 3600 * n;        // m³
    }
    return { mode: s.mode, flow: flow, volume: vol, capture: cap, capturable: vol * cap / 100 };
  }

  /* --------------------------------------------------------- farmer maths */
  function farmHa(f) {
    var a = num(f.area) || 0;
    return f.unit === 'acre' ? a / ACRES_PER_HA : a;
  }
  function farmerTotals(fr) {
    var ha = 0, daily = 0;
    fr.farms.forEach(function (f) { ha += farmHa(f); daily += num(f.daily) || 0; });
    return { farms: fr.farms.length, ha: ha, acres: ha * ACRES_PER_HA, daily: daily };
  }
  function totals(d) {
    var t = { farmers: d.farmers.length, farms: 0, ha: 0, acres: 0, daily: 0 };
    d.farmers.forEach(function (fr) {
      var x = farmerTotals(fr);
      t.farms += x.farms; t.ha += x.ha; t.daily += x.daily;
    });
    t.acres = t.ha * ACRES_PER_HA;
    return t;
  }
  function seasonalDemand(d) {
    var days = num(d.planningDays), t = totals(d);
    if (!days || days <= 0 || t.farms === 0 || t.daily <= 0) return null;
    return t.daily * days;            // m³
  }
  function validateFarm(i, crops) {
    var e = [];
    if (!i.farmerId) e.push('Choose a farmer for this farm.');
    if (i.area === null) e.push('Farm area is required.');
    else if (i.area <= 0) e.push('Farm area must be greater than 0.');
    if (i.unit !== 'acre' && i.unit !== 'ha') e.push('Choose acres or hectares.');
    if (!i.crop) e.push('Choose a crop.');
    if (!i.irrigation) e.push('Choose an irrigation method.');
    if (i.daily === null) e.push('Daily water requirement (m³/day) is required. Enter your own estimate or use the crop assumption button.');
    else if (i.daily <= 0) e.push('Daily water requirement must be greater than 0.');
    return e;
  }

  /* ----------------------------------------------------------- pond maths */
  function pondCapacity(p) {
    if (p.mode === 'dimensions') {
      var L = num(p.length), W = num(p.width), D = num(p.depth);
      return (L > 0 && W > 0 && D > 0) ? L * W * D : null;
    }
    var c = num(p.capacity);
    return c > 0 ? c : null;
  }
  function validatePond(i) {
    var e = [];
    if (i.mode === 'dimensions') {
      if (!(i.length > 0)) e.push('Pond length (m) must be greater than 0.');
      if (!(i.width > 0)) e.push('Pond width (m) must be greater than 0.');
      if (!(i.depth > 0)) e.push('Usable water depth (m) must be greater than 0.');
    } else if (!(i.capacity > 0)) e.push('Nominal pond capacity (m³) must be greater than 0.');
    if (i.loss === null) e.push('Storage loss percentage is required (enter 0 if you assume no loss).');
    else if (i.loss < 0 || i.loss >= 100) e.push('Storage loss must be 0 or more and less than 100%.');
    if (i.reserve === null) e.push('Reserve percentage is required (enter 0 for none).');
    else if (i.reserve < 0 || i.reserve > 100) e.push('Reserve must be between 0 and 100%.');
    return e;
  }
  function calcPonds(d) {
    var missing = [], p = d.ponds;
    var mon = calcStream(d.stream.monsoon), D = seasonalDemand(d), C = p.entered ? pondCapacity(p) : null;
    if (!mon) missing.push({ text: 'Monsoon capturable water (Stream Water page)', href: 'stream.html' });
    if (D === null) missing.push({ text: 'Seasonal irrigation demand (Farmers page, including planning days)', href: 'farmers.html' });
    if (!p.entered || C === null || num(p.loss) === null || num(p.reserve) === null) missing.push({ text: 'Pond capacity, loss % and reserve % (this page)', href: 'ponds.html' });
    if (missing.length) return { ok: false, missing: missing, demand: D, capturable: mon ? mon.capturable : null };

    var L = num(p.loss) / 100, R = num(p.reserve) / 100;
    var reserveVol = D * R;
    var requiredWithReserve = D + reserveVol;               // usable water that must reach the fields
    var target = requiredWithReserve / (1 - L);              // water that must enter ponds so losses are covered
    var usablePer = C * (1 - L);
    var count = Math.max(1, Math.ceil(target / C - 1e-9));
    var totalNominal = count * C;
    var totalUsable = totalNominal * (1 - L);
    var A = mon.capturable;
    var filled = Math.min(A, totalNominal);                  // ponds cannot hold more than their size
    var deliverable = filled * (1 - L);
    var balance = A - target;                                // >0 surplus, <0 shortage (in capturable-water terms)
    return {
      ok: true, demand: D, reserveVol: reserveVol, requiredWithReserve: requiredWithReserve,
      target: target, nominalPer: C, usablePer: usablePer, count: count,
      totalNominal: totalNominal, totalUsable: totalUsable, capturable: A,
      deliverable: deliverable, balance: balance, shortfall: balance < 0 ? -balance : 0,
      surplus: balance > 0 ? balance : 0, loss: num(p.loss), reserve: num(p.reserve),
      coverage: Math.min(1, deliverable / requiredWithReserve),
      fillableCount: Math.max(1, Math.ceil(Math.min(A, target) / C - 1e-9))
    };
  }

  /* ------------------------------------------------------ allocation maths */
  function calcAllocation(d) {
    var pl = d.planner, days = num(d.planningDays), avail = num(pl.available), res = num(pl.reserve);
    var missing = [];
    if (!d.farmers.length || !days) missing.push({ text: 'Registered farms and planning days (Farmers page)', href: 'farmers.html' });
    if (avail === null || res === null) missing.push({ text: 'Summer water volume and reserve % (this page)', href: 'planner.html' });
    if (missing.length) return { ok: false, missing: missing };
    var rows = d.farmers.map(function (fr) {
      return { id: fr.id, name: fr.name, source: fr.source, daily: farmerTotals(fr).daily, demand: farmerTotals(fr).daily * days };
    });
    var totalDemand = rows.reduce(function (a, r) { return a + r.demand; }, 0);
    if (totalDemand <= 0) return { ok: false, missing: [{ text: 'Farms with a daily water requirement (Farmers page)', href: 'farmers.html' }] };
    var reserved = avail * res / 100, allocatable = avail - reserved;
    rows.forEach(function (r) {
      var share = allocatable * (r.demand / totalDemand);
      r.allocation = Math.min(r.demand, share);              // never give a farmer more than they need
    });
    var sum = rows.reduce(function (a, r) { return a + r.allocation; }, 0);
    if (sum > allocatable) { var k = allocatable / sum; rows.forEach(function (r) { r.allocation *= k; }); sum = allocatable; }
    rows.forEach(function (r) {
      r.unmet = Math.max(0, r.demand - r.allocation);
      r.share = allocatable > 0 ? r.allocation / allocatable : 0;
      r.metPct = r.demand > 0 ? r.allocation / r.demand : 0;
    });
    var unmet = rows.reduce(function (a, r) { return a + r.unmet; }, 0);
    return { ok: true, rows: rows, available: avail, reservePct: res, reserved: reserved, allocatable: allocatable,
             totalDemand: totalDemand, totalAllocated: sum, unmet: unmet, unallocated: Math.max(0, allocatable - sum),
             days: days };
  }

  /* --------------------------------------------------- irrigation schedule */
  function generateSchedule(d, alloc) {
    var R = d.rules, days = num(d.planningDays), weeks = days / 7;
    var windows = { morning: R.morning, evening: R.evening };
    var loads = WEEKDAYS.map(function () { return { morning: 0, evening: 0 }; });
    var grid = WEEKDAYS.map(function () { return { morning: [], evening: [] }; });
    var out = [], idx = 0;

    alloc.rows.forEach(function (row) {
      var fr = d.farmers.find(function (x) { return x.id === row.id; });
      if (!fr) return;
      var fdaily = farmerTotals(fr).daily;
      fr.farms.forEach(function (f) {
        var farmDaily = num(f.daily) || 0;
        var farmAlloc = fdaily > 0 ? row.allocation * farmDaily / fdaily : 0;
        var weeklyAlloc = farmAlloc / weeks, weeklyDemand = farmDaily * 7;
        var o = { farmerName: fr.name, farmLabel: farmName(fr, f), farm: f, weeklyAlloc: weeklyAlloc, weeklyDemand: weeklyDemand,
                  planned: 0, turns: 0, perTurn: 0, status: 'skip', note: '', placements: [] };
        var hours = num(f.hours), rain = num(f.rain) || 0;
        var soilF = f.soil === 'wet' ? 0 : (R.soilFactor[f.soil] !== undefined ? R.soilFactor[f.soil] : 1);
        var stageF = R.stageFactor[f.stage] !== undefined ? R.stageFactor[f.stage] : 1;

        if (f.soil === 'wet') { o.note = 'Soil is wet: irrigation not recommended this week.'; }
        else if (rain >= R.rainThresholdMm) { o.note = 'Expected rain (' + fmt(rain, 1) + ' mm) meets the rain threshold: skip irrigation.'; }
        else if (weeklyAlloc <= 0) { o.note = 'No water allocated to this farm.'; }
        else if (!(hours > 0)) { o.status = 'incomplete'; o.note = 'Enter preferred irrigation hours per turn to schedule this farm.'; }
        else {
          var rainCredit = Math.min(1, rain / R.rainThresholdMm);
          var target = weeklyDemand * soilF * stageF * (1 - rainCredit);
          var planned = Math.min(target, weeklyAlloc);
          if (planned <= 0) { o.note = 'Soil, growth stage and rain assumptions leave no irrigation need.'; }
          else {
            var turns = Math.max(1, Math.min(7, R.turnsPerWeek[f.irrigation] || 2));
            o.status = 'ok'; o.planned = planned; o.turns = turns; o.perTurn = planned / turns;
            if (planned < target - 1e-9) o.note = 'Limited by water allocation (need ' + fmt(target, 0) + ' m³/week).';
            var slot = f.slot === 'morning' || f.slot === 'evening' ? f.slot : (idx % 2 === 0 ? 'morning' : 'evening');
            var win = windows[slot], winLen = win.end - win.start, used = [];
            var offset = idx % 7;
            for (var t = 0; t < turns; t++) {
              var ideal = (offset + Math.round(t * 7 / turns)) % 7;
              var order = [];
              for (var k = 0; k < 7; k++) if (used.indexOf(k) === -1) order.push(k);
              order.sort(function (a, b) {
                var da = Math.min((a - ideal + 7) % 7, (ideal - a + 7) % 7), db = Math.min((b - ideal + 7) % 7, (ideal - b + 7) % 7);
                return da - db;
              });
              var pick = null;
              for (var j = 0; j < order.length; j++) { if (loads[order[j]][slot] + hours <= winLen + 1e-9) { pick = order[j]; break; } }
              if (pick === null) {
                pick = order.slice().sort(function (a, b) { return loads[a][slot] - loads[b][slot]; })[0];
              }
              used.push(pick);
              var start = win.start + loads[pick][slot], end = start + hours;
              loads[pick][slot] += hours;
              var entry = { day: pick, slot: slot, start: start, end: end, farmerName: fr.name, farmLabel: o.farmLabel,
                            volume: o.perTurn, overflow: end > win.end + 1e-9 };
              grid[pick][slot].push(entry);
              o.placements.push(entry);
            }
            if (o.placements.some(function (p) { return p.overflow; })) {
              o.note = (o.note ? o.note + ' ' : '') + 'Some turns run past the ' + slot + ' window: shorten hours or reduce clashes.';
            }
          }
        }
        out.push(o);
        idx++;
      });
    });
    grid.forEach(function (g) { ['morning', 'evening'].forEach(function (s) { g[s].sort(function (a, b) { return a.start - b.start; }); }); });
    return { farms: out, grid: grid, rules: R };
  }

  /* ------------------------------------------------------------ summary */
  function summary(d) {
    var mon = calcStream(d.stream.monsoon), sum = calcStream(d.stream.summer), t = totals(d);
    var alloc = calcAllocation(d);
    return { monsoon: mon, summer: sum, totals: t, demand: seasonalDemand(d), planningDays: num(d.planningDays),
             pond: calcPonds(d), alloc: alloc };
  }

  /* -------------------------------------------------------- demo / reset */
  function demoData() {
    var d = emptyData();
    d.planningDays = 120;
    d.stream.monsoon = { mode: 'measure', width: 3.5, depth: 0.35, velocity: 0.3, hours: 10, days: 60,
                         capture: 10, seasonalVolume: null, entered: true, source: 'demo' };
    d.stream.summer = { mode: 'measure', width: 1.2, depth: 0.08, velocity: 0.1, hours: 8, days: 60,
                        capture: 30, seasonalVolume: null, entered: true, source: 'demo' };
    d.crops.Sugarcane = { perHaDay: 70, source: 'demo' };
    d.crops.Vegetables = { perHaDay: 45, source: 'demo' };
    function farm(label, area, unit, crop, irr, daily, stage, soil, rain, hours, slot) {
      return { id: uid('farm'), label: label, area: area, unit: unit, crop: crop, irrigation: irr, daily: daily,
               stage: stage, soil: soil, rain: rain, hours: hours, slot: slot, source: 'demo' };
    }
    d.farmers = [
      { id: uid('fr'), name: 'Demo – Patil (F-01)', source: 'demo', farms: [
        farm('Upper plot', 2.5, 'acre', 'Sugarcane', 'Drip', 70, 'Grand growth', 'dry', 0, 3, 'morning'),
        farm('Nala-side plot', 1.5, 'acre', 'Sugarcane', 'Furrow', 48, 'Tillering', 'dry', 0, 4, 'morning') ] },
      { id: uid('fr'), name: 'Demo – Jadhav (F-02)', source: 'demo', farms: [
        farm('Main field', 3, 'acre', 'Sugarcane', 'Furrow', 85, 'Grand growth', 'dry', 0, 4, 'evening'),
        farm('Vegetable patch', 1, 'acre', 'Vegetables', 'Drip', 22, 'Tillering', 'moderate', 30, 2, 'any') ] },
      { id: uid('fr'), name: 'Demo – More (F-03)', source: 'demo', farms: [
        farm('Hill-slope field', 2, 'ha', 'Sugarcane', 'Sprinkler', 140, 'Grand growth', 'dry', 5, 2, 'evening') ] },
      { id: uid('fr'), name: 'Demo – Shinde (F-04)', source: 'demo', farms: [
        farm('Big field', 4, 'acre', 'Sugarcane', 'Flood', 120, 'Maturity / ripening', 'moderate', 0, 4, 'evening') ] },
      { id: uid('fr'), name: 'Demo – Kamble (F-05)', source: 'demo', farms: [
        farm('Low field', 1.2, 'ha', 'Sugarcane', 'Drip', 80, 'Germination / initial', 'wet', 0, 3, 'morning') ] }
    ];
    d.ponds = { mode: 'capacity', capacity: 10000, length: null, width: null, depth: null, loss: 15, reserve: 10, entered: true, source: 'demo' };
    d.planner = { available: 60000, reserve: 10, source: 'demo' };
    return d;
  }
  function hasDemo(d) {
    return d.stream.monsoon.source === 'demo' || d.stream.summer.source === 'demo' || d.ponds.source === 'demo' ||
      d.planner.source === 'demo' || d.farmers.some(function (fr) { return fr.source === 'demo' || fr.farms.some(function (f) { return f.source === 'demo'; }); }) ||
      Object.keys(d.crops).some(function (k) { return d.crops[k].source === 'demo'; });
  }
  function hasUser(d) {
    return d.stream.monsoon.source === 'user' || d.stream.summer.source === 'user' || d.ponds.source === 'user' ||
      d.planner.source === 'user' || d.farmers.some(function (fr) { return fr.source === 'user' || fr.farms.some(function (f) { return f.source === 'user'; }); }) ||
      Object.keys(d.crops).some(function (k) { return d.crops[k].source === 'user'; }) || num(d.planningDays) !== null && !hasDemo(d);
  }
  function loadDemo() {
    var d = load();
    if (hasUser(d) || d.farmers.length) {
      if (!global.confirm('Loading demonstration data will REPLACE all the data currently saved in this browser. Continue?')) return;
    }
    save(demoData());
    global.location.reload();
  }
  function resetAll() {
    if (!global.confirm('Delete ALL saved data (demo and your own) from this browser and start empty? This cannot be undone.')) return;
    clearAll();
    global.location.reload();
  }

  /* ----------------------------------------------------- shared page shell */
  var PAGES = [
    ['dashboard', 'index.html', 'Dashboard', '🏠'],
    ['stream', 'stream.html', 'Stream Water', '🌊'],
    ['farmers', 'farmers.html', 'Farmers & Demand', '🌾'],
    ['ponds', 'ponds.html', 'Pond Planning', '💧'],
    ['planner', 'planner.html', 'Summer Planner', '📅']
  ];
  var LOGO = '<svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1fb5ad"/><stop offset="1" stop-color="#1b6ca8"/></linearGradient></defs><path d="M24 3C17 13 9 21 9 30a15 15 0 0 0 30 0c0-9-8-17-15-27z" fill="url(#lg)"/><path d="M14 33c4-3 7 3 10 0s6-3 10 0" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M24 40V26m0 4c-4-1-6-4-6-7 4 0 6 3 6 7zm0-2c4-1 6-3 6-6-4 0-6 2-6 6z" stroke="#c9f2c7" stroke-width="1.6" fill="#7bc47f" /></svg>';

  function renderShell(active) {
    var d = load();
    var nav = PAGES.map(function (p) {
      return '<a href="' + p[1] + '" class="nav-link' + (p[0] === active ? ' active' : '') + '"' +
        (p[0] === active ? ' aria-current="page"' : '') + '><span aria-hidden="true">' + p[3] + '</span> ' + p[2] + '</a>';
    }).join('');
    var banner = '';
    var dm = hasDemo(d), us = hasUser(d);
    if (dm && !us) banner = '<div class="demo-banner">🧪 <strong>Demonstration data is loaded.</strong> These are made-up example values, not real measurements. Use “Reset data” to start with your own.</div>';
    else if (dm && us) banner = '<div class="demo-banner mixed">⚠️ <strong>This browser holds demonstration data mixed with your own entries.</strong> Look for the <span class="badge demo">Demo</span> and <span class="badge user">Yours</span> labels.</div>';
    var h = document.getElementById('app-header');
    if (h) h.innerHTML =
      '<header class="site-header"><div class="container header-in">' +
      '<a class="brand" href="index.html">' + LOGO + '<span class="brand-text"><strong>Panirakhandar</strong><small>Smart Village Water Management</small></span></a>' +
      '<button class="nav-toggle" id="navToggle" aria-label="Toggle menu" aria-expanded="false">☰</button>' +
      '<nav class="main-nav" id="mainNav" aria-label="Main">' + nav + '</nav>' +
      '<div class="data-tools"><button class="btn btn-sm btn-ghost" id="btnDemo" type="button">Load demo data</button>' +
      '<button class="btn btn-sm btn-ghost danger" id="btnReset" type="button">Reset data</button></div>' +
      '</div></header>' + banner;
    var f = document.getElementById('app-footer');
    if (f) f.innerHTML =
      '<footer class="site-footer"><div class="container"><strong>Panirakhandar</strong> · Save Water Today. Sustain Farms Tomorrow.' +
      '<p>A planning aid, not an engineering design. All figures are estimates from the values you enter. Real ponds and water sharing need local engineering, safety, environmental and legal checks, and agreement of the village community. Data is stored only in this browser.</p></div></footer>';
    var tg = document.getElementById('navToggle');
    if (tg) tg.addEventListener('click', function () {
      var open = document.getElementById('mainNav').classList.toggle('open');
      tg.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    var bd = document.getElementById('btnDemo'), br = document.getElementById('btnReset');
    if (bd) bd.addEventListener('click', loadDemo);
    if (br) br.addEventListener('click', resetAll);
  }

  global.Pan = {
    NOT_ENTERED: NOT_ENTERED, IRRIGATION: IRRIGATION, STAGES: STAGES, SOILS: SOILS, WEEKDAYS: WEEKDAYS,
    ACRES_PER_HA: ACRES_PER_HA, DEFAULT_CROPS: DEFAULT_CROPS,
    load: load, save: save, emptyData: emptyData, demoData: demoData, hasDemo: hasDemo, hasUser: hasUser,
    loadDemo: loadDemo, resetAll: resetAll,
    num: num, esc: esc, uid: uid, fmt: fmt, hhmm: hhmm, badge: badge, farmName: farmName, $: $, $$: $$, ready: ready,
    toast: toast, renderErrors: renderErrors, renderShell: renderShell,
    validateStream: validateStream, calcStream: calcStream,
    farmHa: farmHa, farmerTotals: farmerTotals, totals: totals, seasonalDemand: seasonalDemand, validateFarm: validateFarm,
    pondCapacity: pondCapacity, validatePond: validatePond, calcPonds: calcPonds,
    calcAllocation: calcAllocation, generateSchedule: generateSchedule, summary: summary
  };
})(window);
