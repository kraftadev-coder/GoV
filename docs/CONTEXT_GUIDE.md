# CivicVoice — New Chat Context Guide

> **Purpose**: Read this file at the start of every new chat to get full project context.

## How to Start a New Module

Tell the AI:
```
Read all files in docs/ and the 5 design documents in the root.
Then build [Module X] as defined in docs/implementation_plan.md.
Run all Verification Gate tests before marking the module complete.
Update docs/task.md when done.
```

## Files to Read (in order)

### 1. Project Context
| File | What it contains |
|------|-----------------|
| `docs/implementation_plan.md` | Full 8-module plan with verification gates |
| `docs/task.md` | Current progress tracker (check what's done/pending) |

### 2. Design Documents (Source of Truth)
| File | What it contains |
|------|-----------------|
| `CivicVoice_Technical_Blueprint_Cloudflare.md` | Architecture — Cloudflare Pages, Workers, D1, R2 |
| `CivicVoice_Security_EdgeCase_Protocol.md` | Amnesia Protocol, anti-spoofing, cost defense |
| `CivicVoice_UIUX_Strategy.md` | Editorial Brutalism design language |
| `CivicVoice_Component_Spec.md` | CSS variables, component specs |
| `CivicVoice_Feature_Goal_Matrix.md` | Feature → Goal mapping |

### 3. Previous Module Code
After Module 0 is built, also read the `src/` directory to understand existing code.

## Technology Stack (Decided)

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React + TypeScript |
| Hosting | Cloudflare Pages (`*.pages.dev`) |
| Backend | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite at edge) |
| Storage | Cloudflare R2 (deferred — needs credit card) |
| Testing Domain | `civicvoice.pages.dev` |

## Cloudflare Account

- Account: `Krafta.dev@gmail.com`
- Account ID: `49c7f1d99205abe1f8bac67bd61d14cb`
- MCP: Connected (D1, KV, Workers accessible)
- R2: Not yet enabled (needs credit card before Module 5)

## Module Build Rules

1. **Read the implementation plan** for the specific module details
2. **Build only the files listed** for that module
3. **Run ALL verification gate tests** — every test in the table must pass
4. **Update `docs/task.md`** — mark completed items with `[x]`
5. **Do NOT skip ahead** to the next module
6. **Modules 6 and 7 can be built in parallel** (both depend on Module 5)
7. **Commit to git** at the end of each module
