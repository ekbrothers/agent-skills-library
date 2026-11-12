# Streamlit review checklist

## Speed

- Data loads and warehouse queries are wrapped in `st.cache_data` with a `ttl` that matches how fresh the data must be.
- Connections, models and other unpicklable resources use `st.cache_resource`, not `st.cache_data`.
- Cached functions take only hashable, small arguments. Passing a whole DataFrame as an argument makes every call hash it.
- Expensive work does not run at the top level on every rerun. Look for loops over large data outside cached functions.
- Widgets that trigger heavy recomputation sit inside `st.form` so the app reruns once on submit.
- Independent sections that refresh on their own use `st.fragment`.

## Correctness

- Every `st.session_state` key is initialized before it is read.
- Widget `key` values are unique and stable across reruns.
- Filters apply to the data actually shown. Check that charts and tables use the filtered frame.
- Empty results are handled with a message, not a stack trace.

## Security

- No credentials in code or committed config. Use `st.secrets` or environment variables.
- User input is never formatted into SQL strings. Use bound parameters.
- `unsafe_allow_html=True` is not used with user-provided content.

## Polish

- `st.set_page_config` is the first Streamlit call and sets a title and layout.
- Long operations show `st.spinner` or `st.status`.
- Numbers are formatted for people (thousands separators, sensible decimals, units).
