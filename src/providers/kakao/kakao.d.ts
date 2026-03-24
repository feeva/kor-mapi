/**
 * Minimal Kakao Maps JavaScript API v3 type declarations.
 * Only the surface area used by KakaoAdapter is declared here.
 * Full official types are not published by Kakao.
 */
declare namespace kakao {
  namespace maps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type AnyListener = (...args: any[]) => void;

    class LatLng {
      constructor(lat: number, lng: number);
      getLat(): number;
      getLng(): number;
    }

    class LatLngBounds {
      constructor(sw: LatLng, ne: LatLng);
      getSouthWest(): LatLng;
      getNorthEast(): LatLng;
      extend(latlng: LatLng): void;
    }

    class Point {
      constructor(x: number, y: number);
      getX(): number;
      getY(): number;
    }

    class Size {
      constructor(width: number, height: number);
    }

    type MapTypeId =
      | 'ROADMAP'
      | 'SKYVIEW'
      | 'HYBRID'
      | 'OVERLAY'
      | 'ROADVIEW'
      | 'TRAFFIC'
      | 'TERRAIN'
      | 'BICYCLE'
      | 'BICYCLE_HYBRID'
      | 'USE_DISTRICT';

    interface MapOptions {
      center: LatLng;
      level: number;
      mapTypeId?: MapTypeId;
    }

    class Map {
      constructor(container: HTMLElement, options: MapOptions);
      setCenter(latlng: LatLng): void;
      getCenter(): LatLng;
      setLevel(level: number, options?: { animate?: boolean; anchor?: LatLng }): void;
      getLevel(): number;
      setBounds(bounds: LatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number): void;
      getBounds(): LatLngBounds;
      panTo(latlng: LatLng): void;
      panBy(dx: number, dy: number): void;
      setMapTypeId(mapTypeId: MapTypeId): void;
      getMapTypeId(): MapTypeId;
      destroy(): void;
    }

    class MarkerImage {
      constructor(src: string, size: Size, options?: { spriteOrigin?: Point; spriteSize?: Size; offset?: Point });
    }

    interface MarkerOptions {
      map?: Map;
      position: LatLng;
      image?: MarkerImage;
      title?: string;
      draggable?: boolean;
      clickable?: boolean;
      zIndex?: number;
      opacity?: number;
    }

    class Marker {
      constructor(options: MarkerOptions);
      setMap(map: Map | null): void;
      getMap(): Map | null;
      setPosition(latlng: LatLng): void;
      getPosition(): LatLng;
      setImage(image: MarkerImage): void;
      setTitle(title: string): void;
      setDraggable(draggable: boolean): void;
      setClickable(clickable: boolean): void;
      setZIndex(zIndex: number): void;
      setOpacity(opacity: number): void;
      setVisible(visible: boolean): void;
    }

    interface InfoWindowOptions {
      content: string | HTMLElement;
      position?: LatLng;
      removable?: boolean;
      zIndex?: number;
    }

    class InfoWindow {
      constructor(options: InfoWindowOptions);
      open(map: Map, marker?: Marker): void;
      close(): void;
      setContent(content: string | HTMLElement): void;
      getContent(): string | HTMLElement;
      setPosition(latlng: LatLng): void;
      setZIndex(zIndex: number): void;
    }

    interface PolylineOptions {
      map?: Map;
      path: LatLng[] | LatLng[][];
      strokeWeight?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeStyle?: 'solid' | 'shortdash' | 'longdash' | 'dash' | 'dot' | 'dashdot' | 'longdashdot';
      endArrow?: boolean;
      zIndex?: number;
    }

    class Polyline {
      constructor(options: PolylineOptions);
      setMap(map: Map | null): void;
      setOptions(options: Partial<PolylineOptions>): void;
      getPath(): LatLng[];
    }

    interface PolygonOptions {
      map?: Map;
      path: LatLng[] | LatLng[][];
      strokeWeight?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeStyle?: string;
      fillColor?: string;
      fillOpacity?: number;
      zIndex?: number;
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
      strokeStyle?: string;
      fillColor?: string;
      fillOpacity?: number;
      zIndex?: number;
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
      strokeStyle?: string;
      fillColor?: string;
      fillOpacity?: number;
      zIndex?: number;
    }

    class Rectangle {
      constructor(options: RectangleOptions);
      setMap(map: Map | null): void;
      setOptions(options: Partial<RectangleOptions>): void;
    }

    abstract class AbstractOverlay {
      abstract onAdd(): void;
      abstract onRemove(): void;
      abstract draw(): void;
      setMap(map: Map | null): void;
      getMap(): Map | null;
      getPanels(): { overlayLayer: HTMLElement };
      getProjection(): Projection;
    }

    class Projection {
      pointFromCoords(latlng: LatLng): Point;
      coordsFromPoint(point: Point): LatLng;
      containerPointFromCoords(latlng: LatLng): Point;
    }

    interface TileLayerOptions {
      getTile: (x: number, y: number, z: number) => HTMLElement;
    }

    class TileLayer extends AbstractOverlay {
      constructor(options: TileLayerOptions);
      onAdd(): void;
      onRemove(): void;
      draw(): void;
    }

    namespace event {
      function addListener(target: object, type: string, handler: AnyListener): object;
      function removeListener(target: object, type: string, handler: AnyListener): void;
      function trigger(target: object, type: string, data?: object): void;
    }

    namespace MapTypeId {
      const ROADMAP: 'ROADMAP';
      const SKYVIEW: 'SKYVIEW';
      const HYBRID: 'HYBRID';
      const TERRAIN: 'TERRAIN';
    }
  }
}
