import { useState, useCallback, useRef } from 'react'
import Papa from 'papaparse'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const BLUE = '#2563eb'
const GREEN = '#059669'
const ORANGE = '#d97706'
const RED = '#dc2626'
const PURPLE = '#7c3aed'
const STORE_B_COLOR = '#7c3aed'
const COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#ea580c']

const T = {
  BG: '#f4f6fb',
  CARD: '#ffffff',
  BORDER: 'rgba(0,0,0,0.07)',
  BORDER_STRONG: 'rgba(0,0,0,0.14)',
  TEXT: '#111827',
  MUTED: '#6b7280',
  GRID: 'rgba(0,0,0,0.05)',
  NAV: 'rgba(244,246,251,0.95)',
  TOOLTIP_BG: '#1f2937',
  META_BG: '#eff6ff',
  META_BORDER: '#bfdbfe',
  META_TEXT: '#1d4ed8',
  SECTION: '#9ca3af',
}

function fmtMYR(n) {
  const abs = Math.abs(n)
  return (n < 0 ? '-' : '') + 'RM' + abs.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtMYRAbbr(n) {
  if (n >= 1000000) return 'RM' + (n / 1000000).toFixed(2) + 'M'
  if (n >= 1000) return 'RM' + (n / 1000).toFixed(1) + 'k'
  return 'RM' + Math.round(n).toLocaleString()
}
function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return Math.round(n).toLocaleString()
}
function fmtHour(h) {
  if (h === 0) return '12am'
  if (h < 12) return h + 'am'
  if (h === 12) return '12pm'
  return (h - 12) + 'pm'
}
function fmtMonth(key) {
  if (!key) return '—'
  const [y, m] = key.split('-')
  return new Date(y, m - 1).toLocaleString('default', { month: 'short', year: '2-digit' })
}
function seedRandom(d, h) {
  const x = Math.sin(d * 13 + h * 7 + 42) * 10000
  return x - Math.floor(x)
}

function classifyProductType(product) {
  const p = (product || '').toUpperCase()
  if (/\bMAVIC\b|\bMINI\b|\bPHANTOM\b|\bAVATA\b|\bFPV\b|\bAGRAS\b|\bNEO\b/.test(p) ||
      /\bDJI\s+AIR\b/.test(p)) return 'Drone'
  if (/\bOSMO\b|\bRS\s*[C234]\b|\bRONIN\b|\bPOCKET\b|\bMIC\b/.test(p)) return 'Handheld'
  return 'Other'
}

function generateDemoData(seed = 0) {
  const rows = []
  const categories = ['DJI PRODUCT', 'DJI ACCESSORIES', 'REPAIR', 'TRADE-IN']
  const products = ['DJI Mini 5 Pro', 'Osmo Pocket 4', 'DJI Neo 2', 'Osmo Action 5', 'DJI RC2', 'ND Filter Set', 'Carrying Bag']
  const salesmen = ['QBM-KC', 'QBM-ARIF', 'QBM-Desmond', 'QBM-KHAIRUL', 'QBM-WAYNE']
  const payments = ['Visa', 'Master', 'Bank Transfer', 'ATOME', 'Debit', 'Payment X']
  const brands = ['DJI', 'Other']
  const genders = ['Male', 'Female']
  const ages = ['Below 20', '20-29', '30-39', '40-49', '50 & Above']
  const now = new Date('2026-06-20')
  for (let i = 89; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dow = date.getDay()
    const isWeekend = dow === 0 || dow === 6
    const base = seed === 0 ? 7 : 5
    const count = Math.round((isWeekend ? base * 1.7 : base) * (0.7 + seedRandom(i + seed, 0) * 0.6))
    for (let o = 0; o < count; o++) {
      const hour = Math.floor(seedRandom(i + seed, o) * 14) + 9
      const cat = categories[Math.floor(seedRandom(i + seed, o + 1) * categories.length)]
      const prod = products[Math.floor(seedRandom(i + seed, o + 2) * products.length)]
      const sp = Math.round((seed === 0 ? 200 : 150) + seedRandom(i + seed, o + 3) * 4800)
      const rsp = Math.round(sp * (1 + seedRandom(i + seed, o + 4) * 0.15))
      const disc = seedRandom(i + seed, o + 5) > 0.7 ? Math.round(sp * 0.05) : 0
      rows.push({
        date: date.toISOString().split('T')[0], hour,
        category: cat, product: prod, orders: 1,
        revenue: sp - disc, rsp, discount: disc,
        payment: payments[Math.floor(seedRandom(i + seed, o + 6) * payments.length)],
        salesman: salesmen[Math.floor(seedRandom(i + seed, o + 7) * salesmen.length)],
        brand: brands[Math.floor(seedRandom(i + seed, o + 8) * brands.length)],
        gender: genders[Math.floor(seedRandom(i + seed, o + 9) * genders.length)],
        age_group: ages[Math.floor(seedRandom(i + seed, o + 10) * ages.length)],
      })
    }
  }
  const outlet = seed === 0 ? 'DEMO STORE A' : 'DEMO STORE B'
  return { rows, meta: { outlet, period: 'Last 90 days', generated: new Date().toISOString().split('T')[0] } }
}

const DATE_RE = /\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/

function parsePOSFile(raw) {
  const meta = {}
  let headerIdx = -1
  for (let i = 0; i < Math.min(raw.length, 20); i++) {
    const cell = (raw[i][0] || '').trim()
    if (cell.startsWith('Generated On')) meta.generated = cell.replace('Generated On :', '').trim()
    if (cell.startsWith('Report Time period')) meta.period = cell.replace('Report Time period :', '').trim()
    if (cell.startsWith('Outlets')) meta.outlet = cell.replace('Outlets :', '').trim()
    if (cell.startsWith('Total Transactions')) meta.totalTx = cell.replace('Total Transactions :', '').trim()
    if (cell === 'Date') { headerIdx = i; break }
  }
  if (headerIdx === -1) return null
  const headers = raw[headerIdx]
  const dataRows = raw.slice(headerIdx + 1)
    .filter(r => r[0] && DATE_RE.test(r[0]))
    .map(r => {
      const obj = {}
      headers.forEach((h, i) => { obj[h] = (r[i] || '').trim() })
      return obj
    })
  return { headers, dataRows, meta }
}

function normalizeRow(r) {
  if (r['Date'] && DATE_RE.test(r['Date'])) {
    const [datePart, timePart] = r['Date'].split(' ')
    let isoDate
    if (datePart.includes('/')) {
      const [dd, mm, yyyy] = datePart.split('/')
      isoDate = `${yyyy}-${mm}-${dd}`
    } else {
      isoDate = datePart
    }
    const hour = timePart ? parseInt(timePart.split(':')[0]) : 12
    const sp = parseFloat(r['Selling Price(MYR)']) || 0
    const rsp = parseFloat(r['RSP At Creation(MYR)']) || Math.abs(sp)
    const disc = parseFloat(r['Discount Amount(MYR)']) || 0
    const sub = parseFloat(r['Sub Total(MYR)']) || parseFloat(r['Total(MYR)']) || sp
    const isReturn = sub < 0
    return {
      date: isoDate, hour: isNaN(hour) ? 12 : hour,
      orders: isReturn ? -(parseFloat(r['Qty']) || 1) : (parseFloat(r['Qty']) || 1),
      revenue: sub, isReturn, rsp, discount: disc,
      category: r['Category Description'] || r['Product Category 1'] || 'Other',
      product: r['Product Description'] || 'Unknown',
      payment: (r['Payment Modes'] || 'Unknown').replace(/^Payment\s*X$/i, 'DPay'),
      salesman: r['Salesman'] || 'Unknown',
      brand: r['Brand'] || 'Other',
      gender: r['Customer Gender'] || 'Unknown',
      age_group: r['Customer Age Group'] || 'Unknown',
    }
  }
  return {
    date: r.date || '', hour: parseInt(r.hour) || 0,
    orders: parseFloat(r.orders) || 1, revenue: parseFloat(r.revenue) || 0,
    rsp: parseFloat(r.rsp) || 0, discount: parseFloat(r.discount) || 0,
    category: r.category || 'Other', product: r.product || 'Unknown',
    payment: r.payment || 'Unknown', salesman: r.salesman || 'Unknown',
    brand: r.brand || 'Other', gender: r.gender || 'Unknown',
    age_group: r.age_group || 'Unknown',
  }
}

