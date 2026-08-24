// ===========================================================
// js/admin-leads-automation.js — CRM automation (Phase 3): auto-assign ลีดใหม่แบบ round-robin
// ให้ทีมขายที่ active เท่านั้น (currentTeamMembers จาก admin-settings-team.js)
//
// ไฟล์นี้ไม่ export อะไรให้ไฟล์อื่นเรียกใช้ (เหมือน admin-overview-today.js/
// admin-global-search.js/admin-keyboard-shortcuts.js) — ผูก listener ของตัวเองผ่าน
// onNewLeadsArrived() (export จาก admin-leads.js) ตอนโหลดไฟล์นี้ครั้งแรก ต้อง import แบบ
// side-effect ใน admin-page.js (เพิ่มไว้แล้ว)
//
// ที่มาของ "ลีดใหม่จริงๆ": admin-leads.js เทียบ id ของลีดทุก snapshot กับ id ที่เคยเห็นแล้ว
// เอง (ข้าม snapshot แรกสุดตอนเปิดหน้า กันไล่มอบหมายลีดเก่าทั้งหมดทันทีที่เปิดหน้า) แล้วเรียก
// callback นี้ — ไม่มีการ query/listen Firestore ซ้ำเพิ่มในไฟล์นี้เลย
//
// state "รอบล่าสุดที่ assign ไปคนไหน" เก็บเป็น settings.leadAssignRoundRobinIndex ใน
// settings/main doc เดิม (ตัดสินใจร่วมกับผู้ใช้แล้ว ไม่แยก Firestore doc ใหม่) — อ่าน/เขียนผ่าน
// leadAssignRoundRobinIndex + setLeadAssignRoundRobinIndex() ที่ export จาก
// admin-settings-team.js
//
// ⚠️ ข้อจำกัดสำคัญที่ต้องรู้ก่อนใช้งานจริง: โปรเจกต์นี้ไม่มี Cloud Functions/backend ใดๆ
// (ดูหัวไฟล์ js/email-notify.js — ออกแบบให้ทำงานฝั่ง browser ล้วนๆ ตั้งแต่ต้น) auto-assign นี้
// จึงทำงาน "เฉพาะตอนที่มีแอดมินเปิดหน้า admin.html ค้างอยู่" เท่านั้น (ผ่าน onSnapshot แบบ
// real-time) ถ้าลีดเข้ามาตอนไม่มีใครเปิดหน้าแอดมินเลย จะไม่ถูก auto-assign — ลีดนั้นจะกลาย
// เป็นส่วนหนึ่งของ "snapshot แรก" ตอนมีคนเปิดหน้าครั้งถัดไป ซึ่งตามที่ตั้งใจไว้จะไม่ auto-assign
// ย้อนหลังให้ (กันไล่มอบหมายลีดเก่าทั้งหมดพร้อมกัน) ต้องมอบหมายมือให้ลีดเหล่านั้นแทน — ถ้าต้องการ
// auto-assign ที่ทำงานได้แม้ไม่มีแอดมินเปิดหน้าอยู่ ต้องมี Cloud Function แยกต่างหาก (นอกขอบเขต
// โจทย์นี้ และนอกขอบเขต stack ปัจจุบันของโปรเจกต์)
// ===========================================================
import { logAudit } from "./db.js";
import { updateLeadAssignee } from "./db-orders.js";
import { onNewLeadsArrived } from "./admin-leads.js";
import { currentTeamMembers, leadAssignRoundRobinIndex, setLeadAssignRoundRobinIndex } from "./admin-settings-team.js";

async function autoAssignLead(lead) {
  if (!currentTeamMembers.length) {
    console.warn("[admin-leads-automation] ไม่มีทีมขาย active เลย — ข้ามการ auto-assign ลีด", lead.id);
    return;
  }
  const nextIndex = (leadAssignRoundRobinIndex + 1) % currentTeamMembers.length;
  const assignee = currentTeamMembers[nextIndex];
  try {
    await updateLeadAssignee(lead.id, assignee);
    await setLeadAssignRoundRobinIndex(nextIndex); // เขียนตัวชี้ลง settings/main ก่อนไปคิวถัดไป
    logAudit("update", "lead-auto-assign", lead.id, `มอบหมายอัตโนมัติ (round-robin) ให้ "${assignee}"`);
  } catch (err) {
    console.error("[admin-leads-automation] auto-assign ลีดไม่สำเร็จ", lead.id, err);
  }
}

// มอบหมายทีละรายการ "ตามลำดับ" (ไม่ใช่ Promise.all พร้อมกันทั้งหมด) เพื่อกัน race condition
// ของ leadAssignRoundRobinIndex กรณีมีลีดใหม่เข้ามาพร้อมกันหลายรายการในรอบเดียว — ต้องรอให้
// ตัวชี้อัปเดตเสร็จก่อนค่อยคำนวณคนถัดไป ไม่งั้นลีดหลายใบอาจถูก assign ให้คนเดิมซ้ำ
function handleNewLeads(newLeads) {
  newLeads.reduce((chain, lead) => chain.then(() => {
    if (lead.assignee) return; // กันไว้เผื่อลีดมีผู้รับผิดชอบอยู่แล้ว (ไม่ควรเกิดกับลีดใหม่ปกติ)
    return autoAssignLead(lead);
  }), Promise.resolve());
}

onNewLeadsArrived(handleNewLeads);
