import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH || path.join(dir, 'data', 'db.json')
const SEED_PATH = path.join(dir, 'seed.json')

/**
 * A tiny durable store: the whole database is one JSON document held in memory
 * and flushed to disk atomically after every mutation. No native modules, no
 * install step beyond `npm i` — swap this file for Postgres or SQLite when the
 * shop outgrows it; nothing above it needs to change.
 */
let db = null

function load() {
  if (db) return db
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  if (fs.existsSync(DB_PATH)) {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
  } else {
    db = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'))
    flush()
  }
  for (const k of ['products', 'sales', 'expenses', 'orders']) db[k] ||= []
  return db
}

function flush() {
  const tmp = DB_PATH + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(db))
  fs.renameSync(tmp, DB_PATH)
}

/** Read a collection. */
export function all(collection) {
  return load()[collection]
}

/** Run a mutation against the in-memory db, then persist it. */
export function write(fn) {
  const result = fn(load())
  flush()
  return result
}

/** Restore the shipped spreadsheet data, discarding local changes. */
export function reset() {
  db = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'))
  flush()
  return db
}

export const id = (prefix) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
