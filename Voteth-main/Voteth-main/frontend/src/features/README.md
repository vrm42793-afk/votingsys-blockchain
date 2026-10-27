# features/ — Domain Feature Modules

This directory contains **domain-organized feature modules**. Each subdirectory is a self-contained feature domain that owns its components, hooks, and local types.

## Feature Domains

```
features/
├── auth/          # Login, register, magic link, OAuth, SIWE, password reset
├── elections/     # Election creation, management, lifecycle controls, results
├── candidates/    # Candidate registration, approval, campaign portal
├── voting/        # Vote casting flow, receipt display, verification
├── organizations/ # Org creation, member management, invitations
├── analytics/     # Real-time vote counts, turnout, CSV export, chain verification
├── ai/            # Fraud alert panel, election assistant, candidate summarizer
└── admin/         # Admin dashboard composition, audit log viewer
```

## Organization Per Feature

```
features/elections/
├── components/    # Election-specific components (ElectionCard, ElectionStatus)
├── hooks/         # Election-specific hooks (useElection, useElectionList)
├── services/      # Election-specific API calls (electionService.ts)
├── schemas/       # Zod validation schemas (electionFormSchema.ts)
└── index.ts       # Public exports from this feature module
```

## Rules

- Feature modules should be **importable by other features only through their index.ts**
- Do not import internals of one feature from another directly
- Common patterns across features should be extracted to `src/components/` or `src/hooks/`

Volume IV, Chapter 14 implements the feature module architecture.
Volume VI, Chapters 23–27 implement the voting feature modules.
