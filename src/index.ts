import express, { type Request, type Response, type NextFunction } from 'express';
import swaggerUi from "swagger-ui-express";
import v1 from "./routes/v1.js";
import { swaggerSpec } from "./docs/swagger.js";
import { requestLogger } from './shared/middleware/request-logger.middleware.js';
import logger from './shared/utils/logger.js';

const app = express();
app.use(express.json());
app.use(requestLogger);

const port = process.env.PORT ?? 3001;

app.use("/api/v1", v1);

// Swagger UI — interactive API docs at /api/v1/docs
app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "Umurava API Docs",
    swaggerOptions: { persistAuthorization: true }
}));

// Raw OpenAPI JSON — useful for Postman import or frontend code generation
app.get("/api/v1/docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
});

app.get('/', (req, res) => {
  res.json({ message: 'Umurava Recruitment API', version: 'v1', base: '/api/v1' });
});

app.get('/health', (req, res) => {
  res.send('OK');
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.message || 'Internal Server Error', { stack: err.stack });
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

app.listen(port, () => {
  logger.info(`Server is running at http://localhost:${port}`);
  logger.info(`API v1 available at http://localhost:${port}/api/v1`);
});


