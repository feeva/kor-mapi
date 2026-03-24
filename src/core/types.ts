// ---------------------------------------------------------------------------
// Geometry primitives
// ---------------------------------------------------------------------------

export interface LatLng {
  lat: number;
  lng: number;
}

export interface LatLngBounds {
  sw: LatLng;
  ne: LatLng;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export type MapProvider = 'naver' | 'kakao' | 'google';

// ---------------------------------------------------------------------------
// Map types
// ---------------------------------------------------------------------------

export enum MapTypeId {
  ROADMAP = 'roadmap',
  SATELLITE = 'satellite',
  HYBRID = 'hybrid',
  TERRAIN = 'terrain',
}

// ---------------------------------------------------------------------------
// Feature capability keys
// ---------------------------------------------------------------------------

export type KorMapFeature =
  | 'tilt'
  | 'heading'
  | 'mapStyles'
  | 'elevation'
  | 'streetview'
  | 'trafficLayer'
  | 'heatmap'
  | 'drawing'
  | 'transit'
  | 'adminBoundaries';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface KorMapApiKey {
  /** Naver Maps: NCP client ID */
  clientId?: string;
  /** Kakao Maps: app key */
  appKey?: string;
  /** Google Maps: API key */
  apiKey?: string;
}

export interface KorMapConfig<P extends MapProvider = MapProvider> {
  provider: P;
  container: HTMLElement | string;
  apiKey: string | KorMapApiKey;
  locale?: 'ko' | 'en';
  center?: LatLng;
  /** Facade zoom level 0–22 (Google-style). Default: 10 */
  zoom?: number;
  mapType?: MapTypeId;
  /** Proxy URL for Naver/Kakao routing REST calls (required for routing on these providers) */
  proxyUrl?: string;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type KorMapEvent =
  | 'click'
  | 'dblclick'
  | 'rightclick'
  | 'mousemove'
  | 'mouseover'
  | 'mouseout'
  | 'dragstart'
  | 'drag'
  | 'dragend'
  | 'zoom_changed'
  | 'center_changed'
  | 'bounds_changed'
  | 'maptype_changed'
  | 'idle'
  | 'tilesloaded'
  | 'load';

export type OverlayEvent =
  | 'click'
  | 'dblclick'
  | 'rightclick'
  | 'mouseover'
  | 'mouseout'
  | 'mousemove'
  | 'dragstart'
  | 'drag'
  | 'dragend'
  | 'position_changed'
  | 'visible_changed';

export interface MapMouseEvent {
  latlng: LatLng;
  point: Point;
  domEvent: MouseEvent;
}

/** Opaque token returned by on() / once(), used to call off() */
export interface EventListener {
  readonly _type: string;
  readonly _id: number;
}

export type MapEventHandler = (event: MapMouseEvent) => void;
export type GenericEventHandler = () => void;
export type AnyEventHandler = MapEventHandler | GenericEventHandler;

// ---------------------------------------------------------------------------
// Marker
// ---------------------------------------------------------------------------

export enum MarkerAnimation {
  BOUNCE = 'bounce',
  DROP = 'drop',
}

export interface MarkerIcon {
  url: string;
  size?: Size;
  scaledSize?: Size;
  /** Offset from top-left of icon image to the pin point */
  anchor?: Point;
  /** Origin within a sprite sheet */
  origin?: Point;
}

export interface MarkerLabel {
  text: string;
  color?: string;
  fontSize?: string;
  fontWeight?: string;
}

export interface MarkerOptions {
  position: LatLng;
  icon?: MarkerIcon | string;
  title?: string;
  zIndex?: number;
  visible?: boolean;
  draggable?: boolean;
  opacity?: number;
  label?: MarkerLabel;
  clickable?: boolean;
  animation?: MarkerAnimation;
}

// ---------------------------------------------------------------------------
// InfoWindow
// ---------------------------------------------------------------------------

export interface InfoWindowOptions {
  content: string | HTMLElement;
  position?: LatLng;
  maxWidth?: number;
  disableAutoPan?: boolean;
  zIndex?: number;
}

// ---------------------------------------------------------------------------
// Shared overlay styles
// ---------------------------------------------------------------------------

export interface StrokeStyle {
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  strokeStyle?: 'solid' | 'shortdash' | 'dot' | 'dashdot';
}

export interface FillStyle {
  fillColor?: string;
  fillOpacity?: number;
}

// ---------------------------------------------------------------------------
// Vector overlays
// ---------------------------------------------------------------------------

export interface PolylineOptions extends StrokeStyle {
  path: LatLng[] | LatLng[][];
  geodesic?: boolean;
  clickable?: boolean;
  zIndex?: number;
  visible?: boolean;
}

export interface PolygonOptions extends StrokeStyle, FillStyle {
  /** First array = outer ring; subsequent arrays = holes */
  paths: LatLng[] | LatLng[][];
  geodesic?: boolean;
  clickable?: boolean;
  zIndex?: number;
  visible?: boolean;
}

export interface CircleOptions extends StrokeStyle, FillStyle {
  center: LatLng;
  /** Radius in meters */
  radius: number;
  clickable?: boolean;
  zIndex?: number;
  visible?: boolean;
}

export interface RectangleOptions extends StrokeStyle, FillStyle {
  bounds: LatLngBounds;
  clickable?: boolean;
  zIndex?: number;
  visible?: boolean;
}

// ---------------------------------------------------------------------------
// Custom HTML overlay
// ---------------------------------------------------------------------------

export interface CustomOverlayOptions {
  position: LatLng;
  content: HTMLElement;
  zIndex?: number;
  visible?: boolean;
  clickable?: boolean;
}

export interface MapProjection {
  fromLatLngToPoint(latlng: LatLng): Point;
  fromPointToLatLng(point: Point): LatLng;
  fromLatLngToDivPixel(latlng: LatLng): Point;
}

// ---------------------------------------------------------------------------
// Tile layer
// ---------------------------------------------------------------------------

export interface TileCoord {
  x: number;
  y: number;
}

export interface TileLayerOptions {
  getTileUrl: (coord: TileCoord, zoom: number) => string;
  tileSize?: number;
  minZoom?: number;
  maxZoom?: number;
  opacity?: number;
  zIndex?: number;
  attribution?: string;
}

// ---------------------------------------------------------------------------
// Camera / viewport
// ---------------------------------------------------------------------------

export interface FitBoundsOptions {
  padding?: Partial<Padding> | number;
  animate?: boolean;
}

export interface PanOptions {
  animate?: boolean;
  duration?: number;
}
