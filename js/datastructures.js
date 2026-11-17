/* ===== Advanced data structures used by PetroTrack ===== */

/* 1. HashMap with separate chaining + dynamic rehash  -> O(1) avg lookup */
class HashMap {
  constructor(cap = 8) { this.buckets = Array.from({ length: cap }, () => []); this.size = 0; this.rehashes = 0; }
  _h(k) { let h = 5381; k = String(k); for (let i = 0; i < k.length; i++) h = ((h << 5) + h + k.charCodeAt(i)) >>> 0; return h % this.buckets.length; }
  set(k, v) {
    const b = this.buckets[this._h(k)];
    for (const e of b) if (e[0] === k) { e[1] = v; return; }
    b.push([k, v]); this.size++;
    if (this.size / this.buckets.length > 0.75) this._grow();
  }
  get(k) { for (const e of this.buckets[this._h(k)]) if (e[0] === k) return e[1]; return undefined; }
  has(k) { return this.get(k) !== undefined; }
  delete(k) {
    const b = this.buckets[this._h(k)];
    const i = b.findIndex(e => e[0] === k);
    if (i < 0) return false; b.splice(i, 1); this.size--; return true;
  }
  _grow() {
    const old = this.buckets; this.buckets = Array.from({ length: old.length * 2 }, () => []); this.size = 0; this.rehashes++;
    for (const b of old) for (const [k, v] of b) this.set(k, v);
  }
  values() { const o = []; for (const b of this.buckets) for (const e of b) o.push(e[1]); return o; }
  stats() { const lens = this.buckets.map(b => b.length); return { buckets: this.buckets.length, size: this.size, load: this.size / this.buckets.length, longest: Math.max(...lens), rehashes: this.rehashes, lens }; }
}

/* 2. AVL tree keyed by sale sequence/time -> ordered storage, range queries O(log n + k) */
class AVLNode { constructor(k, v) { this.k = k; this.v = v; this.h = 1; this.l = null; this.r = null; } }
class AVLTree {
  constructor() { this.root = null; this.size = 0; this.rotations = 0; }
  _h(n) { return n ? n.h : 0; }
  _up(n) { n.h = 1 + Math.max(this._h(n.l), this._h(n.r)); }
  _bf(n) { return n ? this._h(n.l) - this._h(n.r) : 0; }
  _rr(y) { const x = y.l; y.l = x.r; x.r = y; this._up(y); this._up(x); this.rotations++; return x; }
  _rl(x) { const y = x.r; x.r = y.l; y.l = x; this._up(x); this._up(y); this.rotations++; return y; }
  _bal(n) {
    this._up(n); const b = this._bf(n);
    if (b > 1) { if (this._bf(n.l) < 0) n.l = this._rl(n.l); return this._rr(n); }
    if (b < -1) { if (this._bf(n.r) > 0) n.r = this._rr(n.r); return this._rl(n); }
    return n;
  }
  insert(k, v) { this.root = this._ins(this.root, k, v); }
  _ins(n, k, v) {
    if (!n) { this.size++; return new AVLNode(k, v); }
    if (k < n.k) n.l = this._ins(n.l, k, v); else if (k > n.k) n.r = this._ins(n.r, k, v); else { n.v = v; return n; }
    return this._bal(n);
  }
  find(k) { let n = this.root; while (n) { if (k === n.k) return n.v; n = k < n.k ? n.l : n.r; } return undefined; }
  remove(k) { this.root = this._del(this.root, k); }
  _del(n, k) {
    if (!n) return null;
    if (k < n.k) n.l = this._del(n.l, k);
    else if (k > n.k) n.r = this._del(n.r, k);
    else {
      this.size--;
      if (!n.l || !n.r) return n.l || n.r;
      let s = n.r; while (s.l) s = s.l;
      n.k = s.k; n.v = s.v; this.size++; n.r = this._del(n.r, s.k);
    }
    return this._bal(n);
  }
  range(lo, hi) { const out = []; (function w(n) { if (!n) return; if (lo < n.k) w(n.l); if (n.k >= lo && n.k <= hi) out.push(n.v); if (hi > n.k) w(n.r); })(this.root); return out; }
  inorder() { return this.range(-Infinity, Infinity); }
  height() { return this._h(this.root); }
}

