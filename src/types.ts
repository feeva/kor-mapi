// Types-only entry point — zero runtime cost
export type {
  LatLng, LatLngBounds, Point, Size, Padding,
  MapProvider,
  KorMapConfig, KorMapApiKey,
  KorMapFeature,
  KorMapEvent, OverlayEvent, MapMouseEvent, EventListener,
  AnyEventHandler, MapEventHandler, GenericEventHandler,
  MarkerOptions, MarkerIcon, MarkerLabel,
  InfoWindowOptions,
  StrokeStyle, FillStyle,
  PolylineOptions, PolygonOptions, CircleOptions, RectangleOptions,
  CustomOverlayOptions, MapProjection,
  TileLayerOptions, TileCoord,
  FitBoundsOptions, PanOptions,
} from './core/types.js';

export { MapTypeId, MarkerAnimation } from './core/types.js';
export type { KorMapError, ProviderLoadError, ProviderNotSupportedError, ConfigurationError } from './core/errors.js';
