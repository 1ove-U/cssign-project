-- ==========================================
-- supabase_schema.sql
-- รัน SQL นี้ใน Supabase > SQL Editor
-- ==========================================

-- 1. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏷️',
  description TEXT DEFAULT ''
);

-- 2. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
  id       SERIAL PRIMARY KEY,
  cat_id   INTEGER REFERENCES categories(id),
  name     TEXT NOT NULL,
  price    NUMERIC DEFAULT 0,
  unit     TEXT DEFAULT 'ชิ้น',
  description     TEXT DEFAULT '',
  status   TEXT DEFAULT 'available' CHECK (status IN ('available','preorder','out')),
  featured BOOLEAN DEFAULT FALSE,
  images   TEXT DEFAULT '[]'   -- JSON array of URLs
);

-- 3. SETTINGS TABLE (single row)
CREATE TABLE IF NOT EXISTS settings (
  id        SERIAL PRIMARY KEY,
  shop_name TEXT DEFAULT 'ป้ายพาณิชย์',
  phone     TEXT DEFAULT '081-234-5678',
  line_id   TEXT DEFAULT 'paisign',
  address   TEXT DEFAULT '123 ถนนพหลโยธิน กรุงเทพฯ',
  hero_text TEXT DEFAULT 'ป้ายคุณภาพสูง ได้มาตรฐาน พร้อมบริการติดตั้งและให้คำปรึกษา'
);

-- Insert default settings row
INSERT INTO settings (shop_name) VALUES ('ป้ายพาณิชย์')
ON CONFLICT DO NOTHING;

-- 4. ROW LEVEL SECURITY (RLS)
-- เปิด RLS ทุกตาราง
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings    ENABLE ROW LEVEL SECURITY;

-- Public read (ทุกคนอ่านได้)
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public read products"   ON products   FOR SELECT USING (true);
CREATE POLICY "Public read settings"   ON settings   FOR SELECT USING (true);

-- Anon write (anon key เขียนได้ — เหมาะสำหรับ MVP ที่ยังไม่มี login)
-- ⚠️ หากต้องการ login-protected admin ให้ลบ policy นี้ แล้วใช้ authenticated role แทน
CREATE POLICY "Anon write categories" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon write products"   ON products   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon write settings"   ON settings   FOR ALL USING (true) WITH CHECK (true);

-- 5. STORAGE BUCKET — Product Images
-- ทำใน Supabase Dashboard > Storage > New Bucket
-- Name: product-images
-- Public: ✅ เปิด
-- ถ้าต้องการทำด้วย SQL:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Storage policy (อนุญาตให้ anon อัปโหลด)
-- CREATE POLICY "Allow anon uploads" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'product-images');
-- CREATE POLICY "Allow public read" ON storage.objects
--   FOR SELECT USING (bucket_id = 'product-images');
