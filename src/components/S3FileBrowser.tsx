import { useState, useEffect } from 'react';
import type { S3Object, S3FileEntry, AllowedPath } from '../types';
import { listBuckets, listS3Objects, listAllObjects } from '../api/s3proxy';

interface Props {
  proxyUrl: string;
  s3Endpoint: string;
  accessKey: string;
  secretKey: string;
  allowedPaths: AllowedPath[] | null;  // null = not yet loaded (permissive)
  onAdd: (files: S3FileEntry[]) => void;
}

/** Returns true if the given bucket/key-or-prefix is within or is a parent of an allowed path. */
function isAllowed(bucket: string, keyOrPrefix: string, allowedPaths: AllowedPath[] | null): boolean {
  if (allowedPaths === null) return true; // still loading whoami
  if (allowedPaths.length === 0) return false;
  const fullPath = keyOrPrefix ? `${bucket}/${keyOrPrefix}` : `${bucket}/`;
  return allowedPaths.some(ap =>
    fullPath.startsWith(ap.path) || ap.path.startsWith(fullPath)
  );
}

function isBucketAllowed(bucket: string, allowedPaths: AllowedPath[] | null): boolean {
  if (allowedPaths === null) return true;
  if (allowedPaths.length === 0) return false;
  return allowedPaths.some(ap => ap.path.startsWith(`${bucket}/`));
}

