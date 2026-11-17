/* ===== Pages: Analysis, Reports, Customers, Data Structures, router ===== */
let anaN = 14;
pages.analysis = {
  title: 'Sales Analysis', sub: 'Trends, product mix, peak hours and best customers',
  render(v) {
    const start = TODAY - (anaN - 1) * DAY, rows = salesIn(start, NOW), prev = salesIn(start - anaN * DAY, start - 1), t = totals(rows), p = totals(prev);
    const delta = (a, b) => b ? (a - b) / b * 100 : 0, dl = d => `<b class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}%</b> vs previous ${anaN} days`;
    const margin = rows.reduce((a, r) => a + r.qty * (r.rate - fuelMap.get(r.fuel).cost), 0);
    const byFuel = groupBy(rows, r => r.fuel, r => r).map(g => ({ label: fuelName(g.k), v: g.sum, color: fuelMap.get(g.k).color })).sort((a, b) => b.v - a.v);
    const byPay = groupBy(rows, r => r.pay, r => r).map(g => ({ label: g.k + ` (${g.n})`, v: g.sum, color: 'var(--accent)' })).sort((a, b) => b.v - a.v);
    const byCust = groupBy(rows.filter(r => r.veh), r => r.cust, r => r), top = topK(byCust, 5, c => c.sum);
    v.innerHTML = `<div class="row"><div class="seg" id="rng">${[7, 14, 30].map(n => `<button data-n="${n}" aria-pressed="${n === anaN}">Last ${n} days</button>`).join('')}</div></div><div class="grid">
      <div class="card s3 kpi"><span class="lab">Revenue</span><span class="val">${inr(t.amount)}</span><span class="sub">${dl(delta(t.amount, p.amount))}</span></div>
      <div class="card s3 kpi"><span class="lab">Volume</span><span class="val">${num(t.qty)}</span><span class="sub">${dl(delta(t.qty, p.qty))}</span></div>
      <div class="card s3 kpi"><span class="lab">Gross margin</span><span class="val">${inr(margin)}</span><span class="sub">${(margin / (t.amount || 1) * 100).toFixed(1)}% of revenue</span></div>
      <div class="card s3 kpi"><span class="lab">Average bill</span><span class="val">${inr(t.amount / (t.n || 1))}</span><span class="sub">${num(t.n)} transactions</span></div>
      <div class="card s8"><h2>Daily revenue by fuel</h2><div id="a1"></div><div class="legend">${FUELS.map(f => `<span>${dot(f.id)}${f.name}</span>`).join('')}</div></div>
      <div class="card s4"><h2>Revenue share by fuel</h2>${hbars(byFuel, inr)}</div>
      <div class="card s6"><h2>Peak hours <small>litres dispensed per hour of day</small></h2><div id="a2"></div></div>
      <div class="card s3"><h2>Payment mode</h2>${hbars(byPay, inr)}</div>
      <div class="card s3"><h2>Top customers <small>Min-heap top-5</small></h2><table><tbody>${top.map((c, i) => `<tr><td>${i + 1}</td><td>${esc(c.k)}</td><td class="n">${inr(c.sum)}</td></tr>`).join('') || '<tr><td>No customer sales in range</td></tr>'}</tbody></table></div>
    </div>`;
    $('#rng').onclick = e => { const b = e.target.closest('button'); if (b) { anaN = +b.dataset.n; pages.analysis.render(v); } };
    const m = new HashMap(), labels = []; rows.forEach(r => { const k = dayStart(r.ts) + r.fuel; m.set(k, (m.get(k) || 0) + r.amount); });
    for (let d = anaN - 1; d >= 0; d--) labels.push(fmtDate(TODAY - d * DAY));
    areaChart($('#a1'), labels, FUELS.map(f => ({ color: f.color, v: labels.map((_, i) => m.get(TODAY - (anaN - 1 - i) * DAY + f.id) || 0) })), { fmt: x => '₹' + num(x / 1000) + 'k', label: 'Daily revenue by fuel' });
    const hr = Array(24).fill(0); rows.forEach(r => hr[new Date(r.ts).getHours()] += r.qty);
    barChart($('#a2'), hr.slice(5, 23).map((_, i) => String(i + 5)), hr.slice(5, 23), { fmt: x => num(x), label: 'Litres by hour of day' });
  }
};

