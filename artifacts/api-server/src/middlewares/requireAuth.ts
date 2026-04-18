import type { Request, Response, NextFunction } from "express";
import { getSessionUserId } from "../lib/session";

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    (req as any).userId = userId;
    next();
  } catch (error) {
    next(error);
  }
};
