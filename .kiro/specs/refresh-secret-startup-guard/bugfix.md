# Bugfix Requirements Document

## Introduction

`REFRESH_SECRET` is now a required environment variable because every login call generates a refresh token via `jwt.sign()`. When `REFRESH_SECRET` is absent from the environment, `jwt.sign()` throws at runtime and the login endpoint returns a 500 error instead of a meaningful failure. The same silent failure applies to `JWT_SECRET`. The fix introduces a startup guard that validates all required secrets before the server begins accepting requests, so misconfiguration is caught immediately with a clear log message rather than surfacing as a cryptic 500 during the first login attempt.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `REFRESH_SECRET` is not set in the environment AND a login request is made THEN the system throws an unhandled error inside `generateRefreshToken` and returns a 500 response to the client.

1.2 WHEN `JWT_SECRET` is not set in the environment AND a login or token-refresh request is made THEN the system throws an unhandled error inside `generateAccessToken` or `verifyAccessToken` and returns a 500 response to the client.

1.3 WHEN either `REFRESH_SECRET` or `JWT_SECRET` is missing THEN the system starts successfully and gives no indication of misconfiguration until the first affected request arrives.

### Expected Behavior (Correct)

2.1 WHEN `REFRESH_SECRET` is not set at startup THEN the system SHALL log a descriptive error message identifying the missing variable and exit the process before binding to any port.

2.2 WHEN `JWT_SECRET` is not set at startup THEN the system SHALL log a descriptive error message identifying the missing variable and exit the process before binding to any port.

2.3 WHEN all required secrets are present at startup THEN the system SHALL start normally without any additional delay or side effects.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN all required environment variables are set AND a valid login request is made THEN the system SHALL CONTINUE TO return a successful login response containing both `accessToken` and `refreshToken`.

3.2 WHEN all required environment variables are set AND a valid refresh token is provided THEN the system SHALL CONTINUE TO return a new `accessToken`.

3.3 WHEN all required environment variables are set AND an invalid or expired refresh token is provided THEN the system SHALL CONTINUE TO return a 401 error response.

3.4 WHEN all required environment variables are set AND the server starts THEN the system SHALL CONTINUE TO bind to the configured port and serve all existing routes normally.
