import type { KorMap } from '../../core/KorMap.js';
import type { NativeOverlayHandle } from '../../providers/base/IMapProvider.js';
import type { ClusterOptions, ClusterStyle, EventListener, LatLng, LatLngBounds } from '../../core/types.js';
import { Marker } from '../../core/overlays.js';

// ---------------------------------------------------------------------------
// Default tier styles (small / medium / large by cluster count)
// ---------------------------------------------------------------------------

const DEFAULT_STYLES: [ClusterStyle, ClusterStyle, ClusterStyle] = [
  { width: 36, height: 36, textColor: '#ffffff', textSize: 12, backgroundColor: '#3b82f6' },
  { width: 44, height: 44, textColor: '#ffffff', textSize: 13, backgroundColor: '#f59e0b' },
  { width: 52, height: 52, textColor: '#ffffff', textSize: 14, backgroundColor: '#ef4444' },
];

const DEFAULTS = {
  minClusterSize: 2,
  maxZoom: 15,
  gridSize: 60,
  averageCenter: false,
} as const;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ClusterData {
  handle: NativeOverlayHandle;
  markers: Marker[];
}

interface ResolvedOptions {
  minClusterSize: number;
  maxZoom: number;
  gridSize: number;
  styles: ClusterStyle[];
  averageCenter: boolean;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Convert a LatLng to a Mercator world pixel coordinate at the given zoom level.
 *
 * Uses the standard Web Mercator (EPSG:3857) formula: at zoom Z the world is
 * 256×2^Z pixels wide. This is provider-agnostic and gives consistent grid
 * cell assignments regardless of whether the adapter's getProjection() is a
 * stub or a full implementation.
 */
export function toWorldPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = 256 * Math.pow(2, zoom);
  const x = (lng + 180) / 360 * scale;
  const siny = Math.min(Math.max(Math.sin(lat * Math.PI / 180), -0.9999), 0.9999);
  const y = (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)) * scale;
  return { x, y };
}

/** Compute the LatLngBounds that tightly contains all given positions. */
export function toBounds(positions: LatLng[]): LatLngBounds {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of positions) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return {
    sw: { lat: minLat, lng: minLng },
    ne: { lat: maxLat, lng: maxLng },
  };
}

/** Pick a style tier based on cluster size. Falls back through tiers gracefully. */
export function pickStyle(count: number, styles: ClusterStyle[]): ClusterStyle {
  const s0 = styles[0];
  const s1 = styles[1];
  const s2 = styles[2];
  if (count < 10) return s0 ?? DEFAULT_STYLES[0];
  if (count < 100) return s1 ?? s0 ?? DEFAULT_STYLES[1];
  return s2 ?? s1 ?? s0 ?? DEFAULT_STYLES[2];
}

/** Assign a pixel coordinate to a grid cell key. */
export function cellKey(px: number, py: number, gridSize: number): string {
  return `${Math.floor(px / gridSize)},${Math.floor(py / gridSize)}`;
}

/** Compute the centroid of an array of LatLng positions. */
export function centroid(positions: LatLng[]): LatLng {
  if (positions.length === 0) return { lat: 0, lng: 0 };
  const lat = positions.reduce((s, p) => s + p.lat, 0) / positions.length;
  const lng = positions.reduce((s, p) => s + p.lng, 0) / positions.length;
  return { lat, lng };
}

function createClusterElement(count: number, style: ClusterStyle): HTMLElement {
  const el = document.createElement('div');
  const w = style.width;
  const h = style.height;
  const bg = style.backgroundColor ?? DEFAULT_STYLES[0].backgroundColor ?? '#3b82f6';
  const color = style.textColor ?? '#ffffff';
  const fontSize = style.textSize ?? 13;

  // transform centers the element on the anchor point (position LatLng)
  el.style.cssText = [
    `width:${w}px`,
    `height:${h}px`,
    `line-height:${h}px`,
    `border-radius:50%`,
    `text-align:center`,
    `cursor:pointer`,
    `font-weight:bold`,
    `box-shadow:0 2px 6px rgba(0,0,0,.3)`,
    `transform:translate(-50%,-50%)`,
    `color:${color}`,
    `font-size:${fontSize}px`,
    style.url
      ? `background:url(${style.url}) center/cover`
      : `background-color:${bg}`,
  ].join(';');

  el.textContent = String(count);
  return el;
}

// ---------------------------------------------------------------------------
// MarkerClusterer
// ---------------------------------------------------------------------------

/**
 * Grid-based marker clusterer that works across all three providers.
 *
 * Clusters are rendered as `CustomOverlay` div elements so no external
 * dependencies or provider-specific clustering plugins are needed.
 *
 * On each `idle` event the visible viewport is re-gridded using a self-contained
 * Web Mercator projection (provider-agnostic). Markers whose world-pixel
 * coordinates fall in the same `gridSize×gridSize` cell are collapsed into a
 * single cluster badge. Clicking a cluster badge calls `fitBounds()` over its
 * markers so the map zooms in to reveal them.
 */
