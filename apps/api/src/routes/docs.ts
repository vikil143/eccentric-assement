import { Router, type Request, type Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const router = Router();

const specPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../openapi.yaml');

router.get('/openapi.yaml', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/yaml; charset=utf-8');
  res.sendFile(specPath);
});

router.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(undefined, { swaggerOptions: { url: '/api/openapi.yaml' } }),
);

export default router;
