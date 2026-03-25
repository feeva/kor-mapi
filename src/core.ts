// Core classes only — no adapter code bundled
export { KorMap } from './core/KorMap.js';
export { Marker, InfoWindow, Polyline, Polygon, Circle, Rectangle, CustomOverlay, TileLayer } from './core/overlays.js';
export { KorMapError, ProviderLoadError, ProviderNotSupportedError, ConfigurationError } from './core/errors.js';
export { MapTypeId, MarkerAnimation } from './core/types.js';
export type {
  LatLng, LatLngBounds, Point, Size, Padding,
  MapProvider, KorMapConfig, KorMapApiKey, KorMapFeature,
  KorMapEvent, OverlayEvent, MapMouseEvent, EventListener,
  MarkerOptions, MarkerIcon, MarkerLabel,
  InfoWindowOptions,
  StrokeStyle, FillStyle,
  PolylineOptions, PolygonOptions, CircleOptions, RectangleOptions,
  CustomOverlayOptions, MapProjection, TileLayerOptions, TileCoord,
  FitBoundsOptions, PanOptions,
  AnyEventHandler,
  ClusterOptions, ClusterStyle,
} from './core/types.js';
