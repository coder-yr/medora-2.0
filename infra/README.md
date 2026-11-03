# Medora 2.0 Infrastructure & Container Deployment

This directory houses infrastructure orchestration, deployment configurations, and runtime specifications for Medora 2.0.

## Overview

Medora 2.0 is built on modern TypeScript services and does not require PHP or Apache/Nginx-FPM:
- **Frontend:** React 19 + TypeScript + Vite (served via Nginx container)
- **Backend:** NestJS 11 + Prisma ORM 7 (running on Node.js 22 LTS Alpine)
- **Database:** PostgreSQL 16+ (Supabase or self-hosted container)

## Files in this Directory

- `backend.Dockerfile`: Multi-stage Alpine container for NestJS backend with Prisma generation.
- `frontend.Dockerfile`: Multi-stage build for React 19 frontend served via Nginx.
- `nginx.conf`: Nginx configuration supporting Single Page Application (SPA) client-side routing.
- `docker-compose.yml`: Local and staging full-stack compose definition with PostgreSQL, NestJS, and React.

## Running Medora 2.0 with Docker Compose

To build and run the full stack locally:

```bash
docker compose -f infra/docker-compose.yml up --build
```

Access points:
- Frontend Web App: `http://localhost`
- Backend REST API: `http://localhost:3000/api/v1`
- Swagger Documentation (Non-production): `http://localhost:3000/api/docs`
- PostgreSQL Database: `localhost:5432`
