// Sets process.env before any test-file import is evaluated.
// This runs inside the Vitest worker, so module-level code (e.g. multer
// initialisation in routes/assets.ts) picks up these values.
const set = (key: string, value: string) => {
  if (!process.env[key]) process.env[key] = value;
};

set('NODE_ENV', 'test');
set('PORT', '3000');
set('MONGODB_URI', 'mongodb://localhost/test');
set('CLOUDINARY_CLOUD_NAME', 'test');
set('CLOUDINARY_API_KEY', 'test-key');
set('CLOUDINARY_API_SECRET', 'test-secret');
set('CORS_ORIGIN', 'http://localhost:3000');
// Tiny limit so the FILE_TOO_LARGE test only needs a small buffer.
set('MAX_UPLOAD_MB', '0.001');
