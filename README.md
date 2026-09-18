# FTC Open Library

An open-source engineering library for FIRST Tech Challenge teams.

> Find. Learn. Build. Share.

FTC Open Library is a public web application for discovering, previewing, and sharing FTC engineering resources. Resources are organized around four primary types:

- **CAD** — build it
- **CODE** — program it
- **TUTORIAL** — learn it
- **MODEL** — analyze it

The application lives in [`ftc-open-library/`](./ftc-open-library). That directory contains the full project documentation, architecture notes, database setup, security model, and deployment guidance.

## Current capabilities

The project includes public resource discovery, email authentication, contributor drafts, private uploads, moderation, in-browser previews, saved resources, engineering discussion, resource versioning, team pages, contributor profiles, and Site Admin tools.

Guests can browse public content without an account. Original-file downloads and in-browser previews require a verified account, and publishing is moderated.

## Tech stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Supabase (Postgres, Auth, Storage)
- Vercel as the target web deployment platform

## Run locally

Requirements: **Node.js 22+** and npm.

```bash
git clone https://github.com/Ricar0716/ftc-engineering-library.git
cd ftc-engineering-library/ftc-open-library
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The UI can boot without Supabase credentials, but database-backed features require a configured Supabase project and applied migrations.

## Quality checks

Before opening or merging a pull request:

```bash
cd ftc-open-library
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

GitHub Actions runs the same validation on pull requests and on pushes to `main`.

## Documentation

Start with the detailed project README:

- [Application README](./ftc-open-library/README.md)
- [Architecture](./ftc-open-library/ARCHITECTURE.md)
- [Database](./ftc-open-library/DATABASE.md)
- [Security](./ftc-open-library/SECURITY.md)
- [Deployment hardening](./ftc-open-library/docs/deployment-hardening.md)
- [Admin bootstrap](./ftc-open-library/docs/admin-bootstrap.md)

## Contributing

Keep changes focused and open them through a pull request. Preserve the existing authorization, RLS, private-storage, upload-quota, moderation, and preview security boundaries.

See [`ftc-open-library/AGENTS.md`](./ftc-open-library/AGENTS.md) for repository-specific implementation rules.

## Trademark notice

FTC Open Library is a community project and is not affiliated with FIRST. FIRST, FIRST Tech Challenge, and FTC are trademarks of FIRST.
