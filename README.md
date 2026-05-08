# Asset Manager

Internal asset management platform for the marketing team.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Clone the Repository](#clone-the-repository)
- [Project Structure](#project-structure)
- [Step 1 — Start MongoDB](#step-1--start-mongodb)
- [Step 2 — Set Up Environment Variables](#step-2--set-up-environment-variables)
- [Step 3 — Install Dependencies](#step-3--install-dependencies)
- [Step 4 — Run the Application](#step-4--run-the-application)
- [Running Frontend and Backend Separately](#running-frontend-and-backend-separately)
- [Available Scripts](#available-scripts)
- [Cloudinary Setup](#cloudinary-setup)
- [Seed the Database](#seed-the-database)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Make sure the following are installed before getting started:

| Tool | Version | Install |
|---|---|---|
| Node.js | **≥ 20** | https://nodejs.org/ |
| npm | ≥ 10 (bundled with Node 20) | comes with Node |
| Docker Desktop | any recent | https://www.docker.com/products/docker-desktop/ |
| Git | any | https://git-scm.com/ |

> **Tip:** A `.nvmrc` file is included. If you use [nvm](https://github.com/nvm-sh/nvm), run `nvm use` in the project root to switch to the correct Node version automatically.

Verify your versions:

```bash
node -v   # should print v20.x.x or higher
npm -v    # should print 10.x.x or higher
docker -v
```

---

## Clone the Repository

```bash
git clone <your-repository-url>
cd asset-manager
```

---

## Project Structure

```
asset-manager/
├── apps/
│   ├── api/          # Express + TypeScript backend  →  port 3000
│   └── web/          # React + Vite frontend         →  port 5173
├── packages/
│   └── shared/       # Shared TypeScript types (used by both apps)
├── docker-compose.yml
└── package.json      # npm workspaces root
```

This is an **npm workspaces monorepo**. All `npm` commands must be run from the **project root** unless stated otherwise.

---

## Step 1 — Start MongoDB

The app uses MongoDB as its database. The easiest way to run it locally is with the included Docker Compose file.

Make sure Docker Desktop is open and running, then:

```bash
docker compose up -d mongo
```

This starts MongoDB 7 on `localhost:27017`. Data is persisted in a named volume (`mongo_data`) so it survives restarts.

**Other useful Docker commands:**

```bash
# Check if the container is running
docker compose ps

# Stop the container (data is kept)
docker compose down

# Stop and delete all data
docker compose down -v
```

> If you already have MongoDB running locally on port 27017, you can skip Docker and point `MONGODB_URI` in your `.env` to your existing instance.

---

## Step 2 — Set Up Environment Variables

The backend requires a `.env` file. Copy the example and fill in your values:

```bash
cp apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and update the values:

```env
# Server
PORT=3000
NODE_ENV=development

# Database — matches the Docker Compose setup above
MONGODB_URI=mongodb://localhost:27017/asset-manager

# Cloudinary — required for image/video uploads (see Cloudinary Setup section)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# CORS — must match the URL where the frontend runs
CORS_ORIGIN=http://localhost:5173

# Upload limit in megabytes
MAX_UPLOAD_MB=10
```

### What each variable does

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default: `3000`) | Port the API server listens on |
| `NODE_ENV` | No (default: `development`) | Runtime environment |
| `MONGODB_URI` | **Yes** | MongoDB connection string |
| `CLOUDINARY_CLOUD_NAME` | **Yes** | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | **Yes** | Your Cloudinary API key |
| `CLOUDINARY_API_SECRET` | **Yes** | Your Cloudinary API secret |
| `CORS_ORIGIN` | No (default: `http://localhost:5173`) | Allowed frontend origin |
| `MAX_UPLOAD_MB` | No (default: `10`) | Max file upload size |

### Frontend environment variables

The **frontend has no `.env` file** needed for local development. Vite automatically proxies all `/api/*` requests to the backend at `http://localhost:3000`, so no API URL configuration is required.

> **Never commit your `.env` file.** It is already in `.gitignore`. Only `.env.example` (with placeholder values) should be committed.

---

## Step 3 — Install Dependencies

From the project root, run:

```bash
npm install
```

This installs dependencies for all three workspaces (`apps/api`, `apps/web`, `packages/shared`) in one command.

---

## Step 4 — Run the Application

Make sure MongoDB is running (Step 1) and `.env` is configured (Step 2), then:

```bash
npm run dev
```

This starts both apps in parallel using `concurrently`. You will see labeled output in your terminal:

```
[api] MongoDB connected [host=localhost db=asset-manager]
[api] API listening on port 3000 [development]
[web]   VITE v5.4.21  ready in 308 ms
[web]   ➜  Local:   http://localhost:5173/
```

| Service | URL |
|---|---|
| **Frontend** (React + Vite) | http://localhost:5173 |
| **Backend** (Express API) | http://localhost:3000 |
| **API Docs** (Swagger UI) | http://localhost:3000/api-docs |

Open http://localhost:5173 in your browser to use the application.

---

## Running Frontend and Backend Separately

Start the **backend only:**

```bash
npm run dev -w apps/api
```

Start the **frontend only:**

```bash
npm run dev -w apps/web
```

> The frontend proxies `/api` calls to `localhost:3000`, so the backend must be running for API calls to work.

---

## Available Scripts

Run from the project root:

| Command | Description |
|---|---|
| `npm run dev` | Start both frontend and backend in dev/watch mode |
| `npm run build` | Compile TypeScript and build all workspaces |
| `npm run typecheck` | Type-check all workspaces without emitting files |
| `npm run lint` | Run ESLint across all workspaces |
| `npm run format` | Run Prettier across all workspaces |
| `npm run test` | Run Vitest unit tests |
| `npm run test:watch` | Run Vitest in watch mode |

---

## Cloudinary Setup

Cloudinary is used to store uploaded images and videos. You need a free account.

1. Sign up at https://cloudinary.com/
2. Open your **Cloudinary Dashboard**
3. Copy **Cloud Name**, **API Key**, and **API Secret**
4. Paste them into `apps/api/.env`:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

> The frontend never talks to Cloudinary directly — all uploads go through the API.

---

## Seed the Database

Populate the database with sample data for local development:

```bash
npm run seed -w apps/api
```

> MongoDB must be running and `MONGODB_URI` must be set in `apps/api/.env` before seeding.

---

## Troubleshooting

### Port already in use

If you see `Error: listen EADDRINUSE: address already in use :::3000` or Vite skipping to a different port, a previous instance is still running. Kill the processes and restart:

```bash
# Kill whatever is on port 3000 (API)
npx kill-port 3000

# Kill whatever is on port 5173 (frontend)
npx kill-port 5173

# Then start again
npm run dev
```

Or find and kill manually:

```bash
lsof -ti:3000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### MongoDB connection refused

Make sure the Docker container is actually running:

```bash
docker compose ps
```

If it shows the container is stopped or not present:

```bash
docker compose up -d mongo
```

### API starts but uploads fail

Cloudinary credentials are missing or wrong. Check that `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are all set correctly in `apps/api/.env`.

### TypeScript errors after pulling new changes

Run a full install and type-check:

```bash
npm install
npm run typecheck
```

### Wrong Node version

Check your Node version:

```bash
node -v
```

It must be **≥ 20**. If you use nvm:

```bash
nvm use
```
