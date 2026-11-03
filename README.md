# Last Wave

파도를 버티며 성장하는 로그라이크 생존 게임입니다.

**플레이:** https://2550563-jung.github.io/Last_wave/

**게임 소개:** https://2550563-jung.github.io/Last_wave/about/

## 구조

| 경로 | 내용 |
|---|---|
| `index.html` | 페이지 마크업과 스크립트 로드 순서 |
| `last-wave-core*` | 게임 본체 CSS와 JS. 번호 순서대로 불러옵니다 |
| `last-wave-v*`, `last-wave-art-*`, `last-wave-aim-*` | 버전별 추가 기능. 앞선 코드를 덮어쓰므로 `index.html`의 순서가 중요합니다 |
| `last-wave-cloudflare.js` | 멀티플레이 클라이언트 |
| `cloudflare-multiplayer/` | 멀티플레이 Cloudflare Worker |
| `supabase/` | 데이터베이스 마이그레이션과 Edge Function |
| `desktop/` | 배포된 게임을 여는 Windows 앱(Electron) |
| `tests/` | 자동 테스트 |

## 로컬 실행

정적 파일 서버로 저장소 루트를 엽니다.

```bash
npx serve -l 8877 .
```

## 테스트

```bash
npm install
npx playwright install chromium   # Windows에서는 설치된 Chrome을 사용하므로 생략 가능
npm test
```

`CHROME_PATH`로 사용할 브라우저를 지정할 수 있습니다.

멀티플레이 테스트는 `tests/mock-supabase.mjs`로 세션 검증을 대신하며 운영 DB에 접속하지 않습니다.

```bash
node tests/mock-supabase.mjs
cd cloudflare-multiplayer && npm ci && npx wrangler dev --local --port 8787 --var SUPABASE_URL:http://127.0.0.1:54399
# 다른 터미널의 저장소 루트에서
LW_CLOUDFLARE_TEST_URL=http://127.0.0.1:8787 node tests/run.mjs
```

## 릴리스

게임에 영향을 주는 업데이트는 `last-wave-core-1.js`의 `GAME_VERSION`과 `index.html`의 `#gameVersion`을 함께 올립니다. 메인 화면에 표시됩니다. `last-wave-updates.js`에 그 버전의 내용을 추가하면, 해당 버전으로 처음 들어온 플레이어에게 팝업으로 보여 줍니다. 내용이 없으면 테스트가 실패합니다.

## 배포

- `main`에 푸시하면 테스트 통과 후 GitHub Pages에 배포됩니다. 게임에 필요한 파일만 올라갑니다.
- `exe-v*` 태그를 푸시하면 Windows 실행 파일을 빌드해 릴리스에 올립니다.
- 오프라인 실행은 `sw.js`가 맡습니다. 새 파일을 게임에 추가할 때 이름이 `last-wave-*`가 아니면 `.github/workflows/static.yml`의 복사 목록에 추가하세요.

## Supabase Edge Function

배포된 함수는 `admin-auth`, `accounts`, `rankings`입니다. `rankings` 소스는 아직 저장소에 없습니다. 다음 명령으로 받아 추가하세요.

```bash
supabase functions download rankings --project-ref nkeeayhodmauifevmaga
```

`admin-auth`는 비밀번호 솔트와 해시를 Supabase secret으로 읽습니다. 이 저장소는 공개 상태이므로 값을 코드에 넣지 마세요.

```bash
supabase secrets set ADMIN_SALT=<hex> ADMIN_HASH=<hex>
supabase functions deploy admin-auth --no-verify-jwt
```

secret을 설정하기 전에 배포하면 관리자 로그인이 503으로 실패합니다.
