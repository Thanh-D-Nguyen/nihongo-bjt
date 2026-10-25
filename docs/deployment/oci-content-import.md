# Nhập nội dung PostgreSQL local lên Oracle

Runbook cho Compose project `oci`, database `nihongo_bjt`, host SSH `kotobawork-prod`. Releases chỉ migrate schema, **không seed và không xoá nội dung**. PostgreSQL là nguồn chuẩn; Meilisearch phải được rebuild riêng sau import.

## Gói dữ liệu đã kiểm chứng ngày 2026-10-16

Nguồn là snapshot PostgreSQL 17 local, không phải database mẫu. Gói chỉ chứa nội dung học và provenance đã kiểm tra; không chứa user, mật khẩu, session, tiến độ học, deck riêng, thanh toán hay cấu hình dịch vụ. Giữ nguyên trạng thái duyệt của nguồn; số lượng có thể tìm kiếm nhỏ hơn tổng số đã nhập.

| Nội dung                            |         Số lượng |
| ----------------------------------- | ---------------: |
| Từ vựng                             |          252.175 |
| Kanji                               |           13.093 |
| Ngữ pháp                            |            2.149 |
| Câu ví dụ                           |          296.841 |
| Nghĩa từ / liên kết ví dụ của nghĩa | 304.887 / 73.559 |
| Nghĩa ngữ pháp / ví dụ ngữ pháp     |    2.244 / 9.060 |
| Bài học BJT                         |              504 |
| Bộ đề / câu hỏi / đáp án            | 15 / 846 / 3.384 |
| Deck công khai / thẻ                |           2 / 30 |
| Bài NHK / tạp chí / radar           |  1.323 / 30 / 51 |

Manifest ghi đủ **43 bảng, 2.438.485 hàng**, gồm cả staging/provenance và các liên kết. Không cộng con số này như số mục học độc lập.

- 504 bài học lưu nội dung trong `lesson_content` JSON; `bjt_lesson_item` trống là đúng với nguồn này.
- 6 đề practice v3 và 3 đề full simulation có đủ 80 câu/đề; 6 bộ practice cũ có 21 câu/bộ. Mọi câu có 4 lựa chọn và đúng 1 đáp án.
- Kèm 15 định nghĩa module radar vì các thẻ cần chúng. Không thay cấu hình provider, monetization, quảng cáo hay các nội dung nền đã có trên production.
- Loại 8 fixture từ điển `audit141`, 3 fixture đề thi, 2.958 đáp án mồ côi và URL media seed không xác minh được. Không tạo ảnh, audio hoặc gọi dịch vụ AI trả phí.

Các file nằm **ngoài Git**, quyền thư mục 700/file 600:

| Vị trí                                                          | Mục đích                                                                   |
| --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Local `~/.kotobawork/imports/20261016-oci-content/`             | Snapshot riêng tư, manifest, công cụ export và kết quả rehearsal           |
| Oracle `/srv/kotobawork/data/backups/content/`                  | Gói nội dung được phép nhập, manifest, SQL kiểm tra và backup production   |
| `source-local.dump` (chỉ local)                                 | Snapshot đầy đủ có dữ liệu riêng tư; **không đưa lên Git hoặc production** |
| `production-before.dump` / Oracle `before-import-20261016.dump` | Backup trước lần nhập đầu, có secrets; không chia sẻ công khai             |
| `canonical-content-20261016.sql.gz`                             | Gói nội dung đã lọc, nạp vào bảng tạm rồi kiểm tra trước INSERT            |
| `canonical-content-20261016.manifest.json`                      | Counts và checksum của gói                                                 |
| `verify-counts.sql`, `verify-relations.sql`, `protected.sql`    | Kiểm tra counts, quan hệ và dấu vân tay bảng ngoài phạm vi nhập            |

Gói SQL gzip có **306.828.923 byte**, SHA-256:

```text
93d128f5eab5861d942f9b39f780c3c314ed535ba85934f6b5b785afbaaa84de
```

Không ghi đè file đã duyệt bằng một export mới cùng tên. Gói không phụ thuộc password PostgreSQL local và không có lệnh xoá hay truncate dữ liệu production.

## Nhập lại chính gói này

Chạy trên workstation trước:

```bash
ssh -o ConnectTimeout=10 kotobawork-prod echo ok
ssh kotobawork-prod
```

Nếu IP nhà thay đổi, cập nhật allowlist TCP 22 ở cả OCI security list và UFW theo `oci.md`; không mở `0.0.0.0/0`.

