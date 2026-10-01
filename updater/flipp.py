"""Flipp (Wishabi) API client for western-store flyers.

Covers FreshCo (2267), Food Basics (2265), No Frills (2332).
Public endpoints discovered 2026-10-01:
  GET /flipp/merchants?locale=en
  GET /flipp/flyers?locale=en&postal_code=XXXX
  GET /flipp/items/search?locale=en&postal_code=XXXX&flyer_ids=ID[&q=..][&sort=..][&page=..]
Notes:
  - items/search caps at 150 items per query; `page` does NOT paginate (same 150).
    We union several query windows: price_low_to_high, relevancy, and keyword
    searches, then dedupe by item id.
  - price unit comes from post_price_text ('/lb') and pre_price_text
    ('only' | 'Scene+ Member Pricing' | None).
"""

import json
import time
import urllib.parse
import urllib.request

BASE = 'https://backflipp.wishabi.com'
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

MERCHANTS = {
    'freshco': 2267,
    'foodbasics': 2265,
    'nofrills': 2332,
}

POSTAL_CODE = 'L3R1P3'  # Markham


def _get(path, params):
    qs = urllib.parse.urlencode(params)
    req = urllib.request.Request(BASE + path + '?' + qs, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def get_current_flyer(merchant_id, today):
    """Return the flyer currently valid for merchant_id, or None."""
    d = _get('/flipp/flyers', {'locale': 'en', 'postal_code': POSTAL_CODE})
    flyers = d.get('flyers', [])
    best = None
    for f in flyers:
        if f.get('merchant_id') != merchant_id:
            continue
        vf = (f.get('valid_from') or '')[:10]
        vt = (f.get('valid_to') or '')[:10]
        if vf <= today <= vt or (vf <= today and not vt):
            best = f
            break
    return best


def _search_items(flyer_id, q=None, sort=None):
    params = {'locale': 'en', 'postal_code': POSTAL_CODE,
              'flyer_ids': str(flyer_id)}
    if q:
        params['q'] = q
    if sort:
        params['sort'] = sort
    d = _get('/flipp/items/search', params)
    return d.get('items', [])


def get_flyer_items(flyer_id, keywords, delay=0.4):
    """Union of query windows, deduped by item id. Food items only."""
    seen = {}
    queries = [({}, 'relevancy'),
               ({'sort': 'price_low_to_high'}, 'cheap')]
    for kw in keywords:
        queries.append(({'q': kw}, 'kw:' + kw))
    for params, label in queries:
        try:
            for it in _search_items(flyer_id, **params):
                if it.get('_L1') != 'Food, Beverages & Tobacco':
                    continue
                if it.get('current_price') is None:
                    continue
                seen[it.get('id')] = it
        except Exception as e:
            print(f'  [warn] query {label} failed: {e}')
        time.sleep(delay)
    items = list(seen.values())
    print(f'  flyer {flyer_id}: {len(items)} unique food items')
    return items
