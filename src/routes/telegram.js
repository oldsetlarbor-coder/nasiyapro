const router=require("express").Router();
const {handleTelegramUpdate}=require("../telegram");
router.post("/webhook/:secret",async(req,res)=>{
 if(!process.env.TELEGRAM_WEBHOOK_SECRET || req.params.secret!==process.env.TELEGRAM_WEBHOOK_SECRET)
  return res.sendStatus(403);
 try{await handleTelegramUpdate(req.body);res.sendStatus(200);}
 catch(e){console.error("Telegram webhook:",e.message);res.sendStatus(500);}
});
module.exports=router;