Trong một phiên **bash trên Oracle**, giữ nguyên phiên cho tới khi kiểm tra xong:

```bash
set -euo pipefail
umask 077
cd /srv/kotobawork
mountpoint -q data
exec 9>runtime/deploy.lock
flock -n 9
content_dir=/srv/kotobawork/data/backups/content
psql_prod() {
  sudo docker exec -i oci-postgres-1 psql -X -Atq \
    -v ON_ERROR_STOP=1 -U postgres -d nihongo_bjt
}
cd "$content_dir"
for required_file in canonical-content-20261016.manifest.json verify-counts.sql verify-relations.sql protected.sql; do
  test -s "$required_file"
done
printf '%s  %s\n' \
  93d128f5eab5861d942f9b39f780c3c314ed535ba85934f6b5b785afbaaa84de \
  canonical-content-20261016.sql.gz | sha256sum --check -
gzip -t canonical-content-20261016.sql.gz
```

Nếu lock bận, chờ deployment kết thúc rồi chạy lại. Nếu checksum sai, dừng; không nhập file đang truyền dở. Lock này ngăn deployment đồng thời; không ngăn người dùng ghi dữ liệu qua ứng dụng.

**Preflight audit cho đúng gói 2026-10-16:** bản này chọn admin đầu tiên để ghi audit. Chỉ chạy nếu production vẫn có đúng một admin và đó là operator đã xác minh có quyền `*`. Nếu đã thêm admin khác, cần gói mới gắn rõ actor; không sửa tài khoản để vượt qua kiểm tra.

```bash
operator_ok=$(psql_prod <<'SQL'
SELECT count(*)=1 AND bool_and(a.id='e53d8fb2-23a9-4ef7-9d91-f1a6aafd44e4'::uuid)
AND bool_and(EXISTS (
  SELECT 1 FROM authz.admin_actor_role ar
  JOIN authz.admin_role_permission rp ON rp.role_id=ar.role_id
  JOIN authz.admin_permission p ON p.id=rp.permission_id
  WHERE ar.actor_id=a.id AND p.code='*'
)) FROM authz.admin_actor a;
SQL
)
test "$operator_ok" = t
run_stamp=$(date -u +%Y%m%dT%H%M%SZ)
test ! -e "before-$run_stamp.dump"
sudo docker exec oci-postgres-1 pg_dump -U postgres -d nihongo_bjt -Fc \
  > "before-$run_stamp.dump"
sudo docker exec -i oci-postgres-1 pg_restore --list \
  < "before-$run_stamp.dump" > /dev/null
psql_prod < protected.sql > "protected-before-$run_stamp.txt"
gzip -dc canonical-content-20261016.sql.gz | \
  psql_prod > "import-$run_stamp.log"
psql_prod < verify-counts.sql > "counts-$run_stamp.txt"
psql_prod < verify-relations.sql > "relations-$run_stamp.txt"
psql_prod < protected.sql > "protected-after-$run_stamp.txt"
diff -u "protected-before-$run_stamp.txt" "protected-after-$run_stamp.txt"
```

SQL dùng một transaction, giữ foreign keys/triggers, staging có kiểu dữ liệu của production, và INSERT theo thứ tự cha/con. ID đã có cùng nội dung được bỏ qua; cùng ID nhưng nội dung khác sẽ **abort toàn bộ transaction**, không ghi đè. Lần chạy thử và chạy lại cùng gói đã khớp toàn bộ counts, không thêm audit trùng, giữ nguyên 149 bảng ngoài phạm vi nhập (audit được kiểm riêng).

So sánh counts tự động với manifest. Dùng `exact` khi nhập lần đầu; khi chạy lại sau khi production có thêm nội dung, đổi tham số thứ hai thành `at-least`:

```bash
python3 - "$run_stamp" exact <<'PY'
import json, pathlib, sys
stamp = sys.argv[1]
assert sys.argv[2] in ('exact', 'at-least')
manifest = json.loads(pathlib.Path('canonical-content-20261016.manifest.json').read_text())
actual = dict(line.split('|') for line in pathlib.Path(f'counts-{stamp}.txt').read_text().splitlines())
for table, expected in manifest['tables'].items():
    count = int(actual[table])
    assert (count == expected['rows'] if sys.argv[2] == 'exact' else count >= expected['rows']), table
print('PASS: 43 table counts')
PY
psql_prod <<'SQL'
SELECT count(*) AS invalid_questions FROM (
  SELECT q.id FROM assessment.bjt_question q
  LEFT JOIN assessment.bjt_question_option o ON o.question_id=q.id
  GROUP BY q.id
  HAVING count(o.id)<>4 OR count(o.id) FILTER (WHERE o.is_correct)<>1
) bad;
SELECT actor_id, action, target_id, after
FROM ops.admin_audit_log
WHERE action='ops.content.import' AND target_id='canonical-content-20261016';
SQL
flock -u 9
```

