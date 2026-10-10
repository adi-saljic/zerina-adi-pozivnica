import type { AdminSummary } from '../../shared/adminTypes';
import { apiErrorSchema } from '../../shared/schemas';
import { ApiError } from '../lib/apiClient';

async function adminFetch(path: string, token: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, {
      headers: { authorization: `Bearer ${token}` },
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(await response.json().catch(() => null));
    throw new ApiError(response.status, parsed.success ? parsed.data.error : 'server_error');
  }
  return response;
}

export async function fetchAdminSummary(token: string): Promise<AdminSummary> {
  return (await (await adminFetch('/api/admin/summary', token)).json()) as AdminSummary;
}

/** The token travels in a header, so a plain <a href> can't be used: fetch, then save the blob. */
export async function downloadGuestsCsv(token: string): Promise<void> {
  const response = await adminFetch('/api/admin/export.csv', token);
  const blob = await response.blob();
  const filename =
    /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ??
    'gosti.csv';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
