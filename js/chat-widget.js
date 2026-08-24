/* AI chat widget — shared across index, products, about */
import { buildKnowledgeBlock, SYSTEM_RULES } from "./chat-widget-knowledge.js";

(function () {
  /* ── state ── */
  var history = [];  /* {role, content}[] — ส่งให้ chat proxy Worker ทุกครั้ง */
  var isOpen   = false;
  var isTyping = false;

  /* ── rate limit ฝั่ง client ──
     Gemini free tier จำกัดจำนวน request/วันต่อโปรเจกต์ (ไม่ใช่ต่อคน) และถ้า Gemini
     เกินโควตา Worker จะ fallback ไป Grok ซึ่ง "ฟรี" แค่ช่วง credit รายเดือนที่ xAI ให้
     มา — เกินจากนั้นจะเริ่มมีค่าใช้จ่ายจริงต่อ token ทันที คนแชทถี่ๆ คนเดียวจึงกิน
     โควตารวมของทั้งเว็บได้ไม่ยาก จำกัดไว้ต่อ session (รีเฟรชหน้าคือเริ่มนับใหม่)
     กันเบื้องต้นฝั่ง client ก่อน — ควรมี limit ฝั่ง Worker (server-side) ประกบด้วย
     เพราะ client-side เพียงอย่างเดียวถูก bypass ได้ถ้ามีคนยิง request ตรงไปที่ Worker */
  var MAX_MESSAGES_PER_SESSION = 20;
  var messageCount = 0;

  /* ── quote-intent detection ──
     จับคำที่บ่งชี้ว่าลูกค้าอยากได้ราคา/ใบเสนอราคา แล้วเปิดฟอร์มขอใบเสนอราคา
     (js/lead-quote-modal.js) ให้อัตโนมัติ แทนที่จะหวังพึ่งแค่คำแนะนำที่ AI
     พิมพ์ตอบในแชท ซึ่งลูกค้าอาจไม่กดทำตาม — เปิดครั้งเดียวต่อ session
     เพื่อไม่ให้ป๊อปอัพซ้ำทุกครั้งที่มีคำว่า "ราคา" โผล่มาในบทสนทนา */
  var QUOTE_INTENT_RE = /ใบเสนอราคา|เสนอราคา|ขอราคา|สอบถามราคา|ราคาเท่าไห?ร่?|กี่บาท|เท่าไหร่|เท่าไร|สั่งซื้อ|สั่งผลิต|ขอใบเสนอ|quote|quotation/i;
  var quoteModalOffered = false;

  /* ── elements ── */
  var fab      = document.getElementById('chat-fab');
  var popup    = document.getElementById('chat-popup');
  var closeBtn = document.getElementById('chat-close-btn');
  var msgs     = document.getElementById('chat-messages');
  var input    = document.getElementById('chat-input');
  var sendBtn  = document.getElementById('chat-send-btn');
  var chips    = document.getElementById('chat-chips');
  var badge    = document.getElementById('chat-badge');

  /* kick the fetch off immediately so it's usually already resolved
     by the time the visitor sends their first message; askBot()
     awaits this same cached promise rather than re-fetching per turn */
  var knowledgePromise = buildKnowledgeBlock();

  /* ── helpers ── */
  function nowTime() {
    return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  }

  function scrollBottom() {
    msgs.scrollTop = msgs.scrollHeight;
  }

  function addBubble(text, role) {
    var isBot = role === 'bot';
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble--' + (isBot ? 'bot' : 'user');
    bubble.textContent = text;
    msgs.appendChild(bubble);

    var time = document.createElement('div');
    time.className = 'chat-time chat-time--' + (isBot ? 'bot' : 'user');
    time.textContent = nowTime();
    msgs.appendChild(time);

    scrollBottom();
    return bubble;
  }

  function showTyping() {
    var el = document.createElement('div');
    el.className = 'chat-typing';
    el.id = 'chat-typing-el';
    el.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(el);
    scrollBottom();
  }

  function removeTyping() {
    var el = document.getElementById('chat-typing-el');
    if (el) el.remove();
  }

  /* เปิดฟอร์มขอใบเสนอราคาเดิม (js/lead-quote-modal.js) พร้อม prefill ข้อความ
     ที่ลูกค้าพิมพ์ในแชท และ tag แหล่งที่มาว่า 'chat_widget' เพื่อแยกดูใน
     admin ได้ — ไม่ต้องเขียน saveLead()/ฟอร์มใหม่เลย ใช้ของเดิมทั้งหมด */
  function maybeOfferQuoteModal(userMsg) {
    if (quoteModalOffered) return;
    if (typeof window.openModal !== 'function') return;

    quoteModalOffered = true;
    window.openModal('form', {
      source: 'chat_widget',
      message: 'สนใจสอบถามจากแชท AI: ' + userMsg
    });
  }

  /* ── Cloud proxy endpoint (Cloudflare Worker → Gemini API หลัก, Groq เป็นตัวสำรอง
     ถ้า Gemini ล่ม/โควตาหมด — ทั้งคู่ฟรี ไม่ต้องผูกบัตร) ──
     หมายเหตุ: Groq (groq.com, บริษัททำ inference เร็ว) คนละตัวกับ Grok (xAI/Elon
     Musk) — สลับกันได้ง่ายเพราะออกเสียงเหมือนกัน ยืนยันจาก error จริงที่เจอ
     (2569-07-21): "เรียก groq API ไม่สำเร็จ" + model "openai/gpt-oss-20b" ซึ่งเป็น
     โมเดล open-source ที่รันบน Groq เท่านั้น ไม่มีทางมาจาก xAI ได้
     ตัวเว็บ (ไฟล์นี้) ไม่รู้และไม่ควรต้องรู้ว่า Worker เลือกใช้โมเดลไหนอยู่จริง
     แค่ยิง POST ไปตามรูปแบบเดียวกันเสมอ (system + messages) แล้วรอ response
     กลับมาเป็น {content:[{text}]} — logic เลือก/สลับโมเดลอยู่ฝั่ง Worker ทั้งหมด
     (source ของ Worker ตัวนี้ไม่ได้อยู่ในโปรเจกต์นี้ ดูแยกจาก repo ของ Worker) */
  /* แก้ URL ด้านล่างให้ตรงกับ Worker URL จริงหลัง deploy (ดู cloudflare-worker/README.md) */
  var CHAT_PROXY_URL = 'https://red-sun-9f54.zillergotspw.workers.dev';

  /* Groq free tier (on-demand) จำกัด token/นาทีต่ำมาก (เจอจริง 8,000 TPM สำหรับ
     openai/gpt-oss-20b) แต่ทุก request ที่ยิงไปตอนนี้แนบ "ประวัติแชททั้งหมด" ของ
     session ไปด้วยเสมอ (ดู history.push ด้านล่าง) ทำให้ยิ่งคุยไปนาน ยิ่งกิน token/
     ครั้งมากขึ้นเรื่อยๆ จนชนเพดานได้ง่ายหลังผ่านไปแค่ 2-3 ข้อความ — ตัดให้เหลือแค่
     บทสนทนาล่าสุดที่ส่งจริง (เก็บของเดิมไว้ครบใน history เพื่อโชว์ในหน้าจอ แต่ตัด
     เฉพาะตอนส่งให้ API) ช่วยลด token/request ได้มาก โดยที่บอทยังจำบริบทล่าสุด
     พอสำหรับสนทนาสั้นๆ ทั่วไป */
  var MAX_HISTORY_MESSAGES_SENT = 8; // ~4 รอบสนทนาล่าสุด (user+bot สลับกัน)

  /* เรียก AI ผ่าน chat proxy Worker (ดูคอมเมนต์ด้านบน CHAT_PROXY_URL ว่าใช้โมเดลอะไรจริง) */
  async function askBot(userMsg) {
    history.push({ role: 'user', content: userMsg });
    var hasQuoteIntent = QUOTE_INTENT_RE.test(userMsg);

    isTyping = true;
    sendBtn.disabled = true;
    showTyping();

    try {
      var knowledge = await knowledgePromise;
      var trimmedHistory = history.length > MAX_HISTORY_MESSAGES_SENT
        ? history.slice(history.length - MAX_HISTORY_MESSAGES_SENT)
        : history;
      var res = await fetch(CHAT_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: SYSTEM_RULES + knowledge,
          messages: trimmedHistory
        })
      });

      var data = await res.json();
      var reply = (data.content && data.content[0] && data.content[0].text)
        ? data.content[0].text.trim()
        : 'ขออภัยครับ ขณะนี้ไม่สามารถตอบได้ กรุณาโทร 062-883-3880';

      history.push({ role: 'assistant', content: reply });
      removeTyping();
      addBubble(reply, 'bot');
    } catch {
      removeTyping();
      addBubble('ขออภัยครับ เกิดข้อผิดพลาด กรุณาโทร 062-883-3880 หรือส่งอีเมลมาที่ cssigngroup@gmail.com', 'bot');
    }

    isTyping = false;
    sendBtn.disabled = input.value.trim().length === 0;

    if (hasQuoteIntent) maybeOfferQuoteModal(userMsg);
  }

  /* ── send message ── */
  function sendMessage(text) {
    var msg = text || input.value.trim();
    if (!msg || isTyping) return;

    /* hide chips after first interaction */
    chips.classList.add('hidden');

    addBubble(msg, 'user');
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;

    if (messageCount >= MAX_MESSAGES_PER_SESSION) {
      addBubble('ขออภัยครับ แชทช่วงนี้คุยกันมาเยอะแล้ว รบกวนติดต่อทีมขายโดยตรงที่ 062-883-3880 หรือ cssigngroup@gmail.com เพื่อความรวดเร็วครับ', 'bot');
      sendBtn.disabled = input.value.trim().length === 0;
      return;
    }
    messageCount++;

    askBot(msg);
  }

  /* ── open / close ── */
  /* 2026 refactor — accessibility phase (รอบที่ 59): เพิ่ม Escape + Tab-trap + return-focus ให้
     #chat-popup (ประกาศ role="dialog" aria-modal="true" มาตั้งแต่ต้น แต่ไม่เคยมี behavior จริงรองรับ)
     — pattern เปิด/ปิดของไฟล์นี้ต่างจาก overlay อื่นในโปรเจกต์ (classList.add/remove('open') แทน
     style.display, ปิดด้วย document click listener เช็ค !popup.contains(e.target) แทน backdrop
     overlay ธรรมดา) จึงเช็ค isOpen แทน overlay.style.display === "flex" ที่ track-modal.js/
     lead-quote-modal.js ใช้ — โครง Tab-trap ยังใช้ FOCUSABLE_SELECTOR เดียวกับที่ใช้ทั่วโปรเจกต์
     (ไม่ต้องกรอง offsetParent/visibility เพิ่มเอง ตามเหตุผลเดิมที่บันทึกไว้ในแผนรอบ 57 ข้อ 8) */
  var CW_FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), ' +
    'input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  var lastFocused = null;

  function openChat() {
    lastFocused = document.activeElement;
    isOpen = true;
    fab.classList.add('open');
    popup.classList.add('open');
    badge.classList.add('hide');
    input.focus();
  }

  function closeChat() {
    isOpen = false;
    fab.classList.remove('open');
    popup.classList.remove('open');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    lastFocused = null;
  }

  fab.addEventListener('click', function () {
    isOpen ? closeChat() : openChat();
  });
  closeBtn.addEventListener('click', closeChat);

  /* close on outside click */
  document.addEventListener('click', function (e) {
    if (isOpen && !popup.contains(e.target) && e.target !== fab && !fab.contains(e.target)) {
      closeChat();
    }
  });

  /* Escape ปิดแชท + Tab-trap วนโฟกัสอยู่ใน popup ตราบใดที่ isOpen — ผูกไว้ที่ document เดียวกับ
     ทุก modal อื่นในโปรเจกต์ (module-scope, ไม่ต้องกัน bind ซ้ำเพราะ IIFE นี้รันครั้งเดียวต่อหน้า) */
  document.addEventListener('keydown', function (e) {
    if (!isOpen) return;

    if (e.key === 'Escape') {
      closeChat();
      return;
    }

    if (e.key !== 'Tab') return;
    var focusables = Array.prototype.slice.call(popup.querySelectorAll(CW_FOCUSABLE_SELECTOR));
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    var active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !popup.contains(active)) { e.preventDefault(); last.focus(); }
    } else {
      if (active === last || !popup.contains(active)) { e.preventDefault(); first.focus(); }
    }
  });

  /* ── input events ── */
  input.addEventListener('input', function () {
    sendBtn.disabled = input.value.trim().length === 0;
    /* auto-grow */
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 96) + 'px';
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', function () { sendMessage(); });

  /* ── quick chips ── */
  chips.querySelectorAll('.chat-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      sendMessage(chip.getAttribute('data-msg'));
    });
  });

  /* ── greeting ── */
  setTimeout(function () {
    addBubble('สวัสดีครับ ผมคือผู้ช่วย AI ของ CS.SIGN ยินดีให้คำปรึกษาเรื่องป้ายจราจร ป้ายความปลอดภัย และบริการต่างๆ ครับ กรุณาแจ้งความต้องการของท่านได้เลยครับ', 'bot');
  }, 400);

  /* ── external trigger: let other buttons on the page (e.g. certificate
       request CTAs) open the chat with a pre-filled question ── */
  window.csChatAsk = function (msg) {
    if (!isOpen) openChat();
    chips.classList.add('hidden');
    setTimeout(function () { sendMessage(msg); }, isOpen ? 60 : 380);
  };

})();
