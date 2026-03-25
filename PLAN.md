# kor-mapi: Korean Map Facade Module — Feature Plan

## Context

South Korea conditionally approved Google's map data export on 2026-02-27, ending a 19-year restriction. Google Maps is expected to offer full Korean navigation within ~6 months. This makes a provider-agnostic facade valuable now: apps can default to Naver or Kakao today and migrate to or blend in Google as its Korean data matures.

The module (`kor-mapi`) abstracts three providers behind a single unified API:
- **Naver Maps API** — dominant in Korea, excellent local data, best traffic layer
- **Kakao Maps API** — best Korean address/geocoding, excellent POI data, popular in super-apps
- **Google Maps API** — global standard, rapidly improving Korean coverage post-2026

**Core principle:** Tier 1 features work identically across all providers. Tier 2 features degrade gracefully (warning + no-op or fallback). `map.native` escape hatch gives full access to the underlying provider object.

**Service APIs (geocoding, address search, POI search, routing) are intentionally outside the unified facade.** See the design decision note below.

---

## Feature Areas

### Tier 1 — Universal (all 3 providers)

| # | Feature | Key API Surface |
|---|---------|-----------------|
| 1 | **Initialization & lifecycle** | `KorMap.create({ provider, container, apiKey, locale, center, zoom })` — async factory handles dynamic SDK loading |
| 2 | **Camera / viewport** | `setCenter/getCenter`, `setZoom/getZoom`, `setBounds/getBounds`, `fitBounds`, `panTo`, `panBy` — zoom normalized to Google-style 0–22 scale (Kakao's inverted 1–14 is translated automatically) |
| 3 | **Map types** | `ROADMAP`, `SATELLITE`, `HYBRID`, `TERRAIN` — mapped to each provider's equivalent enum |
| 4 | **Markers & custom icons** | `position`, `icon` (url/size/anchor/sprite), `label`, `draggable`, `opacity`, `animation` (BOUNCE/DROP), `zIndex` |
| 5 | **InfoWindows / popups** | `content` (string or HTMLElement), `open(map, anchor?)`, `close()`, `isOpen()` |
| 6 | **Vector overlays** | `Polyline`, `Polygon` (with holes), `Circle` (radius in meters), `Rectangle` — unified `StrokeStyle` + `FillStyle` |
| 7 | **Custom HTML overlays** | `onAdd/onRemove/draw` lifecycle — all 3 providers share this pattern (Naver/Google use OverlayView, Kakao uses AbstractOverlay) |
| 8 | **Events** | `map.on/once/off`, overlay-level events — `click`, `dblclick`, `rightclick`, `drag*`, `zoom_changed`, `center_changed`, `bounds_changed`, `idle`, `tilesloaded`. Kakao's missing `idle` is synthesized via debounce. |
| 9 | **Marker clustering** | `MarkerClusterer` — bundled grid-based implementation; works via the existing `CustomOverlay` abstraction across all providers |
| 10 | **Custom tile layers** | `TileLayer({ getTileUrl(coord, zoom) })` — works with Korean government tile services (VWORLD, etc.) |
| 11 | **TypeScript types** | Strict types for all interfaces; `map.native` typed via generics as `naver.maps.Map | kakao.maps.Map | google.maps.Map` |

### Tier 2 — Best-effort (graceful degradation)

| # | Feature | Provider notes |
|---|---------|----------------|
| 12 | **Traffic layer** | Native on Naver (best Korean data) and Google; Kakao falls back to tile overlay using Kakao's traffic tile URL scheme |
| 13 | **Heatmap** | Native on Naver and Google; Kakao uses a bundled Canvas/HTML5 implementation via CustomOverlay |
| 14 | **Drawing tools** | `DrawingManager` — native on all 3, but Google's is deprecated in v3.56+ |
| 15 | **Map styles** | `setStyle(MapStyle[])` — full support on Google, GL-module support on Naver, `ProviderNotSupportedError` on Kakao |
| 16 | **Elevation** | Google native, Naver via REST proxy, Kakao unsupported |
| 17 | **Street view / panorama** | Naver 거리뷰, Kakao 로드뷰, Google Street View |
| 18 | **Tilt & heading** | Google: full 3D; Naver: limited; Kakao: no-op with dev warning |
| 19 | **Multi-language** | `setLanguage('ko' | 'en')` — Naver/Kakao require map re-initialization |
| 20 | **Routing** | `route({ origin, destination, waypoints, travelMode })` — provider-specific; Naver/Kakao are REST-only and require a server-side `proxyUrl` |

### Korea-Specific Features

| # | Feature | Notes |
|---|---------|-------|
| 21 | **Transit layer + subway overlay** | `SubwayRouteOverlay({ city, lineIds })` for Seoul, Busan, Daegu, Incheon, Gwangju, Daejeon |
| 22 | **Administrative district boundaries** | `AdminBoundaryLayer({ level: SIDO/SIGUNGU/EUPMYEONDONG })` — uses bundled NGII GeoJSON |

### Out of Scope: Service APIs

Geocoding, address search, POI search are **not part of the unified facade**. See design decision below.

---

## Architecture

**Pattern:** Stratified Adapter — `IMapProvider` interface per provider, Facade delegates, Strategy for services, Plugin/Registry for optional modules.

```
kor-mapi/
  src/
    core/
      KorMap.ts               ← main facade + create() factory
      types.ts                ← all public interfaces
      capabilities.ts         ← per-provider feature manifest + supports() check
      events.ts               ← unified EventEmitter abstraction
      errors.ts               ← KorMapError hierarchy
    providers/
      base/IMapProvider.ts    ← adapter interface (most critical file)
      naver/ kakao/ google/   ← adapters + loaders
    modules/
      clustering/ heatmap/ drawing/ transit/ streetview/
      geocoding/ places/ routing/ elevation/ admin/
    utils/
      coordinateUtils.ts      ← zoom normalization
      addressUtils.ts         ← Korean address parsing
```

**Key design decisions:**
- Zoom normalized to Google-style 0–22 (Kakao's inverted 1–14 and Naver's 1–21 are translated by adapters)
- `map.native` escape hatch — fully typed via generics
- Zero production `dependencies` — all 3 provider SDKs loaded dynamically at runtime
- Bundled NGII GeoJSON for admin boundaries (provider-consistent, works offline)

### Design Decision: No Service Facade

Geocoding, address search, POI search, and routing are **intentionally excluded** from the unified `kor-mapi` API.

Each provider's service APIs differ in data model, result quality, and transport:
- **Kakao** has the best Korean address/POI data with a rich SDK (`kakao.maps.services.*`). Wrapping it behind a common type would mean discarding Korean-specific fields (jibun/road address detail, category hierarchy, etc.).
- **Naver** routing and geocoding are REST-only, requiring a server-side proxy. This is a fundamentally different integration model from the client-side SDKs of Kakao and Google.
- **Google** uses its own place types and address component structure — mapping to a common denominator forces lossy conversion.

A unified service facade would force users to learn a new type system that is a lossy subset of what each provider already offers. Users are better served by accessing provider services directly via `map.native`:

```ts
// Kakao — native service access
const map = await KorMap.create<'kakao'>({ provider: 'kakao', ... });
const geocoder = new window.kakao.maps.services.Geocoder();

// Google — native service access
const map = await KorMap.create<'google'>({ provider: 'google', ... });
const geocoder = new window.google.maps.Geocoder();
```

---

## Current Scope: Tier 1 (v0.1)

Implement the 11 Tier 1 features. Tier 2, Korea-specific, and service modules deferred.

**Status:** Features 1–8, 10–11 complete. Feature 9 (`MarkerClusterer`) in progress.

### Implementation order (completed)

1. Project scaffold (`package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`)
2. `src/core/types.ts` — all public interfaces and enums
3. `src/core/errors.ts` — `KorMapError` hierarchy
4. `src/providers/base/IMapProvider.ts` — adapter contract
5. `src/utils/coordinateUtils.ts` + tests — zoom normalization
6. `src/providers/kakao/` — `KakaoLoader` + `KakaoAdapter`
7. `src/providers/naver/` — `NaverLoader` + `NaverAdapter`
8. `src/providers/google/` — `GoogleLoader` + `GoogleAdapter`
9. `src/core/KorMap.ts` — facade + `create()` factory
10. `src/core/overlays.ts` — `Marker`, `InfoWindow`, `Polyline`, `Polygon`, `Circle`, `Rectangle`, `TileLayer`
11. Package exports (`src/index.ts`, `src/core.ts`, `src/types.ts`)
12. `src/modules/clustering/MarkerClusterer.ts` — grid-based clusterer via `CustomOverlay`

### Verification

- Unit tests: zoom round-trips (all providers), event name mapping, MapTypeId mapping, clustering grid logic
- `npm run build` — clean dist, zero prod deps
- `npm run typecheck` — strict mode, no errors
- Manual smoke test: create map with each provider, add marker, fire click event, cluster 50+ markers
