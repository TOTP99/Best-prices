#!/usr/bin/env python3
"""
poker-deals weekly updater — build deals-data.json from live flyer sources.

Sources:
  - FreshCo / Food Basics / No Frills : Flipp/Wishabi API (backflipp.wishabi.com)
  - First Choice 冠业 / Sunfood 百福   : GoFlyer API (backend-prod.goflyer.ca)

Output schema matches the app's deals-data.json:
  {deals: {sid: [{item:{en}, price, [featured]}]},
   flyerPeriod: {sid: "Oct 1-7"},
   benchmarkPrices: (kept as-is),
   analysis: {bestDeals, deepestDiscounts, categoryWinners,
              cheapestStoreSummary, benchmarksComparison}}

Fail-safe: a store whose fetch fails, whose items belong to an old flyer, or
that yields too few usable items keeps its previous data. Writes are atomic
(tmp + os.replace) with a timestamped backup.

Partial updates: --only SID,SID... (or DEALS_ONLY_STORES env) updates just
those stores; other stores keep their existing data, and the analysis section
is rebuilt from fresh picks plus reconstructed candidates from the kept data.
"""
import json, os, re, sys, shutil, datetime, argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flipp
import goflyer
from normalize import (load_glossary, clean_name, match_glossary, display_name,
                       title_case, format_price, _norm_post)

APP_DIR = os.path.expanduser("~/workspace/your_files/poker-deals")
DATA_FILE = os.environ.get("DEALS_DATA_FILE", os.path.join(APP_DIR, "deals-data.json"))
GLOSSARY_FILE = os.environ.get("GLOSSARY_FILE", os.path.join(APP_DIR, "items.js"))
BACKUP_DIR = os.environ.get("BACKUP_DIR",
             os.path.join(os.path.dirname(os.path.abspath(__file__)), "backups"))

STORE_IDS = ["guanye", "baifu", "freshco", "foodbasics", "nofrills"]
STORE_EN = {"guanye": "First Choice", "baifu": "Sunfood", "freshco": "FreshCo",
            "foodbasics": "Food Basics", "nofrills": "No Frills"}
STORE_CN = {"guanye": "冠业", "baifu": "百福", "freshco": "FreshCo",
            "foodbasics": "Food Basics", "nofrills": "No Frills"}

MIN_ITEMS_PER_STORE = 8
MAX_ITEMS_PER_STORE = 50

BENCHMARK_GKEYS = {"eggs", "salmon fillet", "salmon", "tomatoes", "bananas",
                   "grapes", "chocolate", "pork chop", "oranges", "chicken wing"}

QUERY_KEYWORDS = [
    "bok choy", "napa cabbage", "cabbage", "broccoli", "cauliflower", "carrots",
    "onions", "tomatoes", "cucumber", "lettuce", "romaine", "spinach",
    "mushrooms", "peppers", "celery", "corn", "potatoes", "sweet potatoes",
    "ginger", "garlic", "cilantro", "green onions", "kale", "asparagus",
    "apples", "oranges", "grapes", "bananas", "strawberries", "blueberries",
    "mango", "watermelon", "pears", "kiwi", "peaches", "lemon", "avocado",
    "pomelo", "pineapple", "plums", "cherries", "raspberries", "cantaloupe",
    "chicken breast", "chicken drumsticks", "chicken wings", "whole chicken",
    "pork loin", "pork chop", "pork belly", "ground pork", "ground beef",
    "beef", "lamb", "duck", "bacon", "ham", "sausage", "turkey",
    "salmon", "shrimp", "crab", "lobster", "basa", "tilapia", "tuna",
    "mussels", "clams", "eel", "oysters", "scallops", "squid", "cod",
    "milk", "eggs", "butter", "cheese", "yogurt", "rice", "noodles",
    "soy sauce", "oil", "bread", "juice", "coca-cola", "coffee", "honey",
    "tofu", "frozen vegetables", "ice cream", "cookies", "chocolate",
]

SEAFOOD_WORDS = {"salmon", "shrimp", "crab", "lobster", "tuna", "mussel",
    "clam", "oyster", "scallop", "squid", "cod", "eel", "fish", "basa",
    "tilapia", "haddock", "sole", "trout", "perch", "pomfret", "croaker",
    "urchin", "abalone", "octopus", "prawn", "whelk", "geoduck", "jellyfish",
    "crawfish", "carp", "bass", "flounder", "mackerel", "herring", "smelt"}


