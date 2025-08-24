// Central configuration for API base URL
// Priority: VITE_API_URL > textilecolav domain default > localhost

export function getApiBaseUrl(): string {
  const envUrl = (import.meta as unknown as { env?: { VITE_API_URL?: string } })?.env?.VITE_API_URL;
  if (envUrl && envUrl.length > 0) return envUrl;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host.endsWith('textilecolav.com')) {
      return 'https://rouparia.textilecolav.com/api';
    }
  }

  return 'http://localhost:4000';
}


