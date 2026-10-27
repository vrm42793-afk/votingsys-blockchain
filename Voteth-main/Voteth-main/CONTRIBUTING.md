# Contributing to VotEth 2.0

Thank you for contributing to VotEth 2.0. This guide defines the workflow, commit standards, branch naming, and PR expectations that keep this project professional, resumable, and maintainable.

> This project uses **GitHub Flow** and **Conventional Commits**. Both are enforced via git hooks (commitlint + husky). Understanding these standards before contributing is required.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Development Environment](#development-environment)
- [Branching Strategy](#branching-strategy)
- [Commit Message Convention](#commit-message-convention)
- [Pull Request Process](#pull-request-process)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [Security Rules](#security-rules)

---

## Code of Conduct

This is a professional engineering project. All contributors are expected to:
- Communicate clearly and respectfully
- Document decisions, not just outcomes
- Leave the codebase in a better state than they found it

---

## Development Environment

Before contributing, ensure your environment matches the prerequisites defined in [`docs/setup/environment-setup.md`](./docs/setup/environment-setup.md):

- Node.js 20+
- Git
- MetaMask browser extension (for wallet-integration testing)
- Supabase CLI (for local development and migration management)

---

## Branching Strategy

VotEth uses **GitHub Flow**:

1. `main` is always stable and deployable
2. All work happens on a feature/fix branch created from `main`
3. A pull request is opened before merging — even for solo work
4. CI must pass before merge
5. Merge into `main`

### Branch Naming

Branches must follow this pattern:

```
<type>/<short-description-in-kebab-case>
```

**Types:**

| Type | Use When |
|---|---|
| `feat/` | Adding a new feature |
| `fix/` | Fixing a bug |
| `docs/` | Documentation changes only |
| `test/` | Adding or updating tests |
| `refactor/` | Code restructure with no behavior change |
| `chore/` | Maintenance tasks, dependency updates |
| `ci/` | CI/CD workflow changes |
| `perf/` | Performance improvements |

**Examples:**
```
feat/election-creation-form
fix/wallet-network-check
docs/update-architecture-diagram
test/rls-policy-voting-suite
refactor/supabase-query-layer
```

**Never use:**
- `new`, `temp`, `final`, `stuff`, `branch2`, `wip` (without a prefix)

---

## Commit Message Convention

VotEth enforces **Conventional Commits** via commitlint. Every commit must follow:

```
type(scope): short description in imperative mood
```

### Types

| Type | Use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation update |
| `refactor` | Internal restructure, no behavior change |
| `test` | Tests added or updated |
| `chore` | Non-feature maintenance |
| `ci` | CI/CD workflow change |
| `perf` | Performance improvement |
| `style` | Code formatting only (no logic change) |
| `revert` | Reverts a prior commit |

### Scopes

Use the system domain as scope:

| Scope | Domain |
|---|---|
| `auth` | Authentication system |
| `elections` | Election management |
| `candidates` | Candidate management |
| `voting` | Vote casting and receipts |
| `blockchain` | Smart contracts and wallet integration |
| `ai` | AI features (fraud detection, assistant, summarizer) |
| `analytics` | Analytics and reporting |
| `qr` | QR code system |
| `orgs` | Organization management |
| `rls` | Row-level security policies |
| `schema` | Database schema and migrations |
| `config` | Configuration files |
| `ci` | CI/CD pipeline |
| `docs` | Documentation |
| `architecture` | Architectural structure |

### Examples

```bash
feat(elections): add election creation form with date validation
fix(voting): prevent duplicate vote confirmation state rendering
docs(architecture): add trust boundary diagram to system overview
test(contracts): add double-vote revert case to VotEthElection suite
chore(deps): update ethers.js to 6.8.0
ci(frontend): add Lighthouse score check to PR workflow
refactor(auth): extract wallet connection into dedicated hook
perf(analytics): add database index for vote count aggregation
```

### Rules

- Subject line max 72 characters
- Use imperative mood: "add feature" not "added feature" or "adds feature"
- Do not end the subject line with a period
- Breaking changes: append `!` after the type/scope and explain in the commit body

```
feat(schema)!: rename `voter_id` to `user_id` across all tables

BREAKING CHANGE: All RLS policies and queries referencing voter_id must be updated.
Migration 0005 handles this change automatically.
```

---

## Pull Request Process

Pull requests are required for all changes — including solo work. A PR is a **structured review checkpoint**, not a bureaucratic gate.

### Minimum PR Requirements

Every PR must include:

1. **Clear title** — follows the same `type(scope): description` format as commits
2. **Summary** — what changed and why (2–5 sentences)
3. **Tests** — what was tested and how (automated tests + manual verification steps)
4. **Screenshots** — required if any UI was changed
5. **Doc/migration notes** — note any documentation or migration files affected

Use the [PR template](./.github/PULL_REQUEST_TEMPLATE.md) provided.

### PR Checklist (Automated in Template)

- [ ] Branch is up-to-date with `main`
- [ ] All CI checks pass
- [ ] TypeScript strict mode — no new `any` types
- [ ] No secrets committed (no `.env` files, no API keys)
- [ ] RLS policies updated if schema changed
- [ ] Tests added or updated
- [ ] Documentation updated if architecture or API changed
- [ ] Lighthouse score ≥ 90 if frontend-impacting

### Merge Strategy

- **Squash merge** for feature branches to keep `main` history clean
- **Regular merge** for hotfixes requiring preserved commit history
- Delete the source branch after merge

---

## Code Standards

### TypeScript

- **Strict mode enabled** — `"strict": true` in `tsconfig.json`
- No `any` types — use `unknown` and narrow, or define explicit interfaces
- Prefer discriminated unions for state-heavy flows
- Prefer early returns for error clarity
- All public functions: JSDoc with parameter and return type descriptions
- Domain types defined in `src/types/` — shared, not duplicated

### React

- One component = one responsibility
- Separate presentation from data orchestration when complexity grows
- Explicit, minimal props — no implicit context leakage
- All loading and error states must be intentional — no silent failures
- Component pattern: small UI primitives → domain components → route-level pages

### Solidity

- Explicit visibility on every function and state variable
- NatSpec (`/// @notice`, `/// @param`, `/// @return`) on all public/external surfaces
- Custom errors preferred over `require()` string errors
- Events named in `PastTense` consistently
- Access control obvious at a glance — no buried permission logic
- No `block.timestamp` for security-critical decisions

### CSS / Tailwind

- Do not use arbitrary values (`w-[347px]`) except in exceptional, documented cases
- Extend the Tailwind config with project design tokens — do not override them inline
- Design tokens are defined in `tailwind.config.ts`

---

## Testing Requirements

| Area | Tool | Minimum Coverage |
|---|---|---|
| Smart contracts | Hardhat + Chai | ≥ 80% |
| Frontend | Vitest + RTL | ≥ 70% |
| Database RLS | Supabase test suite | 100% of critical policies |
| E2E | Playwright | Key user flows |

Testing documentation → [`docs/testing/`](./docs/testing/)

---

## Security Rules

These are **non-negotiable**. Any PR violating these rules will be rejected:

1. **No secrets in source code** — no API keys, private keys, or service-role keys anywhere in the codebase
2. **No secrets on the client** — AI API keys and Supabase service-role keys go in Supabase Edge Function environment only
3. **RLS on every table** — every new database table must have Row-Level Security enabled and policies defined before the PR is merged
4. **No `.env` files committed** — `.env.local` and `.env.production` are gitignored; only `.env.example` is committed
5. **No `trust` mode in Supabase** — always validate JWTs; never bypass authentication
6. **Input validation at every layer** — frontend (Zod), PostgREST (schema), contract (require/custom error)

Security documentation → [`docs/architecture/system-overview.md#trust-model`](./docs/architecture/system-overview.md)

---

## Questions?

If you are an AI assistant resuming this project: start with [`docs/handbook/volume-i-summary.md`](./docs/handbook/volume-i-summary.md) and the [Development Bible](./docs/handbook/) for full context. No prior conversation is assumed.

If you are a human contributor: open a GitHub Discussion or create an issue using the appropriate template.
