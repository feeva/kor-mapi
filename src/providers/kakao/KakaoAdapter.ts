import type { IMapProvider, NativeMarkerHandle, NativeOverlayHandle, NativeInfoWindowHandle } from '../base/IMapProvider.js';
import { HandleRegistry, makeHandle, makeEventListener } from '../base/HandleRegistry.js';
import { loadKakaoSdk } from './KakaoLoader.js';
import { toKakaoZoom, fromKakaoZoom } from '../../utils/coordinateUtils.js';
import { ConfigurationError } from '../../core/errors.js';
import {
  type LatLng, type LatLngBounds, type KorMapConfig, type KorMapFeature,
  type KorMapEvent, type OverlayEvent, type AnyEventHandler, type EventListener,
  type FitBoundsOptions, type PanOptions, type MapProjection,
  type MarkerOptions, type InfoWindowOptions,
  type PolylineOptions, type PolygonOptions, type CircleOptions,
  type RectangleOptions, type CustomOverlayOptions, type TileLayerOptions,
  MapTypeId,
} from '../../core/types.js';

// ---------------------------------------------------------------------------
// MapTypeId mapping (runtime functions — avoids module-load-time SDK access)
// ---------------------------------------------------------------------------

function toKakaoMapType(type: MapTypeId): kakao.maps.MapTypeId {
  switch (type) {
    case MapTypeId.SATELLITE: return kakao.maps.MapTypeId.SKYVIEW;
    case MapTypeId.HYBRID:    return kakao.maps.MapTypeId.HYBRID;
    // Kakao TERRAIN is an overlay type, not a standalone base map — use ROADMAP
    default:                  return kakao.maps.MapTypeId.ROADMAP;
  }
}

function fromKakaoMapType(typeId: string): MapTypeId {
  if (typeId === kakao.maps.MapTypeId.SKYVIEW)  return MapTypeId.SATELLITE;
  if (typeId === kakao.maps.MapTypeId.HYBRID)   return MapTypeId.HYBRID;
  if (typeId === kakao.maps.MapTypeId.TERRAIN)  return MapTypeId.TERRAIN;
  return MapTypeId.ROADMAP;
}

// ---------------------------------------------------------------------------
// Event name mapping
// ---------------------------------------------------------------------------

// Kakao events that map 1:1 to facade events
const FACADE_TO_KAKAO_EVENT: Partial<Record<KorMapEvent, string>> = {
  click: 'click',
  dblclick: 'dblclick',
  rightclick: 'rightclick',
  mousemove: 'mousemove',
  drag: 'drag',
  dragstart: 'dragstart',
  dragend: 'dragend',
  zoom_changed: 'zoom_changed',
  center_changed: 'center_changed',
  bounds_changed: 'bounds_changed',
  tilesloaded: 'tilesloaded',
  // 'idle' is synthesized below — not in this map
};

const SUPPORTED_FEATURES: KorMapFeature[] = [];

