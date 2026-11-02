# Last Wave

파도를 버티며 성장하는 로그라이크 생존 게임입니다.

**플레이:** https://2550563-jung.github.io/Last_wave/

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

멀티플레이 테스트(`tests/cloudflare-*.mjs`)는 Worker에 세션 인증이 추가되기 전에 작성되어 현재 통과하지 못하므로 `npm test`와 CI에서 제외됩니다. CI는 Worker의 타입 검사와 번들링만 확인합니다.

## 배포

- `main`에 푸시하면 테스트 통과 후 GitHub Pages에 배포됩니다. 게임에 필요한 파일만 올라갑니다.
- `exe-v*` 태그를 푸시하면 Windows 실행 파일을 빌드해 릴리스에 올립니다.
- 새 파일을 게임에 추가할 때 이름이 `last-wave-*`가 아니면 `.github/workflows/static.yml`의 복사 목록에 추가하세요.

## Supabase Edge Function

배포된 함수는 `admin-auth`, `accounts`, `rankings`입니다. 저장소에는 현재 `admin-auth`만 있습니다.

`admin-auth`는 비밀번호 솔트와 해시를 Supabase secret으로 읽습니다. 이 저장소는 공개 상태이므로 값을 코드에 넣지 마세요.

```bash
supabase secrets set ADMIN_SALT=<hex> ADMIN_HASH=<hex>
supabase functions deploy admin-auth --no-verify-jwt
```

secret을 설정하기 전에 배포하면 관리자 로그인이 503으로 실패합니다.
