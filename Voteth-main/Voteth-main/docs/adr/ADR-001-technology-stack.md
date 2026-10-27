# ADR-001 — Technology Stack Selection

**Status:** Accepted
**Date:** June 2026
**Authors:** Principal Engineering Team
**Deciders:** Solo developer (Prashanth)
**Volume:** I — Foundation & Vision
**Chapter:** 3 — Technology Stack Decisions

---

## Context

VotEth 2.0 is a production-grade blockchain voting platform built as a portfolio project. Technology selection must satisfy four criteria simultaneously:

1. **Capability** — Can the technology do what VotEth needs?
2. **Free Tier** — Does it operate within a $0/month operational budget?
3. **Portfolio Signal** — Does it demonstrate skills that senior engineering teams value?
4. **Ecosystem Health** — Is it well-maintained with broad community adoption?

The system spans five engineering domains: relational databases, modern frontend, smart contract development, AI integration, and DevOps. Every technology choice is made through the lens of: *"Does this demonstrate real engineering judgment, or does it just look impressive on the surface?"*

---

## Decision Matrix

The following matrix scored all candidate technologies across the four criteria on a 5-star scale. Stars represent expert assessment, not a calculated average.

```
Technology           | Capability | Free Tier | Portfolio | Ecosystem
---------------------|------------|-----------|-----------|----------
React + TypeScript   | ★★★★★    | ★★★★★   | ★★★★★   | ★★★★★
Supabase             | ★★★★☆    | ★★★★★   | ★★★★☆   | ★★★★★
Hardhat + Solidity   | ★★★★★    | ★★★★★   | ★★★★★   | ★★★★★
Polygon Amoy         | ★★★★☆    | ★★★★★   | ★★★★☆   | ★★★★★
Tailwind CSS         | ★★★★★    | ★★★★★   | ★★★★☆   | ★★★★★
Vercel               | ★★★★★    | ★★★★★   | ★★★★★   | ★★★★★
OpenAI-Compatible    | ★★★★★    | ★★★☆☆   | ★★★★★   | ★★★★★
Ethers.js v6         | ★★★★★    | ★★★★★   | ★★★★★   | ★★★★☆
Vite                 | ★★★★★    | ★★★★★   | ★★★★☆   | ★★★★★
```

---

## Decisions

### Frontend: React 18 + TypeScript 5 + Vite 5

**Decision:** Accepted.

**Rationale:**
- React's component model maps cleanly to VotEth's UI domains (election, candidate, voter, admin)
- TypeScript strict mode provides compile-time safety across a complex multi-domain codebase
- Vite provides significantly faster HMR than Create React App and supports native ESM
- CRA is effectively deprecated; Vite is the current industry standard
- Maximum portfolio signal: React + TypeScript is the dominant full-stack frontend combination in 2025–2026

**Alternatives considered:** Next.js (see rejected alternatives below).

---

### Styling: Tailwind CSS v3

**Decision:** Accepted.

**Rationale:**
- Utility-first approach enables rapid iteration without context switching between files
- Eliminates CSS file sprawl in a large component tree
- Design token integration via `tailwind.config.ts` supports a professional design system
- Excellent Vite/PostCSS integration

**Warning:** Tailwind is not a substitute for design thinking. A complete design token system is defined in the Tailwind config (Volume XVII). Arbitrary values (`w-[347px]`) are prohibited except in documented exceptions.

---

### Backend-as-a-Service: Supabase

**Decision:** Accepted.

**Rationale:**
Supabase provides six services in one platform that would each require separate setup and cost if built custom:

| Service | What VotEth Uses It For |
|---|---|
| PostgreSQL | All relational data |
| Auth | All authentication methods including SIWE |
| PostgREST | Auto-generated REST API with RLS enforcement |
| Realtime | Live vote counts, live fraud alerts |
| Storage | Candidate photos, documents, QR codes |
| Edge Functions | Server-side AI calls, secure business logic |

Free tier is sufficient for portfolio/demo workloads. A self-host path exists via `supabase/docker` if vendor dependency becomes a concern.

**Alternatives considered:** Firebase (see rejected alternatives below).

---

### Blockchain: Solidity 0.8.20 + Hardhat + Polygon Amoy

**Decision:** Accepted.

**Solidity:**
- Mature, battle-tested language for EVM smart contracts
- Built-in overflow protection post 0.8.0
- Extensive OpenZeppelin library support

**Hardhat:**
- TypeScript-native (unlike Truffle which has weaker TypeScript support)
- Excellent plugin ecosystem: hardhat-toolbox, gas reporter, coverage, Etherscan verification
- Local Hardhat Network for rapid development iteration

**Polygon Amoy Testnet:**
- EVM-compatible — Solidity works identically to Ethereum mainnet
- Free test MATIC from faucet
- Polygonscan contract verification (same workflow as Etherscan)
- Low gas fees — critical for vote submission UX
- Production upgrade path: Polygon PoS mainnet, no code changes required

**Alternatives considered:** Ethereum mainnet (see rejected alternatives below).

---

### Wallet Integration: Ethers.js v6

**Decision:** Accepted.

