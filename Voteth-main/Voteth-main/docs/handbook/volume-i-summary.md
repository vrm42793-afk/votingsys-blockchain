# VotEth 2.0 — Volume I Summary
## Foundation & Vision Reference

**Document Type:** Handbook Summary
**Volume:** I — Foundation & Vision
**Chapters:** 1–4
**Last Updated:** June 2026

> This document is the condensed, AI-resumable reference for Volume I of the VotEth 2.0 Development Bible. Any engineer — human or AI — can pick this document up in a new session and immediately understand the project identity, requirements, architecture, and technology decisions without relying on conversation history.

---

## Chapter 1 — Project Vision & Product Definition

### What VotEth 2.0 Is

**VotEth 2.0 is** a production-grade, blockchain-anchored digital voting platform built as a full-stack portfolio project demonstrating senior-level engineering across five domains: relational databases, modern frontend, smart contract development, AI integration, and DevOps.

### What VotEth 2.0 Is NOT

- A replacement for national election infrastructure
- A legally certified voting system
- A production SaaS product (yet — see Volume XV)
- A simple CRUD app dressed up with blockchain buzzwords

### The Trilemma VotEth Solves

Digital voting systems face a three-way tension between Transparency, Security, and Accessibility. Every existing solution compromises at least one. VotEth 2.0 resolves this by pairing **Web2-grade UX** (React, Supabase, familiar auth) with **Web3-grade auditability** (blockchain anchoring, cryptographic receipts).

| Solution | Transparency | Security | Accessibility |
|---|---|---|---|
| Paper ballots | ❌ | ✅ | ❌ |
| Proprietary e-voting | ❌ | ⚠️ | ✅ |
| Pure blockchain | ✅ | ✅ | ❌ |
| **VotEth 2.0** | ✅ | ✅ | ✅ |

### Three User Roles

| Role | What They Need |
|---|---|
| 🏛️ **Organization Admins** | Create elections, manage candidates, configure rules, view analytics, export results |
| 🗳️ **Voters** | See eligible elections, cast votes easily, receive cryptographic receipts, verify inclusion |
| 👤 **Candidates** | Campaign portal, profile management, document uploads, visibility into stats |

### Five Core Value Propositions

1. **Tamper-Evident Results** — Every vote anchored to blockchain; anyone can verify independently
2. **Familiar UX, No Crypto Required** — Email/Google sign-in; blockchain happens in the background
3. **AI-Augmented Administration** — Fraud detection, natural-language assistant, candidate summarization
4. **Audit-First Architecture** — Immutable audit log + on-chain events = complete verifiable history
5. **Organization-Scoped, Multi-Tenant Ready** — Built with `org_id` isolation from day one

### Success Criteria

**Technical:**
- [ ] All smart contracts deployed to Polygon Amoy and verified on Polygonscan
- [ ] 80%+ test coverage across smart contracts
- [ ] 70%+ test coverage across frontend
- [ ] All critical RLS policies tested and verified
- [ ] CI/CD pipeline passing on every PR
- [ ] No high/critical findings from Slither or manual audit
- [ ] Lighthouse score ≥ 90 on Performance, Accessibility, Best Practices

**Product:**
- [ ] Admin creates a complete election in under 5 minutes
- [ ] Voter with no blockchain experience casts a vote in under 2 minutes
- [ ] Results verifiable on-chain independently of VotEth UI
- [ ] AI fraud flags surfaced to admins within 60 seconds

**Portfolio:**
- [ ] GitHub repository public with professional README
- [ ] Live demo URL stable and accessible
- [ ] Architecture explainable in a 10-minute technical interview

---

## Chapter 2 — Requirements Engineering

### Priority Tier Definitions

- **P0** — Must have for the platform to function at all
- **P1** — Core product feature; required for portfolio completion
- **P2** — Enhancement; implemented when P0/P1 are solid

### Key Requirement IDs to Know

| ID | Requirement |
|---|---|
| **VOTE-04** | Double-voting prevented at DB level AND contract level (both required) |
| **ELEC-07** | Election configuration locked once OPEN |
| **VOTE-07** | Individual vote choices private during OPEN state |
| **ORG-07** | Zero cross-org data leakage (RLS) |
| **AUTH-05** | SIWE authentication support |
| **AI-01** | Fraud detection and flagging |

### Hard System Constraints

| Constraint | Reason |
|---|---|
| Free tier only | $0/month operational budget |
| Polygon Amoy testnet | Gas cost prohibitive on mainnet |
| No secrets on client | Security non-negotiable |
| RLS on every table | Cannot be bypassed by app bugs |
| Conventional Commits | Professional Git history |
| TypeScript strict | Code quality non-negotiable |
| Single developer | All playbooks designed for solo execution |

### What Is Explicitly Out of Scope

| Item | When |
|---|---|
| zk-SNARKs / anonymous voting | VotEth 2.1 |
| Mobile native app | VotEth 2.3 |
| Mainnet deployment | Post-2.2 |
| SaaS billing / Stripe | VotEth 2.2 |
| Multi-language (i18n) | VotEth 2.1 |
| Ranked-choice voting | VotEth 2.1 |

