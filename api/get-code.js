import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { reference } = req.query;
  if (!reference) return res.status(400).json({ error: "Missing reference" });

  const { data, error } = await supabase
    .from("payment_codes")
    .select("code, tier, used")
    .eq("paystack_reference", reference)
    .maybeSingle();

  if (error || !data) {
    // Webhook may not have landed yet — frontend should retry for a few seconds
    return res.status(404).json({ error: "Code not ready yet" });
  }

  return res.status(200).json(data);
}
