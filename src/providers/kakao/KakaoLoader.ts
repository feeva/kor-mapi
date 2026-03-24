import { ProviderLoadError } from '../../core/errors.js';

let loadPromise: Promise<void> | null = null;

/**
 * Idempotently loads the Kakao Maps SDK via dynamic script injection.
 * Multiple calls return the same promise; the script is injected only once.
 */
export function loadKakaoSdk(appKey: string): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    // Already loaded
    if (typeof window !== 'undefined' && window.kakao?.maps?.Map) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;

    script.onload = () => {
      // Kakao SDK uses autoload=false so we call kakao.maps.load() manually
      window.kakao.maps.load(() => resolve());
    };

    script.onerror = () => {
      loadPromise = null; // allow retry on next call
      reject(new ProviderLoadError('kakao', new Error('Kakao Maps SDK script failed to load')));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

// Extend Window for TypeScript
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kakao: any;
  }
}
