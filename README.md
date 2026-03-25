# kor-mapi

[한국어](README.ko.md) | [English](README.md)

A provider-agnostic Korean map facade that abstracts **Naver Maps**, **Kakao Maps**, and **Google Maps** behind a single unified TypeScript API.

## Why

South Korea restricted Google's map data export for 19 years. That restriction was conditionally lifted in February 2026, and Google Maps is expected to offer full Korean navigation coverage within months. In the meantime, apps serving Korean users have relied on Naver or Kakao — each with their own SDK, coordinate conventions, zoom scales, and event models.

`kor-mapi` lets you write map code once and switch providers with a single config change. Three are supported for now, with plans to add others like VWorld in the future as Google's Korean data matures.

## Current Status: v0.1 — Tier 1 Complete

The following features are implemented and work identically across all three providers:

| #   | Feature                   | API                                                                           |
| --- | ------------------------- | ----------------------------------------------------------------------------- |
| 1   | **Initialization**        | `KorMap.create({ provider, container, apiKey, center, zoom })`                |
| 2   | **Camera / viewport**     | `setCenter`, `getCenter`, `setZoom`, `getZoom`, `fitBounds`, `panTo`, `panBy` |
| 3   | **Map types**             | `setMapType(MapTypeId.ROADMAP \| SATELLITE \| HYBRID \| TERRAIN)`             |
| 4   | **Markers**               | `new Marker({ position, icon, title, draggable, opacity, zIndex })`           |
| 5   | **InfoWindows**           | `new InfoWindow({ content })` → `open(map, anchor?)` / `close()`              |
| 6   | **Vector overlays**       | `Polyline`, `Polygon`, `Circle`, `Rectangle` with unified stroke/fill styles  |
| 7   | **Events**                | `map.on('click' \| 'zoom_changed' \| 'center_changed' \| 'idle' \| ...)`      |
| 8   | **Custom tile layers**    | `new TileLayer({ getTileUrl(coord, zoom) })` — works with VWORLD etc.         |
| 9   | **Marker clustering**     | `new MarkerClusterer(map, markers, options)` — grid-based, zero dependencies  |

**Provider-specific notes:**

- Zoom is normalized to the Naver/Google standard of 7–19. Kakao's inverse 1–13 scale is internally converted. Note that the zoom levels of the three maps are not perfectly identical, so some variance is expected.
- Kakao's `idle` event (missing from the SDK) is synthesized via a 150ms debounce on `center_changed` + `zoom_changed`.
- Google markers use `AdvancedMarkerElement` (the current non-deprecated API). A `mapId` defaults to `'DEMO_MAP_ID'` for development; set `config.mapId` in production.
- Kakao has no standalone terrain base map — `MapTypeId.TERRAIN` falls back to `ROADMAP`.
- `map.native` gives direct access to the underlying provider object (`naver.maps.Map`, `kakao.maps.Map`, or `google.maps.Map`).

## Out of Scope: Geocoding, Search, and Routing

Geocoding, address search, POI search, and routing are **intentionally not part of the `kor-mapi` unified API**.

Each provider has fundamentally different service APIs — different data models, result structures, transport mechanisms (client SDK vs. REST-only), and Korean-specific data quality. A common-denominator facade would force lossy type conversions and hide provider capabilities that users actually care about. Naver and Kakao routing is also REST-only and requires a server-side proxy, making it a different integration concern from map rendering.

Use `map.native` to access provider services directly:

```ts
// Kakao — best for Korean addresses and POI
const map = await KorMap.create<'kakao'>({ provider: 'kakao', ... });
const geocoder = new window.kakao.maps.services.Geocoder();
const places = new window.kakao.maps.services.Places();

// Google — global coverage
const map = await KorMap.create<'google'>({ provider: 'google', ... });
const geocoder = new window.google.maps.Geocoder();
```

## Not Yet Implemented (Tier 2 / v0.2+)

Traffic layer, heatmap, drawing tools, map styles, elevation, street view, tilt/heading, multi-language switching, transit layer, administrative boundary overlays, and routing.

## Usage

```ts
import { KorMap, Marker, InfoWindow, MapTypeId } from "kor-mapi";

const map = await KorMap.create({
  provider: "kakao", // 'naver' | 'kakao' | 'google'
  container: "map",
  apiKey: "YOUR_APP_KEY",
  center: { lat: 37.5665, lng: 126.978 },
  zoom: 12,
});

const marker = new Marker({ position: { lat: 37.5665, lng: 126.978 } });
marker.setMap(map);

const iw = new InfoWindow({ content: "<b>Seoul City Hall</b>" });
marker.on("click", () => iw.open(map, marker));

map.on("zoom_changed", () => console.log(map.getZoom()));
```

Switch to Naver or Google by changing `provider` — everything else stays the same.

## Demo

Since all three providers require API keys, register your app in each developer console, obtain keys, and set them in the `.env` file.

```bash
cp demo/.env.example demo/.env
# fill in one or more API keys
npm run demo
# open http://localhost:3000
```

The demo shows all three providers side-by-side with synchronized camera, shared toolbar controls (map type, marker, polyline, circle), and a unified event log.

## Architecture

Stratified Adapter pattern: `KorMap` facade → `IMapProvider` interface → `NaverAdapter` / `KakaoAdapter` / `GoogleAdapter`. Each adapter handles SDK loading (dynamic `<script>` injection), coordinate translation, event name mapping, and provider-specific quirks. Zero production dependencies — all three SDKs are loaded at runtime.

```
src/
  core/
    KorMap.ts        ← facade + create() factory
    types.ts         ← all public interfaces and enums
    overlays.ts      ← Marker, InfoWindow, Polyline, Polygon, Circle, Rectangle, TileLayer
    errors.ts        ← KorMapError hierarchy
  providers/
    base/            ← IMapProvider interface
    naver/           ← NaverAdapter + NaverLoader
    kakao/           ← KakaoAdapter + KakaoLoader
    google/          ← GoogleAdapter + GoogleLoader
  utils/
    coordinateUtils.ts  ← zoom normalization across providers
```

## Commands

```bash
npm run build       # build with tsup
npm test            # run tests (vitest)
npm run typecheck   # tsc --noEmit
npm run demo        # Vite dev server at localhost:3000
```
