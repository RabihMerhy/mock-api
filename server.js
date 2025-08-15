import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";

const app = express();
app.use(cors());
app.use(express.json());

/** ----- Sample data ----- */
const optionGroups = [
  { id: "g1", name: "Toppings", min: 0, max: 3, options: [
    { id: "op1", name: "Maple Syrup", price: 0.5 },
    { id: "op2", name: "Blueberries", price: 0.8 },
    { id: "op3", name: "Whipped Cream", price: 0.4 }
  ]}
];
const items = [
  { id: "i101", name: "Pancakes", price: 5.5, desc: "Fluffy stack with butter", optionGroups },
  { id: "i102", name: "Omelette", price: 6.5 }
];
const menus = [{ id: "m1", title: "Breakfast", items }];
const outlets = [
  { id: "o1", name: "Central Cafe", rating: 4.6, etaMinutes: 15, isOpen: true,
    location: { lat: 12.97, lng: 77.59 }, address: "12 Market St",
    menus: menus.map(m => ({ id: m.id, title: m.title }))
  },
  { id: "o2", name: "Riverside Deli", rating: 4.4, etaMinutes: 20, isOpen: false,
    location: { lat: 12.99, lng: 77.6 }, address: "44 Park Ave",
    menus: [{ id: "m1", title: "All Day" }]
  }
];

/** ----- In-memory carts & orders ----- */
const carts = new Map();   // cartId -> cart
const orders = new Map();  // orderId -> order

function totalsFor(lines) {
  const subtotal = lines.reduce((sum, l) => {
    const opts = (l.options || []).reduce((s, o) => s + (o.price || 0), 0);
    return sum + (l.unitPrice + opts) * l.qty;
  }, 0);
  const tax = +(subtotal * 0.09).toFixed(2);
  const deliveryFee = subtotal > 0 ? 2.0 : 0;
  const total = +(subtotal + tax + deliveryFee).toFixed(2);
  return { subtotal, tax, deliveryFee, total };
}

/** ----- Routes ----- */
// Outlets
app.get("/outlets", (req, res) => res.json(outlets));
app.get("/outlets/:id", (req, res) => {
  const o = outlets.find(x => x.id === req.params.id);
  if (!o) return res.status(404).end();
  res.json(o);
});

// Menus
app.get("/menus/:id", (req, res) => {
  const m = menus.find(x => x.id === req.params.id) || menus[0];
  res.json(m);
});

// Carts
app.post("/carts", (req, res) => {
  const id = `c_${nanoid(6)}`;
  const cart = { id, currency: "USD", lines: [], totals: { subtotal: 0, tax: 0, deliveryFee: 0, total: 0 } };
  carts.set(id, cart);
  res.status(201).json(cart);
});

app.get("/carts/:cartId", (req, res) => {
  const c = carts.get(req.params.cartId);
  if (!c) return res.status(404).end();
  res.json(c);
});

app.post("/carts/:cartId/items", (req, res) => {
  const c = carts.get(req.params.cartId);
  if (!c) return res.status(404).end();
  const item = items.find(i => i.id === req.body.itemId);
  if (!item) return res.status(400).json({ error: "Invalid itemId" });
  const line = {
    id: `l_${nanoid(5)}`,
    itemId: item.id,
    name: item.name,
    qty: req.body.qty || 1,
    unitPrice: item.price,
    options: req.body.options || []
  };
  c.lines.push(line);
  c.totals = totalsFor(c.lines);
  res.status(201).json(c);
});

app.patch("/carts/:cartId/items/:lineId", (req, res) => {
  const c = carts.get(req.params.cartId);
  if (!c) return res.status(404).end();
  const line = c.lines.find(l => l.id === req.params.lineId);
  if (!line) return res.status(404).end();
  if (req.body.qty) line.qty = Math.max(1, parseInt(req.body.qty, 10));
  c.totals = totalsFor(c.lines);
  res.json(c);
});

app.delete("/carts/:cartId/items/:lineId", (req, res) => {
  const c = carts.get(req.params.cartId);
  if (!c) return res.status(404).end();
  c.lines = c.lines.filter(l => l.id !== req.params.lineId);
  c.totals = totalsFor(c.lines);
  res.status(204).end();
});

// Orders
app.post("/orders", (req, res) => {
  const { cartId, outletId, fulfillment, payment } = req.body || {};
  const c = carts.get(cartId);
  if (!c) return res.status(400).json({ error: "Invalid cartId" });
  const id = `ord_${nanoid(6)}`;
  const now = new Date().toISOString();
  const order = {
    id, cartId, outletId,
    status: "created",
    timeline: { createdAt: now },
    amount: { currency: "USD", ...c.totals },
    fulfillment: fulfillment || { type: "delivery" },
    payment: { method: payment?.method || "dummy", status: "pending" }
  };
  orders.set(id, order);
  // Simulate status changes
  setTimeout(() => { const o = orders.get(id); if (o) { o.status = "preparing"; o.timeline.confirmedAt = new Date().toISOString(); } }, 2000);
  setTimeout(() => { const o = orders.get(id); if (o) { o.status = "out_for_delivery"; o.timeline.dispatchedAt = new Date().toISOString(); } }, 5000);
  setTimeout(() => { const o = orders.get(id); if (o) { o.status = "delivered"; o.timeline.deliveredAt = new Date().toISOString(); } }, 9000);
  res.status(201).json(order);
});

app.get("/orders/:id", (req, res) => {
  const o = orders.get(req.params.id);
  if (!o) return res.status(404).end();
  res.json(o);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Mock API running on port ${PORT}`);
});
