import { describe, it, expect } from 'vitest';
import { pickStyle, cellKey, centroid, toWorldPixel, toBounds } from './MarkerClusterer.js';
import type { ClusterStyle } from '../../core/types.js';

// ---------------------------------------------------------------------------
// pickStyle
// ---------------------------------------------------------------------------

describe('pickStyle', () => {
  const styles: ClusterStyle[] = [
    { width: 36, height: 36, backgroundColor: '#blue' },
    { width: 44, height: 44, backgroundColor: '#yellow' },
    { width: 52, height: 52, backgroundColor: '#red' },
  ];

  it('returns tier 0 for counts 1–9', () => {
    expect(pickStyle(1, styles)).toBe(styles[0]);
    expect(pickStyle(9, styles)).toBe(styles[0]);
  });

  it('returns tier 1 for counts 10–99', () => {
    expect(pickStyle(10, styles)).toBe(styles[1]);
    expect(pickStyle(99, styles)).toBe(styles[1]);
  });

  it('returns tier 2 for counts 100+', () => {
    expect(pickStyle(100, styles)).toBe(styles[2]);
    expect(pickStyle(999, styles)).toBe(styles[2]);
  });

  it('falls back to lower tier if higher tiers are missing', () => {
    const oneStyle: ClusterStyle[] = [{ width: 36, height: 36 }];
    // all counts should fall back to the only defined style
    expect(pickStyle(1, oneStyle)).toBe(oneStyle[0]);
    expect(pickStyle(50, oneStyle)).toBe(oneStyle[0]);
    expect(pickStyle(200, oneStyle)).toBe(oneStyle[0]);
  });

  it('falls back to DEFAULT_STYLES when array is empty', () => {
    // empty array → all slots undefined → falls back to internal defaults (non-null)
    expect(pickStyle(1, [])).toBeDefined();
    expect(pickStyle(50, [])).toBeDefined();
    expect(pickStyle(200, [])).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// cellKey
// ---------------------------------------------------------------------------

describe('cellKey', () => {
  it('assigns same key to pixels in the same 60px cell', () => {
    expect(cellKey(0, 0, 60)).toBe(cellKey(59, 59, 60));
    expect(cellKey(60, 0, 60)).not.toBe(cellKey(59, 0, 60));
  });

  it('keys are stable across calls', () => {
    expect(cellKey(120, 180, 60)).toBe('2,3');
  });

  it('handles negative pixel coordinates', () => {
    // off-screen markers still get a cell
    const key = cellKey(-10, -10, 60);
    expect(typeof key).toBe('string');
    expect(key).toBe('-1,-1');
  });

  it('respects gridSize parameter', () => {
    expect(cellKey(50, 50, 100)).toBe('0,0');
    expect(cellKey(100, 100, 100)).toBe('1,1');
  });
});

// ---------------------------------------------------------------------------
// centroid
// ---------------------------------------------------------------------------

describe('centroid', () => {
  it('returns {0,0} for empty input', () => {
    expect(centroid([])).toEqual({ lat: 0, lng: 0 });
  });

  it('returns the single point unchanged', () => {
    expect(centroid([{ lat: 37.5, lng: 127.0 }])).toEqual({ lat: 37.5, lng: 127.0 });
  });

  it('computes the average of two points', () => {
    const result = centroid([
      { lat: 37.0, lng: 126.0 },
      { lat: 38.0, lng: 128.0 },
    ]);
    expect(result.lat).toBeCloseTo(37.5);
    expect(result.lng).toBeCloseTo(127.0);
  });

  it('handles multiple points', () => {
    const result = centroid([
      { lat: 36.0, lng: 126.0 },
      { lat: 37.0, lng: 127.0 },
      { lat: 38.0, lng: 128.0 },
    ]);
    expect(result.lat).toBeCloseTo(37.0);
    expect(result.lng).toBeCloseTo(127.0);
  });
});

// ---------------------------------------------------------------------------
// toWorldPixel
// ---------------------------------------------------------------------------

describe('toWorldPixel', () => {
  it('maps (0, 0) to the center of the world tile at zoom 0', () => {
    const { x, y } = toWorldPixel(0, 0, 0);
    expect(x).toBeCloseTo(128); // 256 * (0 + 180) / 360
    expect(y).toBeCloseTo(128); // equator ≈ center
  });

  it('maps (-180, 0) to x=0 at zoom 0', () => {
    const { x } = toWorldPixel(0, -180, 0);
    expect(x).toBeCloseTo(0);
  });

  it('doubles world size per zoom level', () => {
    const z0 = toWorldPixel(37.5665, 126.978, 0);
    const z1 = toWorldPixel(37.5665, 126.978, 1);
    expect(z1.x).toBeCloseTo(z0.x * 2);
    expect(z1.y).toBeCloseTo(z0.y * 2);
  });

  it('places Seoul north of equator (y < world/2) at zoom 0', () => {
    // In Web Mercator y increases downward; Seoul lat≈37.5° is in the northern
    // hemisphere so its y should be less than the equator's y (≈128 at zoom 0).
    const { y } = toWorldPixel(37.5665, 126.978, 0);
    expect(y).toBeLessThan(128);
  });

  it('produces different cells for nearby-but-distinct Seoul positions', () => {
    // The spiral markers in the demo are ~0.02–0.08° apart; at zoom 12 that
    // should exceed gridSize=60 px so they land in different cells.
    const zoom = 12;
    const gridSize = 60;
    const pt1 = toWorldPixel(37.5665, 126.978, zoom);
    const pt2 = toWorldPixel(37.6265, 127.058, zoom); // ~8km away
    const key1 = `${Math.floor(pt1.x / gridSize)},${Math.floor(pt1.y / gridSize)}`;
    const key2 = `${Math.floor(pt2.x / gridSize)},${Math.floor(pt2.y / gridSize)}`;
    expect(key1).not.toBe(key2);
  });
});

// ---------------------------------------------------------------------------
// toBounds
// ---------------------------------------------------------------------------

describe('toBounds', () => {
  it('returns correct sw/ne for two points', () => {
    const bounds = toBounds([
      { lat: 37.0, lng: 126.0 },
      { lat: 38.0, lng: 128.0 },
    ]);
    expect(bounds.sw).toEqual({ lat: 37.0, lng: 126.0 });
    expect(bounds.ne).toEqual({ lat: 38.0, lng: 128.0 });
  });

  it('handles unordered input', () => {
    const bounds = toBounds([
      { lat: 38.0, lng: 128.0 },
      { lat: 37.0, lng: 126.0 },
      { lat: 37.5, lng: 127.0 },
    ]);
    expect(bounds.sw.lat).toBe(37.0);
    expect(bounds.sw.lng).toBe(126.0);
    expect(bounds.ne.lat).toBe(38.0);
    expect(bounds.ne.lng).toBe(128.0);
  });

  it('returns degenerate bounds for a single point (sw === ne)', () => {
    const bounds = toBounds([{ lat: 37.5, lng: 127.0 }]);
    expect(bounds.sw).toEqual({ lat: 37.5, lng: 127.0 });
    expect(bounds.ne).toEqual({ lat: 37.5, lng: 127.0 });
  });
});
