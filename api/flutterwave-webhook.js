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

const WORDS = {
  gu_master: [
    "reputationgu", "wineorigin", "faithlight", "strengthpath",
    "aperturefist", "primevalseed", "wisdomchain", "firststepper"
  ],
  gu_immortal: [
    "northdarkice", "soulseal", "weboffate", "ordinaryabyss",
    "dreamwalker", "immortalaperture", "fateweaver", "freedomseeker"
  ],
  venerable: [
    "reverendinsanity", "heavenpursuit", "strongeatweak", "selftrue",
    "peakvenerable", "fatebows", "lightningwill", "renzuascendant"
  ],
};

const TIER_NAMES = {
  gu_master: "Gu Master",
  gu_immortal: "Gu Immortal",
  venerable: "Venerable",
};

// IMPORTANT:
// Keep this matched to your actual live Flutterwave prices.
// Current frontend prices are 4.99 / 9.99 / 29.99.
const AMOUNT_TO_TIER = {
  499: "gu_master",
  999: "gu_immortal",
  2999: "venerable",
};

function generateRealmToken(tier) {
  const bank = WORDS[tier] || WORDS.gu_master;
  const word = bank[Math.floor(Math.random() * bank.length)];
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${word}-${suffix}`;
}

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function verifyFlutterwaveTransaction(id) {
  const res = await fetch(`https://api.flutterwave.com/v3/transactions/${id}/verify`, {
    headers: {
      Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
    },
  });

  const data = await res.json();

  if (!res.ok || data?.status !== "success" || !data?.data) {
    throw new Error(data?.message || `Flutterwave verify failed (${res.status})`);
  }

  return data.data;
}

function realmTokenEmailHtml({ tierName, code, appUrl }) {
  return `
    <div style="margin:0;padding:0;background:#0b0907;font-family:Georgia,serif;color:#f7ead0;">
      <div style="max-width:560px;margin:0 auto;padding:32px 18px;">
        <div style="
          border:1px solid rgba(255,220,150,0.28);
          border-radius:24px;
          overflow:hidden;
          background:
            radial-gradient(circle at 50% 0%, rgba(255,220,150,0.16), transparent 35%),
            linear-gradient(180deg, #18110b 0%, #080604 100%);
          box-shadow:0 18px 60px rgba(0,0,0,0.55);
        ">
          <div style="padding:28px 28px 18px;border-bottom:1px solid rgba(255,255,255,0.08);">
            <div style="font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(255,230,180,0.62);margin-bottom:10px;">
              The Legends of Ren Zu
            </div>
            <div style="font-size:28px;line-height:1.15;font-weight:bold;color:#fff4d6;">
              Your Realm Token
            </div>
          </div>

          <div style="padding:26px 28px 30px;">
            <p style="font-size:15px;line-height:1.7;color:rgba(247,234,208,0.78);margin:0 0 18px;">
              Your Flutterwave payment has been verified. This token unlocks your <strong style="color:#fff4d6;">${tierName}</strong> realm.
            </p>

            <div style="
              text-align:center;
              font-size:24px;
              letter-spacing:0.12em;
              font-weight:bold;
              color:#fff4d6;
              padding:18px 16px;
              margin:20px 0;
              border-radius:18px;
              border:1px solid rgba(255,220,150,0.35);
              background:rgba(255,220,150,0.10);
              word-break:break-word;
            ">
              ${code}
            </div>

            <p style="font-size:13px;line-height:1.65;color:rgba(247,234,208,0.66);margin:0 0 22px;">
              Sign in to The Legends of Ren Zu, open Treasure Yellow Heaven, then redeem this token under <strong>Realm Token</strong>.
            </p>

            <div style="text-align:center;margin:24px 0;">
              <a href="${appUrl}" style="
                display:inline-block;
                padding:13px 22px;
                border-radius:999px;
                background:rgba(255,220,150,0.18);
                border:1px solid rgba(255,220,150,0.38);
                color:#fff4d6;
                text-decoration:none;
                font-size:14px;
                letter-spacing:0.08em;
              ">
                Open Treasure Yellow Heaven
              </a>
            </div>

            <p style="font-size:12px;line-height:1.6;color:rgba(247,234,208,0.45);margin:22px 0 0;">
              If you did not make this payment, ignore this email or contact The Omniarch support.
            </p>
          </div>
        </div>

        <div style="text-align:center;margin-top:18px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(247,234,208,0.35);">
          The Omniarch
        </div>
      </div>
    </div>
  `;
}

