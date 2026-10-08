# Meta Specifications

*Explanatory document for the use of `specs/`*
*See `Geordi7/specsify` on github*

`specs/` contains specifications, manual test suites and decision threads as markdown (`.md`) files.
- *specifications* are positive declarations of *intended* behaviour, design decisions, and standards expected to be followed
- *threads* explain specifications: the trail of reasoning behind them, including everything that was ruled out
- *directives* (like `AGENTS.md` or `CLAUDE.md`) describe how to work on the project
- *code comments* should be reserved for local non-obvious logic and references to specifications

In these documents the *agent* is an AI model running in a development harness, and the *operator* is the human directing the work. The agent maintains the specs; the operator directs through chat and threads. This document addresses the agent as *you*.

## Intent and Decisions

Specs state intent; threads tell us how we got there. Every artifact is justified by specs alone: code, tests and specs never cite threads, and a spec must make sense without them. Links run one way, from a thread to the specs it `affects`, so the reasoning can be found when a spec needs to be reconsidered or reinterpreted.

A spec states intent positively: "buttons are red". Only a thread may hold a negative finding: "buttons will not be blue", with its reasoning. A spec may state a constraint the system must satisfy ("credentials are never logged"), because that is intent; it never records an option that was considered and turned down. Specs stay short and current, and nothing rejected is lost:
- **Read before changing.** Before changing a spec, read the threads that affect it (see [Finding Decisions](#finding-decisions)); the change may already have been ruled out.
- **Every rejection has a thread.** When a decision rules something out, wherever it was made (including in chat), record it in a thread's `## Outcome` and put only the positive result in specs.

## Structure

Specs form a tree of files in this directory, organized into domains, their refinements, and test suites. `ls specs` alone must give a sense of how the project is specified, so that an agent can pull exactly the context it needs.

**CRITICAL:** Spec files must never exceed 150 lines. Split a domain that outgrows this into refinements.

**CRITICAL:** Root files of refined domains must never exceed 50 lines. They hold inline summaries of their refinements plus only the most critical or globally applicable information, and leave all detail to the refinements.

### Domains

Domains are numbered from zero; `##` denotes a zero-padded two-digit number (e.g., `02`). Every domain has a root file and may have refinements. Two domains are required:

| Domain File | Purpose |
|-------------|---------|
| `00-meta.md` | this file, describes how to operate in a specs driven project |
| `01-requirements.md` | primary design drivers for the project |

Further domains are added as needed, named `##-lower-kebab-case.md`. Most projects need the first two of these:

| Domain File | Purpose |
|-------------|---------|
| `02-architecture.md` | technical design and key decisions: components, stacks, interfaces, deployment |
| `03-data-model.md` | structure of data and key persistence decisions |
| `##-security-standard.md` | explicit security related constraints or requirements |
| `##-design.md` | external surface (UI or API) constraints and design |
| `##-testing.md`| testing strategy and tools (not specific tests) |
| `##-user-experience.md` | constraints and design for intended user experience |

`specs/threads/` holds decision threads (see [Threads](#threads)). It is not a domain, its files are not specifications, and line limits do not apply to it.

### Refinement

Refinements are named `##-##-sub-domain.md`, and can be refined further as `##-##-##-sub-sub-domain.md` and so on. For example, `02-architecture.md` might summarize `02-00-modules-components.md`, `02-01-coding-standard.md` and `02-02-persistence-layer.md`.

## Testing

### Test Suites

Any specification may be tested directly against its prose, and an agent should be able to perform most tests just by being prompted with the relevant specifications. Reserve **manual test suites**, run by the agent or the operator, for functionality that is ultra-critical or needs precise actions to test, and use them to complement automated and agent tests, not replace them.

A test suite is named `{}-T##-test-description.md`, where `{}` is the full address of its domain or refinement: `02-01-T00-naming-rules.md` tests `02-01-coding-standard.md`, and `02-T00-smoke-test.md` tests `02-architecture.md`.

### Automated Tests

Tests at any level — unit, integration, end-to-end — may be written against any part of the project. Whether a given test is warranted is the agent's decision, weighed on risk, complexity, and the criticality of the requirement it serves. Where a test is warranted, it is written before the code that satisfies it.

Every new or changed test must be **seen failing first**. If a test is written against existing functionality, exercise it against a deliberately broken mock of that functionality first, and iterate the mock until every assertion has been shown to fail at least once. The mock lives separately from the real code — a stub, fake, or injected double — and the real code is never edited to produce the failure. Discard the mock once the test is verified; it must never reach a commit.

- Write the test, run it, keep the failure output.
- The failure must be the *intended* one — an assertion on real behaviour, not an import, syntax, collection, or fixture error. Those mean the test is broken.
- A test that never fails proves nothing. Fix the test, not the code.
- Then implement (or point the test back at the real code), re-run, confirm it passes and breaks nothing else.
- Bug fixes start with a test that reproduces the bug.

State the observed failure and the subsequent pass when reporting verification. An agent that cannot show a test failing has not tested it.

## Threads

When a change needs clarification or discussion, the agent opens a thread instead of asking the operator directly, tells the operator in chat which threads need attention, and continues with work that doesn't depend on them. `specs/threads/T-0001-thread-format-example.md` is the reference example of the format; read it before writing your first thread.

### Files

Each thread is `specs/threads/<S>-<NNNN>-<slug>.md`. `NNNN` is a stable ID, never reused; cite threads by ID (`thread 0029`), never by filename. A new thread takes one above the highest ID in use (`ls specs/threads | cut -d- -f2 | sort -n | tail -n1`). If a merge yields two threads with one ID, the thread created first keeps it and the other takes the next free ID; whoever merges updates every `links` entry and citation that meant the renumbered thread.

`S` is the state, changed only by `git mv`:

| S | State | Meaning |
|---|-------|---------|
| `A` | Active | under discussion |
| `D` | Deferred | parked by the operator |
| `R` | Resolved | decided by the operator, not yet applied |
| `T` | Terminal | applied to specs, implemented and verified |
| `X` | Cancelled | withdrawn or superseded |

### Rules

- One question starts each thread. Facts go into specs or `docs/`, not threads.
- A thread is frontmatter (`id`, `affects`, `tags`, `links`), then `## Outcome`, then `## Thread`, which is always last. `affects` lists the specs and paths the decision touches; it is how the thread is found later.
- `## Outcome` is written when the thread becomes `R`; `A` and `D` threads have none. It is self-contained: the decision, each rejected alternative with its reason, and when to reopen. An agent must be able to apply it to specs without reading the thread.
- In `## Thread`, agent turns are `>` blockquotes and operator turns are plain text. Never edit operator text; only append.
- Answer every operator turn with a quoted block, even if only to say you are holding.
- State your reading of a terse or ambiguous answer and get it confirmed before applying it.
- Only the operator decides, defers or cancels, and does so explicitly ("decided", "defer", "cancel"), in the thread or in chat. Confirming your reading of an answer is not a decision; if unsure whether one was made, ask. Rename to match, and record a decision made in chat as a quoted turn.
- Threads are versioned in every state: commit a thread whenever you create, answer or rename it, on its own or with the change it belongs to.
- Before opening a thread, search existing threads and cite one instead of re-asking. To revisit an `R`, `T` or `X` thread, open a new one with `links: {supersedes: NNNN}`.

### Finding Decisions

List threads whose header or outcome mention a spec, path or tag, then read just that part:
- `for f in specs/threads/*.md; do awk '/^## Thread/{exit} 1' "$f" | grep -q '<term>' && echo "$f"; done`
- `awk '/^## Thread/{exit} 1' <file>`

### Sweep

At session start, and whenever the operator says threads are updated:

1. List threads awaiting a response (last non-blank line is operator text):
   `for f in specs/threads/*.md; do l=$(grep -v '^[[:space:]]*$' "$f" | tail -n1); case $l in '>'*|'## Thread') ;; *) echo "$f";; esac; done`
2. Respond to each, and rename as the operator decided.
3. Apply each `R` thread through the change process.
4. Report in chat: threads handled, and threads awaiting the operator.

## Operations

Agents keep this entire document in their context window, via an include directive in `AGENTS.md` or equivalent, so they never need to re-read it. Never change `00-meta.md` without explicit instruction; if you find it problematic, open a thread.

Use `ls specs` to map the domains, then implement from the relevant specs.

### Change Process

Before starting, scope the work: if the change touches more than one separable concern, divide it into independent activities now — splitting at commit time is too late. If scoping raises questions for the operator, open threads.

For each activity:

- Review relevant specifications to form an implementation plan.
- Determine which specifications need to change — always consider requirements first — and read the threads that affect them.
- Update specifications as positive statements of intent, within the [line limits](#structure). When a spec is renamed, split or refined, update `affects` in every thread that lists it.
- Make changes to project files.
- Verify (automated tests — see [Automated Tests](#automated-tests) — agent tests, UAT, etc.) and correct as needed.
- Commit specs, project files and any thread the change applies (renamed to `T`) together. The commit message is a label — one short sentence, no rationale; the rationale lives in the spec changes and the thread. If you cannot label the commit in one sentence, the spec changes are not clear enough yet; clarify them before committing. A change is not complete until it is committed.
