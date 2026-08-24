// ===========================================================
// js/stats-trends.js — คำนวณ "แนวโน้ม" ของแดชบอร์ดจากข้อมูลจริงใน Firestore
//
// ทำไมต้องมีไฟล์นี้: เดิมการ์ดสถิติในแดชบอร์ดใช้ monthlySnapshotUpdate()
// (js/ui-helpers.js) ซึ่งเก็บค่าเทียบเดือนไว้ใน localStorage ของเครื่องที่เปิดหน้านี้
// เท่านั้น ทำให้เกิดปัญหา: เปลี่ยนเครื่อง/ล้างแคชแล้วข้อมูลหาย, พนักงานหลายคน
// เห็นเทรนด์ไม่ตรงกัน, และเก็บได้แค่ระดับเดือนที่เปิดแดชบอร์ดจริงเท่านั้น (ถ้าไม่มี
// ใครเปิดหน้านี้เดือนไหนเลย เดือนนั้นจะไม่มีข้อมูล)
//
// ไฟล์นี้แก้ปัญหาโดยคำนวณเทรนด์จาก timestamp จริงที่บันทึกไว้ใน Firestore อยู่แล้ว
// (createdAt / dueDate / completedAt ของคำสั่งผลิต, createdAt / status ของลีด,
// createdAt ของสินค้า/ผลงาน/บทความ/รีวิว ฯลฯ) — คำนวณฝั่งเบราว์เซอร์ล้วนๆ จากข้อมูล
// ที่ listenOrders/listenLeads/getAllOrders ฯลฯ โหลดมาอยู่แล้ว ไม่มีการเรียก API เพิ่ม
// และไม่ผูกกับเครื่องใดเครื่องหนึ่ง เพราะทุกคนคำนวณจากข้อมูลตั้งต้นชุดเดียวกัน
// ===========================================================

/** แปลง timestamp ให้เป็น millis เดียว รองรับทั้ง Firestore Timestamp / number(Date.now()) / undefined */
export function toMillis(v) {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  return null;
}

/** สร้างรายการ "ช่วงเดือน" ย้อนหลัง count เดือน (รวมเดือนปัจจุบันเป็นเดือนสุดท้าย) เรียงเก่า→ใหม่ */
export function monthBuckets(count = 6, now = new Date()) {
  const buckets = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    buckets.push({
      start: start.getTime(),
      end: end.getTime(),
      label: start.toLocaleDateString("th-TH", { month: "short", year: "2-digit" })
    });
  }
  return buckets;
}

/**
 * จำนวนรายการที่ "มีอยู่จริง ณ สิ้นเดือนนั้น" ประมาณจาก createdAt < สิ้นเดือน
 * ใช้แทนสถิติ "จำนวนสะสม" (เช่น จำนวนสินค้า/ผลงาน/บทความทั้งหมด) แทน snapshot ใน
 * localStorage เดิม — หมายเหตุ: เป็นการประมาณโดยสมมติว่าไม่มีการลบรายการออก
 * ถ้ามีการลบ ตัวเลขเดือนเก่าอาจดูสูงกว่าความจริงเล็กน้อย แต่ยังแม่นยำกว่าและสอดคล้อง
 * กันทุกเครื่องมากกว่าการพึ่ง snapshot สุ่มจากเครื่องที่บังเอิญเปิดแดชบอร์ด
 */
export function cumulativeCountHistory(items, dateExtractor, count = 6) {
  const buckets = monthBuckets(count);
  const millis = (items || [])
    .map(it => toMillis(dateExtractor(it)))
    .filter(t => t != null)
    .sort((a, b) => a - b);
  let idx = 0;
  return buckets.map(b => {
    while (idx < millis.length && millis[idx] < b.end) idx++;
    return idx;
  });
}

/** จัดกลุ่มรายการเป็นรายเดือนตาม dateExtractor แล้วลดด้วย reduceFn ต่อเดือน คืนอาเรย์เรียงเก่า→ใหม่ */
export function bucketMonthly(items, dateExtractor, count, reduceFn) {
  const buckets = monthBuckets(count);
  return buckets.map(b => {
    const inBucket = (items || []).filter(it => {
      const t = toMillis(dateExtractor(it));
      return t != null && t >= b.start && t < b.end;
    });
    return { label: b.label, start: b.start, end: b.end, value: reduceFn(inBucket) };
  });
}

/**
 * ทิศทางแนวโน้มจากค่าเฉลี่ยเคลื่อนที่ (moving average) ของ 3 ช่วงล่าสุด เทียบกับ
 * 3 ช่วงก่อนหน้า แทนการเทียบแค่ 2 จุดสุดท้าย — กันการตีความผิดจากช่วงเดียวที่ผิดปกติ
 * (เช่น เดือนที่มีวันหยุดเยอะ ทำให้ยอดตกฮวบเดือนเดียวแต่ไม่ใช่แนวโน้มจริง)
 * threshold = โซนตายที่ถือว่า "ทรงตัว" หน่วย % (ค่าเริ่มต้น 5%)
 * คืนค่า { dir: 'up'|'flat'|'down', icon, label, pct }
 */
