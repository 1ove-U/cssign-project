// ===========================
// js/db-orders-stats.js — สถิติ/เทรนด์คำนวณล้วนๆ (pure functions) แยกจาก js/db-orders.js
// ===========================
// 2026 refactor (รอบที่ 32): แยกออกมาจาก js/db-orders.js เดิม (672 บรรทัด) — ส่วน "สถิติ"
// ทั้งหมด (daysUntilDue/orderUrgency/orderGrandTotal/orderBalance/computeOrderStats/
// computeLeadStats) ไม่มีการเรียก Firestore เลยสักจุดเดียว (ไม่มี import { db }) รับแค่
// orders[]/leads[] ที่ดึงมาแล้วจาก listenOrders()/listenLeads() (ใน js/db-orders.js) เข้ามา
// คำนวณแล้วคืนค่ากลับตรงๆ — เป็นจุดตัดทิศทางเดียวชัดเจน (ไม่มี state ข้ามไฟล์เหมือน QC/
// ประวัติแก้ไขที่แยกไปตั้งแต่รอบ 31) ไม่มีการเปลี่ยน logic ใดๆ จากของเดิม เป็นแค่ย้ายโค้ด
// เชิงโครงสร้าง (ดู diff เทียบกับ js/db-orders.js ฉบับก่อนแตกไฟล์รอบนี้)
//
// ทุกไฟล์ที่เคย import ฟังก์ชันกลุ่มนี้จาก "./db-orders.js" ถูกแก้ให้ import จาก
// "./db-orders-stats.js" นี้แทนโดยตรงแล้วทุกจุด (ตามแพทเทิร์นเดียวกับตอนแยก js/db.js →
// js/db-orders.js เดิม — ไม่ทำ re-export chain ผ่าน db-orders.js)
// ===========================
import { bucketMonthly, monthlyTopCategory, computeRepeatCustomerRate,
         linearForecast }                          from "./stats-trends.js";

// แปลง dueDate ("YYYY-MM-DD") เป็นจำนวนวันที่เหลือ (ลบได้ = เกินกำหนด), null ถ้าไม่มีวันกำหนดส่ง
export function daysUntilDue(order) {
  if (!order || !order.dueDate) return null;
  const due = new Date(order.dueDate + "T23:59:59");
  if (isNaN(due.getTime())) return null;
  const now = new Date();
  return Math.ceil((due.getTime() - now.getTime()) / 86400000);
}

// สถานะความเร่งด่วนของคำสั่งผลิตที่ยังไม่จบงาน (ใช้ไฮไลต์ในตาราง/การ์ด/แจ้งเตือน)
export function orderUrgency(order) {
  if (!order || order.status === "completed" || order.status === "cancelled") return null;
  const d = daysUntilDue(order);
  if (d === null) return null;
  if (d < 0) return "overdue";
  if (d <= 2) return "due-soon";
  return null;
}

// จัดกลุ่มคำสั่งผลิตที่ยังไม่เสร็จ (ไม่รวม completed/cancelled — เหมือนเกณฑ์ active ใน
// computeOrderStats ด้านล่าง) ตามวันที่กำหนดส่ง (dueDate) — คืนค่าเป็น
// Map<"YYYY-MM-DD", Order[]> ใช้สำหรับมุมมองปฏิทินนัดติดตั้ง/ส่งมอบ (P1.5 data layer)
// คำสั่งผลิตที่ไม่มี dueDate เลยจะไม่ปรากฏในผลลัพธ์ (ไม่มีวันให้จัดกลุ่ม) — ไม่ sort รายการ
// ภายในแต่ละวันที่ ผู้เรียกใช้ (UI layer) จัดเรียงเองได้ตามต้องการ (เช่น ตามเวลาสร้าง)
export function ordersByDueDate(orders) {
  const map = new Map();
  (orders || []).forEach(o => {
    if (!o || !o.dueDate) return;
    if (o.status === "completed" || o.status === "cancelled") return;
    if (!map.has(o.dueDate)) map.set(o.dueDate, []);
    map.get(o.dueDate).push(o);
  });
  return map;
}

