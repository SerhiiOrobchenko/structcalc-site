/* =====================================================================
   StructCalc — map-module.js  v2
   Leaflet satellite map for Wind workspace Site tab.
   Public API:
     initWindMap(containerId)
     windMapGeocodeAndPlace(query)   — address string → pin + data
     windMapSetLocation(lat, lng)    — GPS → pin + data
     windMapReset()                  — pan to CONUS center
     windMapCenter()                 — center on current marker
     windMapSwitchView(mode)         — 'satellite' | 'map'
   ===================================================================== */

var _wMap         = null;
var _wMarker      = null;
var _wMapInited   = false;
var _wSatLayer    = null;
var _wOsmLayer    = null;
var _wLabelLayer  = null;
var _wCurrentMode = 'satellite';
var _wSuggestTimer = null;
var _wLastQuery    = '';

/* ── Inject Leaflet CSS once ─────────────────────────────────────────── */
function _ensureLeafletCSS() {
  if (document.getElementById('leaflet-css')) return;
  var link   = document.createElement('link');
  link.id    = 'leaflet-css';
  link.rel   = 'stylesheet';
  link.href  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}

/* ── Init / resize map ───────────────────────────────────────────────── */
function initWindMap(containerId) {
  _ensureLeafletCSS();
  if (_wMapInited && _wMap) { _wMap.invalidateSize(); return; }
  if (typeof L === 'undefined') { console.warn('Leaflet not loaded'); return; }
  var el = document.getElementById(containerId);
  if (!el) return;

  _wMap = L.map(containerId, {
    center: [39.5, -98.35], zoom: 4,
    zoomControl: true, attributionControl: true,
  });

  /* Satellite (ESRI World Imagery) */
  _wSatLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Tiles &copy; Esri', maxZoom: 19 }
  );
  /* OSM base map */
  _wOsmLayer = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }
  );
  /* Label overlay (keeps city/street names on satellite) */
  _wLabelLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    { attribution: '', maxZoom: 19, opacity: 0.85 }
  );

  _wSatLayer.addTo(_wMap);
  _wLabelLayer.addTo(_wMap);
  _wCurrentMode = 'satellite';

  /* Click → place marker */
  _wMap.on('click', function(e) {
    _placePin(e.latlng.lat, e.latlng.lng);
    _fetchAndFill(e.latlng.lat, e.latlng.lng, null);
  });

  _wMapInited = true;

  /* Wire autocomplete for address input */
  _wireAutocomplete();
}

/* ── Google-style red pin ────────────────────────────────────────────── */
function _makeIcon() {
  return L.divIcon({
    className: 'wind-map-pin-wrap',
    html: '<div class="wind-map-pin"></div>',
    iconSize:    [44, 58],
    iconAnchor:  [22, 58],
    popupAnchor: [0, -62],
  });
}

function _placePin(lat, lng) {
  if (!_wMap) return;
  if (_wMarker) _wMap.removeLayer(_wMarker);
  _wMarker = L.marker([lat, lng], { icon: _makeIcon() }).addTo(_wMap);
  _setField('wind-lat', lat.toFixed(6));
  _setField('wind-lng', lng.toFixed(6));
  /* Show Center Location button */
  var cb = document.getElementById('windBtnCenter');
  if (cb) cb.classList.remove('hidden');
}

/* ── Format address like Google Maps ─────────────────────────────────── */
/* e.g. "57 47th St, Brooklyn, NY 11232, USA"                            */
function _formatAddress(item) {
  var a = item.address || {};
  var parts = [];

  /* House number + street */
  var road = a.road || a.pedestrian || a.path || a.footway || a.street || '';
  var num  = a.house_number || '';
  if (num && road)  parts.push(num + ' ' + road);
  else if (road)    parts.push(road);

  /* City / town / neighbourhood */
  var city = a.city || a.town || a.village || a.hamlet
           || a.suburb || a.neighbourhood || a.county || '';
  if (city) parts.push(city);

  /* State abbreviation */
  var stateAbbr = '';
  if (a['ISO3166-2-lvl4']) stateAbbr = a['ISO3166-2-lvl4'].split('-').pop();
  else if (a.state_code)   stateAbbr = a.state_code;
  else if (a.state)        stateAbbr = a.state;   /* fallback full name */

  var postcode = a.postcode || '';
  if (stateAbbr && postcode) parts.push(stateAbbr + ' ' + postcode);
  else if (stateAbbr)        parts.push(stateAbbr);
  else if (postcode)         parts.push(postcode);

  /* Country code */
  var cc = (a.country_code || '').toUpperCase();
  if (cc) parts.push(cc);

  return parts.length >= 2 ? parts.join(', ')
    : (item.display_name || '').split(',').slice(0, 3).join(',').trim();
}