---

## Chapter 3 — Technology Stack

### Core Stack Summary

| Layer | Technology | Version |
|---|---|---|
| Frontend | React | 18.x |
| Language | TypeScript | 5.x (strict mode) |
| Build | Vite | 5.x |
| Styling | Tailwind CSS | 3.x |
| Backend | Supabase | Latest |
| Database | PostgreSQL | 15+ (via Supabase) |
| Contracts | Solidity | ^0.8.20 |
| Contract toolchain | Hardhat | 2.x |
| Contract libraries | OpenZeppelin | 5.x |
| Wallet | Ethers.js | 6.x |
| Network | Polygon Amoy | Chain ID: 80002 |
| AI | OpenAI-compatible API | GPT-4o-mini |
| Deployment | Vercel | Latest |
| CI/CD | GitHub Actions | Latest |

### Critical Architecture Rules

> ⚠️ **Rule 1: AI API keys never reach the browser.**
> All AI calls are made from Supabase Edge Functions. The frontend only triggers Edge Function endpoints.

> ⚠️ **Rule 2: Supabase service-role key never reaches the frontend.**
> Only the `anon` key goes to the frontend. The service-role key lives in Edge Function environment variables only.

> ⚠️ **Rule 3: Private keys never leave the contracts/ toolchain.**
> Deployment wallet private keys are set in `contracts/.env.local` only and never imported into frontend code.

### Why Next.js Was Rejected

Next.js SSR adds complexity that provides minimal benefit for VotEth:
- Blockchain UX is inherently client-side (wallet connections, transaction signing)
- No SEO-sensitive content that requires server rendering
- Vite/React SPA delivers identical UX with simpler mental model

### Why Firebase Was Rejected

- No SQL — voting data requires relational integrity
- No row-level security primitive
- No self-host path (full Google vendor lock-in)
- Weaker relational data model for this use case

---

## Chapter 4 — System Architecture

### The Three-Layer Architecture

| Layer | Technology | Trust Level |
|---|---|---|
| Presentation | React + TypeScript + Tailwind | Zero trust — treat as hostile |
| Service | Supabase (PostgreSQL, Auth, PostgREST, Realtime, Storage, Edge) | Conditional trust — JWT + RLS |
| Blockchain | Polygon Amoy smart contracts | Mathematical trust — code is law |
| AI | OpenAI-compatible (via Edge Functions only) | Server-side only |

### The Blockchain's Role (One Function)

> The blockchain serves **one primary function**: immutable, tamper-evident anchoring of election results.

It records **vote hashes** (not vote content), enforces **one-vote-per-wallet**, provides an **independently verifiable tally**, and emits **on-chain audit events**.

It does NOT store full vote data, serve as the primary database, handle authentication, or replace Supabase.

### The Vote Casting Sequence (The Critical Path)

1. Voter triggers eligibility check → Supabase RLS validates allowlist
2. Vote recorded off-chain in Supabase (off-chain first = vote is not lost if blockchain fails)
3. Vote hash + vote ID returned to browser
4. Browser sends transaction to Polygon Amoy via MetaMask
5. Transaction hash returned from blockchain
6. Supabase vote record updated with transaction hash
7. Receipt displayed to voter (vote hash + tx hash + timestamp)

### Key Architecture Trade-offs

| Decision | Trade-off | Justification |
|---|---|---|
| Off-chain vote first | Slight consistency window | Vote is not lost if blockchain fails |
| Supabase over custom backend | Vendor dependency | ~200hrs saved; self-host path exists |
| Vite SPA over Next.js | No SSR | Blockchain UX is client-heavy |
| RLS over app-level auth | Learning curve | Cannot be bypassed by application bugs |
| Polygon Amoy | Less prestige than mainnet | Free, fast, EVM-identical |

---

## Volume I Complete

**Volume I establishes:**
- Project identity and problem statement (Chapter 1)
- Complete functional and non-functional requirements with IDs (Chapter 2)
- Justified, budgeted technology stack (Chapter 3)
- Full system architecture with trust boundaries and data flows (Chapter 4)

**Next:** Volume II — Project Setup & Engineering Standards (Chapters 5–8)
- Monorepo structure (Chapter 5)
- Git workflow & Conventional Commits (Chapter 6)
- Coding standards (Chapter 7)
- Development environment setup (Chapter 8)

---

## Key Documents

| Document | Path |
|---|---|
| System Architecture | [`docs/architecture/system-overview.md`](../architecture/system-overview.md) |
| Requirements | [`docs/requirements/requirements.md`](../requirements/requirements.md) |
| Traceability Matrix | [`docs/requirements/traceability.md`](../requirements/traceability.md) |
| ADR-001: Tech Stack | [`docs/adr/ADR-001-technology-stack.md`](../adr/ADR-001-technology-stack.md) |
| Environment Variables | [`.env.example`](../../.env.example) |
| CONTRIBUTING | [`CONTRIBUTING.md`](../../CONTRIBUTING.md) |
