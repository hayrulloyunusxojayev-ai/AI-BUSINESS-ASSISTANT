import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import analyzeRouter from "./analyze";
import webhookRouter from "./webhook";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(analyzeRouter);
router.use(webhookRouter);

export default router;
