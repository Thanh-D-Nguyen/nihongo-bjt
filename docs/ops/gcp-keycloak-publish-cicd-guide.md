# NihonGo BJT - Keycloak, publish va CI/CD tren Google Cloud

Tai lieu nay dung cho VM production hien tai:

```text
VM:       nihongo-bjt-prod
zone:     asia-southeast1-c
IP tinh:  34.87.55.1
user SSH: deploy
source:   /home/deploy/nihongo-bjt
```

## 1. URL dang su dung

```text
Learner:        https://app.34-87-55-1.sslip.io/vi
Admin portal:   https://admin.34-87-55-1.sslip.io/vi
API:            https://api.34-87-55-1.sslip.io
Keycloak:       https://auth.34-87-55-1.sslip.io
Keycloak admin: https://auth.34-87-55-1.sslip.io/admin/master/console/
```

`sslip.io` chi la domain tam thoi de kiem tra HTTPS. Khi co domain rieng, sua
`BASE_DOMAIN`, tao lai Caddyfile va cap nhat DNS.

## 2. Keycloak dang duoc cau hinh nhu the nao

Keycloak la he thong identity. PostgreSQL cua ung dung van la source of truth
cho du lieu hoc tap. Keycloak luu tai khoan, mat khau va realm roles.

Realm production la `nihongo-bjt`. Hai OIDC client dang dung:

```text
nihongo-web    learner app
nihongo-admin  admin portal
```

Server-side register va forgot-password dung service account
`nihongo-user-admin`. Client nay chi co cac quyen `manage-users`,
`view-users`, `query-users`; khong dua mat khau master admin vao process web.

### Lay tai khoan operator lan dau

Tai khoan operator duoc tao ngau nhien va ghi vao file chi co user `deploy`
doc duoc:

```bash
ssh deploy@34.87.55.1
cat /home/deploy/OPERATOR_LOGIN_READ_ONCE.txt
```

Sau khi luu vao password manager, xoa file:

```bash
shred -u /home/deploy/OPERATOR_LOGIN_READ_ONCE.txt
```

### Dang nhap Keycloak admin console

Tai khoan `localadmin` dung cho admin portal cua NihonGo BJT. Keycloak admin
console la lop quan tri identity rieng, dung bootstrap admin ngau nhien. Chi lay
credential nay khi can van hanh Keycloak:

```bash
ssh deploy@34.87.55.1
cd /home/deploy/nihongo-bjt
grep '^KEYCLOAK_ADMIN_' deploy/gcp/runtime/infrastructure.env
```

Sau do dang nhap:

```text
https://auth.34-87-55-1.sslip.io/admin/master/console/
```

Khong gui credential nay qua chat, email hoac commit vao Git. Khong doi mat khau
bootstrap truc tiep trong console ma khong cap nhat
`deploy/gcp/runtime/infrastructure.env`, vi script cau hinh service account can
credential nay.

### Quan ly user bang SSH

```bash
ssh deploy@34.87.55.1
cd /home/deploy/nihongo-bjt

./deploy/gcp/manage-keycloak-user.sh list
./deploy/gcp/manage-keycloak-user.sh create USERNAME EMAIL user
./deploy/gcp/manage-keycloak-user.sh create ADMIN_USERNAME EMAIL admin
./deploy/gcp/manage-keycloak-user.sh reset-password USERNAME
./deploy/gcp/manage-keycloak-user.sh disable USERNAME
./deploy/gcp/manage-keycloak-user.sh delete USERNAME
```

Script hoi mat khau an trong terminal. Khong truyen mat khau qua command line
vi co the bi luu vao shell history.

### Link tai khoan admin Keycloak vao RBAC noi bo

Keycloak realm role `admin` cho phep vao portal. Quyen chi tiet van lay tu
PostgreSQL `authz.admin_actor_role`. Sau khi tao hoac import lai realm, link
Keycloak subject cua `localadmin` vao actor noi bo:

```bash
ssh deploy@34.87.55.1
cd /home/deploy/nihongo-bjt
./deploy/gcp/link-keycloak-admin.sh
```

`deploy/gcp/deploy-release.sh` chay lai script idempotent nay moi release de
khong bi mat link sau khi trien khai. Neu doi username hoac actor ID:

