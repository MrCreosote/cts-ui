import { useState, useEffect } from 'react';
import type { S3Object } from '../types';
import { listBuckets, listS3Objects, listAllObjects } from '../api/s3proxy';

interface Props {
  proxyUrl: string;
  s3Endpoint: string;
  accessKey: string;
  secretKey: string;
  onAdd: (paths: string[]) => void;
}

export function S3FileBrowser({ proxyUrl, s3Endpoint, accessKey, secretKey, onAdd }: Props) {
  const [open, setOpen] = useState(false);

  const [bucket, setBucket] = useState<string | null>(null);
  const [prefix, setPrefix] = useState('');

  const [buckets, setBuckets] = useState<string[]>([]);
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [files, setFiles] = useState<S3Object[]>([]);

  // Separate sets for files (keys) and folders (prefixes)
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
  }, [open, bucket, prefix, proxyUrl, s3Endpoint, accessKey, secretKey]);

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
      const paths: string[] = selectedFiles.size > 0
        ? Array.from(selectedFiles).map(key => `${bucket}/${key}`)
        : [];

      // Resolve each selected folder recursively
      for (const folderPrefix of selectedFolders) {
        const folderPaths = await listAllObjects(
          proxyUrl, s3Endpoint, accessKey, secretKey, bucket, folderPrefix
        );
        paths.push(...folderPaths);
      }

      onAdd(paths);
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
          <button type="button" className="close-btn" onClick={handleClose}>✕</button>
        </div>

        <div className="breadcrumbs">
          <button type="button" className="crumb" onClick={backToBuckets}>
            buckets
          </button>
          {bucket && (
            <span>
              <span className="crumb-sep">/</span>
              <button type="button" className="crumb" onClick={() => navigate('')}>
                {bucket}
              </button>
            </span>
          )}
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

        {loading && <p className="loading" style={{ padding: '1rem' }}>Loading…</p>}
        {error && <p className="error" style={{ padding: '1rem' }}>{error}</p>}

        <div className="file-list">
          {bucket === null && !loading && buckets.map(b => (
            <div key={b} className="file-row folder-row" onClick={() => enterBucket(b)}>
              <span className="file-icon">🪣</span>
              <span>{b}</span>
            </div>
          ))}
          {bucket === null && !loading && !error && buckets.length === 0 && (
            <p className="empty">No buckets found</p>
          )}

          {bucket !== null && !loading && (
            <>
              {prefixes.map(p => {
                const folderName = p.slice(prefix.length);
                const checked = selectedFolders.has(p);
                return (
                  <div
                    key={p}
                    className={`file-row folder-row ${checked ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFolder(p)}
                      onClick={e => e.stopPropagation()}
                      title="Select all files in this folder"
                    />
                    <span
                      className="file-icon folder-navigate"
                      onClick={() => navigate(p)}
                      title="Open folder"
                    >📁</span>
                    <span
                      className="file-name folder-navigate"
                      onClick={() => navigate(p)}
                    >{folderName}</span>
                  </div>
                );
              })}
              {files.map(f => {
                const fileName = f.key.slice(prefix.length);
                const checked = selectedFiles.has(f.key);
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
