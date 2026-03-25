import {
  KorMap, Marker, InfoWindow, Polyline, Circle, MarkerClusterer,
  MapTypeId, type MapProvider, type LatLng, type KorMapFeature,
} from 'kor-mapi';

// ---------------------------------------------------------------------------
// Seoul landmarks
// ---------------------------------------------------------------------------

const SEOUL: LatLng = { lat: 37.5665, lng: 126.9780 };      // City Hall

// 40 deterministic positions spiralling outward from Seoul center
const CLUSTER_POSITIONS: LatLng[] = (() => {
  const center = SEOUL;
  const count = 40;
  const positions: LatLng[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 * 4;         // 4 spiral loops
    const r = 0.02 + 0.06 * ((i % 10) / 10);             // radius 0.02–0.08°
    positions.push({
      lat: center.lat + r * Math.cos(angle),
      lng: center.lng + r * Math.sin(angle) * 1.3,        // stretch for lng aspect ratio
    });
  }
  return positions;
})();
const LOTTE_TOWER: LatLng = { lat: 37.5125, lng: 127.1025 };
const HAN_RIVER_PATH: LatLng[] = [
  { lat: 37.5326, lng: 126.8344 }, // Haengju Bridge
  { lat: 37.5420, lng: 126.8620 },
  { lat: 37.5283, lng: 126.8896 }, // Yanghwa Bridge
  { lat: 37.5160, lng: 126.9155 },
  { lat: 37.5218, lng: 126.9413 }, // Mapo Bridge
  { lat: 37.5330, lng: 126.9695 },
  { lat: 37.5172, lng: 126.9977 }, // Hangang Bridge
  { lat: 37.5060, lng: 127.0280 },
  { lat: 37.5133, lng: 127.0584 }, // Dongho Bridge
  { lat: 37.5240, lng: 127.0877 },
  { lat: 37.5083, lng: 127.1170 }, // Jamsil Bridge
];

const CAPABILITIES: KorMapFeature[] = [
  'tilt', 'heading', 'mapStyles', 'elevation',
  'streetview', 'trafficLayer', 'heatmap', 'drawing',
];

const CAP_LABELS: Record<KorMapFeature, string> = {
  tilt: 'tilt', heading: 'hdg', mapStyles: 'style', elevation: 'elev',
  streetview: 'sv', trafficLayer: 'traffic', heatmap: 'heat', drawing: 'draw',
  transit: 'transit', adminBoundaries: 'admin',
};

// ---------------------------------------------------------------------------
// API keys from .env
// ---------------------------------------------------------------------------

const KEYS: Record<MapProvider, string | undefined> = {
  naver:  import.meta.env.VITE_NAVER_CLIENT_ID,
  kakao:  import.meta.env.VITE_KAKAO_APP_KEY,
  google: import.meta.env.VITE_GOOGLE_API_KEY,
};


// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const maps: Partial<Record<MapProvider, KorMap>> = {};
const activeMarkers: Marker[] = [];
const activePolylines: Polyline[] = [];
const activeCircles: Circle[] = [];
const activeClusterers: MarkerClusterer[] = [];
let infoWindow: InfoWindow | null = null;
let syncing = false; // guard against camera sync feedback loops
let logCount = 0;

// ---------------------------------------------------------------------------
// Placeholder for missing API keys
// ---------------------------------------------------------------------------

