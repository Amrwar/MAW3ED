# SEO notes

## Which pages exist

`src/lib/seo/landing.ts` is the only thing that decides. The pages, the
sitemap and the internal links all read it, so they cannot disagree
about what exists.

A landing page needs `MIN_BUSINESSES` (currently **1**) published
businesses. Today that means:

| page                        | generated | possible |
| --------------------------- | --------- | -------- |
| `/cities/[city]`            | 4         | 27       |
| `/categories/[category]`    | 4         | 14       |
| `/[city]/[category]`        | 5         | 378      |

The other 373 city-and-category pairs return a not-found page carrying
`noindex, nofollow`, and appear in no sitemap and no link. They are not
rendered as empty results pages, because an empty page is still a page a
search engine will judge the site by.

Raise `MIN_BUSINESSES` when there is enough data to be choosier — it is
one line, and everything downstream follows.

## Pagination

Rules, all in `src/lib/seo/meta.ts` and covered by `meta.test.ts`:

- Page one **is** the page: `/cairo/clinics` and `/cairo/clinics?page=1`
  are the same URL, and the `?page=1` form is never produced.
- A later page gets its own canonical, not one pointing back at page
  one. Page two holds different businesses; canonicalising it away would
  tell Google they do not exist.
- A later page is `noindex, follow`. Its value is the links on it, not
  the page itself — so it does not compete with page one for the same
  search, but the businesses only listed there are still reachable.
- `?page=` accepts plain digits only, up to 500. `Number()` reads `1e3`
  as 1000 and `" 2 "` as 2, which would be several URLs asking for one
  page.
- No paginated URL appears in the sitemap. Asking a crawler to fetch a
  page we have asked it not to index is a contradiction.

## Structured data

- **LocalBusiness** on every business page, from `src/lib/jsonld.ts`:
  address, opening hours (both `openingHours` and
  `openingHoursSpecification`), telephone, price range derived from real
  services, and `hasOfferCatalog` listing them.
  `aggregateRating` is emitted **only when the business has at least one
  visible review** — a rating on a business nobody has reviewed is the
  single most common way a listing site lies.
- **BreadcrumbList** and **ItemList** on landing pages. The ItemList
  names only the businesses actually on the page, so it never claims
  more than it shows.

## hreflang — deliberately absent

Arabic and English are served from the **same URL**, chosen by the
`maw3ed-lang` cookie. hreflang needs a different URL per language, so
there is nothing to point at; a tag pointing back at its own URL tells
Google two languages share one address, which is worse than silence.

Two consequences worth knowing:

1. **Googlebot only ever sees the Arabic version.** It does not carry
   cookies, so the English content is not indexed anywhere. For an
   Egyptian market that is mostly acceptable, but it is a real limit.
2. Adding hreflang properly means giving English its own URLs.

### What an `/en` prefix would take

- A route group so every page exists at both `/x` and `/en/x`.
- Middleware resolving language from the path rather than the cookie,
  with the cookie demoted to a preference used only for redirecting a
  first-time visitor.
- Every internal `Link` made locale-aware, or a wrapper that is.
- `generateStaticParams` and the sitemap doubling, each entry carrying
  `alternates.languages` pointing at its twin plus `x-default`.
- The canonical of each becoming itself, not the other.

It is a large change touching every route and every link, which is why
it is written down here rather than half-done.

## Soft 404s

`notFound()` inside a streamed page returns HTTP 200 with a not-found
body — Next flushes the shell before the page decides. This affects
every such page on the site, including `/company/<unknown>`, and
predates the landing pages.

It matters less than it looks here: the invalid combinations are in no
sitemap and no link, so nothing discovers them, and anything that does
finds `noindex`. Fixing it properly means doing the existence check
before rendering begins, which for a database lookup means either
`dynamicParams = false` — and then a newly listed business has no
landing page until the next deploy — or moving the check into
middleware, which cannot reach the database.

## robots.txt

`allow: "/"` with a disallow list, rather than an allow-list. The
previous allow-list had already fallen behind: it named `/cities/` and
`/categories/` but not the landing pages, the account area or anything
added since, so new public routes were invisible by default.

Disallowed: everything behind a login, the API, payment returns,
`/booking/` (those URLs contain a secret token — indexing one would
publish it), and `/businesses?` (filtered search is a combinatorial
surface of the same listings; the landing pages are the indexable
version of it).