async function sendRealmTokenEmail(email, code, tier) {
  if (!email) return;

  const tierName = TIER_NAMES[tier] || tier;
  const appUrl = process.env.PUBLIC_SITE_URL || "https://thelegendsofrenzu.theomniarch.com.ng";

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "The Omniarch <no-reply@theomniarch.com.ng>",
      to: email,
      subject: `Your ${tierName} Realm Token`,
      html: realmTokenEmailHtml({ tierName, code, appUrl }),
    }),
  });

  if (!emailRes.ok) {
    const text = await emailRes.text().catch(() => "");
    throw new Error(`Resend failed: ${emailRes.status} ${text}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers["verif-hash"];

    if (!process.env.FLW_WEBHOOK_HASH || signature !== process.env.FLW_WEBHOOK_HASH) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = JSON.parse(rawBody.toString("utf8"));

    if (event?.event !== "charge.completed") {
      return res.status(200).json({ received: true, ignored: true });
    }

    const webhookData = event?.data || {};
    const transactionId = webhookData.id;
    const txRef = webhookData.tx_ref;

    if (!transactionId || !txRef) {
      return res.status(200).json({ received: true, ignored: true, reason: "missing id/tx_ref" });
    }

    const { data: existingCode, error: existingErr } = await supabase
      .from("payment_codes")
      .select("id, code, tier")
      .eq("payment_reference", txRef)
      .maybeSingle();

    if (existingErr) {
      console.error("Existing realm token lookup failed:", existingErr);
      return res.status(500).json({ error: "Could not check existing payment" });
    }

    if (existingCode) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    const verified = await verifyFlutterwaveTransaction(transactionId);

    if (verified.status !== "successful") {
      return res.status(200).json({ received: true, ignored: true, reason: "not successful after verify" });
    }

    const amountMinor = Math.round(Number(verified.amount || 0) * 100);
    const tier = AMOUNT_TO_TIER[amountMinor];

    if (!tier) {
      console.error("Unrecognized verified payment amount:", verified.amount, verified.currency, verified.tx_ref);
      return res.status(200).json({ received: true, ignored: true, reason: "unrecognized amount" });
    }

    if (process.env.FLW_EXPECTED_CURRENCY) {
      const expectedCurrency = process.env.FLW_EXPECTED_CURRENCY.trim().toUpperCase();
      const actualCurrency = String(verified.currency || "").trim().toUpperCase();

      if (expectedCurrency && actualCurrency !== expectedCurrency) {
        console.error("Currency mismatch:", { expectedCurrency, actualCurrency, txRef });
        return res.status(200).json({ received: true, ignored: true, reason: "currency mismatch" });
      }
    }

    const email = verified?.customer?.email || webhookData?.customer?.email || null;
    const code = generateRealmToken(tier);

    const { error: codeInsertErr } = await supabase
      .from("payment_codes")
      .insert({
        code,
        tier,
        used: false,
        payment_reference: txRef,
        payment_provider: "flutterwave",
        flutterwave_transaction_id: String(transactionId),
        // Backward compatibility for older recovery code / older rows.
        paystack_reference: txRef,
        customer_email: email,
        email,
      });

    if (codeInsertErr) {
      console.error("Failed to store realm token:", codeInsertErr);
      return res.status(500).json({ error: "Could not save realm token" });
    }

    const { error: txInsertErr } = await supabase.from("transactions").insert({
      reference: txRef,
      amount: amountMinor,
      currency: verified.currency || "",
      plan: tier,
      status: "successful_flutterwave",
      email,
    });

    if (txInsertErr) {
      console.error("Transaction log insert failed:", txInsertErr);
    }

    if (email && process.env.RESEND_API_KEY) {
      try {
        await sendRealmTokenEmail(email, code, tier);
      } catch (emailErr) {
        console.error("Realm token email send failed:", emailErr);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("flutterwave-webhook error:", err);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}