Yêu cầu: `invalid_questions=0`, không có quan hệ mồ côi, audit đúng **1 hàng**, actor đúng operator trên và `after` khớp 43 counts trong manifest. `protected.sql` chỉ xuất count/hash, không xuất nội dung tài khoản. Nếu diff báo thay đổi, phân biệt ghi hợp lệ của người dùng và lỗi import trước khi kết luận; không khôi phục đè user. Pipeline import phải exit 0; chế độ `psql -q` không in COMMIT, nên audit và counts đọc từ kết nối mới là bằng chứng transaction đã commit.

Nếu SSH mất giữa chừng, kiểm tra audit/counts trước khi chạy lại. Mất kết nối trước COMMIT làm transaction rollback; sau COMMIT dữ liệu đã nhập. Chính gói bất biến này chạy lại an toàn khi nội dung chưa bị biên tập. Nếu báo collision do nội dung được sửa sau import, dừng và lập import cập nhật có review; không xoá nội dung để ép chạy.

## Rebuild Meilisearch và kiểm tra phía người học

Database trống search cần bootstrap index `content_search` có primary key `id`, và `filterableAttributes` chứa `kind` trước khi tìm theo loại. Thực hiện qua loopback `127.0.0.1:17700` với master key lấy trong bộ nhớ từ container; không in key, không mở port public. Việc này đã được làm cho cài đặt này. Không cần tạo lại index trong các lần rebuild sau; nếu phục hồi Meilisearch trống, tạo index, đợi task thành công, thêm `kind` vào settings rồi đợi task settings thành công.

Nếu Meilisearch vừa được phục hồi trống, chạy trên Oracle (chỉ cho trường hợp index chưa tồn tại):

```bash
python3 - <<'PY'
import json, subprocess, time, urllib.request
values = json.loads(subprocess.check_output([
    'sudo', 'docker', 'inspect', '--format', '{{json .Config.Env}}', 'oci-meilisearch-1']))
env = dict(item.split('=', 1) for item in values)
def api(path, method='GET', data=None):
    req = urllib.request.Request('http://127.0.0.1:17700' + path,
        data=None if data is None else json.dumps(data).encode(), method=method,
        headers={'Authorization': 'Bearer ' + env['MEILI_MASTER_KEY'], 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.load(response)
def wait(task):
    for attempt in range(30):
        result = api('/tasks/' + str(task['taskUid']))
        if result['status'] == 'succeeded':
            return
        assert result['status'] not in ('failed', 'canceled'), result.get('error')
        time.sleep(1)
    raise RuntimeError('Task chưa xong; kiểm tra task trước khi chạy tiếp')
assert not any(i['uid'] == 'content_search' for i in api('/indexes')['results']), 'Index đã có; giữ nguyên'
wait(api('/indexes', 'POST', {'uid': 'content_search', 'primaryKey': 'id'}))
wait(api('/indexes/content_search/settings', 'PATCH', {'filterableAttributes': ['kind']}))
print('PASS: content_search created; kind filter enabled')
PY
```

1. Đăng nhập Admin bằng thông tin riêng đã cấp tại `/admin/vi/login`.
2. Mở `/admin/vi/system/search-sync`, chọn rebuild toàn bộ, nhập lý do và chuỗi xác nhận `rebuild-search-projection`. Trang gọi `PATCH /api/admin/operations/search-rebuild` qua session/RBAC/Origin-CSRF và ghi audit.
3. Chờ các task Meilisearch thực sự `succeeded`. HTTP thành công chỉ có nghĩa đã xếp hàng; task ID **0 cũng hợp lệ**. Kiểm tra lỗi task và stats qua loopback bằng key trong bộ nhớ, không xuất key ra terminal. Nếu full rebuild vượt timeout, dùng partial lần lượt `lexeme`, `kanji`, `grammar`, `example` trong cùng trang.
4. Đối chiếu số document với `SELECT kind,count(*) FROM reporting.v_content_search_documents GROUP BY kind;`. Với snapshot này: lexeme 252.175, kanji 5.787, grammar 2.149, example 296.595, tổng **556.706**. Không tự publish nội dung đang chờ duyệt chỉ để tăng số kết quả.