export class MarkerClusterer {
  private currentMap: KorMap | null;
  private readonly _markers: Marker[] = [];
  private readonly _clusters: ClusterData[] = [];
  private idleListener: EventListener | null = null;
  private readonly opts: ResolvedOptions;

  constructor(map: KorMap, markers: Marker[] = [], options: ClusterOptions = {}) {
    this.currentMap = map;
    this.opts = {
      ...DEFAULTS,
      ...options,
      styles: options.styles ?? DEFAULT_STYLES,
    };

    this._bind(map);

    for (const m of markers) {
      this._markers.push(m);
      if (m.getMap() !== map) m.setMap(map);
    }

    this._redraw();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  addMarker(marker: Marker, redraw = true): void {
    if (this._register(marker) && redraw) this._redraw();
  }

  addMarkers(markers: Marker[]): void {
    for (const m of markers) this._register(m);
    this._redraw();
  }

  removeMarker(marker: Marker, redraw = true): boolean {
    const idx = this._markers.indexOf(marker);
    if (idx === -1) return false;
    this._markers.splice(idx, 1);
    marker.setVisible(true); // restore before returning ownership to caller
    if (redraw) this._redraw();
    return true;
  }

  clearMarkers(): void {
    this._clearClusters();
    for (const m of this._markers) m.setVisible(true);
    this._markers.length = 0;
  }

  setMap(map: KorMap | null): void {
    if (this.currentMap && this.idleListener) {
      this.currentMap.off('idle', this.idleListener);
      this.idleListener = null;
    }
    this._clearClusters();
    if (map === null) {
      for (const m of this._markers) m.setVisible(true);
    }
    this.currentMap = map;
    if (map) {
      this._bind(map);
      this._redraw();
    }
  }

  getMarkers(): Marker[] {
    return [...this._markers];
  }

  getTotalMarkers(): number {
    return this._markers.length;
  }

  /** Force a full re-cluster pass. Call after programmatic map changes if needed. */
  redraw(): void {
    this._redraw();
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private _register(marker: Marker): boolean {
    if (this._markers.includes(marker)) return false;
    this._markers.push(marker);
    if (this.currentMap && marker.getMap() !== this.currentMap) {
      marker.setMap(this.currentMap);
    }
    return true;
  }

  private _bind(map: KorMap): void {
    if (this.idleListener) return; // already bound to this map
    this.idleListener = map.on('idle', () => { this._redraw(); });
  }

  private _redraw(): void {
    const map = this.currentMap;
    if (!map) return;

    this._clearClusters();

    const zoom = map.getZoom();
    if (zoom > this.opts.maxZoom) {
      for (const m of this._markers) m.setVisible(true);
      return;
    }

    // Hide all managed markers; we'll selectively re-show unclustered ones below.
    for (const m of this._markers) {
      if (m.getMap()) m.setVisible(false);
    }

    const cells = new Map<string, Marker[]>();

    for (const marker of this._markers) {
      if (!marker.getMap()) continue;
      const { lat, lng } = marker.getPosition();
      // Use self-contained Mercator world pixels — provider-agnostic and
      // consistent regardless of adapter getProjection() implementation.
      const pt = toWorldPixel(lat, lng, zoom);
      const key = cellKey(pt.x, pt.y, this.opts.gridSize);
      const existing = cells.get(key);
      if (existing !== undefined) {
        existing.push(marker);
      } else {
        cells.set(key, [marker]);
      }
    }

    for (const group of cells.values()) {
      if (group.length >= this.opts.minClusterSize) {
        this._addClusterOverlay(map, group);
      } else {
        for (const m of group) m.setVisible(true);
      }
    }
  }

  private _addClusterOverlay(map: KorMap, group: Marker[]): void {
    const positions = group.map(m => m.getPosition());
    const firstPos = positions[0];
    const center = this.opts.averageCenter
      ? centroid(positions)
      : (firstPos ?? { lat: 0, lng: 0 });

    const style = pickStyle(group.length, this.opts.styles);
    const el = createClusterElement(group.length, style);

    // Click expands the cluster by fitting the map to its markers' bounds.
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const bounds = toBounds(positions);
      // If all markers are at the same point, just zoom past maxZoom instead.
      if (bounds.sw.lat === bounds.ne.lat && bounds.sw.lng === bounds.ne.lng) {
        map.setCenter(bounds.sw);
        map.setZoom(this.opts.maxZoom + 1);
      } else {
        map.fitBounds(bounds, { padding: 60 });
      }
    });

    const handle = map._adapter().addCustomOverlay({
      position: center,
      content: el,
      zIndex: 200,
      clickable: true,
    });

    this._clusters.push({ handle, markers: group });
  }

  private _clearClusters(): void {
    const map = this.currentMap;
    if (map) {
      for (const c of this._clusters) {
        map._adapter().removeCustomOverlay(c.handle);
      }
    }
    this._clusters.length = 0;
  }
}
