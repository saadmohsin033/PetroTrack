/* ===== Pages: Dashboard, Fuel Sales, Inventory ===== */
const pages = {};
const pct = f => f.level / f.cap;
const status = f => pct(f) < 0.2 ? ['crit', 'Critical'] : pct(f) < REORDER ? ['warn', 'Reorder'] : ['ok', 'Healthy'];
const fuelName = id => fuelMap.get(id).name;
const dot = id => `<i class="dot" style="background:${fuelMap.get(id).color}"></i>`;

function avgDaily() { const rows = salesIn(TODAY - 6 * DAY, NOW), m = {}; rows.forEach(r => m[r.fuel] = (m[r.fuel] || 0) + r.qty / 7); return m; }
function refillHeap() { const h = new MinHeap(); FUELS.forEach(f => h.push({ p: pct(f), f })); return h; }

/* supplier network: Dijkstra over depot graph, edge weight = km */
const net = new Graph();
[['Station', 'Depot North', 12], ['Station', 'Depot East', 25], ['Depot North', 'Terminal', 30], ['Depot East', 'Terminal', 20], ['Depot North', 'Depot East', 9], ['Terminal', 'Refinery', 14], ['Depot East', 'Refinery', 41]].forEach(e => net.edge(...e));
const SUPPLIERS = [
  { node: 'Depot North', name: 'North Depot (retail outlet stock)', fuels: ['PET', 'DSL'] },
  { node: 'Depot East', name: 'East Depot', fuels: ['PET', 'DSL', 'CNG'] },
  { node: 'Terminal', name: 'Bulk Terminal', fuels: ['PET', 'DSL', 'PWR'] },
  { node: 'Refinery', name: 'Refinery Gate', fuels: ['PET', 'DSL', 'PWR', 'CNG'] }
];
function suppliersFor(fuelId) { const { dist, prev } = net.dijkstra('Station'); return SUPPLIERS.filter(s => s.fuels.includes(fuelId)).map(s => ({ ...s, km: dist.get(s.node), path: net.path(prev, s.node) })).sort((a, b) => a.km - b.km); }

