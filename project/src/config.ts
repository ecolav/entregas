// Central configuration for API base URL
// Priority: VITE_API_URL > same-origin (LAN/localhost) > localhost

export function getApiBaseUrl(): string {
  const envUrl = (import.meta as unknown as { env?: { VITE_API_URL?: string } })?.env?.VITE_API_URL;
  if (envUrl && envUrl.length > 0) return envUrl;

  if (typeof window !== 'undefined' && (window as any).location?.origin) {
    return (window as any).location.origin;
  }

  return 'http://localhost:4000';
}

// Public APP base URL to embed in QR codes and external links
// Priority: VITE_PUBLIC_APP_URL > window.location.origin > http://localhost:5173
export function getAppBaseUrl(): string {
  const envUrl = (import.meta as unknown as { env?: { VITE_PUBLIC_APP_URL?: string } })?.env?.VITE_PUBLIC_APP_URL;
  if (envUrl && envUrl.length > 0) return envUrl;
  if (typeof window !== 'undefined') {
    const origin = (window as any).location?.origin as string | undefined;
    if (origin) return origin;
  }
  return 'http://localhost:5173';
}

// Resolve app base URL dynamically (prefers backend hint)
export async function resolveAppBaseUrl(): Promise<string> {
  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/public/app-base`);
    if (res.ok) {
      const j = await res.json();
      if (j?.appBaseUrl) return j.appBaseUrl as string;
    }
  } catch { /* ignore */ }
  return getAppBaseUrl();
}


