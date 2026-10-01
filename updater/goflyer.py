#!/usr/bin/env python3
"""GoFlyer API client for the two Chinese supermarkets.

Endpoints (discovered 2026-10-01 from goflyer.ca frontend bundle):
  GET https://backend-prod.goflyer.ca/gf-flyer/getAllFlyerByStoreID/{storeId}
  GET https://backend-prod.goflyer.ca/gf-flyer-item/findAllByStore/{storeId}

Item fields: name, nameChinese, salePrice, regularPrice, regularPriceString,
unit (ea/lb/pc/case/box/bag), topSale, gfFlyerItemCategory[{name}],
flyerItemList{validStartDate, validEndDate}.
"""
import json, urllib.request, datetime

BASE = "https://backend-prod.goflyer.ca"

STORES = {
    # store_id -> goflyer store uuid
    "guanye": "e513bc69-efd2-4b29-a399-34f0f9df3d82",  # First Choice 冠业 Kennedy
    "baifu":  "f17d2edb-82d1-43c6-ba5a-1ca6e9ae03b3",  # Sunfood 百福 Denison
}

HEADERS = {"User-Agent": "Mozilla/5.0"}


def _get(path):
    req = urllib.request.Request(BASE + path, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def get_flyers(store_uuid):
    d = _get(f"/gf-flyer/getAllFlyerByStoreID/{store_uuid}")
    out = []
    for f in d.get("results", []):
        out.append({
            "id": f["id"],
            "slug": f.get("slug"),
            "valid_from": (f.get("validStartDate") or "")[:10],
            "valid_to": (f.get("validEndDate") or "")[:10],
        })
    # latest first
    out.sort(key=lambda x: x["valid_from"], reverse=True)
    return out


def pick_current_flyer(flyers, today=None):
    """The flyer whose valid_from is the latest date <= today."""
    today = today or datetime.date.today().isoformat()
    cands = [f for f in flyers if f["valid_from"] and f["valid_from"] <= today]
    return cands[0] if cands else None


def get_items(store_uuid):
    d = _get(f"/gf-flyer-item/findAllByStore/{store_uuid}?limit=500")
    items = d if isinstance(d, list) else d.get("results", [])
    out = []
    for it in items:
        fil = it.get("flyerItemList") or {}
        cats = [g.get("name") for g in (it.get("gfFlyerItemCategory") or []) if g.get("name")]
        reg = it.get("regularPrice")
        if reg is None:
            try:
                reg = float(it.get("regularPriceString")) if it.get("regularPriceString") else None
            except (TypeError, ValueError):
                reg = None
        out.append({
            "name": (it.get("name") or "").strip(),
            "name_chinese": (it.get("nameChinese") or "").strip(),
            "sale_price": it.get("salePrice"),
            "regular_price": reg,
            "unit": (it.get("unit") or "").strip().lower(),
            "top_sale": bool(it.get("topSale")),
            "categories": cats,
            "list_from": (fil.get("validStartDate") or "")[:10],
            "list_to": (fil.get("validEndDate") or "")[:10],
        })
    return out


if __name__ == "__main__":
    for sid, uuid in STORES.items():
        flyers = get_flyers(uuid)
        print("==", sid)
        for f in flyers[:3]:
            print("  flyer:", f["slug"], f["valid_from"], "->", f["valid_to"])
        cur = pick_current_flyer(flyers)
        print("  current:", cur["slug"] if cur else None)
        items = get_items(uuid)
        print("  items:", len(items))
        from collections import Counter
        print("  lists:", Counter(i["list_from"] for i in items))
