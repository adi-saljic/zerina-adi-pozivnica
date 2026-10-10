import { useCallback, useState } from 'react';
import type { AdminSummary } from '../../shared/adminTypes';
import { ApiError } from '../lib/apiClient';
import { bs } from '../i18n/bs';
import { downloadGuestsCsv, fetchAdminSummary } from './adminApi';

const STORAGE_KEY = 'pozivnica.adminToken';

// localStorage can be unavailable (private mode, blocked storage): never let that break the page.
function readStoredToken(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function storeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'unauthorized') return bs.admin.wrongToken;
    if (error.code === 'not_found') return bs.admin.unavailable;
    if (error.code === 'rate_limited') return bs.error.rateLimited;
  }
  return bs.admin.failed;
}

type AdminState =
  | { status: 'idle'; error: string | null }
  | { status: 'loading' }
  | { status: 'ready'; summary: AdminSummary };

export function useAdminSummary() {
  const [storedToken] = useState(readStoredToken);
  const [token, setToken] = useState(storedToken);
  const [state, setState] = useState<AdminState>({ status: 'idle', error: null });

  const load = useCallback(async (value: string, remember: boolean) => {
    setState({ status: 'loading' });
    try {
      const summary = await fetchAdminSummary(value);
      setToken(value);
      if (remember) storeToken(value);
      setState({ status: 'ready', summary });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'unauthorized') storeToken(null);
      setState({ status: 'idle', error: errorText(error) });
    }
  }, []);

  const download = useCallback(async () => {
    try {
      await downloadGuestsCsv(token);
    } catch (error) {
      window.alert(errorText(error));
    }
  }, [token]);

  const logout = useCallback(() => {
    storeToken(null);
    setToken('');
    setState({ status: 'idle', error: null });
  }, []);

  return { token, storedToken, state, load, download, logout };
}
