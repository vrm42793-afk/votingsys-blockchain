# VotEth 2.0 — Requirements Specification

**Document Type:** Requirements Reference
**Volume:** I — Foundation & Vision
**Chapter:** 2 — Requirements Engineering
**Last Updated:** June 2026
**Status:** Living Document

> Requirements are assigned unique IDs for traceability. Every ID referenced in the codebase, tests, or PR descriptions should trace back to a row in this document.

---

## Table of Contents

1. [Functional Requirements](#1-functional-requirements)
2. [Non-Functional Requirements](#2-non-functional-requirements)
3. [System Constraints](#3-system-constraints)
4. [User Stories & Acceptance Criteria](#4-user-stories--acceptance-criteria)
5. [Out-of-Scope Items](#5-out-of-scope-items)

---

## 1. Functional Requirements

Functional requirements define *what the system does.* Each requirement has an ID for traceability to tests, components, and ADRs.

### 1.1 Authentication & Identity (AUTH)

| ID | Requirement | Priority |
|---|---|---|
| AUTH-01 | Users can register with email and password | P0 |
| AUTH-02 | Users can authenticate via magic link | P0 |
| AUTH-03 | Users can authenticate via Google OAuth | P0 |
| AUTH-04 | Users can authenticate via GitHub OAuth | P1 |
| AUTH-05 | Users can authenticate via Sign-In With Ethereum (SIWE) | P1 |
| AUTH-06 | Sessions persist across browser refreshes | P0 |
| AUTH-07 | Users can log out from all devices | P1 |
| AUTH-08 | Email verification is required before full access | P0 |
| AUTH-09 | Password reset flow is functional | P0 |

### 1.2 Organization Management (ORG)

| ID | Requirement | Priority |
|---|---|---|
| ORG-01 | Authenticated users can create organizations | P0 |
| ORG-02 | Organization creators become Organization Admins automatically | P0 |
| ORG-03 | Admins can invite members by email | P0 |
| ORG-04 | Invited users receive email with accept/decline link | P0 |
| ORG-05 | Admins can assign roles (Admin, Moderator, Viewer) | P1 |
| ORG-06 | Admins can remove members | P1 |
| ORG-07 | Organization data is strictly isolated — no cross-org data leakage | P0 |

### 1.3 Election Management (ELEC)

| ID | Requirement | Priority |
|---|---|---|
| ELEC-01 | Admins can create elections with title, description, start/end dates | P0 |
| ELEC-02 | Admins can configure election type (single choice, multi-choice) | P0 |
| ELEC-03 | Admins can configure maximum votes per voter | P1 |
| ELEC-04 | Elections have lifecycle states: DRAFT → OPEN → CLOSED → PUBLISHED | P0 |
| ELEC-05 | Admins can open and close elections manually | P0 |
| ELEC-06 | Elections are automatically opened/closed at configured times | P1 |
| ELEC-07 | Election configuration is locked once OPEN (immutable while voting is live) | P0 |
| ELEC-08 | Election results are hidden until PUBLISHED state | P0 |
| ELEC-09 | Admins can register the election on-chain upon creation | P1 |

### 1.4 Candidate Management (CAND)

| ID | Requirement | Priority |
|---|---|---|
| CAND-01 | Candidates can be added by admins or self-register via campaign portal | P0 |
| CAND-02 | Candidate profiles include: name, bio, photo, supporting documents | P0 |
| CAND-03 | Candidates require admin approval before appearing on the ballot | P0 |
| CAND-04 | Approved candidates are registered on-chain | P1 |
| CAND-05 | Candidates can edit their own campaign pages | P1 |
| CAND-06 | AI summary is generated for each approved candidate | P2 |

### 1.5 Voting (VOTE)

| ID | Requirement | Priority |
|---|---|---|
| VOTE-01 | Only allowlisted voters can vote in a given election | P0 |
| VOTE-02 | Each voter can cast at most one vote per election (configurable) | P0 |
| VOTE-03 | Votes are recorded in Supabase and anchored on-chain | P0 |
| VOTE-04 | Double-voting is prevented at both database level (unique constraint) and contract level (`hasVoted` mapping) | P0 |
| VOTE-05 | Voters receive a cryptographic receipt after voting | P0 |
| VOTE-06 | Voters can verify their vote is included in the tally | P1 |
| VOTE-07 | Individual vote choices are private during OPEN state | P0 |
| VOTE-08 | Aggregate results are available after PUBLISHED state | P0 |

### 1.6 QR Code System (QR)

| ID | Requirement | Priority |
|---|---|---|
| QR-01 | Each eligible voter receives a unique QR code | P1 |
| QR-02 | QR codes can be scanned to initiate a voting session | P1 |
| QR-03 | QR codes are single-use (invalidated after scan) | P1 |
| QR-04 | QR codes expire after election closes | P1 |

### 1.7 AI Features (AI)

| ID | Requirement | Priority |
|---|---|---|
| AI-01 | System detects anomalous voting patterns and flags them | P1 |
| AI-02 | Admin dashboard displays AI-generated fraud flags with explanations | P1 |
| AI-03 | Admins can dismiss or escalate AI flags | P1 |
| AI-04 | Election assistant answers admin questions in natural language | P2 |
| AI-05 | Candidate summaries are auto-generated from profile content | P2 |

### 1.8 Analytics (ANLT)

| ID | Requirement | Priority |
|---|---|---|
| ANLT-01 | Real-time vote count displayed to admins during OPEN state | P0 |
| ANLT-02 | Voter turnout percentage is displayed | P1 |
| ANLT-03 | Results can be exported as CSV | P1 |
| ANLT-04 | On-chain vote count matches off-chain count (verification view) | P1 |

---

## 2. Non-Functional Requirements

Non-functional requirements define *how well the system does it.*

| Category | Requirement | Target | Rationale |
|---|---|---|---|
| **Performance** | Page load time (LCP) | < 2.5s on 4G | Core Web Vitals passing |
| **Performance** | API response time (p95) | < 500ms | Supabase PostgREST SLA |
| **Performance** | Vote submission time | < 3s (excl. blockchain confirmation) | UX responsiveness |
| **Availability** | Platform uptime | ≥ 99.5% | Within Vercel/Supabase free tier guarantees |
| **Scalability** | Concurrent voters per election | ≥ 500 | Demo-scale target |
| **Security** | Auth token expiry | 1 hour access / 7 day refresh | Supabase default; appropriate for demo |
| **Security** | Data in transit | TLS 1.2+ enforced | Vercel and Supabase enforce this |
| **Security** | RLS on all tables | 100% — no unprotected table | Non-negotiable security baseline |
| **Accessibility** | WCAG compliance | Level AA | Ethical requirement for a voting system |
| **Accessibility** | Keyboard navigation | 100% of core flows | Must not exclude keyboard-only users |
| **Maintainability** | TypeScript strict mode | Enabled — no `any` types | Code quality non-negotiable |
| **Maintainability** | Test coverage (contracts) | ≥ 80% | Smart contracts are harder to patch |
| **Maintainability** | Test coverage (frontend) | ≥ 70% | Regression confidence |
| **Documentation** | Every public function | JSDoc / NatSpec documented | Portfolio and maintainability standard |

---

## 3. System Constraints

These are hard constraints. They cannot be negotiated without a formal ADR update.

| Constraint | Value | Reason |
|---|---|---|
| **Operational cost** | $0/month (free tier only) | Budget: no capital for operational costs |
| **Blockchain network** | Polygon Amoy testnet only | Real ETH gas costs are prohibitive for portfolio |
| **No secrets on client** | Zero server-side secrets in browser | Security non-negotiable |
| **RLS on every table** | Mandatory, no exceptions | Cannot be bypassed by application bugs |
| **Commit format** | Conventional Commits enforced | Professional Git history for portfolio |
| **TypeScript strict** | `"strict": true` in tsconfig | Code quality non-negotiable |
| **Developer count** | Single developer | All playbooks designed for solo execution |

---

## 4. User Stories & Acceptance Criteria

### US-001: Admin creates an election

> *As an Organization Admin, I want to create an election so that my organization's members can vote on a decision.*

**Acceptance Criteria:**
- Admin can navigate to "Create Election" from the organization dashboard
- Form requires: title (required), description (optional), start date, end date, election type
- Form validates that end date is after start date before submission
- Submitting the form creates an election record in `DRAFT` state
- Admin is redirected to the election management page upon success
- A success notification (toast) is displayed
- The election appears in the admin's election list with `DRAFT` badge

**References:** ELEC-01, ELEC-02, ELEC-04

---

### US-002: Voter casts a vote

> *As an eligible voter, I want to cast my vote so that my choice is recorded securely and verifiably.*

**Acceptance Criteria:**
- Voter can see elections they are eligible for on their dashboard (VOTE-01 enforced via RLS)
- Voter can view candidate profiles before confirming their choice
- Voter selects a candidate and clicks "Cast Vote"
- A confirmation modal appears showing the voter's selected candidate
- On confirmation, vote is submitted to Supabase, then transaction is sent to blockchain
- Voter receives a receipt showing: vote hash, blockchain transaction ID, timestamp
- Voter cannot vote again in the same election — UI shows "Vote Cast" state, and the API rejects duplicate attempts

**References:** VOTE-01, VOTE-02, VOTE-03, VOTE-04, VOTE-05

---

### US-003: Admin reviews AI fraud flags

> *As an Organization Admin, I want to see AI-generated fraud flags so that I can investigate suspicious voting patterns.*

**Acceptance Criteria:**
- Admin dashboard shows a "Fraud Alerts" panel visible only to admins
- Each flag displays: description, severity (low/medium/high), affected voter/pattern, timestamp
- Admin can click "Dismiss" — flag is marked dismissed, stored in DB, hidden from default view
- Admin can click "Escalate" — flag is marked escalated, an audit log entry is created
- Dismissed flags are hidden by default; a toggle reveals them

**References:** AI-01, AI-02, AI-03

---

### US-004: Voter verifies their vote

> *As a voter who has voted, I want to verify my vote was counted so that I can trust the outcome.*

**Acceptance Criteria:**
- Voter can navigate to "My Votes" section
- For each election voted in, voter can see their receipt: vote hash, transaction hash
- A "Verify on Chain" button links directly to Polygonscan for the transaction
- On-chain tally for the election is visible and labeled distinctly from off-chain tally
- If on-chain and off-chain tallies match, a green "Verified" indicator is shown

**References:** VOTE-05, VOTE-06, ANLT-04

---

### US-005: Admin publishes election results

> *As an Organization Admin, I want to publish election results so that the outcome is visible to all members.*

**Acceptance Criteria:**
- Admin can transition an election from `CLOSED` to `PUBLISHED`
- Before publish, admin sees a pre-publish summary: total votes, on-chain vs off-chain verification status
- On publish, results become visible to all organization members
- Candidates and their vote counts are displayed in a ranked results view
- A "Verify on Chain" option is available on the public results page

**References:** ELEC-04, ELEC-08, VOTE-08, ANLT-04

---

## 5. Out-of-Scope Items

These items are explicitly deferred. If someone proposes implementing them in VotEth 2.0, they must first add an ADR justifying the scope change.

| Item | Why Deferred | Target Version |
|---|---|---|
| **Anonymous voting (zk-SNARKs via Semaphore)** | Semaphore integration is complex; architectural groundwork is laid | VotEth 2.1 |
| **Mobile native app** | Web-first; PWA capability sufficient for 2.0 | VotEth 2.3 |
| **Ethereum mainnet deployment** | Gas costs prohibitive; Polygon Amoy is EVM-identical | Post-2.2 |
| **Real payment processing / SaaS billing** | Billing requires org-tier model; deferred to SaaS phase | VotEth 2.2 |
| **Legal compliance certifications** | Out of scope for academic/portfolio project | N/A |
| **Multi-language (i18n)** | English only for 2.0; i18n architecture is designed to be addable | VotEth 2.1 |
| **Ranked-choice voting** | Single and multi-choice only; RCV algorithm adds complexity | VotEth 2.1 |
| **Multi-wallet support (WalletConnect)** | MetaMask is primary target; WalletConnect planned | Chapter 22 |

---

## Change Log

| Version | Date | Change |
|---|---|---|
| 1.0.0 | June 2026 | Initial requirements from Volume I, Chapter 2 |
