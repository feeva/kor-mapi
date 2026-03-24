import type { KorMap } from './KorMap.js';
import type { NativeMarkerHandle, NativeOverlayHandle, NativeInfoWindowHandle } from '../providers/base/IMapProvider.js';
import {
  type MarkerOptions, type InfoWindowOptions,
  type PolylineOptions, type PolygonOptions, type CircleOptions, type RectangleOptions,
  type CustomOverlayOptions, type TileLayerOptions,
  type OverlayEvent, type AnyEventHandler, type EventListener, type LatLng,
} from './types.js';

// ---------------------------------------------------------------------------
// Marker
// ---------------------------------------------------------------------------

export class Marker {
  private handle: NativeMarkerHandle | null = null;
  private currentMap: KorMap | null = null;

  constructor(private options: MarkerOptions) {}

  setMap(map: KorMap | null): void {
    if (this.currentMap && this.handle) {
      this.currentMap._adapter().removeMarker(this.handle);
      this.handle = null;
      this.currentMap = null;
    }
    if (map) {
      this.handle = map._adapter().addMarker(this.options);
      this.currentMap = map;
    }
  }

  getMap(): KorMap | null {
    return this.currentMap;
  }

  setPosition(latlng: LatLng): void {
    this.options = { ...this.options, position: latlng };
    if (this.handle && this.currentMap) {
      this.currentMap._adapter().updateMarker(this.handle, { position: latlng });
    }
  }

  getPosition(): LatLng {
    return this.options.position;
  }

  setVisible(visible: boolean): void {
    this.options = { ...this.options, visible };
    if (this.handle && this.currentMap) {
      this.currentMap._adapter().updateMarker(this.handle, { visible });
    }
  }

  setOpacity(opacity: number): void {
    this.options = { ...this.options, opacity };
    if (this.handle && this.currentMap) {
      this.currentMap._adapter().updateMarker(this.handle, { opacity });
    }
  }

  setZIndex(zIndex: number): void {
    this.options = { ...this.options, zIndex };
    if (this.handle && this.currentMap) {
      this.currentMap._adapter().updateMarker(this.handle, { zIndex });
    }
  }

  setDraggable(draggable: boolean): void {
    this.options = { ...this.options, draggable };
    if (this.handle && this.currentMap) {
      this.currentMap._adapter().updateMarker(this.handle, { draggable });
    }
  }

  setIcon(icon: MarkerOptions['icon']): void {
    this.options = { ...this.options, icon };
    if (this.handle && this.currentMap) {
      this.currentMap._adapter().updateMarker(this.handle, { icon });
    }
  }

  setOptions(options: Partial<MarkerOptions>): void {
    this.options = { ...this.options, ...options };
    if (this.handle && this.currentMap) {
      this.currentMap._adapter().updateMarker(this.handle, options);
    }
  }

  on(event: OverlayEvent, handler: AnyEventHandler): EventListener | null {
    if (!this.handle || !this.currentMap) return null;
    return this.currentMap._adapter().addMarkerEvent(this.handle, event, handler);
  }

  off(event: OverlayEvent, listener: EventListener): void {
    if (!this.handle || !this.currentMap) return;
    this.currentMap._adapter().removeMarkerEvent(this.handle, event, listener);
  }
}

// ---------------------------------------------------------------------------
// InfoWindow
// ---------------------------------------------------------------------------

export class InfoWindow {
  private handle: NativeInfoWindowHandle | null = null;
  private currentMap: KorMap | null = null;

  constructor(private options: InfoWindowOptions) {}

  open(map: KorMap, anchor?: Marker): void {
    if (this.handle && this.currentMap) this.close();

    // Get the internal handle of the anchor marker if provided
    const markerHandle = anchor ? (anchor as unknown as { handle: NativeMarkerHandle | null }).handle : undefined;
    this.handle = map._adapter().openInfoWindow(this.options, markerHandle ?? undefined);
    this.currentMap = map;
  }

  close(): void {
    if (this.handle && this.currentMap) {
      this.currentMap._adapter().closeInfoWindow(this.handle);
      this.handle = null;
      this.currentMap = null;
    }
  }

  setContent(content: string | HTMLElement): void {
    this.options = { ...this.options, content };
    if (this.handle && this.currentMap) {
      this.currentMap._adapter().updateInfoWindow(this.handle, { content });
    }
  }

  getContent(): string | HTMLElement {
    return this.options.content;
  }

  setPosition(latlng: LatLng): void {
    this.options = { ...this.options, position: latlng };
    if (this.handle && this.currentMap) {
      this.currentMap._adapter().updateInfoWindow(this.handle, { position: latlng });
    }
  }

  isOpen(): boolean {
    if (!this.handle || !this.currentMap) return false;
    return this.currentMap._adapter().isInfoWindowOpen(this.handle);
  }
}

