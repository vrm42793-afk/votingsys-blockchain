# VotEth 2.0 — Database Schema & RLS Design

**Document Type:** Architecture Reference
**Volume:** III — Database Architecture
**Chapter:** 8 — Schema, RLS, and Security Design
**Last Updated:** June 2026
**Status:** Execution-Ready (Migrations Authored)

---

## 1. Requirements-to-Entity Mapping

| Requirement ID | Description | Entity/Mechanism |
|---|---|---|
| AUTH-01..09 | User identity and sessions | Supabase Auth + `user_profiles` |
| ORG-01 | Create organization | `organizations` + trigger `on_organization_created` |
| ORG-02 | Creator becomes admin | Trigger auto-inserts into `org_members` with `role='admin'` |
| ORG-03..06 | Invite and manage members | `org_members` + RLS admin policies |
| ORG-07 | Org isolation | Every table has `org_id` FK + RLS `is_org_admin()` / `is_election_org_member()` |
| ELEC-01..02 | Create elections | `elections` table |
| ELEC-04 | Election states | `election_status` enum: `draft→open→closed→published` |
| ELEC-07 | Config locked when OPEN | RLS UPDATE policy: `status IN ('draft', 'open', 'closed')` + manual enforcement in Edge Functions |
| ELEC-08 | Results hidden until PUBLISHED | `get_election_results()` returns empty set unless status = 'published' |
| CAND-01..03 | Candidate registration | `candidates` + `candidate_status` enum |
| CAND-06 | AI summary | `candidates.ai_summary` column, written by Edge Function |
| VOTE-01 | Voter allowlist | `election_voters` + RLS on `votes` checks allowlist |
| VOTE-02 | One vote per voter | `UNIQUE(election_id, voter_id)` on `votes` |
| VOTE-03 | Off-chain + on-chain anchor | `votes.vote_hash` + `votes.chain_tx_hash` |
| VOTE-04 | Double-vote prevention | UNIQUE constraint (off-chain) + `hasVoted` mapping in contract (on-chain) |
| VOTE-05 | Cryptographic receipt | `votes.vote_hash` + `votes.chain_tx_hash` returned to voter |
| VOTE-06 | Voter can verify | RLS SELECT policy: voter reads own row; on-chain via Polygonscan |
| VOTE-07 | Vote privacy during OPEN | `votes` table: zero admin SELECT access; only aggregates via SECURITY DEFINER |
| VOTE-08 | Results after PUBLISHED | `get_election_results()` enforces `status = 'published'` gate |
| QR-01..04 | QR code lifecycle | `qr_codes` + `redeem_qr_code()` via Edge Function |
| AI-01..03 | Fraud detection | `ai_fraud_flags` + Edge Function writes via service_role |
| ANLT-01..02 | Turnout metrics | `get_voter_turnout()` SECURITY DEFINER function |
| ANLT-04 | On/off-chain match | `votes.is_chain_confirmed` + `votes.chain_tx_hash` |

---

## 2. Table Access Matrix

