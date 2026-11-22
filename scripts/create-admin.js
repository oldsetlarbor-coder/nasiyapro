require("dotenv").config();
const bcrypt=require("bcryptjs");const {pool}=require("../src/db");
(async()=>{try{
 const email=process.env.ADMIN_EMAIL,password=process.env.ADMIN_PASSWORD;
 if(!email||!password||password.length<12)throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 chars) in .env");
 const hash=await bcrypt.hash(password,12);
 await pool.query(`INSERT INTO users(email,password_hash,role,shop_id) VALUES(lower($1),$2,'admin',NULL)
 ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,role='admin',is_active=true`,[email,hash]);
 console.log("Admin account created/updated:",email);
}catch(e){console.error(e.message);process.exitCode=1;}finally{await pool.end();}})();