// ---------------------------------------------------------------------------
// Polyline
// ---------------------------------------------------------------------------

export class Polyline {
  private handle: NativeOverlayHandle | null = null;
  private currentMap: KorMap | null = null;

  constructor(private options: PolylineOptions) {}

  setMap(map: KorMap | null): void {
    if (this.currentMap && this.handle) {
      this.currentMap._adapter().removePolyline(this.handle);
      this.handle = null;
      this.currentMap = null;
    }
    if (map) {
      this.handle = map._adapter().addPolyline(this.options);
      this.currentMap = map;
    }
  }

  setOptions(options: Partial<PolylineOptions>): void {
    this.options = { ...this.options, ...options };
    if (this.handle && this.currentMap) {
      this.currentMap._adapter().updatePolyline(this.handle, options);
    }
  }
}

// ---------------------------------------------------------------------------
// Polygon
// ---------------------------------------------------------------------------

export class Polygon {
  private handle: NativeOverlayHandle | null = null;
  private currentMap: KorMap | null = null;

  constructor(private options: PolygonOptions) {}

  setMap(map: KorMap | null): void {
    if (this.currentMap && this.handle) {
      this.currentMap._adapter().removePolygon(this.handle);
      this.handle = null;
      this.currentMap = null;
    }
    if (map) {
      this.handle = map._adapter().addPolygon(this.options);
      this.currentMap = map;
    }
  }

  setOptions(options: Partial<PolygonOptions>): void {
    this.options = { ...this.options, ...options };
    if (this.handle && this.currentMap) {
      this.currentMap._adapter().updatePolygon(this.handle, options);
    }
  }
}

// ---------------------------------------------------------------------------
// Circle
// ---------------------------------------------------------------------------

export class Circle {
  private handle: NativeOverlayHandle | null = null;
  private currentMap: KorMap | null = null;

  constructor(private options: CircleOptions) {}

  setMap(map: KorMap | null): void {
    if (this.currentMap && this.handle) {
      this.currentMap._adapter().removeCircle(this.handle);
      this.handle = null;
      this.currentMap = null;
    }
    if (map) {
      this.handle = map._adapter().addCircle(this.options);
      this.currentMap = map;
    }
  }

  setOptions(options: Partial<CircleOptions>): void {
    this.options = { ...this.options, ...options };
    if (this.handle && this.currentMap) {
      this.currentMap._adapter().updateCircle(this.handle, options);
    }
  }
}

// ---------------------------------------------------------------------------
// Rectangle
// ---------------------------------------------------------------------------

export class Rectangle {
  private handle: NativeOverlayHandle | null = null;
  private currentMap: KorMap | null = null;

  constructor(private options: RectangleOptions) {}

  setMap(map: KorMap | null): void {
    if (this.currentMap && this.handle) {
      this.currentMap._adapter().removeRectangle(this.handle);
      this.handle = null;
      this.currentMap = null;
    }
    if (map) {
      this.handle = map._adapter().addRectangle(this.options);
      this.currentMap = map;
    }
  }

  setOptions(options: Partial<RectangleOptions>): void {
    this.options = { ...this.options, ...options };
    if (this.handle && this.currentMap) {
      this.currentMap._adapter().updateRectangle(this.handle, options);
    }
  }
}

// ---------------------------------------------------------------------------
// CustomOverlay (base class)
// ---------------------------------------------------------------------------

export abstract class CustomOverlay {
  private handle: NativeOverlayHandle | null = null;
  private currentMap: KorMap | null = null;

  constructor(protected options: CustomOverlayOptions) {}

  abstract onAdd(): void;
  abstract onRemove(): void;
  abstract draw(): void;

  setMap(map: KorMap | null): void {
    if (this.currentMap && this.handle) {
      this.currentMap._adapter().removeCustomOverlay(this.handle);
      this.handle = null;
      this.currentMap = null;
    }
    if (map) {
      this.handle = map._adapter().addCustomOverlay(this.options);
      this.currentMap = map;
    }
  }

  setPosition(latlng: LatLng): void {
    this.options = { ...this.options, position: latlng };
  }

  getPosition(): LatLng {
    return this.options.position;
  }
}

// ---------------------------------------------------------------------------
// TileLayer
// ---------------------------------------------------------------------------

export class TileLayer {
  private handle: NativeOverlayHandle | null = null;
  private currentMap: KorMap | null = null;

  constructor(private options: TileLayerOptions) {}

  setMap(map: KorMap | null): void {
    if (this.currentMap && this.handle) {
      this.currentMap._adapter().removeTileLayer(this.handle);
      this.handle = null;
      this.currentMap = null;
    }
    if (map) {
      this.handle = map._adapter().addTileLayer(this.options);
      this.currentMap = map;
    }
  }
}
