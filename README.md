# kor-mapi

**네이버 지도**, **카카오맵**, **구글 지도** API를 하나의 API로 추상화한 한국 지도 파사드입니다.

## 배경

한국은 19년간 구글에 대한 지도 데이터 반출을 제한했는데 이 제한이 2026년 2월에 조건부로 해제됐고 구글 지도는 수개월 내에 한국 지도 완성도를 상당히 높일 것으로 예상됩니다. 그동안 한국 사용자를 대상으로 하는 앱들은 각자 다른 SDK의 네이버, 카카오, 구글 등에 의존해왔는데 개인적으로 이러한 난립은 개발자에게 도움이 되지 않는다고 생각되어 이 프로젝트를 만들게 됐습니다.

`kor-mapi`를 사용하면 지도 코드를 한 번만 작성하고 설정 하나만 바꿔 공급자를 전환할 수 있습니다. 구글 지도 완성도를 고려하여 세 가지를 지원하고 있으나 향후 VWorld 등 다른
공급자로도 확대할 생각이 있습니다.

## 현재 상태: v0.1 — Tier 1 구현 완료

아래 8가지 기능이 세 공급자 모두에서 동일하게 동작합니다:

| #   | 기능                   | API                                                                           |
| --- | ---------------------- | ----------------------------------------------------------------------------- |
| 1   | **초기화**             | `KorMap.create({ provider, container, apiKey, center, zoom })`                |
| 2   | **카메라 / 뷰포트**    | `setCenter`, `getCenter`, `setZoom`, `getZoom`, `fitBounds`, `panTo`, `panBy` |
| 3   | **지도 유형**          | `setMapType(MapTypeId.ROADMAP \| SATELLITE \| HYBRID \| TERRAIN)`             |
| 4   | **마커**               | `new Marker({ position, icon, title, draggable, opacity, zIndex })`           |
| 5   | **정보창**             | `new InfoWindow({ content })` → `open(map, anchor?)` / `close()`              |
| 6   | **벡터 오버레이**      | `Polyline`, `Polygon`, `Circle`, `Rectangle` — 통합 선/채우기 스타일          |
| 7   | **이벤트**             | `map.on('click' \| 'zoom_changed' \| 'center_changed' \| 'idle' \| ...)`      |
| 8   | **커스텀 타일 레이어** | `new TileLayer({ getTileUrl(coord, zoom) })` — 브이월드 등 지원               |

**공급자별 주요 사항:**

- 줌은 네이버/구글을 표준으로 7 ~ 19로 제한했으며 카카오는 역방향 1–13 범위로 내부적으로 변환됩니다. 세 지도의 줌 배율이 완전히 동일하지는 않으므로 약간의 오차는 감안하세요.
- 카카오 SDK에 없는 `idle` 이벤트는 `center_changed` + `zoom_changed`를 150ms 디바운스하여 합성합니다.
- 구글 마커는 현재 권고되는 `AdvancedMarkerElement`를 사용합니다. `mapId`는 기본값으로 `'DEMO_MAP_ID'`가 사용되며, 운영 환경에서는 `config.mapId`를 설정하시기 바랍니다.
- 카카오에는 독립적인 지형도 기본 지도가 없어 `MapTypeId.TERRAIN`은 `ROADMAP`으로 대체됩니다.
- `map.native`로 기반 공급자 객체(`naver.maps.Map`, `kakao.maps.Map`, `google.maps.Map`)에 직접 접근할 수 있습니다.

## 미구현 항목 (Tier 2 / v0.2+)

지오코딩, 주소 검색, 장소/POI 검색, 경로 탐색, 마커 클러스터링, 교통 레이어, 히트맵, 그리기 도구, 지도 스타일, 고도, 거리뷰/로드뷰, 기울기/방향, 다국어 전환, 대중교통 레이어, 행정구역 경계 오버레이.

## 사용법

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

const iw = new InfoWindow({ content: "<b>서울시청</b>" });
marker.on("click", () => iw.open(map, marker));

map.on("zoom_changed", () => console.log(map.getZoom()));
```

네이버, 카카오, 구글에 따라 `provider` 값만 바꾸면 되며 나머지 코드는 그대로 유지됩니다.

## 데모

각 공급자 모두 API 키가 필요하므로 각 개발 콘솔에서 앱을 등록하고 키를 발급한 다음
`.env` 파일에 설정하세요.

```bash
cp demo/.env.example demo/.env
# .env 파일에 API 키를 하나 이상 설정하세요
npm run demo
# http://localhost:3000 에서 확인
```

데모는 세 공급자를 나란히 표시하며 위치/배율 동기화, 공통 툴바(지도 유형, 마커, 폴리라인, 원), 통합 이벤트 로그를 제공합니다.

## 아키텍처

계층적 어댑터 패턴: `KorMap` 파사드 → `IMapProvider` 인터페이스 → `NaverAdapter` / `KakaoAdapter` / `GoogleAdapter`. 각 어댑터는 SDK 동적 로딩(`<script>` 주입), 좌표 변환, 이벤트 이름 매핑, 공급자별 특이사항을 처리합니다. 운영 의존성 없음 — 세 SDK 모두 런타임에 동적으로 로드됩니다.

```
src/
  core/
    KorMap.ts        ← 파사드 + create() 팩토리
    types.ts         ← 모든 공개 인터페이스 및 열거형
    overlays.ts      ← Marker, InfoWindow, Polyline, Polygon, Circle, Rectangle, TileLayer
    errors.ts        ← KorMapError 계층
  providers/
    base/            ← IMapProvider 인터페이스
    naver/           ← NaverAdapter + NaverLoader
    kakao/           ← KakaoAdapter + KakaoLoader
    google/          ← GoogleAdapter + GoogleLoader
  utils/
    coordinateUtils.ts  ← 공급자 간 줌 정규화
```

## 명령어

```bash
npm run build       # tsup으로 빌드
npm test            # 테스트 실행 (vitest)
npm run typecheck   # tsc --noEmit
npm run demo        # localhost:3000에서 Vite 개발 서버 실행
```
