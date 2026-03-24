// ---------------------------------------------------------------------------
// Facade zoom scale: 7–19 (Google/Naver-equivalent range)
//   7  = country/region view
//   19 = street level
//
// Naver zoom scale: 7–19  (identity with facade in this range)
// Google zoom scale: 7–19 (identity with facade in this range)
//
// Kakao zoom scale: 1–13 (inverted, offset 20)
//   kakaoLevel = 20 − facadeZoom
//   facade 7  → kakao 13 (zoomed out)
//   facade 19 → kakao 1  (zoomed in)
// ---------------------------------------------------------------------------

const FACADE_MIN = 7;
const FACADE_MAX = 19;

const KAKAO_MIN = 1;
const KAKAO_MAX = 13;
const KAKAO_OFFSET = 20;

export function clampFacadeZoom(zoom: number): number {
  return Math.max(FACADE_MIN, Math.min(FACADE_MAX, zoom));
}

// ---------------------------------------------------------------------------
// Google (identity — facade IS the Google scale in this range)
// ---------------------------------------------------------------------------

export function toGoogleZoom(facadeZoom: number): number {
  return clampFacadeZoom(facadeZoom);
}

export function fromGoogleZoom(googleZoom: number): number {
  return clampFacadeZoom(googleZoom);
}

// ---------------------------------------------------------------------------
// Naver (identity — Naver zoom equals Google zoom in the 7–19 range)
// ---------------------------------------------------------------------------

export function toNaverZoom(facadeZoom: number): number {
  return Math.round(clampFacadeZoom(facadeZoom));
}

export function fromNaverZoom(naverZoom: number): number {
  return Math.round(clampFacadeZoom(naverZoom));
}

// ---------------------------------------------------------------------------
// Kakao
// kakaoLevel = 20 − facadeZoom  (inverted, offset 20)
// facade 7  → kakao 13
// facade 19 → kakao 1
// ---------------------------------------------------------------------------

export function toKakaoZoom(facadeZoom: number): number {
  const clamped = clampFacadeZoom(facadeZoom);
  return Math.max(KAKAO_MIN, Math.min(KAKAO_MAX, Math.round(KAKAO_OFFSET - clamped)));
}

export function fromKakaoZoom(kakaoZoom: number): number {
  const clamped = Math.max(KAKAO_MIN, Math.min(KAKAO_MAX, Math.round(kakaoZoom)));
  return Math.round(clampFacadeZoom(KAKAO_OFFSET - clamped));
}
