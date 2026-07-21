"""Rebuild the catalog at variant level — one entry per design/colour/model —
instead of the rolled-up lines on the Stock Overview sheet."""
import json, math, re, zipfile, os
from xml.etree import ElementTree as ET
import pandas as pd

SRC = '/mnt/user-data/uploads/Aesthetic_instocks__1_.xlsx'
z = zipfile.ZipFile(SRC)
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
NSM = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
XDR = '{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}'
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'


def clean(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    s = re.sub(r'\s+', ' ', str(v).replace('\n', ' ')).strip()
    return s or None


def norm(s):
    s = (s or '').lower()
    s = re.sub(r'[^a-z0-9]+', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def qty_of(v):
    """Cells hold things like 3, '2', '1 for preorder cus', '~', '-'."""
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    if isinstance(v, (int, float)):
        return int(v)
    m = re.search(r'\d+', str(v))
    return int(m.group()) if m else None


def price_of(v):
    """'47,000/ 52,000' means two variants priced apart — take the first."""
    s = clean(v)
    if not s:
        return None
    m = re.search(r'(\d[\d,\.]*)', s)
    if not m:
        return None
    try:
        n = float(m.group(1).replace(',', ''))
    except ValueError:
        return None
    return int(n) if n >= 1000 else None


BASE_COLOURS = ('black|white|pink|yellow|blue|liliac|lilac|purple|green|mint|cream|beige|grey|gray'
                '|red|orange|brown|silver|gold|clear|transparent|navy|rose|lavender|peach|violet|ivory')
QUALIFIER = r'(?:dark|light|sky|deep|pale|hot|baby|off)'
# whole words only — otherwise "tempered" reads as "red" and "glass" swallows a model name
COLOUR_RE = re.compile(rf'\b((?:{QUALIFIER}\s+)?(?:{BASE_COLOURS}))\b(?:\s+(\d+))?', re.I)


def split_colours(text):
    """'black 1 light blue 3' -> [('black',1), ('light blue',3)]. Needs counts."""
    s = clean(text)
    if not s or s in {'-', '0', '~'}:
        return []
    return [(m.group(1).strip().lower(), int(m.group(2))) for m in COLOUR_RE.finditer(s) if m.group(2)]


def colour_only(text):
    """A cell that names a colour but gives no count."""
    s = clean(text)
    if not s or s in {'-', '0', '~'} or s.isdigit():
        return None
    m = COLOUR_RE.search(s)
    return m.group(1).strip().lower() if m else None


def strip_colours(name):
    """'Metal Nib white 16 clear 1' -> 'Metal Nib'."""
    m = COLOUR_RE.search(name)
    if not m or not m.group(2):
        return name
    head = name[:m.start()].strip(' -,/')
    return head if len(head) > 2 else name


# ---------------------------------------------------------------- photos ----
def photo_anchors():
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    wrels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    sheets = [(s.get('name'), wrels[s.get(R + 'id')]) for s in wb.find('m:sheets', NSM)]
    found = {}
    for name, target in sheets:
        spath = 'xl/' + target.lstrip('/')
        relp = spath.replace('worksheets/', 'worksheets/_rels/') + '.rels'
        if relp not in z.namelist():
            continue
        srels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read(relp))}
        sx = ET.fromstring(z.read(spath))
        dref = sx.find('m:drawing', NSM)
        if dref is None:
            continue
        dpath = os.path.normpath(os.path.join(os.path.dirname(spath), srels[dref.get(R + 'id')])).replace('\\', '/')
        drelp = dpath.replace('drawings/', 'drawings/_rels/') + '.rels'
        if drelp not in z.namelist():
            continue
        drels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read(drelp))}
        dx = ET.fromstring(z.read(dpath))
        rows = {}
        for anch in list(dx):
            frm = anch.find(XDR + 'from')
            blip = anch.find('.//' + A + 'blip')
            if frm is None or blip is None:
                continue
            rid = blip.get(R + 'embed')
            if rid not in drels:
                continue
            media = os.path.normpath(os.path.join(os.path.dirname(dpath), drels[rid])).replace('\\', '/')
            rows[int(frm.find(XDR + 'row').text)] = media
        found[name] = rows
    return found


PHOTOS = photo_anchors()


def photo_at(sheet, row):
    """Anchors sit exactly on the row they belong to — no fuzzy nearby matching,
    or colour variants steal the neighbouring design's picture."""
    return PHOTOS.get(sheet, {}).get(row)


products = []


def add(name, category, qty, price, sheet, row, colour=None, model=None, photo_row=None):
    name = clean(name)
    if not name or qty is None:
        return
    label = name
    if colour:
        label += f' — {colour.title()}'
    if model:
        label += f' ({model})'
    products.append({
        'name': label, 'base': name, 'color': colour, 'model': model,
        'category': category, 'qty': max(0, qty), 'price': price,
        'media': photo_at(sheet, photo_row if photo_row is not None else row),
    })