/* ---------- Dashboard ---------- */
pages.dashboard = {
  title: 'Dashboard', sub: 'Live position of the forecourt, tanks and sales',
  render(v) {
    const t = totals(salesIn(TODAY, NOW)), y = totals(salesIn(TODAY - DAY, NOW - DAY)), val = FUELS.reduce((a, f) => a + f.level * f.cost, 0);
    const d = y.amount ? (t.amount - y.amount) / y.amount * 100 : 0, h = refillHeap(), alerts = [];
    while (h.size) alerts.push(h.pop());
    v.innerHTML = `<div class="grid">
      <div class="card s3 kpi"><span class="lab">Sales today</span><span class="val">${inr(t.amount)}</span><span class="sub"><b class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(0)}%</b> vs same time yesterday</span></div>
      <div class="card s3 kpi"><span class="lab">Volume dispensed</span><span class="val">${num(t.qty)} L</span><span class="sub">fuel and CNG combined</span></div>
      <div class="card s3 kpi"><span class="lab">Transactions</span><span class="val">${t.n}</span><span class="sub">average bill ${inr(t.n ? t.amount / t.n : 0)}</span></div>
      <div class="card s3 kpi"><span class="lab">Stock value (at cost)</span><span class="val">${inr(val)}</span><span class="sub">${FUELS.filter(f => pct(f) < REORDER).length} tank(s) below reorder level</span></div>
      <div class="card s8"><h2>Revenue, last 30 days <small>AVL range query + HashMap daily totals</small></h2><div id="c30"></div></div>
      <div class="card s4"><h2>Tank levels <small>HashMap lookup</small></h2>${FUELS.map(f => { const s = status(f); return `<div class="tank"><div class="t1"><span>${dot(f.id)}${f.name}</span><span class="pill ${s[0]}">${s[1]}</span></div><div class="gauge"><i style="width:${pct(f) * 100}%;background:${f.color}"></i></div><div class="t2"><span>${num(f.level)} / ${num(f.cap)} ${f.unit}</span><span>${(pct(f) * 100).toFixed(0)}%</span></div></div>`; }).join('')}</div>
      <div class="card s4"><h2>Refill priority <small>Min-heap, lowest level first</small></h2><div class="scroll"><table><thead><tr><th>#</th><th>Fuel</th><th class="n">Level</th></tr></thead><tbody>${alerts.map((a, i) => `<tr><td>${i + 1}</td><td>${dot(a.f.id)}${a.f.name}</td><td class="n">${(a.p * 100).toFixed(0)}%</td></tr>`).join('')}</tbody></table></div><p class="note">Heap root is always the tank that needs a delivery first.</p></div>
      <div class="card s8"><h2>Recent stock movements <small>Doubly linked list, newest first</small></h2><div class="scroll">${auditTable(8)}</div></div>
    </div>`;
    areaChart($('#c30'), ...daily30());
  }
};
function daily30() {
  const rows = salesIn(TODAY - 29 * DAY, NOW), m = new HashMap();
  rows.forEach(r => { const k = dayStart(r.ts); m.set(k, (m.get(k) || 0) + r.amount); });
  const labels = [], vals = [];
  for (let d = 29; d >= 0; d--) { const k = TODAY - d * DAY; labels.push(fmtDate(k)); vals.push(m.get(k) || 0); }
  return [labels, [{ v: vals, color: 'var(--accent)' }], { fmt: v => '₹' + num(v / 1000) + 'k', label: 'Daily revenue for the last 30 days' }];
}
function auditTable(n) {
  return `<table><thead><tr><th>Time</th><th>Type</th><th>Fuel</th><th class="n">Quantity</th><th>Reference</th></tr></thead><tbody>${audit.toArray(n).map(a => `<tr><td>${fmtDate(a.ts)} ${fmtTime(a.ts)}</td><td><span class="pill ${a.type === 'Delivery' ? 'ok' : a.type === 'Reversal' ? 'warn' : 'info'}">${a.type}</span></td><td>${dot(a.fuel)}${fuelName(a.fuel)}</td><td class="n">${a.qty > 0 ? '+' : ''}${num(a.qty, 1)}</td><td class="mono">${a.ref}</td></tr>`).join('')}</tbody></table>`;
}

