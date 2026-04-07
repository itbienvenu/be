import { Ajv } from "ajv";
import addFormats from "ajv-formats";
import type { FormatsPlugin } from "ajv-formats";
import jobSchema from "@/modules/job/job.schema.json" with { type: "json" };

const ajv = new Ajv({ allErrors: true, strict: false });
(addFormats as unknown as FormatsPlugin)(ajv);

/**
 * Compiled validator for the Job JSON schema.
 * Compiling it once outside the function for performance.
 */
const validator = ajv.compile(jobSchema);

/**
 * Validates job data against the standard Job JSON Schema.
 * @param data The job data to validate
 * @returns An object containing the validation result and errors if any
 */
export function validateJob(data: any) {
    const isValid = validator(data);
    return {
        isValid,
        errors: validator.errors || null
    };
}