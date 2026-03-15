import type { S3FileEntry, S3ListResult } from '../types';

function s3Headers(accessKey: string, secretKey: string) {
  return {
    'x-s3-access-key': accessKey,
    'x-s3-secret-key': secretKey,
  };
}

async function checkS3Response(res: Response) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

export async function listBuckets(
  proxyUrl: string,
  endpoint: string,
  accessKey: string,
  secretKey: string,
): Promise<string[]> {
  const params = new URLSearchParams({ endpoint });
  const res = await fetch(`${proxyUrl}/api/s3/buckets?${params}`, {
    headers: s3Headers(accessKey, secretKey),
  });
  const data = await checkS3Response(res);
  return data.buckets ?? [];
}

export async function checkObjectChecksum(
  proxyUrl: string,
  endpoint: string,
  accessKey: string,
  secretKey: string,
  bucket: string,
  key: string,
): Promise<boolean> {
  const params = new URLSearchParams({ endpoint, bucket, key });
  const res = await fetch(`${proxyUrl}/api/s3/checksum?${params}`, {
    headers: s3Headers(accessKey, secretKey),
  });
  const data = await checkS3Response(res);
  return data.hasCrc64nvme as boolean;
}

export async function listAllObjects(
  proxyUrl: string,
  endpoint: string,
  accessKey: string,
  secretKey: string,
  bucket: string,
  prefix: string,
): Promise<S3FileEntry[]> {
  const params = new URLSearchParams({ endpoint, bucket, prefix });
  const res = await fetch(`${proxyUrl}/api/s3/list-all?${params}`, {
    headers: s3Headers(accessKey, secretKey),
  });
  const data = await checkS3Response(res);
  return (data.files as { key: string; checksumAlgorithms: string[] }[]).map(f => ({
    path: `${bucket}/${f.key}`,
    hasCrc64nvme: (f.checksumAlgorithms ?? []).includes('CRC64NVME'),
  }));
}

export async function listS3Objects(
  proxyUrl: string,
  endpoint: string,
  accessKey: string,
  secretKey: string,
  bucket: string,
  prefix: string,
): Promise<S3ListResult> {
  const params = new URLSearchParams({ endpoint, bucket, prefix });
  const res = await fetch(`${proxyUrl}/api/s3/list?${params}`, {
    headers: s3Headers(accessKey, secretKey),
  });
  return checkS3Response(res);
}
