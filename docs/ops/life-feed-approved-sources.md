# Approved Life Lessons sources and daily refresh

The operator approved MET Norway, Wikidata, and the fixed geography template on 2026-10-26. This approval covers ten named Japanese locations and the sentence `東京は日本にあります。` / `とうきょうはにほんにあります。` (“Tokyo is in Japan”), with equivalent reviewed place names/readings for the other nine supported cities. It does not approve arbitrary wiki text, scraped articles, paid providers, or invented live facts.

## Sources

- [MET Norway Locationforecast terms](https://api.met.no/doc/TermsOfService) and [licensing](https://api.met.no/doc/License): free commercial use under CC BY 4.0. The existing provider preserves attribution, uses an actual operator contact, honors `Expires` and conditional revalidation, and rounds coordinates to four decimals. It labels forecasts as forecasts.
- [Wikidata data access](https://www.wikidata.org/wiki/Wikidata:Data_access/en): structured data are CC0, including commercial reuse. The publisher requests ten known entity IDs in one identified request, checks each Japanese identity, revision, modification time and non-deprecated country claim (`P17=Q17`), and copies no arbitrary Japanese prose or images. Lessons link to the exact source revision and name CC0. The request deliberately omits `maxlag`: that throttle is for batch writers and Wikidata counts unrelated query-service lag toward it (it blocked the first production refresh on 2026-10-26 while `wbgetentities` itself was healthy). One identified read per run is the politeness contract. MediaWiki API errors returned with HTTP 200 (`maxlag`, `readonly`, `ratelimited`) fail the refresh explicitly as `Wikidata API error "<code>"` and publish nothing.
- [Wikimedia User-Agent policy](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy): identify the application and a reachable operator contact. The project's public issue tracker is the configured contact; do not substitute a private repository or nonexistent support address.

## Activation

Set only these entries in the existing private production environment file, preserving every other value:

```dotenv
MET_NORWAY_USER_AGENT="KotobaWorksLifeBot/1.0 (+https://github.com/Thanh-D-Nguyen/nihongo-bjt/issues)"
LIFE_FEED_SOURCE_USER_AGENT="KotobaWorksLifeBot/1.0 (+https://github.com/Thanh-D-Nguyen/nihongo-bjt/issues)"
LIFE_FEED_APPROVED_TEMPLATE=wikidata-geography-v1
LIFE_FEED_APPROVED_REVIEWER_ID=<existing approving admin UUID>
```

The existing active actor must still hold `admin.content.write` or `*` through an active role. No admin, credential, permission grant or account is created by the publisher. A changed template needs renewed operator approval; an empty or different approved-template value fails closed.

Release through the existing CI-validated Oracle deployment, then dispatch `refresh-life-feed.yml` once. The workflow subsequently runs at 02:17 JST daily using the existing production runner and image. It shares the deployment lock and concurrency group. It uses no paid model, API subscription or additional host.

## Publication and failure behavior

`life-feed-sync` validates the entire source batch before a PostgreSQL transaction. It inserts ten date-keyed, rights-cleared lessons with the approving reviewer, exact source revision, readings, Vietnamese/English text, recall and recognition exercises, plus one audit event. Only this approved deterministic template can be published by the command.

An unchanged same-day replay inserts no rows and no duplicate audit. Existing published editorial content wins; existing draft, blocked or expired keys stop the transaction for a human decision. No editorial row is updated or deleted. A source error, rate limit, missing identity, changed country assertion or invalid reading publishes nothing and leaves the last valid snapshot intact. A failed workflow remains failed rather than reporting successful refresh.

Stored source snapshots expire 48 hours after their actual fetch and are visible only through the following JST calendar day. The reader still caps client caching at midnight. This covers the midnight-to-refresh interval and one delayed daily run; it does not relabel old data as newly fetched. Once expired, the existing feed rejects it. The reviewed-content gate, manual review/rights workflow and sample-fallback behavior remain enforced.

Check `/api/life/feed?city=tokyo` and the other nine fixed city IDs after activation: a valid editorial culture lesson opens the feed, date is computed for JST, and licensed weather is added when MET is available. Inspect the source timestamps and `life_lesson.source_sync` audit. If refresh fails, inspect that run before retrying; do not clear review holds or extend timestamps to force the feed open.

## Location and optional providers

This first approved source pipeline serves the existing ten-city contract. A Wikidata geography lesson is not an assertion of the learner's GPS location. iOS GPS weather, reverse geocoding and nearby places are separate data capabilities; sending coordinates does not make a weather API supply POIs.

[Yahoo Weather](https://developer.yahoo.co.jp/webapi/map/openlocalplatform/v1/weather.html) allows 50,000 requests per 24 hours per app and supplies precipitation observations/forecasts up to 60 minutes, not a complete temperature/multiday forecast. [YOLP terms](https://developer.yahoo.co.jp/webapi/map/faq.html) require separate consideration for paid/member-only services and restrict storage; the free quota alone is not approval for this monetized app.

[WeatherAPI pricing](https://www.weatherapi.com/pricing) lists 100,000 monthly free calls and three-day forecasts. Its [terms](https://www.weatherapi.com/terms) allow commercial app use, require source credit for free use, and bind a key/subscription to one application/service. No account, key, paid plan or WeatherAPI integration is activated by this release. The already-approved MET provider avoids a new key while the location contract is designed.

## Rollback

Disable the refresh workflow or remove its source-template approval to stop new publication. Disable MET by clearing its user-agent environment entry and perform an ordinary compatible release. Use the existing audited admin workflow to archive only these managed card keys if publication must be withdrawn. Keep audit history and all unrelated content/users. Do not restore a database backup over subsequent user activity.
