import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function getSupabasePublic() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }

  return createClient(url, anonKey);
}

export async function getUserFromRequest(req) {
  const authHeader =
    req.headers.authorization ||
    req.headers.Authorization ||
    "";

  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return null;
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data || !data.user) {
    return null;
  }

  return data.user;
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
