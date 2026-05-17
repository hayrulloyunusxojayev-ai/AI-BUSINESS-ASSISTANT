import { openai } from "@workspace/integrations-openai-ai-server";
import type { Product } from "./store-db";

// ── Customer reply AI ────────────────────────────────────────────────────────

function buildSalesSystemPrompt(products: Product[]): string {
  const base = `Siz tajribali savdo bo'yicha maslahatchisiz. Tadbirkor sizga mijozning xabarini yuboradi. Sizning vazifangiz — har doim ikkita narsani qaytarish:

1) "reply" — mijozga yuborish uchun tayyor, qisqa, tabiiy va savdoga yo'naltirilgan javob (1-3 ta jumla). Mijozning tilida (o'zbek, rus yoki inglizcha) yozing. Faqat suhbatlashmang — mijozni xaridga yaqinlashtirishga harakat qiling.

2) "guidance" — tadbirkor uchun aniq keyingi qadam, bitta qisqa jumla. Misollar:
- "Mijoz qiziqish bildirmoqda — yetkazib berish shartlarini taklif qiling."
- "O'lcham yoki rangni aniqlang."
- "Hozir chegirma bilan xaridni yopishga harakat qiling."
- "Mijoz ikkilanmoqda — afzalliklarni qisqa eslating."

Har bir javob shu savolga aniq javob bersin: "Bu mijozni xaridga olib kelish uchun nima qilish kerak?"

Faqat JSON qaytaring, hech qanday qo'shimcha matnsiz:
{"reply": "...", "guidance": "..."}`;

  if (products.length === 0) return base;

  const catalog = products
    .map((p, i) => {
      let line = `${i + 1}. ${p.name} — ${p.price}`;
      if (p.size) line += ` | O'lcham: ${p.size}`;
      if (p.description) line += ` | ${p.description}`;
      return line;
    })
    .join("\n");

  return `${base}\n\nDo'kon mahsulotlari (faqat shu mahsulotlar haqida gapiring):\n${catalog}`;
}

export type AnalysisResult = {
  reply: string;
  guidance: string;
};

export async function analyzeCustomerMessage(
  message: string,
  products: Product[] = [],
): Promise<AnalysisResult> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: buildSalesSystemPrompt(products) },
      { role: "user", content: message },
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content ?? "{}";
  let parsed: { reply?: unknown; guidance?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Invalid AI response JSON");
  }

  const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
  const guidance = typeof parsed.guidance === "string" ? parsed.guidance.trim() : "";

  if (!reply || !guidance) throw new Error("Incomplete AI response");
  return { reply, guidance };
}

// ── Product catalog parser AI ────────────────────────────────────────────────

const PARSE_SYSTEM_PROMPT = `You are a product catalog extractor for an e-commerce business. 
Extract ALL products, prices, sizes, and descriptions from the raw text provided by the user.
Return ONLY a valid JSON object in this exact format:
{"products": [{"name": "...", "price": "...", "description": "...", "size": "..."}]}
Rules:
- "name" is required. "price" is required.
- "size" and "description" are optional — omit them if not mentioned.
- Keep prices as strings (e.g. "450 000 so'm", "45$", "890 000").
- Extract every distinct product you can find.
- Do NOT add products that are not in the text.`;

export async function parseProductsFromText(rawText: string): Promise<Product[]> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: PARSE_SYSTEM_PROMPT },
      { role: "user", content: rawText },
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content ?? "{}";
  let parsed: { products?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("AI returned invalid JSON");
  }

  if (!Array.isArray(parsed.products)) throw new Error("No products array in AI response");

  return (parsed.products as Product[]).filter(
    (p): p is Product =>
      typeof p === "object" && p !== null && typeof p.name === "string" && typeof p.price === "string",
  );
}
