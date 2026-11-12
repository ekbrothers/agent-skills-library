# Data quality checklist

| # | Check | Fail when | Warn when |
| --- | --- | --- | --- |
| 1 | Row count | 0 rows | Fewer rows than the user expects |
| 2 | Key uniqueness | Any duplicate key | |
| 3 | Full-row duplicates | | More than 1 percent of rows |
| 4 | Nulls per column | More than 95 percent null | More than 20 percent null |
| 5 | Constant columns | | Only one distinct value |
| 6 | Types | Numbers or dates stored as text in more than 5 percent of rows | Mixed types in one column |
| 7 | Numeric ranges | Impossible values (negative age, probability above 1) | Values beyond 5 standard deviations |
| 8 | Dates | Dates in the future for event columns | Dates before 1900 |
| 9 | Categorical cardinality | | High-cardinality text that looks like an ID used as a feature |
| 10 | Target leakage | | A feature with near-perfect correlation to the target |

## SQL patterns

Duplicate keys:

```sql
SELECT key_col, COUNT(*) AS n
FROM my_table
GROUP BY key_col
HAVING COUNT(*) > 1
ORDER BY n DESC
LIMIT 20;
```

Null rate per column:

```sql
SELECT
  COUNT(*) AS total_rows,
  COUNT_IF(col_a IS NULL) / COUNT(*) AS col_a_null_rate,
  COUNT_IF(col_b IS NULL) / COUNT(*) AS col_b_null_rate
FROM my_table;
```