/* ---------- Fuel Sales ---------- */
const draft = { fuel: 'PET', mode: 'L', qty: '', veh: '', cust: 'Walk-in', pay: 'Cash', pump: 1, receipt: '' };
pages.sales = {
  title: 'Fuel Sales', sub: 'Record a sale, manage the forecourt queue, reverse the last bill',
  render(v) {
    const recent = salesIn(TODAY - DAY, NOW).slice(-8).reverse();
    v.innerHTML = `<div class="grid">
      <div class="card s7"><h2>New sale <small>${undoStack.size} sale(s) can be reversed</small></h2>
        <form class="form" id="sf" autocomplete="off">
          <label class="full sugg">Vehicle number or customer name<input id="veh" placeholder="Start typing, e.g. MH12 or Ramesh" value="${esc(draft.veh)}"><ul id="sg" hidden></ul></label>
          <label>Customer<input id="cust" value="${esc(draft.cust)}" readonly></label>
          <label>Pump<select id="pump">${[1, 2, 3, 4, 5, 6].map(p => `<option ${p == draft.pump ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
          <label>Fuel<select id="fuel">${FUELS.map(f => `<option value="${f.id}" ${f.id === draft.fuel ? 'selected' : ''}>${f.name} · ${inr2(f.price)}/${f.unit}</option>`).join('')}</select></label>
          <label>Payment<select id="pay">${PAY.map(p => `<option ${p === draft.pay ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
          <div class="full row"><div class="seg" id="mode"><button type="button" data-m="L" aria-pressed="${draft.mode === 'L'}">By quantity</button><button type="button" data-m="A" aria-pressed="${draft.mode === 'A'}">By amount (₹)</button></div>
            <input id="qty" type="number" min="0" step="0.01" inputmode="decimal" placeholder="${draft.mode === 'L' ? 'Quantity' : 'Amount in ₹'}" value="${draft.qty}" style="flex:1 1 140px;width:auto"></div>
          <div class="full card" style="background:var(--surface2)" id="prev"></div>
          <div class="full row"><button class="btn" id="rec" type="submit">Record sale</button><button class="btn sec" id="enq" type="button">Add to queue</button><button class="btn sec" id="undo" type="button" ${undoStack.size ? '' : 'disabled'}>Reverse last sale</button></div>
        </form></div>
      <div class="s5" style="display:flex;flex-direction:column;gap:16px;min-width:0">
        <div class="card"><h2>Forecourt queue <small>Circular queue, capacity 8</small></h2><div class="queue">${Array.from({ length: 8 }, (_, i) => { const q = queue.toArray()[i]; return q ? `<div class="slot full ${i === 0 ? 'head' : ''}"><b>${esc(q.veh || 'Walk-in')}</b>${fuelName(q.fuel)}</div>` : `<div class="slot"></div>`; }).join('')}</div>
          <div class="row" style="margin-top:10px"><button class="btn sec" id="serve" ${queue.n ? '' : 'disabled'}>Serve next</button><span class="note">${queue.n} waiting, FIFO order</span></div></div>
        <div class="card"><h2>Last bill</h2>${draft.receipt ? `<div class="receipt">${esc(draft.receipt)}</div>` : '<p class="note">Bills appear here after a sale is recorded.</p>'}</div>
      </div>
      <div class="card s12"><h2>Recent sales <small>latest first</small></h2><div class="scroll"><table><thead><tr><th>Invoice</th><th>Time</th><th>Customer</th><th>Fuel</th><th class="n">Qty</th><th class="n">Amount</th><th>Payment</th><th>Pump</th></tr></thead><tbody>${recent.map(r => `<tr><td class="mono">${r.id}</td><td>${fmtDate(r.ts)} ${fmtTime(r.ts)}</td><td>${esc(r.cust)} <span class="mono note">${esc(r.veh)}</span></td><td>${dot(r.fuel)}${fuelName(r.fuel)}</td><td class="n">${num(r.qty, 2)}</td><td class="n">${inr2(r.amount)}</td><td>${r.pay}</td><td>${r.pump}</td></tr>`).join('')}</tbody></table></div></div>
    </div>`;
    bindSales(); preview();
  }
};
function calc() { const f = fuelMap.get(draft.fuel), x = parseFloat(draft.qty) || 0, q = draft.mode === 'L' ? x : x / f.price; return { f, q: Math.round(q * 100) / 100, amt: Math.round(q * f.price * 100) / 100 }; }
function preview() {
  const { f, q, amt } = calc(), bad = q <= 0 ? 'Enter a quantity or amount.' : q > f.level ? `Only ${num(f.level, 1)} ${f.unit} left in the tank.` : '';
  $('#prev').innerHTML = `<div class="row" style="justify-content:space-between;gap:16px"><div><div class="note">Quantity</div><div class="big">${num(q, 2)} ${f.unit}</div></div><div><div class="note">Rate</div><div class="big">${inr2(f.price)}</div></div><div><div class="note">Bill total</div><div class="big">${inr2(amt)}</div></div></div><div class="note" style="margin-top:6px;color:${bad ? 'var(--crit)' : 'var(--muted)'}">${bad || `Tank after sale: ${num(f.level - q, 0)} ${f.unit} (${((f.level - q) / f.cap * 100).toFixed(0)}%)`}</div>`;
  $('#rec').disabled = !!bad;
}
function bindSales() {
  const sg = $('#sg'), veh = $('#veh');
  const setCust = c => { draft.veh = c ? c.veh : veh.value.trim().toUpperCase(); draft.cust = c ? c.name : 'Walk-in'; veh.value = draft.veh; $('#cust').value = draft.cust; if (c && c.type === 'Fleet') { draft.pay = 'Fleet credit'; $('#pay').value = draft.pay; } sg.hidden = true; };
  veh.addEventListener('input', () => {
    draft.veh = veh.value; const exact = custMap.get(veh.value.trim().toUpperCase());
    if (exact) draft.cust = exact.name; else draft.cust = 'Walk-in'; $('#cust').value = draft.cust;
    const seen = new Set(), hits = veh.value.length ? vehicleTrie.search(veh.value, 12).filter(c => !seen.has(c.veh) && seen.add(c.veh)).slice(0, 6) : [];
    sg.innerHTML = hits.map(c => `<li data-v="${c.veh}"><span>${esc(c.name)}</span><span class="mono">${c.veh}</span></li>`).join(''); sg.hidden = !hits.length;
  });
  sg.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); setCust(custMap.get(li.dataset.v)); } });
  veh.addEventListener('blur', () => setTimeout(() => sg.hidden = true, 120));
  $('#fuel').onchange = e => { draft.fuel = e.target.value; preview(); };
  $('#pay').onchange = e => draft.pay = e.target.value; $('#pump').onchange = e => draft.pump = +e.target.value;
  $('#qty').oninput = e => { draft.qty = e.target.value; preview(); };
  $('#mode').onclick = e => { const b = e.target.closest('button'); if (!b) return; draft.mode = b.dataset.m; pages.sales.render($('#view')); };
  $('#sf').onsubmit = e => {
    e.preventDefault(); const { f, q } = calc(); if (q <= 0 || q > f.level) return;
    const r = recordSale({ ts: Date.now(), fuel: f.id, qty: q, pay: draft.pay, veh: draft.veh.trim().toUpperCase(), cust: draft.cust, pump: draft.pump });
    f.level -= q;
    draft.receipt = `PETROTRACK FUEL STATION\n${r.id}   ${fmtDate(r.ts)} ${fmtTime(r.ts)}\n--------------------------------\nCustomer : ${r.cust}\nVehicle  : ${r.veh || '-'}\nFuel     : ${f.name}  (Pump ${r.pump})\nQuantity : ${num(r.qty, 2)} ${f.unit}\nRate     : ${inr2(r.rate)}\nTotal    : ${inr2(r.amount)}\nPayment  : ${r.pay}`;
    draft.qty = ''; toast(`${r.id} recorded: ${inr2(r.amount)}`); pages.sales.render($('#view'));
  };
  $('#enq').onclick = () => { if (!queue.enqueue({ veh: draft.veh.trim().toUpperCase(), fuel: draft.fuel, name: draft.cust })) return toast('Queue is full (8 vehicles).'); toast('Vehicle added to the queue.'); pages.sales.render($('#view')); };
  $('#serve').onclick = () => { const q = queue.dequeue(); if (!q) return; draft.veh = q.veh; draft.fuel = q.fuel; draft.cust = q.name; toast('Serving ' + (q.veh || 'walk-in vehicle')); pages.sales.render($('#view')); };
  $('#undo').onclick = () => {
    const r = undoStack.pop(); if (!r) return;
    sales.remove(keyOf(r.ts, r.seq)); const f = fuelMap.get(r.fuel); f.level = Math.min(f.cap, f.level + r.qty);
    audit.addFront({ ts: Date.now(), type: 'Reversal', fuel: r.fuel, qty: r.qty, ref: r.id }); draft.receipt = ''; toast(r.id + ' reversed.'); pages.sales.render($('#view'));
  };
}

