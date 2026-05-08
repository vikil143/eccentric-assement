import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// ── Mocks (hoisted before imports) ──────────────────────────────────────────

// env vars are set by vitest.config.ts → real env.ts parses them → no mock needed.
// MAX_UPLOAD_MB=0.001 (≈1 048 bytes) is set there so the FILE_TOO_LARGE test
// only needs a 2 KB buffer.

// Uses the manual mock at src/services/__mocks__/cloudinary.ts
vi.mock('../services/cloudinary.js');

vi.mock('../models/Asset.js', () => ({
  AssetModel: { create: vi.fn() },
  normalizeTags: (tags: string[]) => tags,
}));

// ── Imports (resolved with mocked modules above) ─────────────────────────────

import request from 'supertest';
import { createApp } from '../app.js';
import { AssetModel } from '../models/Asset.js';
import { destroy, uploadStream } from '../services/cloudinary.js';
import type { AssetDocument } from '../models/Asset.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_ASSET = {
  id: 'asset-001',
  filename: 'photo.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 12_345,
  kind: 'image' as const,
  url: 'https://res.cloudinary.com/demo/image/upload/marketing-assets/test/mock-asset',
  tags: [],
  uploadedAt: '2024-01-01T00:00:00.000Z',
  cloudinaryPublicId: 'marketing-assets/test/mock-asset',
};

const JPEG_BUFFER = Buffer.from('fake-jpeg-data');

// Mongoose's `create` is overloaded; casting through `Mock` avoids the overload
// resolution problem while still exercising the real runtime behaviour.
const mockCreate = AssetModel.create as unknown as Mock;

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockCreateResolves(): void {
  mockCreate.mockResolvedValueOnce({ toAsset: () => MOCK_ASSET });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/assets', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('returns 201 with the asset JSON on a valid JPEG upload', async () => {
    mockCreateResolves();

    const res = await request(app)
      .post('/api/assets')
      .attach('file', JPEG_BUFFER, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'asset-001', kind: 'image' });
  });

  it('passes parsed tags to createAsset', async () => {
    mockCreateResolves();

    await request(app)
      .post('/api/assets')
      .attach('file', JPEG_BUFFER, { filename: 'photo.jpg', contentType: 'image/jpeg' })
      .field('tags', 'react, ui, design');

    expect(vi.mocked(uploadStream)).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ tags: ['react', 'ui', 'design'] }),
    );
  });

  it('treats an absent tags field as an empty array', async () => {
    mockCreateResolves();

    await request(app)
      .post('/api/assets')
      .attach('file', JPEG_BUFFER, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(vi.mocked(uploadStream)).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ tags: [] }),
    );
  });

  // ── 415 Unsupported type ──────────────────────────────────────────────────

  it('returns 415 for a disallowed MIME type', async () => {
    const res = await request(app)
      .post('/api/assets')
      .attach('file', Buffer.from('hello'), { filename: 'doc.txt', contentType: 'text/plain' });

    expect(res.status).toBe(415);
    expect(res.body).toMatchObject({ error: { code: 'UNSUPPORTED_TYPE' } });
    expect(vi.mocked(uploadStream)).not.toHaveBeenCalled();
  });

  // ── 413 File too large ────────────────────────────────────────────────────

  it('returns 413 when the file exceeds MAX_UPLOAD_MB', async () => {
    // test-setup.ts sets MAX_UPLOAD_MB=0.001 → Math.floor limit = 1 048 bytes.
    // 2 KB is comfortably over that limit.
    const bigBuffer = Buffer.alloc(2048);

    const res = await request(app)
      .post('/api/assets')
      .attach('file', bigBuffer, { filename: 'big.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(413);
    expect(res.body).toMatchObject({ error: { code: 'FILE_TOO_LARGE' } });
  });

  // ── 422 Validation errors ─────────────────────────────────────────────────

  it('returns 422 when no file field is included', async () => {
    const res = await request(app)
      .post('/api/assets')
      .set('Content-Type', 'multipart/form-data')
      .field('tags', 'test');

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  // ── 502 + Cloudinary rollback ─────────────────────────────────────────────

  it('returns 502 and rolls back Cloudinary when the DB write fails', async () => {
    mockCreate.mockRejectedValueOnce(new Error('mongo timeout'));

    const res = await request(app)
      .post('/api/assets')
      .attach('file', JPEG_BUFFER, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ error: { code: 'UPLOAD_FAILED' } });

    // destroy must be called with the publicId returned by the mock cloudinary
    expect(vi.mocked(destroy)).toHaveBeenCalledWith(
      'marketing-assets/test/mock-asset',
      'image',
    );
  });

  it('returns 502 when Cloudinary itself fails and does not call destroy', async () => {
    vi.mocked(uploadStream).mockRejectedValueOnce(new Error('cloudinary unreachable'));

    const res = await request(app)
      .post('/api/assets')
      .attach('file', JPEG_BUFFER, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ error: { code: 'UPLOAD_FAILED' } });
    expect(vi.mocked(destroy)).not.toHaveBeenCalled();
  });
});
