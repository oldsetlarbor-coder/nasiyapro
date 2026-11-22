const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { asyncHandler } = require("../utils");
const { auth } = require("../middleware");

router.post("/register", asyncHandler(async (req, res) => {
  const { shopName, ownerName, email, phone, password } = req.body;
  if (!shopName || !ownerName || !email || !password || String(password).length < 8)
    return res.status(400).json({ error: "Barcha maydonlarni to‘ldiring. Parol kamida 8 belgidan iborat bo‘lsin." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const exists = await client.query("SELECT id FROM users WHERE lower(email)=lower($1)", [email]);
    if (exists.rowCount) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Bu email band." }); }
    const shop = await client.query(
      `INSERT INTO shops(name, owner_name, phone, trial_ends_at, subscription_status)
       VALUES($1,$2,$3,NOW()+INTERVAL '7 days','trial') RETURNING id`,
      [shopName, ownerName, phone || null]
    );
    const hash = await bcrypt.hash(password, 12);
    const user = await client.query(
      `INSERT INTO users(email,password_hash,role,shop_id) VALUES(lower($1),$2,'shop',$3)
       RETURNING id,email,role,shop_id`, [email, hash, shop.rows[0].id]
    );
    await client.query("COMMIT");
    const token = jwt.sign({ sub: user.rows[0].id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
    res.status(201).json({ token, user: user.rows[0], message: "7 kunlik bepul sinov boshlandi." });
  } catch (e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}));

router.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query("SELECT * FROM users WHERE lower(email)=lower($1)", [email || ""]);
  const user = result.rows[0];
  if (!user || !user.is_active || !(await bcrypt.compare(password || "", user.password_hash)))
    return res.status(401).json({ error: "Email yoki parol noto‘g‘ri." });
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, shop_id: user.shop_id } });
}));

router.get("/me", auth, asyncHandler(async (req, res) => {
  let shop = null;
  if (req.user.shop_id) {
    const r = await pool.query("SELECT id,name,subscription_status,trial_ends_at,subscription_ends_at FROM shops WHERE id=$1", [req.user.shop_id]);
    shop = r.rows[0] || null;
  }
  res.json({ user: req.user, shop });
}));
module.exports = router;
