import { useState, useEffect } from 'react';
import type { S3Object } from '../types';
import { listS3Objects } from '../api/s3proxy';

interface Props {
  proxyUrl: string;
  s3Endpoint: string;
  accessKey: string;
  secretKey: string;
  onAdd: (paths: string[]) => void;
}

export function S3FileBrowser({ proxyUrl, s3Endpoint, accessKey, secretKey, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [bucket, setBucket] = useState('');
  const [browseBucket, setBrowseBucket] = useState(''); // committed on Enter/button
  const [prefix, setPrefix] = useState('');
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [files, setFiles] = useState<S3Object[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !browseBucket) return;
    setLoading(true);
    setError('');
    listS3Objects(proxyUrl, s3Endpoint, accessKey, secretKey, browseBucket, prefix)
      .then(result => {
        setPrefixes(result.prefixes);
        setFiles(result.files);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, browseBucket, prefix, proxyUrl, s3Endpoint, accessKey, secretKey]);

  function navigate(p: string) {
    setPrefix(p);
    setSelected(new Set());
  }

  function startBrowse() {
    const b = bucket.trim();
    if (!b) return;
    setPrefixes([]);
    setFiles([]);
    setPrefix('');
    setSelected(new Set());
    setError('');
    setBrowseBucket(b);
  }

  function toggleFile(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function handleAdd() {
    const paths = Array.from(selected).map(key => `${browseBucket}/${key}`);
    onAdd(paths);
    setSelected(new Set());
    setOpen(false);
  }

  const crumbs = prefix ? prefix.split('/').filter(Boolean) : [];

  if (!open) {
    return (
      <button type="button" className="browse-btn" onClick={() => setOpen(true)}>
        Browse S3…
      </button>
    );
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpen(false)}>
      <div className="modal">
        <div className="modal-header">
          <span>Browse S3</span>
          <button type="button" className="close-btn" onClick={() => setOpen(false)}>✕</button>
        </div>

        {/* Bucket selector */}
        <div className="bucket-bar">
          <label>Bucket</label>
          <input
            type="text"
            value={bucket}
            onChange={e => setBucket(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startBrowse()}
            placeholder="bucket name"
          />
          <button type="button" onClick={startBrowse} disabled={!bucket.trim()}>
            Browse
          </button>
        </div>

        {/* Breadcrumbs */}
        {browseBucket && (
          <div className="breadcrumbs">
            <button type="button" className="crumb" onClick={() => navigate('')}>
              {browseBucket}
            </button>
            {crumbs.map((crumb, i) => {
              const crumbPrefix = crumbs.slice(0, i + 1).join('/') + '/';
              return (
                <span key={crumbPrefix}>
                  <span className="crumb-sep">/</span>
                  <button type="button" className="crumb" onClick={() => navigate(crumbPrefix)}>
                    {crumb}
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {loading && <p className="loading" style={{ padding: '1rem' }}>Loading…</p>}
        {error && <p className="error" style={{ padding: '1rem' }}>{error}</p>}

        {browseBucket && (
          <div className="file-list">
            {prefixes.map(p => {
              const folderName = p.slice(prefix.length);
              return (
                <div key={p} className="file-row folder-row" onClick={() => navigate(p)}>
                  <span className="file-icon">📁</span>
                  <span>{folderName}</span>
                </div>
              );
            })}
            {files.map(f => {
              const fileName = f.key.slice(prefix.length);
              const checked = selected.has(f.key);
              return (
                <div
                  key={f.key}
                  className={`file-row ${checked ? 'selected' : ''}`}
                  onClick={() => toggleFile(f.key)}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleFile(f.key)}
                    onClick={e => e.stopPropagation()}
                  />
                  <span className="file-icon">📄</span>
                  <span className="file-name">{fileName}</span>
                  <span className="file-size">{formatSize(f.size)}</span>
                </div>
              );
            })}
            {!loading && prefixes.length === 0 && files.length === 0 && (
              <p className="empty">No files found</p>
            )}
          </div>
        )}

        <div className="modal-footer">
          <span>{selected.size} file{selected.size !== 1 ? 's' : ''} selected</span>
          <button type="button" onClick={handleAdd} disabled={selected.size === 0}>
            Add to job
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
