---
name: data-quality-check
description: Profiles a tabular dataset (CSV, Parquet, or a pandas DataFrame) and reports nulls, duplicates, type problems, out-of-range values and suspicious distributions. Use when the user asks to check, profile, validate or sanity-check data before training a model or shipping a pipeline.
---

# Data quality check

Produce a short, evidence-based data quality report. Every finding must cite the column and the numbers behind it.

## Steps

1. Identify the dataset. If the user did not name one, ask which file or DataFrame to check. Do not guess.
2. If the data is a local CSV or Parquet file and Python is available, run the bundled profiler:

   ```
   python scripts/profile.py <path-to-file> [--key <column>[,<column>...]]
   ```

   Pass `--key` when the user names a primary key or one is obvious (for example `policy_id`). The script prints JSON. Use it as the basis of the report.
3. If the script cannot run (no Python, data lives in a warehouse, or the data is a DataFrame in a notebook), write the equivalent checks in the user's environment instead. For SQL sources, follow the checks in `checklist.md` and write one query per check.
4. Work through `checklist.md` and mark each check as pass, warn or fail.
5. Write the report in the format below.

## Report format

```
## Data quality: <dataset name>
Rows: <n>  Columns: <n>  Key: <columns or "none">

| Check | Result | Detail |
| --- | --- | --- |
| ... | pass/warn/fail | column, numbers |

### Fix first
1. <highest-impact problem and a concrete fix>
```

Keep "Fix first" to at most three items, ordered by how badly each would hurt a model or a downstream consumer.

## Rules

- Never modify the source data. Suggest fixes as code the user can run.
- Treat a column that is more than 95 percent null as a fail unless the user says it is expected.
- Report duplicates on the key when there is one, and on full rows otherwise.
- If the dataset has more than 10 million rows, profile a random sample and say so in the report.
