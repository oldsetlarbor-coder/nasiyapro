const router=require("express").Router();
const {pool}=require("../db");
const {auth,adminOnly}=require("../middleware");
const {asyncHandler}=require("../utils");
router.use(auth,adminOnly);

router.get("/overview",asyncHandler(async(req,res)=>{
  const [shops,pending,active,revenue]=await Promise.all([
    pool.query("SELECT COUNT(*) count FROM shops"),
    pool.query("SELECT COUNT(*) count FROM subscription_payments WHERE status='pending'"),
    pool.query("SELECT COUNT(*) count FROM shops WHERE subscription_status='active' AND subscription_ends_at>=NOW()"),
    pool.query("SELECT COALESCE(SUM(amount),0) total FROM subscription_payments WHERE status='approved'")
  ]);
  res.json({shops:Number(shops.rows[0].count),pending:Number(pending.rows[0].count),active:Number(active.rows[0].count),revenue:Number(revenue.rows[0].total)});
}));
router.get("/shops",asyncHandler(async(req,res)=>{
 const r=await pool.query(`SELECT s.*,u.email,COALESCE(x.debt,0) total_debt FROM shops s
 LEFT JOIN users u ON u.shop_id=s.id AND u.role='shop'
 LEFT JOIN (SELECT shop_id,SUM(remaining_amount) debt FROM debts WHERE status='open' GROUP BY shop_id)x ON x.shop_id=s.id
 ORDER BY s.created_at DESC`);
 res.json(r.rows);
}));
router.get("/payments",asyncHandler(async(req,res)=>{
 const r=await pool.query(`SELECT p.*,s.name shop_name,u.email FROM subscription_payments p
 JOIN shops s ON s.id=p.shop_id LEFT JOIN users u ON u.shop_id=s.id AND u.role='shop'
 ORDER BY p.created_at DESC`);
 res.json(r.rows);
}));
router.post("/payments/:id/approve",asyncHandler(async(req,res)=>{
 const client=await pool.connect();
 try{
  await client.query("BEGIN");
  const p=await client.query("SELECT * FROM subscription_payments WHERE id=$1 FOR UPDATE",[req.params.id]);
  if(!p.rowCount){await client.query("ROLLBACK");return res.status(404).json({error:"To‘lov topilmadi."});}
  if(p.rows[0].status!=="pending"){await client.query("ROLLBACK");return res.status(409).json({error:"Bu so‘rov avval ko‘rib chiqilgan."});}
  const months=1;
  await client.query("UPDATE subscription_payments SET status='approved',reviewed_at=NOW(),review_note=$1 WHERE id=$2",[req.body.note||null,req.params.id]);
  await client.query(`UPDATE shops SET subscription_status='active',
    subscription_plan=$1,
    subscription_ends_at=GREATEST(COALESCE(subscription_ends_at,NOW()),NOW())+INTERVAL '1 month'
    WHERE id=$2`,[p.rows[0].plan_code,p.rows[0].shop_id]);
  await client.query("COMMIT");res.json({ok:true});
 }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
}));
router.post("/payments/:id/reject",asyncHandler(async(req,res)=>{
 const r=await pool.query("UPDATE subscription_payments SET status='rejected',reviewed_at=NOW(),review_note=$1 WHERE id=$2 AND status='pending' RETURNING id",[req.body.note||"To‘lov tasdiqlanmadi",req.params.id]);
 if(!r.rowCount)return res.status(404).json({error:"Kutilayotgan to‘lov topilmadi."});
 res.json({ok:true});
}));
router.post("/shops/:id/toggle",asyncHandler(async(req,res)=>{
 const r=await pool.query("UPDATE shops SET is_active=NOT is_active WHERE id=$1 RETURNING is_active",[req.params.id]);
 if(!r.rowCount)return res.status(404).json({error:"Do‘kon topilmadi."});
 res.json(r.rows[0]);
}));
router.get("/plans",asyncHandler(async(req,res)=>{
 const r=await pool.query("SELECT * FROM plans ORDER BY price");
 res.json(r.rows);
}));
module.exports=router;
