# Medora 2.0 Frontend

## Target Stack
- **Framework**: **React + TypeScript + Vite**
- **Architecture**: Modular clinical UI components, role-based view routing, accessible form controls.

## Security & Architecture Rules
1. **Trusted Boundary**: The frontend communicates strictly with the **NestJS backend API** for all hospital workflows, appointments, clinical records, prescriptions, and billing.
2. **No Authorization Bypass**: The frontend must never bypass the NestJS API to execute direct modifications against the database.
3. **Key Isolation**: Only public, client-safe variables (`VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are permitted in frontend bundles. The Supabase `SERVICE_ROLE_KEY` or direct database credentials must never exist here.

## Status
- **Phase 0**: Monorepo target directory established; rules documented. Scaffolding deferred to Phase 2.
