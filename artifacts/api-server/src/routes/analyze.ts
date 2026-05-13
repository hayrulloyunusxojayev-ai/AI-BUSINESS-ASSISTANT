import { Router } from "express";
import { analyzeCustomerMessage } from "../lib/ai";
import { getSessionUserId } from "../lib/session";

const router = Router();

router.post("/analyze", async (req, res) => {
  const userId = await getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Avval tizimga kiring" });
    return;
  }

  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) {
    res.status(400).json({ error: "Mijoz xabarini kiriting" });
    return;
  }
  if (message.length > 4000) {
    res.status(400).json({ error: "Xabar juda uzun (maksimal 4000 belgi)" });
    return;
  }

  try {
    const result = await analyzeCustomerMessage(message);
    res.json(result);
  } catch (error) {
    req.log.error({ error: String(error) }, "Analyze error");
    res.status(500).json({ error: "Tahlil qilishda xato yuz berdi. Qayta urinib ko'ring." });
  }
});

export default router;
