"""The monthly cost table the shop keeps outside this workbook, transcribed from
the screenshot. Total Cost = Salary + Product fees MMK + Cargo + Boost, which
checks out on every row except Sept (theirs adds the THB figure by mistake)."""
import json

# month key, salary, product fees THB, product fees MMK, cargo, boost, their stated total
ROWS = [
    ('2025-05', 500_000,  44_854, 6_279_560,   177_000,       0, 6_956_560, 'May+June'),
    ('2025-07', 250_000,   8_117, 1_136_380,   162_540,       0, 1_548_920, 'July (28 hti)'),
    ('2025-08', 250_000,  12_379, 1_733_060,   908_520,       0, 4_454_680, 'Aug'),
    ('2025-08', None,          0, 1_563_100,         0,       0, None,      'Aug (Air)'),
    ('2025-08', None,      5_649,   790_020,         0,       0, None,      'Aug extra shipment'),
    ('2025-09', 250_000,   8_234, 1_112_400,   226_145,       0, 1_596_779, 'Sept (Air)'),
    ('2025-10', 250_000,  29_260, 3_893_800, 1_061_932,       0, 5_205_732, 'Oct (Air)'),
    ('2025-11', 250_000,  14_403, 2_355_470,   676_750,       0, 3_282_220, 'Nov (Air)'),
    ('2025-12', 250_000,  10_027, 1_303_510,   155_650,       0, 1_709_160, 'Dec (Air)'),
    ('2026-01', 440_000,   9_785, 1_272_050,   315_900,       0, 2_027_950, 'Jan (Air)'),
    ('2026-02', 470_000,  16_120, 2_095_600,    89_440,       0, 2_655_040, 'Feb (Air)'),
    ('2026-03', 300_000,   8_983, 1_167_790,   617_760, 215_930, 2_301_480, 'Mar (Air)'),
    ('2026-04', 300_000,  23_788, 3_211_381,   532_000,       0, 4_043_381, 'Apr'),
    ('2026-05', 300_000,  30_994, 4_122_202,   418_500,  66_500, 4_907_202, 'May'),
    ('2026-06', 300_000,  27_395, 3_698_389, 1_626_280, 112_725, 5_737_394, 'June'),
    ('2026-07', 300_000,   9_116, 1_230_660,   311_715,  81_000, 1_923_375, 'Jul'),
]

expenses = []
n = 0


def push(month, category, amount, note):
    global n
    if not amount:
        return
    expenses.append({'id': f'e{n}', 'date': f'{month}-01', 'category': category,
                     'amount': int(amount), 'note': note})
    n += 1


print(f"{'month':9} {'salary':>9} {'product':>11} {'cargo':>10} {'boost':>9} {'computed':>11} {'theirs':>11}  check")
for month, salary, thb, product, cargo, boost, stated, label in ROWS:
    push(month, 'Staff', salary, f'Salary — {label}')
    push(month, 'Product stock', product, f'Product fees — {label}' + (f' ({thb:,} THB)' if thb else ''))
    push(month, 'Cargo', cargo, f'Cargo — {label}')
    push(month, 'Boost / ads', boost, f'Page boost — {label}')
    computed = (salary or 0) + product + cargo + boost
    if stated:
        mark = 'ok' if computed == stated else f'off by {stated - computed:+,}'
        print(f'{label[:9]:9} {salary or 0:>9,} {product:>11,} {cargo:>10,} {boost:>9,} '
              f'{computed:>11,} {stated:>11,}  {mark}')

by_month = {}
for e in expenses:
    by_month[e['date'][:7]] = by_month.get(e['date'][:7], 0) + e['amount']
print('\nentries:', len(expenses), '| total:', f"{sum(e['amount'] for e in expenses):,} Ks")
print('months covered:', len(by_month))

json.dump(expenses, open('expenses.json', 'w'))