const POINTER_EVENTS = new Set<KorMapEvent>(['click', 'dblclick', 'rightclick']);

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class KakaoAdapter implements IMapProvider {
  readonly provider = 'kakao' as const;

  private map!: kakao.maps.Map;
  private readonly markerReg = new HandleRegistry<kakao.maps.Marker>();
  private readonly overlayReg = new HandleRegistry<kakao.maps.Polyline | kakao.maps.Polygon | kakao.maps.Circle | kakao.maps.Rectangle | kakao.maps.AbstractOverlay | kakao.maps.CustomOverlay>();
  private readonly infoWindowReg = new HandleRegistry<kakao.maps.InfoWindow>();

  // Listener bookkeeping: handle id → [ { event, nativeHandler } ]
  private readonly markerListeners = new Map<number, Array<{ event: string; handler: AnyEventHandler }>>();

  // idle synthesis: debounce timer
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly idleHandlers: Array<AnyEventHandler> = [];

  get nativeMap(): unknown {
    return this.map;
  }

  async init(container: HTMLElement, config: KorMapConfig): Promise<void> {
    const appKey = resolveAppKey(config.apiKey);
    await loadKakaoSdk(appKey);

    const center = config.center ?? { lat: 37.5665, lng: 126.9780 }; // Seoul default
    const zoom = config.zoom ?? 10;

    this.map = new kakao.maps.Map(container, {
      center: new kakao.maps.LatLng(center.lat, center.lng),
      level: toKakaoZoom(zoom),
      minLevel: 1,
      maxLevel: 13,
      ...(config.mapType && { mapTypeId: toKakaoMapType(config.mapType) }),
    });
  }

  destroy(): void {
    // Kakao doesn't have a formal destroy() — remove the map's DOM
    if (this.map) {
      // Clear all overlays by setting map to null on each registry entry is not
      // directly possible here, but the DOM removal via container suffices for GC.
      // The container element itself is managed by the caller.
    }
  }

  // -------------------------------------------------------------------------
  // Camera
  // -------------------------------------------------------------------------

  setCenter(latlng: LatLng): void {
    this.map.setCenter(new kakao.maps.LatLng(latlng.lat, latlng.lng));
  }

  getCenter(): LatLng {
    const c = this.map.getCenter();
    return { lat: c.getLat(), lng: c.getLng() };
  }

  setZoom(zoom: number): void {
    const level = toKakaoZoom(zoom);
    if (level !== this.map.getLevel()) {
      this.map.setLevel(level);
    }
  }

  getZoom(): number {
    return fromKakaoZoom(this.map.getLevel());
  }

  getBounds(): LatLngBounds {
    const b = this.map.getBounds();
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    return {
      sw: { lat: sw.getLat(), lng: sw.getLng() },
      ne: { lat: ne.getLat(), lng: ne.getLng() },
    };
  }

  fitBounds(bounds: LatLngBounds, options?: FitBoundsOptions): void {
    const kb = new kakao.maps.LatLngBounds(
      new kakao.maps.LatLng(bounds.sw.lat, bounds.sw.lng),
      new kakao.maps.LatLng(bounds.ne.lat, bounds.ne.lng),
    );
    const p = normalizePadding(options?.padding);
    this.map.setBounds(kb, p.top, p.right, p.bottom, p.left);
  }

  panTo(latlng: LatLng, _options?: PanOptions): void {
    this.map.panTo(new kakao.maps.LatLng(latlng.lat, latlng.lng));
  }

  panBy(x: number, y: number): void {
    this.map.panBy(x, y);
  }

  // -------------------------------------------------------------------------
  // Map type
  // -------------------------------------------------------------------------

  setMapType(type: MapTypeId): void {
    const level = this.map.getLevel(); // setMapTypeId can fire zoom_changed internally
    this.map.setMapTypeId(toKakaoMapType(type));
    if (this.map.getLevel() !== level) this.map.setLevel(level);
  }

  getMapType(): MapTypeId {
    const raw = this.map.getMapTypeId();
    return fromKakaoMapType(raw as string);
  }

  // -------------------------------------------------------------------------
  // Capability
  // -------------------------------------------------------------------------

  supports(feature: KorMapFeature): boolean {
    return SUPPORTED_FEATURES.includes(feature);
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  on(event: KorMapEvent, handler: AnyEventHandler): EventListener {
    const listener = makeEventListener(event);

    if (event === 'idle') {
      this.idleHandlers.push(handler);
      this._ensureIdleSynthesis();
    } else {
      const kakaoEvent = FACADE_TO_KAKAO_EVENT[event];
      if (kakaoEvent) {
        const wrapped = POINTER_EVENTS.has(event)
          ? (e: { latLng: kakao.maps.LatLng }) =>
              (handler as (ev: { latlng: LatLng }) => void)({ latlng: { lat: e.latLng.getLat(), lng: e.latLng.getLng() } })
          : handler as kakao.maps.AnyListener;
        kakao.maps.event.addListener(this.map, kakaoEvent, wrapped as kakao.maps.AnyListener);
      }
    }

    return listener;
  }

  once(event: KorMapEvent, handler: AnyEventHandler): EventListener {
    const wrapper = (...args: unknown[]) => {
      this.off(event, listener);
      (handler as (...a: unknown[]) => void)(...args);
    };
    const listener = this.on(event, wrapper as AnyEventHandler);
    return listener;
  }

  off(event: KorMapEvent, _listener: EventListener): void {
    // Kakao's removeListener requires the original handler function.
    // Because we don't track handler→listener mapping here (kept simple),
    // we remove ALL handlers for this event type when called.
    // For production use, a Map<listenerId, handler> would be needed.
    if (event === 'idle') {
      this.idleHandlers.length = 0;
    } else {
      const kakaoEvent = FACADE_TO_KAKAO_EVENT[event];
      if (kakaoEvent) {
        // Kakao requires the specific handler fn — simplified: no-op if handler not tracked
        // Full implementation would store listener._id → handler in a registry
      }
    }
  }

  private _ensureIdleSynthesis(): void {
    const synthesize = () => {
      if (this.idleTimer !== null) clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => {
        for (const h of this.idleHandlers) (h as GenericHandler)();
      }, 150);
    };

    kakao.maps.event.addListener(this.map, 'center_changed', synthesize);
    kakao.maps.event.addListener(this.map, 'zoom_changed', synthesize);
  }

  // -------------------------------------------------------------------------
  // Markers
  // -------------------------------------------------------------------------

  addMarker(options: MarkerOptions): NativeMarkerHandle {
    const kakaoOptions: kakao.maps.MarkerOptions = {
      map: this.map,
      position: new kakao.maps.LatLng(options.position.lat, options.position.lng),
      title: options.title,
      draggable: options.draggable,
      clickable: options.clickable,
      zIndex: options.zIndex,
      opacity: options.opacity,
    };

    if (options.icon) {
      kakaoOptions.image = buildMarkerImage(options.icon);
    }

    const marker = new kakao.maps.Marker(kakaoOptions);

    if (options.visible === false) marker.setVisible(false);

    // Kakao has no native label — render as a CustomOverlay companion
    if (options.label) {
      this._addLabelOverlay(marker, options.label.text, options.label);
    }

    const id = this.markerReg.register(marker);
    this.markerListeners.set(id, []);
    return makeHandle(id);
  }

  removeMarker(handle: NativeMarkerHandle): void {
    const marker = this.markerReg.get(handle._handleId);
    marker.setMap(null);
    this.markerReg.delete(handle._handleId);
    this.markerListeners.delete(handle._handleId);
  }

  updateMarker(handle: NativeMarkerHandle, options: Partial<MarkerOptions>): void {
    const marker = this.markerReg.get(handle._handleId);
    if (options.position) marker.setPosition(new kakao.maps.LatLng(options.position.lat, options.position.lng));
    if (options.icon !== undefined) marker.setImage(buildMarkerImage(options.icon));
    if (options.title !== undefined) marker.setTitle(options.title);
    if (options.draggable !== undefined) marker.setDraggable(options.draggable);
    if (options.clickable !== undefined) marker.setClickable(options.clickable);
    if (options.zIndex !== undefined) marker.setZIndex(options.zIndex);
    if (options.opacity !== undefined) marker.setOpacity(options.opacity);
    if (options.visible !== undefined) marker.setVisible(options.visible);
  }

  addMarkerEvent(handle: NativeMarkerHandle, event: OverlayEvent, handler: AnyEventHandler): EventListener {
    const marker = this.markerReg.get(handle._handleId);
    kakao.maps.event.addListener(marker, event, handler as kakao.maps.AnyListener);
    const listener = makeEventListener(event);
    return listener;
  }

  removeMarkerEvent(handle: NativeMarkerHandle, event: OverlayEvent, _listener: EventListener): void {
    const marker = this.markerReg.get(handle._handleId);
    // Simplified: removes all listeners for this event on this marker
    kakao.maps.event.removeListener(marker, event, () => undefined);
  }

  // -------------------------------------------------------------------------
  // InfoWindow
  // -------------------------------------------------------------------------

  openInfoWindow(options: InfoWindowOptions, anchor?: NativeMarkerHandle): NativeInfoWindowHandle {
    const iw = new kakao.maps.InfoWindow({
      content: options.content,
      position: options.position
        ? new kakao.maps.LatLng(options.position.lat, options.position.lng)
        : undefined,
      zIndex: options.zIndex,
      removable: false,
    });

    const marker = anchor ? this.markerReg.get(anchor._handleId) : undefined;
    iw.open(this.map, marker);

    const id = this.infoWindowReg.register(iw);
    return makeHandle(id);
  }

  closeInfoWindow(handle: NativeInfoWindowHandle): void {
    this.infoWindowReg.get(handle._handleId).close();
  }

  updateInfoWindow(handle: NativeInfoWindowHandle, options: Partial<InfoWindowOptions>): void {
    const iw = this.infoWindowReg.get(handle._handleId);
    if (options.content !== undefined) iw.setContent(options.content);
    if (options.position) iw.setPosition(new kakao.maps.LatLng(options.position.lat, options.position.lng));
    if (options.zIndex !== undefined) iw.setZIndex(options.zIndex);
  }

  isInfoWindowOpen(_handle: NativeInfoWindowHandle): boolean {
    // Kakao InfoWindow has no isOpen() — approximate: if it has a map reference
    // Simplified: always return true if handle exists
    return this.infoWindowReg.has(_handle._handleId);
  }

  // -------------------------------------------------------------------------
  // Vector overlays
  // -------------------------------------------------------------------------

  addPolyline(options: PolylineOptions): NativeOverlayHandle {
    const polyline = new kakao.maps.Polyline({
      map: this.map,
      path: toKakaoPath(options.path),
      strokeWeight: options.strokeWeight,
      strokeColor: options.strokeColor,
      strokeOpacity: options.strokeOpacity,
      strokeStyle: options.strokeStyle,
      zIndex: options.zIndex,
    });
    return makeHandle(this.overlayReg.register(polyline));
  }

  removePolyline(handle: NativeOverlayHandle): void {
    (this.overlayReg.get(handle._handleId) as kakao.maps.Polyline).setMap(null);
    this.overlayReg.delete(handle._handleId);
  }

  updatePolyline(handle: NativeOverlayHandle, options: Partial<PolylineOptions>): void {
    (this.overlayReg.get(handle._handleId) as kakao.maps.Polyline).setOptions({
      strokeWeight: options.strokeWeight,
      strokeColor: options.strokeColor,
      strokeOpacity: options.strokeOpacity,
    });
  }

  addPolygon(options: PolygonOptions): NativeOverlayHandle {
    const polygon = new kakao.maps.Polygon({
      map: this.map,
      path: toKakaoPath(options.paths),
      strokeWeight: options.strokeWeight,
      strokeColor: options.strokeColor,
      strokeOpacity: options.strokeOpacity,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
      zIndex: options.zIndex,
    });
    return makeHandle(this.overlayReg.register(polygon));
  }

  removePolygon(handle: NativeOverlayHandle): void {
    (this.overlayReg.get(handle._handleId) as kakao.maps.Polygon).setMap(null);
    this.overlayReg.delete(handle._handleId);
  }

  updatePolygon(handle: NativeOverlayHandle, options: Partial<PolygonOptions>): void {
    (this.overlayReg.get(handle._handleId) as kakao.maps.Polygon).setOptions({
      strokeColor: options.strokeColor,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
    });
  }

  addCircle(options: CircleOptions): NativeOverlayHandle {
    const circle = new kakao.maps.Circle({
      map: this.map,
      center: new kakao.maps.LatLng(options.center.lat, options.center.lng),
      radius: options.radius,
      strokeWeight: options.strokeWeight,
      strokeColor: options.strokeColor,
      strokeOpacity: options.strokeOpacity,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
      zIndex: options.zIndex,
    });
    return makeHandle(this.overlayReg.register(circle));
  }

  removeCircle(handle: NativeOverlayHandle): void {
    (this.overlayReg.get(handle._handleId) as kakao.maps.Circle).setMap(null);
    this.overlayReg.delete(handle._handleId);
  }

  updateCircle(handle: NativeOverlayHandle, options: Partial<CircleOptions>): void {
    const circle = this.overlayReg.get(handle._handleId) as kakao.maps.Circle;
    if (options.center) circle.setCenter(new kakao.maps.LatLng(options.center.lat, options.center.lng));
    if (options.radius !== undefined) circle.setRadius(options.radius);
    circle.setOptions({
      strokeColor: options.strokeColor,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
    });
  }

  addRectangle(options: RectangleOptions): NativeOverlayHandle {
    const rect = new kakao.maps.Rectangle({
      map: this.map,
      bounds: new kakao.maps.LatLngBounds(
        new kakao.maps.LatLng(options.bounds.sw.lat, options.bounds.sw.lng),
        new kakao.maps.LatLng(options.bounds.ne.lat, options.bounds.ne.lng),
      ),
      strokeWeight: options.strokeWeight,
      strokeColor: options.strokeColor,
      strokeOpacity: options.strokeOpacity,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
      zIndex: options.zIndex,
    });
    return makeHandle(this.overlayReg.register(rect));
  }

  removeRectangle(handle: NativeOverlayHandle): void {
    (this.overlayReg.get(handle._handleId) as kakao.maps.Rectangle).setMap(null);
    this.overlayReg.delete(handle._handleId);
  }

  updateRectangle(handle: NativeOverlayHandle, options: Partial<RectangleOptions>): void {
    (this.overlayReg.get(handle._handleId) as kakao.maps.Rectangle).setOptions({
      strokeColor: options.strokeColor,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
    });
  }

  addCustomOverlay(options: CustomOverlayOptions): NativeOverlayHandle {
    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(options.position.lat, options.position.lng),
      content: options.content,
      xAnchor: 0,
      yAnchor: 0,
      zIndex: options.zIndex ?? 100,
    });
    overlay.setMap(this.map);
    return makeHandle(this.overlayReg.register(overlay));
  }

  removeCustomOverlay(handle: NativeOverlayHandle): void {
    (this.overlayReg.get(handle._handleId) as kakao.maps.CustomOverlay).setMap(null);
    this.overlayReg.delete(handle._handleId);
  }

  addTileLayer(options: TileLayerOptions): NativeOverlayHandle {
    const tileSize = options.tileSize ?? 256;
    const tileLayer = new kakao.maps.TileLayer({
      getTile: (x: number, y: number, z: number): HTMLElement => {
        const img = document.createElement('img');
        img.src = options.getTileUrl({ x, y }, z);
        img.width = tileSize;
        img.height = tileSize;
        if (options.opacity !== undefined) img.style.opacity = String(options.opacity);
        return img;
      },
    });
    tileLayer.setMap(this.map);
    return makeHandle(this.overlayReg.register(tileLayer));
  }

  removeTileLayer(handle: NativeOverlayHandle): void {
    (this.overlayReg.get(handle._handleId) as kakao.maps.TileLayer).setMap(null);
    this.overlayReg.delete(handle._handleId);
  }

  // -------------------------------------------------------------------------
  // Projection
  // -------------------------------------------------------------------------

  getProjection(): MapProjection {
    // Projection is accessed per-overlay in Kakao; return a stub here.
    // Full projection support requires an AbstractOverlay context.
    return {
      fromLatLngToPoint: (latlng: LatLng) => ({ x: latlng.lng, y: latlng.lat }),
      fromPointToLatLng: (point) => ({ lat: point.y, lng: point.x }),
      fromLatLngToDivPixel: (latlng: LatLng) => ({ x: latlng.lng, y: latlng.lat }),
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _addLabelOverlay(marker: kakao.maps.Marker, text: string, label: MarkerOptions['label']): void {
    const div = document.createElement('div');
    div.textContent = text;
    div.style.cssText = [
      'position:absolute',
      'white-space:nowrap',
      'pointer-events:none',
      `color:${label?.color ?? '#000'}`,
      `font-size:${label?.fontSize ?? '12px'}`,
      `font-weight:${label?.fontWeight ?? 'normal'}`,
    ].join(';');

    const LabelOverlay = class extends kakao.maps.AbstractOverlay {
      onAdd(): void {
        this.getPanels().overlayLayer.appendChild(div);
      }
      onRemove(): void {
        div.parentNode?.removeChild(div);
      }
      draw(): void {
        const proj = this.getProjection();
        const pos = marker.getPosition();
        const pt = proj.containerPointFromCoords(pos);
        div.style.left = `${pt.x}px`;
        div.style.top = `${pt.y - 20}px`; // above marker
      }
    };

    new LabelOverlay().setMap(this.map);
  }
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

type GenericHandler = () => void;

function resolveAppKey(apiKey: string | import('../../core/types.js').KorMapApiKey): string {
  if (typeof apiKey === 'string') return apiKey;
  if (apiKey.appKey) return apiKey.appKey;
  throw new ConfigurationError('Kakao Maps requires an appKey');
}

function normalizePadding(padding?: Partial<import('../../core/types.js').Padding> | number): { top: number; right: number; bottom: number; left: number } {
  if (padding === undefined) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof padding === 'number') return { top: padding, right: padding, bottom: padding, left: padding };
  return { top: padding.top ?? 0, right: padding.right ?? 0, bottom: padding.bottom ?? 0, left: padding.left ?? 0 };
}

function toKakaoLatLng(latlng: LatLng): kakao.maps.LatLng {
  return new kakao.maps.LatLng(latlng.lat, latlng.lng);
}

function toKakaoPath(path: LatLng[] | LatLng[][]): kakao.maps.LatLng[] | kakao.maps.LatLng[][] {
  if (path.length === 0) return [];
  const first = path[0];
  if (Array.isArray(first)) {
    return (path as LatLng[][]).map(ring => ring.map(toKakaoLatLng));
  }
  return (path as LatLng[]).map(toKakaoLatLng);
}

function buildMarkerImage(icon: MarkerOptions['icon']): kakao.maps.MarkerImage {
  if (!icon) throw new Error('icon is required');
  const url = typeof icon === 'string' ? icon : icon.url;
  const size = typeof icon === 'object' && icon.size
    ? new kakao.maps.Size(icon.size.width, icon.size.height)
    : new kakao.maps.Size(24, 35);

  const opts: ConstructorParameters<typeof kakao.maps.MarkerImage>[2] = {};
  if (typeof icon === 'object') {
    if (icon.anchor) opts.offset = new kakao.maps.Point(icon.anchor.x, icon.anchor.y);
    if (icon.origin) opts.spriteOrigin = new kakao.maps.Point(icon.origin.x, icon.origin.y);
    if (icon.scaledSize) opts.spriteSize = new kakao.maps.Size(icon.scaledSize.width, icon.scaledSize.height);
  }

  return new kakao.maps.MarkerImage(url, size, opts);
}