Để xem task và stats trên Oracle sau rebuild, lấy mảng `taskUids` trong response của request rebuild (DevTools → Network khi dùng trang Admin). Trên shell Oracle, chạy `read` dưới đây, dán mảng JSON đó thành một dòng và Enter, rồi export biến. Đây là ID task, không phải secret:

```bash
read -r CURRENT_TASK_UIDS
export CURRENT_TASK_UIDS
```

Dùng phần đọc key và hàm `api` trong đoạn Python trên, thay phần từ `assert not any(...)` trở đi bằng đoạn dưới. Chỉ kiểm tra task của lần rebuild hiện tại để lỗi lịch sử không làm sai kết luận:

```python
import os
current_task_ids = json.loads(os.environ['CURRENT_TASK_UIDS'])
assert current_task_ids and all(type(uid) is int and uid >= 0 for uid in current_task_ids)
tasks = api('/tasks?uids=' + ','.join(map(str, current_task_ids)) + '&limit=1000')['results']
assert {task['uid'] for task in tasks} == set(current_task_ids), 'Chưa nhận đủ task'
print([(task['uid'], task['status'], task.get('error')) for task in tasks if task['status'] != 'succeeded'])
stats = api('/indexes/content_search/stats')
print(stats)
assert all(task['status'] == 'succeeded' for task in tasks) and not stats['isIndexing'], 'Chưa hoàn tất hoặc có task lỗi'
assert stats['numberOfDocuments'] == 556706, 'Đối chiếu lại projection PostgreSQL nếu nguồn đã đổi'
```

Nếu còn enqueued/processing, chờ rồi đọc lại; không gửi thêm rebuild liên tục. Task failed/canceled cần kiểm tra nguyên nhân trước khi retry. Với lần chạy sau có thêm dữ liệu, thay số cố định bằng tổng projection hiện tại.

### Fallback trên host cho snapshot lớn

Lần nhập 2026-10-16 cho thấy cả full và partial rebuild qua HTTP có thể trả 502 khi vượt timeout (`ServerWriteTimeout` mặc định 15 giây, middleware 30 giây). Request có thể đã enqueue một phần trước khi lỗi; không coi HTTP lỗi là chưa có task. Container API không bị OOM hoặc restart. Kiểm tra task/stats trước khi retry.

Với **đúng snapshot cố định của runbook này**, dùng helper dưới đây trên Oracle. Nó đọc projection PostgreSQL, gửi batch 1.000 document qua loopback, chờ task thực sự thành công, đối chiếu tổng và số lượng từng loại, rồi ghi audit vào operator đã xác minh. Không sửa dữ liệu chuẩn hoặc đổi cấu hình timeout/container. Đã kiểm tra các trường hợp task ID 0, task thất bại và index có document thừa bằng fixture cô lập.

Helper chỉ upsert. Nếu nguồn đã đổi hoặc index có document cũ ngoài nguồn, nó dừng ở kiểm tra counts thay vì tự xoá; cần review việc reconcile nguồn mới. Lưu JSONL, receipt task IDs và audit của cả lần thành công/thất bại dưới thư mục backup riêng. Không chạy helper song song với rebuild trong Admin.

Tạo lại helper khi cần (toàn bộ mã nguồn ở đây, không cần thư viện Python bên ngoài):

