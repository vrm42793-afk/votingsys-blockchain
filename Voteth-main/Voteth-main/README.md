# VotEth 2.0 — Blockchain Voting Platform

<div align="center">

![VotEth Banner](https://img.shields.io/badge/VotEth-2.0-6C47FF?style=for-the-badge&logo=ethereum&logoColor=white)

**A production-grade, blockchain-anchored digital voting platform**

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?style=flat-square&logo=solidity&logoColor=white)](https://soliditylang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Polygon](https://img.shields.io/badge/Polygon-Amoy-8247E5?style=flat-square&logo=polygon&logoColor=white)](https://polygon.technology)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

[Live Demo](#) · [Documentation](./docs/) · [Architecture](./docs/architecture/system-overview.md) · [Development Bible](./docs/handbook/volume-i-summary.md)

</div>

---

## What Is VotEth 2.0?

VotEth 2.0 resolves the **digital voting trilemma** — the tension between Transparency, Security, and Accessibility that every existing solution fails to fully satisfy:

| Solution | Transparency | Security | Accessibility |
|---|---|---|---|
| Paper ballots | ❌ Hard to audit at scale | ✅ | ❌ Slow, manual |
| Proprietary e-voting | ❌ Black box | ⚠️ Unknown | ✅ |
| Pure blockchain | ✅ | ✅ | ❌ Too technical |
| **VotEth 2.0** | ✅ On-chain anchoring | ✅ Multi-layer | ✅ Web2 UX |

It pairs a **Web2-grade user experience** (React, Supabase, familiar auth) with **Web3-grade auditability** (immutable on-chain vote records, cryptographic proofs).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│              React + TypeScript + Tailwind                   │
│         (User's browser — ZERO trust environment)           │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS / WebSocket
┌─────────────────────────▼───────────────────────────────────┐
│                     SERVICE LAYER                            │
│                  Supabase Platform                           │
│   PostgreSQL │ Auth │ PostgREST │ Realtime │ Storage │ Edge  │
│         (Managed trust — RLS is the enforcement layer)       │
└──────────┬──────────────────────────────────────┬───────────┘
           │ JSON-RPC                              │ HTTPS (Edge Fn)
┌──────────▼──────────┐                ┌──────────▼───────────┐
│   BLOCKCHAIN LAYER  │                │      AI LAYER        │
│   Polygon Amoy      │                │  OpenAI-Compatible   │
│   Smart Contracts   │                │  API (via Edge Fn)   │
│  (Zero trust —      │                │  (Server-side only)  │
│  math is the law)   │                └──────────────────────┘
└─────────────────────┘
```

Full architecture documentation → [`docs/architecture/system-overview.md`](./docs/architecture/system-overview.md)

---

## Key Features

### 🗳️ Core Voting Engine
- Election creation and lifecycle management (DRAFT → OPEN → CLOSED → PUBLISHED)
- Single-choice and multi-choice ballot types
- One-person-one-vote enforcement at both database (RLS) and smart contract level
- Cryptographic vote receipts with blockchain transaction anchoring
- Voter allowlist management

### ⛓️ Blockchain Layer
- **VotEthElection** — per-election vote recording and enforcement
- **VotEthRegistry** — organization and election registration
- **VotEthVerifier** — QR code verification, ZK-ready architecture
- Deployed on Polygon Amoy testnet (EVM-compatible, gas-efficient)

### 🤖 AI Features
- Fraud detection and behavioral anomaly flagging
- Natural-language election assistant for admins
- AI-generated candidate profile summaries
- All AI calls made server-side via Supabase Edge Functions (API keys never reach the browser)

### 🔐 Authentication
- Email/password, Magic Link, Google OAuth, GitHub OAuth
- Sign-In With Ethereum (SIWE) for web3-native users
- Role-based access control (Super Admin, Org Admin, Moderator, Voter, Candidate)

### 📊 Analytics & Auditability
- Real-time vote count updates via Supabase Realtime
- On-chain vs. off-chain result verification view
- Immutable audit log for every system action
- CSV export

---

## Repository Structure

```
voteth-2.0/
├── frontend/          # React + TypeScript + Vite + Tailwind application
├── contracts/         # Solidity smart contracts + Hardhat toolchain
├── docs/              # Architecture, requirements, ADRs, runbooks
├── ai-engineering/    # Prompts, skills, context, evals for AI-assisted workflow
├── .github/           # CI/CD workflows, PR templates, issue templates
├── .env.example       # Environment variable reference (no secrets)
├── package.json       # Root workspace config
└── README.md          # This file
```

Full structure documentation → [`docs/architecture/system-overview.md`](./docs/architecture/system-overview.md)

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | React 18 + TypeScript 5 | Industry standard, rich ecosystem, strict typing |
| **Build Tool** | Vite 5 | Fast HMR, native ESM, modern tooling |
| **Styling** | Tailwind CSS v3 | Utility-first, design token integration |
| **Backend** | Supabase | PostgreSQL + Auth + Realtime + Storage + Edge Functions |
| **Database** | PostgreSQL (via Supabase) | Relational integrity, RLS enforcement |
| **Blockchain** | Solidity 0.8.20 + Hardhat | Mature, OpenZeppelin support, TypeScript-native tooling |
| **Network** | Polygon Amoy Testnet | EVM-identical to mainnet, free test MATIC, low gas |
| **Wallet** | Ethers.js v6 + MetaMask | Best TypeScript support, smaller bundle than Web3.js |
| **AI** | OpenAI-Compatible APIs | Abstraction layer supports GPT-4o, Groq, Ollama |
| **Deployment** | Vercel | Zero-config React deployment, preview per PR |
| **CI/CD** | GitHub Actions | Free for public repos, integrates with Vercel |

---

## Getting Started

### Prerequisites

- Node.js 20+
- Git
- MetaMask browser extension
- A Supabase account (free tier)
- A Vercel account (free tier)
- A GitHub account

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/VotEth/voteth-2.0.git
cd voteth-2.0

# 2. Copy environment variable template
cp .env.example .env.local

# 3. Install root workspace dependencies
npm install

# 4. Install frontend dependencies
cd frontend && npm install

# 5. Install contract dependencies
cd ../contracts && npm install

# 6. Start the frontend dev server
cd ../frontend && npm run dev
```

Full setup guide → [`docs/setup/environment-setup.md`](./docs/setup/environment-setup.md)

---

## Development Workflow

This project uses **GitHub Flow** and **Conventional Commits**.

```bash
# Create a feature branch
git checkout -b feat/election-management

# Commit with conventional format
git commit -m "feat(elections): add election creation form with validation"

# Push and open a pull request
git push origin feat/election-management
```

Branch naming: `feat/`, `fix/`, `docs/`, `test/`, `refactor/`, `chore/`

Contribution guide → [`CONTRIBUTING.md`](./CONTRIBUTING.md)

---

## Security Model

VotEth 2.0 operates a **three-tier trust model**:

| Trust Level | Layer | Enforcement |
|---|---|---|
| **Zero Trust** | Browser/Client | All validation server-side. Treat as hostile. |
| **Conditional Trust** | Supabase / PostgREST | JWT authentication + Row-Level Security policies |
| **Mathematical Trust** | Smart Contracts | Code is law. Math enforces. No admin keys. |
| **Server-Side Only** | Edge Functions | Secrets and AI API keys live here exclusively. |

> ⚠️ **Security rule:** AI API keys, Supabase service-role keys, and private keys for contract deployment **never** reach the browser. All sensitive operations go through Supabase Edge Functions.

---

## Smart Contracts

| Contract | Purpose | Status |
|---|---|---|
| `VotEthRegistry` | Organization and election registration | 🔲 Planned |
| `VotEthElection` | Per-election vote recording and enforcement | 🔲 Planned |
| `VotEthVerifier` | QR code verification, ZK-ready architecture | 🔲 Planned |

Deployment target: **Polygon Amoy Testnet**
Contract documentation → [`docs/contracts/`](./docs/contracts/)

---

## Documentation

| Document | Description |
|---|---|
| [System Architecture](./docs/architecture/system-overview.md) | Three-layer architecture, trust boundaries, data flows |
| [Requirements](./docs/requirements/requirements.md) | Functional and non-functional requirements with IDs |
| [Traceability Matrix](./docs/requirements/traceability.md) | Requirement-to-component mapping |
| [ADR-001: Technology Stack](./docs/adr/ADR-001-technology-stack.md) | Technology decisions and rejected alternatives |
| [Volume I Summary](./docs/handbook/volume-i-summary.md) | Foundation and vision reference |

---

## Project Status

**Current Phase:** Volume I — Foundation Complete | Volume II — Environment Setup

| Volume | Chapters | Topic | Status |
|---|---|---|---|
| I | 1–4 | Foundation & Vision | ✅ Complete |
| II | 5–8 | Project Setup & Engineering Standards | 🔄 In Progress |
| III | 9–12 | Database & Backend Architecture | 🔲 Planned |
| IV | 13–17 | Frontend Architecture | 🔲 Planned |
| V | 18–22 | Authentication | 🔲 Planned |
| VI | 23–27 | Core Voting Engine | 🔲 Planned |
| VII | 28–31 | AI Features | 🔲 Planned |
| VIII | 32–35 | Smart Contracts | 🔲 Planned |

---

## Portfolio Context

VotEth 2.0 demonstrates **nine engineering domains simultaneously** in a single production-grade system:

| Domain | Demonstration |
|---|---|
| Full-Stack Development | React + TypeScript + Supabase + PostgreSQL |
| Smart Contract Engineering | Solidity, Hardhat, OpenZeppelin, Polygon |
| Security Engineering | RLS, audit logs, input validation, threat modeling |
| AI Integration | LLM APIs, prompt engineering, fraud detection |
| DevOps | GitHub Actions CI/CD, Vercel, environment management |
| Database Design | Normalized schema, RLS policies, migrations |
| System Architecture | Multi-layer design, trust boundaries, trade-off reasoning |
| Testing | Unit, integration, E2E, smart contract adversarial tests |
| Technical Documentation | ADRs, runbooks, API docs, living documentation |

---

## License

MIT License — see [`LICENSE`](./LICENSE)

---

<div align="center">

Built with engineering discipline by the VotEth Principal Engineering Team.

*Every decision, every trade-off, every architectural choice is documented.*

</div>
