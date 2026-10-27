# components/ — Shared UI Primitives

This directory contains **shared, reusable UI components** used across multiple features.

## Organization

```
components/
├── ui/          # Atomic primitives: Button, Input, Card, Badge, Modal, Spinner
├── layout/      # Layout components: Header, Sidebar, Footer, PageWrapper
├── forms/       # Shared form primitives: FormField, FormError, FormLabel
└── feedback/    # Toasts, alerts, empty states, error boundaries
```

## Rules

- Components here must be **domain-agnostic** — they don't know about elections, candidates, or votes
- Domain-specific components live in `src/features/<domain>/`
- Each component should have a corresponding test file in `src/tests/components/`
- Storybook stories live alongside components (Volume XVII)

## Naming

- `PascalCase.tsx` for all component files
- `PascalCase.test.tsx` for test files

Volume IV, Chapter 13 implements the component library.
