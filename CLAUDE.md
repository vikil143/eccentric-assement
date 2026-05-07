# Asset Manager — Claude Context

Internal asset management platform for the marketing team.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB via Mongoose |
| Media storage | Cloudinary (images and video) |
| Shared types | `packages/shared` (consumed by both apps) |

## Repository layout

```
asset-manager/
├── apps/
│   ├── web/          # React + Vite frontend
│   └── api/          # Express backend
├── packages/
│   └── shared/       # Shared TypeScript types and utilities
├── package.json      # npm workspaces root
└── CLAUDE.md
```

npm workspaces are defined at the root. Each workspace has its own `package.json`, `tsconfig.json`, and scripts.

## Build and dev commands

Run these from the repo root unless noted.

```bash
# Install all workspace dependencies
npm install

# Start all workspaces in dev mode (concurrently)
npm run dev

# Build all workspaces
npm run build

# Typecheck all workspaces
npm run typecheck

# Lint all workspaces
npm run lint

# Format all workspaces
npm run format

# Run unit tests (Vitest)
npm run test

# Run tests in watch mode
npm run test:watch
```

Per-workspace commands (run from the workspace directory or with `-w`):

```bash
npm run dev -w apps/web
npm run dev -w apps/api
npm run typecheck -w packages/shared
```

## Conventions

### Modules
- All TypeScript is compiled as **ESM** (`"type": "module"` in every `package.json`).
- Use `.js` extensions in import paths even for `.ts` source files (TypeScript ESM requirement).

### Code style
- **ESLint + Prettier** enforced via pre-commit hooks.
- Run `npm run lint` and `npm run format` before opening a PR.

### Commits
- Follow **Conventional Commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, etc.
- Scope is optional but encouraged: `feat(web): add bulk upload UI`.

### Testing
- Unit tests use **Vitest**.
- Test files live next to the source file they test (`*.test.ts` / `*.spec.ts`).
- Integration and e2e tests are out of scope until explicitly added.

### Types
- Shared domain types belong in `packages/shared/src/`.
- Never duplicate type definitions across `apps/web` and `apps/api`; import from `@asset-manager/shared` instead.

### Cloudinary
- All media upload logic belongs in `apps/api`; the frontend never calls Cloudinary directly.
- Store only Cloudinary `public_id` and `secure_url` in MongoDB — do not store raw binary data.

### Environment variables
- Each app has its own `.env.example` documenting required variables.
- Actual `.env` files are git-ignored.

---

## Rules for Claude

1. **Always run `npm run typecheck` before declaring a step done.** A step is not complete until TypeScript reports zero errors across all workspaces.

2. **Never commit secrets.** Do not place API keys, credentials, connection strings, or tokens in any committed file. Use environment variables and `.env.example` placeholders only.

3. **Prefer small, focused changes.** Each change should do one thing. Avoid combining unrelated refactors with feature work. If a task seems to require touching many unrelated files, stop and confirm scope with the user first.

4. **Ask before adding new dependencies.** Any new `npm install` must be confirmed by the user before running. Briefly state what the package does, why it is needed, and whether a lighter alternative exists.

5. **Never log request bodies that may contain file data.** Middleware or debug logging must not emit `req.body` or `req.file` contents on routes that handle uploads. Log metadata (filename, size, mimetype, user ID) instead.
