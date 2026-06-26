/* =====================================================================
   StructCalc — map-module.js
   Responsibility: Leaflet satellite map for Wind workspace Site tab.
   Public API:
     initWindMap(containerId)         — create/resize map in container
     windMapGeocodeAndPlace(query)    — address → geocode → pin + data
     windMapSetLocation(lat, lng)     — GPS coords → pin + data
   Data flow:
     Nominatim → lat/lng → Open-Meteo elevation → fill form fields
     V stays manual (ASCE Hazard Tool requires registered API key)
   ===================================================================== */

var _wMap        = null;   // Leaflet map instance
var _wMarker     = null;   // current marker
var _wMapInited  = false;  // one-time init guard

/* ── Inject Leaflet CSS (once) ──────────────────────────────────────── */
function _ensureLeafletCSS() {
  if (document.getElementById('leaflet-css')) return;
  var link = document.createElement('link');
  link.id   = 'leaflet-css';
  link.rel  = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}

/* ── Init / resize map ──────────────────────────────────────────────── */
function initWindMap(containerId) {
  _ensureLeafletCSS();
  if (_wMapInited && _wMap) {
    _wMap.invalidateSize();
    return;
  }
  if (typeof L === 'undefined') { console.warn('Leaflet not loaded'); return; }
  var el = document.getElementById(containerId);
  if (!el) return;

  _wMap = L.map(containerId, {
    center: [39.5, -98.35],   // geographic center of CONUS
    zoom: 4,
    zoomControl: true,
    attributionControl: true,
  });

  /* Satellite base (ESRI World Imagery — free, no key) */
  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ', maxZoom: 19 }
  ).addTo(_wMap);

  /* Labels overlay (ESRI Reference — keeps city/street names visible) */
  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    { attribution: '', maxZoom: 19, opacity: 0.85, pane: 'overlayPane' }
  ).addTo(_wMap);

  /* Click on map → place marker + fetch site data */
  _wMap.on('click', function(e) {
    _placePin(e.latlng.lat, e.latlng.lng);
    _fetchAndFill(e.latlng.lat, e.latlng.lng, null);
  });

  _wMapInited = true;
}

/* ── Custom pin marker ──────────────────────────────────────────────── */
function _makeIcon() {
  return L.divIcon({
    className: 'wind-map-pin-wrap',
    html: '<div class="wind-map-pin"></div>',
    iconSize:   [22, 30],
    iconAnchor: [11, 30],
    popupAnchor:[0, -32],
  });
}

function _placePin(lat, lng) {
  if (!_wMap) return;
  if (_wMarker) _wMap.removeLayer(_wMarker);
  _wMarker = L.marker([lat, lng], { icon: _makeIcon() }).addTo(_wMap);
  /* Update hidden lat/lng fields */
  _setField('wind-lat', lat.toFixed(6));
  _setField('wind-lng', lng.toFixed(6));
}

/* ── Geocode address string (Nominatim / OSM) ───────────────────────── */
async function _geocode(query) {
  var url = 'https://nominatim.openstreetmap.org/search?q=' +
    encodeURIComponent(query) + '&format=json&limit=1&addressdetails=1';
  var resp = await fetch(url, {
    headers: { 'Accept-Language': 'en-US,en', 'User-Agent': 'StructCalc/1.0' }
  });
  var data = await resp.json();
  if (!data || !data.length) return null;
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name || '',
  };
}

/* ── Fetch elevation (Open-Meteo, free, no key) ─────────────────────── */
async function _fetchElevation(lat, lng) {
  var url = 'https://api.open-meteo.com/v1/elevation?latitude=' + lat + '&longitude=' + lng;
  var resp = await fetch(url);
  var data = await resp.json();
  if (data && data.elevation && data.elevation.length) {
    return data.elevation[0]; // metres
  }
  return null;
}

/* ── Fill form + popup ───────────────────────────────────────────────── */
async function _fetchAndFill(lat, lng, displayName) {
  var resEl = document.getElementById('wind-addr-result');
  _setResult(resEl, 'loading', 'Fetching site data…');

  var elevM  = null;
  var elevFt = null;
  try {
    elevM  = await _fetchElevation(lat, lng);
    elevFt = (elevM != null) ? Math.round(elevM * 3.28084) : null;
  } catch(e) { /* elevation optional */ }

  /* Auto-fill ground elevation → triggers Ke recalc */
  if (elevFt != null) {
    var gndEl = document.getElementById('wind-groundElev');
    if (gndEl) {
      gndEl.value = elevFt;
      gndEl.dispatchEvent(new Event('input'));
    }
  }

  /* Build popup HTML */
  var addr = displayName ? _shortAddr(displayName) : ('Lat ' + lat.toFixed(4) + ',  Lng ' + lng.toFixed(4));
  var lines = [
    '<strong>' + _esc(addr) + '</strong>',
    'Lat ' + lat.toFixed(5) + '&nbsp;&nbsp;Lng ' + lng.toFixed(5),
  ];
  if (elevFt != null) lines.push('Elevation: <strong>' + elevFt + ' ft</strong> (' + Math.round(elevM) + ' m)');
  lines.push('<span class="popup-hint">V — enter from ASCE Hazard Tool</span>');

  var popupHTML = '<div class="wind-map-popup">' + lines.join('<br>') + '</div>';
  if (_wMarker) _wMarker.bindPopup(popupHTML).openPopup();

  /* Status bar under address input */
  var parts = [addr];
  if (elevFt != null) parts.push(elevFt + ' ft elev.');
  _setResult(resEl, 'ok', parts.join('  ·  '));
}

/* ── Public: geocode address string → pin + data ────────────────────── */
async function windMapGeocodeAndPlace(query) {
  query = (query || '').trim();
  if (!query) return;
  var resEl = document.getElementById('wind-addr-result');
  _setResult(resEl, 'loading', 'Searching…');

  var geo;
  try { geo = await _geocode(query); } catch(e) { geo = null; }

  if (!geo) { _setResult(resEl, 'error', 'Address not found'); return; }

  /* Save coords */
  _setField('wind-lat', geo.lat.toFixed(6));
  _setField('wind-lng', geo.lng.toFixed(6));

  /* Pan + pin */
  if (_wMap) {
    _wMap.setView([geo.lat, geo.lng], 14, { animate: true });
    _placePin(geo.lat, geo.lng);
  }

  await _fetchAndFill(geo.lat, geo.lng, geo.displayName);
}

/* ── Public: set location from GPS coords ───────────────────────────── */
async function windMapSetLocation(lat, lng) {
  _setField('wind-lat', lat.toFixed(6));
  _setField('wind-lng', lng.toFixed(6));
  if (_wMap) {
    _wMap.setView([lat, lng], 14, { animate: true });
    _placePin(lat, lng);
  }
  await _fetchAndFill(lat, lng, null);
}

/* ── Public: reset map view to CONUS ───────────────────────────────── */
function windMapReset() {
  if (_wMap) _wMap.setView([39.5, -98.35], 4);
}

/* ── Utilities ──────────────────────────────────────────────────────── */
function _setField(id, val) {
  var el = document.getElementById(id);
  if (el) el.value = val;
}

function _setResult(el, cls, msg) {
  if (!el) return;
  el.className = 'addr-result' + (cls ? ' ' + cls : '');
  el.textContent = msg;
}

function _shortAddr(full) {
  /* "57 47th St, Brooklyn, New York, ..." → "57 47th St, Brooklyn, NY" */
  var parts = full.split(',').map(function(p){ return p.trim(); });
  return parts.slice(0, 3).join(', ');
}

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
