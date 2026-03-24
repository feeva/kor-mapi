import { describe, it, expect } from 'vitest';
import {
  toNaverZoom, fromNaverZoom,
  toKakaoZoom, fromKakaoZoom,
  toGoogleZoom, fromGoogleZoom,
  clampFacadeZoom,
} from './coordinateUtils.js';

// Facade zoom is 0–22 (Google-style, 0 = world, 22 = building)
// Naver zoom is 1–21 (zoomed out = 1, zoomed in = 21, same direction)
// Kakao zoom is 1–14 (inverted: 1 = street/zoomed-in, 14 = country/zoomed-out)

describe('Google zoom (identity)', () => {
  it('toGoogleZoom is identity', () => {
    expect(toGoogleZoom(0)).toBe(0);
    expect(toGoogleZoom(10)).toBe(10);
    expect(toGoogleZoom(22)).toBe(22);
  });

  it('fromGoogleZoom is identity', () => {
    expect(fromGoogleZoom(0)).toBe(0);
    expect(fromGoogleZoom(10)).toBe(10);
    expect(fromGoogleZoom(22)).toBe(22);
  });

  it('round-trips', () => {
    for (let z = 0; z <= 22; z++) {
      expect(fromGoogleZoom(toGoogleZoom(z))).toBe(z);
    }
  });
});

describe('Naver zoom', () => {
  it('facade 0 → naver min (1)', () => {
    expect(toNaverZoom(0)).toBe(1);
  });

  it('facade 22 → naver max (21)', () => {
    expect(toNaverZoom(22)).toBe(21);
  });

  it('output is always within Naver range 1–21', () => {
    for (let z = 0; z <= 22; z++) {
      const nz = toNaverZoom(z);
      expect(nz).toBeGreaterThanOrEqual(1);
      expect(nz).toBeLessThanOrEqual(21);
    }
  });

  it('same direction: higher facade zoom → higher naver zoom', () => {
    expect(toNaverZoom(10)).toBeGreaterThan(toNaverZoom(5));
    expect(toNaverZoom(20)).toBeGreaterThan(toNaverZoom(10));
  });

  it('fromNaverZoom output is always within facade range 0–22', () => {
    for (let nz = 1; nz <= 21; nz++) {
      const fz = fromNaverZoom(nz);
      expect(fz).toBeGreaterThanOrEqual(0);
      expect(fz).toBeLessThanOrEqual(22);
    }
  });

  it('round-trip: fromNaverZoom(toNaverZoom(z)) ≈ z', () => {
    // Round-trip is approximate due to integer rounding in both directions
    for (let z = 0; z <= 22; z++) {
      const rt = fromNaverZoom(toNaverZoom(z));
      expect(Math.abs(rt - z)).toBeLessThanOrEqual(1);
    }
  });

  it('naver 1 → facade near 0', () => {
    expect(fromNaverZoom(1)).toBeLessThanOrEqual(2);
  });

  it('naver 21 → facade near 22', () => {
    expect(fromNaverZoom(21)).toBeGreaterThanOrEqual(20);
  });
});

describe('Kakao zoom', () => {
  it('facade 0 → kakao max (14, country level)', () => {
    expect(toKakaoZoom(0)).toBe(14);
  });

  it('facade 22 → kakao min (1, street level)', () => {
    expect(toKakaoZoom(22)).toBe(1);
  });

  it('output is always within Kakao range 1–14', () => {
    for (let z = 0; z <= 22; z++) {
      const kz = toKakaoZoom(z);
      expect(kz).toBeGreaterThanOrEqual(1);
      expect(kz).toBeLessThanOrEqual(14);
    }
  });

  it('inverted: higher facade zoom → lower kakao zoom', () => {
    expect(toKakaoZoom(20)).toBeLessThan(toKakaoZoom(5));
    expect(toKakaoZoom(15)).toBeLessThan(toKakaoZoom(5));
  });

  it('fromKakaoZoom output is always within facade range 0–22', () => {
    for (let kz = 1; kz <= 14; kz++) {
      const fz = fromKakaoZoom(kz);
      expect(fz).toBeGreaterThanOrEqual(0);
      expect(fz).toBeLessThanOrEqual(22);
    }
  });

  it('round-trip: fromKakaoZoom(toKakaoZoom(z)) ≈ z', () => {
    for (let z = 0; z <= 22; z++) {
      const rt = fromKakaoZoom(toKakaoZoom(z));
      expect(Math.abs(rt - z)).toBeLessThanOrEqual(2);
    }
  });

  it('kakao 14 → facade near 0', () => {
    expect(fromKakaoZoom(14)).toBeLessThanOrEqual(3);
  });

  it('kakao 1 → facade near 22', () => {
    expect(fromKakaoZoom(1)).toBeGreaterThanOrEqual(19);
  });
});

describe('clampFacadeZoom', () => {
  it('clamps below 0', () => {
    expect(clampFacadeZoom(-1)).toBe(0);
    expect(clampFacadeZoom(-100)).toBe(0);
  });

  it('clamps above 22', () => {
    expect(clampFacadeZoom(23)).toBe(22);
    expect(clampFacadeZoom(100)).toBe(22);
  });

  it('passes through values in range', () => {
    expect(clampFacadeZoom(0)).toBe(0);
    expect(clampFacadeZoom(11)).toBe(11);
    expect(clampFacadeZoom(22)).toBe(22);
  });
});
