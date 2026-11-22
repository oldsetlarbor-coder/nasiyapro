CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS shops(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name TEXT NOT NULL, owner_name TEXT NOT NULL, phone TEXT,
 is_active BOOLEAN NOT NULL DEFAULT true,
 subscription_status TEXT NOT NULL DEFAULT 'trial' CHECK(subscription_status IN('trial','active','expired','suspended')),
 subscription_plan TEXT,
 trial_ends_at TIMESTAMPTZ,
 subscription_ends_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS users(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN('admin','shop')),
 shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
 is_active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK((role='admin' AND shop_id IS NULL) OR (role='shop' AND shop_id IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS customers(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 name TEXT NOT NULL, phone TEXT NOT NULL, note TEXT,
 telegram_chat_id TEXT, telegram_opt_in BOOLEAN NOT NULL DEFAULT false,
 telegram_link_code TEXT, telegram_link_expires TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(shop_id,phone)
);
CREATE TABLE IF NOT EXISTS debts(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
 amount NUMERIC(14,2) NOT NULL CHECK(amount>0),
 remaining_amount NUMERIC(14,2) NOT NULL CHECK(remaining_amount>=0),
 due_date DATE NOT NULL, description TEXT,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN('open','paid','void')),
 reminder_enabled BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS payments(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
 amount NUMERIC(14,2) NOT NULL CHECK(amount>0),
 note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS subscription_payments(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 plan_code TEXT NOT NULL CHECK(plan_code IN('start','business','premium')),
 amount NUMERIC(12,2) NOT NULL,
 reference TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')),
 review_note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), reviewed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS plans(
 code TEXT PRIMARY KEY, name TEXT NOT NULL, price NUMERIC(12,2) NOT NULL,
 customer_limit INTEGER, features JSONB NOT NULL DEFAULT '[]'::jsonb, is_active BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO plans(code,name,price,customer_limit,features) VALUES
('start','START',29000,100,'["Qarzlar","Mijozlar","Telegram eslatmalari"]'),
('business','BUSINESS',59000,NULL,'["Cheklanmagan mijoz","Hisobotlar","Telegram eslatmalari","Qisman to‘lov"]'),
('premium','PREMIUM',99000,NULL,'["Bir nechta filial","Xodimlar","Kengaytirilgan hisobotlar"]')
ON CONFLICT(code) DO NOTHING;
CREATE TABLE IF NOT EXISTS reminder_logs(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
 reminder_date DATE NOT NULL, channel TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(debt_id,reminder_date,channel)
);
CREATE INDEX IF NOT EXISTS idx_customers_shop ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_debts_shop_due ON debts(shop_id,due_date,status);
CREATE INDEX IF NOT EXISTS idx_payments_shop ON payments(shop_id,created_at);