function showPlaceholder(provider: MapProvider, reason: string): void {
  const el = document.getElementById(`map-${provider}`)!;
  const keyVar = provider === 'naver' ? 'VITE_NAVER_CLIENT_ID'
    : provider === 'kakao' ? 'VITE_KAKAO_APP_KEY'
    : 'VITE_GOOGLE_API_KEY';

  el.innerHTML = `
    <div class="map-placeholder">
      <div class="icon">🗺️</div>
      <div class="title">${reason}</div>
      <div class="hint">
        Add <code>${keyVar}</code> to <code>demo/.env</code><br>
        (copy from <code>.env.example</code>)
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Capability badges
// ---------------------------------------------------------------------------

function renderCapabilities(provider: MapProvider, map: KorMap): void {
  const el = document.getElementById(`caps-${provider}`)!;
  el.innerHTML = CAPABILITIES.map(f => {
    const ok = map.supports(f);
    return `<span class="cap-badge ${ok ? 'yes' : 'no'}" title="${f}">${CAP_LABELS[f]}</span>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Event log
// ---------------------------------------------------------------------------

function log(provider: MapProvider, msg: string): void {
  const bar = document.getElementById('log-bar')!;

  // Remove the initial empty hint on first real event
  if (logCount === 0) bar.innerHTML = '';

  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-tag ${provider}">[${provider}]</span><span class="log-msg">${msg}</span>`;
  bar.prepend(entry);

  logCount++;
  // Keep at most 50 entries
  while (bar.children.length > 50) bar.removeChild(bar.lastChild!);
}

// ---------------------------------------------------------------------------
// Camera sync
// ---------------------------------------------------------------------------

function syncCamera(source: MapProvider): void {
  if (syncing) return;
  const sourceMap = maps[source];
  if (!sourceMap) return;

  syncing = true;
  const center = sourceMap.getCenter();
  const zoom = sourceMap.getZoom();

  for (const [provider, map] of Object.entries(maps) as [MapProvider, KorMap][]) {
    if (provider === source) continue;
    map.setCenter(center);
    map.setZoom(zoom);
  }
  syncing = false;
}

// ---------------------------------------------------------------------------
// Initialize a single map
// ---------------------------------------------------------------------------

async function initMap(provider: MapProvider): Promise<KorMap | null> {
  const apiKey = KEYS[provider];
  if (!apiKey) {
    showPlaceholder(provider, 'No API key');
    return null;
  }

  try {
    const map = await KorMap.create({
      provider,
      container: `map-${provider}`,
      apiKey,
      center: SEOUL,
      zoom: 12,
    });

    renderCapabilities(provider, map);

    // Camera sync
    map.on('center_changed', () => syncCamera(provider));
    map.on('zoom_changed', () => syncCamera(provider));

    // Event log listeners
    map.on('click', (e) => {
      const evt = e as { latlng?: LatLng };
      if (evt.latlng) {
        log(provider, `click  ${evt.latlng.lat.toFixed(4)}, ${evt.latlng.lng.toFixed(4)}`);
      }
    });
    map.on('zoom_changed', () => {
      const native = (map.native as { getZoom?: () => number; getLevel?: () => number });
      const nativeZoom = native.getZoom?.() ?? native.getLevel?.();
      const nativeStr = nativeZoom !== undefined ? ` (native ${nativeZoom})` : '';
      log(provider, `zoom → ${map.getZoom().toFixed(2)}${nativeStr}`);
    });
    map.on('idle', () => {
      // log(provider, `idle   center ${map.getCenter().lat.toFixed(4)}, ${map.getCenter().lng.toFixed(4)}`);
    });

    return map;
  } catch (err) {
    console.error(`[${provider}] init failed:`, err);
    showPlaceholder(provider, 'Failed to load');
    return null;
  }
}

// ---------------------------------------------------------------------------
// Toolbar actions — applied to all active maps
// ---------------------------------------------------------------------------

function activeMaps(): [MapProvider, KorMap][] {
  return Object.entries(maps) as [MapProvider, KorMap][];
}

function addMarkers(): void {
  // Clear previous marker set
  for (const m of activeMarkers) m.setMap(null);
  activeMarkers.length = 0;
  if (infoWindow) { infoWindow.close(); infoWindow = null; }

  infoWindow = new InfoWindow({ content: '' });

  for (const [provider, map] of activeMaps()) {
    const marker = new Marker({
      position: SEOUL,
      title: 'Seoul City Hall',
    });
    marker.setMap(map);

    marker.on('click', () => {
      const content = `
        <div style="padding:6px 8px;font-family:sans-serif;font-size:12px;min-width:140px">
          <strong>Seoul City Hall</strong><br>
          <span style="color:#6b7280">Provider: <b style="color:#4f46e5">${provider}</b></span><br>
          <span style="color:#6b7280">${SEOUL.lat}, ${SEOUL.lng}</span>
        </div>
      `;
      infoWindow!.setContent(content);
      infoWindow!.open(map, marker);
      log(provider, 'marker clicked → InfoWindow opened');
    });

    activeMarkers.push(marker);
  }
}

function addPolyline(): void {
  for (const [, map] of activeMaps()) {
    const line = new Polyline({
      path: HAN_RIVER_PATH,
      strokeColor: '#3b82f6',
      strokeWeight: 3,
      strokeOpacity: 0.85,
    });
    line.setMap(map);
    activePolylines.push(line);
  }
}

function addCircle(): void {
  for (const [, map] of activeMaps()) {
    const circle = new Circle({
      center: LOTTE_TOWER,
      radius: 4000,
      strokeColor: '#f59e0b',
      strokeWeight: 2,
      strokeOpacity: 0.9,
      fillColor: '#f59e0b',
      fillOpacity: 0.15,
    });
    circle.setMap(map);
    activeCircles.push(circle);
  }
}

function addCluster(): void {
  for (const c of activeClusterers) {
    for (const m of c.getMarkers()) m.setMap(null);
    c.setMap(null);
  }
  activeClusterers.length = 0;

  for (const [provider, map] of activeMaps()) {
    const markers = CLUSTER_POSITIONS.map(pos => {
      const m = new Marker({ position: pos });
      m.setMap(map);
      return m;
    });

    const clusterer = new MarkerClusterer(map, markers, {
      gridSize: 60,
      minClusterSize: 2,
      maxZoom: 15,
      averageCenter: true,
    });
    activeClusterers.push(clusterer);
    log(provider, `clustering ${markers.length} markers`);
  }
}

function clearAll(): void {
  for (const m of activeMarkers) m.setMap(null);
  for (const p of activePolylines) p.setMap(null);
  for (const c of activeCircles) c.setMap(null);
  for (const c of activeClusterers) {
    for (const m of c.getMarkers()) m.setMap(null);
    c.setMap(null);
  }
  activeMarkers.length = 0;
  activePolylines.length = 0;
  activeCircles.length = 0;
  activeClusterers.length = 0;
  if (infoWindow) { infoWindow.close(); infoWindow = null; }
}

function setMapType(type: MapTypeId): void {
  for (const [, map] of activeMaps()) {
    map.setMapType(type);
  }
}

// ---------------------------------------------------------------------------
// Wire up toolbar
// ---------------------------------------------------------------------------

function bindToolbar(): void {
  document.getElementById('btn-marker')!.addEventListener('click', addMarkers);
  document.getElementById('btn-polyline')!.addEventListener('click', addPolyline);
  document.getElementById('btn-circle')!.addEventListener('click', addCircle);
  document.getElementById('btn-cluster')!.addEventListener('click', addCluster);
  document.getElementById('btn-clear')!.addEventListener('click', clearAll);

  document.getElementById('sel-maptype')!.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value as keyof typeof MapTypeId;
    const type = MapTypeId[val.toUpperCase() as keyof typeof MapTypeId] ?? MapTypeId.ROADMAP;
    setMapType(type);
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  bindToolbar();

  const providers: MapProvider[] = ['naver', 'kakao', 'google'];
  const results = await Promise.allSettled(providers.map(p => initMap(p)));

  for (let i = 0; i < providers.length; i++) {
    const result = results[i]!;
    const provider = providers[i]!;
    if (result.status === 'fulfilled' && result.value) {
      maps[provider] = result.value;
    }
  }

  const count = Object.keys(maps).length;
  if (count === 0) {
    console.warn('[kor-mapi demo] No maps loaded. Add API keys to demo/.env');
  } else {
    console.info(`[kor-mapi demo] ${count}/3 maps loaded. map objects:`, maps);
    console.info('[kor-mapi demo] Access native provider objects via maps.<provider>.native');
  }
}

main();