export function S3FileBrowser({ proxyUrl, s3Endpoint, accessKey, secretKey, allowedPaths, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [bucket, setBucket] = useState<string | null>(null);
  const [prefix, setPrefix] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const [buckets, setBuckets] = useState<string[]>([]);
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [files, setFiles] = useState<S3Object[]>([]);

  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    listBuckets(proxyUrl, s3Endpoint, accessKey, secretKey)
      .then(setBuckets)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, proxyUrl, s3Endpoint, accessKey, secretKey]);

  useEffect(() => {
    if (!open || bucket === null) return;
    setLoading(true);
    setError('');
    listS3Objects(proxyUrl, s3Endpoint, accessKey, secretKey, bucket, prefix)
      .then(result => {
        setPrefixes(result.prefixes);
        setFiles(result.files);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, bucket, prefix, proxyUrl, s3Endpoint, accessKey, secretKey, refreshKey]);

  function enterBucket(name: string) {
    setBucket(name);
    setPrefix('');
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
    setPrefixes([]);
    setFiles([]);
  }

  function backToBuckets() {
    setBucket(null);
    setPrefix('');
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
  }

  function navigate(p: string) {
    setPrefix(p);
  }

  function refresh() {
    setRefreshKey(k => k + 1);
  }

  function toggleFile(key: string) {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleFolder(p: string) {
    setSelectedFolders(prev => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  }

  async function handleAdd() {
    if (!bucket) return;
    setResolving(true);
    setError('');
    try {
      const entries: S3FileEntry[] = Array.from(selectedFiles).map(key => ({
        path: `${bucket}/${key}`,
        hasCrc64nvme: (files.find(f => f.key === key)?.checksumAlgorithms ?? []).includes('CRC64NVME'),
      }));
      for (const folderPrefix of selectedFolders) {
        const folderEntries = await listAllObjects(proxyUrl, s3Endpoint, accessKey, secretKey, bucket, folderPrefix);
        entries.push(...folderEntries);
      }
      onAdd(entries);
      setSelectedFiles(new Set());
      setSelectedFolders(new Set());
      setOpen(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setResolving(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setBucket(null);
    setPrefix('');
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
  }

  const crumbs = prefix ? prefix.split('/').filter(Boolean) : [];
  const totalSelected = selectedFiles.size + selectedFolders.size;

  if (!open) {
    return (
      <button type="button" className="browse-btn" onClick={() => setOpen(true)}>
        Browse S3…
      </button>
    );
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="modal">
        <div className="modal-header">
          <span>Browse S3</span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {bucket !== null && (
              <button type="button" className="refresh-btn" onClick={refresh} title="Refresh directory listing" disabled={loading}>
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
              <button type="button" className="crumb" onClick={() => navigate('')}>{bucket}</button>
            </span>
          )}
          {crumbs.map((crumb, i) => {
            const crumbPrefix = crumbs.slice(0, i + 1).join('/') + '/';
            return (
              <span key={crumbPrefix}>
                <span className="crumb-sep">/</span>
                <button type="button" className="crumb" onClick={() => navigate(crumbPrefix)}>{crumb}</button>
              </span>
            );
          })}
        </div>

        {loading && <p className="loading" style={{ padding: '1rem' }}>Loading…</p>}
        {error && <p className="error" style={{ padding: '1rem' }}>{error}</p>}

        <div className="file-list">
          {/* Bucket list */}
          {bucket === null && !loading && buckets.map(b => {
            const allowed = isBucketAllowed(b, allowedPaths);
            return (
              <div
                key={b}
                className={`file-row folder-row ${!allowed ? 'row-disallowed' : ''}`}
                onClick={() => allowed && enterBucket(b)}
                title={!allowed ? 'You do not have access to this bucket' : undefined}
              >
                <span className="file-icon">🪣</span>
                <span>{b}</span>
                {!allowed && <span className="disallowed-tag">no access</span>}
              </div>
            );
          })}
          {bucket === null && !loading && !error && buckets.length === 0 && (
            <p className="empty">No buckets found</p>
          )}

          {/* Folder / file list inside a bucket */}
          {bucket !== null && !loading && (
            <>
              {prefixes.map(p => {
                const folderName = p.slice(prefix.length);
                const allowed = isAllowed(bucket, p, allowedPaths);
                const checked = selectedFolders.has(p);
                return (
                  <div
                    key={p}
                    className={`file-row folder-row ${checked ? 'selected' : ''} ${!allowed ? 'row-disallowed' : ''}`}
                    title={!allowed ? 'You do not have write access to this path' : undefined}
                  >
                    {allowed
                      ? <input type="checkbox" checked={checked} onChange={() => toggleFolder(p)} onClick={e => e.stopPropagation()} title="Select all files in this folder" />
                      : <span className="checkbox-placeholder" />
                    }
                    <span className="file-icon folder-navigate" onClick={() => navigate(p)}>📁</span>
                    <span className="file-name folder-navigate" onClick={() => navigate(p)}>{folderName}</span>
                    {!allowed && <span className="disallowed-tag">no access</span>}
                  </div>
                );
              })}
              {files.map(f => {
                const fileName = f.key.slice(prefix.length);
                const allowed = isAllowed(bucket, f.key, allowedPaths);
                const checked = selectedFiles.has(f.key);
                return (
                  <div
                    key={f.key}
                    className={`file-row ${checked ? 'selected' : ''} ${!allowed ? 'row-disallowed' : ''}`}
                    onClick={() => allowed && toggleFile(f.key)}
                    title={!allowed ? 'You do not have write access to this path' : undefined}
                  >
                    {allowed
                      ? <input type="checkbox" checked={checked} onChange={() => toggleFile(f.key)} onClick={e => e.stopPropagation()} />
                      : <span className="checkbox-placeholder" />
                    }
                    <span className="file-icon">📄</span>
                    <span className="file-name">{fileName}</span>
                    <span className="file-size">{formatSize(f.size)}</span>
                    {!allowed && <span className="disallowed-tag">no access</span>}
                  </div>
                );
              })}
              {prefixes.length === 0 && files.length === 0 && (
                <p className="empty">No files found</p>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <span>
            {totalSelected === 0
              ? 'Nothing selected'
              : [
                  selectedFiles.size > 0 && `${selectedFiles.size} file${selectedFiles.size !== 1 ? 's' : ''}`,
                  selectedFolders.size > 0 && `${selectedFolders.size} folder${selectedFolders.size !== 1 ? 's' : ''}`,
                ].filter(Boolean).join(', ') + ' selected'}
          </span>
          <button type="button" onClick={handleAdd} disabled={totalSelected === 0 || resolving}>
            {resolving ? 'Resolving…' : 'Add to job'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
