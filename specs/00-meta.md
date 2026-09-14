# Meta Specifications

*Explanatory document for the use of `specs/`*
*See `Geordi7/specsify` on github*

`specs/` contains specifications and user test scripts as markdown (`.md`) files.
- *specifications* describe *intended* behaviour, design decisions, and standards expected to be followed
- *directives* (like `agents.md` or `claude.md`) describe how to work on the project
- *code comments* should be reserved for local non-obvious logic and references to specifications

In these documents an *actor* is either a human or an AI agent.

## Structure

Specs are defined across a tree of files located in this directory. A directory listing (ls) must be sufficient to get a sense of how the project is specified. The goal is to have a coherent traversible set of specifications that an agent can pull from to get the context it needs. Specs are organized into top level 'domains' and 'refinements' and 'test suites' below them.

**CRITICAL:** Spec files must never exceed 150 lines. Once a domain grows beyond what is manageable in 150 lines, it must be split into refinements.

**CRITICAL:** Root domain specs for refined domains must never exceed 50 lines. A domain with refinements must have inline summaries for the refinements in its root domain file, and leave all detail to the refinements. Keep only *the most critical or globally applicable information* in the root.

### Base

Specs are defined in terms of domains which are numbered starting at zero. Throughout this document `##` denotes a zero-padded two-digit number (e.g., `02`, `03`). Every domain has a root file and may have refinements, the two required domains are:

| Domain File | Purpose |
|-------------|---------|
| `00-meta.md` | this file, describes how to operate in a specs driven project |
| `01-requirements.md` | primary design drivers for the project |

### Expansion

Thereon domains are defined as needed using the `##-lower-kebab-case` convention. Most projects will need these:

| Domain File | Purpose |
|-------------|---------|
| `02-architecture.md` | technical design and key decisions: components, stacks, interfaces, deployment |
| `03-data-model.md` | structure of data and key persistence decisions |

And other recommended domains are:

| Domain File | Purpose |
|-------------|---------|
| `##-security-standard.md` | Capture explicit security related configuration constraints or requirements |
| `##-design.md` | Capture external surface (UI or API) constraints and design |
| `##-testing.md`| Capture testing strategy and tools (not for specific tests) |
| `##-user-experience.md` | Capture constraints and design for intended user experience |

### Refinement

Once a domain is sufficiently large it should be split into refinements using the `##-##-sub-domain.md` convention. These can be further refined using `##-##-##-sub-sub-domain.md` and so on... Once a domain is refined parent files should become minimal summaries for their refinements so as not to pollute agent contexts. Some examples:

Given `02-architecture.md` which contains short descriptions of the following:
- `02-00-modules-components.md`
- `02-01-coding-standard.md`
- `02-02-persistence-layer.md`
- `02-03-application-nodes.md`

### Test Scripts

Test scripts follow their own naming convention — see [Test Scripts](#test-scripts) below.

## QA and Observations

QA activities record observations **in-situ** in the relevant specification file using HTML comments. An observation is invisible when the markdown is rendered but greppable in source, so it annotates the spec without disturbing its prose or its block quotes.

Observations are placed **immediately after the section or statement they refer to**, never floating at the top of a file. Multiple observations on the same thing stack in chronological order. Attribution is not needed - git blame is the source of truth.

### Observation conventions

Two forms, distinguished only by an optional `CR` tag:

Plain observation - anything an implementer should look at (works but awkward, doesn't work, a question, a comment). Resolve by fixing the code, or the spec, as appropriate:

  <!-- OBS: ...observations -->

Change Request - the *intended* behaviour is wrong; the spec itself must change first:

  <!-- OBS CR: ...observations -->

*The examples above are INDENTED so that they do not show up in searches for observations, which anchor the marker to the start of the line. Natural observations MUST NOT be indented.*

### Resolution

Implementing actors search for observations and resolve each by fixing the source, then deleting the comment. No audit trail is kept in the specification files - git history is authoritative.

- **CR** - update the spec (and tests where applicable) to reflect the new intent, then update the code to match, then delete the observation.
- **plain** - fix the issue in code or spec as appropriate, then delete the observation.

If testing outside the context of a change, add a commit containing only the observations made by the testing actor.

## Test Suites

Any specification may be tested and have observations added as above. Additionally, specific **manual test suites** for test actors may be added using the convention `{}-T##-test-description.md`, where `{}` is the full address of the corresponding domain or refinement. For example, a test suite for `02-01-coding-standard.md` would be `02-01-T00-naming-rules.md`, and for the root `02-architecture.md` it would be `02-T00-smoke-test.md`. These should complement automated and agent tests, not replace them.

Do not liberally create test suites, expect that testers can perform most tests just by being prompted with the relevant specifications. Test suites are intended for functionality which is ultra-critical or requires precise actions in order to properly test.

## Operations

Agents operating in this project should always include this document in its entirety in their context window. Add relevant include-directives in AGENTS.md or equivalent. Agents can use the following tools to better navigate the specs:

### Specification Review

Use `ls specs` to get an map of the specification domains, those documents represent the intent of the project. Do not review `00-meta.md`, its contents should already be represented in your context. Never change `00-meta.md`, if you find it problematic discuss potential changes with a human operator.

### Change Process

Before starting, scope the work: if the change touches more than one separable concern,
divide it into independent activities now — splitting at commit time is too late.

For each activity:

- Review relevant specifications to form an implementation plan.
- Determine which specifications need to change — always consider requirements first.
- Update specifications as needed. Refine domains that exceed 150 lines; pare parent
  files to < 50 lines once refined.
- Make changes to project files.
- Verify (automated tests, agent tests, UAT, etc.) and correct as needed.
- Commit specs and project files together. The commit message is a label — one short
  sentence, no rationale. The rationale lives in the spec changes. If you cannot
  label the commit in one sentence, the spec changes are not clear enough yet; clarify
  them before committing. A change is not complete until it is committed.

### Operational Tools

Collect all observations using this command:

`grep -RIn --include='*.md' -E '^<!-- OBS' specs/`

Collect all observations WITH context using this command:

`grep -RIn -C 10 --include='*.md' -E '^<!-- OBS' specs/`

Collect only Change Requests using this command:

`grep -RIn --include='*.md' -E '^<!-- OBS CR' specs/`

Surface incorrectly indented observations using this command: (this will also show the examples in this file)

`grep -RIn --include='*.md' -E '<!-- OBS' specs/`