def strip_brand_prefix(name):
    """Drop leading ALL-CAPS brand tokens from goflyer names
    ('SH Frozen Pineapple Cut Squid' -> 'Frozen Pineapple Cut Squid').
    Mixed-case words are kept: they may be descriptors ('Dried Glutens')."""
    return re.sub(r"^(?:[A-Z]{2,6}\s+)+", "", name).strip()
MEAT_WORDS = {"chicken", "pork", "beef", "lamb", "duck", "turkey", "bacon",
    "ham", "sausage", "veal", "wing", "drumstick", "breast", "steak", "rib",
    "shank", "belly", "chop", "loin", "oxtail", "meatball", "liver", "tongue",
    "tripe", "goat"}
STAPLE_WORDS = {"rice", "noodle", "soy sauce", "oil", "flour", "bread",
    "juice", "coca", "coffee", "tea", "honey", "sugar", "cereal", "egg",
    "milk", "butter", "cheese", "yogurt", "tofu", "cookie", "chocolate",
    "ice cream", "vinegar", "sauce", "dumpling", "wonton"}
PRODUCE_WORDS = {"cabbage", "bok choy", "broccoli", "cauliflower", "carrot",
    "onion", "tomato", "cucumber", "lettuce", "romaine", "spinach", "mushroom",
    "pepper", "celery", "corn", "potato", "ginger", "garlic", "cilantro",
    "kale", "asparagus", "apple", "orange", "grape", "banana", "strawberry",
    "blueberry", "mango", "watermelon", "pear", "kiwi", "peach", "lemon",
    "avocado", "pomelo", "pineapple", "plum", "cherry", "raspberry",
    "cantaloupe", "squash", "melon", "napa", "choy", "greens", "bean",
    "sprout", "yam", "taro", "lotus", "gourd", "papaya", "longan", "lychee",
    "durian", "persimmon", "tangerine", "grapefruit"}

LOG = []


def log(msg):
    line = f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {msg}"
    LOG.append(line)
    print(line, flush=True)


def parse_price_str(s):
    """Invert format_price/gf_price_str for analysis rebuilds on kept data.

    '88¢/lb' -> (0.88, 'lb'); '$14.99/lb' -> (14.99, 'lb');
    '7/$2.99' -> (2.99/7 per unit, 'ea'); '$2.99' -> (2.99, 'ea').
    Returns (None, 'ea') when unparseable.
    """
    s = (s or "").strip()
    s = re.sub(r"\s*\(.*\)\s*$", "", s)  # drop " (108g)" suffixes
    m = re.match(r"^(\d+)\s*/\s*\$([\d.]+)$", s)
    if m:
        return float(m.group(2)) / int(m.group(1)), "ea"
    m = re.match(r"^([\d.]+)\s*¢\s*(/lb|/ea)?$", s)
    if m:
        return float(m.group(1)) / 100, (m.group(2) or "/ea").lstrip("/")
    m = re.match(r"^\$\s*([\d.]+)\s*(/lb|/ea)?$", s)
    if m:
        return float(m.group(1)), (m.group(2) or "/ea").lstrip("/")
    return None, "ea"


def old_deal_to_cand(d):
    """Rebuild an approximate analysis candidate from a kept deals-data.json row.

    Discount info is not recoverable, so disc=0: deepestDiscounts on a partial
    run only reflects freshly fetched stores.
    """
    en = (d.get("item") or {}).get("en", "")
    price = d.get("price", "")
    val, unit = parse_price_str(price)
    return {"en": en, "cn": None, "gkey": None, "price": price,
            "price_val": val, "unit": unit, "disc": 0,
            "cat": classify(None, en, None), "featured": bool(d.get("featured"))}


def classify(gkey, en, gf_cats):
    """Return meat|seafood|produce|staples|other."""
    if gf_cats:
        s = " ".join(gf_cats).lower()
        if "seafood" in s:
            return "seafood"
        if "meat" in s:
            return "meat"
        if "produce" in s:
            return "produce"
        if "beauty" in s or "health" in s:
            return "other"
        return "staples"
    text = f"{gkey or ''} {en or ''}".lower()
    words = set(re.findall(r"[a-z]+", text))
    if words & SEAFOOD_WORDS:
        return "seafood"
    if words & MEAT_WORDS:
        return "meat"
    if words & STAPLE_WORDS:
        return "staples"
    if words & PRODUCE_WORDS:
        return "produce"
    return "other"


def clean_cn(name):
    """Strip size specs from a goflyer nameChinese: '游水白鳝 2-3Lb' -> '游水白鳝'."""
    n = (name or "").strip()
    n = re.sub(r"\s*\d[\d.,]*(?:\s*[-–]\s*\d[\d.,]*)?\s*(?:lb|l|kg|g|ml|oz|ct|pcs?|pack|ea)\b", "", n, flags=re.I).strip()
    return n


