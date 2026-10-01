"""Name normalization + glossary matching + price formatting.

Glossary rules (from items.js header):
  key = english normalized lowercase, no brand / origin / state word
        (Fresh/Live/Frozen), no size spec -- just "what is this thing".
  value = chinese name, same stripping.
"""

import re

APP_DIR = '/home/hatch/workspace/your_files/poker-deals'

# words/phrases that describe state, origin, grade -- never part of the key
STRIP_WORDS = [
    'fresh', 'frozen', 'live', 'chilled',
    'canada no. 1', 'u.s. no. 1', 'us no. 1', 'no. 1 grade', 'no 1 grade',
    'grade a', 'grade aa', 'aaa',
]
# generic patterns handled with regex below (origin, grade numbers)
ORIGIN_RE = re.compile(r'product of [a-z]+(?: [a-z]+){0,2}')
GRADE_RE = re.compile(r'\bno\.?\s?1\b|\bn1\b|\bu\.?\s?s\.?\b|\busa\b')
SIZE_RE = re.compile(
    r'\b\d+(?:[.,]\d+)?\s?(?:g|kg|ml|l|lb|oz|ct|pk|pack|pieces?|count)\b'
    r'|\b\d+\s?[-x×]\s?\d+\s?(?:g|kg|ml|l|lb|oz)\b'
    r'|\b\d+[.,]\d+/kg\b', re.I)
PAREN_RE = re.compile(r'\([^)]*\)')


def load_glossary(path=None):
    """Parse GLOSSARY = { ... } out of items.js (keys already lowercase)."""
    src = open(path or APP_DIR + '/items.js', encoding='utf-8').read()
    m = re.search(r'const GLOSSARY = \{(.*?)\n\s*\};', src, re.S)
    body = m.group(1)
    glossary = {}
    for km, vm in re.findall(r'"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"', body):
        glossary[km] = vm
    return glossary


def _singular(w):
    if w.endswith('ssels'):  # brussels, mussels keep plural
        return w
    if len(w) > 3 and w.endswith('ies'):
        return w[:-3] + 'y'
    if len(w) > 3 and w.endswith('es') and w[-3] in 'sxz':
        return w[:-2]
    if len(w) > 3 and w.endswith('s') and not w.endswith('ss'):
        return w[:-1]
    return w


def _norm_words(s):
    return [_singular(w) for w in re.findall(r'[a-z]+', s.lower())]


def clean_name(raw):
    """Strip sizes, state/origin words, parens -> base english words.

    Returns (display_words, match_words): display keeps original plurals,
    match_words are singularized for glossary lookup.
    """
    s = raw or ''
    s = PAREN_RE.sub(' ', s)
    s = SIZE_RE.sub(' ', s)
    s = s.replace(',', ' ').replace('.', ' ')
    low = ' ' + re.sub(r'\s+', ' ', s).strip().lower() + ' '
    low = ORIGIN_RE.sub(' ', low)
    low = GRADE_RE.sub(' ', low)
    for w in STRIP_WORDS:
        low = low.replace(' ' + w + ' ', ' ')
    low = re.sub(r'\s+', ' ', low).strip()
    disp = [w for w in re.findall(r'[a-z]+', low)
            if w not in ('and', 'or', 'with') and not w.isdigit()]
    return disp, [_singular(w) for w in disp]


def match_glossary(match_words, glossary):
    """Longest glossary key as word-bounded subsequence; ties broken by
    end-anchoring (head noun is usually last in English: 'orange juice'
    must match 'juice', not 'oranges')."""
    best, best_score = None, (-1, -1)
    for key in glossary:
        kw = _norm_words(key)
        if not kw:
            continue
        n = len(kw)
        for i in range(len(match_words) - n + 1):
            if match_words[i:i + n] == kw:
                score = (n, i + n)  # length first, then end position
                if score > best_score:
                    best, best_score = key, score
                break
    return best


def display_name(disp_words):
    return ' '.join(w.capitalize() for w in disp_words)


def title_case(key):
    return ' '.join(w.capitalize() for w in key.split())


def _norm_post(post):
    """Flipp post_price_text variants -> '/lb' | '/ea' | '/kg' | ''."""
    u = (post or '').strip().upper().replace(' ', '')
    if not u:
        return ''
    if 'LB' in u:
        return '/lb'
    if 'EACH' in u or u == 'EA':
        return '/ea'
    if 'KG' in u:
        return '/kg'
    return ''


def format_price(it):
    """'only $1.44/lb' | '$3.49' | 'Scene+ $10 (member)' -> '$1.44/lb' etc."""
    price = it.get('current_price')
    pre = (it.get('pre_price_text') or '').strip()
    post = _norm_post(it.get('post_price_text'))

    if isinstance(price, float) and price.is_integer():
        p = f'${int(price)}'
    elif isinstance(price, (int, float)):
        p = f'${price:.2f}'
    else:
        p = f'${price}'

    # sub-dollar per-unit -> cents style like the curated data ("88¢/lb", "98¢/ea")
    if post in ('/lb', '/ea') and isinstance(price, (int, float)) and price < 1:
        p = f'{int(round(price * 100))}¢{post}'

    if post == '/lb' and '¢' not in p:
        p += '/lb'
    elif post == '/ea' and '¢' not in p:
        p += '/ea'
    elif post and post not in ('/lb', '/ea'):
        p += post

    member = 'member' in pre.lower() or 'scene+' in pre.lower()
    size = SIZE_RE.search(it.get('name') or '')
    extras = []
    # skip weight-size extras when the unit is already per-weight
    if size and post not in ('/lb', '/kg'):
        extras.append(size.group(0).replace(' ', ''))
    if member:
        extras.append('member')
    if extras:
        p += ' (' + ', '.join(extras) + ')'
    return p