export function trendDirection(series, threshold = 5) {
  const vals = (series || []).filter(v => typeof v === "number" && !isNaN(v));
  if (vals.length < 2) {
    return { dir: "flat", icon: "▶️", label: "ข้อมูลไม่พอ", pct: null };
  }
  const win = Math.max(1, Math.min(3, Math.floor(vals.length / 2)));
  const recent = vals.slice(-win);
  const prior  = vals.slice(-win * 2, -win);
  const avg = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
  if (!prior.length) {
    return { dir: "flat", icon: "▶️", label: "ข้อมูลไม่พอ", pct: null };
  }
  const maRecent = avg(recent);
  const maPrior  = avg(prior);
  let pct;
  if (maPrior === 0) pct = maRecent === 0 ? 0 : 100;
  else pct = Math.round(((maRecent - maPrior) / maPrior) * 100);

  if (pct > threshold)  return { dir: "up",   icon: "🔼", label: "เติบโต", pct };
  if (pct < -threshold) return { dir: "down", icon: "🔽", label: "ลดลง",   pct };
  return { dir: "flat", icon: "▶️", label: "ทรงตัว", pct };
}

/**
 * คาดการณ์อย่างง่ายด้วย linear regression (least squares) จากค่าย้อนหลัง (index ตามลำดับเวลา)
 * ไม่ใช้ AI/ML — เป็นการลากเส้นแนวโน้มตรงไปข้างหน้าเท่านั้น จึงเหมาะกับ "ประมาณคร่าวๆ"
 * ไม่ควรใช้ตัดสินใจสำคัญ เพราะข้อมูล SME มักมีปัจจัยฤดูกาล/แคมเปญที่โมเดลง่ายแบบนี้จับไม่ได้
 * คืนค่า { slope, intercept, predicted: number[] } (predicted ปัดเป็นจำนวนเต็ม ไม่ติดลบ)
 */
export function linearForecast(series, aheadCount = 3) {
  const vals = (series || []).filter(v => typeof v === "number" && !isNaN(v));
  const n = vals.length;
  if (n < 2) return { slope: 0, intercept: vals[0] || 0, predicted: [] };
  const meanX = (n - 1) / 2;
  const meanY = vals.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (vals[i] - meanY);
    den += (i - meanX) * (i - meanX);
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  const predicted = [];
  for (let i = 0; i < aheadCount; i++) {
    const x = n + i;
    predicted.push(Math.max(0, Math.round(slope * x + intercept)));
  }
  return { slope, intercept, predicted };
}

/**
 * อัตราลูกค้าซื้อซ้ำ — คำนวณจากชื่อลูกค้าที่ปรากฏซ้ำในคำสั่งผลิต (ไม่สนใจตัวพิมพ์เล็ก/ใหญ่
 * และช่องว่างหัวท้าย) นับเป็น "ลูกค้าซื้อซ้ำ" เมื่อมีคำสั่งผลิต ≥2 รายการขึ้นไป
 * หมายเหตุ: เป็นการประมาณจากชื่อ ไม่ได้ผูกกับ customer_id เฉพาะ จึงอาจนับผิดถ้าลูกค้า
 * สะกดชื่อไม่ตรงกันระหว่างคำสั่งผลิต (เช่น มีเบอร์โทร/บริษัทซ้ำแต่พิมพ์ชื่อคนละแบบ)
 */
export function computeRepeatCustomerRate(orders) {
  const map = new Map();
  (orders || []).forEach(o => {
    const key = (o.customer || "").trim().toLowerCase();
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  const totalCustomers = map.size;
  const repeatCustomers = [...map.values()].filter(c => c > 1).length;
  return {
    totalCustomers,
    repeatCustomers,
    rate: totalCustomers ? Math.round((repeatCustomers / totalCustomers) * 100) : 0
  };
}

/** หมวดป้ายที่ขายดีที่สุดของแต่ละเดือน (ย้อนหลัง count เดือน) จาก createdAt จริง ไม่รวมงานที่ยกเลิก */
export function monthlyTopCategory(orders, count = 6) {
  return bucketMonthly(orders, o => o.createdAt, count, (arr) => {
    const map = new Map();
    arr.forEach(o => {
      if (o.status === "cancelled") return;
      const key = o.category || "ไม่ระบุหมวด";
      map.set(key, (map.get(key) || 0) + 1);
    });
    let name = null, topCount = 0;
    map.forEach((c, k) => { if (c > topCount) { topCount = c; name = k; } });
    return { name, count: topCount };
  });
}