function processData(rows, meta = {}) {
  const normalized = rows.map(normalizeRow).filter(r => r.date)
  const revenueByDate = {}, ordersByDate = {}, revenueByMonth = {}
  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0))
  const categoryRev = {}, productRev = {}, productOrders = {}, productUnitsSold = {}
  const productTypeRev = {}, productTypeOrders = {}
  const salesmanRev = {}, salesmanOrders = {}, salesmanProducts = {}
  const paymentRev = {}, paymentCount = {}
  const brandRev = {}, brandOrders = {}
  const genderCount = {}, ageOrders = {}
  let totalDiscount = 0, totalRSP = 0, totalRevenue = 0, totalOrders = 0
  let grossRevenue = 0, returnRevenue = 0, returnCount = 0

  normalized.forEach(r => {
    const { date, hour, orders, revenue, discount, rsp, category, product, payment, salesman, brand, gender, age_group, isReturn } = r
    const d = new Date(date)
    let dow = isNaN(d.getTime()) ? 0 : (d.getDay() + 6) % 7
    dow = Math.max(0, Math.min(6, dow))

    revenueByDate[date] = (revenueByDate[date] || 0) + revenue
    ordersByDate[date] = (ordersByDate[date] || 0) + orders
    const monthKey = date.slice(0, 7)
    revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + revenue
    if (hour >= 0 && hour < 24) heatmap[dow][hour] += Math.abs(orders)

    categoryRev[category] = (categoryRev[category] || 0) + revenue
    productRev[product] = (productRev[product] || 0) + revenue
    productOrders[product] = (productOrders[product] || 0) + orders
    if (!isReturn) productUnitsSold[product] = (productUnitsSold[product] || 0) + Math.abs(orders)
    const pType = classifyProductType(product)
    productTypeRev[pType] = (productTypeRev[pType] || 0) + revenue
    productTypeOrders[pType] = (productTypeOrders[pType] || 0) + Math.abs(orders)
    salesmanRev[salesman] = (salesmanRev[salesman] || 0) + revenue
    salesmanOrders[salesman] = (salesmanOrders[salesman] || 0) + orders
    if (!isReturn) {
      if (!salesmanProducts[salesman]) salesmanProducts[salesman] = {}
      salesmanProducts[salesman][product] = (salesmanProducts[salesman][product] || 0) + Math.abs(orders)
    }
    if (!isReturn) {
      paymentRev[payment] = (paymentRev[payment] || 0) + revenue
      paymentCount[payment] = (paymentCount[payment] || 0) + orders
    }
    brandRev[brand] = (brandRev[brand] || 0) + revenue
    brandOrders[brand] = (brandOrders[brand] || 0) + orders
    genderCount[gender] = (genderCount[gender] || 0) + 1
    ageOrders[age_group] = (ageOrders[age_group] || 0) + Math.abs(orders)
    totalDiscount += discount
    totalRSP += rsp * Math.abs(orders)
    totalRevenue += revenue
    totalOrders += Math.abs(orders)
    if (isReturn) { returnRevenue += Math.abs(revenue); returnCount++ }
    else grossRevenue += revenue
  })

  const sortedDates = Object.keys(revenueByDate).sort()
  const trend = sortedDates.map(d => ({
    date: d.slice(5),
    fullDate: d,
    revenue: Math.round(revenueByDate[d]),
    orders: Math.round(ordersByDate[d] || 0),
  }))

  const months = Object.keys(revenueByMonth).sort()
  const momCurrentLabel = months[months.length - 1] || ''
  const momPrevLabel = months[months.length - 2] || ''
  const momCurrent = revenueByMonth[momCurrentLabel] || 0
  const momPrev = revenueByMonth[momPrevLabel] || 0
  const momChange = momPrev > 0 ? ((momCurrent - momPrev) / momPrev) * 100 : 0
  const monthlyBreakdown = months.slice(-6).map(m => ({
    label: fmtMonth(m), key: m, revenue: Math.round(revenueByMonth[m] || 0),
  }))

  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const half = Math.floor(trend.length / 2)
  const prevRev = trend.slice(0, half).reduce((a, b) => a + b.revenue, 0)
  const currRev = trend.slice(half).reduce((a, b) => a + b.revenue, 0)
  const growth = prevRev > 0 ? ((currRev - prevRev) / prevRev) * 100 : 0
  const rspGap = totalRSP - totalRevenue
  const returnRate = (totalOrders + returnCount) > 0 ? returnCount / (totalOrders + returnCount) * 100 : 0

  const categories = Object.entries(categoryRev).sort((a, b) => b[1] - a[1]).map(([name, revenue]) => ({ name, revenue: Math.round(revenue) }))
  const productTypes = ['Drone', 'Handheld', 'Other']
    .map(name => ({ name, revenue: Math.round(productTypeRev[name] || 0), orders: productTypeOrders[name] || 0 }))
    .filter(p => p.revenue > 0)
  const topProducts = Object.entries(productRev).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, revenue]) => ({ name, revenue: Math.round(revenue), orders: productOrders[name] || 0 }))
  const allProducts = Object.entries(productUnitsSold).sort((a, b) => b[1] - a[1]).map(([name, units]) => ({ name, units, revenue: Math.round(productRev[name] || 0) }))
  const salesmen = Object.entries(salesmanRev).sort((a, b) => b[1] - a[1]).map(([name, revenue]) => ({
    name, revenue: Math.round(revenue), orders: salesmanOrders[name] || 0,
    products: Object.entries(salesmanProducts[name] || {}).sort((a, b) => b[1] - a[1]).map(([product, units]) => ({ product, units })),
  }))
  const payments = Object.entries(paymentRev).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, revenue]) => ({ name, revenue: Math.round(revenue), count: paymentCount[name] || 0 }))
  const brands = Object.entries(brandRev).sort((a, b) => b[1] - a[1]).map(([name, revenue]) => ({ name, revenue: Math.round(revenue), orders: brandOrders[name] || 0 }))
  const genders = Object.entries(genderCount).map(([name, value]) => ({ name, value }))
  const ageGroups = Object.entries(ageOrders)
    .sort((a, b) => {
      const order = ['Below 20', '20-29', '30-39', '40-49', '50 & Above']
      return order.indexOf(a[0]) - order.indexOf(b[0])
    })
    .map(([name, value]) => ({ name, value }))
  const dowTotals = heatmap.map((row, d) => ({ day: DAYS[d], value: row.reduce((a, b) => a + b, 0) }))

  // Peak hour+day: single busiest heatmap cell
  let peakVal = 0, peakD = 0, peakH = 0
  heatmap.forEach((row, d) => row.forEach((v, h) => {
    if (v > peakVal) { peakVal = v; peakD = d; peakH = h }
  }))

  // Busiest day: independently from total orders per day of week
  const busiestDay = heatmap
    .map((row, d) => ({ d, total: row.reduce((a, b) => a + b, 0) }))
    .reduce((best, cur) => cur.total > best.total ? cur : best, { d: 0, total: 0 }).d

  // Slowest active slot: minimum during store hours (10am–10pm, matching 10:30am–10:30pm opening)
  let slowVal = Infinity, slowD = 0, slowH = 10
  heatmap.forEach((row, d) => {
    for (let h = 10; h <= 22; h++) {
      if (row[h] < slowVal) { slowVal = row[h]; slowD = d; slowH = h }
    }
  })

  const weekdayTotal = heatmap.slice(0, 5).flat().reduce((a, b) => a + b, 0) / 5
  const weekendTotal = heatmap.slice(5).flat().reduce((a, b) => a + b, 0) / 2
  const weekendRatio = weekdayTotal > 0 ? (weekendTotal / weekdayTotal).toFixed(1) : '—'

  return {
    trend, totalRevenue, totalOrders, aov, growth, totalDiscount, rspGap,
    categories, productTypes, topProducts, allProducts, salesmen, payments, brands, genders, ageGroups,
    heatmap, dowTotals, peakHour: peakH, peakDay: peakD, slowHour: slowH, slowDay: slowD,
    weekendRatio, busiestDay, meta, grossRevenue, returnRevenue, returnCount, returnRate,
    momCurrent, momPrev, momChange, momCurrentLabel, momPrevLabel, monthlyBreakdown,
  }
}

