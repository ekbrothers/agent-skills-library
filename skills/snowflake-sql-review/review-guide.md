# Review guide

## Correctness

- **Join fan-out.** A join on a non-unique key multiplies rows. Check every join key against the grain of each side. Aggregates after a fan-out join are usually wrong.
- **NULL comparisons.** `col = NULL` is never true. `NOT IN (subquery)` returns nothing if the subquery yields a NULL; prefer `NOT EXISTS`.
- **Time zones.** Mixing `TIMESTAMP_NTZ` and `TIMESTAMP_TZ` or `TIMESTAMP_LTZ` silently shifts values. Make conversions explicit with `CONVERT_TIMEZONE`.
- **Integer division.** Snowflake division returns a decimal, but ratio columns built with `COUNT` can still round unexpectedly in `ROUND` or casts. Check the scale.
- **Deduplication.** Prefer `QUALIFY ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...) = 1` with a deterministic `ORDER BY` (add a tiebreaker column).

## Cost and performance

- **Select only needed columns.** `SELECT *` on wide tables reads every column's micro-partitions.
- **Filter early.** Push date filters into the CTE that reads the large table, not the final `SELECT`.
- **Sargable predicates.** Wrapping a filter column in a function (`TO_DATE(event_ts) = ...`) can defeat pruning. Compare the raw column to a range instead.
- **Avoid repeated scans.** The same large table read in several CTEs can often be read once.
- **`DISTINCT` as a fix.** A `DISTINCT` added to hide a fan-out is a correctness bug and a cost bug.
- **Warehouse size.** Larger warehouses help large scans and spills, not small point queries. Check the query profile for remote spilling before sizing up.

## Readability

- One CTE per logical step, named for what it holds (`active_policies`, not `cte2`).
- Explicit join types. Write `INNER JOIN`, not a comma join.
- Qualify every column with a table alias once more than one table is in scope.
