import { Router, type NextFunction, type Request, type Response } from 'express';
import multer, { MulterError } from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';
import type { AssetListQuery } from '@asset-manager/shared';
import { createAsset, deleteAsset, getAsset, getAssetDownloadUrl, listAssets, listTags } from '../services/assetService.js';

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

const uploadRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler(req: Request, res: Response) {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Upload limit reached. Try again in 10 minutes.',
        requestId: req.id,
      },
    });
  },
});

function logUpload(req: Request, _res: Response, next: NextFunction): void {
  if (req.file !== undefined) {
    console.log(
      JSON.stringify({
        event: 'upload_received',
        requestId: req.id,
        filename: req.file.originalname,
        sizeBytes: req.file.size,
        mimeType: req.file.mimetype,
      }),
    );
  }
  next();
}

const listQuerySchema = z.object({
  q: z.string().optional(),
  kind: z.enum(['image', 'video', 'pdf', 'other']).optional(),
  tags: z
    .string()
    .optional()
    .transform((s) =>
      s !== undefined
        ? s.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
        : undefined,
    ),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(24),
  sort: z.enum(['newest', 'oldest', 'size_desc']).default('newest'),
});

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

router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message ?? 'Invalid query parameters';
        next(new AppError('VALIDATION_ERROR', msg, 400));
        return;
      }

      const { q, kind, tags, from, to, page, pageSize, sort } = parsed.data;
      const listQuery: AssetListQuery = { page, pageSize, sort };
      if (q !== undefined) listQuery.q = q;
      if (kind !== undefined) listQuery.kind = kind;
      if (tags !== undefined) listQuery.tags = tags;
      if (from !== undefined) listQuery.from = from;
      if (to !== undefined) listQuery.to = to;

      res.json(await listAssets(listQuery));
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/',
  uploadRateLimit,
  parseUpload,
  logUpload,
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

router.get(
  '/tags',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tags = await listTags();
      res.json({ tags });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await getAsset(req.params['id'] ?? ''));
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/:id/download',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const url = await getAssetDownloadUrl(req.params['id'] ?? '');
      res.redirect(302, url);
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await deleteAsset(req.params['id'] ?? '');
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
