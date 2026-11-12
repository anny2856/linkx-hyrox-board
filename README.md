# LINKX HYROX — GitHub + Vercel 수정본

이 버전은 Vercel용입니다. 기존 Sites 버전과 섞지 마세요. 최신 LINKX 디자인·스테이션 안내·선수 일정 27개를 포함합니다.

## 1. 오류 원인과 수정 내용

기존 build.mjs는 Sites용 `.openai/hosting.json`을 복사하고 Cloudflare Worker를 만들었습니다. 이 파일이 GitHub에 없어 ENOENT 오류가 났습니다. 숨김 파일을 추가하는 것만으로는 Vercel의 인증·DB·서버 실행이 해결되지 않습니다.

이 수정본은 다음과 같이 바꿨습니다.

- `.openai/hosting.json` 의존성 제거.
- `dist/index.html` 정적 화면 생성.
- `api/index.js`에 Vercel Node.js Function 진입점 추가.
- `vercel.json`에 빌드·출력 경로·API 라우팅 설정.
- Cloudflare D1 대신 Supabase PostgreSQL REST API 사용.
- ChatGPT 인증 프록시 대신 Supabase 이메일/비밀번호 인증 사용.
- 서버에서 사용자 검증 후 이메일 허용 목록 확인. 토큰은 HttpOnly·Secure 쿠키에 저장.
- 버전 기반 동시 수정 충돌 방지, 서버 저장, SSE 자동 업데이트 유지.

**중요: Apple 계정으로 ChatGPT에 로그인하는 기존 방식이 Vercel로 자동 이전되지는 않습니다.**
이 수정본은 같은 이메일을 사용할 수 있는 별도 사이트 관리자 계정입니다. Apple·ChatGPT 비밀번호를 이 사이트에 입력하지 마세요. Apple로 계속하기 버튼이 꼭 필요하다면 별도의 Apple OAuth 설정이 필요하며 이 수정본에는 포함하지 않았습니다.

## 2. GitHub 파일 교체

대상 저장소: https://github.com/anny2856/linkx-hyrox-board

이 압축파일을 풀고 **그 안의 파일과 폴더를 저장소 최상위에 올리세요.** 압축파일 자체를 올리거나 한 단계 하위 폴더로 올리면 안 됩니다. 최상위에 package.json, build.mjs, vercel.json이 보여야 합니다.

현재 저장소에 사용자님이 별도로 수정한 파일이 있다면 먼저 백업하세요. 이 수정본은 대화에서 제작한 최신 로컬 소스를 기준으로 만들었습니다. 현재 GitHub 내용을 직접 읽거나 수정하지는 못했습니다.

필수 구조:

```
package.json
build.mjs
vercel.json
api/index.js
server/app.js
data/roster.js
web/index.html
web/linkx.css
supabase/setup.sql
tests/app.test.mjs
README.md
```

기존 `worker/`, `drizzle/`, `.openai/`, `preview.mjs`, `scripts/build.sh`는 새 버전에서 사용하지 않습니다. 새 build.mjs와 package.json을 반드시 교체해야 합니다. 기존 README의 Sites 배포 설명보다 이 안내를 우선하세요.

## 3. Vercel 빌드 설정

Vercel 프로젝트 Settings의 Build and Deployment에서 확인:

| 항목 | 값 |
| --- | --- |
| Framework Preset | Other |
| Root Directory | package.json이 있는 저장소 최상위(보통 비움) |
| Build Command | npm run build |
| Output Directory | dist |
| Install Command | 기본값 |
| Node.js | Vercel에서 지원하는 22 이상 버전 |

기존 설정에 다른 Build Command나 Root Directory가 강제로 지정되어 있으면 위 값에 맞춥니다. vercel.json에도 빌드와 출력 설정이 포함되어 있습니다. 커밋을 올린 뒤 새 커밋으로 배포하거나 Redeploy 하세요.

아직 Supabase 연결 없이 배포하면 **명단 조회만** 가능합니다. 상단에는 '명단 조회 · 관리자 설정 대기'로 표시하고 관리자 저장은 막습니다. 실제로 연결하지 않은 상태에서 실시간 저장이 된다고 표시하지 않습니다.

## 4. Supabase 준비

1. 본인 소유 Supabase 프로젝트를 만듭니다.
2. 해당 프로젝트 SQL Editor에 `supabase/setup.sql` 전체 내용을 붙여 실행합니다.
3. `hyrox_races` 테이블에 27개 일정이 생겼는지 확인합니다.
4. Authentication → Users에서 관리자 사용자 추가(Create user)를 선택합니다.
5. 이메일은 `xdzm666kvp@privaterelay.appleid.com`, 비밀번호는 이 사이트만의 새 비밀번호로 직접 설정합니다. 이메일 확인 완료 옵션이 있으면 적용합니다.
6. 공개 회원가입이 필요 없으므로 Authentication의 신규 가입 허용은 끌 수 있습니다. 관리자 사용자 추가 후 진행하세요.

