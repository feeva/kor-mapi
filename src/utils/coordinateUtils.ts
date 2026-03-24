// ---------------------------------------------------------------------------
// Facade zoom scale: 0–22 (Google-style)
//   0  = world view
//   22 = building level
//
// Naver zoom scale: 1–21
//   1  = country/world (zoomed out)
//   21 = building (zoomed in)
//   Same direction as facade, different range.
//
// Kakao zoom scale: 1–14
//   1  = street (zoomed in)   ← INVERTED relative to facade and Naver
//   14 = country (zoomed out)
// ---------------------------------------------------------------------------

const FACADE_MIN = 0;
const FACADE_MAX = 22;

const NAVER_MIN = 1;
const NAVER_MAX = 21;

const KAKAO_MIN = 1;
const KAKAO_MAX = 14;

export function clampFacadeZoom(zoom: number): number {
  return Math.max(FACADE_MIN, Math.min(FACADE_MAX, Math.round(zoom)));
}

// ---------------------------------------------------------------------------
// Google (identity — facade IS the Google scale)
// ---------------------------------------------------------------------------

export function toGoogleZoom(facadeZoom: number): number {
  return clampFacadeZoom(facadeZoom);
}

export function fromGoogleZoom(googleZoom: number): number {
  return clampFacadeZoom(googleZoom);
}

// ---------------------------------------------------------------------------
// Naver
// Linear map: facade [0,22] → naver [1,21]
// ---------------------------------------------------------------------------

export function toNaverZoom(facadeZoom: number): number {
  const clamped = clampFacadeZoom(facadeZoom);
  const ratio = clamped / FACADE_MAX;
  return Math.round(NAVER_MIN + ratio * (NAVER_MAX - NAVER_MIN));
}

export function fromNaverZoom(naverZoom: number): number {
  const clamped = Math.max(NAVER_MIN, Math.min(NAVER_MAX, Math.round(naverZoom)));
  const ratio = (clamped - NAVER_MIN) / (NAVER_MAX - NAVER_MIN);
  return Math.round(ratio * FACADE_MAX);
}

// ---------------------------------------------------------------------------
// Kakao
// Inverted linear map: facade [0,22] → kakao [14,1]
// facade 0  → kakao 14 (world)
// facade 22 → kakao 1  (street)
// ---------------------------------------------------------------------------

export function toKakaoZoom(facadeZoom: number): number {
  const clamped = clampFacadeZoom(facadeZoom);
  const ratio = clamped / FACADE_MAX;
  // Invert: as facade increases, kakao decreases
  return Math.round(KAKAO_MAX - ratio * (KAKAO_MAX - KAKAO_MIN));
}

export function fromKakaoZoom(kakaoZoom: number): number {
  const clamped = Math.max(KAKAO_MIN, Math.min(KAKAO_MAX, Math.round(kakaoZoom)));
  // Invert back
  const ratio = (KAKAO_MAX - clamped) / (KAKAO_MAX - KAKAO_MIN);
  return Math.round(ratio * FACADE_MAX);
}
