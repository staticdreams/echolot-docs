// The Alpenglow catalog: an outdoor-gear shop in Zurich and Bern. Fixed data, so every tutorial sees the same answers.

export type Money = { amount: number; currency: 'CHF' }
export type Product = {
  sku: string
  name: string
  category: Category
  price: Money
  weight_g: number
  rating: number
  reviews: number
  stock: { zurich: number; bern: number }
  tags: string[]
}
export type Category = 'tents' | 'packs' | 'sleeping' | 'clothing' | 'climbing'

export const categories: { id: Category; name: string }[] = [
  { id: 'tents', name: 'Tents' },
  { id: 'packs', name: 'Packs' },
  { id: 'sleeping', name: 'Sleeping' },
  { id: 'clothing', name: 'Clothing' },
  { id: 'climbing', name: 'Climbing' },
]

const chf = (amount: number): Money => ({ amount, currency: 'CHF' })

export const products: Product[] = [
  { sku: 'TNT-MH-2P', name: 'Matterhorn 2P Tent', category: 'tents', price: chf(549), weight_g: 1840, rating: 4.9, reviews: 312, stock: { zurich: 42, bern: 17 }, tags: ['ultralight', '4-season'] },
  { sku: 'TNT-EIG-3P', name: 'Eiger 3P Tent', category: 'tents', price: chf(689), weight_g: 2610, rating: 4.8, reviews: 198, stock: { zurich: 12, bern: 9 }, tags: ['family', 'storm-proof'] },
  { sku: 'TNT-PIL-1P', name: 'Pilatus Bivy', category: 'tents', price: chf(329), weight_g: 790, rating: 4.7, reviews: 86, stock: { zurich: 30, bern: 4 }, tags: ['ultralight', 'solo'] },
  { sku: 'TNT-JNG-2P', name: 'Jungfrau Dome', category: 'tents', price: chf(459), weight_g: 2150, rating: 4.6, reviews: 254, stock: { zurich: 8, bern: 21 }, tags: ['3-season'] },
  { sku: 'PCK-TIT-30', name: 'Titlis 30L Pack', category: 'packs', price: chf(149), weight_g: 980, rating: 4.7, reviews: 441, stock: { zurich: 64, bern: 38 }, tags: ['daypack', 'bestseller'] },
  { sku: 'PCK-SAE-45', name: 'Säntis 45L Pack', category: 'packs', price: chf(219), weight_g: 1420, rating: 4.6, reviews: 187, stock: { zurich: 19, bern: 25 }, tags: ['trekking'] },
  { sku: 'PCK-BER-65', name: 'Bernina 65L Expedition', category: 'packs', price: chf(329), weight_g: 2080, rating: 4.8, reviews: 73, stock: { zurich: 6, bern: 0 }, tags: ['expedition'] },
  { sku: 'SLP-DOM-10', name: 'Dom Down Bag -10°', category: 'sleeping', price: chf(489), weight_g: 1150, rating: 4.9, reviews: 129, stock: { zurich: 14, bern: 11 }, tags: ['ultralight', 'winter'] },
  { sku: 'SLP-RIG-MAT', name: 'Rigi Air Mat', category: 'sleeping', price: chf(119), weight_g: 410, rating: 4.4, reviews: 602, stock: { zurich: 88, bern: 47 }, tags: ['ultralight', 'bestseller'] },
  { sku: 'SLP-TOD-LIN', name: 'Tödi Silk Liner', category: 'sleeping', price: chf(59), weight_g: 140, rating: 4.5, reviews: 233, stock: { zurich: 120, bern: 75 }, tags: ['travel'] },
  { sku: 'CLO-WEI-HS', name: 'Weisshorn Hardshell', category: 'clothing', price: chf(429), weight_g: 390, rating: 4.8, reviews: 351, stock: { zurich: 23, bern: 18 }, tags: ['waterproof', 'ultralight'] },
  { sku: 'CLO-MOE-DJ', name: 'Mönch Down Jacket', category: 'clothing', price: chf(319), weight_g: 360, rating: 4.7, reviews: 277, stock: { zurich: 31, bern: 0 }, tags: ['winter'] },
  { sku: 'CLO-RIG-FL', name: 'Rigi Fleece', category: 'clothing', price: chf(99), weight_g: 310, rating: 4.3, reviews: 518, stock: { zurich: 0, bern: 0 }, tags: ['bestseller'] },
  { sku: 'CLM-EIG-HAR', name: 'Eiger Harness', category: 'climbing', price: chf(89), weight_g: 330, rating: 4.6, reviews: 164, stock: { zurich: 40, bern: 22 }, tags: ['alpine'] },
  { sku: 'CLM-MH-HLM', name: 'Matterhorn Helmet', category: 'climbing', price: chf(119), weight_g: 230, rating: 4.8, reviews: 209, stock: { zurich: 27, bern: 13 }, tags: ['alpine', 'ultralight'] },
  { sku: 'CLM-JNG-R60', name: 'Jungfrau Rope 60m', category: 'climbing', price: chf(249), weight_g: 3600, rating: 4.7, reviews: 58, stock: { zurich: 9, bern: 5 }, tags: ['alpine'] },
]

