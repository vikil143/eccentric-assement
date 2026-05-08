import type { Asset, AssetKind, AssetListQuery, AssetListResponse } from '@asset-manager/shared';
import { isValidObjectId } from 'mongoose';
import type { QueryFilter } from 'mongoose';
import { AppError } from '../middleware/error.js';
import { AssetModel, type IAsset } from '../models/Asset.js';
import {
  destroy,
  resourceTypeFromMime,
  signedDownloadUrl,
  uploadStream,
  type UploadResult,
} from './cloudinary.js';

export async function listAssets(query: AssetListQuery): Promise<AssetListResponse> {
  const { q, kind, tags, from, to, page = 1, pageSize = 24, sort = 'newest' } = query;

  const filter: Record<string, unknown> = {};

  if (q !== undefined && q.length > 0) {
    if (q.length >= 3) {
      filter['$text'] = { $search: q };
    } else {
      filter['filename'] = { $regex: q, $options: 'i' };
    }
  }

  if (kind !== undefined) {
    filter['kind'] = kind;
  }

  if (tags !== undefined && tags.length > 0) {
    filter['tags'] = { $all: tags };
  }

  if (from !== undefined || to !== undefined) {
    const dateRange: Record<string, Date> = {};
    if (from !== undefined) dateRange['$gte'] = new Date(from);
    if (to !== undefined) dateRange['$lte'] = new Date(to);
    filter['uploadedAt'] = dateRange;
  }

  const sortSpec: Record<string, 1 | -1> =
    sort === 'oldest'
      ? { uploadedAt: 1 }
      : sort === 'size_desc'
        ? { sizeBytes: -1 }
        : { uploadedAt: -1 };

  const skip = (page - 1) * pageSize;

  const [docs, total] = await Promise.all([
    AssetModel.find(filter as QueryFilter<IAsset>).sort(sortSpec).skip(skip).limit(pageSize),
    AssetModel.countDocuments(filter as QueryFilter<IAsset>),
  ]);

  return {
    items: docs.map((doc) => doc.toAsset()),
    total,
    page,
    pageSize,
  };
}

export async function getAsset(id: string): Promise<Asset> {
  if (!isValidObjectId(id)) {
    throw new AppError('NOT_FOUND', 'Asset not found', 404);
  }
  const doc = await AssetModel.findById(id);
  if (doc === null) {
    throw new AppError('NOT_FOUND', 'Asset not found', 404);
  }
  return doc.toAsset();
}

export async function getAssetDownloadUrl(id: string): Promise<string> {
  if (!isValidObjectId(id)) {
    throw new AppError('NOT_FOUND', 'Asset not found', 404);
  }
  const doc = await AssetModel.findById(id);
  if (doc === null) {
    throw new AppError('NOT_FOUND', 'Asset not found', 404);
  }
  return signedDownloadUrl(doc.cloudinaryPublicId, resourceTypeFromMime(doc.mimeType));
}

export async function deleteAsset(id: string): Promise<void> {
  if (!isValidObjectId(id)) {
    throw new AppError('NOT_FOUND', 'Asset not found', 404);
  }
  const doc = await AssetModel.findById(id);
  if (doc === null) {
    throw new AppError('NOT_FOUND', 'Asset not found', 404);
  }
  const { found } = await destroy(doc.cloudinaryPublicId, resourceTypeFromMime(doc.mimeType));
  if (!found) {
    console.warn(`Cloudinary asset not found during delete, proceeding with DB removal: ${doc.cloudinaryPublicId}`);
  }
  await doc.deleteOne();
}

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