| Table | Direct Client Safe | Read Path | Write Path |
|---|---|---|---|
| `user_profiles` | Yes | Client (RLS: public) | Client (self) / Auth trigger |
| `organizations` | Yes | Client (RLS: members) | Client (auth'd) |
| `org_members` | Yes | Client (RLS: members) | Client (admin) |
| `elections` | Yes | Client (RLS: members) | Client (admin) |
| `candidates` | Yes | Client (RLS: members) | Client (admin/self) |
| `election_voters` | Yes | Client (RLS: members) | Client (admin) |
| `votes` | **Partial** (self read only) | Client (self only) | Client (voter INSERT, ONCE) |
| `qr_codes` | **No** (issue path) | Client (self) | **Edge Function only** |
| `ai_fraud_flags` | **No** | Client (admin SELECT) | **Edge Function / service_role only** |
| `audit_logs` | **No** | Client (admin SELECT) | **Edge Function / trigger only** |

---

## 3. RLS Policy Inventory

| Table | Policy Name | Operation | Condition |
|---|---|---|---|
| `user_profiles` | Profiles are readable by everyone | SELECT | `true` |
| `user_profiles` | Users can update their own profile | UPDATE | `auth.uid() = id` |
| `organizations` | Members can view their organizations | SELECT | Member exists in `org_members` |
| `organizations` | Authenticated users can create organizations | INSERT | `auth.uid() IS NOT NULL` |
| `organizations` | Admins can update organizations | UPDATE | `is_org_admin(id)` |
| `org_members` | Members can see other members in their org | SELECT | Shared org membership |
| `org_members` | Admins can manage members | ALL | `is_org_admin(org_id)` |
| `elections` | Org members can view elections | SELECT | `is_election_org_member(id)` |
| `elections` | Admins can create elections | INSERT | `is_org_admin(org_id)` |
| `elections` | Admins can update elections if not published | UPDATE | Admin + status ∈ {draft,open,closed} |
| `candidates` | Org members can view candidates | SELECT | `is_election_org_member(election_id)` |
| `candidates` | Admins can manage candidates | ALL | `is_election_admin(election_id)` |
| `candidates` | Users can update their own candidate profile | UPDATE | `user_id = auth.uid()` |
| `election_voters` | Org members can view allowlist | SELECT | `is_election_org_member(election_id)` |
| `election_voters` | Admins can manage allowlist | ALL | `is_election_admin(election_id)` |
| `votes` | Voters can view their own votes | SELECT | `voter_id = auth.uid()` |
| `votes` | Voters can insert votes if election is open | INSERT | auth.uid(), is_election_voter(), status='open' |
| `qr_codes` | Users can view their own QR codes | SELECT | `voter_id = auth.uid()` |
| `qr_codes` | Admins can manage QR codes | ALL | `is_election_admin(election_id)` |
| `ai_fraud_flags` | Admins can view fraud flags | SELECT | `is_election_admin(election_id)` |
| `ai_fraud_flags` | Admins can update fraud flag status | UPDATE | `is_election_admin(election_id)` |
| `audit_logs` | Admins can view audit logs | SELECT | `is_org_admin(org_id)` |

**Tables with NO client write access (service_role only):**
- `ai_fraud_flags` (INSERT)
- `audit_logs` (INSERT, UPDATE, DELETE)
- `votes` (UPDATE, DELETE)

---

## 4. Candidate ID in Votes — Design Justification

**The Question:** Is it safe to store `candidate_id` plaintext in the `votes` table?

**The Answer:** Yes, within the threat model of VotEth 2.0.

**Reasoning:**
- The `votes` table is inaccessible to anyone except the individual voter via RLS. An admin querying `SELECT * FROM votes WHERE election_id = '...'` returns **zero rows** — not filtered rows, zero rows.
- The only aggregation exposed is via `get_election_results()` (SECURITY DEFINER), which returns only counts per candidate, never individual records.
- An independent auditor verifying VOTE-06 can see their own `candidate_id` in their receipt — this is the correct behavior. They chose the candidate; they should be able to verify their vote was counted.
- The alternative (hashing candidate IDs) would prevent vote verification (VOTE-06) without a ZK circuit, which is explicitly deferred to VotEth 2.1.

**Residual Risk:** A database superuser (Supabase service role, or anyone with direct `psql` access) can read all vote records. This is accepted for a portfolio project; the mitigation in a production system would be field-level encryption or a ZK proof scheme.

---

## 5. Edge Function Boundary Decisions

| Operation | Mechanism | Why Edge Function |
|---|---|---|
| AI fraud flag writes | `ai-fraud-check` Edge Fn → service_role → INSERT | Requires AI API key; must read all voting patterns across the election bypassing RLS |
| AI candidate summary | `ai-candidate-summary` Edge Fn → service_role → UPDATE | Requires AI API key |
| Blockchain tx-hash confirmation | `blockchain-worker` Edge Fn → `confirm_vote_on_chain()` | Client cannot be trusted to submit honest tx hashes. Must be verified by independent listener. |
| QR code issuance | `qr-issue` Edge Fn → service_role → INSERT | Requires org verification + token secrecy |
| QR code redemption | `qr-redeem` Edge Fn → `redeem_qr_code()` | Atomic token expiry + identity handoff; client cannot do this safely |
| Audit log writes | Any privileged Edge Fn → `append_audit_log()` | Audit trail must be client-tamper-proof |

---

## 6. Unresolved Assumptions

1. **ASSUMPTION:** `vote_hash` generation happens **client-side** (voter computes `keccak256(election_id + voter_id + candidate_id + salt)` before INSERT). The salt must come from the server or be user-derived; its implementation is deferred to Volume V.

2. **ASSUMPTION:** SIWE (Sign-In With Ethereum) auth tokens are mapped to Supabase Auth custom JWTs via an Edge Function. This mapping is deferred to Volume V (auth integration).

3. **ASSUMPTION:** `ELEC-07` (config locked when OPEN) is partially enforced by RLS (UPDATE requires non-published status) but the fine-grained "OPEN state locks config" check must additionally be enforced within the Edge Function that performs election state transitions. RLS alone is insufficient here because the policy allows admin UPDATE in `open` status (e.g., to close it), which means the column-level lock must be validated in application logic.

4. **ASSUMPTION:** `on_organization_created` trigger calls `auth.uid()`. This is valid only when the INSERT flows through the PostgREST API with a valid JWT. Inserts via service_role would assign `NULL` as the admin — this must be handled in seeding scripts.

5. **ASSUMPTION:** Supabase Realtime is enabled on `votes` (for live count) and `ai_fraud_flags` (for admin alerts). This requires enabling replication on these tables in the Supabase dashboard — not handled in SQL migrations.

---

## 7. Security Risks and Design Tensions

| Risk | Severity | Mitigation |
|---|---|---|
| DB superuser reads `votes` table | Medium (accepted) | Service role access controlled via Supabase project settings; portfolio-acceptable |
| Race condition on vote INSERT | Low | `UNIQUE(election_id, voter_id)` constraint causes second attempt to throw DB error |
| SECURITY DEFINER function hijacking | Low | All functions use `SET search_path = ''` to prevent schema injection |
| Clock skew on election dates | Low | All date enforcement uses PostgreSQL `NOW()` server-side; client clocks not trusted |
| QR token enumeration | Medium | UUID v4 tokens are effectively unguessable; `expires_at` and single-use policy further limit exposure |
| Election config mutation while OPEN | Medium | UPDATE policy allows admin updates while `status = 'open'`; column-level protection deferred to Edge Fn logic |

---

## 8. Final Verdict

**Verdict: EXECUTION-READY.**

All four migration files are authored and reside in `supabase/migrations/`:
- `001_core_schema.sql`: 10 tables, 6 enums, 7 triggers, indexes
- `002_rls_helpers.sql`: 5 SECURITY DEFINER helper functions
- `003_rls_policies.sql`: RLS enabled on all 10 tables, 21 policies
- `004_secure_functions.sql`: 8 privileged functions (audit log, results, QR redemption, chain confirmation)

Every core table is defined. Every table has an access strategy. Vote privacy (VOTE-07) is enforced at the database level with zero admin read access. Org isolation is enforced on every operational table. All unresolved assumptions are explicitly listed.

The migrations can be applied directly to a Supabase project via the Supabase CLI:
```bash
supabase db push
```