function exportCSV(data, fileName) {
  const rows = [
    ['StoreDash Export — ' + (data.meta?.outlet || 'Store')],
    [],
    ['SUMMARY'],
    ['Metric', 'Value'],
    ['Gross Revenue (MYR)', data.grossRevenue.toFixed(2)],
    ['Return Revenue (MYR)', data.returnRevenue.toFixed(2)],
    ['Net Revenue (MYR)', data.totalRevenue.toFixed(2)],
    ['Total Orders', data.totalOrders],
    ['Return Count', data.returnCount],
    ['Return Rate %', data.returnRate.toFixed(2)],
    ['Avg Order Value (MYR)', data.aov.toFixed(2)],
    ['Total Discount (MYR)', data.totalDiscount.toFixed(2)],
    ['RSP Gap (MYR)', data.rspGap.toFixed(2)],
    [],
    ['TOP PRODUCTS'],
    ['Product', 'Revenue (MYR)', 'Orders'],
    ...data.topProducts.map(p => [p.name, p.revenue, p.orders]),
    [],
    ['SALESMEN'],
    ['Salesman', 'Revenue (MYR)', 'Orders'],
    ...data.salesmen.map(s => [s.name, s.revenue, s.orders]),
    [],
    ['CATEGORIES'],
    ['Category', 'Revenue (MYR)'],
    ...data.categories.map(c => [c.name, c.revenue]),
    [],
    ['PAYMENT METHODS'],
    ['Payment', 'Revenue (MYR)', 'Count'],
    ...data.payments.map(p => [p.name, p.revenue, p.count]),
    [],
    ['MONTHLY BREAKDOWN'],
    ['Month', 'Revenue (MYR)'],
    ...data.monthlyBreakdown.map(m => [m.key, m.revenue]),
    [],
    ['DAILY TREND'],
    ['Date', 'Revenue (MYR)', 'Orders'],
    ...data.trend.map(t => [t.fullDate, t.revenue, t.orders]),
  ]
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = (fileName?.replace('.csv', '') || 'storedash') + '_export.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const TT = { background: T.TOOLTIP_BG, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#f9fafb', fontSize: 12, padding: '8px 12px' }
const TC = false // disable hover cursor rectangle on bar charts
const TS = { itemStyle: { color: '#f9fafb' }, labelStyle: { color: '#d1d5db' } }

