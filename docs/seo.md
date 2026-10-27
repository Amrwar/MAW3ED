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

## Languages: one address each

Every public page exists twice: Arabic at the bare path (`/faq`) and
English under `/en` (`/en/faq`). Arabic is the product's language, so it
keeps the addresses that were already indexed and linked.

- **Which pages:** `src/lib/locale-path.ts` (`hasTwin`). The dashboard,
  the customer account, admin, the API and one-off links (`/booking/…`,
  `/ref/…`, payment returns) have one address and follow the saved
  choice, the `maw3ed-lang` cookie.
- **Routing:** the proxy (`src/proxy.ts`) applies
  `src/lib/locale-routing.ts`. `/en/x` is rewritten to `/x` with the
  language on the request (`x-maw3ed-lang`, read by `getLang()`), so each
  page is written once. `/ar/x` and `?lang=en|ar` redirect to the right
  address; a visitor who chose English and follows a bare link is sent
  to the `/en` twin. Crawlers carry no cookie, so they get each address
  in its own language.
- **Tags:** each page is canonical to itself and lists both twins as
  hreflang alternates, Arabic as `x-default` (`alternatesFor` in
  `src/lib/seo/meta.ts`). The sitemap lists both addresses with the same
  alternates.
- **Links:** `@/components/shared/LocaleLink` is `next/link` pointed at
  the current language's address; programmatic navigations use
  `localizePath`. The language switch does a full load of the twin, so
  server-rendered text and metadata change with it.
- **Structured data** still names the Arabic URL as the entity's address;
  it identifies the business, which is the same in both languages.

## Soft 404s

Fixed: `notFound()` answers HTTP 404. It used to answer 200, because a
root `loading.tsx` streamed the shell before the page decided; that
boundary now lives only on `/businesses`, which never 404s. Keep it
that way — a `loading.tsx` above a page that can 404 brings the soft
404 back.

The 404 body is an empty `<html id="__next_error__">` shell, and the
not-found page is drawn in the browser from the payload that ships with
it. That is Next 16's own behaviour for `notFound()` in a dynamic page
(it reproduces in a bare app) and harmless for search: crawlers act on
the status.

## robots.txt

`allow: "/"` with a disallow list, rather than an allow-list. The
previous allow-list had already fallen behind: it named `/cities/` and
`/categories/` but not the landing pages, the account area or anything
added since, so new public routes were invisible by default.

Disallowed: everything behind a login, the API, payment returns,
`/booking/` and `/reset-password` (those URLs contain a secret token —
indexing one would publish it), and `/businesses?` (filtered search is
a combinatorial surface of the same listings; the landing pages are the
indexable version of it).

Not disallowed: the sign-in, sign-up and forgot-password pages. Each carries
`noindex, follow` in its own metadata, and a crawler must be allowed to
fetch a page to see that. Blocked in robots.txt, a page linked from
every footer can still be indexed as a bare URL.
