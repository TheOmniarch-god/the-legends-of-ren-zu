// netlify/functions/ai-chat.js
//
// Server-side proxy for the "AI Scholar" feature.
// Keeps GROQ_API_KEY / GEMINI_API_KEY out of the browser bundle.
//
// Setup:
//   1. In the Netlify dashboard: Site settings → Environment variables, add
//        GROQ_API_KEY    = <your key from console.groq.com>      (optional)
//        GEMINI_API_KEY  = <your key from aistudio.google.com>   (optional)
//      At least one of the two should be set. Groq is tried first.
//   2. Redeploy the site (env vars only take effect on a new deploy).
//
// The browser calls POST /.netlify/functions/ai-chat with { message: "..." }
// and gets back { reply: "..." } or { error: "..." }.

const SYSTEM_PROMPT = `You are a sharp, philosophical scholar of the Legends of Ren Zu from the novel Reverend Insanity by Gu Zhen Ren. You speak with weight and precision — no flattery, no padding. Respond in 2–4 focused paragraphs. Reference the chapter text directly when relevant.`;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let message;
  try {
    message = JSON.parse(event.body || "{}").message;
  } catch (_) {
    return json(400, { error: "Invalid JSON body" });
  }

  if (!message || typeof message !== "string") {
    return json(400, { error: "Missing 'message' field" });
  }

  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!groqKey && !geminiKey) {
    return json(500, {
      error: "No AI provider configured. Set GROQ_API_KEY or GEMINI_API_KEY in Netlify environment variables."
    });
  }

  // ── Try Groq first (fast, generous free tier) ──────────────────────────
  if (groqKey) {
    try {
      const reply = await askGroq(message, groqKey);
      if (reply) return json(200, { reply });
    } catch (err) {
      console.error("Groq request failed:", err.message);
    }
  }

  // ── Fall back to Gemini ────────────────────────────────────────────────
  if (geminiKey) {
    try {
      const reply = await askGemini(message, geminiKey);
      if (reply) return json(200, { reply });
    } catch (err) {
      console.error("Gemini request failed:", err.message);
    }
  }

  return json(502, { error: "AI providers are currently unavailable. Please try again shortly." });
};

async function askGroq(message, key) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1100,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message }
      ]
    })
  });

  if (!res.ok) {
    throw new Error(`Groq returned ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim();
}

async function askGemini(message, key) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { maxOutputTokens: 1100 }
      })
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini returned ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim();
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}
