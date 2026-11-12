---
name: snowflake-sql-review
description: Reviews Snowflake SQL for correctness, cost and performance, including joins that fan out, full scans, missing filters on large tables, non-sargable predicates and warehouse sizing. Use when the user asks to review, optimize, speed up or reduce the cost of a Snowflake query, view, dbt model or stored procedure.
tools:
- sql_execute
---

# Snowflake SQL review

Review the query the user points to and return concrete, ranked suggestions with rewritten SQL.

## Steps

1. Get the SQL. If the user named a file, read it. If they named a view or dbt model, find its definition. Ask only if you cannot find it.
2. Read `review-guide.md` and apply each rule that is relevant.
3. If you can run SQL (for example through `sql_execute` in Cortex Code), you may run `EXPLAIN` on the query to confirm partition pruning and join order. Never run the query itself against production data without asking, and never run DML or DDL.
4. Report findings in this order: correctness first, then cost, then readability.

## Output format

For each finding:

```
### <n>. <short title>  (correctness | cost | readability)
Why: <one or two sentences, cite the line or CTE>
Fix:
<rewritten SQL fragment>
```

End with the full rewritten query only if more than two findings change it.

## Rules

- Correctness problems always come first, even if minor. A fast wrong answer is worse than a slow right one.
- Do not suggest clustering keys for tables under roughly 1 TB. Say so if the user asks.
- Do not change results silently. If a rewrite could change row counts (for example replacing `UNION` with `UNION ALL`), call it out.
- Keep the user's naming and formatting style.
