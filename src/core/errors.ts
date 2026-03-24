import type { MapProvider, KorMapFeature } from './types.js';

export class KorMapError extends Error {
  readonly provider: MapProvider | undefined;
  readonly originalError: unknown;

  constructor(message: string, options?: { provider?: MapProvider; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = 'KorMapError';
    this.provider = options?.provider;
    this.originalError = options?.cause;
  }
}

export class ProviderLoadError extends KorMapError {
  constructor(provider: MapProvider, cause?: unknown) {
    super(`Failed to load ${provider} Maps SDK`, { provider, cause });
    this.name = 'ProviderLoadError';
  }
}

export class ProviderNotSupportedError extends KorMapError {
  readonly feature: KorMapFeature;

  constructor(provider: MapProvider, feature: KorMapFeature) {
    super(`Feature "${feature}" is not supported by provider "${provider}"`, { provider });
    this.name = 'ProviderNotSupportedError';
    this.feature = feature;
  }
}

export class ConfigurationError extends KorMapError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
