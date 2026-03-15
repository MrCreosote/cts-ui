import { useState, useEffect } from 'react';
import type { Site } from '../types';
import { fetchSites } from '../api/cts';

interface Props {
  proxyUrl: string;
  baseUrl: string;
  token: string;
  value: string;
  onChange: (cluster: string) => void;
}

export function ClusterPicker({ proxyUrl, baseUrl, token, value, onChange }: Props) {
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!proxyUrl || !baseUrl || !token) return;
    setLoading(true);
    setLoaded(false);
    setError('');
    fetchSites(proxyUrl, baseUrl, token)
      .then(setSites)
      .catch(e => setError(e.message))
      .finally(() => { setLoading(false); setLoaded(true); });
  }, [proxyUrl, baseUrl, token]);

  const usable = sites.filter(s => s.active && s.available);
  const unusable = sites.filter(s => !s.active || !s.available);

  function unusableReason(s: Site) {
    if (!s.active && !s.available) return 'inactive, unavailable';
    if (!s.active) return 'inactive';
    return 'unavailable';
  }

  return (
    <div className="field">
      <label>Cluster</label>
      {loading && <span className="loading">Loading clusters…</span>}
      {error && <span className="error">{error}</span>}
      {loaded && sites.length === 0 && !error && (
        <span className="error">No clusters returned from /sites</span>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={loading}
      >
        <option value="">-- select a cluster --</option>
        {usable.map(s => (
          <option key={s.name} value={s.name}>{s.name}</option>
        ))}
        {unusable.length > 0 && (
          <optgroup label="Unavailable">
            {unusable.map(s => (
              <option key={s.name} value={s.name} disabled>
                {s.name} ({unusableReason(s)})
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}
