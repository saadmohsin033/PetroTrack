# PetroTrack – Petroleum Stock Management System

Project-based learning demo: a fuel station stock and sales manager whose core logic is built
on advanced data structures, implemented from scratch (no libraries). Plain HTML, CSS and JavaScript.

## Run
Open `index.html` in any modern browser. No build step, no server, no installs.
(Fonts load from Google Fonts when online; the app falls back to system fonts offline.)

## Test the data structures
    node tests/test-datastructures.js

## Windows
Dashboard, Fuel Sales, Inventory, Sales Analysis, Reports, Customers, Data Structures Lab.

## Data structures and where they are used
| Structure | Use in the system | Cost |
|---|---|---|
| AVL tree | All sales keyed by timestamp; date-range reports | O(log n) insert, O(log n + k) range |
| Hash map (chaining, rehash) | Tanks, customers, grouped totals | O(1) average |
| Min-heap | Tank refill priority, top-5 customers, Dijkstra | O(log n) |
| Circular queue | Vehicles waiting at the forecourt | O(1) |
| Stack | Reverse last sale | O(1) |
| Trie | Type-ahead vehicle/customer search | O(L) |
| Doubly linked list | Stock movement audit trail | O(1) insert |
| Graph + Dijkstra | Nearest supplier route | O((V+E) log V) |
| Merge sort, binary search | Report sorting, sorted lookups | O(n log n), O(log n) |

## Files
- `js/datastructures.js` – all structure implementations (start here for the viva)
- `js/core.js` – data model, sample-data generator, helpers, SVG charts
- `js/pages-*.js` – the seven windows and the hash router
- `css/style.css` – styling (light and dark themes)
- `tests/` – Node tests for the structures

Sample data is generated in the browser and resets on reload.