def gf_price_str(sale, unit):
    if not isinstance(sale, (int, float)):
        return None
    if isinstance(sale, float) and sale.is_integer():
        base = f"${int(sale)}"
    elif isinstance(sale, (int, float)):
        base = f"${sale:.2f}"
    else:
        return None
    if unit == "lb":
        if sale < 1:
            return f"{int(round(sale * 100))}¢/lb"
        return base + "/lb"
    if unit == "ea":
        return base + "/ea"
    return base


def norm_flipp_item(it, glossary):
    name = (it.get("name") or "").strip()
    if not name or it.get("current_price") is None:
        return None
    disp_words, match_words = clean_name(name)
    gkey = match_glossary(match_words, glossary)
    en = title_case(gkey) if gkey else display_name(disp_words)
    cn = glossary.get(gkey) if gkey else None
    price = it.get("current_price")
    orig = it.get("original_price")
    disc = round((1 - price / orig) * 100, 1) if orig and price and orig > price else 0.0
    post = _norm_post(it.get("post_price_text"))
    unit = "lb" if post == "/lb" else "ea"
    return {"en": en, "cn": cn, "gkey": gkey, "price": format_price(it),
            "price_val": price, "unit": unit, "disc": disc,
            "cat": classify(gkey, en, None), "featured": False}


def norm_gf_item(it, glossary):
    name = strip_brand_prefix(it["name"])
    if not name or it["sale_price"] is None:
        return None
    disp_words, match_words = clean_name(name)
    gkey = match_glossary(match_words, glossary)
    en = title_case(gkey) if gkey else display_name(disp_words)
    cn = glossary.get(gkey) or clean_cn(it["name_chinese"]) or None
    price_str = gf_price_str(it["sale_price"], it["unit"])
    if not price_str:
        return None
    sale, reg = it["sale_price"], it["regular_price"]
    disc = round((1 - sale / reg) * 100, 1) if reg and sale and reg > sale else 0.0
    cat = classify(gkey, en, it["categories"])
    if cat == "other":
        return None
    return {"en": en, "cn": cn, "gkey": gkey, "price": price_str,
            "price_val": sale, "unit": it["unit"], "disc": disc,
            "cat": cat, "featured": it["top_sale"]}


def pick(cands):
    seen = {}
    for c in cands:
        k = c["gkey"] or ("raw:" + c["en"].lower())
        prev = seen.get(k)
        if prev is None or (c["disc"], -(c["price_val"] or 9e9)) > (prev["disc"], -(prev["price_val"] or 9e9)):
            seen[k] = c
    uniq = list(seen.values())

    def score(r):
        bench = 1 if r["gkey"] in BENCHMARK_GKEYS else 0
        catb = 1 if r["cat"] in ("produce", "meat", "seafood") else 0
        # demote noisy multi-product tiles: long names with no glossary match
        clean = 0 if (not r["gkey"] and len(r["en"].split()) > 5) else 1
        return (bench, r["disc"], catb, clean, -(r["price_val"] or 9e9))
    uniq.sort(key=score, reverse=True)
    picked = uniq[:MAX_ITEMS_PER_STORE]
    # featured: topSale already set for goflyer; for flipp use top-2 discounts
    if not any(p["featured"] for p in picked):
        by_disc = sorted([p for p in picked if p["disc"] > 0], key=lambda r: -r["disc"])
        for p in by_disc[:2]:
            p["featured"] = True
        if not by_disc and picked:
            picked[0]["featured"] = True
    return picked


def fetch_western(sid, today, glossary):
    flyer = flipp.get_current_flyer(flipp.MERCHANTS[sid], today)
    if not flyer:
        raise RuntimeError("no current flyer")
    log(f"{sid}: flipp flyer {flyer.get('id')} {flyer['valid_from'][:10]}..{flyer['valid_to'][:10]}")
    raw = flipp.get_flyer_items(flyer["id"], QUERY_KEYWORDS)
    cands = [c for c in (norm_flipp_item(it, glossary) for it in raw) if c]
    return cands, flyer["valid_from"][:10], flyer["valid_to"][:10]


