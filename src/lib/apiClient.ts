// Typed API calls. Responses are validated with the same zod schemas the server uses.

import {
  apiErrorSchema,
  invitationDtoSchema,
  type ApiErrorCode,
  type InvitationDto,
  type RsvpRequest,
} from '../../shared/schemas';

export type ClientErrorCode = ApiErrorCode | 'network' | 'bad_response';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ClientErrorCode,
  ) {
    super(code);
  }
}

async function requestJson(url: string, init: RequestInit = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      credentials: 'same-origin',
      headers: { accept: 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    throw new ApiError(response.status, parsed.success ? parsed.data.error : 'server_error');
  }
  return body;
}

function parseInvitation(body: unknown): InvitationDto {
  const parsed = invitationDtoSchema.safeParse(body);
  if (!parsed.success) throw new ApiError(200, 'bad_response');
  return parsed.data;
}

export async function fetchInvitation(code: string): Promise<InvitationDto> {
  return parseInvitation(await requestJson(`/api/invitation?code=${encodeURIComponent(code)}`));
}

export async function submitRsvp(request: RsvpRequest): Promise<InvitationDto> {
  return parseInvitation(
    await requestJson('/api/rsvp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    }),
  );
}
