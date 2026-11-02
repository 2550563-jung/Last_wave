import { withSupabase } from "npm:@supabase/server@^1";

// Last Wave account server: game-owned username/password accounts, PBKDF2 hashes,
// self-issued session tokens, and cloud saves. Supabase Auth is not used.
const VERSION = "v65";
const USERNAME_RE = /^[A-Za-z0-9_]{4,20}$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;
const PASSWORD_ITERATIONS = 180000;
const SESSION_DAYS = 30;
const MAX_PROFILE_BYTES = 300000;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const MAX_FAILS_PER_ACCOUNT_IP = 10;
const MAX_FAILS_PER_IP = 50;
const encoder = new TextEncoder();

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function apiError(code: string, message: string, status = 400) {
  return jsonResponse({ ok: false, code, message, error: message }, status);
}

function cleanUsername(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim().slice(0, 20);
}

function usernameKey(value: unknown) {
  return cleanUsername(value).toLowerCase();
}

function cleanNickname(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
}

function nicknameKey(value: unknown) {
  return cleanNickname(value).toLowerCase();
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function sha256Hex(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return Array.from(digest).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function derivePasswordHash(password: string, saltText: string, iterations: number) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: base64UrlToBytes(saltText), iterations },
    key,
    256
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

function constantTimeEqual(left: string, right: string) {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index++) difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return difference === 0;
}

function safeProfile(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const profile = { ...(value as Record<string, unknown>) };
  // The account table owns the nickname and player id.
  delete profile.nickname;
  delete profile.playerId;
  if (encoder.encode(JSON.stringify(profile)).byteLength > MAX_PROFILE_BYTES) {
    throw new Error("PROFILE_TOO_LARGE");
  }
  return profile;
}

function publicAccount(account: any) {
  return { id: account.id, username: account.username, nickname: account.nickname ?? null };
}

function profileTimestamp(profile: Record<string, unknown>) {
  return Math.max(0, Math.floor(Number(profile.updatedAt) || Date.now()));
}

function accountPayload(token: string | null, account: any) {
  return {
    ok: true,
    ...(token ? { token } : {}),
    account: publicAccount(account),
    profile: account.profile ?? {},
    profileUpdatedAt: Number(account.profile_updated_at) || 0
  };
}

async function createSession(admin: any, accountId: string) {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await admin
    .from("game_account_sessions")
    .insert({ token_hash: tokenHash, account_id: accountId, expires_at: expiresAt });
  if (error) {
    console.error("session create error", error);
    throw new Error("SESSION_CREATE_FAILED");
  }
  return token;
}

async function readSession(admin: any, tokenValue: unknown) {
  const token = String(tokenValue ?? "");
  if (token.length < 32 || token.length > 256) return null;
  const tokenHash = await sha256Hex(token);
  const { data: session, error: sessionError } = await admin
    .from("game_account_sessions")
    .select("account_id,expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (sessionError || !session) return null;

  const expiresAt = new Date(session.expires_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await admin.from("game_account_sessions").delete().eq("token_hash", tokenHash);
    return null;
  }

  const { data: account, error: accountError } = await admin
    .from("game_accounts")
    .select("*")
    .eq("id", session.account_id)
    .maybeSingle();
  if (accountError || !account) return null;
  return { tokenHash, account };
}

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip") ||
    "unknown";
}

// Limiter failures are logged and never block login.
async function retryAfterSeconds(admin: any, key: string, max: number) {
  const { data, error } = await admin.rpc("lw_auth_retry_after", { p_key: key, p_max: max });
  if (error) {
    console.error("rate limit check error", error);
    return 0;
  }
  return Number(data) || 0;
}

async function recordLoginFailure(admin: any, keys: string[]) {
  for (const key of keys) {
    const { error } = await admin.rpc("lw_auth_record_failure", {
      p_key: key,
      p_window_seconds: LOGIN_WINDOW_SECONDS
    });
    if (error) console.error("rate limit record error", error);
  }
}

async function removeExpiredSessions(admin: any) {
  const { error } = await admin
    .from("game_account_sessions")
    .delete()
    .lt("expires_at", new Date().toISOString());
  if (error) console.error("expired session cleanup error", error);
}

