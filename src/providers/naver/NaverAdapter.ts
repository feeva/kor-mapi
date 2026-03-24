import type { IMapProvider, NativeMarkerHandle, NativeOverlayHandle, NativeInfoWindowHandle } from '../base/IMapProvider.js';
import { HandleRegistry, makeHandle, makeEventListener } from '../base/HandleRegistry.js';
import { loadNaverSdk } from './NaverLoader.js';
import { toNaverZoom, fromNaverZoom } from '../../utils/coordinateUtils.js';
import { ConfigurationError } from '../../core/errors.js';
import {
  type LatLng, type LatLngBounds, type KorMapConfig, type KorMapFeature,
  type KorMapEvent, type OverlayEvent, type AnyEventHandler, type EventListener,
  type FitBoundsOptions, type PanOptions, type MapProjection,
  type MarkerOptions, type InfoWindowOptions,
  type PolylineOptions, type PolygonOptions, type CircleOptions,
  type RectangleOptions, type CustomOverlayOptions, type TileLayerOptions,
  MapTypeId, MarkerAnimation,
} from '../../core/types.js';

// ---------------------------------------------------------------------------
// MapTypeId mapping
// ---------------------------------------------------------------------------

// Resolved at call time (after SDK loads) so we use the SDK's actual runtime values,
// not hardcoded strings that may not match what the loaded version expects.
function toNaverMapType(type: MapTypeId): naver.maps.MapTypeId {
  switch (type) {
    case MapTypeId.SATELLITE: return naver.maps.MapTypeId.SATELLITE;
    case MapTypeId.HYBRID:    return naver.maps.MapTypeId.HYBRID;
    case MapTypeId.TERRAIN:   return naver.maps.MapTypeId.TERRAIN;
    default:                  return naver.maps.MapTypeId.NORMAL;
  }
}

function fromNaverMapType(typeId: string): MapTypeId {
  if (typeId === naver.maps.MapTypeId.SATELLITE) return MapTypeId.SATELLITE;
  if (typeId === naver.maps.MapTypeId.HYBRID)    return MapTypeId.HYBRID;
  if (typeId === naver.maps.MapTypeId.TERRAIN)   return MapTypeId.TERRAIN;
  return MapTypeId.ROADMAP;
}

// ---------------------------------------------------------------------------
// Event name mapping (Naver event names mostly match facade names)
// ---------------------------------------------------------------------------