const rep = { type: 'register', from: isoDay(TODAY - 6 * DAY), to: isoDay(TODAY), fuel: 'ALL', pay: 'ALL', sort: 'ts', dir: -1, page: 0 };
const parseDay = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
pages.reports = {
  title: 'Reports', sub: 'Sales register, daily summary and stock position',
  render(v) {
    const t0 = performance.now(), from = parseDay(rep.from), to = parseDay(rep.to) + DAY - 1;
    let rows = salesIn(from, to).filter(r => (rep.fuel === 'ALL' || r.fuel === rep.fuel) && (rep.pay === 'ALL' || r.pay === rep.pay));
    const ms = performance.now() - t0, tot = totals(rows);
    const keyFn = { ts: r => r.ts, amount: r => r.amount, qty: r => r.qty, fuel: r => r.fuel }[rep.sort];
    const sorted = rep.type === 'register' ? mergeSort(rows, (a, b) => (keyFn(a) > keyFn(b) ? 1 : keyFn(a) < keyFn(b) ? -1 : 0) * rep.dir) : rows;
    const PER = 12, pages_ = Math.max(1, Math.ceil(sorted.length / PER)); rep.page = Math.min(rep.page, pages_ - 1);
    let head = '', body = '', csv = '';
    if (rep.type === 'register') {
      head = '<th>Invoice</th><th>Date and time</th><th>Customer</th><th>Fuel</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">Amount</th><th>Payment</th>';
      body = sorted.slice(rep.page * PER, rep.page * PER + PER).map(r => `<tr><td class="mono">${r.id}</td><td>${fmtDate(r.ts)} ${fmtTime(r.ts)}</td><td>${esc(r.cust)}</td><td>${dot(r.fuel)}${fuelName(r.fuel)}</td><td class="n">${num(r.qty, 2)}</td><td class="n">${num(r.rate, 2)}</td><td class="n">${inr2(r.amount)}</td><td>${r.pay}</td></tr>`).join('');
      csv = 'Invoice,Date,Time,Customer,Vehicle,Fuel,Qty,Rate,Amount,Payment\n' + sorted.map(r => [r.id, isoDay(r.ts), fmtTime(r.ts), '"' + r.cust + '"', r.veh, fuelName(r.fuel), r.qty, r.rate, r.amount, r.pay].join(',')).join('\n');
    } else if (rep.type === 'daily') {
      const g = groupBy(rows, r => dayStart(r.ts), r => r).sort((a, b) => b.k - a.k);
      head = '<th>Date</th><th class="n">Transactions</th><th class="n">Volume</th><th class="n">Revenue</th><th class="n">Average bill</th>';
      body = g.map(d => `<tr><td>${fmtDate(d.k)}</td><td class="n">${d.n}</td><td class="n">${num(d.qty)}</td><td class="n">${inr(d.sum)}</td><td class="n">${inr(d.sum / d.n)}</td></tr>`).join('');
      csv = 'Date,Transactions,Volume,Revenue\n' + g.map(d => [isoDay(d.k), d.n, d.qty.toFixed(2), d.sum.toFixed(2)].join(',')).join('\n');
    } else {
      head = '<th>Fuel</th><th class="n">Capacity</th><th class="n">Stock</th><th class="n">Level</th><th class="n">Value at cost</th><th>Status</th>';
      body = FUELS.map(f => `<tr><td>${dot(f.id)}${f.name}</td><td class="n">${num(f.cap)}</td><td class="n">${num(f.level)}</td><td class="n">${(pct(f) * 100).toFixed(0)}%</td><td class="n">${inr(f.level * f.cost)}</td><td><span class="pill ${status(f)[0]}">${status(f)[1]}</span></td></tr>`).join('');
      csv = 'Fuel,Capacity,Stock,Level%,Value\n' + FUELS.map(f => [f.name, f.cap, f.level.toFixed(1), (pct(f) * 100).toFixed(1), (f.level * f.cost).toFixed(2)].join(',')).join('\n');
    }
    const sel = (id, opts, cur) => `<select id="${id}">${opts.map(o => `<option value="${o[0]}" ${o[0] === cur ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
    v.innerHTML = `<div class="card"><form class="row" id="rf" style="align-items:flex-end;gap:12px">
      <label>Report${sel('rt', [['register', 'Sales register'], ['daily', 'Daily summary'], ['stock', 'Stock position']], rep.type)}</label>
      <label>From<input type="date" id="rfrom" value="${rep.from}"></label><label>To<input type="date" id="rto" value="${rep.to}"></label>
      <label>Fuel${sel('rfuel', [['ALL', 'All fuels'], ...FUELS.map(f => [f.id, f.name])], rep.fuel)}</label>
      <label>Payment${sel('rpay', [['ALL', 'All modes'], ...PAY.map(p => [p, p])], rep.pay)}</label>
      <label>Sort by${sel('rsort', [['ts', 'Date'], ['amount', 'Amount'], ['qty', 'Quantity'], ['fuel', 'Fuel']], rep.sort)}</label>
      <label>Order${sel('rdir', [['-1', 'Newest / highest first'], ['1', 'Oldest / lowest first']], String(rep.dir))}</label></form></div>
    <div class="grid"><div class="card s3 kpi"><span class="lab">Records</span><span class="val">${num(tot.n)}</span><span class="sub">AVL range query ${ms.toFixed(2)} ms</span></div>
      <div class="card s3 kpi"><span class="lab">Volume</span><span class="val">${num(tot.qty)}</span><span class="sub">litres / kg</span></div>
      <div class="card s3 kpi"><span class="lab">Revenue</span><span class="val">${inr(tot.amount)}</span><span class="sub">for the selected filters</span></div>
      <div class="card s3 kpi"><span class="lab">Sorting</span><span class="val" style="font-size:18px">Merge sort</span><span class="sub">stable, O(n log n)</span></div></div>
    <div class="card"><h2>${{ register: 'Sales register', daily: 'Daily summary', stock: 'Stock position' }[rep.type]} <span class="row"><button class="btn sec" id="csv">Copy as CSV</button></span></h2><div class="scroll"><table><thead><tr>${head}</tr></thead><tbody>${body || '<tr><td>No records for these filters.</td></tr>'}</tbody></table></div>
      ${rep.type === 'register' ? `<div class="pager"><span class="note">Page ${rep.page + 1} of ${pages_}</span><button class="btn sec" id="pp" ${rep.page ? '' : 'disabled'}>Previous</button><button class="btn sec" id="pn" ${rep.page < pages_ - 1 ? '' : 'disabled'}>Next</button></div>` : ''}
      <textarea id="csvbox" hidden rows="6" style="width:100%;margin-top:10px;font-family:var(--mono);font-size:12px;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:7px"></textarea></div>`;
    const bind = (id, k, f = x => x) => $('#' + id).onchange = e => { rep[k] = f(e.target.value); rep.page = 0; pages.reports.render(v); };
    bind('rt', 'type'); bind('rfrom', 'from'); bind('rto', 'to'); bind('rfuel', 'fuel'); bind('rpay', 'pay'); bind('rsort', 'sort'); bind('rdir', 'dir', Number);
    if ($('#pp')) { $('#pp').onclick = () => { rep.page--; pages.reports.render(v); }; $('#pn').onclick = () => { rep.page++; pages.reports.render(v); }; }
    $('#csv').onclick = async () => { try { await navigator.clipboard.writeText(csv); toast('CSV copied to clipboard.'); } catch (e) { const b = $('#csvbox'); b.hidden = false; b.value = csv; b.select(); toast('Copy blocked. Press Ctrl+C on the selected text.'); } };
  }
};

let custQ = '';
pages.customers = {
  title: 'Customers', sub: 'Registered vehicles and fleet accounts, searched through a prefix tree',
  render(v) {
    const spend = new HashMap(); groupBy(salesIn(TODAY - 29 * DAY, NOW).filter(r => r.veh), r => r.veh, r => r).forEach(g => spend.set(g.k, g));
    let list = custMap.values(); if (custQ) { const seen = new Set(); list = vehicleTrie.search(custQ, 50).filter(c => !seen.has(c.veh) && seen.add(c.veh)); }
    list = mergeSort(list, (a, b) => ((spend.get(b.veh) || { sum: 0 }).sum) - ((spend.get(a.veh) || { sum: 0 }).sum));
    v.innerHTML = `<div class="grid"><div class="card s8"><h2>Customer register <small>${custMap.size} accounts</small></h2><label style="margin-bottom:10px">Search by vehicle number or name<input id="cq" value="${esc(custQ)}" placeholder="Type a prefix"></label>
      <div class="scroll"><table><thead><tr><th>Vehicle</th><th>Name</th><th>Type</th><th>Phone</th><th class="n">Visits (30d)</th><th class="n">Spend (30d)</th></tr></thead><tbody>${list.map(c => { const s = spend.get(c.veh); return `<tr><td class="mono">${c.veh}</td><td>${esc(c.name)}</td><td><span class="pill ${c.type === 'Fleet' ? 'warn' : 'info'}">${c.type}</span></td><td class="mono">${esc(c.phone)}</td><td class="n">${s ? s.n : 0}</td><td class="n">${inr(s ? s.sum : 0)}</td></tr>`; }).join('') || '<tr><td>No match.</td></tr>'}</tbody></table></div></div>
      <div class="card s4"><h2>Register a customer</h2><form class="form" id="cf" autocomplete="off"><label class="full">Vehicle number<input id="cv" required placeholder="MH12AB1234"></label><label class="full">Name<input id="cn" required></label><label>Phone<input id="cp" inputmode="tel"></label><label>Type<select id="ct"><option>Retail</option><option>Fleet</option></select></label><div class="full"><button class="btn">Save customer</button></div></form><p class="note">Stored in a hash map by vehicle number and indexed in the trie.</p></div></div>`;
    $('#cq').oninput = e => { custQ = e.target.value; const p = e.target.selectionStart; pages.customers.render(v); const i = $('#cq'); i.focus(); i.setSelectionRange(p, p); };
    $('#cf').onsubmit = e => { e.preventDefault(); const k = $('#cv').value.trim().toUpperCase(); if (custMap.has(k)) return toast('That vehicle is already registered.'); addCustomer(k, $('#cn').value.trim(), $('#cp').value.trim(), $('#ct').value); toast('Customer saved.'); pages.customers.render(v); };
  }
};
