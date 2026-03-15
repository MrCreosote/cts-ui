interface Resources {
  cpus: number;
  memory: string;
  runtimeHours: number;
  runtimeMinutes: number;
  numContainers: number;
}

interface Props {
  value: Resources;
  onChange: (r: Resources) => void;
}

export function ResourceInputs({ value, onChange }: Props) {
  function set<K extends keyof Resources>(key: K, v: Resources[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="field">
      <label>Resources</label>
      <div className="resources-grid">
        <div className="resource-item">
          <label>CPUs</label>
          <input
            type="number"
            min={1}
            max={256}
            value={value.cpus}
            onChange={e => set('cpus', Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>
        <div className="resource-item">
          <label>Memory</label>
          <input
            type="text"
            value={value.memory}
            onChange={e => set('memory', e.target.value)}
            placeholder="e.g. 1GB, 500MB"
          />
        </div>
        <div className="resource-item">
          <label>Runtime (hours)</label>
          <input
            type="number"
            min={0}
            value={value.runtimeHours}
            onChange={e => set('runtimeHours', Math.max(0, parseInt(e.target.value) || 0))}
          />
        </div>
        <div className="resource-item">
          <label>Runtime (minutes)</label>
          <input
            type="number"
            min={0}
            max={59}
            value={value.runtimeMinutes}
            onChange={e => set('runtimeMinutes', Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
          />
        </div>
        <div className="resource-item">
          <label>Containers</label>
          <input
            type="number"
            min={1}
            max={1000}
            value={value.numContainers}
            onChange={e => set('numContainers', Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>
      </div>
    </div>
  );
}

export function toISODuration(hours: number, minutes: number): string {
  if (hours === 0 && minutes === 0) return 'PT1M';
  const h = hours > 0 ? `${hours}H` : '';
  const m = minutes > 0 ? `${minutes}M` : '';
  return `PT${h}${m}`;
}

export type { Resources };
