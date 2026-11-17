/* ===== Core: data model, seeding, helpers, charts ===== */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
const inr2 = n => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n, d = 0) => n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const DAY = 864e5;
const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const fmtDate = t => new Date(t).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
const fmtTime = t => new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
const isoDay = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const NOW = Date.now(), TODAY = dayStart(NOW);

const FUELS = [
  { id: 'PET', name: 'Petrol', unit: 'L', price: 104.5, cost: 98.2, cap: 20000, color: 'var(--c-pet)', w: 0.4 },
  { id: 'DSL', name: 'Diesel', unit: 'L', price: 92.3, cost: 86.4, cap: 25000, color: 'var(--c-dsl)', w: 0.35 },
  { id: 'PWR', name: 'Power Petrol', unit: 'L', price: 113.2, cost: 106.1, cap: 10000, color: 'var(--c-pwr)', w: 0.12 },
  { id: 'CNG', name: 'CNG', unit: 'kg', price: 86.0, cost: 79.5, cap: 6000, color: 'var(--c-cng)', w: 0.13 }
];
const PAY = ['Cash', 'UPI', 'Card', 'Fleet credit'];
const REORDER = 0.35;

/* ---- structure instances ---- */
const fuelMap = new HashMap();              // fuel id -> fuel record (with live level)
const custMap = new HashMap();              // vehicle no -> customer
const vehicleTrie = new Trie();             // prefix search on vehicle no and name
const sales = new AVLTree();                // ordered by timestamp key
const queue = new CircularQueue(8);         // vehicles waiting
const undoStack = new Stack();              // last sales, for reversal
const audit = new DLL(300);                 // stock movement trail
let seq = 0;
const keyOf = (ts, s) => ts * 1000 + (s % 1000);
const lo = t => t * 1000, hi = t => t * 1000 + 999;

/* ---- deterministic PRNG so the demo looks the same each load ---- */
function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(20261117);
const pick = a => a[Math.floor(R() * a.length)];

function addCustomer(veh, name, phone, type) {
  const c = { veh, name, phone, type, since: NOW };
  custMap.set(veh, c); vehicleTrie.insert(veh, c); vehicleTrie.insert(name, c); return c;
}

function seedAll() {
  FUELS.forEach(f => { f.level = f.cap * (0.55 + R() * 0.3); fuelMap.set(f.id, f); });
  const names = ['Ramesh Patil', 'Anil Kulkarni', 'Sunita Deshmukh', 'Vikram Shinde', 'Priya Nair', 'Imran Shaikh', 'Kavita Joshi', 'Mahesh Gaikwad', 'Neha Bhosale', 'Sandeep More', 'Rohit Pawar', 'Pooja Jadhav', 'Faisal Khan', 'Deepak Sharma', 'Meena Iyer', 'Suresh Reddy', 'Asha Kamble', 'Tushar Wagh', 'Farah Sayyed', 'Gopal Yadav', 'Lakshmi Menon', 'Harish Chavan', 'Nikhil Thakur', 'Swati Kale'];
  const fleets = ['Sai Logistics', 'Shree Transport', 'Om Roadlines', 'Metro Cabs Pvt Ltd', 'Green Valley Schools'];
  const codes = ['MH12', 'MH14', 'MH15', 'MH20', 'KA05', 'GJ01'];
  names.forEach(n => addCustomer(pick(codes) + String.fromCharCode(65 + R() * 26 | 0) + String.fromCharCode(65 + R() * 26 | 0) + String(1000 + R() * 8999 | 0), n, '98' + String(10000000 + R() * 89999999 | 0), 'Retail'));
  fleets.forEach(n => addCustomer(pick(codes) + 'FL' + String(1000 + R() * 8999 | 0), n, '20' + String(10000000 + R() * 89999999 | 0), 'Fleet'));
  const custs = custMap.values();
  const hourW = [0, 0, 0, 0, 0, 0, 2, 4, 6, 5, 4, 4, 5, 4, 3, 4, 6, 8, 9, 7, 5, 3, 2, 1];
  const hourPool = []; hourW.forEach((w, h) => { for (let i = 0; i < w; i++) hourPool.push(h); });
  for (let d = 29; d >= 0; d--) {
    const day = TODAY - d * DAY, wk = new Date(day).getDay(), n = Math.round(30 + R() * 14 + (wk === 5 || wk === 6 ? 8 : 0));
    const stamps = [];
    for (let i = 0; i < n; i++) { const t = Math.floor(day + pick(hourPool) * 36e5 + R() * 36e5); if (t < NOW) stamps.push(t); }
    stamps.sort((a, b) => a - b);
    for (const t of stamps) {
      const r = R(); let acc = 0, f = FUELS[0]; for (const x of FUELS) { acc += x.w; if (r <= acc) { f = x; break; } }
      const cust = R() < 0.62 ? pick(custs) : null;
      let q = f.id === 'DSL' && cust && cust.type === 'Fleet' ? 80 + R() * 120 : f.id === 'CNG' ? 4 + R() * 10 : 5 + R() * 35;
      q = Math.round(q * 100) / 100;
      if (f.level < f.cap * 0.2) { const add = f.cap * 0.9 - f.level; f.level += add; audit.addFront({ ts: t - 6e5, type: 'Delivery', fuel: f.id, qty: add, ref: 'GRN-' + (1000 + audit.n) }); }
      f.level = Math.max(0, f.level - q);
      recordSale({ ts: t, fuel: f.id, qty: q, pay: cust && cust.type === 'Fleet' ? 'Fleet credit' : pick(['Cash', 'UPI', 'UPI', 'Card']), veh: cust ? cust.veh : '', cust: cust ? cust.name : 'Walk-in', pump: 1 + (R() * 6 | 0) }, true);
    }
  }
}

