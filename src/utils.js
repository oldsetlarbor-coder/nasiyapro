const crypto = require("crypto");
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
function makeCode() { return crypto.randomBytes(20).toString("hex"); }
function money(n) { return Math.round(Number(n) * 100) / 100; }
function validPhone(phone) { return /^\+?[0-9]{9,15}$/.test(String(phone || "").replace(/[\s()-]/g, "")); }
module.exports = { asyncHandler, makeCode, money, validPhone };
