import { useState, useEffect } from 'react';
import type { Credentials, Image, AllowedPath, ChecksumStatus, S3FileEntry } from '../types';
import { ImagePicker } from './ImagePicker';
import { ClusterPicker } from './ClusterPicker';
import { S3FileBrowser } from './S3FileBrowser';
import { CommandLineInput, parseCliArguments } from './CommandLineInput';
import { ResourceInputs, toISODuration } from './ResourceInputs';
import type { Resources } from './ResourceInputs';
import { submitJob, fetchWhoami } from '../api/cts';
import { checkObjectChecksum } from '../api/s3proxy';

interface Props {
  credentials: Credentials;
}

const DEFAULT_RESOURCES: Resources = {
  cpus: 1,
  memory: '10MB',
  runtimeHours: 0,
  runtimeMinutes: 1,
  numContainers: 1,
};

export function JobForm({ credentials }: Props) {
  const [image, setImage] = useState<Image | null>(null);
  const [cluster, setCluster] = useState('');
  const [inputFiles, setInputFiles] = useState<string[]>([]);
  const [checksumStatus, setChecksumStatus] = useState<Record<string, ChecksumStatus>>({});
  const [outputDir, setOutputDir] = useState('');
  const [inputMountPoint, setInputMountPoint] = useState('/input_files');
  const [outputMountPoint, setOutputMountPoint] = useState('/output_files');
  const [commandLine, setCommandLine] = useState('');
  const [resources, setResources] = useState<Resources>(DEFAULT_RESOURCES);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [allowedPaths, setAllowedPaths] = useState<AllowedPath[] | null>(null);

  useEffect(() => {
    if (!credentials.kbaseToken || !credentials.ctsBaseUrl || !credentials.proxyUrl) return;
    fetchWhoami(credentials.proxyUrl, credentials.ctsBaseUrl, credentials.kbaseToken)
      .then(result => setAllowedPaths(result.allowed_paths))
      .catch(() => setAllowedPaths(null));
  }, [credentials.proxyUrl, credentials.ctsBaseUrl, credentials.kbaseToken]);

  function recheckChecksum(path: string) {
    const slashIdx = path.indexOf('/');
    const bucket = path.slice(0, slashIdx);
    const key = path.slice(slashIdx + 1);
    setChecksumStatus(prev => ({ ...prev, [path]: 'checking' }));
    checkObjectChecksum(credentials.proxyUrl, credentials.s3Endpoint, credentials.s3AccessKey, credentials.s3SecretKey, bucket, key)
      .then(ok => setChecksumStatus(prev => ({ ...prev, [path]: ok ? 'ok' : 'missing' })))
      .catch(() => setChecksumStatus(prev => ({ ...prev, [path]: 'error' })));
  }

  function addFiles(entries: S3FileEntry[]) {
    setInputFiles(prev => {
      const next = [...prev];
      for (const { path } of entries) {
        if (!next.includes(path)) next.push(path);
      }
      return next;
    });
    for (const { path } of entries) recheckChecksum(path);
  }

  function removeFile(path: string) {
    setInputFiles(prev => prev.filter(f => f !== path));
    setChecksumStatus(prev => { const next = { ...prev }; delete next[path]; return next; });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitResult(null);

    if (!image) return alert('Please select an image.');
    if (!cluster) return alert('Please select a cluster.');
    if (inputFiles.length === 0) return alert('Please add at least one input file.');
    if (!outputDir.trim()) return alert('Please specify an output directory.');

    const missingChecksum = inputFiles.filter(f => checksumStatus[f] === 'missing' || checksumStatus[f] === 'error');
    if (missingChecksum.length > 0) {
      const proceed = window.confirm(
        `${missingChecksum.length} file(s) are missing a CRC64NVME checksum and will be rejected by the server. Submit anyway?`
      );
      if (!proceed) return;
    }

    const cliArgs = parseCliArguments(commandLine);
    if (cliArgs === null) {
      return alert('Command line contains more than one {{INSERT_FILES}} placeholder.');
    }

    const job = {
      cluster,
      image: `${image.name}@${image.digest}`,
      params: {
        input_mount_point: inputMountPoint,
        output_mount_point: outputMountPoint,
        cli_arguments: cliArgs.length > 0 ? cliArgs : null,
      },
      num_containers: resources.numContainers,
      cpus: resources.cpus,
      memory: resources.memory,
      runtime: toISODuration(resources.runtimeHours, resources.runtimeMinutes),
      output_dir: outputDir.trim(),
      input_files: inputFiles,
    };

    setSubmitting(true);
    try {
      const result = await submitJob(credentials.proxyUrl, credentials.ctsBaseUrl, credentials.kbaseToken, job);
      setSubmitResult({ ok: true, message: `Job submitted! ID: ${result.id ?? JSON.stringify(result)}` });
    } catch (e) {
      setSubmitResult({ ok: false, message: String(e) });
    } finally {
      setSubmitting(false);
    }
  }

  const missingCreds = !credentials.kbaseToken;
  const hasMissingChecksum = inputFiles.some(f => checksumStatus[f] === 'missing' || checksumStatus[f] === 'error');

  return (
    <form className="job-form" onSubmit={handleSubmit}>
      <h2>Submit Job</h2>

      {missingCreds && (
        <p className="warning">Enter your credentials above before submitting a job.</p>
      )}

      <ImagePicker
        proxyUrl={credentials.proxyUrl}
        baseUrl={credentials.ctsBaseUrl}
        token={credentials.kbaseToken}
        value={image}
        onChange={setImage}
      />

      <ClusterPicker
        proxyUrl={credentials.proxyUrl}
        baseUrl={credentials.ctsBaseUrl}
        token={credentials.kbaseToken}
        value={cluster}
        onChange={setCluster}
      />

      {/* Input Files */}
      <div className="field">
        <label>Input Files</label>
        <div className="file-selection">
          <S3FileBrowser
            proxyUrl={credentials.proxyUrl}
            s3Endpoint={credentials.s3Endpoint}
            accessKey={credentials.s3AccessKey}
            secretKey={credentials.s3SecretKey}
            allowedPaths={allowedPaths}
            onAdd={addFiles}
          />
          {hasMissingChecksum && (
            <p className="warning" style={{ marginTop: '0.5rem' }}>
              ⚠ One or more files are missing a CRC64NVME checksum and will be rejected by the server.
            </p>
          )}
          {inputFiles.length > 0 && (
            <ul className="file-chips">
              {inputFiles.map(f => {
                const cs = checksumStatus[f];
                return (
                  <li key={f} className={`file-chip ${cs === 'missing' || cs === 'error' ? 'file-chip-warn' : ''}`}>
                    <span className="file-chip-path">{f}</span>
                    <span className={`checksum-badge checksum-${cs ?? 'unknown'}`} title={checksumBadgeTitle(cs)}>
                      {checksumBadgeIcon(cs)}
                    </span>
                    {(cs === 'missing' || cs === 'error') && (
                      <button type="button" className="recheck-btn" onClick={() => recheckChecksum(f)} title="Re-check checksum">
                        ↻
                      </button>
                    )}
                    <button type="button" onClick={() => removeFile(f)} title="Remove">✕</button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Output */}
      <div className="field">
        <label>Output Directory (S3 path)</label>
        <input
          type="text"
          value={outputDir}
          onChange={e => setOutputDir(e.target.value)}
          placeholder="e.g. my-bucket/results/run-001"
        />
      </div>

      {/* Mount Points */}
      <div className="field mount-points">
        <div>
          <label>Input Mount Point</label>
          <input
            type="text"
            value={inputMountPoint}
            onChange={e => setInputMountPoint(e.target.value)}
          />
        </div>
        <div>
          <label>Output Mount Point</label>
          <input
            type="text"
            value={outputMountPoint}
            onChange={e => setOutputMountPoint(e.target.value)}
          />
        </div>
      </div>

      <CommandLineInput
        value={commandLine}
        onChange={setCommandLine}
        entrypoint={image?.entrypoint ?? null}
        inputMountPoint={inputMountPoint}
        outputMountPoint={outputMountPoint}
      />

      <ResourceInputs value={resources} onChange={setResources} />

      <div className="submit-row">
        <button type="submit" disabled={submitting || missingCreds}>
          {submitting ? 'Submitting…' : 'Submit Job'}
        </button>
      </div>

      {submitResult && (
        <p className={submitResult.ok ? 'success' : 'error'}>{submitResult.message}</p>
      )}
    </form>
  );
}

function checksumBadgeIcon(cs: ChecksumStatus | undefined): string {
  switch (cs) {
    case 'checking': return '⏳';
    case 'ok':       return '✓';
    case 'missing':  return '⚠';
    case 'error':    return '⚠';
    default:         return '?';
  }
}

function checksumBadgeTitle(cs: ChecksumStatus | undefined): string {
  switch (cs) {
    case 'checking': return 'Checking CRC64NVME checksum…';
    case 'ok':       return 'CRC64NVME checksum present';
    case 'missing':  return 'No CRC64NVME checksum — file will be rejected by CTS';
    case 'error':    return 'Could not verify checksum';
    default:         return 'Checksum status unknown';
  }
}