function recordSale(s, seeding) {
  const f = fuelMap.get(s.fuel); seq++;
  const rec = { id: 'INV-' + String(seq).padStart(5, '0'), seq, ts: s.ts, fuel: s.fuel, qty: s.qty, rate: f.price, amount: Math.round(s.qty * f.price * 100) / 100, pay: s.pay, veh: s.veh, cust: s.cust, pump: s.pump };
  sales.insert(keyOf(rec.ts, seq), rec);
  if (seeding && rec.ts > NOW - 2 * DAY) audit.addFront({ ts: rec.ts, type: 'Sale', fuel: rec.fuel, qty: -rec.qty, ref: rec.id });
  if (!seeding) { undoStack.push(rec); audit.addFront({ ts: rec.ts, type: 'Sale', fuel: rec.fuel, qty: -rec.qty, ref: rec.id }); }
  return rec;
}

/* ---- aggregation helpers (HashMap keyed grouping) ---- */
function groupBy(rows, keyFn, valFn) { const m = new HashMap(); for (const r of rows) { const k = keyFn(r); const c = m.get(k) || { k, sum: 0, qty: 0, n: 0 }; const v = valFn(r); c.sum += v.amount; c.qty += v.qty; c.n++; m.set(k, c); } return m.values(); }
const salesIn = (from, to) => sales.range(lo(from), hi(to));
const totals = rows => rows.reduce((a, r) => (a.amount += r.amount, a.qty += r.qty, a.n++, a), { amount: 0, qty: 0, n: 0 });
function topK(items, k, score) { const h = new MinHeap((a, b) => a.p - b.p); for (const it of items) { h.push({ p: score(it), it }); if (h.size > k) h.pop(); } const o = []; while (h.size) o.unshift(h.pop().it); return o; }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2800); }

/* ---- SVG charts sized to their container ---- */
function areaChart(el, labels, series, opts = {}) {
  const W = Math.max(280, el.clientWidth), H = opts.h || 220, m = { l: 46, r: 12, t: 12, b: 26 };
  const max = Math.max(1, ...series.flatMap(s => s.v)) * 1.1, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const x = i => m.l + (labels.length < 2 ? iw / 2 : i * iw / (labels.length - 1)), y = v => m.t + ih - v / max * ih;
  let g = '', ticks = 4;
  for (let i = 0; i <= ticks; i++) { const v = max * i / ticks, yy = y(v); g += `<line x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}" stroke="var(--grid)"/><text x="${m.l - 6}" y="${yy + 4}" text-anchor="end">${opts.fmt ? opts.fmt(v) : num(v)}</text>`; }
  const step = Math.ceil(labels.length / Math.max(2, Math.floor(iw / 62)));
  labels.forEach((l, i) => { if (i % step === 0 && (labels.length - 1 - i >= step || i === labels.length - 1 || step === 1)) g += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${l}</text>`; });
  let body = '';
  for (const s of series) {
    const pts = s.v.map((v, i) => [x(i), y(v)]), line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    body += `<path d="${line} L${pts[pts.length - 1][0]} ${m.t + ih} L${pts[0][0]} ${m.t + ih}Z" fill="${s.color}" opacity=".12"/><path d="${line}" fill="none" stroke="${s.color}" stroke-width="2"/>`;
    const lp = pts[pts.length - 1]; body += `<circle cx="${lp[0]}" cy="${lp[1]}" r="4" fill="${s.color}"/>`;
  }
  el.innerHTML = `<svg class="chart" width="${W}" height="${H}" role="img" aria-label="${esc(opts.label || 'Trend chart')}">${g}${body}</svg>`;
}
function barChart(el, labels, values, opts = {}) {
  const W = Math.max(280, el.clientWidth), H = opts.h || 200, m = { l: 46, r: 8, t: 12, b: 26 };
  const max = Math.max(1, ...values) * 1.1, iw = W - m.l - m.r, ih = H - m.t - m.b, bw = iw / labels.length;
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = max * i / 4, yy = m.t + ih - v / max * ih; g += `<line x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}" stroke="var(--grid)"/><text x="${m.l - 6}" y="${yy + 4}" text-anchor="end">${opts.fmt ? opts.fmt(v) : num(v)}</text>`; }
  const peak = values.indexOf(Math.max(...values)), step = Math.ceil(labels.length / Math.max(2, Math.floor(iw / 30)));
  values.forEach((v, i) => { const h = v / max * ih; g += `<rect x="${m.l + i * bw + bw * .18}" y="${m.t + ih - h}" width="${bw * .64}" height="${h}" rx="2" fill="${opts.color || 'var(--accent)'}" opacity="${i === peak ? 1 : .55}"/>`; if (i % step === 0) g += `<text x="${m.l + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${labels[i]}</text>`; });
  el.innerHTML = `<svg class="chart" width="${W}" height="${H}" role="img" aria-label="${esc(opts.label || 'Bar chart')}">${g}</svg>`;
}
function hbars(rows, fmt) { const max = Math.max(1, ...rows.map(r => r.v)); return rows.map(r => `<div style="margin:9px 0"><div class="row" style="justify-content:space-between;gap:8px"><span><i class="dot" style="background:${r.color}"></i>${esc(r.label)}</span><b>${fmt(r.v)}</b></div><div class="gauge"><i style="width:${r.v / max * 100}%;background:${r.color}"></i></div></div>`).join(''); }
