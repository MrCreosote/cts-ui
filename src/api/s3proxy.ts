import type { S3ListResult } from '../types';

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
    headers: {
      'x-s3-access-key': accessKey,
      'x-s3-secret-key': secretKey,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}