// ยอดรวมของคำสั่งผลิต 1 รายการ (สินค้า - ส่วนลด [+VAT ถ้ายังไม่รวม] + ค่าขนส่ง)
// ใช้ทั้งในสถิติภาพรวมและหมวด "การเงิน" ของป๊อปอัพ — คำนวณจุดเดียว กันเลขไม่ตรงกันระหว่างที่ต่างๆ
export function orderGrandTotal(o) {
  const base = Math.max(0, (Number(o.unit_price) || 0) * (Number(o.qty) || 0) - (Number(o.discount) || 0));
  const withVat = o.vatIncluded ? base : base * 1.07;
  return Math.round((withVat + (Number(o.shippingCost) || 0)) * 100) / 100;
}

// ยอดคงเหลือที่ยังไม่ได้ชำระ (ยอดรวม - มัดจำที่รับแล้ว) — "ชำระครบแล้ว" ถือว่าไม่มียอดค้าง
// แม้ตัวเลขในระบบจะยังไม่ตรงเป๊ะ (กันแสดงยอดค้างผิดๆ ถ้าแอดมินลืมกรอก deposit ให้ครบ)
export function orderBalance(o) {
  if (o.paymentStatus === "paid_full") return 0;
  return Math.max(0, Math.round((orderGrandTotal(o) - (Number(o.deposit) || 0)) * 100) / 100);
}

