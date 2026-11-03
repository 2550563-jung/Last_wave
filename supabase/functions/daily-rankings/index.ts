// Daily challenge leaderboard: one board per Korean calendar day.
// A player keeps their best run for each day in public.rankings (mode = daily).
const MAX_LIMIT = 50;
const allowedOrigins = new Set([
  "https://2550563-jung.github.io",
  "http://127.0.0.1:8877",
  "http://localhost:8877"
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = "nickname,score,wave,kills,job,weapon,prestige,mode,duration_ms,updated_at";

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://2550563-jung.github.io",
    "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
}

function kstDate(offsetDays = 0) {
  return new Date(Date.now() + 9 * 3600000 + offsetDays * 86400000).toISOString().slice(0, 10);
}

async function rest(path: string, init: RequestInit = {}) {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init.headers || {})
    }
  });
}

function whole(value: unknown) {
  const number = Math.floor(Number(value));
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function text(value: unknown, fallback: string) {
  return String(value ?? "").trim().slice(0, 32) || fallback;
}

function isBetter(run: { score: number; wave: number; kills: number }, old: { score: number; wave: number; kills: number }) {
  if (run.score !== Number(old.score)) return run.score > Number(old.score);
  if (run.wave !== Number(old.wave)) return run.wave > Number(old.wave);
  return run.kills > Number(old.kills);
}

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req);
  const reply = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const requested = url.searchParams.get("dailyDate") || "";
      const dailyDate = /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : kstDate();
      const limit = Math.min(MAX_LIMIT, Math.max(1, whole(url.searchParams.get("limit")) || 10));
      const response = await rest(
        `rankings?select=${FIELDS}&mode=eq.daily&daily_date=eq.${dailyDate}&auto_used=eq.false` +
          `&order=score.desc,wave.desc,kills.desc&limit=${limit}`
      );
      if (!response.ok) throw new Error(`list failed: ${response.status}`);
      return reply({ ok: true, dailyDate, rankings: await response.json() });
    }

    if (req.method !== "POST") return reply({ ok: false }, 405);
    if (!allowedOrigins.has(req.headers.get("origin") || "")) return reply({ ok: false }, 403);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return reply({ ok: false, message: "잘못된 요청입니다." }, 400);
    }

    const playerId = String(body.playerId || "");
    const nickname = String(body.nickname || "").trim();
    const dailyDate = String(body.dailyDate || "");
    const score = whole(body.score);
    const wave = whole(body.wave);
    const kills = whole(body.kills);
    if (!UUID.test(playerId) || nickname.length < 2 || nickname.length > 16 || score === null || !wave || kills === null) {
      return reply({ ok: false, message: "랭킹 기록 형식이 올바르지 않습니다." }, 400);
    }
    // A run started just before midnight still counts for the day it started.
    if (dailyDate !== kstDate() && dailyDate !== kstDate(-1)) {
      return reply({ ok: false, skipped: true, message: "지난 날짜의 일일 도전은 랭킹에 등록되지 않습니다." });
    }
    if (body.autoUsed === true) {
      return reply({ ok: false, skipped: true, message: "AUTO를 사용한 판은 랭킹에서 제외됩니다." });
    }

    const row = {
      player_id: playerId,
      nickname,
      score,
      wave,
      kills,
      job: text(body.job, "군인"),
      weapon: text(body.weapon, "권총"),
      prestige: whole(body.prestige) || 0,
      duration_ms: whole(body.durationMs) || 0,
      mode: "daily",
      daily_date: dailyDate,
      challenge_date: dailyDate,
      auto_used: false
    };
    const match = `player_id=eq.${playerId}&mode=eq.daily&daily_date=eq.${dailyDate}`;
    const found = await rest(`rankings?select=score,wave,kills&${match}`);
    if (!found.ok) throw new Error(`lookup failed: ${found.status}`);
    const [existing] = await found.json();

    if (existing) {
      if (!isBetter({ score, wave, kills }, existing)) {
        return reply({ ok: true, updated: false, message: "오늘의 최고 기록이 유지됩니다." });
      }
      const saved = await rest(`rankings?${match}`, { method: "PATCH", body: JSON.stringify(row) });
      if (!saved.ok) throw new Error(`update failed: ${saved.status}`);
    } else {
      const saved = await rest("rankings", { method: "POST", body: JSON.stringify(row) });
      if (!saved.ok) throw new Error(`insert failed: ${saved.status}`);
    }
    return reply({ ok: true, updated: true, message: "일일 랭킹 등록 완료" });
  } catch (error) {
    console.error(error);
    return reply({ ok: false, message: "랭킹 서버 오류입니다. 잠시 후 다시 시도하세요." }, 500);
  }
});
