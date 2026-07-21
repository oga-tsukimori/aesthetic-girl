"""Walk every tab at every breakpoint and report layout faults:
horizontal overflow, elements escaping the viewport, and text that has
collapsed to an unreadable width."""
from playwright.sync_api import sync_playwright
import pathlib, sys

URL = 'file://' + str(pathlib.Path('bundle.html').resolve())
WIDTHS = [320, 360, 390, 430, 600, 768, 900, 1024, 1280, 1440, 1920]
TABS = ['Overview', 'Products', 'Sales', 'Expenses']

AUDIT = """() => {
  const vw = document.documentElement.clientWidth
  const faults = []
  const seen = new Set()
  for (const el of document.querySelectorAll('main *, header *')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const cs = getComputedStyle(el)
    if (cs.position === 'fixed') continue
    // does it stick out of the viewport?
    if (r.right > vw + 1 || r.left < -1) {
      // an ancestor with its own horizontal scroll makes this legitimate
      let p = el.parentElement, scrolls = false
      while (p) {
        const pcs = getComputedStyle(p)
        if (['auto','scroll'].includes(pcs.overflowX)) { scrolls = true; break }
        p = p.parentElement
      }
      if (!scrolls) {
        const key = el.tagName + (el.className || '').toString().slice(0, 40)
        if (!seen.has(key)) {
          seen.add(key)
          faults.push({ kind: 'overflow', tag: el.tagName,
                        cls: (el.className || '').toString().slice(0, 52),
                        right: Math.round(r.right), text: (el.textContent || '').trim().slice(0, 28) })
        }
      }
    }
    // text squeezed into a sliver
    if (el.children.length === 0 && (el.textContent || '').trim().length > 6 && r.width < 34) {
      faults.push({ kind: 'squeezed', tag: el.tagName, w: Math.round(r.width),
                    text: (el.textContent || '').trim().slice(0, 28) })
    }
  }
  return { vw, scrollWidth: document.documentElement.scrollWidth, faults: faults.slice(0, 6) }
}"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    problems = 0
    for w in WIDTHS:
        page = browser.new_page(viewport={'width': w, 'height': 900})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(URL)
        page.wait_for_timeout(3600)
        for tab in TABS:
            page.get_by_role('tab', name=tab).click()
            page.wait_for_timeout(700)
            r = page.evaluate(AUDIT)
            over = r['scrollWidth'] - r['vw']
            bad = over > 1 or r['faults']
            if bad:
                problems += 1
                print(f"  {w:>5}px {tab:<9} scroll+{over:<4} {r['faults']}")
            else:
                print(f"  {w:>5}px {tab:<9} ok")
        if errors:
            print(f'  {w}px JS ERRORS: {errors[:2]}')
        page.close()
    browser.close()
    print('\nfaults:', problems)
    sys.exit(0)
