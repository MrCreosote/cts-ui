import { useState, useEffect } from 'react';
import type { AllowedPath } from '../types';
import { listBuckets, listS3Objects } from '../api/s3proxy';

interface Props {
  proxyUrl: string;
  s3Endpoint: string;
  accessKey: string;
  secretKey: string;
  allowedPaths: AllowedPath[] | null;
  value: string;
  onChange: (path: string) => void;
}

function isBucketAllowed(bucket: string, allowedPaths: AllowedPath[] | null): boolean {
  if (allowedPaths === null) return true;
  if (allowedPaths.length === 0) return false;
  return allowedPaths.some(ap => ap.path.startsWith(`${bucket}/`));
}

function isPrefixAllowed(bucket: string, prefix: string, allowedPaths: AllowedPath[] | null): boolean {
  if (allowedPaths === null) return true;
  if (allowedPaths.length === 0) return false;
  const fullPath = `${bucket}/${prefix}`;
  return allowedPaths.some(ap => fullPath.startsWith(ap.path) || ap.path.startsWith(fullPath));
}

export function isOutputPathAllowed(path: string, allowedPaths: AllowedPath[] | null): boolean {
  if (allowedPaths === null) return true;
  if (allowedPaths.length === 0) return false;
  const normalized = path.endsWith('/') ? path : `${path}/`;
  return allowedPaths.some(ap => normalized.startsWith(ap.path));
}

export function S3OutputPicker({ proxyUrl, s3Endpoint, accessKey, secretKey, allowedPaths, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [bucket, setBucket] = useState<string | null>(null);
  const [prefix, setPrefix] = useState('');
  const [draftPath, setDraftPath] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const [buckets, setBuckets] = useState<string[]>([]);
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setListError('');
    listBuckets(proxyUrl, s3Endpoint, accessKey, secretKey)
      .then(setBuckets)
      .catch(e => setListError(e.message))
      .finally(() => setLoading(false));
  }, [open, proxyUrl, s3Endpoint, accessKey, secretKey]);

  useEffect(() => {
    if (!open || bucket === null) return;
    setLoading(true);
    setListError('');
    listS3Objects(proxyUrl, s3Endpoint, accessKey, secretKey, bucket, prefix)
      .then(result => setPrefixes(result.prefixes))
      .catch(e => setListError(e.message))
      .finally(() => setLoading(false));
  }, [open, bucket, prefix, proxyUrl, s3Endpoint, accessKey, secretKey, refreshKey]);

  function openModal() {
    setDraftPath(value);
    setBucket(null);
    setPrefix('');
    setPrefixes([]);
    setBuckets([]);
    setOpen(true);
  }

  function enterBucket(name: string) {
    setBucket(name);
    setPrefix('');
    setPrefixes([]);
    setDraftPath(`${name}/`);
  }

  function navigateInto(folderPrefix: string) {
    setPrefix(folderPrefix);
    setDraftPath(`${bucket}/${folderPrefix}`);
  }

  function backToBuckets() {
    setBucket(null);
    setPrefix('');
    setDraftPath('');
  }

  function navigateCrumb(crumbPrefix: string) {
    setPrefix(crumbPrefix);
    setDraftPath(crumbPrefix ? `${bucket}/${crumbPrefix}` : `${bucket}/`);
  }

  function handleSelect() {
    onChange(draftPath.trim());
    setOpen(false);
  }

  function handleClose() {
    setOpen(false);
    setBucket(null);
    setPrefix('');
  }

  const crumbs = prefix ? prefix.split('/').filter(Boolean) : [];
  const draftAllowed = isOutputPathAllowed(draftPath.trim(), allowedPaths);
  const canSelect = draftPath.trim().length > 0 && draftAllowed;

  if (!open) {
    return (
      <button type="button" className="browse-btn browse-btn-sm" onClick={openModal}>
        Browse S3…
      </button>
    );
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="modal">
        <div className="modal-header">
          <span>Select Output Directory</span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {bucket !== null && (
              <button type="button" className="refresh-btn" onClick={() => setRefreshKey(k => k + 1)} title="Refresh" disabled={loading}>
                ↻ Refresh
              </button>
            )}
            <button type="button" className="close-btn" onClick={handleClose}>✕</button>
          </div>
        </div>

        <div className="breadcrumbs">
          <button type="button" className="crumb" onClick={backToBuckets}>buckets</button>
          {bucket && (
            <span>
              <span className="crumb-sep">/</span>
              <button type="button" className="crumb" onClick={() => navigateCrumb('')}>{bucket}</button>
            </span>
          )}
          {crumbs.map((crumb, i) => {
            const crumbPrefix = crumbs.slice(0, i + 1).join('/') + '/';
            return (
              <span key={crumbPrefix}>
                <span className="crumb-sep">/</span>
                <button type="button" className="crumb" onClick={() => navigateCrumb(crumbPrefix)}>{crumb}</button>
              </span>
            );
          })}
        </div>

        {loading && <p className="loading" style={{ padding: '1rem' }}>Loading…</p>}
        {listError && <p className="error" style={{ padding: '1rem' }}>{listError}</p>}

        <div className="file-list">
          {bucket === null && !loading && buckets.map(b => {
            const allowed = isBucketAllowed(b, allowedPaths);
            return (
              <div
                key={b}
                className={`file-row folder-row ${!allowed ? 'row-disallowed' : ''}`}
                onClick={() => allowed && enterBucket(b)}
                title={!allowed ? 'You do not have write access to this bucket' : undefined}
              >
                <span className="file-icon">🪣</span>
                <span>{b}</span>
                {!allowed && <span className="disallowed-tag">no access</span>}
              </div>
            );
          })}
          {bucket === null && !loading && !listError && buckets.length === 0 && (
            <p className="empty">No buckets found</p>
          )}

          {bucket !== null && !loading && (
            <>
              {prefixes.map(p => {
                const folderName = p.slice(prefix.length);
                const allowed = isPrefixAllowed(bucket, p, allowedPaths);
                return (
                  <div
                    key={p}
                    className={`file-row folder-row ${!allowed ? 'row-disallowed' : ''}`}
                    onClick={() => allowed && navigateInto(p)}
                    title={!allowed ? 'You do not have write access to this path' : undefined}
                  >
                    <span className="file-icon">📁</span>
                    <span className="file-name">{folderName}</span>
                    {!allowed && <span className="disallowed-tag">no access</span>}
                  </div>
                );
              })}
              {prefixes.length === 0 && (
                <p className="empty">No subdirectories — navigate here or type a path below</p>
              )}
            </>
          )}
        </div>

        <div className="output-path-editor">
          <label className="output-path-label">Output path</label>
          <input
            type="text"
            value={draftPath}
            onChange={e => setDraftPath(e.target.value)}
            placeholder="bucket/prefix/run-001"
            spellCheck={false}
          />
          {draftPath.trim() && !draftAllowed && (
            <p className="error" style={{ margin: '0.3rem 0 0' }}>
              This path is outside your allowed write paths.
            </p>
          )}
        </div>

        <div className="modal-footer">
          <span />
          <button type="button" onClick={handleSelect} disabled={!canSelect}>
            Select
          </button>
        </div>
      </div>
    </div>
  );
}