```bash
KEYCLOAK_LINK_ADMIN_USERNAME=USERNAME \
KEYCLOAK_LINK_ADMIN_ACTOR_ID=ACTOR_UUID \
./deploy/gcp/link-keycloak-admin.sh
```

Kiem tra:

```bash
sudo docker exec gcp-postgres-1 \
  psql -U postgres -d nihongo_bjt -Atc \
  "select keycloak_subject is not null
   from authz.admin_actor
   where id = '00000000-0000-4000-8000-000000000001';"
```

Ket qua mong doi: `t`.

### Dang ky, quen mat khau va social login

- Dang nhap username/password da hoat dong.
- Dang ky learner qua `/vi/register` da dung service account toi thieu quyen.
- Forgot-password chi gui mail sau khi cau hinh SMTP cho Keycloak. Truoc khi co
  SMTP, operator reset mat khau bang script SSH.
- Production chi hien social login Google. Facebook, LINE va Apple de trong.

Google Auth Platform da duoc cau hinh ngay `2026-05-30`:

```text
App name:          NihonGo BJT
Audience:          External
Publishing status: Testing
Test user:         globalaccess.vn@gmail.com
OAuth client type: Web application
```

Google OAuth client phai co authorized redirect URI chinh xac:

```text
https://auth.34-87-55-1.sslip.io/realms/nihongo-bjt/broker/google/endpoint
```

Khi doi domain hoac tao lai Google OAuth client, follow tung buoc:

1. Mo Google Cloud Console.
2. Chon project `project-dbd1d70a-52b4-4f92-acd`.
3. Vao `Google Auth Platform -> Overview`.
4. Neu chua cau hinh, bam `Get started`.
5. Dien app name `NihonGo BJT`, support email va contact email.
6. Chon audience `External`, chap nhan Google API Services User Data Policy.
7. Vao `Google Auth Platform -> Audience -> Add users`.
8. Them Google account dung de test trong khi publishing status con `Testing`.
9. Vao `Google Auth Platform -> Clients -> Create OAuth client`.
10. Chon `Web application`.
11. Them authorized redirect URI broker ben tren.
12. Tao client va luu Client ID, Client Secret vao password manager.

Cap nhat VM:

```bash
ssh deploy@34.87.55.1
cd /home/deploy/nihongo-bjt
nano .env
```

Them:

```text
KEYCLOAK_GOOGLE_CLIENT_ID="<Google OAuth client ID>"
KEYCLOAK_GOOGLE_CLIENT_SECRET="<Google OAuth client secret>"
NEXT_PUBLIC_AUTH_GOOGLE_IDP_HINT="google"
NEXT_PUBLIC_AUTH_FACEBOOK_IDP_HINT=""
NEXT_PUBLIC_AUTH_APPLE_IDP_HINT=""
NEXT_PUBLIC_AUTH_LINE_IDP_HINT=""
NEXT_PUBLIC_AUTH_REGISTRATION_ENABLED="true"
```

Sau do chay:

```bash
chmod +x deploy/gcp/*.sh
./deploy/gcp/configure-keycloak-google-idp.sh
rm -f apps/web/.env.local apps/admin/.env.local apps/api/.env.local
rm -rf apps/web/.next apps/admin/.next
pnpm --filter @nihongo-bjt/web build
pm2 restart nihongo-web --update-env
pm2 save
```

Khong giu `apps/*/.env.local` tren VM production. Next.js uu tien cac file nay
hon root `.env`; neu copy file dev len VM, frontend co the goi nham
`http://localhost:4000` tren may nguoi dung va render lai social provider chua
duoc cau hinh. `deploy/gcp/deploy-release.sh` tu dong xoa override local truoc
moi production build.

Kiem tra:

```bash
curl -fsS https://app.34-87-55-1.sslip.io/vi/login
curl -fsSI \
  'https://app.34-87-55-1.sslip.io/api/auth/keycloak/authorize?locale=vi&idp=google'
```

Ket qua production da xac minh:

```text
Keycloak IdP aliases:        google
Rendered Google links:       1
Rendered other social links: 0
Registration:                enabled
Google redirect host:        accounts.google.com
```

