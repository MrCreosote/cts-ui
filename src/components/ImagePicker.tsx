import { useState, useEffect } from 'react';
import type { Image } from '../types';
import { fetchImages } from '../api/cts';

interface Props {
  proxyUrl: string;
  baseUrl: string;
  token: string;
  value: Image | null;
  onChange: (image: Image) => void;
}

export function ImagePicker({ proxyUrl, baseUrl, token, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!open || !token || !baseUrl) return;
    setLoading(true);
    setError('');
    fetchImages(proxyUrl, baseUrl, token)
      .then(setImages)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, proxyUrl, baseUrl, token]);

  const filtered = filter.trim()
    ? images.filter(img =>
        `${img.name}:${img.tag ?? ''}`.toLowerCase().includes(filter.toLowerCase())
      )
    : images;

  function select(img: Image) {
    onChange(img);
    setOpen(false);
    setFilter('');
  }

  return (
    <div className="field">
      <label>Image</label>

      {value ? (
        <div className="selected-card">
          <div className="selected-card-header">
            <span className="selected-card-title">{value.name}{value.tag ? `:${value.tag}` : ''}</span>
            <button type="button" className="change-btn" onClick={() => setOpen(true)}>Change…</button>
          </div>
          {value.entrypoint.length > 0 && (
            <div className="selected-card-row">
              <span className="selected-card-label">Entrypoint</span>
              <code>{value.entrypoint.join(' ')}</code>
            </div>
          )}
          <div className="selected-card-meta">
            Registered {formatDate(value.registered_on)} by {value.registered_by}
          </div>
        </div>
      ) : (
        <button type="button" className="pick-btn" onClick={() => setOpen(true)}>Select Image…</button>
      )}

      {open && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal picker-modal">
            <div className="modal-header">
              <span>Select Image</span>
              <button type="button" className="close-btn" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="picker-filter-row">
              <input
                type="text"
                placeholder="Filter by name or tag…"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                autoFocus
              />
            </div>

            {loading && <p className="loading" style={{ padding: '1rem' }}>Loading…</p>}
            {error && <p className="error" style={{ padding: '1rem' }}>{error}</p>}

            <div className="picker-list">
              {filtered.map(img => (
                <div
                  key={img.digest}
                  className={`picker-card ${value?.digest === img.digest ? 'picker-card-selected' : ''}`}
                  onClick={() => select(img)}
                >
                  <div className="picker-card-title">
                    {img.name}{img.tag ? `:${img.tag}` : ''}
                  </div>

                  {img.entrypoint.length > 0 && (
                    <div className="picker-card-row">
                      <span className="picker-card-label">Entrypoint</span>
                      <code>{img.entrypoint.join(' ')}</code>
                    </div>
                  )}

                  {img.usage_notes && (
                    <div className="picker-card-row">
                      <span className="picker-card-label">Usage notes</span>
                      <span className="picker-card-notes">{img.usage_notes}</span>
                    </div>
                  )}

                  {img.urls && img.urls.length > 0 && (
                    <div className="picker-card-row">
                      <span className="picker-card-label">Links</span>
                      <span className="picker-card-links">
                        {img.urls.map(url => (
                          <a key={url} href={url} target="_blank" rel="noreferrer"
                             onClick={e => e.stopPropagation()}>
                            {url}
                          </a>
                        ))}
                      </span>
                    </div>
                  )}

                  <div className="picker-card-meta">
                    Registered {formatDate(img.registered_on)} by {img.registered_by}
                    {' · '}
                    <code className="digest">{img.digest.slice(0, 20)}…</code>
                  </div>
                </div>
              ))}
              {!loading && filtered.length === 0 && (
                <p className="empty">{filter ? 'No images match that filter' : 'No images found'}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}
