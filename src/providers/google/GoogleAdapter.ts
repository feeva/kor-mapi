import type { IMapProvider, NativeMarkerHandle, NativeOverlayHandle, NativeInfoWindowHandle } from '../base/IMapProvider.js';
import { HandleRegistry, makeHandle, makeEventListener } from '../base/HandleRegistry.js';
import { loadGoogleSdk } from './GoogleLoader.js';
import { toGoogleZoom, fromGoogleZoom } from '../../utils/coordinateUtils.js';
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
// MapTypeId mapping (facade uses same string values as Google)
// ---------------------------------------------------------------------------

// Google's MapTypeId string values are identical to our MapTypeId enum values,
// so we use string literals here to avoid referencing `google` at module load time
// (the SDK is loaded dynamically; accessing google.maps.* before init crashes).
const FACADE_TO_GOOGLE_TYPE: Record<MapTypeId, string> = {
  [MapTypeId.ROADMAP]: 'roadmap',
  [MapTypeId.SATELLITE]: 'satellite',
  [MapTypeId.HYBRID]: 'hybrid',
  [MapTypeId.TERRAIN]: 'terrain',
};

const GOOGLE_TO_FACADE_TYPE: Record<string, MapTypeId> = {
  roadmap: MapTypeId.ROADMAP,
  satellite: MapTypeId.SATELLITE,
  hybrid: MapTypeId.HYBRID,
  terrain: MapTypeId.TERRAIN,
};

// ---------------------------------------------------------------------------
// Event name mapping (Google event names match facade almost 1:1)
// ---------------------------------------------------------------------------

const FACADE_TO_GOOGLE_EVENT: Partial<Record<KorMapEvent, string>> = {
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
  idle: 'idle',
  tilesloaded: 'tilesloaded',
};

const SUPPORTED_FEATURES: KorMapFeature[] = ['elevation', 'streetview', 'heatmap', 'drawing', 'mapStyles', 'tilt', 'heading', 'trafficLayer'];