async function handleSignup(admin: any, body: Record<string, unknown>) {
  const username = cleanUsername(body.username);
  const normalizedUsername = usernameKey(username);
  const password = String(body.password ?? "");
  if (!USERNAME_RE.test(username)) {
    return apiError("USERNAME_INVALID", "아이디는 영문, 숫자, 밑줄(_)만 사용해 4~20자로 입력하세요.");
  }
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return apiError("PASSWORD_INVALID", `비밀번호는 ${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자로 입력하세요.`);
  }

  let profile: Record<string, unknown>;
  try {
    profile = safeProfile(body.profile);
  } catch {
    return apiError("PROFILE_TOO_LARGE", "저장 데이터가 너무 큽니다.");
  }

  const existing = await admin.from("game_accounts").select("id").eq("username_key", normalizedUsername).maybeSingle();
  if (existing.error) {
    console.error("username duplicate check error", existing.error);
    return apiError("SIGNUP_FAILED", "아이디 중복 확인을 처리하지 못했습니다.", 500);
  }
  if (existing.data) {
    return apiError("USERNAME_TAKEN", "이미 사용 중인 아이디입니다. 다른 아이디로 다시 설정하세요.", 409);
  }

  const salt = randomToken(16);
  const passwordHash = await derivePasswordHash(password, salt, PASSWORD_ITERATIONS);
  const now = new Date().toISOString();
  const { data: account, error } = await admin
    .from("game_accounts")
    .insert({
      username,
      username_key: normalizedUsername,
      password_salt: salt,
      password_hash: passwordHash,
      password_iterations: PASSWORD_ITERATIONS,
      profile,
      profile_updated_at: profileTimestamp(profile),
      last_login_at: now,
      updated_at: now
    })
    .select("*")
    .single();
  if (error) {
    console.error("signup error", error);
    if (error.code === "23505") {
      return apiError("USERNAME_TAKEN", "이미 사용 중인 아이디입니다. 다른 아이디로 다시 설정하세요.", 409);
    }
    return apiError("SIGNUP_FAILED", "계정을 생성하지 못했습니다.", 500);
  }

  try {
    return jsonResponse(accountPayload(await createSession(admin, account.id), account));
  } catch {
    return apiError("SESSION_CREATE_FAILED", "계정은 생성되었지만 로그인 세션을 만들지 못했습니다.", 500);
  }
}

async function handleLogin(admin: any, request: Request, body: Record<string, unknown>) {
  const normalizedUsername = usernameKey(body.username);
  const password = String(body.password ?? "");
  const invalid = () => apiError("INVALID_CREDENTIALS", "아이디 또는 비밀번호가 올바르지 않습니다.", 401);
  if (!normalizedUsername || !password || password.length > PASSWORD_MAX_LENGTH) return invalid();

  // The account key includes the IP so a stranger cannot lock someone out.
  const ip = clientIp(request);
  const ipKey = `login-ip:${ip}`;
  const accountKey = `login-account:${normalizedUsername}:${ip}`;
  const retryAfter = Math.max(
    await retryAfterSeconds(admin, ipKey, MAX_FAILS_PER_IP),
    await retryAfterSeconds(admin, accountKey, MAX_FAILS_PER_ACCOUNT_IP)
  );
  if (retryAfter > 0) {
    return apiError("TOO_MANY_ATTEMPTS", `로그인 시도가 너무 많습니다. ${Math.ceil(retryAfter / 60)}분 후 다시 시도하세요.`, 429);
  }

  const { data: account, error } = await admin
    .from("game_accounts")
    .select("*")
    .eq("username_key", normalizedUsername)
    .maybeSingle();
  if (error) {
    console.error("login account lookup error", error);
    return apiError("LOGIN_FAILED", "로그인을 처리하지 못했습니다.", 500);
  }
  if (!account) {
    await recordLoginFailure(admin, [ipKey, accountKey]);
    return invalid();
  }

  const candidateHash = await derivePasswordHash(
    password,
    account.password_salt,
    Number(account.password_iterations) || PASSWORD_ITERATIONS
  );
  if (!constantTimeEqual(candidateHash, account.password_hash)) {
    await recordLoginFailure(admin, [ipKey, accountKey]);
    return invalid();
  }

  const now = new Date().toISOString();
  await admin.from("game_accounts").update({ last_login_at: now, updated_at: now }).eq("id", account.id);
  await removeExpiredSessions(admin);

  try {
    return jsonResponse(accountPayload(await createSession(admin, account.id), account));
  } catch {
    return apiError("SESSION_CREATE_FAILED", "로그인 세션을 만들지 못했습니다.", 500);
  }
}

async function handleSaveProfile(admin: any, account: any, body: Record<string, unknown>) {
  let profile: Record<string, unknown>;
  try {
    profile = safeProfile(body.profile);
  } catch {
    return apiError("PROFILE_TOO_LARGE", "저장 데이터가 너무 큽니다.");
  }
  const profileUpdatedAt = profileTimestamp(profile);
  const { error } = await admin
    .from("game_accounts")
    .update({ profile, profile_updated_at: profileUpdatedAt, updated_at: new Date().toISOString() })
    .eq("id", account.id);
  if (error) {
    console.error("profile save error", error);
    return apiError("PROFILE_SAVE_FAILED", "게임 진행도를 저장하지 못했습니다.", 500);
  }
  return jsonResponse({ ok: true, profileUpdatedAt });
}