function KPI({ icon, label, value, delta, color, small }) {
  return (
    <div style={{ background: T.CARD, border: `1px solid ${T.BORDER}`, borderRadius: 12, padding: small ? '0.75rem 1rem' : '1rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <p style={{ fontSize: 11, color: T.MUTED, margin: '0 0 6px' }}>{icon} {label}</p>
      <p style={{ fontSize: small ? 16 : 20, fontWeight: 700, margin: 0, color: T.TEXT }}>{value}</p>
      {delta && <p style={{ fontSize: 11, margin: '4px 0 0', color: color || T.MUTED }}>{delta}</p>}
    </div>
  )
}

function Card({ title, children, style, action }) {
  return (
    <div style={{ background: T.CARD, border: `1px solid ${T.BORDER}`, borderRadius: 16, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', ...style }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.MUTED, margin: 0 }}>{title}</p>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2rem 0 1rem' }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: T.SECTION, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: T.BORDER }} />
    </div>
  )
}

function HeatmapCell({ value, max, isTotal }) {
  const t = max > 0 ? value / max : 0
  return (
    <div title={`${Math.round(value)} orders`} style={{
      flex: 1, height: 26, borderRadius: 2, minWidth: 0,
      background: isTotal ? 'transparent' : t === 0 ? '#f1f5f9' : `rgba(37,99,235,${0.08 + t * 0.82})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {value > 0 && (
        <span style={{ fontSize: 8, fontWeight: 600, lineHeight: 1, color: isTotal ? T.MUTED : t > 0.55 ? '#fff' : '#475569', pointerEvents: 'none' }}>
          {Math.round(value)}
        </span>
      )}
    </div>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 12, padding: '5px 14px', borderRadius: 8, cursor: 'pointer',
      border: `1px solid ${active ? BLUE : T.BORDER_STRONG}`,
      background: active ? BLUE : T.CARD,
      color: active ? '#fff' : T.MUTED,
      fontWeight: active ? 600 : 400,
      transition: 'all 0.15s',
      boxShadow: active ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
    }}>{children}</button>
  )
}

function DeltaBadge({ value, suffix = '%', invert = false }) {
  const positive = invert ? value < 0 : value >= 0
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
      background: positive ? '#dcfce7' : '#fef2f2',
      color: positive ? '#16a34a' : '#dc2626',
    }}>
      {value >= 0 ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  )
}

function parseFile(file, onSuccess, onError) {
  Papa.parse(file, {
    header: false, skipEmptyLines: false,
    complete: ({ data: raw }) => {
      const parsed = parsePOSFile(raw)
      if (parsed) {
        onSuccess(processData(parsed.dataRows, parsed.meta))
      } else {
        Papa.parse(file, {
          header: true, skipEmptyLines: true,
          complete: ({ data: rows }) => {
            if (!rows.length) { onError('No data found.'); return }
            onSuccess(processData(rows, {}))
          },
          error: () => onError('Failed to read file.'),
        })
      }
    },
    error: () => onError('Failed to read file.'),
  })
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [fileName, setFileName] = useState(null)
  const [compareData, setCompareData] = useState(null)
  const [compareFileName, setCompareFileName] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const [period, setPeriod] = useState('all')
  const [search, setSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [targets, setTargets] = useState({})
  const [editingTargets, setEditingTargets] = useState(false)
  const [allProductSearch, setAllProductSearch] = useState('')
  const [selectedSalesman, setSelectedSalesman] = useState(null)
  const [salesmanSearch, setSalesmanSearch] = useState('')
  const [salesmanProductSearch, setSalesmanProductSearch] = useState('')
  const fileRef = useRef()
  const compareFileRef = useRef()

  const handleFile = useCallback(file => {
    if (!file) return
    setError(null); setFileName(file.name)
    parseFile(file, setData, setError)
  }, [])

  const handleCompareFile = useCallback(file => {
    if (!file) return
    setCompareFileName(file.name)
    parseFile(file, setCompareData, () => {})
  }, [])

  const onDrop = useCallback(e => {
    e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const loadDemo = () => {
    setFileName('demo_store_a.csv'); setError(null)
    const { rows, meta } = generateDemoData(0)
    setData(processData(rows, meta))
  }

  const loadDemoCompare = () => {
    setCompareFileName('demo_store_b.csv')
    const { rows, meta } = generateDemoData(99)
    setCompareData(processData(rows, meta))
  }

  const resetAll = () => {
    setData(null); setFileName(null); setCompareData(null); setCompareFileName(null)
    setError(null); setSearch(''); setProductSearch(''); setAllProductSearch(''); setSelectedSalesman(null); setSalesmanSearch(''); setSalesmanProductSearch(''); setTargets({})
  }

  const trend = data ? (() => {
    const t = data.trend
    if (period === '7d') return t.slice(-7)
    if (period === '30d') return t.slice(-30)
    return t
  })() : []

  const heatmapMax = data ? Math.max(...data.heatmap.flat()) : 1
  const dowMax = data ? Math.max(...data.dowTotals.map(d => d.value)) : 1
  const filteredSalesmen = data ? (search ? data.salesmen.filter(s => s.name.toLowerCase().includes(search.toLowerCase())) : data.salesmen) : []
  const activeProducts = data ? (productSearch ? data.topProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())) : data.topProducts) : []

  // Merge trend for comparison overlay
  const comparisonTrend = (() => {
    if (!data || !compareData) return []
    const aMap = {}, bMap = {}
    data.trend.forEach(t => { aMap[t.date] = t.revenue })
    compareData.trend.forEach(t => { bMap[t.date] = t.revenue })
    const allDates = [...new Set([...Object.keys(aMap), ...Object.keys(bMap)])].sort()
    return allDates.map(date => ({ date, storeA: aMap[date] || 0, storeB: bMap[date] || 0 }))
  })()

  // Category comparison
  const categoryComparison = (() => {
    if (!data || !compareData) return []
    const bMap = {}
    compareData.categories.forEach(c => { bMap[c.name] = c.revenue })
    return data.categories.slice(0, 6).map(c => ({ name: c.name, storeA: c.revenue, storeB: bMap[c.name] || 0 }))
  })()

  const monthlyComparison = (() => {
    if (!data || !compareData) return []
    const aMap = {}, bMap = {}
    data.monthlyBreakdown.forEach(m => { aMap[m.key] = m.revenue })
    compareData.monthlyBreakdown.forEach(m => { bMap[m.key] = m.revenue })
    const allKeys = [...new Set([...Object.keys(aMap), ...Object.keys(bMap)])].sort().slice(-6)
    return allKeys.map(key => ({ label: fmtMonth(key), key, storeA: aMap[key] || 0, storeB: bMap[key] || 0 }))
  })()

  const productComparison = (() => {
    if (!data || !compareData) return []
    const bMap = {}
    compareData.topProducts.forEach(p => { bMap[p.name] = p.revenue })
    const aMap = {}
    data.topProducts.forEach(p => { aMap[p.name] = p.revenue })
    const allNames = [...new Set([...data.topProducts.map(p => p.name), ...compareData.topProducts.map(p => p.name)])]
    return allNames
      .map(name => ({ name, storeA: aMap[name] || 0, storeB: bMap[name] || 0 }))
      .sort((a, b) => (b.storeA + b.storeB) - (a.storeA + a.storeB))
      .slice(0, 8)
  })()

  const nameA = data?.meta?.outlet || 'Store A'
  const nameB = compareData?.meta?.outlet || 'Store B'

  return (
    <div style={{ minHeight: '100vh', background: T.BG, color: T.TEXT, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Navbar */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 10,
        borderBottom: `1px solid ${T.BORDER}`,
        background: T.NAV, backdropFilter: 'blur(12px)',
        padding: '0 2rem', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📊</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: BLUE }}>StoreDash</span>
          {data?.meta?.outlet && (
            <span style={{ fontSize: 12, color: T.MUTED, borderLeft: `1px solid ${T.BORDER_STRONG}`, paddingLeft: 10, marginLeft: 4 }}>
              {data.meta.outlet}
            </span>
          )}
          {compareData?.meta?.outlet && (
            <span style={{ fontSize: 12, color: STORE_B_COLOR, borderLeft: `1px solid ${T.BORDER_STRONG}`, paddingLeft: 10, marginLeft: 4 }}>
              vs {compareData.meta.outlet}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {data && (
            <>
              <span style={{ fontSize: 12, color: T.MUTED }}>📄 {fileName}</span>
              {!compareData && (
                <>
                  <input ref={compareFileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleCompareFile(e.target.files[0])} />
                  <button onClick={() => compareFileRef.current.click()}
                    style={{ fontSize: 12, padding: '5px 14px', borderRadius: 8, border: `1px solid ${STORE_B_COLOR}`, background: '#f5f3ff', color: STORE_B_COLOR, cursor: 'pointer', fontWeight: 500 }}>
                    + Compare store
                  </button>
                </>
              )}
              {compareData && (
                <button onClick={() => { setCompareData(null); setCompareFileName(null) }}
                  style={{ fontSize: 12, padding: '5px 14px', borderRadius: 8, border: `1px solid ${T.BORDER_STRONG}`, background: T.CARD, color: T.MUTED, cursor: 'pointer' }}>
                  Remove comparison
                </button>
              )}
              <button onClick={() => exportCSV(data, fileName)}
                style={{ fontSize: 12, padding: '5px 14px', borderRadius: 8, border: `1px solid ${T.BORDER_STRONG}`, background: T.CARD, color: T.MUTED, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                ⬇ Export CSV
              </button>
            </>
          )}
          <button onClick={resetAll}
            style={{ fontSize: 12, padding: '5px 14px', borderRadius: 8, border: `1px solid ${T.BORDER_STRONG}`, background: T.CARD, color: T.MUTED, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            {data ? 'Upload new' : 'Upload CSV'}
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Upload */}
        {!data && (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 6px', color: T.TEXT }}>Store Dashboard</h1>
              <p style={{ color: T.MUTED, fontSize: 14 }}>Drop your CustomerPurchaseListing CSV to get started</p>
            </div>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current.click()}
              style={{
                border: `2px dashed ${dragging ? BLUE : T.BORDER_STRONG}`,
                borderRadius: 16, padding: '4rem 2rem', textAlign: 'center', cursor: 'pointer',
                background: dragging ? '#eff6ff' : T.CARD,
                transition: 'all 0.2s', marginBottom: '1.5rem',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
              <div style={{ fontSize: 44, marginBottom: 14 }}>📂</div>
              <p style={{ fontWeight: 600, fontSize: 16, margin: '0 0 6px', color: T.TEXT }}>Drop your CSV file here</p>
              <p style={{ color: T.MUTED, fontSize: 13, margin: '0 0 1.5rem' }}>or click to browse</p>
              <button onClick={e => { e.stopPropagation(); loadDemo() }}
                style={{ padding: '9px 22px', borderRadius: 9, cursor: 'pointer', fontSize: 13, border: `1px solid ${BLUE}`, background: '#eff6ff', color: BLUE, fontWeight: 600 }}>
                ✨ Try with demo data
              </button>
            </div>
            <div style={{ background: T.CARD, border: `1px solid ${T.BORDER}`, borderRadius: 12, padding: '1rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <p style={{ fontWeight: 600, fontSize: 13, margin: '0 0 4px', color: T.TEXT }}>Supported formats</p>
              <p style={{ fontSize: 12, color: T.MUTED, margin: '0 0 12px' }}>Auto-detected — just drop the file</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ background: T.BG, border: `1px solid ${T.BORDER}`, borderRadius: 8, padding: '10px 12px', flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: BLUE, margin: '0 0 4px' }}>POS Report (CustomerPurchaseListing)</p>
                  <p style={{ fontSize: 11, color: T.MUTED, margin: 0 }}>Your store export — works as-is, metadata rows auto-skipped</p>
                </div>
                <div style={{ background: T.BG, border: `1px solid ${T.BORDER}`, borderRadius: 8, padding: '10px 12px', flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: T.MUTED, margin: '0 0 4px' }}>Simple CSV</p>
                  <p style={{ fontSize: 11, color: T.MUTED, margin: 0 }}>Columns: date, orders, revenue, category, product, payment, salesman, brand</p>
                </div>
              </div>
            </div>
          </>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '0.75rem 1rem', color: '#dc2626', fontSize: 13, marginTop: 12 }}>
            ⚠️ {error}
          </div>
        )}

        {data && (
          <>
            {/* Meta banner */}
            {data.meta?.period && (
              <div style={{ background: T.META_BG, border: `1px solid ${T.META_BORDER}`, borderRadius: 10, padding: '10px 16px', marginBottom: '1.5rem', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                {data.meta.outlet && <span style={{ fontSize: 12, color: T.META_TEXT, fontWeight: 600 }}>🏪 {data.meta.outlet}</span>}
                {data.meta.period && <span style={{ fontSize: 12, color: '#3b82f6' }}>📅 {data.meta.period}</span>}
                {data.meta.generated && <span style={{ fontSize: 12, color: T.MUTED }}>🕐 Generated: {data.meta.generated}</span>}
                {data.meta.totalTx && <span style={{ fontSize: 12, color: T.MUTED }}>🧾 {data.meta.totalTx} transactions</span>}
              </div>
            )}

            {/* Filters */}
            <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem' }}>
              {[['7d','7 days'],['30d','30 days'],['all','All time']].map(([k, l]) => (
                <TabBtn key={k} active={period === k} onClick={() => setPeriod(k)}>{l}</TabBtn>
              ))}
            </div>

            {/* ── STORE COMPARISON ── */}
            {compareData && (
              <>
                <SectionLabel>Store comparison</SectionLabel>

                {/* Side-by-side KPI comparison */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  {[
                    { icon: '💰', label: 'Net revenue', a: data.totalRevenue, b: compareData.totalRevenue, fmt: fmtMYR },
                    { icon: '🛒', label: 'Total orders', a: data.totalOrders, b: compareData.totalOrders, fmt: fmtNum },
                    { icon: '🧾', label: 'Avg order value', a: data.aov, b: compareData.aov, fmt: fmtMYR },
                    { icon: '🏷️', label: 'Total discounts', a: data.totalDiscount, b: compareData.totalDiscount, fmt: fmtMYR, invert: true },
                  ].map(({ icon, label, a, b, fmt, invert }) => {
                    const diff = b > 0 ? ((a - b) / b) * 100 : 0
                    return (
                      <div key={label} style={{ background: T.CARD, border: `1px solid ${T.BORDER}`, borderRadius: 12, padding: '1rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                        <p style={{ fontSize: 11, color: T.MUTED, margin: '0 0 10px' }}>{icon} {label}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 2, background: BLUE }} />
                              <span style={{ fontSize: 11, color: T.MUTED }}>{nameA}</span>
                              <span style={{ fontSize: 16, fontWeight: 700, color: T.TEXT }}>{fmt(a)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 2, background: STORE_B_COLOR }} />
                              <span style={{ fontSize: 11, color: T.MUTED }}>{nameB}</span>
                              <span style={{ fontSize: 16, fontWeight: 700, color: T.TEXT }}>{fmt(b)}</span>
                            </div>
                          </div>
                          <DeltaBadge value={diff} invert={invert} />
                        </div>
                        {/* Visual bar comparison */}
                        <div style={{ marginTop: 10 }}>
                          <div style={{ background: '#e5e7eb', borderRadius: 4, height: 5, marginBottom: 4 }}>
                            <div style={{ background: BLUE, height: '100%', borderRadius: 4, width: `${Math.min(100, a / Math.max(a, b) * 100)}%` }} />
                          </div>
                          <div style={{ background: '#e5e7eb', borderRadius: 4, height: 5 }}>
                            <div style={{ background: STORE_B_COLOR, height: '100%', borderRadius: 4, width: `${Math.min(100, b / Math.max(a, b) * 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Revenue overlay trend */}
                <Card title="Revenue trend — store comparison" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                    {[{ color: BLUE, name: nameA }, { color: STORE_B_COLOR, name: nameB }].map(s => (
                      <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.MUTED }}>
                        <div style={{ width: 20, height: 3, borderRadius: 2, background: s.color }} />
                        {s.name}
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={comparisonTrend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.GRID} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: T.MUTED }} interval={Math.max(0, Math.floor(comparisonTrend.length / 7))} />
                      <YAxis tick={{ fontSize: 11, fill: T.MUTED }} tickFormatter={v => fmtMYRAbbr(v)} />
                      <Tooltip {...TS} contentStyle={TT} cursor={TC} separator=": " formatter={(v, name) => [fmtMYR(v), name === 'storeA' ? nameA : nameB]} />
                      <Line type="monotone" dataKey="storeA" stroke={BLUE} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="storeB" stroke={STORE_B_COLOR} strokeWidth={2} dot={false} activeDot={{ r: 4 }} strokeDasharray="5 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                {/* Category comparison */}
                <Card title="Revenue by category — comparison">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={categoryComparison} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.GRID} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: T.MUTED }} />
                      <YAxis tick={{ fontSize: 11, fill: T.MUTED }} tickFormatter={v => fmtMYRAbbr(v)} />
                      <Tooltip {...TS} contentStyle={TT} cursor={TC} separator=": " formatter={(v, name) => [fmtMYR(v), name === 'storeA' ? nameA : nameB]} />
                      <Bar dataKey="storeA" fill={BLUE} radius={[4,4,0,0]} name="storeA" />
                      <Bar dataKey="storeB" fill={STORE_B_COLOR} radius={[4,4,0,0]} name="storeB" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    {[{ color: BLUE, name: nameA }, { color: STORE_B_COLOR, name: nameB }].map(s => (
                      <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.MUTED }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
                        {s.name}
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Month-over-month comparison */}
                <Card title="Monthly revenue — month-over-month comparison" style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                    {[{ color: BLUE, name: nameA, mom: data.momChange }, { color: STORE_B_COLOR, name: nameB, mom: compareData.momChange }].map(s => (
                      <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
                        <span style={{ color: T.MUTED }}>{s.name}</span>
                        <DeltaBadge value={s.mom} />
                        <span style={{ color: T.MUTED, fontSize: 11 }}>MoM</span>
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={monthlyComparison} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.GRID} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: T.MUTED }} />
                      <YAxis tick={{ fontSize: 11, fill: T.MUTED }} tickFormatter={v => fmtMYRAbbr(v)} />
                      <Tooltip {...TS} contentStyle={TT} cursor={TC} separator=": " formatter={(v, name) => [fmtMYR(v), name === 'storeA' ? nameA : nameB]} />
                      <Bar dataKey="storeA" fill={BLUE} radius={[4,4,0,0]} name="storeA" />
                      <Bar dataKey="storeB" fill={STORE_B_COLOR} radius={[4,4,0,0]} name="storeB" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* Top products comparison */}
                <Card title="Top products — comparison" style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                    {[{ color: BLUE, name: nameA }, { color: STORE_B_COLOR, name: nameB }].map(s => (
                      <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.MUTED }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
                        {s.name}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {productComparison.map((p, i) => {
                      const maxVal = Math.max(p.storeA, p.storeB, 1)
                      return (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: T.TEXT, maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                            <div style={{ display: 'flex', gap: 12 }}>
                              <span style={{ fontSize: 11, color: BLUE, fontWeight: 600 }}>{p.storeA > 0 ? fmtMYR(p.storeA) : '—'}</span>
                              <span style={{ fontSize: 11, color: STORE_B_COLOR, fontWeight: 600 }}>{p.storeB > 0 ? fmtMYR(p.storeB) : '—'}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ background: '#e5e7eb', borderRadius: 3, height: 5 }}>
                              <div style={{ background: BLUE, height: '100%', borderRadius: 3, width: `${Math.round(p.storeA / maxVal * 100)}%` }} />
                            </div>
                            <div style={{ background: '#e5e7eb', borderRadius: 3, height: 5 }}>
                              <div style={{ background: STORE_B_COLOR, height: '100%', borderRadius: 3, width: `${Math.round(p.storeB / maxVal * 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              </>
            )}

            {/* If no comparison yet, show a prompt */}
            {!compareData && (
              <div style={{ background: '#f5f3ff', border: `1px dashed ${STORE_B_COLOR}`, borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: STORE_B_COLOR, margin: '0 0 2px' }}>Compare with another store</p>
                  <p style={{ fontSize: 12, color: T.MUTED, margin: 0 }}>Upload a second store's CSV to see side-by-side revenue, category, and trend comparisons</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input ref={compareFileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleCompareFile(e.target.files[0])} />
                  <button onClick={loadDemoCompare}
                    style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8, border: `1px solid ${STORE_B_COLOR}`, background: 'transparent', color: STORE_B_COLOR, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Try demo comparison
                  </button>
                  <button onClick={() => compareFileRef.current.click()}
                    style={{ fontSize: 12, padding: '7px 16px', borderRadius: 8, border: 'none', background: STORE_B_COLOR, color: '#fff', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    Upload Store B CSV
                  </button>
                </div>
              </div>
            )}

            {/* ── SALES OVERVIEW ── */}
            <SectionLabel>Sales overview</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: '1.25rem' }}>
              <KPI icon="💰" label="Net revenue" value={fmtMYR(data.totalRevenue)}
                delta={`${data.growth >= 0 ? '+' : ''}${data.growth.toFixed(1)}% trend`}
                color={data.growth >= 0 ? '#16a34a' : '#dc2626'} />
              <KPI icon="🛒" label="Total orders" value={fmtNum(data.totalOrders)} delta="units sold" />
              <KPI icon="🧾" label="Avg order value" value={fmtMYR(data.aov)} delta="per transaction" />
              <KPI icon="🏷️" label="Total discounts" value={fmtMYR(data.totalDiscount)}
                delta={data.totalRevenue > 0 ? `${((data.totalDiscount / (data.totalRevenue + data.totalDiscount)) * 100).toFixed(1)}% of gross` : ''} color={ORANGE} />
              <KPI icon="📉" label="RSP gap" value={fmtMYR(data.rspGap)} delta="revenue below RSP" color={RED} />
              <KPI icon="⚡" label="Peak hour" value={fmtHour(data.peakHour)} delta={`${DAYS[data.peakDay]} is busiest`} />
            </div>

            {/* Revenue trend */}
            <Card title="Revenue trend">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.GRID} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: T.MUTED }} interval={Math.max(0, Math.floor(trend.length / 7))} />
                  <YAxis tick={{ fontSize: 11, fill: T.MUTED }} tickFormatter={v => fmtMYRAbbr(v)} />
                  <Tooltip {...TS} contentStyle={TT} cursor={TC} separator=": " formatter={v => [fmtMYR(v), 'Revenue']} />
                  <Line type="monotone" dataKey="revenue" stroke={BLUE} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* ── RETURNS & REFUNDS ── */}
            <SectionLabel>Returns & refunds</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: '1.25rem' }}>
              <KPI icon="💵" label="Gross revenue" value={fmtMYR(data.grossRevenue)} delta="before returns" />
              <KPI icon="↩️" label="Return revenue" value={fmtMYR(data.returnRevenue)} delta={`${data.returnCount} return transactions`} color={RED} />
              <KPI icon="✅" label="Net revenue" value={fmtMYR(data.totalRevenue)} delta="gross minus returns" color={GREEN} />
              <KPI icon="📊" label="Return rate" value={`${data.returnRate.toFixed(1)}%`}
                delta={data.returnRate < 5 ? 'Healthy' : data.returnRate < 10 ? 'Monitor closely' : 'High — investigate'}
                color={data.returnRate < 5 ? GREEN : data.returnRate < 10 ? ORANGE : RED} />
            </div>

            {/* ── MONTH-OVER-MONTH ── */}
            <SectionLabel>Month-over-month</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: compareData ? '1fr 1fr 1.5fr' : '1fr 2fr', gap: 12, marginBottom: '1rem' }}>
              {/* Store A MoM card */}
              <Card title={compareData ? `${nameA} — MoM` : 'MoM revenue change'}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: fmtMonth(data.momPrevLabel) || 'Prev month', value: data.momPrev, color: T.MUTED },
                    { label: fmtMonth(data.momCurrentLabel) || 'This month', value: data.momCurrent, color: BLUE },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: T.MUTED }}>{label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color }}>{fmtMYR(value)}</span>
                      </div>
                      <div style={{ background: '#e5e7eb', borderRadius: 4, height: 6 }}>
                        <div style={{ background: color, height: '100%', borderRadius: 4, width: `${data.momPrev > 0 ? Math.min(100, value / Math.max(data.momCurrent, data.momPrev) * 100) : 100}%` }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ paddingTop: 4, borderTop: `1px solid ${T.BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: T.MUTED }}>Change</span>
                    <DeltaBadge value={data.momChange} />
                  </div>
                </div>
              </Card>

              {/* Store B MoM card — only when comparing */}
              {compareData && (
                <Card title={`${nameB} — MoM`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { label: fmtMonth(compareData.momPrevLabel) || 'Prev month', value: compareData.momPrev, color: T.MUTED },
                      { label: fmtMonth(compareData.momCurrentLabel) || 'This month', value: compareData.momCurrent, color: STORE_B_COLOR },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: T.MUTED }}>{label}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color }}>{fmtMYR(value)}</span>
                        </div>
                        <div style={{ background: '#e5e7eb', borderRadius: 4, height: 6 }}>
                          <div style={{ background: color, height: '100%', borderRadius: 4, width: `${compareData.momPrev > 0 ? Math.min(100, value / Math.max(compareData.momCurrent, compareData.momPrev) * 100) : 100}%` }} />
                        </div>
                      </div>
                    ))}
                    <div style={{ paddingTop: 4, borderTop: `1px solid ${T.BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: T.MUTED }}>Change</span>
                      <DeltaBadge value={compareData.momChange} />
                    </div>
                  </div>
                </Card>
              )}

              {/* Monthly bar chart — single store or comparison */}
              <Card title={compareData ? 'Monthly revenue — both stores' : 'Monthly revenue (last 6 months)'}>
                <ResponsiveContainer width="100%" height={160}>
                  {compareData ? (
                    <BarChart data={monthlyComparison} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.GRID} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: T.MUTED }} />
                      <YAxis tick={{ fontSize: 11, fill: T.MUTED }} tickFormatter={v => fmtMYRAbbr(v)} />
                      <Tooltip {...TS} contentStyle={TT} cursor={TC} separator=": " formatter={(v, name) => [fmtMYR(v), name === 'storeA' ? nameA : nameB]} />
                      <Bar dataKey="storeA" fill={BLUE} radius={[4,4,0,0]} name="storeA" />
                      <Bar dataKey="storeB" fill={STORE_B_COLOR} radius={[4,4,0,0]} name="storeB" />
                    </BarChart>
                  ) : (
                    <BarChart data={data.monthlyBreakdown} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.GRID} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: T.MUTED }} />
                      <YAxis tick={{ fontSize: 11, fill: T.MUTED }} tickFormatter={v => fmtMYRAbbr(v)} />
                      <Tooltip {...TS} contentStyle={TT} cursor={TC} separator=": " formatter={v => [fmtMYR(v), 'Revenue']} />
                      <Bar dataKey="revenue" radius={[4,4,0,0]}>
                        {data.monthlyBreakdown.map((m, i) => (
                          <Cell key={i} fill={m.key === data.momCurrentLabel ? BLUE : '#bfdbfe'} />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
                {compareData && (
                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    {[{ color: BLUE, name: nameA }, { color: STORE_B_COLOR, name: nameB }].map(s => (
                      <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.MUTED }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
                        {s.name}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Category + Products */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12, marginTop: 12 }}>
              <Card title="Sales by product type">
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={data.productTypes} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.GRID} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: T.MUTED }} />
                    <YAxis tick={{ fontSize: 11, fill: T.MUTED }} tickFormatter={v => fmtMYRAbbr(v)} />
                    <Tooltip {...TS} contentStyle={TT} cursor={TC} separator=": "
                      formatter={(v, key) => key === 'revenue' ? [fmtMYR(v), 'Revenue'] : [fmtNum(v), 'Units sold']} />
                    <Bar dataKey="revenue" radius={[4,4,0,0]}>
                      {data.productTypes.map((pt, i) => (
                        <Cell key={i} fill={pt.name === 'Drone' ? BLUE : pt.name === 'Handheld' ? GREEN : '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                  {[{ color: BLUE, name: 'Drone' }, { color: GREEN, name: 'Handheld' }, { color: '#94a3b8', name: 'Other' }].map(t => {
                    const pt = data.productTypes.find(p => p.name === t.name)
                    return pt ? (
                      <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.MUTED }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: t.color }} />
                        {t.name} · {fmtNum(pt.orders)} units
                      </div>
                    ) : null
                  })}
                </div>
              </Card>

              <Card
                title="Top products"
                action={
                  <input
                    placeholder="Search..."
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: `1px solid ${T.BORDER_STRONG}`, background: T.BG, color: T.TEXT, outline: 'none', width: 110 }}
                  />
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 220, overflowY: 'auto' }}>
                  {activeProducts.length === 0 && <p style={{ fontSize: 12, color: T.MUTED, textAlign: 'center' }}>No products found</p>}
                  {activeProducts.map((p, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: T.TEXT, maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        <span style={{ fontSize: 11, color: T.MUTED }}>{fmtMYR(p.revenue)}</span>
                      </div>
                      <div style={{ background: '#e5e7eb', borderRadius: 4, height: 5 }}>
                        <div style={{ background: COLORS[i % COLORS.length], height: '100%', borderRadius: 4, width: `${activeProducts[0] ? Math.round(p.revenue / activeProducts[0].revenue * 100) : 0}%`, transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* ── STAFF PERFORMANCE ── */}
            <SectionLabel>Staff performance</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Card
                title="Salesman leaderboard"
                action={
                  <button onClick={() => setEditingTargets(v => !v)}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: `1px solid ${T.BORDER_STRONG}`, background: editingTargets ? BLUE : T.BG, color: editingTargets ? '#fff' : T.MUTED, cursor: 'pointer' }}>
                    {editingTargets ? 'Done' : 'Set targets'}
                  </button>
                }
              >
                <div style={{ marginBottom: 12 }}>
                  <input
                    placeholder="Search salesman..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ width: '100%', fontSize: 12, padding: '6px 10px', borderRadius: 8, border: `1px solid ${T.BORDER_STRONG}`, background: T.BG, color: T.TEXT, outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filteredSalesmen.map((s, i) => {
                    const target = targets[s.name] || 0
                    const pct = target > 0 ? Math.min(100, s.revenue / target * 100) : 0
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ width: 20, fontSize: 11, color: T.MUTED, textAlign: 'right', paddingTop: 2 }}>#{i + 1}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 12, color: T.TEXT }}>{s.name}</span>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ fontSize: 11, color: T.MUTED }}>{fmtNum(s.orders)} orders</span>
                              <span style={{ fontSize: 11, color: i === 0 ? BLUE : T.MUTED, fontWeight: i === 0 ? 700 : 400 }}>{fmtMYR(s.revenue)}</span>
                            </div>
                          </div>
                          {editingTargets ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 10, color: T.MUTED }}>Target RM</span>
                              <input
                                type="number"
                                placeholder="0"
                                value={targets[s.name] || ''}
                                onChange={e => setTargets(t => ({ ...t, [s.name]: parseFloat(e.target.value) || 0 }))}
                                style={{ width: 90, fontSize: 11, padding: '3px 6px', borderRadius: 6, border: `1px solid ${T.BORDER_STRONG}`, background: T.BG, color: T.TEXT, outline: 'none' }}
                              />
                              {target > 0 && <span style={{ fontSize: 10, color: pct >= 100 ? GREEN : T.MUTED }}>{pct.toFixed(0)}%</span>}
                            </div>
                          ) : target > 0 ? (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                <span style={{ fontSize: 10, color: T.MUTED }}>Target: {fmtMYR(target)}</span>
                                <span style={{ fontSize: 10, color: pct >= 100 ? GREEN : ORANGE, fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                              </div>
                              <div style={{ background: '#e5e7eb', borderRadius: 4, height: 5 }}>
                                <div style={{ background: pct >= 100 ? GREEN : pct >= 70 ? BLUE : ORANGE, height: '100%', borderRadius: 4, width: `${pct}%`, transition: 'width 0.4s' }} />
                              </div>
                            </div>
                          ) : (
                            <div style={{ background: '#e5e7eb', borderRadius: 4, height: 4 }}>
                              <div style={{ background: i === 0 ? BLUE : '#bfdbfe', height: '100%', borderRadius: 4, width: `${filteredSalesmen[0] ? Math.round(s.revenue / filteredSalesmen[0].revenue * 100) : 0}%` }} />
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {filteredSalesmen.length === 0 && <p style={{ fontSize: 12, color: T.MUTED, textAlign: 'center' }}>No results</p>}
                </div>
              </Card>

              <Card title="Payment methods">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.payments} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.GRID} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: T.MUTED }} tickFormatter={v => fmtMYRAbbr(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: T.MUTED }} width={80} tickFormatter={v => v.length > 16 ? v.slice(0, 14) + '…' : v} />
                    <Tooltip {...TS} contentStyle={TT} cursor={TC} separator=": " formatter={v => [fmtMYR(v), 'Revenue']} />
                    <Bar dataKey="revenue" radius={[0,4,4,0]}>
                      {data.payments.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {data.payments.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.MUTED }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                      {p.name.length > 16 ? p.name.slice(0, 14) + '…' : p.name} ({fmtNum(p.count)})
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Product Count */}
            <SectionLabel>Product count</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

              {/* Left: all products */}
              <Card
                title={`All products · ${data.allProducts.length} items`}
                action={
                  <input
                    placeholder="Search product..."
                    value={allProductSearch}
                    onChange={e => setAllProductSearch(e.target.value)}
                    style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: `1px solid ${T.BORDER_STRONG}`, background: T.BG, color: T.TEXT, outline: 'none', width: 140 }}
                  />
                }
              >
                {(() => {
                  const filtered = allProductSearch
                    ? data.allProducts.filter(p => p.name.toLowerCase().includes(allProductSearch.toLowerCase()))
                    : data.allProducts
                  const maxUnits = data.allProducts[0]?.units || 1
                  return (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', paddingRight: 2 }}>
                        {filtered.length === 0 && <p style={{ fontSize: 12, color: T.MUTED, textAlign: 'center', padding: '1rem 0' }}>No products found</p>}
                        {filtered.map((p, i) => (
                          <div key={i}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                              <span style={{ fontSize: 11, color: T.TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '68%' }}>{p.name}</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: COLORS[i % COLORS.length], flexShrink: 0, marginLeft: 4 }}>{fmtNum(p.units)} units</span>
                            </div>
                            <div style={{ background: '#e5e7eb', borderRadius: 4, height: 4 }}>
                              <div style={{ background: COLORS[i % COLORS.length], height: '100%', borderRadius: 4, width: `${Math.round(p.units / maxUnits * 100)}%`, transition: 'width 0.4s' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.BORDER}`, display: 'flex', gap: 16 }}>
                        <span style={{ fontSize: 11, color: T.MUTED }}>Showing <strong style={{ color: T.TEXT }}>{filtered.length}</strong> of <strong style={{ color: T.TEXT }}>{data.allProducts.length}</strong></span>
                        <span style={{ fontSize: 11, color: T.MUTED }}>Total: <strong style={{ color: T.TEXT }}>{fmtNum(data.allProducts.reduce((s, p) => s + p.units, 0))} units</strong></span>
                      </div>
                    </>
                  )
                })()}
              </Card>

              {/* Right: by salesman */}
              <Card title="By salesman">
                {/* Salesman search + picker */}
                <input
                  placeholder="Search salesman..."
                  value={salesmanSearch}
                  onChange={e => { setSalesmanSearch(e.target.value); setSelectedSalesman(null) }}
                  style={{ width: '100%', fontSize: 12, padding: '6px 10px', borderRadius: 8, border: `1px solid ${T.BORDER_STRONG}`, background: T.BG, color: T.TEXT, outline: 'none', marginBottom: 10 }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {data.salesmen.filter(s => !salesmanSearch || s.name.toLowerCase().includes(salesmanSearch.toLowerCase())).map((s, i) => (
                    <button key={i} onClick={() => { setSelectedSalesman(selectedSalesman === s.name ? null : s.name); setSalesmanProductSearch('') }}
                      style={{
                        fontSize: 11, padding: '4px 12px', borderRadius: 20, cursor: 'pointer', border: `1px solid ${selectedSalesman === s.name ? COLORS[i % COLORS.length] : T.BORDER_STRONG}`,
                        background: selectedSalesman === s.name ? COLORS[i % COLORS.length] : T.BG,
                        color: selectedSalesman === s.name ? '#fff' : T.MUTED,
                        fontWeight: selectedSalesman === s.name ? 600 : 400,
                        transition: 'all 0.15s',
                      }}>
                      {s.name}
                    </button>
                  ))}
                </div>

                {/* Product breakdown for selected salesman */}
                {(() => {
                  const sm = data.salesmen.find(s => s.name === selectedSalesman)
                  if (!selectedSalesman || !sm) return (
                    <p style={{ fontSize: 12, color: T.MUTED, textAlign: 'center', padding: '2rem 0' }}>Select a salesman to see their product breakdown</p>
                  )
                  const filteredProds = salesmanProductSearch
                    ? sm.products.filter(p => p.product.toLowerCase().includes(salesmanProductSearch.toLowerCase()))
                    : sm.products
                  const maxUnits = sm.products[0]?.units || 1
                  return (
                    <>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 10, padding: '8px 10px', background: T.BG, borderRadius: 8 }}>
                        <span style={{ fontSize: 11, color: T.MUTED }}>Orders: <strong style={{ color: T.TEXT }}>{fmtNum(sm.orders)}</strong></span>
                        <span style={{ fontSize: 11, color: T.MUTED }}>Revenue: <strong style={{ color: BLUE }}>{fmtMYR(sm.revenue)}</strong></span>
                        <span style={{ fontSize: 11, color: T.MUTED }}>Products: <strong style={{ color: T.TEXT }}>{sm.products.length}</strong></span>
                      </div>
                      <input
                        placeholder="Search product..."
                        value={salesmanProductSearch}
                        onChange={e => setSalesmanProductSearch(e.target.value)}
                        style={{ width: '100%', fontSize: 12, padding: '6px 10px', borderRadius: 8, border: `1px solid ${T.BORDER_STRONG}`, background: T.BG, color: T.TEXT, outline: 'none', marginBottom: 10 }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', paddingRight: 2 }}>
                        {filteredProds.length === 0 && <p style={{ fontSize: 12, color: T.MUTED, textAlign: 'center', padding: '0.5rem 0' }}>No products found</p>}
                        {filteredProds.map((p, j) => (
                          <div key={j}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                              <span style={{ fontSize: 11, color: T.TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '68%' }}>{p.product}</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: COLORS[j % COLORS.length], flexShrink: 0, marginLeft: 4 }}>{fmtNum(p.units)} units</span>
                            </div>
                            <div style={{ background: '#e5e7eb', borderRadius: 4, height: 4 }}>
                              <div style={{ background: COLORS[j % COLORS.length], height: '100%', borderRadius: 4, width: `${Math.round(p.units / maxUnits * 100)}%`, transition: 'width 0.4s' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                })()}
              </Card>
            </div>

            {/* Discount */}
            <SectionLabel>Discount analysis</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: '1.25rem' }}>
              <KPI icon="🏷️" label="Total discount given" value={fmtMYR(data.totalDiscount)} />
              <KPI icon="📊" label="Discount rate" value={`${data.totalRevenue > 0 ? ((data.totalDiscount / (data.totalRevenue + data.totalDiscount)) * 100).toFixed(2) : '0'}%`} delta="of gross sales" />
              <KPI icon="📉" label="RSP gap (below RSP)" value={fmtMYR(data.rspGap)} delta="revenue not captured" color={RED} />
              <KPI icon="💹" label="Effective avg price" value={fmtMYR(data.aov)} delta={`vs RSP avg ${data.totalOrders > 0 ? fmtMYR(data.rspGap / data.totalOrders + data.aov) : '—'}`} />
            </div>

            {/* Traffic heatmap */}
            <SectionLabel>Traffic patterns</SectionLabel>
            <Card title="Hour × day heatmap">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 12, fontSize: 11, color: T.MUTED }}>
                <span>Low</span>
                {[0.08,0.3,0.5,0.7,0.9].map(o => <div key={o} style={{ width: 14, height: 14, borderRadius: 2, background: o === 0.08 ? '#f1f5f9' : `rgba(37,99,235,${o})` }} />)}
                <span>High</span>
              </div>
              {(() => {
                const hourTotals = HOURS.map(h => data.heatmap.reduce((s, row) => s + row[h], 0))
                const rowTotals = data.heatmap.map(row => row.reduce((a, b) => a + b, 0))
                const grandTotal = rowTotals.reduce((a, b) => a + b, 0)
                const colMax = Math.max(...hourTotals)
                return (
                  <div style={{ overflowX: 'auto' }}>
                    <div style={{ minWidth: 600 }}>
                      {/* Hour labels */}
                      <div style={{ display: 'flex', marginBottom: 4, paddingLeft: 36 }}>
                        {HOURS.filter(h => h % 3 === 0).map(h => (
                          <div key={h} style={{ flex: '3 0 0', fontSize: 10, color: T.MUTED }}>{fmtHour(h)}</div>
                        ))}
                        <div style={{ width: 42, fontSize: 10, color: T.MUTED, textAlign: 'right', flexShrink: 0 }}>Total</div>
                      </div>
                      {/* Day rows */}
                      {data.heatmap.map((row, d) => (
                        <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 3 }}>
                          <span style={{ width: 32, fontSize: 11, color: T.MUTED, flexShrink: 0 }}>{DAYS[d]}</span>
                          {row.map((val, h) => <HeatmapCell key={h} value={val} max={heatmapMax} />)}
                          <span style={{ width: 40, fontSize: 10, fontWeight: 600, color: BLUE, textAlign: 'right', flexShrink: 0, paddingLeft: 4 }}>{rowTotals[d]}</span>
                        </div>
                      ))}
                      {/* Hour totals row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 4, borderTop: `1px solid ${T.BORDER}`, paddingTop: 4 }}>
                        <span style={{ width: 32, fontSize: 10, color: T.MUTED, flexShrink: 0 }}>Total</span>
                        {hourTotals.map((val, h) => <HeatmapCell key={h} value={val} max={colMax} isTotal />)}
                        <span style={{ width: 40, fontSize: 10, fontWeight: 700, color: T.TEXT, textAlign: 'right', flexShrink: 0, paddingLeft: 4 }}>{grandTotal}</span>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, marginTop: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['🕐','Peak hour', `${fmtHour(data.peakHour)}–${fmtHour(data.peakHour+1)}`, `on ${DAYS[data.peakDay]}`],
                  ['📅','Busiest day', DAYS[data.busiestDay], 'most orders'],
                  ['🌙','Slowest slot', `${fmtHour(data.slowHour)} ${DAYS[data.slowDay]}`, 'quietest'],
                  ['🗓️','Weekend lift', `${data.weekendRatio}×`, 'vs weekday avg'],
                ].map(([icon, label, value, delta]) => (
                  <KPI key={label} icon={icon} label={label} value={value} delta={delta} />
                ))}
              </div>
              <Card title="Orders by day of week">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.dowTotals} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.GRID} />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: T.MUTED }} />
                    <YAxis tick={{ fontSize: 11, fill: T.MUTED }} />
                    <Tooltip {...TS} contentStyle={TT} cursor={TC} separator=": " formatter={v => [fmtNum(v), 'Orders']} />
                    <Bar dataKey="value" radius={[4,4,0,0]}>
                      {data.dowTotals.map((d, i) => <Cell key={i} fill={d.value === dowMax ? BLUE : '#bfdbfe'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <p style={{ textAlign: 'center', fontSize: 11, color: '#d1d5db', padding: '2rem 0 1rem' }}>
              StoreDash · built with React + Recharts
            </p>
          </>
        )}
      </div>
    </div>
  )
}
