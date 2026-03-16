import { useState } from 'react';
import type { Credentials } from '../types';
import { DEFAULT_CREDENTIALS } from '../types';

interface Props {
  credentials: Credentials;
  onChange: (c: Credentials) => void;
  onReset: () => void;
}

export function CredentialsPanel({ credentials, onChange, onReset }: Props) {
  const [open, setOpen] = useState(!credentials.kbaseToken);
  // Local draft — only committed to parent on Save
  const [draft, setDraft] = useState<Credentials>(credentials);

  function field(label: string, key: keyof Credentials, type = 'text') {
    return (
      <div className="field">
        <label>{label}</label>
        <input
          type={type}
          value={draft[key]}
          onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
          autoComplete="off"
        />
      </div>
    );
  }

  function save() {
    onChange(draft);
    setOpen(false);
  }

  return (
    <section className="credentials-panel">
      <button className="collapsible-header" onClick={() => setOpen(o => !o)}>
        <span>{open ? '▾' : '▸'} Credentials &amp; Settings</span>
        {!open && credentials.kbaseToken && <span className="saved-badge">✓ connected</span>}
      </button>
      {open && (
        <div className="credentials-body">
          <p className="warning">
            Credentials are stored in your browser's localStorage. Do not use this UI on a shared or untrusted machine.
          </p>
          <div className="fields-grid">
            {field('KBase Auth Token', 'kbaseToken', 'password')}
            {field('CTS Base URL', 'ctsBaseUrl')}
            {field('S3 Endpoint', 's3Endpoint')}
            {field('S3 Access Key', 's3AccessKey')}
            {field('S3 Secret Key', 's3SecretKey', 'password')}
            {field('Proxy URL (local dev)', 'proxyUrl')}
          </div>
          <div className="credentials-footer">
            <button type="button" className="reset-btn" onClick={() => {
              onReset();
              setDraft(DEFAULT_CREDENTIALS);
            }}>
              Reset to defaults
            </button>
            <button type="button" className="save-btn" onClick={save}>
              Save &amp; Connect
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
