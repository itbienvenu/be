# Bugfix Requirements Document

## Introduction

The AI job structuring service (`JobAIService.generateStructuredJob`) calls the Gemini API with a `generationConfig` that includes `temperature: 0` and `responseMimeType: "application/json"`, but it lacks a specified `responseSchema`. This means the model follows the prompt's JSON instructions but the output structure isn't strictly enforced at the API level. Furthermore, the system still uses a fragile regex-based extraction (`extractJSON`) instead of parsing the response directly. These factors contribute to occasional structural variations and make the pipeline less robust than it should be.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the same raw job description is submitted to `generateStructuredJob` THEN the system may still occasionally return JSON objects with differing field values or slight structural inconsistencies due to lack of strict schema enforcement at the API level.

1.2 WHEN the Gemini API is called with a `generationConfig` that lacks `responseSchema` THEN the system relies entirely on the model's internal instruction-following, which can fail to produce perfectly valid JSON matching the schema on every run.

1.3 WHEN the API returns a response THEN the system uses the regex-based `extractJSON` fallback to sanitize the output, which is fragile and can lead to silent failures or malformed data being passed to validation.

### Expected Behavior (Correct)

2.1 WHEN the same raw job description is submitted to `generateStructuredJob` on multiple runs THEN the system SHALL return structurally identical JSON output conforming to `job.schema.json`, with deterministic field values across runs.

2.2 WHEN the Gemini API is called THEN the system SHALL include a `generationConfig` with `temperature: 0`, `responseMimeType: "application/json"`, and a `responseSchema` derived from `job.schema.json`, enforcing structured output at the API level.

2.3 WHEN the API returns a structured JSON response THEN the system SHALL parse the response body directly as JSON without requiring regex-based extraction, eliminating the fragile `extractJSON` fallback path.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a valid raw job description is provided THEN the system SHALL CONTINUE TO return a `JobJSON` object that passes AJV validation against `job.schema.json`.

3.2 WHEN the Gemini API returns an error or non-OK HTTP status THEN the system SHALL CONTINUE TO log the error and return `null`.

3.3 WHEN the request exceeds the 20-second timeout THEN the system SHALL CONTINUE TO catch the `AbortError` and return `null`.

3.4 WHEN the API response contains no valid candidate content THEN the system SHALL CONTINUE TO return `null`.

3.5 WHEN `GEMINI_API_KEY` is not set in the environment THEN the system SHALL CONTINUE TO throw an error during `JobAIService` construction.