/* ---------- Inventory ---------- */
pages.inventory = {
  title: 'Inventory', sub: 'Tank stock, deliveries, supplier routing and the movement trail',
  render(v) {
    const ad = avgDaily(), h = refillHeap(), order = []; while (h.size) order.push(h.pop());
    v.innerHTML = `<div class="grid">
      <div class="card s12"><h2>Tank register <small>Reorder level ${REORDER * 100}% of capacity</small></h2><div class="scroll"><table><thead><tr><th>Fuel</th><th class="n">Capacity</th><th class="n">Current stock</th><th style="min-width:140px">Level</th><th class="n">Avg daily sale</th><th class="n">Days of stock</th><th class="n">Value at cost</th><th>Status</th></tr></thead><tbody>${FUELS.map(f => { const s = status(f), a = ad[f.id] || 0; return `<tr><td>${dot(f.id)}<b>${f.name}</b></td><td class="n">${num(f.cap)} ${f.unit}</td><td class="n">${num(f.level)} ${f.unit}</td><td><div class="gauge"><i style="width:${pct(f) * 100}%;background:${f.color}"></i></div></td><td class="n">${num(a)} ${f.unit}</td><td class="n">${a ? (f.level / a).toFixed(1) : '-'}</td><td class="n">${inr(f.level * f.cost)}</td><td><span class="pill ${s[0]}">${s[1]}</span></td></tr>`; }).join('')}</tbody></table></div></div>
      <div class="card s5"><h2>Receive delivery <small>updates tank and audit list</small></h2>
        <form class="form" id="df" autocomplete="off">
          <label>Fuel<select id="dfuel">${FUELS.map(f => `<option value="${f.id}" ${f.id === order[0].f.id ? 'selected' : ''}>${f.name}</option>`).join('')}</select></label>
          <label>Quantity received<input id="dqty" type="number" min="1" step="1" required></label>
          <label class="full">Supplier<select id="dsup"></select></label>
          <label class="full">Delivery challan no.<input id="dref" value="GRN-${2000 + audit.n}"></label>
          <p class="note full" id="dnote"></p>
          <div class="full"><button class="btn" type="submit">Add to stock</button></div></form></div>
      <div class="card s7"><h2>Supplier routes <small>Dijkstra shortest path from the station</small></h2><div class="scroll"><table><thead><tr><th>Supplier</th><th class="n">Distance</th><th>Route</th><th>Supplies</th></tr></thead><tbody id="sup"></tbody></table></div><p class="note">Edge weights are road kilometres. The nearest supplier that stocks the selected fuel is recommended.</p></div>
      <div class="card s12"><h2>Stock movement trail <small>Doubly linked list, latest 15</small></h2><div class="scroll">${auditTable(15)}</div></div>
    </div>`;
    const upd = () => {
      const fid = $('#dfuel').value, ss = suppliersFor(fid), f = fuelMap.get(fid);
      $('#dsup').innerHTML = ss.map((s, i) => `<option>${s.name} · ${s.km} km${i ? '' : ' (nearest)'}</option>`).join('');
      $('#sup').innerHTML = ss.map((s, i) => `<tr><td>${s.name}${i ? '' : ' <span class="pill ok">Recommended</span>'}</td><td class="n">${s.km} km</td><td>${s.path.join(' → ')}</td><td>${s.fuels.map(x => fuelName(x)).join(', ')}</td></tr>`).join('');
      $('#dqty').max = f.cap - f.level; $('#dnote').textContent = `Room in tank: ${num(f.cap - f.level)} ${f.unit}. Suggested order: ${num(f.cap * 0.9 - f.level)} ${f.unit} (fills to 90%).`;
    };
    $('#dfuel').onchange = upd; upd();
    $('#df').onsubmit = e => {
      e.preventDefault(); const f = fuelMap.get($('#dfuel').value), q = parseFloat($('#dqty').value);
      if (!(q > 0) || q > f.cap - f.level) return toast('Quantity exceeds free space in the tank.');
      f.level += q; audit.addFront({ ts: Date.now(), type: 'Delivery', fuel: f.id, qty: q, ref: $('#dref').value || 'GRN' }); toast(`${num(q)} ${f.unit} of ${f.name} added.`); pages.inventory.render($('#view'));
    };
  }
};
