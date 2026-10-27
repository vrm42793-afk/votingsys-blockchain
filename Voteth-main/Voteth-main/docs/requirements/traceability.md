# VotEth 2.0 — Requirement Traceability Matrix

**Document Type:** Traceability Reference
**Volume:** I — Foundation & Vision
**Chapter:** 2.5 — Requirement Traceability Matrix
**Last Updated:** June 2026
**Status:** Living Document — update whenever a requirement is implemented or changed

> This matrix traces every requirement ID to the user story it satisfies, the volume/chapter that covers it, the primary component that implements it, and the test file that verifies it. An untraceable requirement is an unverifiable requirement.

---

## Maintenance Rules

1. Add a row when a requirement is implemented
2. Update the `Status` column as work progresses
3. Update `Test File` when tests are written
4. If a requirement changes, update both this file and [`requirements.md`](./requirements.md)
5. This file lives at `docs/requirements/traceability.md` and is referenced by all ADRs

---

## Authentication & Identity (AUTH)

| Req ID | User Story | Volume/Chapter | Primary Component | Test File | Status |
|---|---|---|---|---|---|
| AUTH-01 | US-010 | Vol. V, Ch. 18 | `features/auth/RegisterForm.tsx` | `tests/auth/register.test.ts` | 🔲 Planned |
| AUTH-02 | US-010 | Vol. V, Ch. 18 | `features/auth/MagicLinkForm.tsx` | `tests/auth/magic-link.test.ts` | 🔲 Planned |
| AUTH-03 | US-010 | Vol. V, Ch. 18 | `features/auth/OAuthButtons.tsx` | `tests/auth/oauth.test.ts` | 🔲 Planned |
| AUTH-04 | US-010 | Vol. V, Ch. 18 | `features/auth/OAuthButtons.tsx` | `tests/auth/oauth.test.ts` | 🔲 Planned |
| AUTH-05 | US-010 | Vol. V, Ch. 22 | `features/auth/SIWEButton.tsx` | `tests/auth/siwe.test.ts` | 🔲 Planned |
| AUTH-06 | US-010 | Vol. V, Ch. 18 | `services/supabase/authClient.ts` | `tests/auth/session.test.ts` | 🔲 Planned |
| AUTH-07 | US-010 | Vol. V, Ch. 18 | `features/auth/LogoutButton.tsx` | `tests/auth/logout.test.ts` | 🔲 Planned |
| AUTH-08 | US-010 | Vol. V, Ch. 18 | `features/auth/EmailVerification.tsx` | `tests/auth/verification.test.ts` | 🔲 Planned |
| AUTH-09 | US-010 | Vol. V, Ch. 18 | `features/auth/PasswordReset.tsx` | `tests/auth/password-reset.test.ts` | 🔲 Planned |

---

## Organization Management (ORG)

| Req ID | User Story | Volume/Chapter | Primary Component | Test File | Status |
|---|---|---|---|---|---|
| ORG-01 | US-011 | Vol. III, Ch. 10 | `features/orgs/CreateOrgForm.tsx` | `tests/orgs/create.test.ts` | 🔲 Planned |
| ORG-02 | US-011 | Vol. III, Ch. 10 | `services/supabase/orgService.ts` | `tests/orgs/membership.test.ts` | 🔲 Planned |
| ORG-03 | US-011 | Vol. III, Ch. 10 | `features/orgs/InviteMemberForm.tsx` | `tests/orgs/invite.test.ts` | 🔲 Planned |
| ORG-04 | US-011 | Vol. III, Ch. 10 | Supabase Edge Function: `send-org-invite` | `tests/orgs/invite-email.test.ts` | 🔲 Planned |
| ORG-05 | US-011 | Vol. III, Ch. 10 | `features/orgs/MemberRoleSelect.tsx` | `tests/orgs/roles.test.ts` | 🔲 Planned |
| ORG-06 | US-011 | Vol. III, Ch. 10 | `features/orgs/MemberList.tsx` | `tests/orgs/remove-member.test.ts` | 🔲 Planned |
| ORG-07 | ALL | Vol. III, Ch. 11 | RLS Policy: `org_isolation` | `tests/rls/org-isolation.test.ts` | 🔲 Planned |

