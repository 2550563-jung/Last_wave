// Stores player feedback and emails it. Set these with `supabase secrets set`:
//   RESEND_API_KEY=<key> FEEDBACK_EMAIL=<address>
// Without them feedback is still saved in last_wave_feedback.
const MAX_PER_HOUR = 5;
const WINDOW_SECONDS = 60 * 60;
const allowedOrigins = new Set([
  "https://2550563-jung.github.io",
  "http://127.0.0.1:8877",
  "http://localhost:8877"
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://2550563-jung.github.io",
    "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
}

async function rest(path: string, body: unknown, prefer?: string) {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(prefer ? { Prefer: prefer } : {})
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
  // Functions returning void answer with an empty body.
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function sendEmail(entry: { message: string; nickname: string; version: string }) {
  const key = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("FEEDBACK_EMAIL");
  if (!key || !to) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: "Last Wave <onboarding@resend.dev>",
      to: [to],
      subject: `[Last Wave 의견] ${entry.nickname || "익명"} (${entry.version})`,
      text: `닉네임: ${entry.nickname || "익명"}\n버전: ${entry.version}\n\n${entry.message}`
    })
  });
  if (!response.ok) console.error(`email failed: ${response.status}`);
  return response.ok;
}

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req);
  const reply = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ ok: false }, 405);
  if (!allowedOrigins.has(req.headers.get("origin") || "")) return reply({ ok: false }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply({ ok: false, code: "INVALID_JSON" }, 400);
  }
  const message = String(body.message ?? "").trim().slice(0, 2000);
  const nickname = String(body.nickname ?? "").trim().slice(0, 16);
  const version = String(body.version ?? "").trim().slice(0, 16);
  if (message.length < 2) return reply({ ok: false, code: "MESSAGE_TOO_SHORT" }, 400);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limitKey = `feedback:${ip}`;
  try {
    const retryAfter = Number(await rest("rpc/lw_auth_retry_after", { p_key: limitKey, p_max: MAX_PER_HOUR })) || 0;
    if (retryAfter > 0) return reply({ ok: false, code: "TOO_MANY", retryAfter }, 429);
    await rest("rpc/lw_auth_record_failure", { p_key: limitKey, p_window_seconds: WINDOW_SECONDS });
    await rest("last_wave_feedback", { message, nickname, version }, "return=minimal");
  } catch (error) {
    console.error(String(error));
    return reply({ ok: false, code: "SAVE_FAILED" }, 500);
  }
  await sendEmail({ message, nickname, version }).catch((error) => console.error(String(error)));
  return reply({ ok: true });
});
