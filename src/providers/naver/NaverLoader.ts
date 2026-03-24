import { ProviderLoadError } from '../../core/errors.js';

let loadPromise: Promise<void> | null = null;

/**
 * Idempotently loads the Naver Maps SDK via dynamic script injection.
 */
export function loadNaverSdk(clientId: string, submodules: string[] = []): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    if (typeof window !== 'undefined' && window.naver?.maps?.Map) {
      resolve();
      return;
    }

    const params = new URLSearchParams({ ncpClientId: clientId });
    if (submodules.length > 0) params.set('submodules', submodules.join(','));

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?${params.toString()}`;

    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new ProviderLoadError('naver', new Error('Naver Maps SDK script failed to load')));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    naver: any;
  }
}