/* ── Geocode (Nominatim) ─────────────────────────────────────────────── */
async function _geocode(query, limit) {
  limit = limit || 1;
  var url = 'https://nominatim.openstreetmap.org/search?q='
    + encodeURIComponent(query)
    + '&format=json&limit=' + limit + '&addressdetails=1';
  var resp = await fetch(url, { headers: { 'Accept-Language': 'en-US,en' } });
  return await resp.json();
}

/* ── Fetch elevation (Open-Meteo, free, no key) ──────────────────────── */
async function _fetchElevation(lat, lng) {
  try {
    var resp = await fetch(
      'https://api.open-meteo.com/v1/elevation?latitude=' + lat + '&longitude=' + lng
    );
    var d = await resp.json();
    if (d && d.elevation && d.elevation.length) return d.elevation[0];
  } catch(e) {}
  return null;
}

/* ── Fill fields + open popup ────────────────────────────────────────── */
async function _fetchAndFill(lat, lng, formattedAddr) {
  var resEl = document.getElementById('wind-addr-result');
  _setResult(resEl, 'loading', 'Fetching site data…');

  var elevM  = null;
  var elevFt = null;
  try {
    elevM  = await _fetchElevation(lat, lng);
    elevFt = (elevM != null) ? Math.round(elevM * 3.28084) : null;
  } catch(e) {}

  /* Auto-fill ground elevation → triggers K_e recalc */
  if (elevFt != null) {
    var gndEl = document.getElementById('wind-groundElev');
    if (gndEl) { gndEl.value = elevFt; gndEl.dispatchEvent(new Event('input')); }
  }

  /* Build popup */
  var addrLine = formattedAddr || ('Lat ' + lat.toFixed(4) + ', Lng ' + lng.toFixed(4));
  var lines = ['<strong>' + _esc(addrLine) + '</strong>',
               'Lat ' + lat.toFixed(5) + '  Lng ' + lng.toFixed(5)];
  if (elevFt != null) lines.push('Elevation: <strong>' + elevFt + ' ft</strong> (' + Math.round(elevM) + ' m)');
  lines.push('<span class="popup-hint">Enter V from ASCE Hazard Tool</span>');

  if (_wMarker) {
    _wMarker.bindPopup('<div class="wind-map-popup">' + lines.join('<br>') + '</div>')
            .openPopup();
  }

  /* Status bar */
  var statusParts = [addrLine];
  if (elevFt != null) statusParts.push(elevFt + ' ft elev.');
  _setResult(resEl, 'ok', statusParts.join('  ·  '));
}

/* ── Autocomplete wiring ─────────────────────────────────────────────── */
function _wireAutocomplete() {
  var inp  = document.getElementById('wind-address');
  var list = document.getElementById('wind-addr-suggestions');
  if (!inp || !list) return;

  inp.addEventListener('input', function() {
    var q = inp.value.trim();
    clearTimeout(_wSuggestTimer);
    if (q.length < 3) { _hideSuggestions(); return; }
    if (q === _wLastQuery) return;
    _wSuggestTimer = setTimeout(async function() {
      _wLastQuery = q;
      var items;
      try { items = await _geocode(q, 5); } catch(e) { return; }
      _showSuggestions(items, inp, list);
    }, 300);
  });

  /* Hide dropdown on outside click */
  document.addEventListener('click', function(e) {
    if (!inp.contains(e.target) && !list.contains(e.target)) _hideSuggestions();
  });

  /* Keyboard nav */
  inp.addEventListener('keydown', function(e) {
    var items = list.querySelectorAll('.addr-suggestion-item');
    var active = list.querySelector('.addr-suggestion-item.focused');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      var next = active ? active.nextElementSibling : items[0];
      if (next) { if (active) active.classList.remove('focused'); next.classList.add('focused'); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      var prev = active ? active.previousElementSibling : items[items.length - 1];
      if (prev) { if (active) active.classList.remove('focused'); prev.classList.add('focused'); }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      var foc = list.querySelector('.addr-suggestion-item.focused');
      if (foc) { foc.click(); }
      else { windMapGeocodeAndPlace(inp.value.trim()); _hideSuggestions(); }
    } else if (e.key === 'Escape') {
      _hideSuggestions();
    }
  });
}