**Rationale:**
- Smaller bundle size than Web3.js
- Superior TypeScript support — full type inference on contract interactions
- More modern, ergonomic API design
- Actively maintained; Web3.js is in decline
- v6 has breaking changes from v5 — all code in this project targets v6 exclusively

---

### AI Layer: OpenAI-Compatible API Abstraction

**Decision:** Accepted.

**Rationale:**
- Not locking to a single provider — abstraction layer in `aiClient.ts` supports swap
- Primary: OpenAI GPT-4o-mini (cost-effective, ~$2–5/month dev usage)
- Drop-in free alternatives: Groq (free tier), Ollama (local), Together AI
- All AI calls are made from Supabase Edge Functions — API keys never reach the browser

**Security note:** This is a non-negotiable security constraint. Any PR that makes AI API calls from the frontend will be rejected.

---

### Deployment: Vercel

**Decision:** Accepted.

**Rationale:**
- Zero-config Vite/React deployment
- Automatic preview deployments per PR — critical for portfolio demonstration
- Edge network CDN globally distributed
- Environment variable management per environment (dev/staging/prod)
- Free tier: 100GB bandwidth, unlimited personal projects

---

### Version Control & CI/CD: Git + GitHub + GitHub Actions

**Decision:** Accepted.

**Rationale:**
- GitHub is the industry-standard portfolio platform
- GitHub Actions: free for public repositories, 2000 CI minutes/month
- Conventional Commits enforced via commitlint + husky
- Branch protection on `main` — PRs required even for solo development
- The discipline of PRs and branch protection is itself a portfolio signal

---

## Rejected Alternatives

| Alternative | Why Rejected |
|---|---|
| **Next.js** (over Vite/React SPA) | SSR adds complexity with minimal benefit; blockchain UX is inherently client-side, not SEO-content-driven |
| **Firebase** (over Supabase) | No SQL, no row-level security, no self-host path, tighter Google vendor lock-in, weaker relational data model |
| **Truffle** (over Hardhat) | Declining community adoption, weaker TypeScript support, less active maintenance |
| **Web3.js** (over Ethers.js) | Larger bundle size, older API design, declining maintenance, inferior TypeScript support |
| **Ethereum mainnet** (over Polygon Amoy) | Gas costs prohibitive for portfolio; Polygon Amoy is EVM-identical at zero cost |
| **MongoDB** (as alternative DB) | No relational integrity for voting data, no row-level security primitive |
| **Prisma ORM** (as DB abstraction) | Adds an abstraction layer that obscures SQL; Supabase generates typed clients directly from schema |
| **Redux** (for state management) | Overkill for this state complexity; React Query + Context provides sufficient state management |

---

## Budget Analysis

| Service | Free Tier | Projected Usage | Monthly Cost |
|---|---|---|---|
| Supabase | 500MB DB, 5GB bandwidth | ~50MB DB, <1GB bandwidth | **$0** |
| Vercel | 100GB bandwidth, unlimited projects | <5GB bandwidth | **$0** |
| Alchemy (RPC) | 300M compute units/month | ~10M CU | **$0** |
| GitHub | Unlimited public repos, 2000 CI min | ~500 min | **$0** |
| OpenAI | Pay-as-you-go | ~$2–5/month dev usage | **~$3** |
| Polygon Amoy | Free testnet MATIC | Free from faucet | **$0** |
| **Total** | | | **~$3/month** |

> Budget insight: The entire VotEth 2.0 stack runs for approximately $3/month during active development — and $0/month when using Groq or Ollama for the AI layer.

---

## Consequences

### Positive
- Zero operational cost maintains project sustainability throughout development
- Each technology is the current industry standard — maximizes portfolio signal
- Supabase eliminates ~200 hours of custom backend work
- Polygon Amoy provides an identical production upgrade path with no code changes
- OpenAI-compatible abstraction provides free-tier fallback via Groq

### Negative / Trade-offs
- Supabase vendor dependency — mitigated by self-host path and well-defined interfaces
- No SSR — not required for this use case, but worth documenting
- Polygon Amoy is a testnet — understood and documented; not appropriate for production voting

### Neutralized Risks
- Gas cost risk: Polygon Amoy has negligible gas fees
- Single-provider AI risk: abstraction layer enables hot-swap to Groq/Ollama
- Lock-in risk: all technologies have self-host or migration paths

---

## Review Checklist

- [x] All four selection criteria applied to each technology
- [x] All significant rejected alternatives documented with reasons
- [x] Budget analysis completed
- [x] Security implications noted (AI keys, secrets)
- [x] Consequences (positive and negative) recorded
- [x] ADR reviewed and accepted

---

## References

- [VotEth 2.0 Development Bible, Chapter 3](../handbook/volume-i-summary.md#chapter-3-technology-stack)
- [System Architecture Overview](../architecture/system-overview.md)
- [Requirements Specification](../requirements/requirements.md)
- [Supabase Free Tier Limits](https://supabase.com/pricing)
- [Vercel Free Tier](https://vercel.com/pricing)
- [Polygon Amoy Testnet](https://polygon.technology/blog/introducing-the-amoy-testnet-for-polygon-pos)
