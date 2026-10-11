/* ==========================================================================
   Panirakhandar - Village Water Map (Leaflet 1.9.4 + OpenStreetMap)
   map.js : used only by index.html. Does not touch the water calculations.

   - Demonstration markers are FAKE example points (clearly labelled DEMO).
   - Markers you add are saved in this browser under its own localStorage key,
     separate from the main Panirakhandar data.
   ========================================================================== */
(function () {
  'use strict';

  var STORE_KEY = 'panirakhandar.map.v1';
  var MAX_MARKERS = 200;

  var TYPES = {
    nala:     { label: 'Nala observation point', css: 'nala' },
    pond:     { label: 'Existing pond',          css: 'pond' },
    proposed: { label: 'Proposed pond',          css: 'proposed' },
    farm:     { label: 'Farm',                   css: 'farm' }
  };

  /* DEMONSTRATION ONLY - invented points around an arbitrary example spot.
     They are NOT the real location of any village, nala, pond or farm.
     Replace them with your own points using the form, or edit this list. */
  var DEMO_MARKERS = [
    { id: 'demo-1', type: 'nala',     name: 'Demo Nala Point A', lat: 16.7050, lng: 74.2400, notes: 'DEMO: pretend upstream measuring point.' },
    { id: 'demo-2', type: 'nala',     name: 'Demo Nala Point B', lat: 16.7020, lng: 74.2455, notes: 'DEMO: pretend downstream measuring point.' },
    { id: 'demo-3', type: 'pond',     name: 'Demo Existing Pond', lat: 16.6990, lng: 74.2380, notes: 'DEMO: example of an existing pond.' },
    { id: 'demo-4', type: 'proposed', name: 'Demo Proposed Pond 1', lat: 16.7075, lng: 74.2470, notes: 'DEMO: example site for a new pond.' },
    { id: 'demo-5', type: 'proposed', name: 'Demo Proposed Pond 2', lat: 16.6960, lng: 74.2440, notes: 'DEMO: example site for a new pond.' },
    { id: 'demo-6', type: 'farm',     name: 'Demo Farm 1', lat: 16.7010, lng: 74.2350, notes: 'DEMO: example sugarcane farm.' },
    { id: 'demo-7', type: 'farm',     name: 'Demo Farm 2', lat: 16.6975, lng: 74.2500, notes: 'DEMO: example sugarcane farm.' }
  ];
  var DEMO_CENTER = [16.7010, 74.2420];

  /* ------------------------------------------------------------ helpers */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;      // textContent = safe, no HTML injection
    return n;
  }

  /* ------------------------------------------------------------ storage */
  var memory = null;  // fallback if the browser blocks localStorage

  function readStore() {
    var raw = null;
    try { raw = window.localStorage.getItem(STORE_KEY); } catch (e) { return memory || { markers: [], showDemo: true }; }
    if (!raw) return { markers: [], showDemo: true };
    try {
      var p = JSON.parse(raw), out = { markers: [], showDemo: p.showDemo !== false };
      (Array.isArray(p.markers) ? p.markers : []).forEach(function (m) {
        // re-check every saved item so damaged data can never break the page
        if (m && TYPES[m.type] && typeof m.name === 'string' &&
            typeof m.lat === 'number' && typeof m.lng === 'number' &&
            isFinite(m.lat) && isFinite(m.lng) &&
            m.lat >= -90 && m.lat <= 90 && m.lng >= -180 && m.lng <= 180) {
          out.markers.push({ id: String(m.id || ('u-' + Date.now() + out.markers.length)), type: m.type,
            name: m.name.slice(0, 60), lat: m.lat, lng: m.lng, notes: String(m.notes || '').slice(0, 300) });
        }
      });
      return out;
    } catch (e) { return { markers: [], showDemo: true }; }
  }
  function writeStore() {
    memory = state;
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); return true; }
    catch (e) { return false; }
  }

  /* ------------------------------------------------------------ validation */
  /* Returns {value} or {error}. Rejects empty text, letters, "12abc", NaN, Infinity. */
  function parseCoord(text, name, min, max) {
    var s = String(text).trim();
    if (s === '') return { error: name + ' is required.' };
    if (s.indexOf(',') !== -1) return { error: name + ' must use a dot, not a comma (example: 16.7010).' };
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return { error: name + ' must be a plain number such as 16.7010 (no letters or degree signs).' };
    var v = Number(s);
    if (!isFinite(v)) return { error: name + ' is not a valid number.' };
    if (v < min || v > max) return { error: name + ' must be between ' + min + ' and ' + max + '.' };
    return { value: v };
  }

  /* ------------------------------------------------------------ state */
  var state = readStore();
  var map, demoLayer, userLayer, userMarkers = {};

  /* ------------------------------------------------------------ map */
  function makeIcon(type, isDemo) {
    return L.divIcon({
      className: '',                                   // no default white box
      html: '<div class="pin ' + TYPES[type].css + (isDemo ? ' demo' : '') + '"></div>',
      iconSize: [22, 22], iconAnchor: [11, 22], popupAnchor: [0, -22]
    });
  }

  function popupContent(m, isDemo) {
    var box = el('div', 'map-popup');
    box.appendChild(el('p', 'pt', m.name));
    box.appendChild(el('p', 'pk', TYPES[m.type].label + (isDemo ? ' (DEMO)' : '')));
    box.appendChild(el('p', 'pn', m.notes ? m.notes : 'No notes.'));
    box.appendChild(el('p', 'pc', m.lat.toFixed(5) + ', ' + m.lng.toFixed(5)));
    if (!isDemo) {
      var b = el('button', 'btn danger btn-sm', 'Remove marker');
      b.type = 'button';
      b.addEventListener('click', function () { removeMarker(m.id); });
      box.appendChild(b);
    }
    return box;
  }

  function addToLayer(m, layer, isDemo) {
    var mk = L.marker([m.lat, m.lng], { icon: makeIcon(m.type, isDemo), title: m.name, alt: TYPES[m.type].label + ': ' + m.name });
    mk.bindPopup(popupContent(m, isDemo));
    mk.addTo(layer);
    return mk;
  }

  function redraw() {
    userLayer.clearLayers();
    userMarkers = {};
    state.markers.forEach(function (m) { userMarkers[m.id] = addToLayer(m, userLayer, false); });
    if (state.showDemo) { if (!map.hasLayer(demoLayer)) map.addLayer(demoLayer); }
    else if (map.hasLayer(demoLayer)) map.removeLayer(demoLayer);
    renderList();
    renderLegend();
  }

  function renderLegend() {
    var counts = {};
    Object.keys(TYPES).forEach(function (k) { counts[k] = 0; });
    state.markers.forEach(function (m) { counts[m.type]++; });
    if (state.showDemo) DEMO_MARKERS.forEach(function (m) { counts[m.type]++; });
    var box = $('mapLegend');
    box.innerHTML = '';
    Object.keys(TYPES).forEach(function (k) {
      var s = el('span');
      s.appendChild(el('i', 'map-dot ' + TYPES[k].css));
      s.appendChild(document.createTextNode(TYPES[k].label + ' (' + counts[k] + ')'));
      box.appendChild(s);
    });
  }

  function renderList() {
    var wrap = $('mapUserList'), n = state.markers.length;
    $('mapClearBtn').disabled = n === 0;
    wrap.innerHTML = '';
    if (!n) { wrap.appendChild(el('p', 'muted small', 'You have not added any markers yet. Demo markers are examples only.')); return; }
    var scroll = el('div', 'map-table-wrap'), t = el('table', 'map-table'), head = el('tr');
    ['Type', 'Name', 'Latitude, Longitude', ''].forEach(function (h) { head.appendChild(el('th', '', h)); });
    var thead = el('thead'); thead.appendChild(head); t.appendChild(thead);
    var tb = el('tbody');
    state.markers.forEach(function (m) {
      var r = el('tr');
      r.appendChild(el('td', '', TYPES[m.type].label));
      r.appendChild(el('td', '', m.name));
      r.appendChild(el('td', '', m.lat.toFixed(5) + ', ' + m.lng.toFixed(5)));
      var act = el('td');
      var show = el('button', 'btn outline btn-sm', 'Show'); show.type = 'button';
      show.addEventListener('click', function () { map.setView([m.lat, m.lng], Math.max(map.getZoom(), 15)); if (userMarkers[m.id]) userMarkers[m.id].openPopup(); });
      var del = el('button', 'btn danger btn-sm', 'Remove'); del.type = 'button';
      del.style.marginLeft = '.4rem';
      del.setAttribute('aria-label', 'Remove marker ' + m.name);
      del.addEventListener('click', function () { removeMarker(m.id); });
      act.appendChild(show); act.appendChild(del); r.appendChild(act);
      tb.appendChild(r);
    });
    t.appendChild(tb); scroll.appendChild(t); wrap.appendChild(scroll);
  }

  /* ------------------------------------------------------------ actions */
  function message(kind, text) {
    var box = $('mapMsg');
    box.className = 'alert ' + kind;
    box.textContent = text;
    box.hidden = !text;
  }

  function removeMarker(id) {
    var before = state.markers.length;
    state.markers = state.markers.filter(function (m) { return m.id !== id; });
    if (state.markers.length === before) return;
    map.closePopup();
    var ok = writeStore();
    redraw();
    message(ok ? 'ok' : 'warn', ok ? 'Marker removed.' : 'Marker removed, but this browser would not save the change.');
  }

  function fieldError(id, text) {
    $(id + 'Err').textContent = text || '';
    var inp = $(id);
    if (text) { inp.classList.add('invalid'); inp.setAttribute('aria-invalid', 'true'); }
    else { inp.classList.remove('invalid'); inp.removeAttribute('aria-invalid'); }
  }

  function onSubmit(e) {
    e.preventDefault();
    var type = $('mmType').value, name = $('mmName').value.trim(), notes = $('mmNotes').value.trim();
    var lat = parseCoord($('mmLat').value, 'Latitude', -90, 90);
    var lng = parseCoord($('mmLng').value, 'Longitude', -180, 180);
    var bad = false;

    fieldError('mmType', TYPES[type] ? '' : 'Please choose a marker type.');
    fieldError('mmName', name ? (name.length > 60 ? 'Name must be 60 characters or fewer.' : '') : 'Name is required.');
    fieldError('mmLat', lat.error || '');
    fieldError('mmLng', lng.error || '');
    if (notes.length > 300) { $('mmNotesErr').textContent = 'Notes must be 300 characters or fewer.'; bad = true; } else $('mmNotesErr').textContent = '';
    if (!TYPES[type] || !name || name.length > 60 || lat.error || lng.error) bad = true;
    if (bad) { message('err', 'Marker not added. Please fix the highlighted fields.'); return; }
    if (state.markers.length >= MAX_MARKERS) { message('err', 'You can store at most ' + MAX_MARKERS + ' markers. Remove some first.'); return; }

    var m = { id: 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
              type: type, name: name, lat: lat.value, lng: lng.value, notes: notes };
    state.markers.push(m);
    var ok = writeStore();
    redraw();
    map.setView([m.lat, m.lng], Math.max(map.getZoom(), 15));
    userMarkers[m.id].openPopup();
    $('mmName').value = ''; $('mmNotes').value = '';
    message(ok ? 'ok' : 'warn', ok ? 'Marker added and saved in this browser.' :
      'Marker added, but this browser is blocking storage, so it will disappear when you refresh.');
  }

  function onMapClick(e) {
    var p = e.latlng.wrap();                  // keeps longitude within -180..180
    $('mmLat').value = p.lat.toFixed(5);
    $('mmLng').value = p.lng.toFixed(5);
    fieldError('mmLat', ''); fieldError('mmLng', '');
    message('info', 'Coordinates copied from the map. Choose a type, enter a name and press “Add marker”.');
  }

  /* ------------------------------------------------------------ start up */
  function init() {
    var mapEl = $('villageMap');
    if (!mapEl) return;                       // not the dashboard
    if (typeof L === 'undefined') {           // Leaflet did not load (offline / blocked CDN)
      mapEl.innerHTML = '<div class="empty">The map library could not be loaded. Check your internet connection and refresh the page. The rest of Panirakhandar still works.</div>';
      return;
    }

    map = L.map(mapEl, { scrollWheelZoom: false }).setView(DEMO_CENTER, 14);   // wheel zoom off so page scrolling is not hijacked
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    demoLayer = L.layerGroup();
    DEMO_MARKERS.forEach(function (m) { addToLayer(m, demoLayer, true); });
    userLayer = L.layerGroup().addTo(map);

    $('mapDemoToggle').checked = state.showDemo;
    $('mapDemoToggle').addEventListener('change', function () { state.showDemo = this.checked; writeStore(); redraw(); });
    $('mapForm').addEventListener('submit', onSubmit);
    $('mapForm').addEventListener('reset', function () {
      ['mmType', 'mmName', 'mmLat', 'mmLng'].forEach(function (id) { fieldError(id, ''); });
      $('mmNotesErr').textContent = ''; message('', '');
    });
    $('mapClearBtn').addEventListener('click', function () {
      if (!state.markers.length) return;
      if (!window.confirm('Remove all ' + state.markers.length + ' markers you added? Demo markers are not affected.')) return;
      state.markers = []; writeStore(); redraw(); message('ok', 'All your markers were removed.');
    });
    map.on('click', onMapClick);

    // If the map was created while hidden (zero size), or the window/layout changes,
    // tell Leaflet to re-measure itself so tiles and markers display correctly.
    if (window.ResizeObserver) new ResizeObserver(function () { map.invalidateSize(); }).observe(mapEl);
    window.addEventListener('resize', function () { map.invalidateSize(); });
    window.addEventListener('load', function () { map.invalidateSize(); });
    var det = mapEl.closest('details');
    if (det) det.addEventListener('toggle', function () { if (det.open) setTimeout(function () { map.invalidateSize(); }, 50); });

    redraw();
    if (!window.localStorage || !(function () { try { window.localStorage.setItem('_t', '1'); window.localStorage.removeItem('_t'); return true; } catch (e) { return false; } })()) {
      message('warn', 'This browser is blocking local storage, so markers you add will not be kept after refreshing.');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
