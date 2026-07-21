import express from 'express'
import cors from 'cors'
import { all, write, reset, id } from './db.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

const PORT = process.env.PORT || 4000
const monthOf = (iso) => String(iso).slice(0, 7)
const bad = (res, msg) => res.status(400).json({ error: msg })

/* ------------------------------- products ------------------------------- */

app.get('/api/products', (_req, res) => res.json(all('products')))

app.post('/api/products', (req, res) => {
  const { name, category, qty, price, photo } = req.body || {}
  if (!name?.trim()) return bad(res, 'name is required')
  const product = {
    id: id('p'),
    name: name.trim(),
    category: category || 'Other',
    qty: Math.max(0, Number(qty) || 0),
    price: price == null || price === '' ? null : Number(price),
    photo: photo ?? null,
  }
  write((db) => db.products.unshift(product))
  res.status(201).json(product)
})

app.patch('/api/products/:id', (req, res) => {
  const patch = req.body || {}
  const updated = write((db) => {
    const p = db.products.find((x) => x.id === req.params.id)
    if (!p) return null
    if (patch.name != null) p.name = String(patch.name).trim()
    if (patch.category != null) p.category = patch.category
    if (patch.qty != null) p.qty = Math.max(0, Number(patch.qty) || 0)
    if (patch.price !== undefined) p.price = patch.price === null || patch.price === '' ? null : Number(patch.price)
    return p
  })
  if (!updated) return res.status(404).json({ error: 'product not found' })
  res.json(updated)
})

/** Relative stock movement — the +/- steppers and restocks use this. */
app.post('/api/products/:id/adjust', (req, res) => {
  const by = Number(req.body?.by)
  if (!Number.isFinite(by)) return bad(res, 'by must be a number')
  const updated = write((db) => {
    const p = db.products.find((x) => x.id === req.params.id)
    if (!p) return null
    p.qty = Math.max(0, p.qty + by)
    return p
  })
  if (!updated) return res.status(404).json({ error: 'product not found' })
  res.json(updated)
})

app.delete('/api/products/:id', (req, res) => {
  const gone = write((db) => {
    const i = db.products.findIndex((x) => x.id === req.params.id)
    if (i < 0) return false
    db.products.splice(i, 1)
    return true
  })
  if (!gone) return res.status(404).json({ error: 'product not found' })
  res.status(204).end()
})

/* -------------------------------- orders -------------------------------- */
/* An order is what the shop actually takes: one customer, one payment method,
   one or more line items. Each line becomes a sale row; stock only moves for
   items sold from stock, never for preorders.                                */

app.get('/api/orders', (_req, res) => res.json(all('orders')))

app.post('/api/orders', (req, res) => {
  const {
    customer = '', phone = '', address = '', date,
    fulfilment = 'instock', payment = 'cod', items = [], note = '',
  } = req.body || {}

  if (!Array.isArray(items) || items.length === 0) return bad(res, 'an order needs at least one item')
  if (!date) return bad(res, 'date is required')
  if (!['instock', 'preorder'].includes(fulfilment)) return bad(res, 'fulfilment must be instock or preorder')
  if (!['cod', 'kpay'].includes(payment)) return bad(res, 'payment must be cod or kpay')

  const products = all('products')
  const lines = []

  for (const [i, raw] of items.entries()) {
    const qty = Number(raw.qty)
    const unit = Number(raw.unit)
    const product = raw.productId ? products.find((p) => p.id === raw.productId) : null
    const name = (raw.item || product?.name || '').trim()

    if (!name) return bad(res, `item ${i + 1} has no product`)
    if (!Number.isFinite(qty) || qty <= 0) return bad(res, `item ${i + 1} needs a quantity above zero`)
    if (!Number.isFinite(unit) || unit <= 0) return bad(res, `item ${i + 1} needs a unit price above zero`)
    if (fulfilment === 'instock' && product && qty > product.qty)
      return bad(res, `only ${product.qty} of ${product.name} in stock — sell it as a preorder or lower the quantity`)

    lines.push({ product, productId: product?.id ?? null, item: name, qty, unit, total: qty * unit })
  }

  const orderId = id('o')
  const order = {
    id: orderId, date, customer: customer.trim(), phone: phone.trim(), address: address.trim(),
    fulfilment, payment, note: note.trim() || null,
    total: lines.reduce((t, l) => t + l.total, 0),
    items: lines.map(({ productId, item, qty, unit, total }) => ({ productId, item, qty, unit, total })),
    createdAt: new Date().toISOString(),
  }

  const sales = lines.map((l) => ({
    id: id('s'), orderId, date, item: l.item, qty: l.qty, unit: l.unit, total: l.total,
    note: order.note, cat: l.product?.category ?? guessCategory(l.item, products),
    customer: order.customer || null, phone: order.phone || null, address: order.address || null,
    fulfilment, payment,
  }))

  write((db) => {
    db.orders.unshift(order)
    db.sales.push(...sales)
    if (fulfilment === 'instock') {
      for (const l of lines) {
        if (!l.productId) continue
        const p = db.products.find((x) => x.id === l.productId)
        if (p) p.qty = Math.max(0, p.qty - l.qty)
      }
    }
  })

  res.status(201).json({ order, sales })
})

