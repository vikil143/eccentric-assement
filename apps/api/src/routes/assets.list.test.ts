import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// ── Mocks (hoisted before imports) ──────────────────────────────────────────

vi.mock('../services/cloudinary.js');

vi.mock('../models/Asset.js', () => ({
  AssetModel: {
    create: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
  normalizeTags: (tags: string[]) => tags,
}));

// ── Imports (resolved with mocked modules above) ─────────────────────────────

import request from 'supertest';
import { createApp } from '../app.js';
import { AssetModel } from '../models/Asset.js';
import type { Asset } from '@asset-manager/shared';

// ── Mock handles ─────────────────────────────────────────────────────────────

const mockFind = AssetModel.find as unknown as Mock;
const mockCount = AssetModel.countDocuments as unknown as Mock;

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-001',
    filename: 'photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 12_345,
    kind: 'image',
    url: 'https://res.cloudinary.com/demo/image/upload/photo.jpg',
    tags: ['brand'],
    uploadedAt: '2024-06-15T10:00:00.000Z',
    cloudinaryPublicId: 'marketing/photo',
    ...overrides,
  };
}

function makeDoc(asset: Asset) {
  return { toAsset: () => asset };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/assets', () => {
  const app = createApp();

  // Chain spies reset each test so individual tests can inspect them.
  let limitSpy: Mock;
  let skipSpy: Mock;
  let sortSpy: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    limitSpy = vi.fn().mockResolvedValue([]);
    skipSpy = vi.fn().mockReturnValue({ limit: limitSpy });
    sortSpy = vi.fn().mockReturnValue({ skip: skipSpy });
    mockFind.mockReturnValue({ sort: sortSpy });
    mockCount.mockResolvedValue(0);
  });

  // ── Empty result ────────────────────────────────────────────────────────────

  it('returns an empty list when there are no assets', async () => {
    const res = await request(app).get('/api/assets');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], total: 0, page: 1, pageSize: 24 });
  });

  // ── Defaults applied without query params ──────────────────────────────────

  it('queries with an empty filter and newest sort by default', async () => {
    await request(app).get('/api/assets');

    expect(mockFind).toHaveBeenCalledWith({});
    expect(sortSpy).toHaveBeenCalledWith({ uploadedAt: -1 });
  });

  // ── kind filter ────────────────────────────────────────────────────────────

  it('filters by kind', async () => {
    const doc = makeDoc(makeAsset({ kind: 'video' }));
    limitSpy.mockResolvedValueOnce([doc]);
    mockCount.mockResolvedValueOnce(1);

    const res = await request(app).get('/api/assets?kind=video');

    expect(res.status).toBe(200);
    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ kind: 'video' }));
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ kind: 'video' });
  });

  // ── tags filter ────────────────────────────────────────────────────────────

  it('applies $all for CSV tags', async () => {
    const doc = makeDoc(makeAsset({ tags: ['brand', 'hero'] }));
    limitSpy.mockResolvedValueOnce([doc]);
    mockCount.mockResolvedValueOnce(1);

    const res = await request(app).get('/api/assets?tags=brand,hero');

    expect(res.status).toBe(200);
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({ tags: { $all: ['brand', 'hero'] } }),
    );
    expect(res.body.total).toBe(1);
  });

  it('trims whitespace from CSV tags', async () => {
    await request(app).get('/api/assets?tags=brand%2C%20hero');

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({ tags: { $all: ['brand', 'hero'] } }),
    );
  });

  // ── date range filter ──────────────────────────────────────────────────────

  it('applies from/to as $gte/$lte on uploadedAt', async () => {
    const from = '2024-01-01T00:00:00.000Z';
    const to = '2024-12-31T23:59:59.000Z';

    await request(app).get(
      `/api/assets?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadedAt: { $gte: new Date(from), $lte: new Date(to) },
      }),
    );
  });

  it('applies only $gte when to is absent', async () => {
    const from = '2024-06-01T00:00:00.000Z';

    await request(app).get(`/api/assets?from=${encodeURIComponent(from)}`);

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({ uploadedAt: { $gte: new Date(from) } }),
    );
  });

  // ── pagination math ────────────────────────────────────────────────────────

  it('returns page and pageSize in the response envelope', async () => {
    mockCount.mockResolvedValueOnce(50);

    const res = await request(app).get('/api/assets?page=3&pageSize=10');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 3, pageSize: 10, total: 50 });
  });

  it('skips (page - 1) * pageSize documents', async () => {
    mockCount.mockResolvedValueOnce(50);

    await request(app).get('/api/assets?page=3&pageSize=10');

    expect(skipSpy).toHaveBeenCalledWith(20);
  });

  it('limits query to pageSize', async () => {
    await request(app).get('/api/assets?pageSize=5');

    expect(limitSpy).toHaveBeenCalledWith(5);
  });

  // ── search hit ─────────────────────────────────────────────────────────────

  it('uses $text search for q >= 3 chars and returns matching docs', async () => {
    const doc = makeDoc(makeAsset({ filename: 'summer-photo.jpg' }));
    limitSpy.mockResolvedValueOnce([doc]);
    mockCount.mockResolvedValueOnce(1);

    const res = await request(app).get('/api/assets?q=summer');

    expect(res.status).toBe(200);
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({ $text: { $search: 'summer' } }),
    );
    expect(res.body.items).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  // ── search miss ────────────────────────────────────────────────────────────

  it('returns empty items when $text search finds nothing', async () => {
    // limitSpy and mockCount default to [] / 0 from beforeEach

    const res = await request(app).get('/api/assets?q=xyznonexistent');

    expect(res.status).toBe(200);
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({ $text: { $search: 'xyznonexistent' } }),
    );
    expect(res.body).toEqual({ items: [], total: 0, page: 1, pageSize: 24 });
  });

  // ── short-q regex fallback ─────────────────────────────────────────────────

  it('falls back to filename regex for q < 3 characters', async () => {
    await request(app).get('/api/assets?q=ab');

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({ filename: { $regex: 'ab', $options: 'i' } }),
    );
    expect(mockFind).toHaveBeenCalledWith(
      expect.not.objectContaining({ $text: expect.anything() }),
    );
  });

  it('uses regex fallback for a single-character q', async () => {
    await request(app).get('/api/assets?q=a');

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({ filename: { $regex: 'a', $options: 'i' } }),
    );
  });

  // ── sort variants ──────────────────────────────────────────────────────────

  it('sorts by uploadedAt ascending for sort=oldest', async () => {
    await request(app).get('/api/assets?sort=oldest');

    expect(sortSpy).toHaveBeenCalledWith({ uploadedAt: 1 });
  });

  it('sorts by sizeBytes descending for sort=size_desc', async () => {
    await request(app).get('/api/assets?sort=size_desc');

    expect(sortSpy).toHaveBeenCalledWith({ sizeBytes: -1 });
  });

  // ── validation errors ──────────────────────────────────────────────────────

  it('returns 400 when pageSize exceeds 100', async () => {
    const res = await request(app).get('/api/assets?pageSize=101');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('returns 400 for an invalid kind value', async () => {
    const res = await request(app).get('/api/assets?kind=gif');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('returns 400 for a malformed from date', async () => {
    const res = await request(app).get('/api/assets?from=not-a-date');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  // ── response shape ─────────────────────────────────────────────────────────

  it('returns full AssetListResponse with items mapped through toAsset', async () => {
    const asset = makeAsset({ id: 'asset-xyz' });
    limitSpy.mockResolvedValueOnce([makeDoc(asset)]);
    mockCount.mockResolvedValueOnce(3);

    const res = await request(app).get('/api/assets');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      items: [expect.objectContaining({ id: 'asset-xyz' })],
      total: 3,
      page: 1,
      pageSize: 24,
    });
  });
});
