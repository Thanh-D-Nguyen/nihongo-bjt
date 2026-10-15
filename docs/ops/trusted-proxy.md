# Trusted proxy and API rate limits

The Go API resolves the visitor address once per request (`clientIPMiddleware`)
and uses it for every IP-keyed limiter: login, admin login, registration,
password recovery, feedback, media upload and public reads. The rightmost valid
`X-Forwarded-For` address is accepted only when the direct peer is loopback or
inside `TRUSTED_PROXY_CIDRS`; any other peer is keyed by its own address and
cannot choose its identity with a forwarded header.

Set `TRUSTED_PROXY_CIDRS` to the network the proxies connect from. In the Oracle
Docker Compose topology Caddy and the web BFF are separate containers, so the
peer is a bridge-network address, not loopback; `deploy/oci/docker-compose.oci.yml`
trusts the private ranges by default and `OCI_TRUSTED_PROXY_CIDRS` overrides it.
Leaving it unset behind containers puts every visitor into one bucket (one
site-wide login limit), so verify it after changing the network layout.

Keep the API port private and have Caddy overwrite the actual connection
address. If a public load balancer is introduced ahead of Caddy, configure
Caddy's trusted proxy ranges and verify the rightmost forwarded address is the
visitor rather than the shared load-balancer address.

The `TRUST_PROXY` setting below applies only to the legacy Nest/Express API;
it is not used by the Go API.

Set:

```dotenv
TRUST_PROXY=loopback
```

`loopback` is the default and is appropriate when Caddy connects from
`127.0.0.1` or `::1`. If the reverse proxy connects over a private container
network, select `linklocal` or `uniquelocal` only after confirming the actual
source range. Blanket values such as `true` or an unrestricted hop count are
not accepted.

Caddy must pass its standard `X-Forwarded-For` header and the API port must not
be directly exposed publicly. This lets anonymous ad throttles isolate real
visitor IPs rather than putting every visitor into the proxy's shared bucket.