/* -------------------------------- sales --------------------------------- */

app.get('/api/sales', (req, res) => {
  const { month } = req.query
  const sales = all('sales')
  res.json(month ? sales.filter((s) => monthOf(s.date) === month) : sales)
})

/** Deleting a sale puts its stock back, unless it was a preorder. */
app.delete('/api/sales/:id', (req, res) => {
  const done = write((db) => {
    const i = db.sales.findIndex((s) => s.id === req.params.id)
    if (i < 0) return false
    const [sale] = db.sales.splice(i, 1)
    if (sale.fulfilment !== 'preorder') {
      const p = db.products.find((x) => x.name.toLowerCase() === String(sale.item).toLowerCase())
      if (p) p.qty += sale.qty
    }
    if (sale.orderId) {
      const order = db.orders.find((o) => o.id === sale.orderId)
      if (order) {
        order.items = order.items.filter((it) => it.item !== sale.item)
        order.total = order.items.reduce((t, it) => t + it.total, 0)
        if (order.items.length === 0) db.orders = db.orders.filter((o) => o.id !== order.id)
      }
    }
    return true
  })
  if (!done) return res.status(404).json({ error: 'sale not found' })
  res.status(204).end()
})

/* ------------------------------- expenses ------------------------------- */

app.get('/api/expenses', (req, res) => {
  const { month } = req.query
  const expenses = all('expenses')
  res.json(month ? expenses.filter((e) => monthOf(e.date) === month) : expenses)
})

app.post('/api/expenses', (req, res) => {
  const { date, category, amount, note } = req.body || {}
  if (!date) return bad(res, 'date is required')
  const value = Number(amount)
  if (!Number.isFinite(value) || value <= 0) return bad(res, 'amount must be above zero')
  const expense = {
    id: id('e'), date, category: category || 'Other',
    amount: value, note: (note || category || 'Expense').trim(),
  }
  write((db) => db.expenses.push(expense))
  res.status(201).json(expense)
})

app.delete('/api/expenses/:id', (req, res) => {
  const gone = write((db) => {
    const i = db.expenses.findIndex((e) => e.id === req.params.id)
    if (i < 0) return false
    db.expenses.splice(i, 1)
    return true
  })
  if (!gone) return res.status(404).json({ error: 'expense not found' })
  res.status(204).end()
})

/* ------------------------------ reporting ------------------------------- */

/** Sales, expenses and net for every month that has activity. */
app.get('/api/reports/monthly', (_req, res) => {
  const books = new Map()
  const bucket = (k) => {
    if (!books.has(k)) books.set(k, { key: k, revenue: 0, spend: 0, units: 0, orders: 0 })
    return books.get(k)
  }
  for (const s of all('sales')) {
    const b = bucket(monthOf(s.date))
    b.revenue += s.total
    b.units += s.qty
    b.orders += 1
  }
  for (const e of all('expenses')) bucket(monthOf(e.date)).spend += e.amount
  res.json(
    [...books.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((b) => ({ ...b, net: b.revenue - b.spend }))
  )
})

/** Everything the dashboard needs in one round trip. */
app.get('/api/snapshot', (_req, res) =>
  res.json({
    products: all('products'),
    sales: all('sales'),
    expenses: all('expenses'),
    orders: all('orders'),
  })
)

app.post('/api/admin/reset', (_req, res) => res.json({ ok: true, ...summarise(reset()) }))

app.get('/api/health', (_req, res) => res.json({ ok: true, ...summarise({ ...snapshot() }) }))

function snapshot() {
  return { products: all('products'), sales: all('sales'), expenses: all('expenses'), orders: all('orders') }
}

function summarise(db) {
  return {
    products: db.products.length,
    sales: db.sales.length,
    expenses: db.expenses.length,
    orders: db.orders.length,
  }
}

function guessCategory(name, products) {
  const tokens = new Set(String(name).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))
  let best = 'Other'
  let score = 0
  for (const p of products) {
    const pt = new Set(p.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))
    const overlap = [...tokens].filter((t) => pt.has(t)).length
    const value = overlap / Math.max(1, new Set([...tokens, ...pt]).size)
    if (value > score) { best = p.category; score = value }
  }
  return score >= 0.3 ? best : 'Other'
}

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'something broke on the server' })
})

app.listen(PORT, () => {
  console.log(`Aesthetic Instocks API listening on http://localhost:${PORT}`)
})
