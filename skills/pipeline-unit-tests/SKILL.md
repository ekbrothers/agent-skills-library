---
name: pipeline-unit-tests
description: Writes pytest unit tests for data transformation code (pandas, Polars or PySpark functions), using small hand-built input frames and explicit expected outputs. Use when the user asks to test a data pipeline, a feature engineering function, a transform, or wants test coverage for ETL code.
---

# Pipeline unit tests

Write focused pytest tests for the transform functions the user points to. Follow the patterns in `patterns.md`.

## Steps

1. Read the target functions and anything they call. List each function's inputs, outputs and the business rules it implements.
2. Check how the repo already tests code (folder, fixtures, naming). Match it. If there are no tests yet, use `tests/test_<module>.py`.
3. For each function, write tests for:
   - The normal case, with a three to six row input frame built in the test.
   - Each business rule, one test per rule, named after the rule.
   - Edge cases: empty input, nulls in every input column the function reads, duplicate keys, and boundary values.
4. Run the tests if a Python environment is available. Fix tests that fail because of a mistake in the test. If a test fails because the code is wrong, keep the test, mark it `xfail` with a reason, and tell the user.

## Rules

- Build inputs inline in the test. Do not read production data or large fixture files.
- Assert on whole frames with the library's frame-equality helper, not on a few cells.
- Make column order and dtypes explicit in expected frames, so a dtype change fails loudly.
- Do not mock the dataframe library. Mock only I/O (warehouse reads, file writes, HTTP).
- One behavior per test. Test names describe the rule: `test_lapsed_policies_are_excluded`, not `test_transform_2`.
