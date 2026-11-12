---
name: streamlit-app-review
description: Reviews a Streamlit app for slow reruns, missing caching, session state bugs, secrets handling and layout problems, and proposes fixes. Use when the user asks to review, speed up, debug or harden a Streamlit dashboard or data explorer.
---

# Streamlit app review

Review the app the user points to (usually `app.py` or a `pages/` folder) against `checklist.md` and return fixes as code.

## Steps

1. Find the entry point. Look for `streamlit run` in the README, a `Procfile`, or a file that imports `streamlit`. Read it and every page it loads.
2. Note the Streamlit version from `requirements.txt` or `pyproject.toml`. Only suggest APIs that exist in that version. If the version is unpinned, say so as a finding.
3. Go through `checklist.md` section by section.
4. Report findings ranked by user impact: crashes and wrong data first, then speed, then polish.

## Output format

```
### <n>. <title>  (bug | speed | security | polish)
File: <path>:<line>
Problem: <what happens to the user>
Fix:
<code>
```

## Rules

- Do not rewrite the whole app. Suggest the smallest change that fixes each problem.
- Never print secret values in the review, even if they are hard-coded. Say where the secret is and how to move it to `st.secrets`.
- When suggesting `st.cache_data`, state what the cache key depends on and when it should expire (`ttl`).
