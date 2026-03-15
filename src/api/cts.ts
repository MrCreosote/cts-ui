import type { Image, Site, JobSubmission } from '../types';

function ctsUrl(proxyUrl: string, path: string) {
  return `${proxyUrl}/api/cts${path}`;
}

function headers(token: string, baseUrl: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-cts-base-url': baseUrl,
  };
}

async function checkResponse(res: Response) {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

export async function fetchImages(proxyUrl: string, baseUrl: string, token: string): Promise<Image[]> {
  const res = await fetch(ctsUrl(proxyUrl, '/images'), { headers: headers(token, baseUrl) });
  const data = await checkResponse(res);
  return data.data ?? [];
}

export async function fetchSites(proxyUrl: string, baseUrl: string, token: string): Promise<Site[]> {
  const res = await fetch(ctsUrl(proxyUrl, '/sites'), { headers: headers(token, baseUrl) });
  const data = await checkResponse(res);
  return data.data ?? [];
}

export async function submitJob(proxyUrl: string, baseUrl: string, token: string, job: JobSubmission) {
  const res = await fetch(ctsUrl(proxyUrl, '/jobs'), {
    method: 'POST',
    headers: headers(token, baseUrl),
    body: JSON.stringify(job),
  });
  return checkResponse(res);
}
