# 11 — Observability (Rebaselined)

Keep observability lightweight enough for the free host.

## Application logs

Structured JSON or consistently parseable text via `slog`.

Include:

- timestamp;
- severity;
- request ID;
- route;
- duration;
- status;
- safe user identifier when appropriate;
- error code.

Do not include secrets, tokens, passwords, or full Authorization/Cookie headers.

## Core metrics

At minimum expose or derive:

```text
request count
latency histogram
HTTP error count
DB pool in-use/idle/wait
auth login success/failure counters
rate-limit events
Go heap / GC
goroutine count
search latency/errors
object-storage errors
streaming upload size/duration/count
private media stream size/duration/count
websocket connection count/message rate
background job execution count/duration/failure
```

## Health endpoints

Separate:

```text
/livez
/readyz
```

`livez` should not fail merely because a transient dependency is slow.

`readyz` may verify critical dependencies (PostgreSQL, Redis where required).

## Host monitoring

Track:

```text
CPU
load
memory
swap
disk usage
disk IO
network
container restarts
OOM events
```

## Alerts

At minimum operationally notice:

- disk >80/90%;
- repeated container restart;
- OOM;
- DB unavailable;
- API sustained 5xx;
- TLS expiry risk;
- Oracle budget threshold alerts;
- background job repeated failure;
- upload failures exceeding threshold;
- WebSocket connection drop spikes.

## Log retention

Configure rotation.

A free 200 GB storage budget can be destroyed by unbounded logs.

Streaming upload and private media delivery generate per-request log lines; ensure they are sampled or structured to avoid excessive volume under load.