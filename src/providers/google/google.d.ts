/**
 * Minimal Google Maps JavaScript API v3 type declarations.
 * Only the surface area used by GoogleAdapter is declared here.
 * Official types available via @types/google.maps but we declare
 * a subset to keep zero production dependencies.
 */
declare namespace google {
  namespace maps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type AnyListener = (...args: any[]) => void;

    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }

    class LatLngBounds {
      constructor(sw?: LatLng, ne?: LatLng);
      getSouthWest(): LatLng;
      getNorthEast(): LatLng;
      extend(point: LatLng): LatLngBounds;
    }

    class Point {
      constructor(x: number, y: number);
      x: number;
      y: number;
    }

    class Size {
      constructor(width: number, height: number, widthUnit?: string, heightUnit?: string);
      width: number;
      height: number;
    }

    enum MapTypeId {
      ROADMAP = 'roadmap',
      SATELLITE = 'satellite',
      HYBRID = 'hybrid',
      TERRAIN = 'terrain',
    }

    enum Animation {
      BOUNCE = 1,
      DROP = 2,
    }

    interface MapOptions {
      center?: LatLng;
      zoom?: number;
      minZoom?: number;
      maxZoom?: number;
      mapTypeId?: MapTypeId;
      disableDefaultUI?: boolean;
      mapId?: string;
    }

    class Map {
      constructor(mapDiv: HTMLElement, opts?: MapOptions);
      setCenter(latlng: LatLng): void;
      getCenter(): LatLng | undefined;
      setZoom(zoom: number): void;
      getZoom(): number | undefined;
      fitBounds(bounds: LatLngBounds, padding?: number | Padding): void;
      getBounds(): LatLngBounds | null;
      panTo(latlng: LatLng): void;
      panBy(x: number, y: number): void;
      setMapTypeId(mapTypeId: MapTypeId | string): void;
      getMapTypeId(): string;
      getProjection(): Projection | null;
      overlayMapTypes: MVCArray<ImageMapType | null>;
    }

    interface Padding {
      top: number;
      right: number;
      bottom: number;
      left: number;
    }

    interface Icon {
      url: string;
      size?: Size;
      scaledSize?: Size;
      origin?: Point;
      anchor?: Point;
    }

    interface MarkerLabel {
      text: string;
      color?: string;
      fontSize?: string;
      fontWeight?: string;
    }

    interface MarkerOptions {
      map?: Map;
      position?: LatLng;
      icon?: string | Icon;
      title?: string;
      zIndex?: number;
      visible?: boolean;
      draggable?: boolean;
      opacity?: number;
      label?: string | MarkerLabel;
      clickable?: boolean;
      animation?: Animation;
    }

    class Marker {
      constructor(opts?: MarkerOptions);
      setMap(map: Map | null): void;
      getMap(): Map | null;
      setPosition(latlng: LatLng): void;
      getPosition(): LatLng | undefined;
      setIcon(icon: string | Icon): void;
      setTitle(title: string): void;
      setLabel(label: string | MarkerLabel): void;
      setVisible(visible: boolean): void;
      setDraggable(draggable: boolean): void;
      setClickable(clickable: boolean): void;
      setZIndex(zIndex: number): void;
      setOpacity(opacity: number): void;
      setAnimation(animation: Animation | null): void;
      addListener(event: string, handler: AnyListener): MapsEventListener;
    }

    class InfoWindow {
      constructor(opts?: InfoWindowOptions);
      open(opts?: { map?: Map; anchor?: Marker | marker.AdvancedMarkerElement }): void;
      close(): void;
      setContent(content: string | HTMLElement): void;
      getContent(): string | HTMLElement | null;
      setPosition(latlng: LatLng): void;
      setZIndex(zIndex: number): void;
      getMap(): Map | null;
    }

    interface InfoWindowOptions {
      content?: string | HTMLElement;
      position?: LatLng;
      maxWidth?: number;
      disableAutoPan?: boolean;
      zIndex?: number;
    }

    interface PolylineOptions {
      map?: Map;
      path?: LatLng[];
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
      geodesic?: boolean;
      clickable?: boolean;
      zIndex?: number;
      visible?: boolean;
    }

    class Polyline {
      constructor(opts?: PolylineOptions);
      setMap(map: Map | null): void;
      setOptions(opts: PolylineOptions): void;
      getPath(): MVCArray<LatLng>;
    }

    interface PolygonOptions {
      map?: Map;
      paths?: LatLng[] | LatLng[][];
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
      fillColor?: string;
      fillOpacity?: number;
      geodesic?: boolean;
      clickable?: boolean;
      zIndex?: number;
      visible?: boolean;
    }

    class Polygon {
      constructor(opts?: PolygonOptions);
      setMap(map: Map | null): void;
      setOptions(opts: PolygonOptions): void;
    }

    interface CircleOptions {
      map?: Map;
      center?: LatLng;
      radius?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
      fillColor?: string;
      fillOpacity?: number;
      clickable?: boolean;
      zIndex?: number;
      visible?: boolean;
    }

    class Circle {
      constructor(opts?: CircleOptions);
      setMap(map: Map | null): void;
      setOptions(opts: CircleOptions): void;
      setCenter(latlng: LatLng): void;
      setRadius(radius: number): void;
    }

    interface RectangleOptions {
      map?: Map;
      bounds?: LatLngBounds;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
      fillColor?: string;
      fillOpacity?: number;
      clickable?: boolean;
      zIndex?: number;
      visible?: boolean;
    }

    class Rectangle {
      constructor(opts?: RectangleOptions);
      setMap(map: Map | null): void;
      setOptions(opts: RectangleOptions): void;
    }

    abstract class OverlayView {
      abstract onAdd(): void;
      abstract onRemove(): void;
      abstract draw(): void;
      setMap(map: Map | null): void;
      getMap(): Map | null;
      getPanes(): MapPanes | null;
      getProjection(): MapCanvasProjection;
    }

    interface MapPanes {
      overlayLayer: HTMLElement;
    }

    interface MapCanvasProjection {
      fromLatLngToContainerPixel(latlng: LatLng): Point;
      fromContainerPixelToLatLng(pixel: Point): LatLng;
      fromLatLngToDivPixel(latlng: LatLng): Point | null;
    }

    class Projection {
      fromLatLngToPoint(latLng: LatLng): Point | null;
      fromPointToLatLng(pixel: Point, nowrap?: boolean): LatLng | null;
    }

    class ImageMapType {
      constructor(opts: ImageMapTypeOptions);
      setOpacity(opacity: number): void;
    }

    interface ImageMapTypeOptions {
      getTileUrl: (coord: Point, zoom: number) => string;
      tileSize: Size;
      minZoom?: number;
      maxZoom?: number;
      opacity?: number;
      name?: string;
      alt?: string;
    }

    interface MapsEventListener {
      remove(): void;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    class MVCArray<T> {
      getArray(): T[];
      getAt(i: number): T;
      getLength(): number;
      push(elem: T): number;
      removeAt(i: number): T;
    }

    namespace event {
      function addListener(instance: object, eventName: string, handler: AnyListener): MapsEventListener;
      function removeListener(listener: MapsEventListener): void;
      function trigger(instance: object, eventName: string, ...args: unknown[]): void;
    }

    namespace marker {
      interface AdvancedMarkerElementOptions {
        map?: Map;
        position?: { lat: number; lng: number } | LatLng | null;
        title?: string;
        content?: HTMLElement | null;
        gmpClickable?: boolean;
        gmpDraggable?: boolean;
        zIndex?: number | null;
      }

      class AdvancedMarkerElement {
        constructor(options?: AdvancedMarkerElementOptions);
        map: Map | null;
        position: { lat: number; lng: number } | LatLng | null;
        title: string;
        content: HTMLElement | null;
        zIndex: number | null;
        gmpDraggable: boolean;
        gmpClickable: boolean;
        addListener(eventName: string, handler: AnyListener): MapsEventListener;
      }
    }
  }
}
