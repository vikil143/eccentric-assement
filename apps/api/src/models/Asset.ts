import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import type { Asset, AssetKind } from '@asset-manager/shared';

// All optional document fields typed as `T | undefined` (not `?`) so Mongoose and
// exactOptionalPropertyTypes coexist without conflicts.
interface IAsset {
  filename: string;
  mimeType: string;
  cloudinaryPublicId: string;
  url: string;
  sizeBytes: number;
  kind: AssetKind;
  thumbnailUrl: string | undefined;
  tags: string[];
  uploadedAt: Date;
  uploadedBy: string | undefined;
  width: number | undefined;
  height: number | undefined;
  durationSec: number | undefined;
}

interface IAssetMethods {
  toAsset(): Asset;
}

type AssetModelType = Model<IAsset, Record<string, never>, IAssetMethods>;

// Exported so it can be unit-tested independently of the pre-validate hook.
export function normalizeTags(tags: string[]): string[] {
  const seen = tags
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 32);
  return [...new Set(seen)].slice(0, 20);
}

const ASSET_KINDS: [AssetKind, ...AssetKind[]] = ['image', 'video', 'pdf', 'other'];

const assetSchema = new Schema<IAsset, AssetModelType, IAssetMethods>(
  {
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    cloudinaryPublicId: { type: String, required: true },
    url: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 1 },
    kind: { type: String, enum: ASSET_KINDS, required: true },
    thumbnailUrl: { type: String },
    tags: { type: [String], default: [] },
    uploadedAt: { type: Date, required: true, default: () => new Date() },
    uploadedBy: { type: String },
    width: { type: Number },
    height: { type: Number },
    durationSec: { type: Number },
  },
);

assetSchema.index({ uploadedAt: -1 });
assetSchema.index({ filename: 'text', tags: 'text' });
assetSchema.index({ kind: 1, uploadedAt: -1 });

assetSchema.pre('validate', function () {
  this.tags = normalizeTags(this.tags);
});

assetSchema.methods.toAsset = function (
  this: HydratedDocument<IAsset, IAssetMethods>,
): Asset {
  return {
    id: this._id.toString(),
    filename: this.filename,
    mimeType: this.mimeType,
    sizeBytes: this.sizeBytes,
    kind: this.kind,
    url: this.url,
    tags: [...this.tags],
    uploadedAt: this.uploadedAt.toISOString(),
    cloudinaryPublicId: this.cloudinaryPublicId,
    ...(this.thumbnailUrl !== undefined && { thumbnailUrl: this.thumbnailUrl }),
    ...(this.uploadedBy !== undefined && { uploadedBy: this.uploadedBy }),
    ...(this.width !== undefined && { width: this.width }),
    ...(this.height !== undefined && { height: this.height }),
    ...(this.durationSec !== undefined && { durationSec: this.durationSec }),
  };
};

// Guard against model re-registration in test/hot-reload environments.
export const AssetModel =
  (mongoose.models['Asset'] as AssetModelType | undefined) ??
  model<IAsset, AssetModelType>('Asset', assetSchema);

export type AssetDocument = HydratedDocument<IAsset, IAssetMethods>;
