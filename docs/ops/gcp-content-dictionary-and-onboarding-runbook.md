# NihonGo BJT - Dictionary import va onboarding production

Tai lieu nay ghi lai thay doi production ngay `2026-05-30`.

## 1. Loi onboarding hoi lai moi lan ve trang chu

Modal `Trinh do hien tai cua ban?` phai luu trang thai qua API va PostgreSQL,
khong dung `localStorage`.

Production tung thieu schema `recommendation`, nen API khong luu duoc preference
hoac thao tac skip. UI cu van dong modal khi API loi, vi vay nguoi dung thay modal
lap lai moi lan ve trang chu.

Schema duoc ap dung bang:

```bash
cd /home/deploy/nihongo-bjt
./deploy/gcp/apply-recommendation-schema.sh
```

`deploy/gcp/deploy-release.sh` cung goi script nay sau Prisma migration de release
sau khong bo sot schema raw SQL.

Kiem tra:

```bash
sudo docker exec gcp-postgres-1 \
  psql -U postgres -d nihongo_bjt -Atc \
  "select count(*) from information_schema.tables where table_schema = 'recommendation';"
```

Ket qua production: `2`.

UI chi dong modal sau khi API save hoac skip thanh cong. Neu API loi, UI hien
thong bao de nguoi dung thu lai.

## 2. Nguon dictionary chinh xac

Nguon canonical local la PostgreSQL trong Docker, expose tren:

```text
postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt
```

Khong dung PostgreSQL Homebrew tren port `5432`.

Kiem tra truoc khi dump:

```bash
PGPASSWORD=postgres psql \
  'postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt' \
  -Atc "select current_database(), current_user, inet_server_port();"
```

## 3. Backup production truoc import

```bash
ssh deploy@34.87.55.1
cd /home/deploy/nihongo-bjt
./deploy/gcp/backup-postgres.sh
ls -lh /home/deploy/backups/postgres
```

Backup truoc import ngay `2026-05-30`:

```text
/home/deploy/backups/postgres/nihongo_bjt-20260530T121306Z.dump
/home/deploy/backups/postgres/keycloak-20260530T121306Z.dump
```

## 4. Dump dictionary tu Docker local

Chi dump dictionary, staging va provenance. Khong dump toan bo schema `content`,
vi production con co announcement, NHK news va scenario data rieng.

```bash
mkdir -p tmp/dictionary-migration
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump="tmp/dictionary-migration/content-dictionary-docker15432-$timestamp.dump"

PGPASSWORD=postgres /opt/homebrew/opt/postgresql@18/bin/pg_dump \
  'postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt' \
  --format=custom --compress=6 --data-only \
  --table=content.content_import_batch \
  --table=content.content_raw_item \
  --table=content.content_import_error \
  --table=content.entity_import_provenance \
  --table=content.example_sentence \
  --table=content.grammar_point \
  --table=content.grammar_point_detail \
  --table=content.grammar_point_detail_example \
  --table=content.kanji \
  --table=content.kanji_component \
  --table=content.kanji_example \
  --table=content.lexeme \
  --table=content.lexeme_sense \
  --table=content.lexeme_sense_example \
  --table=content.lexeme_reverse_projection \
  --table=content.lexeme_reverse_candidate \
  --table=content.lexeme_reverse_candidate_example \
  --file "$dump"

scp "$dump" deploy@34.87.55.1:/home/deploy/content-dictionary-import.dump
```

Dung `pg_dump` PostgreSQL 18 vi local Docker dang chay PostgreSQL 17. `pg_dump`
PostgreSQL 15 cua he thong cu khong dump duoc server moi hon.

## 5. Restore vao production rong

Lenh duoi co guard: chi restore khi bon bang canonical chinh dang rong. Day la
import lan dau. Khong bo guard de chay de khi production da co dictionary.

```bash
ssh deploy@34.87.55.1
cd /home/deploy/nihongo-bjt

./deploy/gcp/backup-postgres.sh

nonempty="$(
  sudo docker exec gcp-postgres-1 \
    psql -U postgres -d nihongo_bjt -Atc \
    "select count(*) from content.lexeme
     union all select count(*) from content.lexeme_sense
     union all select count(*) from content.kanji
     union all select count(*) from content.grammar_point;" |
    awk '$1 != 0 { bad=1 } END { print bad ? "yes" : "no" }'
)"
test "$nonempty" = no

sudo docker cp \
  /home/deploy/content-dictionary-import.dump \
  gcp-postgres-1:/tmp/content-dictionary-import.dump

sudo docker exec gcp-postgres-1 \
  pg_restore \
  --username postgres \
  --dbname nihongo_bjt \
  --data-only \
  --single-transaction \
  --exit-on-error \
  /tmp/content-dictionary-import.dump

sudo docker exec gcp-postgres-1 \
  rm -f /tmp/content-dictionary-import.dump
rm -f /home/deploy/content-dictionary-import.dump
```

`--single-transaction` dam bao restore loi thi khong de lai du lieu nua voi.

## 6. Verify va dung lai Meilisearch projection

So lieu production sau restore:

```text
lexeme=252175
lexeme_sense=304887
example_sentence=296841
kanji=13093
grammar_point=2149
content_raw_item=619243
entity_import_provenance=619243
```

Cap nhat PostgreSQL planner statistics:

```bash
sudo docker exec gcp-postgres-1 psql -U postgres -d nihongo_bjt -c \
  "ANALYZE content.lexeme;
   ANALYZE content.lexeme_sense;
   ANALYZE content.lexeme_reverse_projection;
   ANALYZE content.example_sentence;
   ANALYZE content.kanji;
   ANALYZE content.grammar_point;"
```

Dung lai search projection:

```bash
cd /home/deploy/nihongo-bjt
set -a
. ./.env
set +a
pnpm search:index
```

Script index doc PostgreSQL theo batch `10,000`, xoa projection cu va cho
Meilisearch xu ly xong tung batch. Script index day du lexeme, kanji va grammar.
Example sentence la search projection phu nen gioi han `5,000` item de tranh
ton CPU va disk khong can thiet tren VM. PostgreSQL van giu day du example.

Ket qua production: `265111` search documents, `isIndexing=false`.

Smoke test:

```bash
curl -fsS \
  'https://api.34-87-55-1.sslip.io/api/search?q=%E4%BC%9A%E8%AD%B0&limit=3'

curl -fsS \
  'https://api.34-87-55-1.sslip.io/api/health/ready'
```

## 7. Rollback dictionary import

Neu can rollback, dung backup app database tao ngay truoc import:

```bash
ssh deploy@34.87.55.1
cd /home/deploy/nihongo-bjt

sudo docker cp \
  /home/deploy/backups/postgres/nihongo_bjt-20260530T121306Z.dump \
  gcp-postgres-1:/tmp/nihongo_bjt-before-dictionary.dump

# Chi thuc hien trong maintenance window sau khi da xac nhan rollback.
sudo docker exec gcp-postgres-1 \
  pg_restore \
  --username postgres \
  --dbname nihongo_bjt \
  --clean \
  --if-exists \
  --exit-on-error \
  /tmp/nihongo_bjt-before-dictionary.dump
```

Sau rollback, chay lai `pnpm search:index` va smoke test health/search.
