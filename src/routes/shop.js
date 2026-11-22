const router = require("express").Router();
const { pool } = require("../db");
const { auth, shopAccess } = require("../middleware");
const { asyncHandler, validPhone } = require("../utils");
const { sendTelegramMessage } = require("../telegram");

router.use(auth, shopAccess);

async function subscriptionActive(shop) {
  if (shop.subscription_status === "active" && shop.subscription_ends_at && new Date(shop.subscription_ends_at) >= new Date()) return true;
  if (shop.subscription_status === "trial" && shop.trial_ends_at && new Date(shop.trial_ends_at) >= new Date()) return true;
  return false;
}
router.get("/dashboard", asyncHandler(async (req,res) => {
  const id=req.shop.id;
  const [debt, due, overdue, customers] = await Promise.all([
    pool.query("SELECT COALESCE(SUM(remaining_amount),0) total FROM debts WHERE shop_id=$1 AND status<>'void'",[id]),
    pool.query("SELECT COALESCE(SUM(remaining_amount),0) total FROM debts WHERE shop_id=$1 AND status='open' AND due_date=CURRENT_DATE",[id]),
    pool.query("SELECT COALESCE(SUM(remaining_amount),0) total FROM debts WHERE shop_id=$1 AND status='open' AND due_date<CURRENT_DATE",[id]),
    pool.query("SELECT COUNT(*) count FROM customers WHERE shop_id=$1",[id])
  ]);
  res.json({ totalDebt:Number(debt.rows[0].total), dueToday:Number(due.rows[0].total), overdue:Number(overdue.rows[0].total), customers:Number(customers.rows[0].count), subscriptionActive:await subscriptionActive(req.shop), shop:req.shop.name });
}));

router.get("/customers", asyncHandler(async(req,res)=>{
  const r=await pool.query(`SELECT c.*,COALESCE(SUM(d.remaining_amount) FILTER(WHERE d.status='open'),0) debt
    FROM customers c LEFT JOIN debts d ON d.customer_id=c.id AND d.shop_id=c.shop_id
    WHERE c.shop_id=$1 GROUP BY c.id ORDER BY c.created_at DESC`,[req.shop.id]);
  res.json(r.rows);
}));
router.post("/customers", asyncHandler(async(req,res)=>{
  const {name,phone,note}=req.body;
  if(!name || !phone || !validPhone(phone)) return res.status(400).json({error:"Ism va to‘g‘ri telefon raqamini kiriting."});
  const r=await pool.query("INSERT INTO customers(shop_id,name,phone,note) VALUES($1,$2,$3,$4) RETURNING *",[req.shop.id,name,phone.replace(/[\s()-]/g,""),note||null]);
  res.status(201).json(r.rows[0]);
}));

router.get("/debts", asyncHandler(async(req,res)=>{
  const r=await pool.query(`SELECT d.*,c.name customer_name,c.phone customer_phone
    FROM debts d JOIN customers c ON c.id=d.customer_id
    WHERE d.shop_id=$1 ORDER BY d.due_date ASC,d.created_at DESC`,[req.shop.id]);
  res.json(r.rows);
}));
router.post("/debts", asyncHandler(async(req,res)=>{
  if(!(await subscriptionActive(req.shop))) return res.status(402).json({error:"Obuna muddati tugagan. Davom etish uchun tarifni faollashtiring."});
  const {customerId,amount,dueDate,description,reminderEnabled}=req.body;
  const n=Number(amount);
  if(!customerId || !Number.isFinite(n) || n<=0 || !dueDate) return res.status(400).json({error:"Mijoz, summa va to‘lov muddatini kiriting."});
  const customer=await pool.query("SELECT id FROM customers WHERE id=$1 AND shop_id=$2",[customerId,req.shop.id]);
  if(!customer.rowCount) return res.status(404).json({error:"Mijoz topilmadi."});
  const r=await pool.query(`INSERT INTO debts(shop_id,customer_id,amount,remaining_amount,due_date,description,reminder_enabled)
    VALUES($1,$2,$3,$3,$4,$5,$6) RETURNING *`,[req.shop.id,customerId,n,dueDate,description||null,reminderEnabled!==false]);
  res.status(201).json(r.rows[0]);
}));
router.post("/debts/:id/payments", asyncHandler(async(req,res)=>{
  const amount=Number(req.body.amount);
  if(!Number.isFinite(amount)||amount<=0) return res.status(400).json({error:"To‘lov summasi noto‘g‘ri."});
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const d=await client.query("SELECT * FROM debts WHERE id=$1 AND shop_id=$2 FOR UPDATE",[req.params.id,req.shop.id]);
    if(!d.rowCount){await client.query("ROLLBACK");return res.status(404).json({error:"Qarz topilmadi."});}
    if(amount>Number(d.rows[0].remaining_amount)){await client.query("ROLLBACK");return res.status(400).json({error:"To‘lov qolgan qarzdan ko‘p."});}
    await client.query("INSERT INTO payments(shop_id,debt_id,amount,note) VALUES($1,$2,$3,$4)",[req.shop.id,d.rows[0].id,amount,req.body.note||null]);
    const remaining=Number(d.rows[0].remaining_amount)-amount;
    await client.query("UPDATE debts SET remaining_amount=$1,status=$2,updated_at=NOW() WHERE id=$3",[remaining,remaining===0?"paid":"open",d.rows[0].id]);
    await client.query("COMMIT");
    res.json({ok:true,remaining,status:remaining===0?"paid":"open"});
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
}));
router.get("/debts/:id/payments", asyncHandler(async(req,res)=>{
  const d=await pool.query("SELECT id FROM debts WHERE id=$1 AND shop_id=$2",[req.params.id,req.shop.id]);
  if(!d.rowCount)return res.status(404).json({error:"Qarz topilmadi."});
  const r=await pool.query("SELECT * FROM payments WHERE debt_id=$1 AND shop_id=$2 ORDER BY created_at DESC",[req.params.id,req.shop.id]);
  res.json(r.rows);
}));

