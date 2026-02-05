import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const PORT = Number(process.env.PORT || 3000);
const AI_BASE_URL_RAW = process.env.AI_BASE_URL || "https://api.deepseek.com/v1";
const AI_BASE_URL = AI_BASE_URL_RAW.endsWith("/") ? AI_BASE_URL_RAW.slice(0, -1) : AI_BASE_URL_RAW;
const AI_API_KEY = process.env.AI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || "deepseek-chat";

console.log("AI config:", { AI_BASE_URL, AI_MODEL, PORT });

if (!AI_API_KEY) {
  console.error("Missing AI_API_KEY in server/.env");
  process.exit(1);
}

function stylePrompt(style) {
  if (style === "bullets") return "Return exactly 5 bullet points. Use • bullets.";
  if (style === "study") return "Return structured study notes with headings, key terms, and numbered points.";
  return "Return a short paragraph summary (4–6 sentences).";
}

async function callAI(prompt) {
  const url = `${AI_BASE_URL}/chat/completions`;

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: "You write clear, accurate summaries. Do not invent facts." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3
    })
  });

  const raw = await r.text();
  if (!r.ok) throw new Error(raw);

  const data = JSON.parse(raw);
  return (data.choices?.[0]?.message?.content || "").trim();
}

app.post("/summarize", async (req, res) => {
  try {
    const text = String(req.body?.text || "").slice(0, 30000);
    const style = String(req.body?.style || "bullets");

    const prompt =
      `Summarize the following content.\n` +
      `${stylePrompt(style)}\n\n` +
      `CONTENT:\n${text}`;

    const summary = await callAI(prompt);
    res.json({ summary });
  } catch (e) {
    res.status(500).send(String(e?.message || e));
  }
});

app.listen(PORT, () => {
  console.log(`AI server running on http://localhost:${PORT}`);
});
