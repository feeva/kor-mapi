import type { IMapProvider } from '../providers/base/IMapProvider.js';
import { KakaoAdapter } from '../providers/kakao/KakaoAdapter.js';
import { NaverAdapter } from '../providers/naver/NaverAdapter.js';
import { GoogleAdapter } from '../providers/google/GoogleAdapter.js';
import { ConfigurationError } from './errors.js';
import {
  type LatLng, type LatLngBounds, type KorMapConfig, type MapProvider,
  type KorMapFeature, type KorMapEvent, type AnyEventHandler, type EventListener,
  type FitBoundsOptions, type PanOptions, MapTypeId,
} from './types.js';

export type { KorMapConfig };

/**
 * The main facade. Create via `KorMap.create(config)`.
 *
 * Type parameter P narrows the type of `map.native`:
 *   const map = await KorMap.create<'naver'>({ provider: 'naver', ... });
 *   map.native  // typed as naver.maps.Map
 */
export class KorMap<P extends MapProvider = MapProvider> {
  private readonly adapter: IMapProvider;

  private constructor(adapter: IMapProvider) {
    this.adapter = adapter;
  }

  /**
   * Async factory. Loads the provider SDK and initializes the map.
   */
  static async create<P extends MapProvider = MapProvider>(
    config: KorMapConfig<P>,
  ): Promise<KorMap<P>> {
    const container = resolveContainer(config.container);
    const adapter = createAdapter(config.provider);
    await adapter.init(container, config);
    return new KorMap<P>(adapter);
  }

  // -------------------------------------------------------------------------
  // Provider info
  // -------------------------------------------------------------------------

  getProvider(): P {
    return this.adapter.provider as P;
  }

  supports(feature: KorMapFeature): boolean {
    return this.adapter.supports(feature);
  }

  /**
   * The raw underlying map object.
   * Typed via generic when the provider is known at compile time:
   *   const map = await KorMap.create<'naver'>({ provider: 'naver', ... });
   *   map.native  // → naver.maps.Map
   */
  get native(): P extends 'naver' ? typeof window.naver.maps.Map.prototype
    : P extends 'kakao' ? typeof window.kakao.maps.Map.prototype
    : P extends 'google' ? typeof window.google.maps.Map.prototype
    : unknown {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.adapter.nativeMap as any;
  }

  // -------------------------------------------------------------------------
  // Camera / viewport
  // -------------------------------------------------------------------------

  setCenter(latlng: LatLng): void { this.adapter.setCenter(latlng); }
  getCenter(): LatLng { return this.adapter.getCenter(); }

  setZoom(zoom: number): void { this.adapter.setZoom(zoom); }
  getZoom(): number { return this.adapter.getZoom(); }

  getBounds(): LatLngBounds { return this.adapter.getBounds(); }
  fitBounds(bounds: LatLngBounds, options?: FitBoundsOptions): void { this.adapter.fitBounds(bounds, options); }
  panTo(latlng: LatLng, options?: PanOptions): void { this.adapter.panTo(latlng, options); }
  panBy(x: number, y: number): void { this.adapter.panBy(x, y); }

  // -------------------------------------------------------------------------
  // Map type
  // -------------------------------------------------------------------------

  setMapType(type: MapTypeId): void { this.adapter.setMapType(type); }
  getMapType(): MapTypeId { return this.adapter.getMapType(); }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  on(event: KorMapEvent, handler: AnyEventHandler): EventListener {
    return this.adapter.on(event, handler);
  }

  once(event: KorMapEvent, handler: AnyEventHandler): EventListener {
    return this.adapter.once(event, handler);
  }

  off(event: KorMapEvent, listener: EventListener): void {
    this.adapter.off(event, listener);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  destroy(): void {
    this.adapter.destroy();
  }

  // -------------------------------------------------------------------------
  // Internal adapter access (for overlay classes)
  // -------------------------------------------------------------------------

  /** @internal */
  _adapter(): IMapProvider {
    return this.adapter;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveContainer(container: HTMLElement | string): HTMLElement {
  if (typeof container === 'string') {
    // Bare string without CSS selector prefix → treat as element ID
    const el = /^[#.[[]/.test(container)
      ? document.querySelector<HTMLElement>(container)
      : document.getElementById(container);
    if (!el) throw new ConfigurationError(`Container element not found: "${container}"`);
    return el;
  }
  return container;
}

function createAdapter(provider: MapProvider): IMapProvider {
  switch (provider) {
    case 'kakao': return new KakaoAdapter();
    case 'naver': return new NaverAdapter();
    case 'google': return new GoogleAdapter();
    default: throw new ConfigurationError(`Unknown provider: "${String(provider)}"`);
  }
}
