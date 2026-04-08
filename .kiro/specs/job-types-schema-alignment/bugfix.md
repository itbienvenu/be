# Bugfix Requirements Document

## Introduction

`job.types.ts` defines the TypeScript types used to type AJV's `ValidateFunction<JobJSON>`, but several fields are declared as optional or nullable when the JSON schema marks them as required non-nullable properties. This means TypeScript accepts data at compile time that AJV will always reject at runtime, defeating the purpose of the generic type parameter.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a `Skill` object is constructed THEN the system allows `category`, `required`, `weight`, and `level` to be omitted or null, even though the schema requires all five fields as non-nullable strings/booleans/numbers with no additional properties.

1.2 WHEN a `Resource` object is constructed THEN the system allows `required` to be omitted, even though the schema requires both `name` and `required` with no additional properties.

1.3 WHEN a `Domain` object is constructed THEN the system allows `primary` to be omitted or null, even though the schema requires `primary` as a non-nullable string.

1.4 WHEN a `description` object is constructed THEN the system allows `summary` to be null, even though the schema defines `summary` as a plain string with no null variant.

1.5 WHEN an `ExperienceRequirement` object is constructed THEN the system allows `min_years` to be null, even though the schema defines `min_years` as a plain number with no null variant.

1.6 WHEN a `ScoringRules` object is constructed THEN the system allows `required_skills_must_match` and `min_experience_required` to be omitted, even though the schema marks both as required booleans with no additional properties.

1.7 WHEN `employment_type` or `seniority_level` is set THEN the system accepts any string or null, even though the schema constrains each to a specific enum and does not allow null.

1.8 WHEN the `Skill` type is used THEN the system allows a `level` value of `"basic"`, `"intermediate"`, or `"advanced"` only, but the schema imposes no enum constraint on `level` — just `"type": "string"` — so the TS enum is more restrictive than the schema.

### Expected Behavior (Correct)

2.1 WHEN a `Skill` object is constructed THEN the system SHALL require `category` as `string`, `required` as `boolean`, `weight` as `number`, and `level` as `string` — all non-optional and non-nullable.

2.2 WHEN a `Resource` object is constructed THEN the system SHALL require `required` as a non-optional `boolean`.

2.3 WHEN a `Domain` object is constructed THEN the system SHALL require `primary` as a non-optional, non-nullable `string`.

2.4 WHEN a `description` object is constructed THEN the system SHALL type `summary` as `string` (not `string | null`).

2.5 WHEN an `ExperienceRequirement` object is constructed THEN the system SHALL type `min_years` as `number` (not `number | null`).

2.6 WHEN a `ScoringRules` object is constructed THEN the system SHALL require both `required_skills_must_match` and `min_experience_required` as non-optional `boolean` fields.

2.7 WHEN `employment_type` or `seniority_level` is set THEN the system SHALL constrain each to its schema-defined enum (`"full_time" | "part_time" | "contract" | "temporary" | "internship"` and `"junior" | "mid" | "senior" | "lead" | "manager" | "director"` respectively) without allowing null.

2.8 WHEN a `Skill` object is constructed THEN the system SHALL type `level` as `string` (matching the schema's plain string constraint, not a narrower TS enum).

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a fully valid `JobJSON` object is constructed with all required fields THEN the system SHALL CONTINUE TO accept it without type errors.

3.2 WHEN `employment_type` or `seniority_level` is absent from a job object THEN the system SHALL CONTINUE TO allow the field to be omitted (both remain optional at the top-level `JobJSON`).

3.3 WHEN `requirements`, `skills`, `resources`, `responsibilities`, and `soft_skills` are absent THEN the system SHALL CONTINUE TO allow these optional top-level arrays/objects to be omitted.

3.4 WHEN `ExperienceRequirement.max_years` is null THEN the system SHALL CONTINUE TO accept it, as the schema explicitly allows `"type": ["number", "null"]` for that field.

3.5 WHEN `SoftSkill.weight` is provided THEN the system SHALL CONTINUE TO accept it as a plain `number` (schema has no null variant for this field either).
