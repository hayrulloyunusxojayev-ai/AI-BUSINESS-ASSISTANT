# Zentra AI

## Overview

Multi-tenant SaaS platform where business owners manage products and get an AI-powered chat link for customers. Each user's data (business profile, products, chats) is fully isolated.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Database-backed email/password accounts with HttpOnly session cookies
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Architecture

- **Frontend artifact**: `artifacts/ai-business-agent` — React + Vite app at `/`
- **Backend**: `artifacts/api-server` — Express API at `/api`
- **Database schema**: `lib/db/src/schema/` — users, sessions, businesses, products, chatMessages tables
- **OpenAI integration**: `lib/integrations-openai-ai-server/` — OpenAI client and utilities

## Key Features

- Database-backed sign-up, sign-in, sign-out, and revocable sessions
- Business creation with unique share link ID
- Product CRUD with owner and business isolation
- Public AI chat page at `/chat/{shareLinkId}` (no login required)
- SSE streaming for AI responses
- Dashboard with product count, chat stats, recent activity

## Database Tables

- `users` — id, email, name, auth_provider, password_hash
- `sessions` — id, user_id, expires_at, created_at
- `businesses` — id, user_id (unique), business_name, share_link_id (unique)
- `products` — id, user_id, business_id (FK), name, price, description, image
- `chat_messages` — id, business_id (FK), session_id, role, content

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Data Isolation

Every admin database query filters by `user_id`; product queries also validate the user's business ownership. Public chat routes resolve `share_link_id` to one business, then load only products for that business and owner.
