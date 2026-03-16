import { useState, useEffect } from 'react';
import type { Credentials } from '../types';
import { DEFAULT_CREDENTIALS } from '../types';

const STORAGE_KEY = 'cts-ui-credentials';

export function useCredentials() {
  const [credentials, setCredentials] = useState<Credentials>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return { ...DEFAULT_CREDENTIALS, ...JSON.parse(stored) };
    } catch {
      // ignore
    }
    return DEFAULT_CREDENTIALS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
  }, [credentials]);

  function resetCredentials() {
    localStorage.removeItem(STORAGE_KEY);
    setCredentials(DEFAULT_CREDENTIALS);
  }

  return { credentials, setCredentials, resetCredentials };
}
