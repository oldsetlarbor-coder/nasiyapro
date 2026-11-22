const {pool}=require("./db");
const {sendTelegramMessage}=require("./telegram");
async function sendDueReminders(){
 const r=await pool.query(`SELECT d.id,d.remaining_amount,d.due_date,d.description,c.name,c.telegram_chat_id,s.name shop_name
 FROM debts d JOIN customers c ON c.id=d.customer_id JOIN shops s ON s.id=d.shop_id
 WHERE d.status='open' AND d.reminder_enabled=true AND c.telegram_opt_in=true
 AND c.telegram_chat_id IS NOT NULL AND d.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE+2
 AND NOT EXISTS(SELECT 1 FROM reminder_logs l WHERE l.debt_id=d.id AND l.reminder_date=CURRENT_DATE)`);
 for(const d of r.rows){
  const date=new Date(d.due_date).toLocaleDateString("uz-UZ");
  const msg=`Assalomu alaykum, ${d.name}! ${d.shop_name} do‘konidagi qarzingiz bo‘yicha eslatma. Qolgan summa: ${Number(d.remaining_amount).toLocaleString("uz-UZ")} so‘m. To‘lov muddati: ${date}. Savollar bo‘lsa do‘kon bilan bog‘laning.`;
  const ok=await sendTelegramMessage(d.telegram_chat_id,msg);
  if(ok) await pool.query("INSERT INTO reminder_logs(debt_id,reminder_date,channel) VALUES($1,CURRENT_DATE,'telegram') ON CONFLICT DO NOTHING",[d.id]);
 }
}
module.exports={sendDueReminders};
