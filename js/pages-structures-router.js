/* ===== Data Structures lab + router ===== */
const demo = { t: new AVLTree() };
[40, 20, 60, 10, 30, 50, 70].forEach(k => demo.t.insert(k, k));
function treeSvg(t) {
  const pos = [], idx = { i: 0 };
  (function walk(n, d) { if (!n) return; walk(n.l, d + 1); n.x = idx.i++; n.d = d; pos.push(n); walk(n.r, d + 1); })(t.root, 0);
  const W = Math.max(300, idx.i * 46 + 30), H = Math.max(120, t.height() * 62 + 30), X = n => 24 + n.x * 46, Y = n => 28 + n.d * 62;
  let s = ''; pos.forEach(n => { [n.l, n.r].forEach(c => { if (c) s += `<line x1="${X(n)}" y1="${Y(n)}" x2="${X(c)}" y2="${Y(c)}" stroke="var(--line)" stroke-width="2"/>`; }); });
  pos.forEach(n => { const bf = t._bf(n); s += `<circle cx="${X(n)}" cy="${Y(n)}" r="17" fill="var(--surface)" stroke="${Math.abs(bf) > 0 ? 'var(--c-dsl)' : 'var(--accent)'}" stroke-width="2"/><text x="${X(n)}" y="${Y(n) + 4}" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">${n.k}</text><text x="${X(n)}" y="${Y(n) - 22}" text-anchor="middle" style="font-size:10px">bf ${bf}</text>`; });
  return `<svg class="chart" width="${W}" height="${H}" role="img" aria-label="AVL tree diagram with ${t.size} nodes">${s}</svg>`;
}
function bench() {
  const N = 50000, Q = 2000, arr = Array.from({ length: N }, (_, i) => i * 3), avl = new AVLTree(), hm = new HashMap(1024);
  arr.forEach(k => { avl.insert(k, k); hm.set(k, k); });
  const qs = Array.from({ length: Q }, () => arr[Math.random() * N | 0]), time = f => { const t = performance.now(); f(); return performance.now() - t; };
  const lin = time(() => qs.forEach(q => arr.indexOf(q))), bs = time(() => qs.forEach(q => lowerBound(arr, q))), av = time(() => qs.forEach(q => avl.find(q))), hh = time(() => qs.forEach(q => hm.get(q)));
  const max = Math.max(lin, bs, av, hh);
  return { N, Q, rows: [['Linear scan', lin, 'O(n)'], ['Binary search (sorted array)', bs, 'O(log n)'], ['AVL tree find', av, 'O(log n)'], ['Hash map get', hh, 'O(1) average']].map(r => ({ label: r[0] + ' · ' + r[2], v: r[1], color: 'var(--accent)' })), max };
}
pages.structures = {
  title: 'Data Structures Lab', sub: 'Where each structure is used in this system, with live statistics',
  render(v) {
    const hs = custMap.stats(), h = refillHeap();
    const cards = [
      ['Hash map', 'Tank records by fuel id; customers by vehicle number; daily and per-fuel totals in reports', 'O(1) average get/set', `${hs.size} keys in ${hs.buckets} buckets, load ${hs.load.toFixed(2)}, longest chain ${hs.longest}, ${hs.rehashes} rehashes`],
      ['AVL tree', 'Every sale, keyed by timestamp. Powers date-range reports and dashboard totals', 'O(log n) insert/delete, O(log n + k) range', `${num(sales.size)} sales, height ${sales.height()} (a plain list would need ${num(sales.size)} steps), ${num(sales.rotations)} rotations`],
      ['Min-heap', 'Refill priority of tanks, and top-5 customers in analysis', 'O(log n) push/pop, O(1) peek', `Root now: ${h.peek().f.name} at ${(h.peek().p * 100).toFixed(0)}%`],
      ['Circular queue', 'Vehicles waiting at the forecourt, served first-in first-out', 'O(1) enqueue/dequeue', `${queue.n} of ${queue.cap} slots used, head index ${queue.head}`],
      ['Stack', 'Reverse the last recorded sale (last-in first-out)', 'O(1) push/pop', `${undoStack.size} reversible sale(s)`],
      ['Trie', 'Type-ahead for vehicle numbers and customer names', 'O(L) per search, L = prefix length', `${vehicleTrie.nodes} nodes for ${custMap.size} customers`],
      ['Doubly linked list', 'Stock movement trail, newest first, capped at 300 entries', 'O(1) insert at head', `${audit.n} entries stored`],
      ['Graph + Dijkstra', 'Nearest supplier route for deliveries, using the heap as priority queue', 'O((V + E) log V)', `${net.adj.size} nodes (station, depots, terminal, refinery)`],
      ['Merge sort, binary search', 'Report sorting (stable) and sorted-array lookups', 'O(n log n), O(log n)', 'Used in Reports and Customers']
    ];
    v.innerHTML = `<div class="grid"><div class="card s12"><h2>Structures in use</h2><div class="scroll"><table><thead><tr><th>Structure</th><th>Used for</th><th>Time cost</th><th>Live statistics</th></tr></thead><tbody>${cards.map(c => `<tr><td><b>${c[0]}</b></td><td style="white-space:normal;min-width:220px">${c[1]}</td><td>${c[2]}</td><td style="white-space:normal;min-width:200px">${c[3]}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="card s7"><h2>AVL tree playground <small>watch the rotations keep it balanced</small></h2><div class="scroll" id="tv">${treeSvg(demo.t)}</div>
        <form class="row" id="tf" style="margin-top:10px"><input id="tk" type="number" placeholder="Key" style="width:110px" required><button class="btn" id="ti">Insert</button><button class="btn sec" id="td" type="button">Delete</button><button class="btn sec" id="tr" type="button">Reset</button><span class="note" id="tn">Size ${demo.t.size}, height ${demo.t.height()}, rotations ${demo.t.rotations}. Amber nodes have a non-zero balance factor (bf).</span></form>
        <p class="note">Try inserting 80, 90, 100: the tree rotates left instead of growing into a chain.</p></div>
      <div class="card s5"><h2>Search benchmark <small>runs in your browser</small></h2><p class="note">50,000 sorted keys, 2,000 random lookups for each method.</p><button class="btn" id="bm">Run benchmark</button><div id="bo" style="margin-top:8px"></div></div>
      <div class="card s12"><h2>Hash map bucket chains <small>customer registry, chain length per bucket</small></h2><div id="hb"></div></div></div>`;
    const redraw = () => { $('#tv').innerHTML = treeSvg(demo.t); $('#tn').textContent = `Size ${demo.t.size}, height ${demo.t.height()}, rotations ${demo.t.rotations}. Amber nodes have a non-zero balance factor (bf).`; };
    $('#tf').onsubmit = e => { e.preventDefault(); const k = +$('#tk').value; if (demo.t.size >= 31) return toast('The playground holds up to 31 keys.'); demo.t.insert(k, k); redraw(); $('#tk').value = ''; };
    $('#td').onclick = () => { const k = +$('#tk').value; if (demo.t.find(k) === undefined) return toast('Key not found in the tree.'); demo.t.remove(k); redraw(); };
    $('#tr').onclick = () => { demo.t = new AVLTree(); [40, 20, 60, 10, 30, 50, 70].forEach(k => demo.t.insert(k, k)); redraw(); };
    $('#bm').onclick = () => { $('#bo').innerHTML = '<p class="note">Running...</p>'; setTimeout(() => { const b = bench(); $('#bo').innerHTML = hbars(b.rows, x => x.toFixed(2) + ' ms') + `<p class="note">Linear scan is ${(b.rows[0].v / Math.max(b.rows[3].v, 0.01)).toFixed(0)}× slower than the hash map at this size.</p>`; }, 30); };
    barChart($('#hb'), hs.lens.map((_, i) => String(i)), hs.lens, { h: 150, fmt: x => x.toFixed(0), label: 'Chain length per bucket' });
  }
};

/* ---------- router ---------- */
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  sales: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M3 21h12"/><path d="M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3"/><path d="M7 8h4"/>',
  inventory: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  analysis: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  reports: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  customers: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  structures: '<circle cx="12" cy="5" r="2.5"/><circle cx="6" cy="17" r="2.5"/><circle cx="18" cy="17" r="2.5"/><path d="M11 7.3L7 14.7M13 7.3l4 7.4"/>'
};
const NAV = [['dashboard', 'Dashboard'], ['sales', 'Fuel Sales'], ['inventory', 'Inventory'], ['analysis', 'Analysis'], ['reports', 'Reports'], ['customers', 'Customers'], ['structures', 'Data Structures']];
function route() {
  const id = pages[location.hash.slice(1)] ? location.hash.slice(1) : 'dashboard', p = pages[id];
  $('#nav').innerHTML = NAV.map(n => `<a href="#${n[0]}" ${n[0] === id ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n[0]]}</svg>${n[1]}</a>`).join('');
  $('#ttl').textContent = p.title; $('#sub').textContent = p.sub; document.title = p.title + ' · PetroTrack';
  p.render($('#view')); window.scrollTo(0, 0);
}
function tick() { $('#clock').textContent = new Date().toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); }
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { const id = location.hash.slice(1) || 'dashboard'; if (['dashboard', 'analysis', 'structures'].includes(id)) pages[id].render($('#view')); }, 200); });
window.addEventListener('hashchange', route);
seedAll(); tick(); setInterval(tick, 30000); route();