async function handleSetNickname(admin: any, account: any, body: Record<string, unknown>) {
  if (account.nickname) {
    return apiError("NICKNAME_LOCKED", `이 계정의 닉네임은 이미 "${account.nickname}"(으)로 설정되어 변경할 수 없습니다.`, 409);
  }
  const nickname = cleanNickname(body.nickname);
  const normalizedNickname = nicknameKey(nickname);
  if (nickname.length < 2 || nickname.length > 16) {
    return apiError("NICKNAME_INVALID", "닉네임은 2~16자로 입력하세요.");
  }
  const duplicate = await admin.from("game_accounts").select("id").eq("nickname_key", normalizedNickname).maybeSingle();
  if (duplicate.error) {
    console.error("nickname duplicate check error", duplicate.error);
    return apiError("NICKNAME_SAVE_FAILED", "닉네임 중복 확인을 처리하지 못했습니다.", 500);
  }
  if (duplicate.data) {
    return apiError("NICKNAME_TAKEN", "이미 사용 중인 닉네임입니다. 다른 닉네임으로 다시 설정하세요.", 409);
  }

  // The null filter keeps concurrent requests to a single first-time update.
  const { data: updated, error } = await admin
    .from("game_accounts")
    .update({ nickname, nickname_key: normalizedNickname, updated_at: new Date().toISOString() })
    .eq("id", account.id)
    .is("nickname", null)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("nickname save error", error);
    if (error.code === "23505") {
      return apiError("NICKNAME_TAKEN", "이미 사용 중인 닉네임입니다. 다른 닉네임으로 다시 설정하세요.", 409);
    }
    return apiError("NICKNAME_SAVE_FAILED", "닉네임을 설정하지 못했습니다.", 500);
  }
  if (!updated) {
    return apiError("NICKNAME_LOCKED", "이 계정은 이미 닉네임이 설정되어 변경할 수 없습니다.", 409);
  }
  return jsonResponse({ ok: true, account: publicAccount(updated) });
}

async function handleDeleteAccount(admin: any, account: any, body: Record<string, unknown>) {
  const confirmUsername = usernameKey(body.confirmUsername);
  if (!confirmUsername || confirmUsername !== account.username_key) {
    return apiError("DELETE_CONFIRM_MISMATCH", "현재 계정 아이디를 정확히 입력하세요.");
  }
  const rankingDelete = await admin.from("rankings").delete().eq("player_id", account.id);
  if (rankingDelete.error) {
    console.error("ranking delete error", rankingDelete.error);
    return apiError("ACCOUNT_DELETE_FAILED", "계정의 랭킹 기록을 삭제하지 못했습니다.", 500);
  }
  // game_account_sessions rows go with the account through ON DELETE CASCADE.
  const accountDelete = await admin.from("game_accounts").delete().eq("id", account.id);
  if (accountDelete.error) {
    console.error("account delete error", accountDelete.error);
    return apiError("ACCOUNT_DELETE_FAILED", "계정을 삭제하지 못했습니다.", 500);
  }
  return jsonResponse({ ok: true });
}

export default {
  fetch: withSupabase({ auth: "none" }, async (request, context) => {
    const admin = context.supabaseAdmin;
    if (!admin) {
      return apiError("SERVER_CONFIGURATION", "계정 서버 데이터베이스 연결을 만들 수 없습니다.", 500);
    }
    if (request.method !== "POST") {
      return apiError("METHOD_NOT_ALLOWED", "POST 요청만 지원합니다.", 405);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return apiError("INVALID_JSON", "요청 데이터를 읽을 수 없습니다.");
    }

    const action = String(body.action ?? "");
    if (action === "health") {
      return jsonResponse({ ok: true, version: VERSION, service: "last-wave-accounts" });
    }
    if (action === "signup") return handleSignup(admin, body);
    if (action === "login") return handleLogin(admin, request, body);

    const session = await readSession(admin, body.token);
    if (!session) {
      return apiError("SESSION_INVALID", "로그인 정보가 만료되었거나 올바르지 않습니다. 다시 로그인하세요.", 401);
    }
    const account = session.account;

    if (action === "me") return jsonResponse(accountPayload(null, account));
    if (action === "saveProfile") return handleSaveProfile(admin, account, body);
    if (action === "setNickname") return handleSetNickname(admin, account, body);
    if (action === "logout") {
      await admin.from("game_account_sessions").delete().eq("token_hash", session.tokenHash);
      return jsonResponse({ ok: true });
    }
    if (action === "deleteAccount") return handleDeleteAccount(admin, account, body);

    return apiError("UNKNOWN_ACTION", "지원하지 않는 계정 요청입니다.", 404);
  })
};