function _showSuggestions(items, inp, list) {
  if (!items || !items.length) { _hideSuggestions(); return; }
  list.innerHTML = '';
  items.forEach(function(item) {
    var addr = _formatAddress(item);
    var div  = document.createElement('div');
    div.className   = 'addr-suggestion-item';
    div.textContent = addr;
    div.addEventListener('mousedown', function(e) {
      e.preventDefault();           /* prevent input blur */
      inp.value = addr;
      _hideSuggestions();
      _wLastQuery = addr;
      _setField('wind-lat', parseFloat(item.lat).toFixed(6));
      _setField('wind-lng', parseFloat(item.lon).toFixed(6));
      if (_wMap) {
        _wMap.setView([parseFloat(item.lat), parseFloat(item.lon)], 15, { animate: true });
        _placePin(parseFloat(item.lat), parseFloat(item.lon));
      }
      _fetchAndFill(parseFloat(item.lat), parseFloat(item.lon), addr);
    });
    list.appendChild(div);
  });
  list.classList.remove('hidden');
}

function _hideSuggestions() {
  var list = document.getElementById('wind-addr-suggestions');
  if (list) { list.classList.add('hidden'); list.innerHTML = ''; }
}

/* ── Public: geocode + place from address string ──────────────────────── */
async function windMapGeocodeAndPlace(query) {
  query = (query || '').trim();
  if (!query) return;
  var resEl = document.getElementById('wind-addr-result');
  _setResult(resEl, 'loading', 'Searching…');
  _hideSuggestions();

  var items;
  try { items = await _geocode(query, 1); } catch(e) { items = []; }
  if (!items || !items.length) {
    _setResult(resEl, 'error', 'Address not found'); return;
  }
  var item = items[0];
  var lat  = parseFloat(item.lat);
  var lng  = parseFloat(item.lon);
  var addr = _formatAddress(item);

  /* Save formatted address to input */
  var inp = document.getElementById('wind-address');
  if (inp) inp.value = addr;
  _wLastQuery = addr;

  _setField('wind-lat', lat.toFixed(6));
  _setField('wind-lng', lng.toFixed(6));

  if (_wMap) {
    _wMap.setView([lat, lng], 15, { animate: true });
    _placePin(lat, lng);
  }
  await _fetchAndFill(lat, lng, addr);
}

/* ── Public: GPS location ─────────────────────────────────────────────── */
async function windMapSetLocation(lat, lng) {
  _setField('wind-lat', lat.toFixed(6));
  _setField('wind-lng', lng.toFixed(6));
  if (_wMap) {
    _wMap.setView([lat, lng], 15, { animate: true });
    _placePin(lat, lng);
  }
  /* Reverse geocode for address string */
  try {
    var url  = 'https://nominatim.openstreetmap.org/reverse?lat=' + lat
             + '&lon=' + lng + '&format=json&addressdetails=1';
    var resp = await fetch(url, { headers: { 'Accept-Language': 'en-US,en' } });
    var item = await resp.json();
    var addr = _formatAddress(item);
    var inp  = document.getElementById('wind-address');
    if (inp && addr) inp.value = addr;
    await _fetchAndFill(lat, lng, addr);
  } catch(e) {
    await _fetchAndFill(lat, lng, null);
  }
}

/* ── Public: center map on marker ────────────────────────────────────── */
function windMapCenter() {
  if (_wMap && _wMarker) {
    _wMap.setView(_wMarker.getLatLng(), Math.max(_wMap.getZoom(), 14), { animate: true });
  }
}

/* ── Public: reset map to CONUS ──────────────────────────────────────── */
function windMapReset() {
  if (_wMap) _wMap.setView([39.5, -98.35], 4);
}

/* ── Public: switch map view ──────────────────────────────────────────── */
function windMapSwitchView(mode) {
  if (!_wMap) return;
  if (mode === 'satellite') {
    if (_wOsmLayer) _wMap.removeLayer(_wOsmLayer);
    if (_wSatLayer) _wSatLayer.addTo(_wMap);
    if (_wLabelLayer) _wLabelLayer.addTo(_wMap);
  } else {
    if (_wSatLayer)   _wMap.removeLayer(_wSatLayer);
    if (_wLabelLayer) _wMap.removeLayer(_wLabelLayer);
    if (_wOsmLayer)   _wOsmLayer.addTo(_wMap);
  }
  _wCurrentMode = mode;
  /* Update toggle button states */
  document.querySelectorAll('#windMapViewToggle .map-view-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.view === mode);
  });
}

/* ── Utilities ───────────────────────────────────────────────────────── */
function _setField(id, val) {
  var el = document.getElementById(id); if (el) el.value = val;
}
function _setResult(el, cls, msg) {
  if (!el) return;
  el.className  = 'addr-result' + (cls ? ' ' + cls : '');
  el.textContent = msg;
}
function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
