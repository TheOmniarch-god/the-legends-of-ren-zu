import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Vercel needs the RAW request body to verify Paystack's signature,
// so we disable its automatic JSON parsing for this function.
export const config = {
  api: {
    bodyParser: false,
  },
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Lore word banks, one per tier — add/edit freely, just keep them invented/generic ──
const WORDS = {
  gu_master: ["bloodgu", "ironfiend", "ashveil", "direpath", "hollowdao", "graymark"],
  gu_immortal: ["voidcalamity", "ancestralrend", "stormimmortal", "wraithbond", "abysscourt", "fatebreaker"],
  venerable: ["heavenrending", "omniarch", "worldveil", "renzuvenerable", "celestialgu", "thronegu"],
};

function generateLoreCode(tier) {
  const bank = WORDS[tier] || WORDS.gu_master;
  const word = bank[Math.floor(Math.random() * bank.length)];
  const suffix = crypto.randomBytes(3).toString("hex"); // 6 random hex chars, hard to guess
  return `${word}-${suffix}`;
}

// ── EDIT THESE: map your real Paystack amounts (in kobo/cents) to tiers ──
const AMOUNT_TO_TIER = {
  500000: "gu_master",     // e.g. ₦5,000.00
  1500000: "gu_immortal",  // e.g. ₦15,000.00
  3000000: "venerable",    // e.g. ₦30,000.00
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const rawBody = await getRawBody(req);

  // Confirm this request really came from Paystack, not a forged call
  const signature = req.headers["x-paystack-signature"];
  const expected = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");

  if (signature !== expected) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = JSON.parse(rawBody.toString("utf8"));

  if (event.event !== "charge.success") {
    return res.status(200).json({ received: true }); // ignore everything else
  }

  const { reference, amount, customer } = event.data;
  const tier = AMOUNT_TO_TIER[amount];

  if (!tier) {
    console.error("Unrecognized payment amount:", amount);
    return res.status(200).json({ received: true });
  }

  const code = generateLoreCode(tier);

  const { error } = await supabase.from("payment_codes").insert({
    code,
    tier,
    used: false,
    paystack_reference: reference,
    customer_email: customer?.email || null,
  });

  if (error) {
    console.error("Failed to store payment code:", error);
    return res.status(500).json({ error: "Could not save code" });
  }

  return res.status(200).json({ received: true });
}
