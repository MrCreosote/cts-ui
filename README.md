# CTS Demo UI

A browser-based demo UI for submitting jobs to the [KBase CDM Task Service (CTS)](https://github.com/kbase/cdm-task-service).

## Requirements

- [Node.js](https://nodejs.org/) (v18 or later)
- A KBase auth token
- S3/MinIO credentials for browsing input files
- A SOCKS5 tunnel to a kbase login server if using the dev or staging CTS endpoints, or browsing MinIO
    - e.g. `ssh -D 49995 ac.<username>@login1.berkeley.kbase.us`

## Setup

```bash
npm install
```

## Running

```bash
npm start
```

This starts two processes concurrently:

| Process | URL | Description |
|---------|-----|-------------|
| Vite dev server | http://localhost:5173 | The UI |
| Proxy server | http://localhost:3001 | Routes backend calls through SOCKS5 |

Open http://localhost:5173 in your browser.

## Configuration

On first load, expand **Credentials & Settings** and fill in:

| Field | Description |
|-------|-------------|
| KBase Auth Token | Your KBase authentication token |
| CTS Base URL | The CTS API endpoint (see below) |
| S3 Endpoint | MinIO/S3 endpoint URL |
| S3 Access Key | S3 access key |
| S3 Secret Key | S3 secret key |
| Proxy URL | URL of the local proxy server (default: `http://localhost:3001`) |

Click **Save & Connect** to save credentials to browser localStorage and load available images and clusters.

### CTS Endpoints

| Environment | URL | Proxy required? |
|-------------|-----|-----------------|
| Production | `https://berdl.kbase.us/apis/cts` | No |
| Staging | `https://berdl.kbase.us/apis/stage_cts` | Yes |
| Dev | `https://berdl.kbase.us/apis/dev_cts` | Yes |

### Proxy server environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SOCKS_PROXY` | `socks5://localhost:49995` | SOCKS5 tunnel address |
| `PORT` | `3001` | Proxy server port |

Example with a custom SOCKS5 address:

```bash
SOCKS_PROXY=socks5://localhost:12345 npm start
```

The proxy is required for:
- All S3/MinIO file browsing (MinIO has no public CORS headers)
- Dev and staging CTS endpoints (not publicly routable)

The production CTS endpoint (`/apis/cts`) is publicly accessible and does not require the proxy, but all calls still go through it to avoid CORS issues in the browser.
