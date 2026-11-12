---
name: fastapi-model-endpoint
description: Adds a model-serving prediction endpoint to a FastAPI service, with typed request and response schemas, input validation, a health check, model loading at startup and tests. Use when the user asks to serve, expose or deploy a trained model behind an API, or to add a predict endpoint to a FastAPI app.
---

# FastAPI model endpoint

Add a production-ready `/predict` endpoint to the user's FastAPI service, based on the templates in `templates/`.

## Before writing code, find out

1. Where the model artifact lives and how it loads (joblib, pickle, MLflow, ONNX). Look in the repo first.
2. The exact input features and their types. Read the training code or a feature list; do not invent features.
3. What the model returns (class, probability, score) and what the caller needs.

Ask the user only for what you cannot find.

## Steps

1. Read `templates/main.py.tmpl` and `templates/test_main.py.tmpl`.
2. Adapt them to the user's project: real feature names and types in `PredictRequest`, real output in `PredictResponse`, the real loader in `load_model`.
3. If the service already has a `main.py` or an app factory, add the router to it instead of creating a second app.
4. Write the tests and run them with `pytest` if a Python environment is available.
5. Tell the user how to run it locally (`uvicorn <module>:app --reload`) and what the example request looks like.

## Rules

- Load the model once at startup (lifespan handler), never per request.
- Every request field has a type and, where it makes sense, bounds (`Field(ge=0)`). Reject bad input with 422, never with a 500.
- Include a `model_version` in every response so callers can trace predictions.
- `/health` returns 200 only when the model is loaded.
- Do not log raw request payloads; they may contain personal data. Log a request ID and timing.
- Keep the endpoint synchronous (`def`, not `async def`) if prediction is CPU-bound, so FastAPI runs it in a thread pool.
