import { describe, it, expect } from 'vitest';
import { normalizeTags, AssetModel } from './Asset.js';

// Minimal valid fields for constructing a document instance.
const BASE = {
  filename: 'photo.jpg',
  mimeType: 'image/jpeg',
  cloudinaryPublicId: 'marketing/photo',
  url: 'https://res.cloudinary.com/demo/image/upload/photo.jpg',
  sizeBytes: 204_800,
  kind: 'image' as const,
  tags: [] as string[],
} satisfies Record<string, unknown>;

// ---------------------------------------------------------------------------
// normalizeTags
// ---------------------------------------------------------------------------

describe('normalizeTags', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeTags(['  hello  ', '\ttab\t'])).toEqual(['hello', 'tab']);
  });

  it('lowercases all characters', () => {
    expect(normalizeTags(['Hello', 'WORLD', 'MiXeD'])).toEqual(['hello', 'world', 'mixed']);
  });

  it('deduplicates after normalising case', () => {
    expect(normalizeTags(['react', 'React', 'REACT'])).toEqual(['react']);
  });

  it('drops empty strings and whitespace-only entries', () => {
    expect(normalizeTags(['', '   ', 'keep'])).toEqual(['keep']);
  });

  it('drops tags longer than 32 characters', () => {
    const long = 'a'.repeat(33);
    const exact = 'b'.repeat(32);
    expect(normalizeTags([long, exact])).toEqual([exact]);
  });

  it('limits output to 20 tags', () => {
    const many = Array.from({ length: 25 }, (_, i) => `tag${i}`);
    const result = normalizeTags(many);
    expect(result).toHaveLength(20);
  });

  it('preserves order of first occurrence when deduping', () => {
    expect(normalizeTags(['b', 'a', 'B'])).toEqual(['b', 'a']);
  });

  it('returns an empty array for an empty input', () => {
    expect(normalizeTags([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AssetDocument.toAsset
// ---------------------------------------------------------------------------

describe('AssetDocument.toAsset', () => {
  it('maps _id to a string id', () => {
    const doc = new AssetModel(BASE);
    const asset = doc.toAsset();
    expect(typeof asset.id).toBe('string');
    expect(asset.id).toBe(doc._id.toString());
  });

  it('converts uploadedAt Date to an ISO 8601 string', () => {
    const now = new Date('2024-06-15T10:30:00.000Z');
    const doc = new AssetModel({ ...BASE, uploadedAt: now });
    expect(doc.toAsset().uploadedAt).toBe('2024-06-15T10:30:00.000Z');
  });

  it('copies all required scalar fields', () => {
    const doc = new AssetModel(BASE);
    const asset = doc.toAsset();
    expect(asset.filename).toBe(BASE.filename);
    expect(asset.mimeType).toBe(BASE.mimeType);
    expect(asset.cloudinaryPublicId).toBe(BASE.cloudinaryPublicId);
    expect(asset.url).toBe(BASE.url);
    expect(asset.sizeBytes).toBe(BASE.sizeBytes);
    expect(asset.kind).toBe(BASE.kind);
  });

  it('returns a shallow copy of tags', () => {
    const doc = new AssetModel({ ...BASE, tags: ['brand', 'hero'] });
    const asset = doc.toAsset();
    expect(asset.tags).toEqual(['brand', 'hero']);
    // Mutations to the returned array must not affect the document.
    asset.tags.push('mutated');
    expect(doc.tags).not.toContain('mutated');
  });

  it('includes optional fields when they are set', () => {
    const doc = new AssetModel({
      ...BASE,
      thumbnailUrl: 'https://res.cloudinary.com/demo/image/upload/thumb.jpg',
      uploadedBy: 'user-42',
      width: 1920,
      height: 1080,
      durationSec: 0,
    });
    const asset = doc.toAsset();
    expect(asset.thumbnailUrl).toBe('https://res.cloudinary.com/demo/image/upload/thumb.jpg');
    expect(asset.uploadedBy).toBe('user-42');
    expect(asset.width).toBe(1920);
    expect(asset.height).toBe(1080);
    expect(asset.durationSec).toBe(0);
  });

  it('omits optional keys entirely when the fields are absent', () => {
    const doc = new AssetModel(BASE);
    const asset = doc.toAsset() as unknown as Record<string, unknown>;
    expect('thumbnailUrl' in asset).toBe(false);
    expect('uploadedBy' in asset).toBe(false);
    expect('width' in asset).toBe(false);
    expect('height' in asset).toBe(false);
    expect('durationSec' in asset).toBe(false);
  });

  it('does not expose __v', () => {
    const doc = new AssetModel(BASE);
    const asset = doc.toAsset() as unknown as Record<string, unknown>;
    expect('__v' in asset).toBe(false);
  });
});
