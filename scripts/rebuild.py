import base64, io, json, re, zipfile
from PIL import Image

SRC = '/mnt/user-data/uploads/Aesthetic_instocks__1_.xlsx'
z = zipfile.ZipFile(SRC)

variants = json.load(open('variants.json'))
base = json.load(open('data.json'))            # Stock Overview products + sales
old = json.load(open('matched.json'))          # name -> media, from the first pass


def norm(s):
    s = (s or '').lower()
    s = re.sub(r'[^a-z0-9]+', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


CATMAP = {'iPad/Tablet Cover': 'iPad Cover', 'Pen Cover & Accessories': 'Pen & Accessories',
          '360 Keyboard Case': 'Keyboard Case', '360 Cartoon Keyboard Case': 'Keyboard Case',
          'Magic Keyboard': 'Keyboard Case', 'Keyboard': 'Keyboard Case', 'Wireless Mouse': 'Mouse',
          'Pouch Bag': 'Bag', 'Magnetic': 'Pen & Accessories', 'iOS Type C': 'Pen & Accessories',
          'Universal': 'Pen & Accessories', 'Others': 'Other', 'Drawing Tablet': 'Drawing Tablet'}

catalog = []
for v in variants:
    catalog.append({'name': v['name'], 'base': v['base'], 'color': v['color'], 'model': v['model'],
                    'category': v['category'], 'qty': v['qty'], 'price': v['price'], 'media': v['media']})

# keep anything the Stock Overview lists that the variant sheets never mention —
# drawing tablets, mice and the like live only on the summary sheet
have = {norm(p['name']) for p in catalog}
have_base = {norm(p['base']) for p in catalog}
kept = 0
for p in base['products']:
    n = norm(p['name'])
    if n in have or n in have_base:
        continue
    if any(n in h or h in n for h in have_base if len(h) > 6):
        continue
    catalog.append({'name': p['name'], 'base': p['name'], 'color': None, 'model': None,
                    'category': CATMAP.get(p['category'], p['category']),
                    'qty': p['qty'], 'price': p['price'], 'media': old.get(p['name'])})
    kept += 1

# ------------------------------------------------------------- thumbnails ---
media = sorted({p['media'] for p in catalog if p['media']})
ids = {m: f'i{n}' for n, m in enumerate(media)}
photos = {}
for m in media:
    im = Image.open(io.BytesIO(z.read(m))).convert('RGB')
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2)).resize((168, 168), Image.LANCZOS)
    b = io.BytesIO()
    im.save(b, 'JPEG', quality=66, optimize=True)
    photos[ids[m]] = 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()

products = []
for i, p in enumerate(catalog):
    products.append({'id': f'p{i}', 'name': p['name'], 'category': p['category'],
                     'qty': p['qty'], 'price': p['price'], 'photo': ids.get(p['media']),
                     'color': p['color'], 'model': p['model'], 'base': p['base']})

# ------------------------------------------------------------------ sales ---
sales = []
for i, s in enumerate(base['sales']):
    sales.append({'id': f's{i}', **s, 'orderId': None, 'customer': None, 'phone': None,
                  'address': None, 'fulfilment': 'instock', 'payment': None})

expenses = json.load(open('inventory/server/seed.json'))['expenses']

ts = [
    '// Seeded from Aesthetic_instocks.xlsx — one entry per design, colour and model',
    "export type Fulfilment = 'instock' | 'preorder'",
    "export type Payment = 'cod' | 'kpay'",
    'export type Product = { id: string; name: string; category: string; qty: number; price: number | null; '
    'photo?: string | null; color?: string | null; model?: string | null; base?: string }',
    'export type Sale = {',
    '  id: string; date: string; item: string; qty: number; unit: number; total: number',
    '  note: string | null; cat: string',
    '  orderId?: string | null; customer?: string | null; phone?: string | null; address?: string | null',
    '  fulfilment?: Fulfilment; payment?: Payment | null',
    '}',
    'export type OrderItem = { productId: string | null; item: string; qty: number; unit: number; total: number }',
    'export type Order = {',
    '  id: string; date: string; customer: string; phone: string; address: string',
    '  fulfilment: Fulfilment; payment: Payment; note: string | null; total: number',
    '  items: OrderItem[]; createdAt: string',
    '}',
    'export type Expense = { id: string; date: string; category: string; note: string; amount: number }',
    "export const EXPENSE_CATEGORIES = ['Product stock', 'Cargo', 'Boost / ads', 'Staff', 'Other'] as const",
    'export const PHOTOS: Record<string, string> = ' + json.dumps(photos),
    'export const SEED_PRODUCTS: Product[] = ' + json.dumps(products, ensure_ascii=False),
    'export const SEED_SALES: Sale[] = ' + json.dumps(sales, ensure_ascii=False),
    'export const SEED_EXPENSES: Expense[] = ' + json.dumps(expenses, ensure_ascii=False),
]
open('inventory/src/data.ts', 'w').write('\n'.join(ts) + '\n')

server_seed = {'products': products, 'sales': sales, 'expenses': expenses, 'orders': []}
json.dump(server_seed, open('inventory/server/seed.json', 'w'))

import collections
print('products:', len(products), '| from variant sheets:', len(variants), '| kept from overview:', kept)
print('with photo:', sum(1 for p in products if p['photo']), '| images:', len(photos),
      '| photo payload KB:', sum(len(v) for v in photos.values()) // 1024)
print('with colour:', sum(1 for p in products if p['color']), '| with model:', sum(1 for p in products if p['model']))
print(collections.Counter(p['category'] for p in products))
