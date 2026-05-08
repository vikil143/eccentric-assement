import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { Asset } from '@asset-manager/shared';
import { listAssets, getAsset, deleteAsset, getTags, ApiError } from './api.js';

const BASE = '/api';

const mockAsset: Asset = {
  id: 'asset-1',
  filename: 'photo.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 12345,
  kind: 'image',
  url: 'https://res.cloudinary.com/demo/image/upload/photo.jpg',
  tags: ['marketing', 'Q4'],
  uploadedAt: '2024-01-01T00:00:00.000Z',
  cloudinaryPublicId: 'demo/photo',
};

const mockListResponse = { items: [mockAsset], total: 1, page: 1, pageSize: 24 };

const server = setupServer(
  http.get(`${BASE}/assets`, () => HttpResponse.json(mockListResponse)),
  http.get(`${BASE}/assets/tags`, () => HttpResponse.json({ tags: ['hero', 'marketing', 'Q4'] })),
  http.get(`${BASE}/assets/asset-1`, () => HttpResponse.json(mockAsset)),
  http.get(`${BASE}/assets/not-found`, () =>
    HttpResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Asset not found' } },
      { status: 404 },
    ),
  ),
  http.delete(`${BASE}/assets/asset-1`, () => new HttpResponse(null, { status: 204 })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('listAssets', () => {
  it('returns a typed list response', async () => {
    const result = await listAssets();
    expect(result.items).toHaveLength(1);
    const [first] = result.items;
    expect(first?.id).toBe('asset-1');
    expect(result.total).toBe(1);
  });

  it('produces no query string when called with empty query', async () => {
    let capturedSearch = '?unexpected';
    server.use(
      http.get(`${BASE}/assets`, ({ request }) => {
        capturedSearch = new URL(request.url).search;
        return HttpResponse.json(mockListResponse);
      }),
    );
    await listAssets({});
    expect(capturedSearch).toBe('');
  });

  it('serializes tags array as a comma-separated string', async () => {
    let tagsParam: string | null = null;
    server.use(
      http.get(`${BASE}/assets`, ({ request }) => {
        tagsParam = new URL(request.url).searchParams.get('tags');
        return HttpResponse.json(mockListResponse);
      }),
    );
    await listAssets({ tags: ['marketing', 'Q4'] });
    expect(tagsParam).toBe('marketing,Q4');
  });

  it('forwards sort, page, and pageSize params', async () => {
    let params: URLSearchParams | undefined;
    server.use(
      http.get(`${BASE}/assets`, ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json({ ...mockListResponse, page: 2, pageSize: 10 });
      }),
    );
    await listAssets({ sort: 'oldest', page: 2, pageSize: 10 });
    expect(params?.get('sort')).toBe('oldest');
    expect(params?.get('page')).toBe('2');
    expect(params?.get('pageSize')).toBe('10');
  });

  it('forwards the q search param', async () => {
    let qParam: string | null = null;
    server.use(
      http.get(`${BASE}/assets`, ({ request }) => {
        qParam = new URL(request.url).searchParams.get('q');
        return HttpResponse.json(mockListResponse);
      }),
    );
    await listAssets({ q: 'hero banner' });
    expect(qParam).toBe('hero banner');
  });
});

describe('getAsset', () => {
  it('returns a typed Asset', async () => {
    const asset = await getAsset('asset-1');
    expect(asset.id).toBe('asset-1');
    expect(asset.filename).toBe('photo.jpg');
    expect(asset.kind).toBe('image');
  });

  it('throws ApiError on 404', async () => {
    const err = await getAsset('not-found').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
    expect((err as ApiError).code).toBe('NOT_FOUND');
    expect((err as ApiError).message).toBe('Asset not found');
  });
});

describe('deleteAsset', () => {
  it('resolves to undefined on 204', async () => {
    await expect(deleteAsset('asset-1')).resolves.toBeUndefined();
  });
});

describe('getTags', () => {
  it('unwraps the tags array from the response envelope', async () => {
    const tags = await getTags();
    expect(tags).toEqual(['hero', 'marketing', 'Q4']);
  });
});

describe('ApiError', () => {
  it('exposes code, status, and message as own properties', async () => {
    const err = await getAsset('not-found').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.name).toBe('ApiError');
    expect(apiErr.status).toBe(404);
    expect(apiErr.code).toBe('NOT_FOUND');
    expect(apiErr.message).toBe('Asset not found');
  });

  it('includes requestId when the server provides one', async () => {
    server.use(
      http.get(`${BASE}/assets/err-with-id`, () =>
        HttpResponse.json(
          { error: { code: 'SERVER_ERROR', message: 'Oops', requestId: 'req-abc' } },
          { status: 500 },
        ),
      ),
    );
    const err = await getAsset('err-with-id').catch((e: unknown) => e);
    expect((err as ApiError).requestId).toBe('req-abc');
  });
});