// คำนวณสถิติสำหรับ Production Console จาก orders ที่ได้จาก listenOrders/getOrders
export function computeOrderStats(orders) {
  const active = orders.filter(o => o.status !== "completed" && o.status !== "cancelled");

  // ยอดค้างชำระรวม — เฉพาะงานที่ยังไม่ถูกยกเลิก (งานที่ยกเลิกไม่ควรนับเป็นยอดค้างชำระจริง)
  const totalBalance = orders
    .filter(o => o.status !== "cancelled")
    .reduce((sum, o) => sum + orderBalance(o), 0);

  // นับตามสถานะ สำหรับการ์ด "จำนวนงานใหม่ / งานที่กำลังผลิต / งานที่เสร็จแล้ว"
  // หมายเหตุ: เดิมสถานะ "shipping" (จัดส่ง) ไม่ถูกนับในกลุ่มไหนเลย ทำให้คำสั่งผลิตที่อยู่ระหว่าง
  // จัดส่งหายไปจากการ์ดสรุปทั้งหมด (newCount/inProductionCount/completedCount รวมกันไม่เท่ากับ
  // จำนวนงานที่ยังไม่เสร็จ/ไม่ยกเลิกจริง) — แก้โดยนับ "shipping" รวมอยู่ในงานที่กำลังผลิต/ดำเนินการอยู่
  const newCount          = orders.filter(o => o.status === "received").length;
  const inProductionCount = orders.filter(o =>
    o.status === "design" || o.status === "approval" || o.status === "production" ||
    o.status === "qc" || o.status === "packing" || o.status === "shipping"
  ).length;
  const completedCount    = orders.filter(o => o.status === "completed").length;

  // ยอดขายวันนี้ / เดือนนี้ — คำนวณจาก qty × ราคาสินค้าที่ผูกกับคำสั่งผลิต (unit_price)
  // เฉพาะคำสั่งผลิตที่ไม่ถูกยกเลิก; คำสั่งที่ไม่ได้ผูกกับสินค้าในแคตตาล็อกจะมี unit_price = 0
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const orderMillis = (o) => o.createdAt ? (o.createdAt.toMillis ? o.createdAt.toMillis() : o.createdAt) : null;
  const orderAmount = (o) => (Number(o.unit_price) || 0) * (Number(o.qty) || 0);
  let salesToday = 0, salesMonth = 0;
  orders.forEach(o => {
    if (o.status === "cancelled") return;
    const t = orderMillis(o);
    if (t == null) return;
    const amount = orderAmount(o);
    if (t >= monthStart) salesMonth += amount;
    if (t >= todayStart) salesToday += amount;
  });

  const completedWithDates = orders.filter(o => o.status === "completed" && o.completedAt && o.createdAt);
  let avgDays = null;
  if (completedWithDates.length) {
    const totalMs = completedWithDates.reduce((sum, o) => {
      const created = o.createdAt.toMillis ? o.createdAt.toMillis() : o.createdAt;
      const completed = o.completedAt.toMillis ? o.completedAt.toMillis() : o.completedAt;
      return sum + Math.max(0, completed - created);
    }, 0);
    avgDays = Math.round((totalMs / completedWithDates.length) / 86400000 * 10) / 10;
  }

  // นับคำสั่งผลิตใหม่ของแต่ละวันใน 7 วันล่าสุด (สำหรับ bar chart)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push(d.getTime());
  }
  const weekly = days.map(dayStart => {
    const dayEnd = dayStart + 86400000;
    return orders.filter(o => {
      if (!o.createdAt) return false;
      const t = o.createdAt.toMillis ? o.createdAt.toMillis() : o.createdAt;
      return t >= dayStart && t < dayEnd;
    }).length;
  });
  const weekMax = Math.max(1, ...weekly);

  // เทรนด์ 30 วันล่าสุด (สำหรับกราฟเส้น)
  const days30 = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days30.push(d.getTime());
  }
  const trend30 = days30.map(dayStart => {
    const dayEnd = dayStart + 86400000;
    return orders.filter(o => {
      if (!o.createdAt) return false;
      const t = o.createdAt.toMillis ? o.createdAt.toMillis() : o.createdAt;
      return t >= dayStart && t < dayEnd;
    }).length;
  });

  // ยอดขาย (รายได้) รายวัน 7/30 วันล่าสุด — คู่ขนานกับ weekly/trend30 ที่นับ "จำนวนงาน"
  // แยกกราฟนี้ออกมาต่างหาก เพราะจำนวนงานมากไม่ได้แปลว่ารายได้สูง (งานเล็ก-ใหญ่ราคาต่างกัน)
  // ไม่นับคำสั่งผลิตที่ถูกยกเลิก เหมือนกับ salesToday/salesMonth ด้านบน
  const revenueWeekly = days.map(dayStart => {
    const dayEnd = dayStart + 86400000;
    return orders.filter(o => {
      if (o.status === "cancelled" || !o.createdAt) return false;
      const t = o.createdAt.toMillis ? o.createdAt.toMillis() : o.createdAt;
      return t >= dayStart && t < dayEnd;
    }).reduce((sum, o) => sum + orderAmount(o), 0);
  });
  const revenueTrend30 = days30.map(dayStart => {
    const dayEnd = dayStart + 86400000;
    return orders.filter(o => {
      if (o.status === "cancelled" || !o.createdAt) return false;
      const t = o.createdAt.toMillis ? o.createdAt.toMillis() : o.createdAt;
      return t >= dayStart && t < dayEnd;
    }).reduce((sum, o) => sum + orderAmount(o), 0);
  });

  // เทียบยอดขาย "เดือนนี้ vs เดือนก่อน" แบบเห็นตัวเลขทั้งคู่ชัดๆ ไม่ใช่แค่ % เดียวลอยๆ
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const prevMonthEnd   = monthStart; // เดือนนี้เริ่มตรงไหน เดือนก่อนหน้าจบตรงนั้นพอดี
  let salesPrevMonth = 0;
  orders.forEach(o => {
    if (o.status === "cancelled") return;
    const t = orderMillis(o);
    if (t == null || t < prevMonthStart || t >= prevMonthEnd) return;
    salesPrevMonth += orderAmount(o);
  });
  const monthCompare = {
    thisMonth: salesMonth,
    prevMonth: salesPrevMonth,
    pct: salesPrevMonth === 0
      ? (salesMonth === 0 ? 0 : 100)
      : Math.round(((salesMonth - salesPrevMonth) / salesPrevMonth) * 100)
  };

  // ใกล้ครบกำหนด (0-2 วัน) / เกินกำหนด — เฉพาะงานที่ยังไม่จบ
  const dueSoon = active.filter(o => orderUrgency(o) === "due-soon");
  const overdue = active.filter(o => orderUrgency(o) === "overdue");

  // แยกตามหมวดป้าย
  const catMap = new Map();
  orders.forEach(o => {
    const key = o.category || "ไม่ระบุหมวด";
    catMap.set(key, (catMap.get(key) || 0) + 1);
  });
  const byCategory = [...catMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // ลูกค้าที่มีคำสั่งผลิตมากที่สุด (top 5)
  const custMap = new Map();
  orders.forEach(o => {
    const key = o.customer || "ไม่ระบุลูกค้า";
    custMap.set(key, (custMap.get(key) || 0) + 1);
  });
  const topCustomers = [...custMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // สินค้าขายดี (top 5) — จัดกลุ่มตามชื่อสินค้า (o.item เป็น text ที่ผูกไว้ตอนสร้างคำสั่งผลิต
  // ไม่ใช้ product_id เป็น key หลักเพราะคำสั่งผลิตเก่า/ที่พิมพ์เองบางรายการไม่มี product_id)
  // นับ "จำนวนที่สั่งรวม" (qty รวมทุกคำสั่งผลิต) และ "รายได้รวม" คู่กัน ไม่รวมงานที่ถูกยกเลิก
  const productMap = new Map();
  orders.forEach(o => {
    if (o.status === "cancelled") return;
    const key = (o.item || "").trim();
    if (!key) return;
    const cur = productMap.get(key) || { name: key, qty: 0, revenue: 0, orderCount: 0 };
    cur.qty += Number(o.qty) || 0;
    cur.revenue += orderAmount(o);
    cur.orderCount += 1;
    productMap.set(key, cur);
  });
  const topProducts = [...productMap.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // ── เทรนด์รายเดือนจากข้อมูลจริง (แทนที่ % เทียบเดือนก่อน + sparkline ที่เคยพึ่ง
  //    snapshot ใน localStorage) — ใช้ตรรกะเดียวกับ trend30/revenueTrend30 ด้านบน
  //    เพียงแต่รวมเป็นรายเดือนแทนรายวัน เพื่อดูภาพยาวขึ้น (6 เดือนล่าสุด) ──
  const MONTHS = 6;
  const monthlyCreated = bucketMonthly(orders, o => o.createdAt, MONTHS,
    arr => arr.filter(o => o.status !== "cancelled").length);
  const monthlyCompleted = bucketMonthly(orders, o => o.completedAt, MONTHS,
    arr => arr.length);
  const monthlyRevenue = bucketMonthly(orders, o => o.createdAt, MONTHS,
    arr => arr.filter(o => o.status !== "cancelled").reduce((s, o) => s + orderAmount(o), 0));
  // เวลาเฉลี่ยรับงาน→เสร็จงาน (avgDays) รายเดือน จัดกลุ่มตามเดือนที่ "เสร็จงานจริง" (completedAt)
  // เพื่อดูว่าความเร็วในการผลิตดีขึ้น/แย่ลงเดือนไหน (คู่ขนานกับ avgDays รวมด้านบน)
  const monthlyAvgDays = bucketMonthly(orders, o => o.completedAt, MONTHS, arr => {
    const withDates = arr.filter(o => o.createdAt);
    if (!withDates.length) return null;
    const totalMs = withDates.reduce((sum, o) => {
      const created = o.createdAt.toMillis ? o.createdAt.toMillis() : o.createdAt;
      const completed = o.completedAt.toMillis ? o.completedAt.toMillis() : o.completedAt;
      return sum + Math.max(0, completed - created);
    }, 0);
    return Math.round((totalMs / withDates.length) / 86400000 * 10) / 10;
  });
  // อัตราส่งงานตรงเวลารายเดือน (completedAt <= dueDate) — บอกว่าคุณภาพการควบคุมกำหนดส่ง
  // ดีขึ้น/แย่ลงเดือนไหน คำนวณจาก dueDate/completedAt จริง ไม่ใช่แค่ snapshot จำนวนงานค้าง ณ ตอนนี้
  const monthlyOnTimeRate = bucketMonthly(orders, o => o.completedAt, MONTHS, arr => {
    const withDue = arr.filter(o => o.dueDate);
    if (!withDue.length) return null;
    const onTime = withDue.filter(o => {
      const completed = o.completedAt.toMillis ? o.completedAt.toMillis() : o.completedAt;
      const due = new Date(o.dueDate + "T23:59:59").getTime();
      return !isNaN(due) && completed <= due;
    }).length;
    return Math.round((onTime / withDue.length) * 100);
  });

  const revenueForecast = linearForecast(monthlyRevenue.map(m => m.value), 3);

  return {
    activeCount: active.length,
    totalBalance,
    avgDays,
    weekly: weekly.map(n => Math.round((n / weekMax) * 100)),
    trend30,
    revenueWeekly,
    revenueTrend30,
    monthCompare,
    dueSoonCount: dueSoon.length,
    overdueCount: overdue.length,
    dueSoonOrders: dueSoon,
    overdueOrders: overdue,
    byCategory,
    topCustomers,
    topProducts,
    newCount,
    inProductionCount,
    completedCount,
    salesToday,
    salesMonth,
    // ── ข้อมูลใหม่: เทรนด์จากข้อมูลจริง + คาดการณ์อย่างง่าย ──
    monthly: {
      labels: monthlyCreated.map(m => m.label),
      created: monthlyCreated.map(m => m.value),
      completed: monthlyCompleted.map(m => m.value),
      revenue: monthlyRevenue.map(m => m.value),
      avgDays: monthlyAvgDays.map(m => m.value),
      onTimeRate: monthlyOnTimeRate.map(m => m.value)
    },
    topCategoryMonthly: monthlyTopCategory(orders, MONTHS),
    repeatCustomerRate: computeRepeatCustomerRate(orders),
    revenueForecast // { slope, intercept, predicted: [เดือนถัดไป 3 เดือน] } — ดูคำเตือนการใช้งานที่ js/stats-trends.js
  };
}

// สถิติ/เทรนด์ของลีดสำหรับแดชบอร์ด — คำนวณจาก createdAt/status/wonAt จริงของลีดทั้งหมด
// (จาก listenLeads) แทน snapshot ใน localStorage เดิม เรียกคู่กับ computeOrderStats
export function computeLeadStats(leads) {
  const MONTHS = 6;
  // ปริมาณลีดใหม่ต่อเดือน (cohort ตาม createdAt) — ใช้แทน "ลีดใหม่" สะสมที่เคยพึ่ง snapshot
  const monthlyNew = bucketMonthly(leads, l => l.createdAt, MONTHS, arr => arr.length);
  // อัตราปิดการขายต่อเดือน นับจากลีดที่ "สร้างในเดือนนั้น" และปิดจบแล้ว (won/lost) ณ ตอนนี้
  // หมายเหตุ: เป็นค่าประมาณแบบ cohort — ลีดบางรายการของเดือนล่าสุดอาจยังไม่ปิดจบ ทำให้
  // อัตราของเดือนล่าสุดอาจดูต่ำกว่าความจริงและขยับขึ้นได้อีกเมื่อเวลาผ่านไป ต่างจากเดือนเก่าๆ
  // ที่ปิดจบไปหมดแล้วซึ่งจะค่อนข้างนิ่ง
  const monthlyConversion = bucketMonthly(leads, l => l.createdAt, MONTHS, arr => {
    const won = arr.filter(l => l.status === "won").length;
    const lost = arr.filter(l => l.status === "lost").length;
    const closed = won + lost;
    return closed ? Math.round((won / closed) * 100) : null;
  });
  // ระยะเวลาปิดการขาย (Lead → Won) รายเดือน จัดกลุ่มตามเดือนที่ "ปิดสำเร็จจริง" (wonAt)
  // ใช้ได้เฉพาะลีดที่ปิดหลังจากอัปเดตนี้ (มี wonAt) — ลีด won เก่าก่อนหน้านี้ไม่มี wonAt
  // ย้อนหลัง จะถูกข้ามไปโดยอัตโนมัติ ไม่ทำให้ค่าเฉลี่ยเพี้ยน (ดูหมายเหตุที่ updateLeadStatus)
  const monthlyCloseTime = bucketMonthly(leads, l => l.wonAt, MONTHS, arr => {
    const withDates = arr.filter(l => l.createdAt && l.wonAt);
    if (!withDates.length) return null;
    const totalMs = withDates.reduce((sum, l) => {
      const created = l.createdAt.toMillis ? l.createdAt.toMillis() : l.createdAt;
      const won = l.wonAt.toMillis ? l.wonAt.toMillis() : l.wonAt;
      return sum + Math.max(0, won - created);
    }, 0);
    return Math.round((totalMs / withDates.length) / 86400000 * 10) / 10;
  });
  const hasAnyCloseTimeData = monthlyCloseTime.some(m => m.value != null);

  const leadVolumeForecast = linearForecast(monthlyNew.map(m => m.value), 3);

  return {
    monthly: {
      labels: monthlyNew.map(m => m.label),
      newLeads: monthlyNew.map(m => m.value),
      conversionRate: monthlyConversion.map(m => m.value),
      closeTimeDays: monthlyCloseTime.map(m => m.value)
    },
    hasCloseTimeData: hasAnyCloseTimeData,
    leadVolumeForecast
  };
}