def fetch_chinese(sid, today, glossary):
    uuid = goflyer.STORES[sid]
    flyers = goflyer.get_flyers(uuid)
    flyer = goflyer.pick_current_flyer(flyers, today)
    if not flyer:
        raise RuntimeError("no current flyer")
    log(f"{sid}: goflyer flyer {flyer['slug']} {flyer['valid_from']}..{flyer['valid_to']}")
    items = goflyer.get_items(uuid)
    # items must belong to the current flyer week
    cur = [it for it in items if it["list_from"] == flyer["valid_from"]]
    if len(cur) < MIN_ITEMS_PER_STORE:
        raise RuntimeError(f"only {len(cur)} items for current flyer week "
                           f"({flyer['valid_from']}), list not populated yet")
    cands = [c for c in (norm_gf_item(it, glossary) for it in cur) if c]
    return cands, flyer["valid_from"], flyer["valid_to"]


def period_str(vf, vt):
    m1 = datetime.date.fromisoformat(vf).strftime("%b")
    d1 = int(vf[8:10])
    d2 = int(vt[8:10])
    m2 = datetime.date.fromisoformat(vt).strftime("%b")
    return f"{m1} {d1}-{d2}" if m1 == m2 else f"{m1} {d1}-{m2} {d2}"


# ---------------- analysis ----------------

def build_analysis(all_picked):
    """all_picked: {sid: [candidate,...]} for all stores with data.

    On a partial (--only) run, non-updated stores contribute reconstructed
    candidates (disc=0, cn=None), so their deals still count for price
    comparisons; discount rankings reflect freshly fetched stores only."""
    flat = [(sid, c) for sid, cs in all_picked.items() for c in cs]

    def loc(en, cn): return {"en": en, "cn": cn}

    # bestDeals: top-2 per store by discount then price
    bestDeals = {}
    for sid, cs in all_picked.items():
        top = sorted(cs, key=lambda c: (-c["disc"], c["price_val"] or 9e9))[:2]
        en = " & ".join(f"{c['en']} {c['price']}" for c in top)
        cn = " & ".join(f"{c['cn'] or c['en']} {c['price']}" for c in top)
        bestDeals[sid] = loc(en, cn)

    # deepestDiscounts: top-10 across stores
    disc = sorted([x for x in flat if x[1]["disc"] > 0], key=lambda x: -x[1]["disc"])[:10]
    deepestDiscounts = [{"store": sid, "item": loc(c["en"], c["cn"] or c["en"]),
                         "discountPct": int(round(c["disc"]))} for sid, c in disc]

    # categoryWinners: cheapest per category (lb items for fresh cats, non-lb for staples)
    categoryWinners = {}
    for cat in ("meat", "seafood", "produce", "staples"):
        if cat == "staples":
            pool = [(s, c) for s, c in flat if c["cat"] == cat and c["unit"] != "lb"
              and c["price_val"] is not None]
        else:
            pool = [(s, c) for s, c in flat if c["cat"] == cat and c["unit"] == "lb"
              and c["price_val"] is not None]
        if not pool:
            continue
        sid, c = min(pool, key=lambda x: x[1]["price_val"])
        categoryWinners[cat] = loc(f"{c['en']} {c['price']} ({STORE_EN[sid]})",
                                   f"{c['cn'] or c['en']} {c['price']}（{STORE_CN[sid]}）")

    # cheapestStoreSummary: winner's store + its 3 cheapest in that category
    cheapestStoreSummary = {}
    label = {"meat": "overallCheapestMeat", "seafood": "overallCheapestSeafood",
             "produce": "overallCheapestProduce", "staples": "overallCheapestStaples"}
    for cat, key in label.items():
        if cat == "staples":
            pool = [(s, c) for s, c in flat if c["cat"] == cat and c["unit"] != "lb"
              and c["price_val"] is not None]
        else:
            pool = [(s, c) for s, c in flat if c["cat"] == cat and c["unit"] == "lb"
              and c["price_val"] is not None]
        if not pool:
            continue
        win_sid = min(pool, key=lambda x: x[1]["price_val"])[0]
        mine = sorted([c for s, c in pool if s == win_sid],
                      key=lambda c: c["price_val"] or 9e9)[:3]
        en = f"{STORE_EN[win_sid]} — " + ", ".join(f"{c['en']} {c['price']}" for c in mine)
        cn = f"{STORE_CN[win_sid]} — " + "、".join(f"{c['cn'] or c['en']} {c['price']}" for c in mine)
        cheapestStoreSummary[key] = loc(en, cn)

    # benchmarksComparison — compare like-for-like: per-lb prices only
    bench_map = {"grape": {"grapes"}, "orange": {"oranges"},
                 "tomato": {"tomatoes"}, "porkchop": {"pork chop"},
                 "salmon": {"salmon fillet", "salmon"}}
    benchmarksComparison = {}
    for bkey, gkeys in bench_map.items():
        lb = [(s, c) for s, c in flat
              if c["gkey"] in gkeys and c["unit"] == "lb"]
        if not lb:
            continue
        lb.sort(key=lambda x: x[1]["price_val"] or 9e9)
        first = f"{STORE_EN[lb[0][0]]} {lb[0][1]['price']}"
        first_cn = f"{STORE_CN[lb[0][0]]} {lb[0][1]['price']}"
        if len(lb) > 1:
            first += f" ({STORE_EN[lb[1][0]]} {lb[1][1]['price']})"
            first_cn += f"（{STORE_CN[lb[1][0]]} {lb[1][1]['price']}）"
        benchmarksComparison[bkey] = loc(first, first_cn)

    return {"bestDeals": bestDeals, "deepestDiscounts": deepestDiscounts,
            "categoryWinners": categoryWinners,
            "cheapestStoreSummary": cheapestStoreSummary,
            "benchmarksComparison": benchmarksComparison}


