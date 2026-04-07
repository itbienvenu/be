import { Ajv } from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true, strict: false });
// @ts-expect-error
addFormats(ajv);

import jobSchema from "@/modules/job/job.schema.json" with { type: "json" };
import jobExample from "@/modules/job/job.json" with { type: "json" };

const validate = ajv.compile(jobSchema);

const valid = validate(jobExample);
if (!valid) {
    console.log("Validation errors:", validate.errors);
} else {
    console.log("Job is valid");
}