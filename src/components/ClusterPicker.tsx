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
  const [open, setOpen] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !token || !baseUrl) return;
    setLoading(true);
    setError('');
    fetchSites(proxyUrl, baseUrl, token)
      .then(setSites)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, proxyUrl, baseUrl, token]);

  const selectedSite = sites.find(s => s.cluster === value) ?? null;

  function select(site: Site) {
    onChange(site.cluster);
    setOpen(false);
  }

  return (
    <div className="field">
      <label>Cluster</label>

      {value ? (
        <div className="selected-card">
          <div className="selected-card-header">
            <span className="selected-card-title">{value}</span>
            <button type="button" className="change-btn" onClick={() => setOpen(true)}>Change…</button>
          </div>
          {selectedSite && <SiteSummary site={selectedSite} />}
        </div>
      ) : (
        <button type="button" className="pick-btn" onClick={() => setOpen(true)}>Select Cluster…</button>
      )}

      {open && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal picker-modal">
            <div className="modal-header">
              <span>Select Cluster</span>
              <button type="button" className="close-btn" onClick={() => setOpen(false)}>✕</button>
            </div>

            {loading && <p className="loading" style={{ padding: '1rem' }}>Loading…</p>}
            {error && <p className="error" style={{ padding: '1rem' }}>{error}</p>}

            <div className="picker-list">
              {sites.map(site => {
                const usable = site.active && site.available;
                const reason = site.unavailable_reason
                  ?? (!site.active && !site.available ? 'inactive & unavailable'
                    : !site.active ? 'inactive'
                    : 'unavailable');
                return (
                  <div
                    key={site.cluster}
                    className={`picker-card ${!usable ? 'picker-card-disabled' : ''} ${value === site.cluster ? 'picker-card-selected' : ''}`}
                    onClick={() => usable && select(site)}
                  >
                    <div className="picker-card-title">
                      {site.cluster}
                      {!usable && (
                        <span className="disallowed-tag" style={{ marginLeft: '0.5rem' }}>{reason}</span>
                      )}
                    </div>
                    <SiteSummary site={site} />
                    {site.notes.length > 0 && (
                      <ul className="picker-site-notes">
                        {site.notes.map((n, i) => <li key={i}>{n}</li>)}
                      </ul>
                    )}
                  </div>
                );
              })}
              {!loading && sites.length === 0 && !error && (
                <p className="empty">No clusters returned</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SiteSummary({ site }: { site: Site }) {
  return (
    <div className="picker-site-summary">
      {site.nodes !== null && <span>{site.nodes} nodes</span>}
      <span>{site.cpus_per_node} CPU{site.cpus_per_node !== 1 ? 's' : ''}/node</span>
      <span>{site.memory_per_node_gb} GB/node</span>
      <span>Max {formatRuntime(site.max_runtime_min)}</span>
    </div>
  );
}

function formatRuntime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}