```bash
umask 077
cat > /srv/kotobawork/data/backups/content/rebuild-search-local.py <<'PY'
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request

os.umask(0o077)
BASE = Path('/srv/kotobawork/data/backups/content')
ACTOR = 'e53d8fb2-23a9-4ef7-9d91-f1a6aafd44e4'
EXPECTED = {'lexeme': 252175, 'kanji': 5787, 'grammar': 2149, 'example': 296595}
PSQL = ['sudo', 'docker', 'exec', '-i', 'oci-postgres-1', 'psql', '-X', '-Atq', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'nihongo_bjt']

def sql(query):
    return subprocess.check_output(PSQL, input=query.encode()).decode().strip()

assert sql("SELECT EXISTS (SELECT 1 FROM authz.admin_actor a JOIN authz.admin_actor_role ar ON ar.actor_id=a.id JOIN authz.admin_role_permission rp ON rp.role_id=ar.role_id JOIN authz.admin_permission p ON p.id=rp.permission_id WHERE a.id='" + ACTOR + "'::uuid AND p.code='*');") == 't'
actual = json.loads(sql('SELECT json_object_agg(kind,n) FROM (SELECT kind,count(*) n FROM reporting.v_content_search_documents GROUP BY kind) t;'))
assert actual == EXPECTED, actual
assert int(sql('SELECT count(DISTINCT id) FROM reporting.v_content_search_documents;')) == sum(EXPECTED.values())
values = json.loads(subprocess.check_output(['sudo', 'docker', 'inspect', '--format', '{{json .Config.Env}}', 'oci-meilisearch-1']))
env = dict(value.split('=', 1) for value in values)

def api(path, method='GET', data=None):
    req = urllib.request.Request('http://127.0.0.1:17700' + path, method=method,
        data=None if data is None else json.dumps(data, ensure_ascii=False).encode(),
        headers={'Authorization': 'Bearer ' + env['MEILI_MASTER_KEY'], 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)

assert api('/indexes/content_search')['primaryKey'] == 'id'
assert 'kind' in api('/indexes/content_search/settings')['filterableAttributes']
stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
source = BASE / ('search-projection-' + stamp + '.jsonl')
with source.open('xb') as output:
    subprocess.run(PSQL, input=b'SELECT row_to_json(d) FROM (SELECT id::text,kind,title,reading,description FROM reporting.v_content_search_documents ORDER BY kind,id) d;', stdout=output, check=True)
source_sha = hashlib.file_digest(source.open('rb'), 'sha256').hexdigest()
# This operator procedure upserts an unchanged snapshot. It never deletes old documents.
result = {'status': 'running', 'documentCount': 0, 'taskUids': [], 'sourceSha256': source_sha}
counts = {kind: 0 for kind in EXPECTED}
error = None
try:
    batch = []
    with source.open() as stream:
        for line in stream:
            document = json.loads(line)
            assert document['id'] and document['kind'] in EXPECTED
            counts[document['kind']] += 1
            batch.append(document)
            if len(batch) == 1000:
                task = api('/indexes/content_search/documents?primaryKey=id', 'POST', batch)
                assert type(task['taskUid']) is int and task['taskUid'] >= 0
                result['taskUids'].append(task['taskUid'])
                result['documentCount'] += len(batch)
                batch = []
                if result['documentCount'] % 50000 == 0:
                    print('enqueued', result['documentCount'], flush=True)
        if batch:
            task = api('/indexes/content_search/documents?primaryKey=id', 'POST', batch)
            assert type(task['taskUid']) is int and task['taskUid'] >= 0
            result['taskUids'].append(task['taskUid'])
            result['documentCount'] += len(batch)
    assert counts == EXPECTED, counts
    task_path = '/tasks?uids=' + ','.join(map(str, result['taskUids'])) + '&limit=1000'
    for attempt in range(240):
        tasks = api(task_path)['results']
        assert {task['uid'] for task in tasks} == set(result['taskUids'])
        failed = [task for task in tasks if task['status'] in ('failed', 'canceled')]
        assert not failed, [(task['uid'], task.get('error')) for task in failed]
        pending = sum(task['status'] != 'succeeded' for task in tasks)
        if not pending:
            break
        if attempt % 6 == 0:
            print('pending tasks', pending, flush=True)
        time.sleep(5)
    else:
        raise RuntimeError('Indexing deadline exceeded; inspect task IDs before retry')
    stats = api('/indexes/content_search/stats')
    facets = api('/indexes/content_search/search', 'POST', {'q': '', 'limit': 0, 'facets': ['kind']})['facetDistribution']['kind']
    assert not stats['isIndexing'] and stats['numberOfDocuments'] == sum(EXPECTED.values()), stats
    assert facets == EXPECTED, facets
    result.update(status='succeeded', byKind=facets, stats=stats)
except Exception as exc:
    result.update(status='failed', error=type(exc).__name__)
    error = exc
finally:
    receipt = BASE / ('search-rebuild-' + stamp + '.json')
    receipt.write_text(json.dumps(result, indent=2) + '\n')
    audit = "INSERT INTO ops.admin_audit_log(actor_id,action,target_type,target_id,reason,after) VALUES (:'actor'::uuid,'ops.search.rebuild','ops.search_index','content_search','Operator-authorized host rebuild of verified canonical snapshot; HTTP request limit bypassed; no canonical data modified',:'body'::jsonb);"
    subprocess.run(PSQL + ['-v', 'actor=' + ACTOR, '-v', 'body=' + json.dumps(result)], input=audit.encode(), check=True)
if error is not None:
    raise error
print(json.dumps({'status': result['status'], 'documentCount': result['documentCount'], 'byKind': result['byKind'], 'taskCount': len(result['taskUids']), 'receipt': str(receipt)}), flush=True)
PY
chmod 600 /srv/kotobawork/data/backups/content/rebuild-search-local.py
flock -n /srv/kotobawork/runtime/deploy.lock \
  python3 /srv/kotobawork/data/backups/content/rebuild-search-local.py
```

