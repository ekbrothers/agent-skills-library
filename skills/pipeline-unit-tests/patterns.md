# Test patterns

## pandas

```python
import pandas as pd
import pandas.testing as pdt

from pipeline.transforms import active_policies


def test_lapsed_policies_are_excluded():
    df = pd.DataFrame(
        {
            "policy_id": [1, 2, 3],
            "status": ["active", "lapsed", "active"],
        }
    )
    expected = pd.DataFrame({"policy_id": [1, 3], "status": ["active", "active"]})

    result = active_policies(df).reset_index(drop=True)

    pdt.assert_frame_equal(result, expected)
```

## Polars

```python
import polars as pl
from polars.testing import assert_frame_equal


def test_premium_is_annualized():
    df = pl.DataFrame({"monthly_premium": [10.0, 0.0]})
    expected = pl.DataFrame({"monthly_premium": [10.0, 0.0], "annual_premium": [120.0, 0.0]})
    assert_frame_equal(annualize(df), expected)
```

## PySpark

Use one session per test run, and compare sorted collected rows.

```python
import pytest
from pyspark.sql import SparkSession


@pytest.fixture(scope="session")
def spark():
    return SparkSession.builder.master("local[1]").appName("tests").getOrCreate()


def test_dedupes_on_latest_update(spark):
    df = spark.createDataFrame(
        [(1, "2026-01-01", "a"), (1, "2026-02-01", "b")],
        ["id", "updated_at", "value"],
    )
    rows = sorted(latest_per_id(df).collect())
    assert [(r.id, r.value) for r in rows] == [(1, "b")]
```

## Edge case checklist

- Empty frame with the right columns returns an empty frame with the right columns.
- Nulls in key columns are dropped, kept or rejected, whichever the rule says. Test the rule.
- Duplicate keys: decide which row wins and assert it.
- Boundary dates (month end, leap day, time zone edges) for any date logic.