---

## Election Management (ELEC)

| Req ID | User Story | Volume/Chapter | Primary Component | Test File | Status |
|---|---|---|---|---|---|
| ELEC-01 | US-001 | Vol. VI, Ch. 23 | `features/elections/CreateElectionForm.tsx` | `tests/elections/create.test.ts` | 🔲 Planned |
| ELEC-02 | US-001 | Vol. VI, Ch. 23 | `features/elections/ElectionTypeSelect.tsx` | `tests/elections/type.test.ts` | 🔲 Planned |
| ELEC-03 | US-001 | Vol. VI, Ch. 23 | `features/elections/ElectionConfig.tsx` | `tests/elections/config.test.ts` | 🔲 Planned |
| ELEC-04 | US-001, US-005 | Vol. VI, Ch. 23 | `services/supabase/electionService.ts` | `tests/elections/lifecycle.test.ts` | 🔲 Planned |
| ELEC-05 | US-005 | Vol. VI, Ch. 23 | `features/elections/ElectionControls.tsx` | `tests/elections/controls.test.ts` | 🔲 Planned |
| ELEC-06 | US-005 | Vol. VI, Ch. 23 | Supabase scheduled function: `election-scheduler` | `tests/elections/scheduler.test.ts` | 🔲 Planned |
| ELEC-07 | US-001 | Vol. VI, Ch. 23 | RLS Policy + DB constraint | `tests/rls/election-lock.test.ts` | 🔲 Planned |
| ELEC-08 | US-005 | Vol. VI, Ch. 23 | RLS Policy: `results_hidden_until_published` | `tests/rls/results-privacy.test.ts` | 🔲 Planned |
| ELEC-09 | US-001 | Vol. VIII, Ch. 32 | `services/blockchain/registryService.ts` | `tests/blockchain/registry.test.ts` | 🔲 Planned |

---

## Candidate Management (CAND)

| Req ID | User Story | Volume/Chapter | Primary Component | Test File | Status |
|---|---|---|---|---|---|
| CAND-01 | US-012 | Vol. VI, Ch. 24 | `features/candidates/CandidateRegistration.tsx` | `tests/candidates/registration.test.ts` | 🔲 Planned |
| CAND-02 | US-012 | Vol. VI, Ch. 24 | `features/candidates/CandidateProfile.tsx` | `tests/candidates/profile.test.ts` | 🔲 Planned |
| CAND-03 | US-012 | Vol. VI, Ch. 24 | `features/candidates/ApprovalQueue.tsx` | `tests/candidates/approval.test.ts` | 🔲 Planned |
| CAND-04 | US-012 | Vol. VIII, Ch. 32 | `services/blockchain/electionService.ts` | `tests/blockchain/candidate-registration.test.ts` | 🔲 Planned |
| CAND-05 | US-012 | Vol. VI, Ch. 24 | `features/candidates/CampaignEditor.tsx` | `tests/candidates/campaign.test.ts` | 🔲 Planned |
| CAND-06 | US-012 | Vol. VII, Ch. 30 | Supabase Edge Function: `ai-candidate-summary` | `tests/ai/candidate-summary.test.ts` | 🔲 Planned |

---

## Voting (VOTE)

