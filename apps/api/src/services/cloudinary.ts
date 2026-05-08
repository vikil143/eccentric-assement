import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiErrorResponse, UploadApiResponse } from 'cloudinary';
import { env } from '../config/env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export type CloudinaryResourceType = 'image' | 'video' | 'raw';

export interface UploadOptions {
  mimeType: string;
  tags?: string[];
}

export interface UploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  width: number | undefined;
  height: number | undefined;
  durationSec: number | undefined;
  format: string;
  bytes: number;
}

export function resourceTypeFromMime(mimeType: string): CloudinaryResourceType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'raw'; // PDF and everything else
}

export function uploadStream(buffer: Buffer, options: UploadOptions): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const resourceType = resourceTypeFromMime(options.mimeType);

    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder: `marketing-assets/${env.NODE_ENV}`,
        ...(options.tags !== undefined && { tags: options.tags }),
      },
      (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
        if (error != null) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
          return;
        }
        if (result == null) {
          reject(new Error('Cloudinary upload returned no result'));
          return;
        }
        resolve({
          publicId: result.public_id,
          url: result.url,
          secureUrl: result.secure_url,
          // width/height are 0 for non-image resources; treat 0 as absent
          width: result.width > 0 ? result.width : undefined,
          height: result.height > 0 ? result.height : undefined,
          // duration is not in the static SDK type but Cloudinary includes it for video
          durationSec: (result as unknown as { duration?: number }).duration,
          format: result.format,
          bytes: result.bytes,
        });
      },
    );

    stream.end(buffer);
  });
}

export async function destroy(
  publicId: string,
  resourceType: CloudinaryResourceType,
): Promise<{ found: boolean }> {
  const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  return { found: result.result === 'ok' };
}

export function signedDownloadUrl(
  publicId: string,
  resourceType: CloudinaryResourceType,
): string {
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: 'upload',
    sign_url: true,
    secure: true,
    flags: 'attachment',
    expires_at: Math.floor(Date.now() / 1000) + 5 * 60,
  });
}
