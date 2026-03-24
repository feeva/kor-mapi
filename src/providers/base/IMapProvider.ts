import type {
  LatLng,
  LatLngBounds,
  MapTypeId,
  MapProvider,
  KorMapFeature,
  KorMapConfig,
  KorMapEvent,
  OverlayEvent,
  AnyEventHandler,
  EventListener,
  FitBoundsOptions,
  PanOptions,
  MarkerOptions,
  InfoWindowOptions,
  PolylineOptions,
  PolygonOptions,
  CircleOptions,
  RectangleOptions,
  CustomOverlayOptions,
  TileLayerOptions,
  MapProjection,
} from '../../core/types.js';

/**
 * The contract every provider adapter must implement.
 *
 * All zoom values crossing this interface are in the facade's 0–22 scale
 * (Google-style, 0 = world view, 22 = building level). Adapters are
 * responsible for translating to/from their native scale internally.
 *
 * All coordinate values are WGS84 LatLng.
 */
export interface IMapProvider {
  readonly provider: MapProvider;

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Initialize the native map inside the given container element. */
  init(container: HTMLElement, config: KorMapConfig): Promise<void>;

  /** Destroy the map and release all resources. */
  destroy(): void;

  // -------------------------------------------------------------------------
  // Camera / viewport
  // -------------------------------------------------------------------------

  setCenter(latlng: LatLng): void;
  getCenter(): LatLng;

  /** @param zoom Facade zoom level 0–22 */
  setZoom(zoom: number): void;
  /** @returns Facade zoom level 0–22 */
  getZoom(): number;

  getBounds(): LatLngBounds;
  fitBounds(bounds: LatLngBounds, options?: FitBoundsOptions): void;
  panTo(latlng: LatLng, options?: PanOptions): void;
  panBy(x: number, y: number): void;

  // -------------------------------------------------------------------------
  // Map type
  // -------------------------------------------------------------------------

  setMapType(type: MapTypeId): void;
  getMapType(): MapTypeId;

  // -------------------------------------------------------------------------
  // Capability
  // -------------------------------------------------------------------------

  supports(feature: KorMapFeature): boolean;

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  on(event: KorMapEvent, handler: AnyEventHandler): EventListener;
  once(event: KorMapEvent, handler: AnyEventHandler): EventListener;
  off(event: KorMapEvent, listener: EventListener): void;

  // -------------------------------------------------------------------------
  // Overlays
  // -------------------------------------------------------------------------

  addMarker(options: MarkerOptions): NativeMarkerHandle;
  removeMarker(handle: NativeMarkerHandle): void;
  updateMarker(handle: NativeMarkerHandle, options: Partial<MarkerOptions>): void;
  addMarkerEvent(handle: NativeMarkerHandle, event: OverlayEvent, handler: AnyEventHandler): EventListener;
  removeMarkerEvent(handle: NativeMarkerHandle, event: OverlayEvent, listener: EventListener): void;

  openInfoWindow(options: InfoWindowOptions, anchor?: NativeMarkerHandle): NativeInfoWindowHandle;
  closeInfoWindow(handle: NativeInfoWindowHandle): void;
  updateInfoWindow(handle: NativeInfoWindowHandle, options: Partial<InfoWindowOptions>): void;
  isInfoWindowOpen(handle: NativeInfoWindowHandle): boolean;

  addPolyline(options: PolylineOptions): NativeOverlayHandle;
  removePolyline(handle: NativeOverlayHandle): void;
  updatePolyline(handle: NativeOverlayHandle, options: Partial<PolylineOptions>): void;

  addPolygon(options: PolygonOptions): NativeOverlayHandle;
  removePolygon(handle: NativeOverlayHandle): void;
  updatePolygon(handle: NativeOverlayHandle, options: Partial<PolygonOptions>): void;

  addCircle(options: CircleOptions): NativeOverlayHandle;
  removeCircle(handle: NativeOverlayHandle): void;
  updateCircle(handle: NativeOverlayHandle, options: Partial<CircleOptions>): void;

  addRectangle(options: RectangleOptions): NativeOverlayHandle;
  removeRectangle(handle: NativeOverlayHandle): void;
  updateRectangle(handle: NativeOverlayHandle, options: Partial<RectangleOptions>): void;

  addCustomOverlay(options: CustomOverlayOptions): NativeOverlayHandle;
  removeCustomOverlay(handle: NativeOverlayHandle): void;

  addTileLayer(options: TileLayerOptions): NativeOverlayHandle;
  removeTileLayer(handle: NativeOverlayHandle): void;

  // -------------------------------------------------------------------------
  // Projection
  // -------------------------------------------------------------------------

  getProjection(): MapProjection;

  // -------------------------------------------------------------------------
  // Native access
  // -------------------------------------------------------------------------

  /** The raw underlying map object. Type depends on provider. */
  readonly nativeMap: unknown;
}

/**
 * Opaque handle referencing a native marker instance inside an adapter.
 * The adapter stores the actual native object and looks it up by handle id.
 */
export interface NativeMarkerHandle {
  readonly _handleId: number;
}

/**
 * Opaque handle referencing a native overlay (polyline, polygon, circle, etc.)
 * or info window inside an adapter.
 */
export interface NativeOverlayHandle {
  readonly _handleId: number;
}

/** Opaque handle referencing a native info window instance. */
export interface NativeInfoWindowHandle {
  readonly _handleId: number;
}
