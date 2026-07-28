# Last Wave Cloudflare Multiplayer

Last Wave의 고주기 멀티플레이 패킷을 중계하는 Cloudflare Worker입니다.

- Cloudflare Durable Objects: 방별 WebSocket 및 Presence
- Supabase: 로그인, 랭킹, 공개 방 목록과 방 상태
- 최대 4명의 플레이어와 관전자 연결
- Hibernation WebSocket API 사용
- 12ms 클라이언트 배치로 작은 패킷 수 감소

## 로컬 실행

```powershell
pnpm install
pnpm dev
```

게임 브라우저 콘솔에서 로컬 서버를 선택한 뒤 새로고침합니다.

```js
setLastWaveCloudflareEndpoint("http://127.0.0.1:8787")
location.reload()
```

설정을 지우면 배포 주소가 없는 동안 기존 Supabase Realtime으로 안전하게 돌아갑니다.

```js
setLastWaveCloudflareEndpoint("")
location.reload()
```

## 배포

```powershell
pnpm deploy
```

배포 후 `index.html`의 `last-wave-game-server` 메타 설정이나
`window.LAST_WAVE_CLOUDFLARE_URL`에 Worker의 HTTPS 주소를 지정합니다.