/* 3. Binary min-heap priority queue -> most critical tank first, O(log n) */
class MinHeap {
  constructor(cmp = (a, b) => a.p - b.p) { this.a = []; this.cmp = cmp; }
  get size() { return this.a.length; }
  push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (this.cmp(a[i], a[p]) >= 0) break;[a[i], a[p]] = [a[p], a[i]]; i = p; } }
  peek() { return this.a[0]; }
  pop() {
    const a = this.a; if (!a.length) return undefined; const top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (; ;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && this.cmp(a[l], a[m]) < 0) m = l; if (r < a.length && this.cmp(a[r], a[m]) < 0) m = r; if (m === i) break;[a[i], a[m]] = [a[m], a[i]]; i = m; } }
    return top;
  }
}

/* 4. Circular queue (fixed capacity) -> vehicles waiting at the forecourt, FIFO */
class CircularQueue {
  constructor(cap = 8) { this.cap = cap; this.buf = new Array(cap); this.head = 0; this.n = 0; }
  enqueue(x) { if (this.n === this.cap) return false; this.buf[(this.head + this.n) % this.cap] = x; this.n++; return true; }
  dequeue() { if (!this.n) return undefined; const x = this.buf[this.head]; this.buf[this.head] = undefined; this.head = (this.head + 1) % this.cap; this.n--; return x; }
  toArray() { return Array.from({ length: this.n }, (_, i) => this.buf[(this.head + i) % this.cap]); }
}

/* 5. Stack -> undo last sale */
class Stack { constructor() { this.a = []; } push(x) { this.a.push(x); } pop() { return this.a.pop(); } peek() { return this.a[this.a.length - 1]; } get size() { return this.a.length; } }

/* 6. Trie -> instant vehicle-number / customer-name search */
class Trie {
  constructor() { this.root = { c: {}, items: [] }; this.nodes = 1; }
  insert(word, item) {
    let n = this.root; for (const ch of word.toLowerCase()) { if (!n.c[ch]) { n.c[ch] = { c: {}, items: [] }; this.nodes++; } n = n.c[ch]; if (n.items.length < 50) n.items.push(item); }
  }
  search(prefix, limit = 6) { let n = this.root; for (const ch of prefix.toLowerCase()) { n = n.c[ch]; if (!n) return []; } return n.items.slice(0, limit); }
}

/* 7. Doubly linked list -> audit trail of stock movements (insert at head, walk both ways) */
class DLL {
  constructor(max = 200) { this.head = null; this.tail = null; this.n = 0; this.max = max; }
  addFront(v) { const nd = { v, p: null, nx: this.head }; if (this.head) this.head.p = nd; this.head = nd; if (!this.tail) this.tail = nd; this.n++; if (this.n > this.max) { this.tail = this.tail.p; this.tail.nx = null; this.n--; } }
  toArray(limit = 20) { const o = []; let c = this.head; while (c && o.length < limit) { o.push(c.v); c = c.nx; } return o; }
}

/* 8. Graph + Dijkstra (uses MinHeap) -> nearest supplier depot for a refill order */
class Graph {
  constructor() { this.adj = new Map(); }
  edge(a, b, w) { for (const [x, y] of [[a, b], [b, a]]) { if (!this.adj.has(x)) this.adj.set(x, []); this.adj.get(x).push([y, w]); } }
  dijkstra(src) {
    const dist = new Map(), prev = new Map(); for (const k of this.adj.keys()) dist.set(k, Infinity); dist.set(src, 0);
    const pq = new MinHeap((a, b) => a.p - b.p); pq.push({ p: 0, n: src });
    while (pq.size) { const { p, n } = pq.pop(); if (p > dist.get(n)) continue; for (const [m, w] of this.adj.get(n)) { const d = p + w; if (d < dist.get(m)) { dist.set(m, d); prev.set(m, n); pq.push({ p: d, n: m }); } } }
    return { dist, prev };
  }
  path(prev, to) { const p = [to]; while (prev.has(p[0])) p.unshift(prev.get(p[0])); return p; }
}

/* Algorithms: merge sort (stable) + binary search on sorted array */
function mergeSort(a, cmp) {
  if (a.length < 2) return a.slice(); const m = a.length >> 1, l = mergeSort(a.slice(0, m), cmp), r = mergeSort(a.slice(m), cmp), o = []; let i = 0, j = 0;
  while (i < l.length && j < r.length) o.push(cmp(l[i], r[j]) <= 0 ? l[i++] : r[j++]); return o.concat(l.slice(i), r.slice(j));
}
function lowerBound(a, x, key = v => v) { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (key(a[m]) < x) lo = m + 1; else hi = m; } return lo; }

if (typeof module !== 'undefined') module.exports = { HashMap, AVLTree, MinHeap, CircularQueue, Stack, Trie, DLL, Graph, mergeSort, lowerBound };
