# Trusted proxy and API rate limits

The API uses Express client IPs for Nest throttling. Production is normally
served behind Caddy, so the API must trust the proxy hop without accepting
arbitrary forwarded addresses from the public internet.

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

