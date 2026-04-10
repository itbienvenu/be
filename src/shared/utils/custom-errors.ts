export class ValidationError extends Error {
    statusCode: number;
    reason?: any;

    constructor(message: string, reason?: any) {
        super(message);
        this.name = "ValidationError";
        this.message = message;
        this.statusCode = 400;
        this.reason = reason;
    }
}

export class ConflictError extends Error {
    statusCode: number;
    reason?: any;

    constructor(message: string, reason?: any) {
        super(message);
        this.name = "ConflictError";
        this.message = message;
        this.statusCode = 409;
        this.reason = reason;
    }
}

export class NotFoundError extends Error {
    statusCode: number;
    reason?: any;

    constructor(message: string, reason?: any) {
        super(message);
        this.name = "NotFoundError";
        this.message = message;
        this.statusCode = 404;
        this.reason = reason;
    }
}

export class UnauthorizedError extends Error {
    statusCode: number;
    reason?: any;

    constructor(message: string, reason?: any) {
        super(message);
        this.name = "UnauthorizedError";
        this.message = message;
        this.statusCode = 401;
        this.reason = reason;
    }
}

export class ForbiddenError extends Error {
    statusCode: number;
    reason?: any;

    constructor(message: string, reason?: any) {
        super(message);
        this.name = "ForbiddenError";
        this.message = message;
        this.statusCode = 403;
        this.reason = reason;
    }
}

export class InternalServerError extends Error {
    statusCode: number;
    reason?: any;

    constructor(message: string, reason?: any) {
        super(message);
        this.name = "InternalServerError";
        this.message = message;
        this.statusCode = 500;
        this.reason = reason;
    }
}

export class ServiceError extends Error {
    statusCode: number;
    reason?: any;

    constructor(message: string, reason?: any) {
        super(message);
        this.name = "ServiceError";
        this.message = message;
        this.statusCode = 500;
        this.reason = reason;
    }
}

export class InvalidTokenError extends Error {
    statusCode: number;
    reason?: any;

    constructor(message: string, reason?: any) {
        super(message);
        this.name = "InvalidTokenError";
        this.message = message;
        this.statusCode = 401;
        this.reason = reason;
    }
}