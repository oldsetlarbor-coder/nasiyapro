require("dotenv").config();
const fs=require("fs");const path=require("path");const {pool}=require("../src/db");
(async()=>{try{const sql=fs.readFileSync(path.join(__dirname,"../database/schema.sql"),"utf8");await pool.query(sql);console.log("Database schema ready.");}catch(e){console.error(e);process.exitCode=1;}finally{await pool.end();}})();
