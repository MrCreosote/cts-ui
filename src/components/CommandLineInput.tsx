import { useRef } from 'react';

const PLACEHOLDER = '{{INSERT_FILES}}';

interface Props {
  value: string;
  onChange: (v: string) => void;
  entrypoint: string[] | null;
  inputMountPoint: string;
  outputMountPoint: string;
}

export function CommandLineInput({ value, onChange, entrypoint, inputMountPoint, outputMountPoint }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertFilesAtCursor() {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const needsSpaceBefore = before.length > 0 && !before.endsWith(' ');
    const needsSpaceAfter = after.length > 0 && !after.startsWith(' ');
    const insertion =
      (needsSpaceBefore ? ' ' : '') + PLACEHOLDER + (needsSpaceAfter ? ' ' : '');
    onChange(before + insertion + after);
    const newPos = start + insertion.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newPos, newPos);
    });
  }

  const segments = value.split(PLACEHOLDER);
  const hasPlaceholder = segments.length > 1;
  const multipleOccurrences = segments.length > 2;

  return (
    <div className="field">
      <label>Command Line Arguments</label>
      <p className="field-hint">
        Input files will be mounted at <code>{inputMountPoint}</code>.
        Output should be written to <code>{outputMountPoint}</code>.
      </p>

      {entrypoint && entrypoint.length > 0 && (
        <div className="entrypoint-display">
          <span className="entrypoint-label">Entrypoint (from image):</span>
          <span className="entrypoint-value">{entrypoint.join(' ')}</span>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        placeholder="e.g. --input {{INSERT_FILES}} --output /output_files/result.txt"
        spellCheck={false}
      />
      <button type="button" className="insert-btn" onClick={insertFilesAtCursor}>
        Insert files at cursor
      </button>

      {value && (
        <div className="cli-preview" aria-label="Command preview">
          {segments.map((seg, i) => (
            <span key={i}>
              <span className="cli-literal">{seg}</span>
              {i < segments.length - 1 && (
                <mark className={`cli-token ${multipleOccurrences ? 'cli-token-error' : ''}`}>
                  {PLACEHOLDER}
                </mark>
              )}
            </span>
          ))}
          {!hasPlaceholder && value && (
            <span className="cli-hint"> (no file insertion point)</span>
          )}
        </div>
      )}
      {multipleOccurrences && (
        <p className="error">Only one {PLACEHOLDER} is allowed.</p>
      )}
    </div>
  );
}

/**
 * Parse the command line string into an array of CLI arguments,
 * replacing the placeholder with the input_files special object.
 * Returns null if there are multiple placeholders.
 */
export function parseCliArguments(value: string): Array<string | { type: 'input_files'; input_files_format: 'space_separated_list' }> | null {
  const parts = value.split(PLACEHOLDER);
  if (parts.length > 2) return null;

  const result: Array<string | { type: 'input_files'; input_files_format: 'space_separated_list' }> = [];
  parts.forEach((part, i) => {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    result.push(...tokens);
    if (i < parts.length - 1) {
      result.push({ type: 'input_files', input_files_format: 'space_separated_list' });
    }
  });
  return result;
}
