# Bugfix Requirements Document

## Introduction

The global error handler in `src/index.ts` returns `{ error: ... }` while most endpoint-level handlers return `{ success: false, message: ... }`. This inconsistency means API consumers receive different response shapes depending on whether an error is caught locally or bubbles up to the global handler. Additionally, the global handler forwards `err.message` directly to clients for unhandled errors, which can expose internal implementation details or stack traces.

The fix standardizes all error responses to `{ success: false, message: ... }` and ensures that unexpected (500-level) errors return a generic client message while the full error details are logged server-side.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an unhandled error reaches the global error handler THEN the system returns `{ error: err.message }` instead of the standard `{ success: false, message: ... }` shape used by other endpoints

1.2 WHEN an unexpected (non-operational) error reaches the global error handler THEN the system sends `err.message` directly to the client, potentially leaking internal implementation details

### Expected Behavior (Correct)

2.1 WHEN an unhandled error reaches the global error handler THEN the system SHALL return a response with the shape `{ success: false, message: ... }` consistent with all other error responses in the API

2.2 WHEN an unexpected (non-operational) error (status 500) reaches the global error handler THEN the system SHALL return a generic message `"An unexpected error occurred"` to the client and SHALL log the full error details server-side

2.3 WHEN a known/operational error (status < 500) reaches the global error handler THEN the system SHALL return the descriptive `err.message` in the `message` field of the standardized response shape

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a known operational error is caught locally within a controller THEN the system SHALL CONTINUE TO return `{ success: false, message: ... }` with the appropriate HTTP status code

3.2 WHEN a successful request is processed THEN the system SHALL CONTINUE TO return the existing success response shape unchanged

3.3 WHEN the global error handler sets the HTTP status code THEN the system SHALL CONTINUE TO use `err.status` (or `err.statusCode`) when present, falling back to 500 for unknown errors

---

## Bug Condition

**Bug Condition Function:**
```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ErrorHandlerInput { err: Error, hasStatus: boolean }
  OUTPUT: boolean

  // Triggers when any error reaches the global handler
  RETURN true
END FUNCTION
```

**Property: Fix Checking**
```pascal
FOR ALL X WHERE isBugCondition(X) DO
  result ← globalErrorHandler'(X)
  ASSERT result.body.success = false
  ASSERT result.body.message IS DEFINED
  ASSERT result.body.error IS UNDEFINED
  IF X.err.status >= 500 OR X.err.status IS UNDEFINED THEN
    ASSERT result.body.message = "An unexpected error occurred"
    ASSERT serverLog CONTAINS X.err.message
  ELSE
    ASSERT result.body.message = X.err.message
  END IF
END FOR
```

**Property: Preservation Checking**
```pascal
FOR ALL X WHERE NOT isBugCondition(X) DO
  // Controller-level error handling and success responses are unaffected
  ASSERT F(X) = F'(X)
END FOR
```