`GOOGLE_OAUTH_CLIENT_ID` va `GOOGLE_OAUTH_CLIENT_SECRET` cua direct API adapter
van de trong co chu dich. Production login hien di qua Keycloak broker; cac
provider va dich vu ngoai khac cau hinh sau.

## 3. Lenh da dung de trien khai VM tu dau

### Tao runtime secret va infrastructure

```bash
cd /home/deploy/nihongo-bjt
BASE_DOMAIN=34-87-55-1.sslip.io ./deploy/gcp/prepare-runtime.sh

sudo docker compose \
  --env-file deploy/gcp/runtime/infrastructure.env \
  -f deploy/gcp/compose.infrastructure.yml up -d

./deploy/gcp/configure-keycloak-user-admin.sh
```

`prepare-runtime.sh` sinh secret ngau nhien, tao `.env`, realm import va
Caddyfile runtime. Khong commit `.env` hoac `deploy/gcp/runtime/`.

### Khoi tao database, seed, build va PM2

```bash
cd /home/deploy/nihongo-bjt
set -a
. ./.env
set +a

pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm exec prisma migrate deploy --schema packages/database/prisma/schema.prisma
pnpm seed:all
pnpm search:index
pnpm build

chmod +x deploy/gcp/*.sh
pm2 start deploy/gcp/ecosystem.config.cjs
pm2 save
```

### Backup va smoke test

```bash
./deploy/gcp/backup-postgres.sh
ls -lh /home/deploy/backups/postgres

curl -fsS https://api.34-87-55-1.sslip.io/api/health/live
curl -fsS https://api.34-87-55-1.sslip.io/api/health/ready
curl -fsS https://api.34-87-55-1.sslip.io/api/health/version
pm2 status
sudo docker compose \
  --env-file deploy/gcp/runtime/infrastructure.env \
  -f deploy/gcp/compose.infrastructure.yml ps
```

Cron backup PostgreSQL dang chay moi ngay luc `10:30 UTC` va giu dump bay ngay.
Google Cloud disk snapshot schedule cung dang bat hang ngay.

## 4. Public moi lan sua code hoac config

### Cach thu cong an toan

Dong bo source da thay doi len VM, sau do chay mot lenh release:

```bash
rsync -az \
  --exclude='.env' \
  --exclude='.git/' \
  --exclude='**/.next/' \
  --exclude='**/node_modules/' \
  --exclude='deploy/gcp/runtime/' \
  ./ deploy@34.87.55.1:/home/deploy/nihongo-bjt/

ssh deploy@34.87.55.1 \
  'cd /home/deploy/nihongo-bjt && ./deploy/gcp/deploy-release.sh'
```

`deploy-release.sh` tu dong:

1. Backup hai PostgreSQL database.
2. Cai dependency dung lockfile.
3. Generate Prisma client va chay migration.
4. Build API, learner va admin.
5. Reload PM2 voi env moi.
6. Goi health check production.

Khong chay lai seed khi publish thong thuong. Seed chi dung khi co ke hoach import
data ro rang va da backup.

### Khi chi sua `.env`

```bash
ssh deploy@34.87.55.1
cd /home/deploy/nihongo-bjt
nano .env
pm2 restart all --update-env
pm2 save
curl -fsS https://api.34-87-55-1.sslip.io/api/health/ready
```

### Khi sua config container

```bash
sudo docker compose \
  --env-file deploy/gcp/runtime/infrastructure.env \
  -f deploy/gcp/compose.infrastructure.yml up -d
```

### Rollback nhanh

Truoc moi release, script da tao dump database. Neu release loi:

```bash
pm2 logs --lines 150
git log --oneline -n 10
git checkout COMMIT_DA_CHAY_ON
./deploy/gcp/deploy-release.sh
```

Neu migration moi khong backward-compatible, dung release va restore dump sau
khi xac dinh dung file backup. Khong restore database trong luc app van ghi du
lieu.

## 5. GitHub Actions CI/CD

Repo da co CI tai `.github/workflows/ci.yml` va workflow publish thu cong tai
`.github/workflows/deploy-gcp.yml`. Workflow deploy sync source qua SSH, giu
nguyen `.env` va runtime secrets tren VM, sau do chay `deploy-release.sh`.

### Buoc 1 - Tao SSH deploy key rieng

