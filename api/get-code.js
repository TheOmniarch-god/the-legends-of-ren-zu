import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findPaymentCode(reference) {
  // New canonical column.
  let { data, error } = await supabase
    .from("payment_codes")
    .select("code, tier, used")
    .eq("payment_reference", reference)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  // Backward compatibility for older rows created before migration.
  const fallback = await supabase
    .from("payment_codes")
    .select("code, tier, used")
    .eq("paystack_reference", reference)
    .maybeSingle();

  if (fallback.error) throw fallback.error;
  return fallback.data;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const reference = String(req.query.reference || "").trim();

  if (!reference) {
    return res.status(400).json({ error: "Missing payment reference" });
  }

  try {
    const data = await findPaymentCode(reference);

    if (!data) {
      // Webhook may not have landed yet — frontend retries for a few seconds.
      return res.status(404).json({ error: "Realm token not ready yet" });
    }

    return res.status(200).json({
      ...data,
      label: "Realm Token"
    });
  } catch (error) {
    console.error("api/get-code lookup error:", error);
    return res.status(500).json({ error: "Could not check realm token" });
  }
}
