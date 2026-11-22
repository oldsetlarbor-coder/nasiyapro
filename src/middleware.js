const jwt = require("jsonwebtoken");
const { pool } = require("./db");

async function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Tizimga kiring." });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      "SELECT id,email,role,shop_id,is_active FROM users WHERE id=$1",
      [payload.sub]
    );
    const user = result.rows[0];
    if (!user || !user.is_active) return res.status(401).json({ error: "Hisob faol emas." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Sessiya yaroqsiz. Qayta kiring." });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Ruxsat yo‘q." });
  next();
}

async function shopAccess(req, res, next) {
  if (req.user?.role !== "shop" || !req.user.shop_id)
    return res.status(403).json({ error: "Do‘kon akkaunti talab qilinadi." });
  try {
    const result = await pool.query("SELECT * FROM shops WHERE id=$1", [req.user.shop_id]);
    if (!result.rows[0]) return res.status(403).json({ error: "Do‘kon topilmadi." });
    if (!result.rows[0].is_active) return res.status(403).json({ error: "Do‘kon akkaunti administrator tomonidan vaqtincha to‘xtatilgan." });
    req.shop = result.rows[0];
    next();
  } catch (e) { next(e); }
}
module.exports = { auth, adminOnly, shopAccess };
