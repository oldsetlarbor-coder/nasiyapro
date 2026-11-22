# NasiyaPro

NasiyaPro — do‘konlar uchun multi-tenant nasiya/qarz boshqaruv SaaS loyihasi.

## Talablar
- Node.js 20+
- PostgreSQL 14+
- Telegram bot tokeni (ixtiyoriy, eslatmalar uchun)

## Lokal ishga tushirish (Windows 11)
1. Node.js LTS va PostgreSQL o‘rnating.
2. Ushbu papkani VS Code'da oching.
3. Terminalda:
   ```bash
   npm install
   ```
4. `.env.example` faylidan `.env` nusxa yarating va `DATABASE_URL`, `JWT_SECRET`, admin ma'lumotlarini kiriting.
5. PostgreSQL'da `nasiyapro` nomli database yarating.
6. Jadval va boshlang‘ich tariflarni yarating:
   ```bash
   npm run db:init
   ```
7. Super Admin yarating:
   ```bash
   node scripts/create-admin.js
   ```
8. Serverni ishga tushiring:
   ```bash
   npm run dev
   ```
9. Brauzerda `http://localhost:3000` ni oching.

## Telegram bot sozlash
1. Telegram'da @BotFather orqali bot yarating.
2. Bot tokenini `.env` dagi `TELEGRAM_BOT_TOKEN` ga yozing.
3. `.env` dagi `TELEGRAM_WEBHOOK_SECRET` ni uzun tasodifiy qiymatga almashtiring.
4. Saytni HTTPS domen va hostingga joylashtirgach webhook o‘rnating:
   ```bash
   curl -X POST "https://api.telegram.org/botYOUR_TOKEN/setWebhook" \
     -d "url=https://YOUR_DOMAIN/api/telegram/webhook/YOUR_WEBHOOK_SECRET"
   ```
5. `.env` ichida `TELEGRAM_BOT_USERNAME=your_bot_username` qiymatini kiriting ( @ belgisiz ). Mijozlar bo‘limidagi “Havola yaratish” tugmasi orqali mijozga shaxsiy ulanish havolasini yarating.
6. Do‘kon mijozlar bo‘limida “Havola yaratish” tugmasi mavjud. API endpoint: `POST /api/shop/telegram/link-code` body: `{ "customerId": "..." }`. Mijoz havolani ochib `/start` bosishi kerak.

## Muhim eslatma
- Telegram bot mijozga birinchi bo‘lib yoza olmaydi. Mijoz botni o‘zi ishga tushirishi va eslatmalarga rozilik berishi kerak.
- Eslatma vazifasi har kuni 09:00 Asia/Tashkent vaqtida ishlaydi. Hozirgi MVP 0–2 kun ichida to‘lov muddati keladigan qarzlar uchun kuniga bitta Telegram eslatma yuboradi.
- Hozir obuna to‘lovi admin tomonidan qo‘lda tasdiqlanadi. Karta raqami `.env` dagi qiymatlardan olinadi. To‘lovni bank hisobidan mustaqil tekshirmasdan tasdiqlamang.
- Click/Payme avtomatik to‘lov integratsiyasi merchant shartnomasi va provayderning rasmiy API/webhooklari bilan alohida amalga oshiriladi.
- Ushbu MVP ishlab chiqarish muhitiga chiqarishdan oldin mustaqil xavfsizlik auditi, backup, monitoring, HTTPS, email tasdiqlash, parolni tiklash, CSRF/abuse tekshiruvlari va qonunchilikka muvofiqlik tekshiruvini talab qiladi.
- Demo yoki test ma'lumotlaridan foydalaning; haqiqiy mijozlarning shaxsiy ma'lumotlarini test muhitiga joylamang.

## Asosiy API
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/shop/dashboard`
- `GET/POST /api/shop/customers`
- `GET/POST /api/shop/debts`
- `POST /api/shop/debts/:id/payments`
- `GET /api/shop/subscription`, `POST /api/shop/subscription/request`
- `GET /api/admin/overview`, `/shops`, `/payments`
- `POST /api/admin/payments/:id/approve|reject`
- `POST /api/telegram/webhook/:secret`

## Fayl tuzilishi
- `server.js` — Express server
- `src/routes` — API route'lar
- `src/reminders.js` — avtomatik Telegram eslatmalari
- `database/schema.sql` — PostgreSQL sxemasi
- `public` — frontend
- `scripts` — database/admin setup
