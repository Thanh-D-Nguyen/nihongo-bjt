# Production Cutover Checklist

## Before

- [ ] DB backup created.
- [ ] Backup restore tested.
- [ ] Current production release/tag recorded.
- [ ] Go release/tag recorded.
- [ ] Rollback command documented.
- [ ] Auth migration coverage verified.
- [ ] Admin authorization tests pass.
- [ ] Critical learner journey passes.
- [ ] Oracle health/resource state healthy.
- [ ] Disk has sufficient free space.
- [ ] Budget alerts active.

## Cutover

- [ ] Route/auth switch applied.
- [ ] Health checks green.
- [ ] Login works.
- [ ] Admin works.
- [ ] Practice works.
- [ ] Exam/session works.
- [ ] Progress persistence works.
- [ ] Search works.
- [ ] Media works.
- [ ] Realtime works if applicable.

## Observe

- [ ] 5xx rate normal.
- [ ] Login failures normal.
- [ ] DB pool healthy.
- [ ] CPU healthy.
- [ ] Memory healthy.
- [ ] No OOM.
- [ ] No restart loop.
- [ ] Search latency normal.

## Rollback trigger

Rollback immediately for:

- widespread authentication failure;
- authorization regression;
- data corruption/invariant violation;
- sustained severe 5xx;
- unrecoverable dependency issue;
- OOM/restart instability that threatens data.

## After stability window

- [ ] Keycloak disabled.
- [ ] Nest disabled.
- [ ] Old resources retained through rollback window.
- [ ] Final backup created.
- [ ] Delete/decommission only with explicit approval.
