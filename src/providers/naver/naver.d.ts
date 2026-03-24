/**
 * Minimal Naver Maps JavaScript API v3 type declarations.
 * Only the surface area used by NaverAdapter is declared here.
 */
declare namespace naver {
  namespace maps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type AnyListener = (...args: any[]) => void;

    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
      x: number;
      y: number;
    }

    class LatLngBounds {
      constructor(sw: LatLng, ne: LatLng);
      getSW(): LatLng;
      getNE(): LatLng;
      extend(point: LatLng): void;
    }

    class Point {
      constructor(x: number, y: number);
      x: number;
      y: number;
    }

    class Size {
      constructor(width: number, height: number);
      width: number;
      height: number;
    }

    type MapTypeId =
      | 'NORMAL'
      | 'TERRAIN'
      | 'SATELLITE'
      | 'HYBRID';

    interface MapOptions {
      center: LatLng;
      zoom: number;
      mapTypeId?: MapTypeId;
    }

    class Map {
      constructor(container: HTMLElement | string, options: MapOptions);
      setCenter(latlng: LatLng): void;
      getCenter(): LatLng;
      setZoom(zoom: number, animate?: boolean): void;
      getZoom(): number;
      fitBounds(bounds: LatLngBounds | LatLng[], options?: { padding?: number | { top?: number; right?: number; bottom?: number; left?: number } }): void;
      getBounds(): LatLngBounds;
      panTo(latlng: LatLng, options?: { duration?: number; easing?: string }): void;
      panBy(x: number, y: number): void;
      setMapTypeId(typeId: MapTypeId): void;
      getMapTypeId(): MapTypeId;
      destroy(): void;
      getProjection(): MapProjection;
    }

    interface MarkerIconOptions {
      url: string;
      size?: Size;
      scaledSize?: Size;
      origin?: Point;
      anchor?: Point;
    }

    interface MarkerOptions {
      map?: Map;
      position: LatLng;
      icon?: string | MarkerIconOptions;
      title?: string;
      zIndex?: number;
      visible?: boolean;
      draggable?: boolean;
      opacity?: number;
      clickable?: boolean;
      animation?: Animation;
    }

    enum Animation {
      BOUNCE = 'BOUNCE',
      DROP = 'DROP',
      NONE = 'NONE',
    }

    class Marker {
      constructor(options: MarkerOptions);
      setMap(map: Map | null): void;
      getMap(): Map | null;
      setPosition(latlng: LatLng): void;
      getPosition(): LatLng;
      setIcon(icon: string | MarkerIconOptions): void;
      setTitle(title: string): void;
      setVisible(visible: boolean): void;
      setDraggable(draggable: boolean): void;
      setClickable(clickable: boolean): void;
      setZIndex(zIndex: number): void;
      setOpacity(opacity: number): void;
      setAnimation(animation: Animation | null): void;
    }

    interface InfoWindowOptions {
      content: string | HTMLElement;
      position?: LatLng;
      maxWidth?: number;
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
      disableAnchor?: boolean;
      pixelOffset?: Point;
      zIndex?: number;
    }

    class InfoWindow {
      constructor(options: InfoWindowOptions);
      open(map: Map, anchor?: Marker): void;
      close(): void;
      setContent(content: string | HTMLElement): void;
      getContent(): string | HTMLElement;
      setPosition(latlng: LatLng): void;
      setZIndex(zIndex: number): void;
      getMap(): Map | null;
    }

    interface PolylineOptions {
      map?: Map;
      path: LatLng[] | LatLng[][];
      strokeWeight?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeStyle?: 'solid' | 'shortdash' | 'longdash' | 'dash' | 'dot' | 'dashdot' | 'longdashdot';
      geodesic?: boolean;
      clickable?: boolean;
      zIndex?: number;
      visible?: boolean;
    }

    class Polyline {
      constructor(options: PolylineOptions);
      setMap(map: Map | null): void;
      setOptions(options: Partial<PolylineOptions>): void;
      getPath(): LatLng[];
    }

    interface PolygonOptions {
      map?: Map;
      paths: LatLng[] | LatLng[][];
      strokeWeight?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      fillColor?: string;
      fillOpacity?: number;
      geodesic?: boolean;
      clickable?: boolean;
      zIndex?: number;
      visible?: boolean;
    }

    class Polygon {
      constructor(options: PolygonOptions);
      setMap(map: Map | null): void;
      setOptions(options: Partial<PolygonOptions>): void;
    }

    interface CircleOptions {
      map?: Map;
      center: LatLng;
      radius: number;
      strokeWeight?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      fillColor?: string;
      fillOpacity?: number;
      clickable?: boolean;
      zIndex?: number;
      visible?: boolean;
    }

    class Circle {
      constructor(options: CircleOptions);
      setMap(map: Map | null): void;
      setOptions(options: Partial<CircleOptions>): void;
      setCenter(latlng: LatLng): void;
      setRadius(radius: number): void;
    }

    interface RectangleOptions {
      map?: Map;
      bounds: LatLngBounds;
      strokeWeight?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      fillColor?: string;
      fillOpacity?: number;
      clickable?: boolean;
      zIndex?: number;
      visible?: boolean;
    }

    class Rectangle {
      constructor(options: RectangleOptions);
      setMap(map: Map | null): void;
      setOptions(options: Partial<RectangleOptions>): void;
    }

    abstract class OverlayView {
      abstract onAdd(): void;
      abstract onRemove(): void;
      abstract draw(): void;
      setMap(map: Map | null): void;
      getMap(): Map | null;
      getPanes(): { overlayLayer: HTMLElement };
      getProjection(): MapProjection;
    }

    interface MapProjection {
      fromCoordToOffset(coord: LatLng): Point;
      fromOffsetToCoord(offset: Point): LatLng;
    }

    interface ImageTileLayerOptions {
      getTileUrl: (x: number, y: number, z: number, scale?: number) => string;
      tileSize?: Size;
      minZoom?: number;
      maxZoom?: number;
      opacity?: number;
      zIndex?: number;
    }

    class ImageTileLayer {
      constructor(options: ImageTileLayerOptions);
      setMap(map: Map | null): void;
    }

    namespace Event {
      function addListener(target: object, type: string, handler: AnyListener): object;
      function removeListener(instance: object): void;
      function trigger(target: object, type: string, data?: object): void;
    }

    namespace MapTypeId {
      const NORMAL: 'NORMAL';
      const TERRAIN: 'TERRAIN';
      const SATELLITE: 'SATELLITE';
      const HYBRID: 'HYBRID';
    }
  }
}