# ------------------------------------ 1. cover matrix: design x colour x model
d = pd.read_excel(SRC, sheet_name='Ipad cover-product based', header=None)
models = {c: clean(d.iat[1, c]) for c in range(5, d.shape[1]) if clean(d.iat[1, c])}
design = price = None
design_row = None
for r in range(2, len(d)):
    nm = clean(d.iat[r, 1])
    if nm:
        design, price, design_row = nm, price_of(d.iat[r, 3]), r
    if not design:
        continue
    colour = colour_only(d.iat[r, 4])
    for c, model in models.items():
        q = qty_of(d.iat[r, c])
        if q is None:
            continue
        add(design, 'iPad Cover', q, price, 'Ipad cover-product based', r, colour, model, photo_row=design_row)

# --------------------------------- 2. cover sheet grouped by iPad model
d = pd.read_excel(SRC, sheet_name='iPad Tab Cover-model based', header=None)
model = None
for r in range(1, len(d)):
    nm = clean(d.iat[r, 2])
    if nm and re.search(r'gen|pro|air|mini|ipad|tab|\d', nm, re.I) and qty_of(d.iat[r, 4]) is not None \
            and price_of(d.iat[r, 5]) is None:
        model = nm.replace(' cover', '')
        continue
    if not nm:
        continue
    price = price_of(d.iat[r, 5])
    pieces = split_colours(d.iat[r, 3])
    if pieces:
        for colour, q in pieces:
            add(nm, 'iPad Cover', q, price, 'iPad Tab Cover-model based', r, colour, model)
    else:
        q = qty_of(d.iat[r, 4])
        add(nm, 'iPad Cover', q, price, 'iPad Tab Cover-model based', r, colour_only(d.iat[r, 3]), model)

# ------------------------------------------- 3..n simple per-row sheets
SIMPLE = [
    ('Screen Protector', 'Screen Protector', 2, None, 3, 5),
    ('Nib & Cover', 'Nib & Cover', 2, None, 3, 5),
    ('Stylus', 'Pen & Accessories', 2, 3, 4, 7),
    ('Pen cover etc.', 'Pen & Accessories', 2, 3, 4, 7),
    ('Drawing Tab', 'Drawing Tablet', 2, None, 3, 5),
    ('Magic Keyboard', 'Keyboard Case', 2, None, 3, 5),
    ('Keyboard, Mouse', 'Keyboard Case', 2, None, 3, 5),
    ('Keyboard, mouse & sets', 'Keyboard Case', 2, None, 3, 5),
    ('Bag', 'Bag', 2, None, 3, 5),
    ('Others', 'Other', 2, None, 3, 5),
]

for sheet, category, c_name, c_colour, c_qty, c_price in SIMPLE:
    try:
        d = pd.read_excel(SRC, sheet_name=sheet, header=None)
    except Exception:
        continue
    group = None
    for r in range(2, len(d)):
        # column A carries the section heading these rows belong under
        head = clean(d.iat[r, 0])
        if head and not head.isdigit() and not clean(d.iat[r, c_name]):
            group = head
        nm = clean(d.iat[r, c_name]) if c_name < d.shape[1] else None
        if not nm:
            continue
        NESTS = {'Screen Protector', 'Bag'}
        family = group if (sheet in NESTS and group and norm(group) not in norm(nm)) else None
        inline = split_colours(nm)
        if inline:
            nm = strip_colours(nm)
        q = qty_of(d.iat[r, c_qty]) if c_qty < d.shape[1] else None
        if q is None:
            continue
        price = price_of(d.iat[r, c_price]) if c_price < d.shape[1] else None
        pieces = split_colours(d.iat[r, c_colour]) if c_colour is not None and c_colour < d.shape[1] else []
        pieces = pieces or inline
        if pieces:
            for colour, cq in pieces:
                add(nm, category, cq, price, sheet, r, colour, family)
        else:
            colour = colour_only(d.iat[r, c_colour]) if c_colour is not None and c_colour < d.shape[1] else None
            add(nm, category, q, price, sheet, r, colour, family)

# --------------------------------------------------------------- de-dupe
seen, unique = {}, []
for p in products:
    k = norm(p['name'])
    if k in seen:
        prev = unique[seen[k]]
        prev['qty'] += p['qty']
        prev['price'] = prev['price'] or p['price']
        prev['media'] = prev['media'] or p['media']
        continue
    seen[k] = len(unique)
    unique.append(p)

json.dump(unique, open('variants.json', 'w'), ensure_ascii=False)

import collections
print('variants:', len(unique))
print('with photo:', sum(1 for p in unique if p['media']), '| distinct images:', len({p['media'] for p in unique if p['media']}))
print('with colour:', sum(1 for p in unique if p['color']), '| with model:', sum(1 for p in unique if p['model']))
print('with price:', sum(1 for p in unique if p['price']))
print(collections.Counter(p['category'] for p in unique))
for p in unique[:12]:
    print('  ', p['qty'], '|', p['name'], '|', p['price'], '|', (p['media'] or '').split('/')[-1])