Kết quả cuối phải là `status: succeeded`, `documentCount: 556706`, `byKind` khớp projection và 557 task thành công. Nếu lỗi, đọc receipt JSON và task IDs trước khi chạy lại. Upsert cùng snapshot không tạo document trùng; audit mỗi lần vận hành được giữ riêng.

Kiểm tra qua public HTTPS:

```bash
curl --fail --get 'https://app.161-33-172-129.sslip.io/api/search' \
  --data-urlencode 'q=会議' --data 'scope=lexeme' --data 'limit=5'
curl --fail --get 'https://app.161-33-172-129.sslip.io/api/search' \
  --data-urlencode 'q=会' --data 'scope=kanji' --data 'limit=5'
curl --fail 'https://app.161-33-172-129.sslip.io/health/ready'
```

Mở trang tra từ, bài học và danh sách đề để kiểm tra nội dung. Các mục chưa có media nguồn hợp lệ vẫn có thể thiếu ảnh/audio; import này không chế tạo media thay thế.

## Khi nguồn local thay đổi

Không seed lại production và không restore nguyên database local lên production. Tạo phiên bản mới qua quy trình:

1. Freeze `pg_dump -Fc` local vào thư mục riêng mode 700; kiểm tra `pg_restore --list`, lưu SHA-256. Restore **local clone**, không làm biến đổi nguồn local.
2. Kiểm tra schema nguồn/đích, bản ghi mồ côi, trạng thái duyệt, giấy phép/provenance và trường riêng tư. Dictionary chỉ lấy thực thể có `entity_import_provenance`; liên kết phải trỏ tới cha được chọn. Deck chỉ công khai, active, owner NULL. Bỏ author/approver user IDs của local.
3. Với clone 2026-10-16, lịch sử audit local đã làm rỗng câu hỏi của các đề seed. Đã chạy **trên clone** các seeder hiện có `database/scripts/bootstrap/bootstrap-bjt-content.ts` và `database/scripts/seeds/bjt/seed-bjt-official-mocks.ts` bằng `pnpm exec tsx`, truyền `DATABASE_URL` qua environment riêng. Trước bootstrap, bỏ `datasetFingerprint` của 6 đề practice v3 trên clone để seeder không nhầm dữ liệu rỗng là đã hoàn tất. Không làm thao tác này trên live production.
4. Bộ export của lần này được giữ tại `~/.kotobawork/imports/20261016-oci-content/export-reviewed-content.py` cùng metadata/schema. Đây là công cụ vận hành theo snapshot, không phải importer hỗ trợ mọi schema. Chọn tên file/batch mới, cập nhật metadata, actor và source DB; không chạy đè gói cũ. Tạo native COPY vào staging có kiểu, validate, transaction INSERT và audit gắn actor cụ thể. Không import JSON thô bỏ qua staging/validation.
5. Restore backup production vào clone rehearsal. Nhập gói, kiểm tra đủ manifest, quan hệ, đáp án, private-data exclusions và hashes các bảng được bảo vệ. Chạy lại đúng gói để chứng minh idempotency. Review độc lập trước khi copy lên Oracle; kiểm checksum cả hai đầu, lấy backup mới dưới deployment lock rồi mới apply.

## Khôi phục và chi phí

Lỗi trước COMMIT tự rollback. Sau COMMIT, ưu tiên sửa chọn lọc có review và rebuild search. Backup đầy đủ dùng để restore vào môi trường cô lập, đối chiếu rồi lập kế hoạch; **không `pg_restore --clean` đè database đang có hoạt động người dùng**. Backup trước import chứa credential cũ và không bao gồm dữ liệu phát sinh sau thời điểm đó.

Quy trình dùng container, đĩa và Meilisearch sẵn có; không tạo/resize instance, volume, IP, load balancer hoặc dịch vụ trả phí, không đổi firewall 80/443. Không thể dùng điều này để khẳng định toàn tenancy Pay As You Go luôn có phí bằng 0; kiểm tra Billing riêng. Gói nội dung và backup chiếm dung lượng trên đĩa hiện có, cần theo dõi dung lượng khi giữ nhiều phiên bản.
