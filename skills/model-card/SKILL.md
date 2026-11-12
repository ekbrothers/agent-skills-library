---
name: model-card
description: Writes or updates a model card for a trained machine learning model from its training code, evaluation results and data sources. Use when the user asks for a model card, model documentation, a model summary for review or governance, or wants to document a model before release.
---

# Model card

Write a model card in `docs/model-card.md` (or the path the user gives) using `templates/model-card.md`.

## Steps

1. Gather facts from the repo before writing anything:
   - Training code: algorithm, features, target, hyperparameters, random seed.
   - Data: source tables or files, date ranges, row counts, train and test split.
   - Evaluation: metric files, notebooks or experiment tracking output. Use the numbers that are actually recorded.
2. Fill in the template. For any field you could not find evidence for, write `TODO: <what is needed and who likely knows>` instead of guessing.
3. If a model card already exists, update it in place and keep anything a person wrote that you cannot verify is outdated.
4. Summarize at the end of your reply which fields are still TODO.

## Rules

- Every metric must name the dataset and date range it was computed on.
- Report metrics for each important segment when the data allows it (for example by region or product), not only the overall number.
- Write the "Limitations" and "Out of scope uses" sections even when nobody asked. They are the most useful part for reviewers.
- Plain language. A reviewer outside the team should understand the "Intended use" section.
