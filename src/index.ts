import "./instrument.js";
import express, { type Request, type Response, type NextFunction } from 'express';
import "dotenv/config";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import * as Sentry from "@sentry/node";
import v1 from "./routes/v1.js";
import { swaggerSpec } from "./docs/swagger.js";
import { requestLogger } from './shared/middleware/request-logger.middleware.js';
import logger from './shared/utils/logger.js';
import { initIndexes } from './init-indexes.js';

// ── Startup environment guard ─────────────────────────────────────────────────
// Fail fast before binding the port so misconfigured deployments are obvious.
const REQUIRED_ENV_VARS = [
  "JWT_SECRET",
  "REFRESH_SECRET",
  "MONGODB_URI",
  "GEMINI_API_KEY",
];

const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error(`[STARTUP] Missing required environment variables: ${missing.join(", ")}`);
  console.error("[STARTUP] Server will not start. Set the missing variables and restart.");
  process.exit(1);
}

const app = express();

// Security Hardening
app.use(helmet());
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per `window`
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: "Too many requests from this IP, please try again after 15 minutes." }
});
app.use(limiter);

// CORS — restrict origins in production, but allow all in development for ease of use.
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];
app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production";
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

app.use(express.json({ type: "application/json" }));
app.use(requestLogger);

const port = process.env.PORT ?? 3001;

app.use("/api/v1", v1);

// Swagger UI — interactive API docs at /api/v1/docs
app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: "Umurava API Docs",
  swaggerOptions: { persistAuthorization: true }
}));

app.get('/api/v1/docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.get('/', (req, res) => {
  res.json({ message: 'Umurava Recruitment API', version: 'v1', base: '/api/v1' });
});

app.get('/health', (req, res) => {
  res.send('OK');
});


// Error handling

Sentry.setupExpressErrorHandler(app);


app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.message || 'Internal Server Error', { stack: err.stack });
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

const server = app.listen(port, async () => {
  logger.info(`Server is running at http://localhost:${port}`);
  logger.info(`API v1 available at http://localhost:${port}/api/v1`);

  await initIndexes();
});

const shutdown = async (signal: string) => {
  logger.info(`[SHUTDOWN] Received ${signal}. Closing server and database...`);

  server.close(async () => {
    logger.info("[SHUTDOWN] HTTP server closed.");
    try {
      const { closeConnection } = await import("./config/database.js");
      await closeConnection();
      logger.info("[SHUTDOWN] Database connection closed. Exit successful.");
      process.exit(0);
    } catch (err) {
      logger.error("[SHUTDOWN] Error during database closure:", err);
      process.exit(1);
    }
  });

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    logger.error("[SHUTDOWN] Shutdown timed out. Force exiting...");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));


