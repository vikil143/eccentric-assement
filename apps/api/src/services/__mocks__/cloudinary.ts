/**
 * Manual Vitest mock for the cloudinary service.
 *
 * Usage in a test file:
 *   vi.mock('../../services/cloudinary.js');   // path relative to the test
 *
 * Override per-test:
 *   vi.mocked(uploadStream).mockResolvedValueOnce({ ...customResult });
 *   vi.mocked(destroy).mockRejectedValueOnce(new Error('not found'));
 */
import { vi } from 'vitest';
import type { CloudinaryResourceType, UploadOptions, UploadResult } from '../cloudinary.js';

const DEFAULT_RESULT: UploadResult = {
  publicId: 'marketing-assets/test/mock-asset',
  url: 'http://res.cloudinary.com/demo/image/upload/marketing-assets/test/mock-asset',
  secureUrl: 'https://res.cloudinary.com/demo/image/upload/marketing-assets/test/mock-asset',
  width: 800,
  height: 600,
  durationSec: undefined,
  format: 'jpg',
  bytes: 12_345,
};

export const uploadStream = vi.fn(
  async (_buffer: Buffer, _options: UploadOptions): Promise<UploadResult> =>
    structuredClone(DEFAULT_RESULT),
);

export const destroy = vi.fn(
  async (_publicId: string, _resourceType: CloudinaryResourceType): Promise<void> => {},
);

export const signedDownloadUrl = vi.fn(
  (_publicId: string, _resourceType: CloudinaryResourceType): string =>
    `https://res.cloudinary.com/demo/image/upload/s--mock-sig--/fl_attachment/${_publicId}`,
);

export const resourceTypeFromMime = vi.fn(
  (mimeType: string): CloudinaryResourceType => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'raw';
  },
);
