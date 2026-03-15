/**
 * Local dev proxy server.
 *
 * Routes requests to internal services through a SOCKS5 proxy,
 * adding CORS headers so the browser can read responses.
 *
 * Routes:
 *   GET  /api/s3/list          - List S3/MinIO objects (see query params below)
 *   ALL  /api/cts/*            - Forward to CTS API (pass x-cts-base-url header)
 *   GET  /health               - Health check
 *
 * Start with: node proxy/server.cjs
 * Or via:     npm run proxy
 * Or both:    npm start
 *
 * Environment variables:
 *   SOCKS_PROXY  - SOCKS5 proxy URL (default: socks5://localhost:49995)
 *   PORT         - Port to listen on  (default: 3001)
 */

'use strict';

const https = require('https');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { S3Client, ListBucketsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { NodeHttpHandler } = require('@smithy/node-http-handler');
const { SocksProxyAgent } = require('socks-proxy-agent');

const app = express();
app.use(cors());
app.use(express.json());

const SOCKS_PROXY = process.env.SOCKS_PROXY || 'socks5://localhost:49995';
const PORT = parseInt(process.env.PORT || '3001', 10);

// Shared SOCKS5 agent for plain HTTP forwarding
const socksAgent = new SocksProxyAgent(SOCKS_PROXY);

// ── S3 / MinIO ────────────────────────────────────────────────────────────────

function makeS3Client(endpoint, accessKeyId, secretAccessKey) {
  const agent = new SocksProxyAgent(SOCKS_PROXY);
  return new S3Client({
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    region: 'us-east-1',
    forcePathStyle: true,
    requestHandler: new NodeHttpHandler({
      httpsAgent: agent,
      httpAgent: agent,
    }),
  });
}

app.get('/api/s3/buckets', async (req, res) => {
  const { endpoint } = req.query;
  const accessKey = req.headers['x-s3-access-key'];
  const secretKey = req.headers['x-s3-secret-key'];

  if (!endpoint || !accessKey || !secretKey) {
    return res.status(400).json({
      error: 'Missing required parameters: endpoint (query) and x-s3-access-key, x-s3-secret-key (headers)',
    });
  }

  try {
    const client = makeS3Client(endpoint, accessKey, secretKey);
    const response = await client.send(new ListBucketsCommand({}));
    res.json({
      buckets: (response.Buckets || []).map(b => b.Name).filter(Boolean),
    });
  } catch (err) {
    console.error('S3 buckets error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/s3/list-all', async (req, res) => {
  const { endpoint, bucket, prefix = '' } = req.query;
  const accessKey = req.headers['x-s3-access-key'];
  const secretKey = req.headers['x-s3-secret-key'];

  if (!endpoint || !bucket || !accessKey || !secretKey) {
    return res.status(400).json({
      error: 'Missing required parameters: endpoint, bucket (query) and x-s3-access-key, x-s3-secret-key (headers)',
    });
  }

  try {
    const client = makeS3Client(endpoint, accessKey, secretKey);
    const files = [];
    let continuationToken;

    do {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });
      const response = await client.send(command);
      for (const obj of response.Contents || []) {
        if (obj.Key && obj.Key !== prefix) {
          files.push({
            key: obj.Key,
            size: obj.Size ?? 0,
            lastModified: obj.LastModified ? obj.LastModified.toISOString() : '',
          });
        }
      }
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    res.json({ files });
  } catch (err) {
    console.error('S3 list-all error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/s3/list', async (req, res) => {
  const { endpoint, bucket, prefix = '' } = req.query;
  const accessKey = req.headers['x-s3-access-key'];
  const secretKey = req.headers['x-s3-secret-key'];

  if (!endpoint || !bucket || !accessKey || !secretKey) {
    return res.status(400).json({
      error: 'Missing required parameters: endpoint, bucket (query) and x-s3-access-key, x-s3-secret-key (headers)',
    });
  }

  try {
    const client = makeS3Client(endpoint, accessKey, secretKey);
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      Delimiter: '/',
    });
    const response = await client.send(command);

    res.json({
      prefixes: (response.CommonPrefixes || []).map(p => p.Prefix).filter(Boolean),
      files: (response.Contents || [])
        .filter(f => f.Key !== prefix)
        .map(f => ({
          key: f.Key,
          size: f.Size ?? 0,
          lastModified: f.LastModified ? f.LastModified.toISOString() : '',
        })),
    });
  } catch (err) {
    console.error('S3 list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── CTS API forwarding ────────────────────────────────────────────────────────

// app.use strips the mount prefix, so req.path is already e.g. '/images', '/jobs'
app.use('/api/cts', (req, res) => {
  const ctsBaseUrl = req.headers['x-cts-base-url'];
  if (!ctsBaseUrl) {
    return res.status(400).json({ error: 'Missing x-cts-base-url header' });
  }

  const subpath = req.path; // e.g. '/images', '/jobs'
  let targetUrl;
  try {
    targetUrl = new URL(`${ctsBaseUrl}${subpath}`);
  } catch {
    return res.status(400).json({ error: `Invalid CTS base URL: ${ctsBaseUrl}` });
  }

  // Forward any query string
  for (const [k, v] of Object.entries(req.query)) {
    targetUrl.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }

  const body = (req.method !== 'GET' && req.method !== 'HEAD' && req.body)
    ? JSON.stringify(req.body)
    : undefined;

  const requestHeaders = {
    'Content-Type': 'application/json',
    ...(req.headers['authorization'] ? { 'Authorization': req.headers['authorization'] } : {}),
    ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
  };

  const protocol = targetUrl.protocol === 'https:' ? https : http;
  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: requestHeaders,
    agent: socksAgent,
  };

  console.log(`CTS → ${req.method} ${targetUrl}`);

  const proxyReq = protocol.request(options, (proxyRes) => {
    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': proxyRes.headers['content-type'] || 'application/json',
    };
    res.writeHead(proxyRes.statusCode, responseHeaders);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('CTS proxy error:', err.message);
    if (!res.headersSent) res.status(502).json({ error: err.message });
  });

  if (body) proxyReq.write(body);
  proxyReq.end();
});

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Proxy listening on http://localhost:${PORT}`);
  console.log(`SOCKS5: ${SOCKS_PROXY}`);
});