Da hoan thanh tren may local ngay `2026-05-30`. Deploy public key da duoc them
vao VM va SSH test da thanh cong. Private key va known-host fingerprint nam tai:

```bash
~/.ssh/nihongo-bjt-github-actions
~/.ssh/nihongo-bjt-github-actions-known-hosts
```

Khong dung private key ca nhan cho CI.

### Buoc 2 - Tao GitHub Environment

Vao GitHub repository:

```text
Settings -> Environments -> New environment -> production
```

Them required reviewer neu repository plan cho phep. Chon chi nhanh duoc deploy
la `main`.

Them environment secrets:

```text
GCP_VM_HOST=34.87.55.1
GCP_VM_USER=deploy
GCP_VM_SSH_PRIVATE_KEY=<noi dung file ~/.ssh/nihongo-bjt-github-actions>
GCP_VM_SSH_KNOWN_HOSTS=<noi dung file ~/.ssh/nihongo-bjt-github-actions-known-hosts>
```

Khong dua database password, Redis password, Keycloak secret hoac OAuth secret
vao GitHub neu deployment van giu `.env` tren VM.

### Buoc 3 - Publish bang mot nut

Vao:

```text
GitHub -> Actions -> Deploy GCP production -> Run workflow
```

Sau khi approval, GitHub sync source va chay health check. Neu health check
khong qua, workflow fail va can xem log.

### Buoc 4 - Tu dong hoa them sau khi CI xanh

Hien tai nen giu deploy bang `workflow_dispatch` de operator bam nut sau khi xem
CI. Khi tat ca test CI da xanh on dinh, co the doi trigger thanh:

```yaml
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
```

va them dieu kien job:

```yaml
if: >
  github.event.workflow_run.conclusion == 'success' &&
  github.event.workflow_run.head_branch == 'main'
```

Production environment van nen giu approval.

## 6. Secrets: hien tai va buoc nang cap

Hien tai secrets nam trong:

```text
/home/deploy/nihongo-bjt/.env
/home/deploy/nihongo-bjt/deploy/gcp/runtime/infrastructure.env
```

Hai file co mode `600`, khong commit, khong rsync tu CI.

Khi bat dau co OAuth, SMTP, thanh toan hoac API key ton phi, nen chuyen secrets
quan trong sang Google Cloud Secret Manager:

1. Bat Secret Manager API.
2. Tao mot secret rieng cho tung gia tri.
3. Gan service account rieng cho VM.
4. Chi cap role `Secret Manager Secret Accessor` cho cac secret VM can doc.
5. Tao script render `.env` tu Secret Manager truoc khi restart PM2.
6. Rotate secret dinh ky va restart process sau rotate.

Compute Engine co the xac thuc qua instance metadata, nen khong dat service
account JSON key tren VM.

## 7. Co nen dung Jenkins khong?

Chua nen cai Jenkins tren VM app hien tai. VM chi co `2 vCPU`, `8 GB RAM`, trong
khi cung dang chay PostgreSQL, Redis, Meilisearch, MinIO, Keycloak, API va hai
Next.js app. Jenkins them Java runtime, plugin maintenance va mot admin UI can
bao ve.

Neu sau nay can Jenkins:

1. Tao VM rieng toi thieu `4 GB RAM`.
2. Chi mo Jenkins qua VPN, Identity-Aware Proxy hoac reverse proxy co auth.
3. Dung Jenkins LTS Docker image va volume rieng cho `/var/jenkins_home`.
4. Tao credential SSH deploy rieng, khong dung credential production cua nguoi.
5. Tao pipeline build/test truoc, sau do SSH vao VM app chay
   `deploy-release.sh`.
6. Backup Jenkins home va cap nhat plugin dinh ky.

GitHub Actions hien tai don gian hon va du cho mot VM production.

## 8. Tai lieu tham khao chinh thuc

- GitHub Actions deployment environments:
  https://docs.github.com/en/actions/reference/deployments-and-environments
- GitHub Actions deploying:
  https://docs.github.com/en/actions/concepts/use-cases/deploying-with-github-actions
- Google Secret Manager best practices:
  https://docs.cloud.google.com/secret-manager/regional-secrets/best-practices-rs
- Jenkins Docker installation:
  https://www.jenkins.io/doc/book/installing/docker/
