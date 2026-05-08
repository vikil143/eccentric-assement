import type { Asset, AssetListQuery, AssetListResponse } from '@asset-manager/shared';

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

const BASE_URL = '/api';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;

  constructor(status: number, body: ErrorResponseBody) {
    super(body.error.message);
    this.name = 'ApiError';
    this.code = body.error.code;
    this.status = status;
    if (body.error.requestId !== undefined) {
      this.requestId = body.error.requestId;
    }
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    const body = (await res.json()) as ErrorResponseBody;
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function listAssets(query: AssetListQuery = {}): Promise<AssetListResponse> {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.kind) params.set('kind', query.kind);
  if (query.tags?.length) params.set('tags', query.tags.join(','));
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.page != null) params.set('page', String(query.page));
  if (query.pageSize != null) params.set('pageSize', String(query.pageSize));
  if (query.sort) params.set('sort', query.sort);
  const qs = params.toString();
  return request<AssetListResponse>(`/assets${qs ? `?${qs}` : ''}`);
}

export async function getAsset(id: string): Promise<Asset> {
  return request<Asset>(`/assets/${id}`);
}

export function uploadAsset(
  file: File,
  tags: string[],
  onProgress: (pct: number) => void,
): Promise<Asset> {
  return new Promise<Asset>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);
    if (tags.length) form.append('tags', tags.join(','));

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as Asset);
      } else {
        try {
          const body = JSON.parse(xhr.responseText) as ErrorResponseBody;
          reject(new ApiError(xhr.status, body));
        } catch {
          reject(
            new ApiError(xhr.status, { error: { code: 'UNKNOWN', message: xhr.statusText } }),
          );
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new ApiError(0, { error: { code: 'NETWORK_ERROR', message: 'Network error' } }));
    });

    xhr.addEventListener('abort', () => {
      reject(new ApiError(0, { error: { code: 'UPLOAD_ABORTED', message: 'Upload aborted' } }));
    });

    xhr.open('POST', `${BASE_URL}/assets`);
    xhr.send(form);
  });
}

export async function deleteAsset(id: string): Promise<void> {
  await request<void>(`/assets/${id}`, { method: 'DELETE' });
}

export async function getTags(): Promise<string[]> {
  const data = await request<{ tags: string[] }>('/assets/tags');
  return data.tags;
}
