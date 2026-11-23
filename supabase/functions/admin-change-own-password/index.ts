import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return respond({ error: "Server is missing Supabase admin configuration." }, 500);
  }

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\\s+/i, "");
  if (!token) return respond({ error: "Authentication required." }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return respond({ error: "Invalid session." }, 401);

  const userId = authData.user.id;
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("role,is_active,password_change_used")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin" || profile.is_active !== true) {
    return respond({ error: "Administrator access required." }, 403);
  }

  let body: { action?: string; new_password?: string };
  try {
    body = await req.json();
  } catch {
    return respond({ error: "Invalid request body." }, 400);
  }

  if (body.action === "status") {
    return respond({ allowed: profile.password_change_used !== true });
  }

  const newPassword = body.new_password ?? "";
  if (newPassword.length < 10 || newPassword.length > 72) {
    return respond({ error: "Password must be between 10 and 72 characters." }, 400);
  }

  // Atomically claim the one-time change before updating Auth.
  const { data: claimed, error: claimError } = await admin
    .from("user_profiles")
    .update({ password_change_used: true })
    .eq("user_id", userId)
    .eq("role", "admin")
    .eq("is_active", true)
    .eq("password_change_used", false)
    .select("user_id")
    .maybeSingle();

  if (claimError) return respond({ error: claimError.message }, 500);
  if (!claimed) return respond({ error: "Your one-time password change has already been used." }, 409);

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateError) {
    // Release the claim only when Auth rejected the password update.
    await admin.from("user_profiles")
      .update({ password_change_used: false })
      .eq("user_id", userId)
      .eq("password_change_used", true);
    return respond({ error: updateError.message }, 400);
  }

  return respond({ success: true });
});
