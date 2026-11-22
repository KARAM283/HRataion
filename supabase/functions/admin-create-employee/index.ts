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

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return respond({ error: "Authentication required." }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return respond({ error: "Invalid session." }, 401);

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("role,is_active")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin" || profile.is_active !== true) {
    return respond({ error: "Administrator access required." }, 403);
  }

  let body: { employee_id?: string; username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return respond({ error: "Invalid request body." }, 400);
  }

  const employeeId = body.employee_id?.trim();
  const username = body.username?.trim().toLowerCase();
  const password = body.password;

  if (!employeeId || !username || !password) {
    return respond({ error: "Employee, username and password are required." }, 400);
  }
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return respond({ error: "Username must be 3–32 characters using letters, numbers, dots, underscores or hyphens." }, 400);
  }
  if (password.length < 10 || password.length > 72) {
    return respond({ error: "Password must be between 10 and 72 characters." }, 400);
  }

  const email = `${username}@blueline.local`;

  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .maybeSingle();

  if (employeeError || !employee) return respond({ error: "Selected employee was not found." }, 404);

  const { data: existingProfile } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (existingProfile) return respond({ error: "This employee already has a login account." }, 409);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });

  if (createError || !created.user) {
    return respond({ error: createError?.message ?? "Could not create account." }, 400);
  }

  const { error: linkError } = await admin.from("user_profiles").insert({
    user_id: created.user.id,
    employee_id: employeeId,
    role: "employee",
    is_active: true,
  });

  if (linkError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return respond({ error: "Account linking failed: " + linkError.message }, 500);
  }

  return respond({ success: true, user_id: created.user.id, email });
});
