import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getSessionUserId } from "../lib/session";

const router = Router();

const SYSTEM_PROMPT = `Siz tajribali savdo bo'yicha maslahatchisiz. Tadbirkor sizga mijozning xabarini yuboradi. Sizning vazifangiz — har doim ikkita narsani qaytarish:

1) "reply" — mijozga yuborish uchun tayyor, qisqa, tabiiy va savdoga yo'naltirilgan javob (1-3 ta jumla). Mijozning tilida (o'zbek, rus yoki inglizcha) yozing. Faqat suhbatlashmang — mijozni xaridga yaqinlashtirishga harakat qiling.

2) "guidance" — tadbirkor uchun aniq keyingi qadam, bitta qisqa jumla. Misollar:
- "Mijoz qiziqish bildirmoqda — yetkazib berish shartlarini taklif qiling."
- "O'lcham yoki rangni aniqlang."
- "Hozir chegirma bilan xaridni yopishga harakat qiling."
- "Mijoz ikkilanmoqda — afzalliklarni qisqa eslating."

Har bir javob shu savolga aniq javob bersin: "Bu mijozni xaridga olib kelish uchun nima qilish kerak?"

Faqat JSON qaytaring, hech qanday qo'shimcha matnsiz:
{"reply": "...", "guidance": "..."}`;

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
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content || "{}";
    let parsed: { reply?: unknown; guidance?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("Invalid AI response JSON");
    }

    const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    const guidance = typeof parsed.guidance === "string" ? parsed.guidance.trim() : "";

    if (!reply || !guidance) {
      throw new Error("Incomplete AI response");
    }

    res.json({ reply, guidance });
  } catch (error) {
    req.log.error({ error: String(error) }, "Analyze error");
    res.status(500).json({ error: "Tahlil qilishda xato yuz berdi. Qayta urinib ko'ring." });
  }
});

export default router;