export const findProduct = (sku: string) => products.find((p) => p.sku.toLowerCase() === sku.toLowerCase())

/** Every word of `text` must appear in the name, category or tags. */
export function search(text: string, list: Product[] = products): Product[] {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean)
  return list.filter((p) => {
    const haystack = `${p.name} ${p.category} ${p.tags.join(' ')}`.toLowerCase()
    return words.every((w) => haystack.includes(w) || haystack.includes(w.replace(/s$/, '')))
  })
}

export type OrderLine = { sku: string; name: string; quantity: number; price: Money }
export type Order = {
  id: string
  status: 'open' | 'paid' | 'shipped' | 'delivered' | 'cancelled'
  created_at: string
  lines: OrderLine[]
  total: Money
  shipping: { carrier: string; estimate: string; tracking?: string }
}

const line = (sku: string, quantity: number): OrderLine => {
  const p = findProduct(sku)!
  return { sku: p.sku, name: p.name, quantity, price: p.price }
}
const total = (lines: OrderLine[]) => chf(lines.reduce((sum, l) => sum + l.price.amount * l.quantity, 0))
const order = (id: string, status: Order['status'], created_at: string, lines: OrderLine[], shipping: Order['shipping']): Order => ({
  id,
  status,
  created_at,
  lines,
  total: total(lines),
  shipping,
})

/** Heidi's orders. The demo keeps no state: these are the same for everyone, and new orders are not stored. */
export const orders: Order[] = [
  order('ord_7Hk2Lw', 'shipped', '2026-10-28T14:12:09Z', [line('TNT-MH-2P', 1), line('SLP-DOM-10', 1), line('SLP-RIG-MAT', 1)], {
    carrier: 'Swiss Post',
    estimate: '2026-11-03',
    tracking: '99.60.123456.78901234',
  }),
  order('ord_8Jm4Qx', 'paid', '2026-10-30T08:41:55Z', [line('TNT-PIL-1P', 1)], { carrier: 'Swiss Post', estimate: '2026-11-04' }),
  order('ord_5Fd9Ra', 'delivered', '2026-09-12T17:03:20Z', [line('CLO-WEI-HS', 1), line('PCK-TIT-30', 1)], {
    carrier: 'DHL',
    estimate: '2026-09-15',
    tracking: 'JD014600006281234567',
  }),
]

export const findOrder = (id: string) => orders.find((o) => o.id === id)

export const priceOrder = (lines: { sku: string; quantity: number }[]): OrderLine[] => lines.map((l) => line(l.sku, l.quantity))
export { total as orderTotal }

export const user = { id: 'usr_42', name: 'Heidi Brunner', email: 'heidi@alpenglow.ch', role: 'admin', locale: 'de-CH' }
/** The demo sign-in, printed in the docs and in the API's index: nothing behind it is private. */
export const demoPassword = 'alpenglow'
export const demoClient = { id: 'alpenglow-demo', secret: 'demo-secret' }

/** A deterministic catalog of `count` products for large-body demos (same seed every time). */
export function bigCatalog(count: number) {
  const peaks = ['Matterhorn', 'Eiger', 'Pilatus', 'Jungfrau', 'Titlis', 'Säntis', 'Rigi', 'Bernina', 'Dom', 'Weisshorn', 'Mönch', 'Tödi']
  const kinds: { category: Category; names: string[]; price: number }[] = [
    { category: 'tents', names: ['2P Tent', '3P Tent', 'Bivy', 'Dome'], price: 329 },
    { category: 'packs', names: ['30L Pack', '45L Pack', '65L Expedition', 'Summit Daypack'], price: 149 },
    { category: 'sleeping', names: ['Down Bag -10°', 'Synthetic Bag', 'Air Mat', 'Liner'], price: 89 },
    { category: 'clothing', names: ['Hardshell', 'Down Jacket', 'Fleece', 'Softshell Pants'], price: 179 },
    { category: 'climbing', names: ['Harness', 'Helmet', 'Rope 60m', 'Belay Kit'], price: 69 },
  ]
  let seed = 42
  const random = () => (seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648
  const items: Product[] = Array.from({ length: count }, (_, i) => {
    const kind = kinds[i % kinds.length]
    return {
      sku: `${kind.category.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(6, '0')}`,
      name: `${peaks[Math.floor(random() * peaks.length)]} ${kind.names[Math.floor(random() * kind.names.length)]}`,
      category: kind.category,
      price: chf(Math.round(kind.price * (0.6 + random() * 1.4))),
      weight_g: Math.round(200 + random() * 2800),
      rating: Math.round((3.8 + random() * 1.2) * 10) / 10,
      reviews: Math.floor(random() * 900),
      stock: { zurich: Math.floor(random() * 60), bern: Math.floor(random() * 40) },
      tags: random() > 0.5 ? ['ultralight'] : ['bestseller'],
    }
  })
  return { exported_at: '2026-10-30T09:00:00Z', total: count, items }
}