이 방식은 이메일 링크 발송에 의존하지 않습니다. Apple 비공개 릴레이 주소로 외부 서비스 이메일이 전달되지 않는 경우가 있어도, 대시보드에서 직접 확인된 사용자를 만들어 비밀번호 로그인할 수 있습니다. Supabase UI가 변경되어 사용자 추가/이메일 확인 옵션을 찾지 못하면 화면을 확인해 다음 단계를 진행하세요. 비밀번호와 키는 채팅이나 GitHub에 올리지 마세요.

SQL은 RLS를 활성화하고 anon/authenticated 역할의 테이블 접근 권한을 제거합니다. 서버의 service_role만 데이터에 접근하고, 수정 전 API가 관리자 신원을 검증합니다. 읽기 API에는 공개에 필요한 경기 정보만 반환합니다. 이미 초기화한 테이블에 SQL을 다시 실행해도 삭제된 선수를 되살리지 않도록 seed guard를 포함합니다. 실제 프로젝트에 SQL을 실행한 검증은 아직 하지 않았습니다.

## 5. Vercel 환경변수

Supabase 프로젝트 설정의 API Keys에서 **legacy JWT anon / service_role 키**를 확인해 아래에 사용합니다. 이 코드의 Authorization 헤더는 JWT 키 방식입니다. 새 publishable/secret 키와 혼동하지 마세요.

Vercel → 프로젝트 Settings → Environment Variables에 추가:

| 이름 | 값 |
| --- | --- |
| SUPABASE_URL | https://프로젝트ID.supabase.co |
| SUPABASE_ANON_KEY | Supabase legacy anon JWT key |
| SUPABASE_SERVICE_ROLE_KEY | Supabase legacy service_role JWT key |
| ADMIN_EMAILS | xdzm666kvp@privaterelay.appleid.com |

Production 환경에 적용합니다. Preview에서도 검증하려면 Preview도 선택합니다. service_role은 서버 비밀값이며 브라우저 코드나 GitHub에 넣으면 안 됩니다. 환경변수 변경 후 **재배포**해야 적용됩니다. 관리자 비밀번호는 Vercel 환경변수가 아니라 Supabase 사용자에 설정합니다.

## 6. 실제 사용

1. 운영 링크에 접속 → 누구나 명단 조회.
2. 관리자 로그인 → 위에서 만든 사이트 관리자 이메일·비밀번호 입력.
3. 선수/일정 편집, 대기·경기 중·완주 버튼 사용.
4. 다른 휴대폰에서 같은 운영 링크를 열고 변경사항이 자동 반영되는지 확인.

초기 27개 명단은 setup.sql에서 서버 DB에 저장합니다. 별도의 '명단 저장 시작' 버튼이 필요 없습니다.

연결된 상태에서는 SSE로 약 2초 간격 DB 변경을 확인합니다. 스트림을 주기적으로 재연결하고 연결 오류 시 조회로 복구합니다. 공식 경기 계측 기록은 아닙니다. 서버리스 호출과 DB 사용량은 실제 관람 인원에 따라 달라집니다.

## 7. 로컬 검사와 검증 범위

```
npm run build
npm test
```

외부 패키지 설치 없이 Node.js 22 이상에서 빌드 가능합니다. 테스트는 Supabase 응답을 모의하여 권한·쿠키·CRUD 요청·버전 충돌·SSE·연결 실패 처리를 검증합니다. 실제 Vercel 배포 및 Supabase 프로젝트 로그인/SQL 실행을 완료했다는 의미는 아닙니다.

배포 후 확인:

- 로그에 `Vercel build complete: dist/index.html` 출력.
- `/api/races`에서 configured:true 확인(환경변수/SQL 연결 후).
- `/api/me`에서 로그아웃 시 admin:false, 올바른 로그인 시 admin:true 확인.
- 익명/비관리자 계정의 수정 불가.
- 관리자 변경 후 새로고침·다른 기기에서도 상태 유지.
- 모바일에서 모든 종목, 스테이션 8개, 수정된 이름 '김해인, 변미정' 확인.

운영 URL 자체가 Vercel 로그인 화면으로 막히면 프로젝트의 Deployment Protection 정책도 확인해야 합니다. 해당 계정/플랜에서 허용되는 공개 운영 설정으로 전환합니다.

## 8. 기준 문서

- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/project-configuration/vercel-json
- https://supabase.com/docs/reference/javascript/auth-signinwithpassword
- https://supabase.com/docs/guides/database/postgres/row-level-security
