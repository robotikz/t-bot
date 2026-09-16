export const TRADING212_DEMO_BASE_URL = 'https://demo.trading212.com/api/v0/';
export const TRADING212_LIVE_BASE_URL = 'https://live.trading212.com/api/v0/';
export const TRADING212_DEFAULT_TIMEOUT_MS = 10_000;
export const TRADING212_DEFAULT_ENVIRONMENT = 'demo' as const;

export const TRADING212_SUPPORTED_ENVIRONMENTS = ['demo', 'live'] as const;

export function normalizeTrading212BaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return trimmed;
  }

  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

export function resolveTrading212BaseUrl(environment: string, configuredBaseUrl = ''): string {
  const override = configuredBaseUrl.trim();
  if (override) {
    return normalizeTrading212BaseUrl(override);
  }

  switch (environment.trim().toLowerCase()) {
    case 'demo':
      return TRADING212_DEMO_BASE_URL;
    case 'live':
      return TRADING212_LIVE_BASE_URL;
    default:
      throw new Error(`Unsupported Trading212 environment: ${environment}`);
  }
}