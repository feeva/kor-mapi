import { describe, it, expect } from 'vitest';
import {
  toNaverZoom, fromNaverZoom,
  toKakaoZoom, fromKakaoZoom,
  toGoogleZoom, fromGoogleZoom,
  clampFacadeZoom,
} from './coordinateUtils.js';

// Facade zoom is 7–19 (Google/Naver-equivalent range)
// Naver zoom is 7–19 (identity with facade)
// Kakao zoom is 1–13 (inverted: kakaoLevel = 20 - facadeZoom)
//   facade 7 = kakao 13, facade 19 = kakao 1

describe('Google zoom (identity)', () => {
  it('toGoogleZoom passes through values in range', () => {
    expect(toGoogleZoom(7)).toBe(7);
    expect(toGoogleZoom(12)).toBe(12);
    expect(toGoogleZoom(19)).toBe(19);
  });

  it('clamps below 7', () => {
    expect(toGoogleZoom(0)).toBe(7);
    expect(toGoogleZoom(6)).toBe(7);
  });

  it('clamps above 19', () => {
    expect(toGoogleZoom(20)).toBe(19);
    expect(toGoogleZoom(22)).toBe(19);
  });

  it('round-trips', () => {
    for (let z = 7; z <= 19; z++) {
      expect(fromGoogleZoom(toGoogleZoom(z))).toBe(z);
    }
  });
});

describe('Naver zoom (identity with facade)', () => {
  it('facade 7 → naver 7', () => {
    expect(toNaverZoom(7)).toBe(7);
  });

  it('facade 19 → naver 19', () => {
    expect(toNaverZoom(19)).toBe(19);
  });

  it('facade 14 → naver 14', () => {
    expect(toNaverZoom(14)).toBe(14);
  });

  it('output is always within range 7–19', () => {
    for (let z = 0; z <= 22; z++) {
      const nz = toNaverZoom(z);
      expect(nz).toBeGreaterThanOrEqual(7);
      expect(nz).toBeLessThanOrEqual(19);
    }
  });

  it('same direction: higher facade zoom → higher naver zoom', () => {
    expect(toNaverZoom(15)).toBeGreaterThan(toNaverZoom(10));
  });

  it('round-trip: fromNaverZoom(toNaverZoom(z)) === z', () => {
    for (let z = 7; z <= 19; z++) {
      expect(fromNaverZoom(toNaverZoom(z))).toBe(z);
    }
  });
});

describe('Kakao zoom', () => {
  // kakaoLevel = 20 - facadeZoom

  it('facade 7 → kakao 13', () => {
    expect(toKakaoZoom(7)).toBe(13);
  });

  it('facade 11 → kakao 9', () => {
    expect(toKakaoZoom(11)).toBe(9);
  });

  it('facade 14 → kakao 6', () => {
    expect(toKakaoZoom(14)).toBe(6);
  });

  it('facade 17 → kakao 3', () => {
    expect(toKakaoZoom(17)).toBe(3);
  });

  it('facade 19 → kakao 1', () => {
    expect(toKakaoZoom(19)).toBe(1);
  });

  it('output is always within Kakao range 1–13', () => {
    for (let z = 0; z <= 22; z++) {
      const kz = toKakaoZoom(z);
      expect(kz).toBeGreaterThanOrEqual(1);
      expect(kz).toBeLessThanOrEqual(13);
    }
  });

  it('inverted: higher facade zoom → lower kakao level', () => {
    expect(toKakaoZoom(17)).toBeLessThan(toKakaoZoom(10));
  });

  it('fromKakaoZoom output is always within facade range 7–19', () => {
    for (let kz = 1; kz <= 13; kz++) {
      const fz = fromKakaoZoom(kz);
      expect(fz).toBeGreaterThanOrEqual(7);
      expect(fz).toBeLessThanOrEqual(19);
    }
  });

  it('exact round-trip for all valid kakao levels', () => {
    for (let z = 7; z <= 19; z++) {
      expect(fromKakaoZoom(toKakaoZoom(z))).toBe(z);
    }
  });

  it('kakao 13 → facade 7', () => {
    expect(fromKakaoZoom(13)).toBe(7);
  });

  it('kakao 1 → facade 19', () => {
    expect(fromKakaoZoom(1)).toBe(19);
  });
});

describe('clampFacadeZoom', () => {
  it('clamps below 7', () => {
    expect(clampFacadeZoom(0)).toBe(7);
    expect(clampFacadeZoom(6)).toBe(7);
  });

  it('clamps above 19', () => {
    expect(clampFacadeZoom(20)).toBe(19);
    expect(clampFacadeZoom(22)).toBe(19);
  });

  it('passes through values in range', () => {
    expect(clampFacadeZoom(7)).toBe(7);
    expect(clampFacadeZoom(12)).toBe(12);
    expect(clampFacadeZoom(19)).toBe(19);
  });
});