const POINTER_EVENTS = new Set<KorMapEvent>(['click', 'dblclick', 'rightclick']);

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class GoogleAdapter implements IMapProvider {
  readonly provider = 'google' as const;

  private map!: google.maps.Map;
  private readonly markerReg = new HandleRegistry<google.maps.marker.AdvancedMarkerElement>();
  private readonly overlayReg = new HandleRegistry<google.maps.Polyline | google.maps.Polygon | google.maps.Circle | google.maps.Rectangle | google.maps.OverlayView | google.maps.ImageMapType>();
  private readonly infoWindowReg = new HandleRegistry<google.maps.InfoWindow>();
  // Track MapsEventListeners for proper cleanup
  private readonly eventListeners = new Map<number, google.maps.MapsEventListener>();
  private eventListenerIdCounter = 0;

  get nativeMap(): unknown {
    return this.map;
  }

  async init(container: HTMLElement, config: KorMapConfig): Promise<void> {
    const apiKey = resolveApiKey(config.apiKey);
    await loadGoogleSdk(apiKey);

    const center = config.center ?? { lat: 37.5665, lng: 126.9780 };
    const zoom = config.zoom ?? 10;

    this.map = new google.maps.Map(container, {
      center: new google.maps.LatLng(center.lat, center.lng),
      zoom: toGoogleZoom(zoom),
      minZoom: 7,
      maxZoom: 19,
      mapId: config.mapId ?? 'DEMO_MAP_ID',
      ...(config.mapType && { mapTypeId: FACADE_TO_GOOGLE_TYPE[config.mapType] as google.maps.MapTypeId }),
    });
  }

  destroy(): void {
    // Google Maps does not have a formal destroy() — clear event listeners
    for (const listener of this.eventListeners.values()) {
      listener.remove();
    }
    this.eventListeners.clear();
  }

  // -------------------------------------------------------------------------
  // Camera
  // -------------------------------------------------------------------------

  setCenter(latlng: LatLng): void {
    this.map.setCenter(new google.maps.LatLng(latlng.lat, latlng.lng));
  }

  getCenter(): LatLng {
    const c = this.map.getCenter();
    if (!c) return { lat: 0, lng: 0 };
    return { lat: c.lat(), lng: c.lng() };
  }

  setZoom(zoom: number): void {
    this.map.setZoom(toGoogleZoom(zoom));
  }

  getZoom(): number {
    return fromGoogleZoom(this.map.getZoom() ?? 10);
  }

  getBounds(): LatLngBounds {
    const b = this.map.getBounds();
    if (!b) return { sw: { lat: 0, lng: 0 }, ne: { lat: 0, lng: 0 } };
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    return {
      sw: { lat: sw.lat(), lng: sw.lng() },
      ne: { lat: ne.lat(), lng: ne.lng() },
    };
  }

  fitBounds(bounds: LatLngBounds, options?: FitBoundsOptions): void {
    const gb = new google.maps.LatLngBounds(
      new google.maps.LatLng(bounds.sw.lat, bounds.sw.lng),
      new google.maps.LatLng(bounds.ne.lat, bounds.ne.lng),
    );
    const padding = normalizePaddingForGoogle(options?.padding);
    this.map.fitBounds(gb, padding);
  }

  panTo(latlng: LatLng, _options?: PanOptions): void {
    this.map.panTo(new google.maps.LatLng(latlng.lat, latlng.lng));
  }

  panBy(x: number, y: number): void {
    this.map.panBy(x, y);
  }

  // -------------------------------------------------------------------------
  // Map type
  // -------------------------------------------------------------------------

  setMapType(type: MapTypeId): void {
    this.map.setMapTypeId(FACADE_TO_GOOGLE_TYPE[type]);
  }

  getMapType(): MapTypeId {
    return GOOGLE_TO_FACADE_TYPE[this.map.getMapTypeId()] ?? MapTypeId.ROADMAP;
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
    const googleEvent = FACADE_TO_GOOGLE_EVENT[event];
    const listener = makeEventListener(event);

    if (googleEvent) {
      const wrapped = POINTER_EVENTS.has(event)
        ? (e: { latLng: google.maps.LatLng | null }) =>
            (handler as (ev: { latlng: LatLng }) => void)({ latlng: { lat: e.latLng?.lat() ?? 0, lng: e.latLng?.lng() ?? 0 } })
        : handler as google.maps.AnyListener;
      const mapsListener = google.maps.event.addListener(
        this.map,
        googleEvent,
        wrapped as google.maps.AnyListener,
      );
      this.eventListeners.set(++this.eventListenerIdCounter, mapsListener);
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

  off(_event: KorMapEvent, _listener: EventListener): void {
    // Simplified: a full implementation would map listener._id to MapsEventListener
  }

  // -------------------------------------------------------------------------
  // Markers
  // -------------------------------------------------------------------------

  addMarker(options: MarkerOptions): NativeMarkerHandle {
    const content = buildAdvancedMarkerContent(options);
    const marker = new google.maps.marker.AdvancedMarkerElement({
      map: this.map,
      position: { lat: options.position.lat, lng: options.position.lng },
      title: options.title ?? '',
      content,
      gmpClickable: options.clickable ?? true,
      gmpDraggable: options.draggable ?? false,
      zIndex: options.zIndex ?? null,
    });
    if (options.visible === false && marker.content) marker.content.style.display = 'none';
    if (options.opacity !== undefined && marker.content) marker.content.style.opacity = String(options.opacity);
    return makeHandle(this.markerReg.register(marker));
  }

  removeMarker(handle: NativeMarkerHandle): void {
    this.markerReg.get(handle._handleId).map = null;
    this.markerReg.delete(handle._handleId);
  }

  updateMarker(handle: NativeMarkerHandle, options: Partial<MarkerOptions>): void {
    const marker = this.markerReg.get(handle._handleId);
    if (options.position) marker.position = { lat: options.position.lat, lng: options.position.lng };
    if (options.title !== undefined) marker.title = options.title ?? '';
    if (options.zIndex !== undefined) marker.zIndex = options.zIndex ?? null;
    if (options.draggable !== undefined) marker.gmpDraggable = options.draggable;
    if (options.clickable !== undefined) marker.gmpClickable = options.clickable;
    if (options.icon !== undefined) marker.content = buildAdvancedMarkerContent(options as MarkerOptions) ?? null;
    if (options.visible !== undefined && marker.content) marker.content.style.display = options.visible ? '' : 'none';
    if (options.opacity !== undefined && marker.content) marker.content.style.opacity = String(options.opacity);
  }

  addMarkerEvent(handle: NativeMarkerHandle, event: OverlayEvent, handler: AnyEventHandler): EventListener {
    const marker = this.markerReg.get(handle._handleId);
    marker.addListener(event, handler as google.maps.AnyListener);
    return makeEventListener(event);
  }

  removeMarkerEvent(_handle: NativeMarkerHandle, _event: OverlayEvent, _listener: EventListener): void {
    // Simplified
  }

  // -------------------------------------------------------------------------
  // InfoWindow
  // -------------------------------------------------------------------------

  openInfoWindow(options: InfoWindowOptions, anchor?: NativeMarkerHandle): NativeInfoWindowHandle {
    const iw = new google.maps.InfoWindow({
      content: options.content,
      position: options.position
        ? new google.maps.LatLng(options.position.lat, options.position.lng)
        : undefined,
      maxWidth: options.maxWidth,
      disableAutoPan: options.disableAutoPan,
      zIndex: options.zIndex,
    });
    const advMarker = anchor ? this.markerReg.get(anchor._handleId) : undefined;
    iw.open({ map: this.map, anchor: advMarker });
    return makeHandle(this.infoWindowReg.register(iw));
  }

  closeInfoWindow(handle: NativeInfoWindowHandle): void {
    this.infoWindowReg.get(handle._handleId).close();
  }

  updateInfoWindow(handle: NativeInfoWindowHandle, options: Partial<InfoWindowOptions>): void {
    const iw = this.infoWindowReg.get(handle._handleId);
    if (options.content !== undefined) iw.setContent(options.content);
    if (options.position) iw.setPosition(new google.maps.LatLng(options.position.lat, options.position.lng));
    if (options.zIndex !== undefined) iw.setZIndex(options.zIndex);
  }

  isInfoWindowOpen(handle: NativeInfoWindowHandle): boolean {
    return this.infoWindowReg.get(handle._handleId).getMap() !== null;
  }

  // -------------------------------------------------------------------------
  // Vector overlays
  // -------------------------------------------------------------------------

  addPolyline(options: PolylineOptions): NativeOverlayHandle {
    const polyline = new google.maps.Polyline({
      map: this.map,
      path: toGoogleFlatPath(options.path),
      strokeColor: options.strokeColor,
      strokeOpacity: options.strokeOpacity,
      strokeWeight: options.strokeWeight,
      geodesic: options.geodesic,
      clickable: options.clickable,
      zIndex: options.zIndex,
      visible: options.visible,
    });
    return makeHandle(this.overlayReg.register(polyline));
  }

  removePolyline(handle: NativeOverlayHandle): void {
    (this.overlayReg.get(handle._handleId) as google.maps.Polyline).setMap(null);
    this.overlayReg.delete(handle._handleId);
  }

  updatePolyline(handle: NativeOverlayHandle, options: Partial<PolylineOptions>): void {
    (this.overlayReg.get(handle._handleId) as google.maps.Polyline).setOptions({
      strokeColor: options.strokeColor,
      strokeOpacity: options.strokeOpacity,
      strokeWeight: options.strokeWeight,
    });
  }

  addPolygon(options: PolygonOptions): NativeOverlayHandle {
    const polygon = new google.maps.Polygon({
      map: this.map,
      paths: toGooglePaths(options.paths),
      strokeColor: options.strokeColor,
      strokeOpacity: options.strokeOpacity,
      strokeWeight: options.strokeWeight,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
      geodesic: options.geodesic,
      clickable: options.clickable,
      zIndex: options.zIndex,
      visible: options.visible,
    });
    return makeHandle(this.overlayReg.register(polygon));
  }

  removePolygon(handle: NativeOverlayHandle): void {
    (this.overlayReg.get(handle._handleId) as google.maps.Polygon).setMap(null);
    this.overlayReg.delete(handle._handleId);
  }

  updatePolygon(handle: NativeOverlayHandle, options: Partial<PolygonOptions>): void {
    (this.overlayReg.get(handle._handleId) as google.maps.Polygon).setOptions({
      strokeColor: options.strokeColor,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
    });
  }

  addCircle(options: CircleOptions): NativeOverlayHandle {
    const circle = new google.maps.Circle({
      map: this.map,
      center: new google.maps.LatLng(options.center.lat, options.center.lng),
      radius: options.radius,
      strokeColor: options.strokeColor,
      strokeOpacity: options.strokeOpacity,
      strokeWeight: options.strokeWeight,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
      clickable: options.clickable,
      zIndex: options.zIndex,
      visible: options.visible,
    });
    return makeHandle(this.overlayReg.register(circle));
  }

  removeCircle(handle: NativeOverlayHandle): void {
    (this.overlayReg.get(handle._handleId) as google.maps.Circle).setMap(null);
    this.overlayReg.delete(handle._handleId);
  }

  updateCircle(handle: NativeOverlayHandle, options: Partial<CircleOptions>): void {
    const circle = this.overlayReg.get(handle._handleId) as google.maps.Circle;
    if (options.center) circle.setCenter(new google.maps.LatLng(options.center.lat, options.center.lng));
    if (options.radius !== undefined) circle.setRadius(options.radius);
    circle.setOptions({
      strokeColor: options.strokeColor,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
    });
  }

  addRectangle(options: RectangleOptions): NativeOverlayHandle {
    const rect = new google.maps.Rectangle({
      map: this.map,
      bounds: new google.maps.LatLngBounds(
        new google.maps.LatLng(options.bounds.sw.lat, options.bounds.sw.lng),
        new google.maps.LatLng(options.bounds.ne.lat, options.bounds.ne.lng),
      ),
      strokeColor: options.strokeColor,
      strokeOpacity: options.strokeOpacity,
      strokeWeight: options.strokeWeight,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
      clickable: options.clickable,
      zIndex: options.zIndex,
      visible: options.visible,
    });
    return makeHandle(this.overlayReg.register(rect));
  }

  removeRectangle(handle: NativeOverlayHandle): void {
    (this.overlayReg.get(handle._handleId) as google.maps.Rectangle).setMap(null);
    this.overlayReg.delete(handle._handleId);
  }

  updateRectangle(handle: NativeOverlayHandle, options: Partial<RectangleOptions>): void {
    (this.overlayReg.get(handle._handleId) as google.maps.Rectangle).setOptions({
      strokeColor: options.strokeColor,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
    });
  }

  addCustomOverlay(options: CustomOverlayOptions): NativeOverlayHandle {
    const self = this;
    const CustomOverlayClass = class extends google.maps.OverlayView {
      onAdd(): void {
        const panes = this.getPanes();
        panes?.overlayLayer.appendChild(options.content);
      }
      onRemove(): void {
        options.content.parentNode?.removeChild(options.content);
      }
      draw(): void {
        const proj = this.getProjection();
        const pt = proj.fromLatLngToDivPixel(
          new google.maps.LatLng(options.position.lat, options.position.lng),
        );
        if (pt) {
          options.content.style.left = `${pt.x}px`;
          options.content.style.top = `${pt.y}px`;
          options.content.style.position = 'absolute';
        }
      }
    };
    const overlay = new CustomOverlayClass();
    overlay.setMap(self.map);
    return makeHandle(this.overlayReg.register(overlay));
  }

  removeCustomOverlay(handle: NativeOverlayHandle): void {
    (this.overlayReg.get(handle._handleId) as google.maps.OverlayView).setMap(null);
    this.overlayReg.delete(handle._handleId);
  }

  addTileLayer(options: TileLayerOptions): NativeOverlayHandle {
    const tileSize = options.tileSize ?? 256;
    const layer = new google.maps.ImageMapType({
      getTileUrl: (coord, zoom) => options.getTileUrl({ x: coord.x, y: coord.y }, zoom),
      tileSize: new google.maps.Size(tileSize, tileSize),
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      opacity: options.opacity,
    });
    if (options.opacity !== undefined) layer.setOpacity(options.opacity);
    this.map.overlayMapTypes?.push?.(layer);
    return makeHandle(this.overlayReg.register(layer as unknown as google.maps.OverlayView));
  }

  removeTileLayer(handle: NativeOverlayHandle): void {
    this.overlayReg.delete(handle._handleId);
    // Google Maps: remove from overlayMapTypes by index — simplified
  }

  // -------------------------------------------------------------------------
  // Projection
  // -------------------------------------------------------------------------

  getProjection(): MapProjection {
    const proj = this.map.getProjection();
    return {
      fromLatLngToPoint: (latlng) => {
        const pt = proj?.fromLatLngToPoint(new google.maps.LatLng(latlng.lat, latlng.lng));
        return pt ? { x: pt.x, y: pt.y } : { x: 0, y: 0 };
      },
      fromPointToLatLng: (point) => {
        const c = proj?.fromPointToLatLng(new google.maps.Point(point.x, point.y));
        return c ? { lat: c.lat(), lng: c.lng() } : { lat: 0, lng: 0 };
      },
      fromLatLngToDivPixel: (latlng) => {
        const pt = proj?.fromLatLngToPoint(new google.maps.LatLng(latlng.lat, latlng.lng));
        return pt ? { x: pt.x, y: pt.y } : { x: 0, y: 0 };
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function resolveApiKey(apiKey: string | import('../../core/types.js').KorMapApiKey): string {
  if (typeof apiKey === 'string') return apiKey;
  if (apiKey.apiKey) return apiKey.apiKey;
  throw new ConfigurationError('Google Maps requires an apiKey');
}

function normalizePaddingForGoogle(
  padding?: Partial<import('../../core/types.js').Padding> | number,
): number | google.maps.Padding {
  if (padding === undefined) return 0;
  if (typeof padding === 'number') return padding;
  return {
    top: padding.top ?? 0,
    right: padding.right ?? 0,
    bottom: padding.bottom ?? 0,
    left: padding.left ?? 0,
  };
}

function toGoogleLatLng(latlng: LatLng): google.maps.LatLng {
  return new google.maps.LatLng(latlng.lat, latlng.lng);
}

function toGoogleFlatPath(path: LatLng[] | LatLng[][]): google.maps.LatLng[] {
  if (path.length === 0) return [];
  if (Array.isArray(path[0])) {
    // Multi-path: flatten first ring for polyline
    return (path as LatLng[][])[0]!.map(toGoogleLatLng);
  }
  return (path as LatLng[]).map(toGoogleLatLng);
}

function toGooglePaths(paths: LatLng[] | LatLng[][]): google.maps.LatLng[] | google.maps.LatLng[][] {
  if (paths.length === 0) return [];
  if (Array.isArray(paths[0])) {
    return (paths as LatLng[][]).map(ring => ring.map(toGoogleLatLng));
  }
  return (paths as LatLng[]).map(toGoogleLatLng);
}

function buildAdvancedMarkerContent(options: MarkerOptions | Partial<MarkerOptions>): HTMLElement | undefined {
  const { icon, label } = options;
  if (!icon && !label) return undefined; // use default Google pin

  const container = document.createElement('div');
  container.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer';

  if (icon) {
    const img = document.createElement('img');
    img.src = typeof icon === 'string' ? icon : icon.url;
    if (typeof icon === 'object') {
      const sz = icon.scaledSize ?? icon.size;
      if (sz) { img.style.width = `${sz.width}px`; img.style.height = `${sz.height}px`; }
    }
    container.appendChild(img);
  }

  if (label) {
    const span = document.createElement('span');
    span.textContent = label.text;
    span.style.cssText = [
      `color:${label.color ?? '#000'}`,
      `font-size:${label.fontSize ?? '12px'}`,
      `font-weight:${label.fontWeight ?? 'normal'}`,
      'white-space:nowrap',
    ].join(';');
    container.appendChild(span);
  }

  return container;
}
