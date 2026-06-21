import {
  getSupabaseAdmin,
  getUserFromRequest,
  sendJson
} from "./_supabase.js";

const DAILY_CHAT_LIMIT = 3;
const DAILY_AUDIO_LIMIT = 2;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeTier(tier) {
  if (
    tier === "mortal" ||
    tier === "gu_master" ||
    tier === "gu_immortal" ||
    tier === "venerable"
  ) {
    return tier;
  }

  return "mortal";
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

function responseFromRow(row) {
  return {
    success: true,
    tier: normalizeTier(row.tier),
    dailyChatUsed: row.daily_chat_used || 0,
    dailyAudioUsed: row.daily_audio_used || 0,
    narrationsRemaining: row.narrations_remaining || 0,
    chatsRemaining: row.chats_remaining || 0
  };
}

async function spendFromTable({ supabase, table, idColumn, idValue, row, type }) {
  const tier = normalizeTier(row.tier);
  const today = todayKey();

  let dailyChatUsed = row.daily_chat_used || 0;
  let dailyAudioUsed = row.daily_audio_used || 0;

  if (row.last_reset_date !== today) {
    dailyChatUsed = 0;
    dailyAudioUsed = 0;
  }

  // Venerable: unlimited everything.
  if (tier === "venerable") {
    if (row.last_reset_date !== today) {
      await supabase
        .from(table)
        .update({
          daily_chat_used: 0,
          daily_audio_used: 0,
          last_reset_date: today
        })
        .eq(idColumn, idValue);
    }

    return {
      status: 200,
      body: {
        success: true,
        tier,
        dailyChatUsed: 0,
        dailyAudioUsed: 0,
        narrationsRemaining: row.narrations_remaining || 0,
        chatsRemaining: row.chats_remaining || 0
      }
    };
  }

  // Gu Immortal: unlimited chat, metered narrations.
  if (tier === "gu_immortal") {
    if (type === "chat") {
      return {
        status: 200,
        body: {
          success: true,
          tier,
          dailyChatUsed,
          dailyAudioUsed,
          narrationsRemaining: row.narrations_remaining || 0,
          chatsRemaining: row.chats_remaining || 0
        }
      };
    }

    if ((row.narrations_remaining || 0) > 0) {
      const { data: updated, error } = await supabase
        .from(table)
        .update({
          narrations_remaining: (row.narrations_remaining || 0) - 1,
          daily_chat_used: dailyChatUsed,
          daily_audio_used: dailyAudioUsed,
          last_reset_date: today
        })
        .eq(idColumn, idValue)
        .select()
        .single();

      if (error) throw error;

      return {
        status: 200,
        body: responseFromRow(updated)
      };
    }

    return {
      status: 402,
      body: { error: "Narrations exhausted" }
    };
  }

  // Gu Master: metered narrations and chats.
  if (tier === "gu_master") {
    if (type === "audio") {
      if ((row.narrations_remaining || 0) > 0) {
        const { data: updated, error } = await supabase
          .from(table)
          .update({
            narrations_remaining: (row.narrations_remaining || 0) - 1,
            daily_chat_used: dailyChatUsed,
            daily_audio_used: dailyAudioUsed,
            last_reset_date: today
          })
          .eq(idColumn, idValue)
          .select()
          .single();

        if (error) throw error;

        return {
          status: 200,
          body: responseFromRow(updated)
        };
      }

      return {
        status: 402,
        body: { error: "Narrations exhausted" }
      };
    }

    if ((row.chats_remaining || 0) > 0) {
      const { data: updated, error } = await supabase
        .from(table)
        .update({
          chats_remaining: (row.chats_remaining || 0) - 1,
          daily_chat_used: dailyChatUsed,
          daily_audio_used: dailyAudioUsed,
          last_reset_date: today
        })
        .eq(idColumn, idValue)
        .select()
        .single();

      if (error) throw error;

      return {
        status: 200,
        body: responseFromRow(updated)
      };
    }

    return {
      status: 402,
      body: { error: "Chats exhausted" }
    };
  }

  // Mortal: small daily allowance.
  if (type === "audio") {
    if (dailyAudioUsed < DAILY_AUDIO_LIMIT) {
      const { data: updated, error } = await supabase
        .from(table)
        .update({
          daily_audio_used: dailyAudioUsed + 1,
          daily_chat_used: dailyChatUsed,
          last_reset_date: today
        })
        .eq(idColumn, idValue)
        .select()
        .single();

      if (error) throw error;

      return {
        status: 200,
        body: responseFromRow(updated)
      };
    }

    return {
      status: 402,
      body: { error: "Daily audio limit reached" }
    };
  }

  if (dailyChatUsed < DAILY_CHAT_LIMIT) {
    const { data: updated, error } = await supabase
      .from(table)
      .update({
        daily_chat_used: dailyChatUsed + 1,
        daily_audio_used: dailyAudioUsed,
        last_reset_date: today
      })
      .eq(idColumn, idValue)
      .select()
      .single();

    if (error) throw error;

    return {
      status: 200,
      body: responseFromRow(updated)
    };
  }

  return {
    status: 402,
    body: { error: "Daily chat limit reached" }
  };
}

// POST /api/use-credit { deviceId, type: "chat" | "audio" }
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const body = req.body || {};
  const type = body.type;
  const deviceId = String(body.deviceId || "").trim();

  if (type !== "chat" && type !== "audio") {
    return sendJson(res, 400, { error: "Missing or invalid type" });
  }

  const supabase = getSupabaseAdmin();

  try {
    const authUser = await getUserFromRequest(req);

    // Logged-in mode: spend from email profile.
    if (authUser) {
      const profile = await getOrCreateProfile(supabase, authUser);

      const result = await spendFromTable({
        supabase,
        table: "profiles",
        idColumn: "id",
        idValue: authUser.id,
        row: profile,
        type
      });

      return sendJson(res, result.status, {
        ...result.body,
        accountMode: "email"
      });
    }

    // Guest mode: spend from device row.
    if (!deviceId) {
      return sendJson(res, 400, { error: "Missing deviceId" });
    }

    const guest = await getOrCreateGuestUser(supabase, deviceId);

    const result = await spendFromTable({
      supabase,
      table: "users",
      idColumn: "id",
      idValue: deviceId,
      row: guest,
      type
    });

    return sendJson(res, result.status, {
      ...result.body,
      accountMode: "device"
    });
  } catch (err) {
    console.error("api/use-credit error:", err);

    return sendJson(res, 500, {
      error: "Internal error",
      details: err.message || String(err)
    });
  }
}
