const {pool}=require("./db");
async function sendTelegramMessage(chatId,text){
 const token=process.env.TELEGRAM_BOT_TOKEN;
 if(!token||!chatId)return false;
 const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({chat_id:chatId,text,disable_web_page_preview:true})
 });
 const data=await response.json();
 if(!data.ok) console.error("Telegram send failed:",data.description);
 return data.ok===true;
}
async function handleTelegramUpdate(update){
 const msg=update.message;
 if(!msg||!msg.text)return;
 const text=msg.text.trim();
 const chatId=String(msg.chat.id);
 if(text.startsWith("/start")){
  const code=text.split(/\s+/)[1];
  if(!code){await sendTelegramMessage(chatId,"NasiyaPro botiga xush kelibsiz. Do‘kon bergan ulanish havolasi orqali kiring.");return;}
  const r=await pool.query(`UPDATE customers SET telegram_chat_id=$1,telegram_link_code=NULL,telegram_link_expires=NULL,telegram_opt_in=true
   WHERE telegram_link_code=$2 AND telegram_link_expires>NOW() RETURNING name`,[chatId,code]);
  if(r.rowCount) await sendTelegramMessage(chatId,`Salom, ${r.rows[0].name}! Telegram eslatmalari ulandi. Qarzdorlik haqida eslatmalarni olishga rozilik berdingiz. To‘xtatish uchun /stop yuboring.`);
  else await sendTelegramMessage(chatId,"Ulanish kodi noto‘g‘ri yoki muddati tugagan. Do‘kondan yangi havola oling.");
 }else if(text==="/stop"){
  await pool.query("UPDATE customers SET telegram_opt_in=false WHERE telegram_chat_id=$1",[chatId]);
  await sendTelegramMessage(chatId,"Eslatmalar to‘xtatildi. Qayta ulash uchun do‘kondan yangi havola oling.");
 }else if(text==="/help"){
  await sendTelegramMessage(chatId,"NasiyaPro eslatma boti. /stop — eslatmalarni to‘xtatish.");
 }
}
module.exports={sendTelegramMessage,handleTelegramUpdate};