| Req ID | User Story | Volume/Chapter | Primary Component | Test File | Status |
|---|---|---|---|---|---|
| VOTE-01 | US-002 | Vol. VI, Ch. 25 | RLS Policy: `voter_allowlist` | `tests/rls/voter-allowlist.test.ts` | 🔲 Planned |
| VOTE-02 | US-002 | Vol. VI, Ch. 25 | DB unique constraint + `VotEthElection.sol` | `tests/voting/single-vote.test.ts` | 🔲 Planned |
| VOTE-03 | US-002 | Vol. VI, Ch. 25 | `features/voting/VotingInterface.tsx` | `tests/voting/submission.test.ts` | 🔲 Planned |
| VOTE-04 | US-002 | Vol. VI, Ch. 25 + Vol. VIII | `VotEthElection.sol` + RLS | `tests/contracts/VotEthElection.test.ts` | 🔲 Planned |
| VOTE-05 | US-002, US-004 | Vol. VI, Ch. 25 | `features/voting/VoteReceipt.tsx` | `tests/voting/receipt.test.ts` | 🔲 Planned |
| VOTE-06 | US-004 | Vol. VI, Ch. 25 | `features/voting/VoteVerification.tsx` | `tests/voting/verification.test.ts` | 🔲 Planned |
| VOTE-07 | US-002 | Vol. VI, Ch. 25 | RLS Policy: `vote_privacy_during_open` | `tests/rls/vote-privacy.test.ts` | 🔲 Planned |
| VOTE-08 | US-005 | Vol. VI, Ch. 25 | `features/elections/ElectionResults.tsx` | `tests/elections/results.test.ts` | 🔲 Planned |

---

## AI Features (AI)

| Req ID | User Story | Volume/Chapter | Primary Component | Test File | Status |
|---|---|---|---|---|---|
| AI-01 | US-003 | Vol. VII, Ch. 30 | Supabase Edge Function: `ai-fraud-check` | `tests/ai/fraud-detection.test.ts` | 🔲 Planned |
| AI-02 | US-003 | Vol. VII, Ch. 30 | `features/admin/FraudAlertPanel.tsx` | `tests/ai/fraud-alerts.test.ts` | 🔲 Planned |
| AI-03 | US-003 | Vol. VII, Ch. 30 | `features/admin/FraudAlertCard.tsx` | `tests/ai/flag-actions.test.ts` | 🔲 Planned |
| AI-04 | US-003 | Vol. VII, Ch. 31 | Supabase Edge Function: `ai-election-assistant` | `tests/ai/assistant.test.ts` | 🔲 Planned |
| AI-05 | US-012 | Vol. VII, Ch. 30 | Supabase Edge Function: `ai-candidate-summary` | `tests/ai/candidate-summary.test.ts` | 🔲 Planned |

---

## Analytics (ANLT)

| Req ID | User Story | Volume/Chapter | Primary Component | Test File | Status |
|---|---|---|---|---|---|
| ANLT-01 | US-005 | Vol. VI, Ch. 26 | `features/analytics/LiveVoteCount.tsx` | `tests/analytics/realtime.test.ts` | 🔲 Planned |
| ANLT-02 | US-005 | Vol. VI, Ch. 26 | `features/analytics/TurnoutMetric.tsx` | `tests/analytics/turnout.test.ts` | 🔲 Planned |
| ANLT-03 | US-005 | Vol. VI, Ch. 26 | `features/analytics/ExportCSV.tsx` | `tests/analytics/export.test.ts` | 🔲 Planned |
| ANLT-04 | US-004, US-005 | Vol. VI, Ch. 27 | `features/analytics/ChainVerification.tsx` | `tests/analytics/chain-verify.test.ts` | 🔲 Planned |

---

## Status Legend

| Symbol | Meaning |
|---|---|
| 🔲 Planned | Requirement documented, not yet implemented |
| 🔄 In Progress | Implementation underway |
| ✅ Implemented | Code written, tests passing |
| ⚠️ Blocked | Dependency preventing progress |
| 🗑️ Deferred | Moved to later volume or version |

---

## Change Log

| Version | Date | Change |
|---|---|---|
| 1.0.0 | June 2026 | Initial RTM from Volume I, Chapter 2 — all requirements in Planned state |
