# Bugfix Requirements Document

## Introduction

`publishJob` in `job.repository.ts` performs an unconditional `updateOne` that sets `metadata.status` to `"published"` for any job owned by the recruiter, regardless of its current status. This means a job that is already `"published"` or `"archived"` can be "published" again silently, violating the intended strict `draft → published` state transition. The fix must add a `metadata.status: "draft"` filter to the update query and use `matchedCount` / `modifiedCount` from the result to return a clear, descriptive error for each failure case (job not found, wrong state, or success).

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `publishJob` is called with a valid job ID and recruiter ID and the job's `metadata.status` is `"published"` THEN the system updates the job's `metadata.updated_at` and returns success without error, silently re-publishing an already-published job.

1.2 WHEN `publishJob` is called with a valid job ID and recruiter ID and the job's `metadata.status` is `"archived"` THEN the system sets `metadata.status` back to `"published"`, allowing an invalid `archived → published` transition.

1.3 WHEN `publishJob` is called with a valid job ID and recruiter ID and the job's `metadata.status` is `"draft"` THEN the system sets `metadata.status` to `"published"` (this part is correct, but the absence of a status filter means the above cases are also accepted).

### Expected Behavior (Correct)

2.1 WHEN `publishJob` is called with a valid job ID and recruiter ID and the job's `metadata.status` is `"draft"` THEN the system SHALL set `metadata.status` to `"published"`, update `metadata.updated_at`, and return success.

2.2 WHEN `publishJob` is called with a valid job ID and recruiter ID and the job's `metadata.status` is NOT `"draft"` (e.g. `"published"` or `"archived"`) THEN the system SHALL throw a descriptive error indicating the job is not in a publishable state (e.g. `"Job is not in draft state and cannot be published"`).

2.3 WHEN `publishJob` is called with a job ID that does not exist or does not belong to the recruiter THEN the system SHALL throw a descriptive error indicating the job was not found (e.g. `"Job not found or you do not own this job"`).

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `publishJob` is called with an invalid (non-ObjectId) job ID THEN the system SHALL CONTINUE TO throw `"Invalid job ID"` without touching the database.

3.2 WHEN `patchJob` is called for any job regardless of status THEN the system SHALL CONTINUE TO apply the patch and return success as before (patch is not gated by status).

3.3 WHEN `getJobById`, `getAllJobs`, or `getJobsByRecruiter` are called THEN the system SHALL CONTINUE TO return job data with the same field projections and recruiter ownership checks as before.