router.get("/subscription", asyncHandler(async(req,res)=>{
  const r=await pool.query("SELECT id,name,subscription_status,trial_ends_at,subscription_ends_at FROM shops WHERE id=$1",[req.shop.id]);
  const payments=await pool.query("SELECT id,plan_code,amount,status,reference,created_at,review_note FROM subscription_payments WHERE shop_id=$1 ORDER BY created_at DESC",[req.shop.id]);
  res.json({shop:r.rows[0],plans:[{code:"start",name:"START",price:29000},{code:"business",name:"BUSINESS",price:59000},{code:"premium",name:"PREMIUM",price:99000}],payments:payments.rows,bank:{holder:process.env.PAYMENT_CARD_HOLDER||"NasiyaPro",card:process.env.PAYMENT_CARD_NUMBER||"Admin sozlaydi",bank:process.env.PAYMENT_BANK||""}});
}));
router.post("/subscription/request", asyncHandler(async(req,res)=>{
  const {planCode,reference,amount}=req.body;
  const prices={start:29000,business:59000,premium:99000};
  if(!prices[planCode]||!reference) return res.status(400).json({error:"Tarif va to‘lov izohini kiriting."});
  const r=await pool.query(`INSERT INTO subscription_payments(shop_id,plan_code,amount,reference,status)
    VALUES($1,$2,$3,$4,'pending') RETURNING id`,[req.shop.id,planCode,prices[planCode],reference]);
  res.status(201).json({ok:true,id:r.rows[0].id,message:"So‘rov adminga yuborildi."});
}));
router.post("/telegram/link-code", asyncHandler(async(req,res)=>{
  const crypto=require("crypto"); const code=crypto.randomBytes(16).toString("hex");
  const c=await pool.query("SELECT id FROM customers WHERE id=$1 AND shop_id=$2",[req.body.customerId,req.shop.id]);
  if(!c.rowCount)return res.status(404).json({error:"Mijoz topilmadi."});
  if(!process.env.TELEGRAM_BOT_USERNAME)return res.status(503).json({error:"Telegram bot username server sozlamasiga kiritilmagan."});
  await pool.query("UPDATE customers SET telegram_link_code=$1,telegram_link_expires=NOW()+INTERVAL '15 minutes' WHERE id=$2 AND shop_id=$3",[code,req.body.customerId,req.shop.id]);
  res.json({link:`https://t.me/${process.env.TELEGRAM_BOT_USERNAME.replace(/^@/,"")}?start=${code}`,code});
}));
router.post("/settings", asyncHandler(async(req,res)=>{
  const {name,phone}=req.body;
  const r=await pool.query("UPDATE shops SET name=COALESCE($1,name),phone=COALESCE($2,phone) WHERE id=$3 RETURNING name,phone",[name||null,phone||null,req.shop.id]);
  res.json(r.rows[0]);
}));
module.exports=router;
