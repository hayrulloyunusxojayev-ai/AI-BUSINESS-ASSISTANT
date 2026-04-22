import express, { type Express, type Request, type Response, type NextFunction } from "express";
import path from "node:path";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust the reverse proxy (Render, Replit) so req.protocol and cookies work correctly
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve frontend static files in production
const frontendPath = path.resolve(__dirname, "../../ai-business-agent/dist/public");
app.use(express.static(frontendPath));

// SPA fallback — serve index.html for all non-API GET routes
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(frontendPath, "index.html"));
});

// Global error handler — always redirect auth errors, never show raw 500
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error({ err: message, url: req.url }, "Unhandled server error");

  if (req.path.startsWith("/api/auth/google")) {
    res.redirect("/sign-in?error=google_failed");
    return;
  }

  res.status(500).json({ error: "Server xatosi yuz berdi" });
});

export default app;
