import { Router, type NextFunction, type Request, type Response } from 'express';
import multer, { MulterError } from 'multer';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';
import { createAsset } from '../services/assetService.js';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

// Initialised once at module load — picks up MAX_UPLOAD_MB from validated env.
const multerUpload = multer({
  storage: multer.memoryStorage(),
  // Math.floor is required: busboy uses === to compare accumulated bytes to the
  // limit, so a float limit (e.g. 1048.576) means the 'limit' event never fires.
  limits: { fileSize: Math.floor(env.MAX_UPLOAD_MB * 1024 * 1024) },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('UNSUPPORTED_TYPE', `Unsupported file type: ${file.mimetype}`, 415));
    }
  },
}).single('file');

// Wraps multer so its errors are converted to AppErrors before reaching the
// central handler.  multer calls the third argument as its own `next`, so any
// error it would normally pass to Express arrives here first.
function parseUpload(req: Request, res: Response, next: NextFunction): void {
  multerUpload(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(new AppError('FILE_TOO_LARGE', `File exceeds the ${env.MAX_UPLOAD_MB} MB limit`, 413));
      } else {
        next(new AppError('UPLOAD_FAILED', err.message, 400));
      }
    } else if (err instanceof Error) {
      // AppError from fileFilter, or any other Error subclass
      next(err);
    } else {
      next();
    }
  });
}

const bodySchema = z.object({
  // Optional comma-separated string → trimmed, non-empty string array
  tags: z
    .string()
    .optional()
    .transform((s) =>
      s ? s.split(',').map((t) => t.trim()).filter((t) => t.length > 0) : [],
    ),
});

const router = Router();

router.post(
  '/',
  parseUpload,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.file === undefined) {
        next(new AppError('VALIDATION_ERROR', 'No file provided', 422));
        return;
      }

      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message ?? 'Invalid request body';
        next(new AppError('VALIDATION_ERROR', msg, 422));
        return;
      }

      const asset = await createAsset(req.file, parsed.data.tags);
      res.status(201).json(asset);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
