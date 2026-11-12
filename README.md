# Agent skills library

Shared agent skills for Claude Code, GitHub Copilot and Cortex Code. The Prompt Library VS Code extension installs them into workspaces and keeps them updated.

## Skills

| Skill | Version | What it does |
| --- | --- | --- |
| `data-quality-check` | 1.1.0 | Profile a dataset for nulls, duplicates, bad types and leakage. Ships a Python profiler script. |
| `fastapi-model-endpoint` | 1.2.0 | Add a typed, tested `/predict` endpoint with a health check to a FastAPI service. |
| `model-card` | 1.0.0 | Write or update a model card from training code, data sources and recorded metrics. |
| `pipeline-unit-tests` | 1.0.0 | Write pytest tests for pandas, Polars or PySpark transforms. |
| `snowflake-sql-review` | 1.0.0 | Review Snowflake SQL for fan-out joins, wasted scans and pruning problems. |
| `streamlit-app-review` | 1.0.0 | Find slow reruns, caching gaps and exposed secrets in a Streamlit app. |

## Layout

```
skills/<id>/
  SKILL.md        required; frontmatter "name" must equal <id>
  item.json       required; title, summary, version, tools (not shipped)
  scripts/        optional; anything here marks the item as containing scripts
  ...             any other supporting files
tooling/          build, validation and tests (Node 22+, no dependencies)
```

`item.json`:

```json
{
  "title": "Data quality check",
  "summary": "One line shown in the extension's tree view, up to 120 characters.",
  "version": "1.1.0",
  "tools": ["claude", "copilot", "cortex"]
}
```

## Adding or changing a skill

1. Create or edit `skills/<id>/`. The id uses lowercase letters, digits and single hyphens, up to 64 characters. VS Code silently skips skills that break this rule.
2. Bump `version` in `item.json` whenever any shipped file changes. CI fails if content changes without a bump.
3. Run `npm test` and `npm run check`.
4. Open a pull request. Merging to `main` publishes a release.

House rules for skill content: no emojis, no em-dashes or en-dashes, no company names. The build rejects the first two.

## How releases work

On every push to `main` that touches `skills/` or `tooling/`, the release workflow:

1. Downloads `index.json` from the latest release.
2. Validates every skill and fails on a missing version bump or a version that went backwards.
3. Builds one reproducible `<id>-<version>.tar.gz` per skill and a new `index.json` with sha256 hashes.
4. Creates a release tagged `content-<date>-<run>` and marks it latest. If nothing changed, it skips the release.

The extension fetches `index.json` from the latest release, compares it with the workspace lock file, and downloads only the archives it needs, verifying each sha256 before writing.

## Commands

```
npm test        unit tests for the tooling, plus validation of every real skill
npm run check   validate skills only
npm run build   write dist/ (archives, index.json, release notes)
```
