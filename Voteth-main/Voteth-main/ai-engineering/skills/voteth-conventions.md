# VotEth 2.0 — Project Conventions for AI Assistants

## Identity

VotEth 2.0 is a production-grade, blockchain-anchored digital voting platform. It is a portfolio project — not a toy, not a SaaS product (yet). Every engineering decision should reflect professional judgment.

## Architecture Rules

1. Three-layer architecture: Presentation → Service (Supabase) → Blockchain (Polygon Amoy)
2. The browser is a **zero-trust** environment. Never trust client-side validation alone.
3. AI API keys, Supabase service-role key, and deployment private keys **never** reach the browser.
4. All AI calls go through Supabase Edge Functions.
5. Off-chain (Supabase) vote record is committed **before** on-chain transaction.
6. RLS on every table, no exceptions.

## Code Standards

- TypeScript strict mode — no `any`
- React components: one responsibility, explicit props, intentional loading/error states
- Solidity: explicit visibility, NatSpec on all public/external, custom errors preferred
- Tailwind: use design tokens from `tailwind.config.ts`, no arbitrary values
- All public functions: JSDoc documented

## Commit Format

```
type(scope): imperative description (max 72 chars)
```

Types: feat, fix, docs, refactor, test, chore, ci, perf
Scopes: auth, elections, candidates, voting, blockchain, ai, analytics, qr, orgs, rls, schema, config, ci, docs, architecture

## File Naming

- React components: `PascalCase.tsx`
- Hooks: `useSomething.ts`
- Utils/services: `camelCase.ts`
- Solidity: `PascalCase.sol`
- Docs: `kebab-case.md`

## Key References

- Architecture: `docs/architecture/system-overview.md`
- Requirements: `docs/requirements/requirements.md`
- Traceability: `docs/requirements/traceability.md`
- Tech stack decisions: `docs/adr/ADR-001-technology-stack.md`
- Volume I summary: `docs/handbook/volume-i-summary.md`
- Environment variables: `.env.example`
