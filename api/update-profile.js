import {
  getSupabaseAdmin,
  getUserFromRequest,
  sendJson
} from "./_supabase.js";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function cleanText(value, max = 80) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

async function getOrCreateProfile(supabase, authUser) {
  let { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (error) throw error;

  if (!profile) {
    const { data: created, error: insertErr } = await supabase
      .from("profiles")
      .insert({
        id: authUser.id,
        email: authUser.email || null,
        username: "",
        tier: "mortal",
        daily_chat_used: 0,
        daily_audio_used: 0,
        narrations_remaining: 0,
        chats_remaining: 0,
        last_reset_date: todayKey(),
        collected_gu: []
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    profile = created;
  }

  return profile;
}

async function linkDeviceToUser(supabase, deviceId, userId) {
  if (!deviceId || !userId) return;

  const { error } = await supabase
    .from("device_links")
    .upsert(
      {
        device_id: deviceId,
        user_id: userId,
        updated_at: new Date().toISOString()
      },
      { onConflict: "device_id" }
    );

  if (error) throw error;
}

async function getOrCreateGuestUser(supabase, deviceId) {
  let { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", deviceId)
    .maybeSingle();

  if (error) throw error;

  if (!user) {
    const { data: created, error: insertErr } = await supabase
      .from("users")
      .insert({
        id: deviceId,
        tier: "mortal",
        daily_chat_used: 0,
        daily_audio_used: 0,
        narrations_remaining: 0,
        chats_remaining: 0,
        last_reset_date: todayKey()
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    user = created;
  }

  return user;
}

// POST /api/update-profile { deviceId, username, email }
// Logged in: updates the email account profile in `profiles`.
// Guest: updates the device fallback row in `users`.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const body = req.body || {};
  const deviceId = cleanText(body.deviceId, 160);
  const username = cleanText(body.username, 60);
  const email = cleanText(body.email, 180);

  const supabase = getSupabaseAdmin();

  try {
    const authUser = await getUserFromRequest(req);

    // Email-account mode: the Supabase Auth user is the true identity.
    // We use authUser.email as the canonical email, not a random client value.
    if (authUser) {
      await getOrCreateProfile(supabase, authUser);

      const { data: profile, error } = await supabase
        .from("profiles")
        .update({
          username,
          email: authUser.email || email || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", authUser.id)
        .select()
        .single();

      if (error) throw error;

      if (deviceId) {
        await linkDeviceToUser(supabase, deviceId, authUser.id);
      }

      return sendJson(res, 200, {
        success: true,
        accountMode: "email",
        userName: profile.username || "",
        userEmail: profile.email || ""
      });
    }

    // Guest mode: keep the old device-based profile behavior.
    if (!deviceId) {
      return sendJson(res, 400, { error: "Missing deviceId" });
    }

    await getOrCreateGuestUser(supabase, deviceId);

    const { data: guest, error } = await supabase
      .from("users")
      .update({
        username,
        email
      })
      .eq("id", deviceId)
      .select()
      .single();

    if (error) throw error;

    return sendJson(res, 200, {
      success: true,
      accountMode: "device",
      userName: guest.username || "",
      userEmail: guest.email || ""
    });
  } catch (err) {
    console.error("api/update-profile error:", err);

    return sendJson(res, 500, {
      success: false,
      error: "Internal error",
      details: err.message || String(err)
    });
  }
}
