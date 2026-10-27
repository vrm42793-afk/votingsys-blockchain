# ai-engineering/ — AI-Assisted Development Workflow Assets

This directory exists because AI-assisted development is a first-class concern in VotEth 2.0, not a side tool.

## Directory Structure

```
ai-engineering/
├── prompts/       # Reusable task templates and system prompts
├── skills/        # Project-specific assistant instructions and skills
├── context/       # Short current-memory files (what's in progress, what's blocked)
├── handoff/       # Session transition documents for AI continuity
├── reviews/       # AI review checklists and post-session notes
└── evals/         # Prompt/output regression testing artifacts
```

## Purpose

VotEth treats AI as a **workflow surface** that needs:

- **Explicit prompts** — not ad hoc "just ask the AI" approaches
- **Context continuity** — session handoff documents preserve progress
- **Review discipline** — AI-generated code gets the same review as human code
- **Reusable instructions** — project-specific skills encode project conventions

## How It Works

1. Before starting a new AI session, review `context/` for current state
2. Use task templates from `prompts/` for structured work
3. After a session, write a handoff note to `handoff/`
4. If AI generates code, run it through `reviews/` checklist

## Key Files

| File | Purpose |
|---|---|
| `context/current-focus.md` | What volume/chapter is currently in progress |
| `handoff/latest.md` | Most recent session handoff |
| `prompts/code-review.md` | Template: AI code review prompt |
| `prompts/implementation.md` | Template: Feature implementation prompt |
| `skills/voteth-conventions.md` | Project conventions AI should follow |

Volume I, Chapter 5.6 defines this directory structure.
