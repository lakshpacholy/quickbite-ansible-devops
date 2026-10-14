const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionTimeoutMillis: 2000,
});
pool.on("error", () => {}); // a dropped idle connection must not crash the API

// Used only if the database is unreachable, so /menu never goes fully dark.
const FALLBACK_MENU = [
  { id: 1, name: "Margherita Pizza", price: 249 },
  { id: 2, name: "Veg Burger", price: 149 },
];

app.get("/health", async (req, res) => {
  let database = "up";
  try {
    await pool.query("SELECT 1");
  } catch (e) {
    database = "down";
  }
  res.json({ status: "ok", database, version: process.env.APP_VERSION || "dev" });
});

app.get("/menu", async (req, res) => {
  try {
    const r = await pool.query("SELECT id, name, price FROM menu_items ORDER BY id");
    res.json({ app: "QuickBite", source: "postgresql", items: r.rows });
  } catch (e) {
    res.json({ app: "QuickBite", source: "fallback", items: FALLBACK_MENU });
  }
});

app.post("/orders", async (req, res) => {
  const { item_id, quantity } = req.body || {};
  if (!Number.isInteger(item_id) || !Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: "item_id and quantity (>=1) are required integers" });
  }
  try {
    const r = await pool.query(
      "INSERT INTO orders (item_id, quantity) VALUES ($1, $2) RETURNING id, item_id, quantity, created_at",
      [item_id, quantity]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(503).json({ error: "database unavailable" });
  }
});

app.get("/orders", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id, item_id, quantity, created_at FROM orders ORDER BY id DESC LIMIT 20"
    );
    res.json({ count: r.rows.length, orders: r.rows });
  } catch (e) {
    res.status(503).json({ error: "database unavailable" });
  }
});

const port = parseInt(process.env.PORT || "3000", 10);
app.listen(port, "127.0.0.1", () => console.log(`QuickBite API listening on 127.0.0.1:${port}`));
