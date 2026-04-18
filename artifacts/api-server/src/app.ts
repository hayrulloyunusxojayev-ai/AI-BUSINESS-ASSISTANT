import express, { type Express } from "express";
import path from "node:path";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// --- Логирование ---
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

// --- Middleware ---
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- API ---
app.use("/api", router);

// --- FRONTEND (Vite build) ---
const frontendPath = path.resolve(
  __dirname,
  "../../ai-business-agent/dist/public"
);

// раздаём статику
app.use(express.static(frontendPath));

// --- SPA fallback (ВАЖНО: без "*") ---
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api")) return next();

  res.sendFile(path.join(frontendPath, "index.html"));
});

export default app;