const FACADE_TO_NAVER_EVENT: Partial<Record<KorMapEvent, string>> = {
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

const SUPPORTED_FEATURES: KorMapFeature[] = [];

const POINTER_EVENTS = new Set<KorMapEvent>(['click', 'dblclick', 'rightclick']);

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class NaverAdapter implements IMapProvider {
  readonly provider = 'naver' as const;

  private map!: naver.maps.Map;
  private readonly markerReg = new HandleRegistry<naver.maps.Marker>();
  private readonly overlayReg = new HandleRegistry<naver.maps.Polyline | naver.maps.Polygon | naver.maps.Circle | naver.maps.Rectangle | naver.maps.OverlayView | naver.maps.ImageTileLayer>();
  private readonly infoWindowReg = new HandleRegistry<naver.maps.InfoWindow>();

  get nativeMap(): unknown {
    return this.map;
  }

  async init(container: HTMLElement, config: KorMapConfig): Promise<void> {
    const clientId = resolveClientId(config.apiKey);
    await loadNaverSdk(clientId);

    const center = config.center ?? { lat: 37.5665, lng: 126.9780 };
    const zoom = config.zoom ?? 10;

    // All official Naver Maps examples pass a string ID, not an HTMLElement.
    // Use the element's id when available to match that code path.
    const mapTarget: string | HTMLElement = container.id ? container.id : container;

    this.map = new naver.maps.Map(mapTarget, {
      center: new naver.maps.LatLng(center.lat, center.lng),
      zoom: toNaverZoom(zoom),
      minZoom: 7,
      maxZoom: 19,
      ...(config.mapType && { mapTypeId: toNaverMapType(config.mapType) }),
    });
  }

  destroy(): void {
    if (this.map) this.map.destroy();
  }

  // -------------------------------------------------------------------------
  // Camera
  // -------------------------------------------------------------------------

  setCenter(latlng: LatLng): void {
    this.map.setCenter(new naver.maps.LatLng(latlng.lat, latlng.lng));
  }

  getCenter(): LatLng {
    const c = this.map.getCenter();
    return { lat: c.lat(), lng: c.lng() };
  }

  setZoom(zoom: number): void {
    this.map.setZoom(toNaverZoom(zoom), true);
  }

  getZoom(): number {
    return fromNaverZoom(this.map.getZoom());
  }

  getBounds(): LatLngBounds {
    const b = this.map.getBounds();
    const sw = b.getSW();
    const ne = b.getNE();
    return {
      sw: { lat: sw.lat(), lng: sw.lng() },
      ne: { lat: ne.lat(), lng: ne.lng() },
    };
  }

  fitBounds(bounds: LatLngBounds, options?: FitBoundsOptions): void {
    const nb = new naver.maps.LatLngBounds(
      new naver.maps.LatLng(bounds.sw.lat, bounds.sw.lng),
      new naver.maps.LatLng(bounds.ne.lat, bounds.ne.lng),
    );
    const padding = normalizePaddingForNaver(options?.padding);
    this.map.fitBounds(nb, { padding });
  }

  panTo(latlng: LatLng, options?: PanOptions): void {
    this.map.panTo(new naver.maps.LatLng(latlng.lat, latlng.lng), {
      duration: options?.duration,
    });
  }

  panBy(x: number, y: number): void {
    this.map.panBy(x, y);
  }

  // -------------------------------------------------------------------------
  // Map type
  // -------------------------------------------------------------------------

  setMapType(type: MapTypeId): void {
    this.map.setMapTypeId(toNaverMapType(type));
  }

  getMapType(): MapTypeId {
    return fromNaverMapType(this.map.getMapTypeId());
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
    const naverEvent = FACADE_TO_NAVER_EVENT[event];
    if (naverEvent) {
      const wrapped = POINTER_EVENTS.has(event)
        ? (e: { coord: naver.maps.LatLng }) =>
            (handler as (ev: { latlng: LatLng }) => void)({ latlng: { lat: e.coord.lat(), lng: e.coord.lng() } })
        : handler as naver.maps.AnyListener;
      naver.maps.Event.addListener(this.map, naverEvent, wrapped as naver.maps.AnyListener);
    }
    return makeEventListener(event);
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
    // Simplified: Naver removeListener requires the listener object returned by addListener
    // Full implementation would track: listenerId → naver listener object
    const naverEvent = FACADE_TO_NAVER_EVENT[event];
    if (naverEvent) {
      // naver.maps.Event.removeListener(naverListenerObj);
    }
  }

  // -------------------------------------------------------------------------
  // Markers
  // -------------------------------------------------------------------------

  addMarker(options: MarkerOptions): NativeMarkerHandle {
    const icon = buildNaverIcon(options.icon);
    const marker = new naver.maps.Marker({
      map: this.map,
      position: new naver.maps.LatLng(options.position.lat, options.position.lng),
      icon,
      title: options.title,
      zIndex: options.zIndex,
      visible: options.visible,
      draggable: options.draggable,
      opacity: options.opacity,
      clickable: options.clickable,
      animation: options.animation
        ? options.animation === MarkerAnimation.BOUNCE
          ? naver.maps.Animation.BOUNCE
          : naver.maps.Animation.DROP
        : undefined,
    });
    const id = this.markerReg.register(marker);
    return makeHandle(id);
  }

  removeMarker(handle: NativeMarkerHandle): void {
    this.markerReg.get(handle._handleId).setMap(null);
    this.markerReg.delete(handle._handleId);
  }

  updateMarker(handle: NativeMarkerHandle, options: Partial<MarkerOptions>): void {
    const marker = this.markerReg.get(handle._handleId);
    if (options.position) marker.setPosition(new naver.maps.LatLng(options.position.lat, options.position.lng));
    if (options.icon !== undefined) marker.setIcon(buildNaverIcon(options.icon) ?? '');
    if (options.title !== undefined) marker.setTitle(options.title);
    if (options.visible !== undefined) marker.setVisible(options.visible);
    if (options.draggable !== undefined) marker.setDraggable(options.draggable);
    if (options.clickable !== undefined) marker.setClickable(options.clickable);
    if (options.zIndex !== undefined) marker.setZIndex(options.zIndex);
    if (options.opacity !== undefined) marker.setOpacity(options.opacity);
    if (options.animation !== undefined) {
      marker.setAnimation(
        options.animation === null ? null
          : options.animation === MarkerAnimation.BOUNCE ? naver.maps.Animation.BOUNCE
          : naver.maps.Animation.DROP,
      );
    }
  }

  addMarkerEvent(handle: NativeMarkerHandle, event: OverlayEvent, handler: AnyEventHandler): EventListener {
    const marker = this.markerReg.get(handle._handleId);
    naver.maps.Event.addListener(marker, event, handler as naver.maps.AnyListener);
    return makeEventListener(event);
  }

  removeMarkerEvent(handle: NativeMarkerHandle, event: OverlayEvent, _listener: EventListener): void {
    // Simplified — full impl would track listener objects
    void handle; void event;
  }

  // -------------------------------------------------------------------------
  // InfoWindow
  // -------------------------------------------------------------------------

  openInfoWindow(options: InfoWindowOptions, anchor?: NativeMarkerHandle): NativeInfoWindowHandle {
    const iw = new naver.maps.InfoWindow({
      content: options.content,
      position: options.position
        ? new naver.maps.LatLng(options.position.lat, options.position.lng)
        : undefined,
      maxWidth: options.maxWidth,
      zIndex: options.zIndex,
    });
    const marker = anchor ? this.markerReg.get(anchor._handleId) : undefined;
    iw.open(this.map, marker);
    return makeHandle(this.infoWindowReg.register(iw));
  }

  closeInfoWindow(handle: NativeInfoWindowHandle): void {
    this.infoWindowReg.get(handle._handleId).close();
  }

  updateInfoWindow(handle: NativeInfoWindowHandle, options: Partial<InfoWindowOptions>): void {
    const iw = this.infoWindowReg.get(handle._handleId);
    if (options.content !== undefined) iw.setContent(options.content);
    if (options.position) iw.setPosition(new naver.maps.LatLng(options.position.lat, options.position.lng));
    if (options.zIndex !== undefined) iw.setZIndex(options.zIndex);
  }

  isInfoWindowOpen(handle: NativeInfoWindowHandle): boolean {
    return this.infoWindowReg.get(handle._handleId).getMap() !== null;
  }

  // -------------------------------------------------------------------------
  // Vector overlays
  // -------------------------------------------------------------------------

  addPolyline(options: PolylineOptions): NativeOverlayHandle {
    const polyline = new naver.maps.Polyline({
      map: this.map,
      path: toNaverPath(options.path),
      strokeWeight: options.strokeWeight,
      strokeColor: options.strokeColor,
      strokeOpacity: options.strokeOpacity,
      strokeStyle: options.strokeStyle,
      geodesic: options.geodesic,
      clickable: options.clickable,
      zIndex: options.zIndex,
      visible: options.visible,
    });
    return makeHandle(this.overlayReg.register(polyline));
  }

  removePolyline(handle: NativeOverlayHandle): void {
    (this.overlayReg.get(handle._handleId) as naver.maps.Polyline).setMap(null);
    this.overlayReg.delete(handle._handleId);
  }

  updatePolyline(handle: NativeOverlayHandle, options: Partial<PolylineOptions>): void {
    (this.overlayReg.get(handle._handleId) as naver.maps.Polyline).setOptions({
      strokeColor: options.strokeColor,
      strokeWeight: options.strokeWeight,
      strokeOpacity: options.strokeOpacity,
    });
  }

  addPolygon(options: PolygonOptions): NativeOverlayHandle {
    const polygon = new naver.maps.Polygon({
      map: this.map,
      paths: toNaverPath(options.paths),
      strokeWeight: options.strokeWeight,
      strokeColor: options.strokeColor,
      strokeOpacity: options.strokeOpacity,
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
    (this.overlayReg.get(handle._handleId) as naver.maps.Polygon).setMap(null);
    this.overlayReg.delete(handle._handleId);
  }

  updatePolygon(handle: NativeOverlayHandle, options: Partial<PolygonOptions>): void {
    (this.overlayReg.get(handle._handleId) as naver.maps.Polygon).setOptions({
      strokeColor: options.strokeColor,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
    });
  }

  addCircle(options: CircleOptions): NativeOverlayHandle {
    const circle = new naver.maps.Circle({
      map: this.map,
      center: new naver.maps.LatLng(options.center.lat, options.center.lng),
      radius: options.radius,
      strokeWeight: options.strokeWeight,
      strokeColor: options.strokeColor,
      strokeOpacity: options.strokeOpacity,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
      clickable: options.clickable,
      zIndex: options.zIndex,
      visible: options.visible,
    });
    return makeHandle(this.overlayReg.register(circle));
  }

  removeCircle(handle: NativeOverlayHandle): void {
    (this.overlayReg.get(handle._handleId) as naver.maps.Circle).setMap(null);
    this.overlayReg.delete(handle._handleId);
  }

  updateCircle(handle: NativeOverlayHandle, options: Partial<CircleOptions>): void {
    const circle = this.overlayReg.get(handle._handleId) as naver.maps.Circle;
    if (options.center) circle.setCenter(new naver.maps.LatLng(options.center.lat, options.center.lng));
    if (options.radius !== undefined) circle.setRadius(options.radius);
    circle.setOptions({
      strokeColor: options.strokeColor,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
    });
  }

  addRectangle(options: RectangleOptions): NativeOverlayHandle {
    const rect = new naver.maps.Rectangle({
      map: this.map,
      bounds: new naver.maps.LatLngBounds(
        new naver.maps.LatLng(options.bounds.sw.lat, options.bounds.sw.lng),
        new naver.maps.LatLng(options.bounds.ne.lat, options.bounds.ne.lng),
      ),
      strokeWeight: options.strokeWeight,
      strokeColor: options.strokeColor,
      strokeOpacity: options.strokeOpacity,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
      clickable: options.clickable,
      zIndex: options.zIndex,
      visible: options.visible,
    });
    return makeHandle(this.overlayReg.register(rect));
  }

  removeRectangle(handle: NativeOverlayHandle): void {
    (this.overlayReg.get(handle._handleId) as naver.maps.Rectangle).setMap(null);
    this.overlayReg.delete(handle._handleId);
  }

  updateRectangle(handle: NativeOverlayHandle, options: Partial<RectangleOptions>): void {
    (this.overlayReg.get(handle._handleId) as naver.maps.Rectangle).setOptions({
      strokeColor: options.strokeColor,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
    });
  }

  addCustomOverlay(options: CustomOverlayOptions): NativeOverlayHandle {
    const self = this;
    const CustomOverlayClass = class extends naver.maps.OverlayView {
      onAdd(): void {
        this.getPanes().overlayLayer.appendChild(options.content);
      }
      onRemove(): void {
        options.content.parentNode?.removeChild(options.content);
      }
      draw(): void {
        const proj = this.getProjection();
        const pt = proj.fromCoordToOffset(
          new naver.maps.LatLng(options.position.lat, options.position.lng),
        );
        options.content.style.left = `${pt.x}px`;
        options.content.style.top = `${pt.y}px`;
        options.content.style.position = 'absolute';
      }
    };
    const overlay = new CustomOverlayClass();
    overlay.setMap(self.map);
    return makeHandle(this.overlayReg.register(overlay));
  }

  removeCustomOverlay(handle: NativeOverlayHandle): void {
    (this.overlayReg.get(handle._handleId) as naver.maps.OverlayView).setMap(null);
    this.overlayReg.delete(handle._handleId);
  }

  addTileLayer(options: TileLayerOptions): NativeOverlayHandle {
    const tileSize = options.tileSize ?? 256;
    const layer = new naver.maps.ImageTileLayer({
      getTileUrl: (x, y, z) => options.getTileUrl({ x, y }, z),
      tileSize: new naver.maps.Size(tileSize, tileSize),
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      opacity: options.opacity,
      zIndex: options.zIndex,
    });
    layer.setMap(this.map);
    return makeHandle(this.overlayReg.register(layer));
  }

  removeTileLayer(handle: NativeOverlayHandle): void {
    (this.overlayReg.get(handle._handleId) as naver.maps.ImageTileLayer).setMap(null);
    this.overlayReg.delete(handle._handleId);
  }

  // -------------------------------------------------------------------------
  // Projection
  // -------------------------------------------------------------------------

  getProjection(): MapProjection {
    const proj = this.map.getProjection();
    return {
      fromLatLngToPoint: (latlng) => {
        const pt = proj.fromCoordToOffset(new naver.maps.LatLng(latlng.lat, latlng.lng));
        return { x: pt.x, y: pt.y };
      },
      fromPointToLatLng: (point) => {
        const c = proj.fromOffsetToCoord(new naver.maps.Point(point.x, point.y));
        return { lat: c.lat(), lng: c.lng() };
      },
      fromLatLngToDivPixel: (latlng) => {
        const pt = proj.fromCoordToOffset(new naver.maps.LatLng(latlng.lat, latlng.lng));
        return { x: pt.x, y: pt.y };
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function resolveClientId(apiKey: string | import('../../core/types.js').KorMapApiKey): string {
  if (typeof apiKey === 'string') return apiKey;
  if (apiKey.clientId) return apiKey.clientId;
  throw new ConfigurationError('Naver Maps requires a clientId');
}

function normalizePaddingForNaver(
  padding?: Partial<import('../../core/types.js').Padding> | number,
): number | { top?: number; right?: number; bottom?: number; left?: number } {
  if (padding === undefined) return 0;
  if (typeof padding === 'number') return padding;
  return { top: padding.top, right: padding.right, bottom: padding.bottom, left: padding.left };
}

function toNaverLatLng(latlng: LatLng): naver.maps.LatLng {
  return new naver.maps.LatLng(latlng.lat, latlng.lng);
}

function toNaverPath(path: LatLng[] | LatLng[][]): naver.maps.LatLng[] | naver.maps.LatLng[][] {
  if (path.length === 0) return [];
  const first = path[0];
  if (Array.isArray(first)) {
    return (path as LatLng[][]).map(ring => ring.map(toNaverLatLng));
  }
  return (path as LatLng[]).map(toNaverLatLng);
}

function buildNaverIcon(icon: MarkerOptions['icon']): string | naver.maps.MarkerIconOptions | undefined {
  if (!icon) return undefined;
  if (typeof icon === 'string') return icon;
  return {
    url: icon.url,
    size: icon.size ? new naver.maps.Size(icon.size.width, icon.size.height) : undefined,
    scaledSize: icon.scaledSize ? new naver.maps.Size(icon.scaledSize.width, icon.scaledSize.height) : undefined,
    origin: icon.origin ? new naver.maps.Point(icon.origin.x, icon.origin.y) : undefined,
    anchor: icon.anchor ? new naver.maps.Point(icon.anchor.x, icon.anchor.y) : undefined,
  };
}
