import type { Asset, AssetKind } from '@asset-manager/shared';
import { AppError } from '../middleware/error.js';
import { AssetModel } from '../models/Asset.js';
import {
  destroy,
  resourceTypeFromMime,
  uploadStream,
  type UploadResult,
} from './cloudinary.js';

function kindFromMime(mimeType: string): AssetKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'other';
}

export async function createAsset(
  file: Express.Multer.File,
  tags: string[],
): Promise<Asset> {
  const resourceType = resourceTypeFromMime(file.mimetype);

  // Step 1 — upload to Cloudinary
  let uploaded: UploadResult;
  try {
    uploaded = await uploadStream(file.buffer, { mimeType: file.mimetype, tags });
  } catch (err) {
    throw new AppError(
      'UPLOAD_FAILED',
      err instanceof Error ? err.message : 'Cloudinary upload failed',
      502,
    );
  }

  // Step 2 — persist to MongoDB; roll back the Cloudinary asset if this fails
  try {
    const doc = await AssetModel.create({
      filename: file.originalname,
      mimeType: file.mimetype,
      cloudinaryPublicId: uploaded.publicId,
      url: uploaded.secureUrl,
      sizeBytes: uploaded.bytes,
      kind: kindFromMime(file.mimetype),
      tags,
      ...(uploaded.width !== undefined && { width: uploaded.width }),
      ...(uploaded.height !== undefined && { height: uploaded.height }),
      ...(uploaded.durationSec !== undefined && { durationSec: uploaded.durationSec }),
    });
    return doc.toAsset();
  } catch {
    // Best-effort rollback — don't let it mask the original failure
    await destroy(uploaded.publicId, resourceType).catch(() => {});
    throw new AppError('UPLOAD_FAILED', 'Failed to save asset metadata', 502);
  }
}
