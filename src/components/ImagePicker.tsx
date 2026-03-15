import { useState, useEffect } from 'react';
import type { Image } from '../types';
import { fetchImages } from '../api/cts';

interface Props {
  proxyUrl: string;
  baseUrl: string;
  token: string;
  value: Image | null;
  onChange: (image: Image | null) => void;
}

export function ImagePicker({ proxyUrl, baseUrl, token, value, onChange }: Props) {
  const [images, setImages] = useState<Image[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!proxyUrl || !baseUrl || !token) return;
    setLoading(true);
    setError('');
    fetchImages(proxyUrl, baseUrl, token)
      .then(setImages)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [proxyUrl, baseUrl, token]);

  const selectedUri = value ? `${value.name}@${value.digest}` : '';

  function handleChange(uri: string) {
    const img = images.find(i => `${i.name}@${i.digest}` === uri) ?? null;
    onChange(img);
  }

  return (
    <div className="field">
      <label>Image</label>
      {loading && <span className="loading">Loading images…</span>}
      {error && <span className="error">{error}</span>}
      <select
        value={selectedUri}
        onChange={e => handleChange(e.target.value)}
        disabled={loading || images.length === 0}
      >
        <option value="">-- select an image --</option>
        {images.map(img => {
          const uri = `${img.name}@${img.digest}`;
          const label = img.tag ? `${img.name}:${img.tag}` : img.name;
          return <option key={uri} value={uri}>{label}</option>;
        })}
      </select>

      {value && <ImageDetail image={value} />}
    </div>
  );
}

function ImageDetail({ image }: { image: Image }) {
  return (
    <div className="image-detail">
      <div className="image-detail-row">
        <span><strong>Entrypoint:</strong> <code>{image.entrypoint.join(' ')}</code></span>
      </div>

      <div className="image-detail-row">
        <span><strong>Digest:</strong> <code className="digest">{image.digest}</code></span>
      </div>

      <div className="image-detail-row">
        <span>
          <strong>Registered</strong> {formatDate(image.registered_on)} by {image.registered_by}
        </span>
      </div>

      {image.urls && image.urls.length > 0 && (
        <div className="image-detail-row">
          <strong>Links:</strong>
          <ul className="image-urls">
            {image.urls.map(url => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer">{url}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {image.usage_notes && (
        <div className="image-detail-row">
          <strong>Usage notes:</strong>
          <p className="image-usage-notes">{image.usage_notes}</p>
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