def main():
    ap = argparse.ArgumentParser(description="poker-deals weekly updater")
    ap.add_argument("--only", default=os.environ.get("DEALS_ONLY_STORES", ""),
                    help="comma-separated store ids to update (default: all). "
                         "Others keep existing data.")
    args = ap.parse_args()
    only = [s.strip() for s in args.only.split(",") if s.strip()]
    unknown = [s for s in only if s not in STORE_IDS]
    if unknown:
        print(f"unknown store ids: {', '.join(unknown)}", file=sys.stderr)
        return 2
    target = only or STORE_IDS

    today = datetime.date.today().isoformat()
    log(f"run date: {today}; stores: {', '.join(target)}")
    os.makedirs(BACKUP_DIR, exist_ok=True)
    glossary = load_glossary(GLOSSARY_FILE)
    log(f"glossary: {len(glossary)} entries")

    old = json.load(open(DATA_FILE, encoding="utf-8"))
    fresh = {}   # sid -> (vf, vt, picked)
    failed = {}

    for sid in target:
        try:
            if sid in ("guanye", "baifu"):
                cands, vf, vt = fetch_chinese(sid, today, glossary)
            else:
                cands, vf, vt = fetch_western(sid, today, glossary)
            log(f"{sid}: {len(cands)} candidates")
            picked = pick(cands)
            if len(picked) < MIN_ITEMS_PER_STORE:
                raise RuntimeError(f"only {len(picked)} usable items")
            fresh[sid] = (vf, vt, picked)
            log(f"{sid}: OK {len(picked)} items, {vf}..{vt}")
        except Exception as e:
            log(f"{sid}: FAILED ({e}) — keeping old data")
            failed[sid] = str(e)

    if not fresh:
        log("all fetches failed — nothing written")
        return 1

    out = dict(old)
    out_deals = dict(old.get("deals", {}))
    out_period = dict(old.get("flyerPeriod", {}))
    for sid, (vf, vt, picked) in fresh.items():
        out_deals[sid] = [
            {"item": {"en": p["en"]}, "price": p["price"],
             **({"featured": True} if p["featured"] else {})}
            for p in picked
        ]
        out_period[sid] = period_str(vf, vt)
    out["deals"] = out_deals
    out["flyerPeriod"] = out_period
    # analysis: fresh picks where updated, reconstructed candidates elsewhere
    merged = {}
    for sid in STORE_IDS:
        if sid in fresh:
            merged[sid] = fresh[sid][2]
        elif out_deals.get(sid):
            merged[sid] = [old_deal_to_cand(d) for d in out_deals[sid]]
    out["analysis"] = build_analysis(merged)
    try:
        from zoneinfo import ZoneInfo
        out["generatedAt"] = datetime.datetime.now(ZoneInfo("America/Toronto")).strftime("%Y-%m-%d")
    except Exception:
        out["generatedAt"] = datetime.datetime.now().strftime("%Y-%m-%d")

    ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    shutil.copy2(DATA_FILE, os.path.join(BACKUP_DIR, f"deals-data.{ts}.json"))
    tmp = DATA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, DATA_FILE)
    log("wrote " + DATA_FILE)
    if failed:
        log("stores kept on old data: " + ", ".join(failed))
    open(os.path.join(BACKUP_DIR, f"run-{ts}.log"), "w").write("\n".join(LOG))

    # report unmatched items for glossary review
    unmatched = sorted({(p["en"], sid) for sid, (_, _, ps) in fresh.items()
                        for p in ps if not p["gkey"]})
    if unmatched:
        log(f"{len(unmatched)} items without glossary match (shown in English):")
        for en, sid in unmatched[:20]:
            log(f"  [{sid}] {en}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
