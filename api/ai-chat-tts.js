// api/ai-chat-tts.js
//
// TTS endpoint for Vercel serverless functions
// Handles Replicate-hosted Piper TTS requests with proper audio encoding
//


export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const replicateKey = process.env.REPLICATE_API_TOKEN;
  if (!replicateKey) {
    return res.status(500).json({ error: "Replicate TTS not configured. Set REPLICATE_API_TOKEN in environment variables." });
  }

  const { text, voice } = typeof req.body === "object" ? req.body : (() => {
    try { return JSON.parse(req.body || "{}"); } catch (_) { return {}; }
  })();

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing 'text' field" });
  }

  if (text.length > 5000) {
    return res.status(400).json({ error: "Text too long (max 5000 characters)" });
  }

  // Piper voice model — swap the version hash if you want a different voice.
  // female: en_US-lessac-medium  male: en_US-ryan-medium
  // Full list: https://github.com/rhasspy/piper/blob/master/VOICES.md
  const piperVoice = voice === "male"
    ? "en_US-ryan-medium"
    : "en_US-lessac-medium";

  try {
    // ── Step 1: create the prediction ────────────────────────────────────────
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${replicateKey}`,
      },
      body: JSON.stringify({
        // lucataco/piper-tts — stable public model on Replicate
        version: "dfdf537ba482b029e0a761699e6f55e9162cfd159270bfe845bf2609bb55f7c4",
        input: {
          text,
          voice: piperVoice,
          // speaking_rate accepted by this model version (1.0 = normal)
          speaking_rate: 0.92,
        },
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      console.error("Replicate create error:", err);
      return res.status(createRes.status).json({ error: `Replicate API error: ${createRes.status}` });
    }

    let prediction = await createRes.json();

    // ── Step 2: poll until succeeded / failed (Vercel limit: 10 s max) ──────
    const deadline = Date.now() + 9_000; // stay well under Vercel's 10 s default
    while (
      prediction.status !== "succeeded" &&
      prediction.status !== "failed" &&
      Date.now() < deadline
    ) {
      await new Promise((r) => setTimeout(r, 400));
      const pollRes = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        { headers: { Authorization: `Token ${replicateKey}` } }
      );
      if (!pollRes.ok) break;
      prediction = await pollRes.json();
    }

    if (prediction.status !== "succeeded" || !prediction.output) {
      console.error("Replicate prediction did not succeed:", prediction.status, prediction.error);
      return res.status(502).json({ error: "TTS prediction failed or timed out" });
    }

    // ── Step 3: fetch the WAV file Replicate produced ────────────────────────
    // prediction.output is a URL to the audio file (already WAV for Piper)
    const audioUrl = Array.isArray(prediction.output)
      ? prediction.output[0]
      : prediction.output;

    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      return res.status(502).json({ error: "Failed to download audio from Replicate" });
    }

    const audioArrayBuffer = await audioRes.arrayBuffer();
    const audioBuffer = Buffer.from(audioArrayBuffer);

    if (audioBuffer.length === 0) {
      console.error("Audio buffer is empty");
      return res.status(502).json({ error: "Audio buffer is empty" });
    }

    // Piper already outputs a proper WAV file — no need to prepend a header.
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", audioBuffer.length);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Accept-Ranges", "bytes");

    return res.send(audioBuffer);
  } catch (err) {
    console.error("TTS handler error:", err.message);
    return res.status(502).json({ error: "TTS service failed: " + err.message });
  }
}
