import { ProviderLoadError } from '../../core/errors.js';

let loadPromise: Promise<void> | null = null;

/**
 * Idempotently loads the Google Maps SDK via dynamic script injection.
 */
export function loadGoogleSdk(apiKey: string, libraries: string[] = []): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    if (typeof window !== 'undefined' && window.google?.maps?.Map) {
      resolve();
      return;
    }

    const params = new URLSearchParams({ key: apiKey, loading: 'async' });
    if (libraries.length > 0) params.set('libraries', libraries.join(','));
    // Use a unique callback name to avoid collisions
    const callbackName = `__korMapiGoogleMapsCallback__`;
    params.set('callback', callbackName);

    (window as unknown as Record<string, unknown>)[callbackName] = () => {
      delete (window as unknown as Record<string, unknown>)[callbackName];
      resolve();
    };

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;

    script.onerror = () => {
      loadPromise = null;
      delete (window as unknown as Record<string, unknown>)[callbackName];
      reject(new ProviderLoadError('google', new Error('Google Maps SDK script failed to load')));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google: any;
  }
}
