import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Lore word banks, one per tier ──
const WORDS = {
  gu_master:   ["bloodgu", "ironfiend", "ashveil", "direpath", "hollowdao", "graymark"],
  gu_immortal: ["voidcalamity", "ancestralrend", "stormimmortal", "wraithbond", "abysscourt", "fatebreaker"],
  venerable:   ["heavenrending", "omniarch", "worldveil", "renzuvenerable", "celestialgu", "thronegu"],
};

function generateLoreCode(tier) {
  const bank = WORDS[tier] || WORDS.gu_master;
  const word = bank[Math.floor(Math.random() * bank.length)];
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${word}-${suffix}`;
}

// ── Map USD amounts (in cents) to tiers ──
// $4.99 = 499, $9.99 = 999, $15.00 = 1500
// Update these once you set your actual payment link amounts
const AMOUNT_TO_TIER = {
  499:  "gu_master",
  999:  "gu_immortal",
  1500: "venerable",
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const rawBody = await getRawBody(req);

  // Flutterwave uses a different header and hashing method than Paystack
  const signature = req.headers["verif-hash"];
  if (signature !== process.env.FLW_WEBHOOK_HASH) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = JSON.parse(rawBody.toString("utf8"));

  // Only handle successful charges
  if (event.event !== "charge.completed") {
    return res.status(200).json({ received: true });
  }

  const { status, amount, currency, tx_ref, customer } = event.data;

  if (status !== "successful") {
    return res.status(200).json({ received: true });
  }

  // Normalize amount: Flutterwave sends full units (e.g. 4.99 for USD)
  // Convert to cents to match AMOUNT_TO_TIER
  const amountInCents = Math.round(amount * 100);
  const tier = AMOUNT_TO_TIER[amountInCents];

  if (!tier) {
    console.error("Unrecognized payment amount:", amount, currency);
    return res.status(200).json({ received: true });
  }

  const code = generateLoreCode(tier);

  const { error } = await supabase.from("payment_codes").insert({
    code,
    tier,
    used: false,
    paystack_reference: tx_ref, // reusing same column, just stores the transaction ref
    customer_email: customer?.email || null,
  });

  if (error) {
    console.error("Failed to store payment code:", error);
    return res.status(500).json({ error: "Could not save code" });
  }

  return res.status(200).json({ received: true });
}
