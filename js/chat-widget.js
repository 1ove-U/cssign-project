/* AI chat widget — shared across index, products, about */
import { getProducts, getCategories, getFaqs, getSettings, getPortfolios } from './db.js';

(function () {
  /* ── state ── */
  var history = [];  /* {role, content}[] for Claude API */
  var isOpen   = false;
  var isTyping = false;

  /* ── elements ── */
  var fab      = document.getElementById('chat-fab');
  var popup    = document.getElementById('chat-popup');
  var closeBtn = document.getElementById('chat-close-btn');
  var msgs     = document.getElementById('chat-messages');
  var input    = document.getElementById('chat-input');
  var sendBtn  = document.getElementById('chat-send-btn');
  var chips    = document.getElementById('chat-chips');
  var badge    = document.getElementById('chat-badge');

  /* ── system prompt ──
     Split in two: a fixed instruction block (rules never change),
     plus a live "ข้อมูลปัจจุบันจากเว็บไซต์" block rebuilt from real
     Firestore data every time the page loads (see buildKnowledgeBlock
     below) — company contact info, the real product catalog with
     current prices, real FAQ answers, and recent project references —
     so the bot answers off what's actually published on the site
     right now instead of a snapshot that goes stale the moment an
     admin edits something in admin.html. If Firestore can't be
     reached (offline, blocked, first paint before data loads), it
     falls back to this static block so the bot still works. */
  var STATIC_FALLBACK_KNOWLEDGE = `ข้อมูลบริษัท:
- ที่อยู่: 17 ซอยบางกระดี่ 1 แขวงแสมดำ เขตบางขุนเทียน กรุงเทพฯ 10150
- โทร: 062-883-3880, 063-978-5670
- โทรสาร (Fax): 02-115-0850
- อีเมล: cssigngroup@gmail.com
- LINE: @cssigngroup
- Facebook: facebook.com/cssignonline

มาตรฐาน: มอก. 635-2547, ISO 9001:2015 (Bureau Veritas), ISO 7010:2019, DOH Standard
สินค้า: ป้ายความปลอดภัย ISO 7010, ป้ายจราจรสะท้อนแสง, ป้ายโรงงานอุตสาหกรรม, กรวยจราจร, แบริเออร์, เสาล้มลุก, Custom Order พร้อม Artwork ฟรี
บริการ: สำรวจพื้นที่ฟรี, ออกแบบ Artwork ฟรี, ผลิต, ติดตั้ง, ออกใบกำกับภาษีเต็มรูปแบบ
ราคาตัวอย่าง: กรวยจราจร เริ่ม ฿350/ชิ้น, เสาล้มลุก เริ่ม ฿280/ชิ้น — สินค้าอื่น ขอใบเสนอราคา
ระยะเวลา: สต็อก 1-3 วัน, Custom 5-10 วันทำการ
ลูกค้าอ้างอิง: PTT Group, SCG, EGAT, CP Group, กรุงเทพมหานคร
(หมายเหตุ: นี่คือข้อมูลสำรอง ระบบไม่สามารถโหลดข้อมูลล่าสุดจากเว็บไซต์ได้ในขณะนี้)`;

  var SYSTEM_RULES = `คุณคือผู้ช่วยขายของ CS.SIGN (บริษัท ซีเอส.ไซน์ แอนด์ โปรดักส์ จำกัด)
ผู้ผลิตป้ายจราจรและป้ายความปลอดภัยครบวงจร ประสบการณ์ 20+ ปี

กฎ:
- ใช้ "ข้อมูลปัจจุบันจากเว็บไซต์" ด้านล่างเป็นแหล่งความจริงหลักเสมอ เพราะดึงมาจากฐานข้อมูลจริงของเว็บไซต์ตอนนี้ ถ้าข้อมูลในนั้นขัดกับความรู้เดิมของคุณ ให้เชื่อข้อมูลด้านล่างนี้แทน
- คุณคือ AI ผู้ช่วย ไม่ใช่พนักงานจริง หากลูกค้าถามว่าคุยกับคนหรือ AI หรือขอคุยกับพนักงาน/คนจริง ให้ตอบตรงไปตรงมาว่าคุณเป็น AI ผู้ช่วยตอบคำถามเบื้องต้น และแนะนำให้ติดต่อทีมขายจริงผ่านช่องทางที่ระบุไว้ด้านล่าง
- ตอบเป็นภาษาไทยเสมอ สั้นกระชับ เป็นมิตร เป็นมืออาชีพ
- ถ้าไม่แน่ใจในราคาหรือรายละเอียด หรือเป็นเรื่องที่ต้องใช้ดุลยพินิจ/เจรจา (เช่น ราคาต่อรอง เงื่อนไขพิเศษ) หรือสินค้าที่ไม่มีอยู่ในรายการด้านล่าง ให้แนะนำติดต่อพนักงานขายจริง หรือขอใบเสนอราคาแทนการเดาคำตอบ
- ห้ามแต่งข้อมูลที่ไม่รู้ หรือไม่มีอยู่ใน "ข้อมูลปัจจุบันจากเว็บไซต์" ด้านล่าง โดยเฉพาะราคาและสเปกสินค้า
- ตอบสูงสุด 3-4 ประโยค ยกเว้นถ้าถูกถามให้อธิบายละเอียด
- ถ้าลูกค้าทักทายหรือพูดคุยเล็กน้อยที่ไม่เกี่ยวกับธุรกิจ (เช่น ทายทัก ถามสภาพอากาศ ชวนคุยเล่น) ตอบรับแบบสุภาพสั้นๆได้ แต่ให้วกกลับมาที่สินค้า/บริการของ CS.SIGN เสมอในประโยคถัดไป
- ถ้าลูกค้าถามเรื่องที่ไม่เกี่ยวข้องกับ CS.SIGN เลยและไม่ใช่การพูดคุยทั่วไป (เช่น ขอให้แต่งเรื่อง ทำการบ้าน ถามความรู้ทั่วไปที่ไม่เกี่ยวกับป้าย) ให้ตอบสุภาพว่าช่วยเรื่องนี้ไม่ได้ และแนะนำให้ถามเกี่ยวกับป้ายความปลอดภัย/ป้ายจราจร หรือบริการของ CS.SIGN แทน

ข้อมูลปัจจุบันจากเว็บไซต์:
`;

  /* ── build the live knowledge block from Firestore (products,
     categories, FAQs, settings, recent projects). Runs once per page
     load, in parallel with the rest of the page, cached in a promise
     so askClaude() only ever waits on it the first time it's needed. ── */
  function formatPrice(price, unit) {
    var num = Number(price);
    if (!price || isNaN(num) || num <= 0) return 'สอบถามราคา';
    return '฿' + num.toLocaleString('th-TH') + (unit ? '/' + unit : '');
  }

  function buildKnowledgeBlock() {
    return Promise.all([
      getSettings().catch(function () { return null; }),
      getProducts().catch(function () { return []; }),
      getCategories().catch(function () { return []; }),
      getFaqs().catch(function () { return []; }),
      getPortfolios().catch(function () { return []; })
    ]).then(function (results) {
      var settings = results[0], products = results[1] || [], categories = results[2] || [],
          faqs = results[3] || [], portfolios = results[4] || [];

      var parts = [];

      /* ── contact info: live settings, falling back per-field to the
         same defaults used sitewide (see js/site-settings.js) ── */
      var s = settings || {};
      parts.push('ข้อมูลติดต่อบริษัท:\n' +
        '- ที่อยู่: ' + (s.address || '17 ซอยบางกระดี่ 1 แขวงแสมดำ เขตบางขุนเทียน กรุงเทพฯ 10150') + '\n' +
        '- โทร: ' + (s.phone || '062-883-3880') + (s.phone2 ? ', ' + s.phone2 : '') + '\n' +
        '- โทรสาร: ' + (s.fax || '02-115-0850') + '\n' +
        '- อีเมล: ' + (s.email || 'cssigngroup@gmail.com') + '\n' +
        '- LINE: ' + (s.lineUrl || '@cssigngroup') + '\n' +
        '- Facebook: ' + (s.facebookUrl || 'facebook.com/cssignonline'));

      /* ── catalog: only currently-published ("active") products,
         same filter products.js itself uses for the public product
         grid, so the bot never quotes a draft/hidden item ── */
      var catNames = {};
      categories.forEach(function (c) { catNames[c.id] = c.name; });
      var live = products.filter(function (p) { return (p.status || 'active') === 'active'; });
      if (live.length) {
        var MAX_ITEMS = 60;
        var lines = live.slice(0, MAX_ITEMS).map(function (p) {
          var cat = catNames[p.cat_id] ? ' [' + catNames[p.cat_id] + ']' : '';
          return '- ' + p.name + cat + ': ' + formatPrice(p.price, p.unit) +
            (p.material ? ' | วัสดุ: ' + p.material : '') +
            (p.size ? ' | ขนาด: ' + p.size : '');
        });
        var more = live.length > MAX_ITEMS ? '\n(และสินค้าอื่นอีก ' + (live.length - MAX_ITEMS) + ' รายการ ดูทั้งหมดได้ที่หน้าสินค้าบนเว็บไซต์)' : '';
        parts.push('รายการสินค้าปัจจุบัน (' + live.length + ' รายการ):\n' + lines.join('\n') + more);
      }

      /* ── FAQs: real question/answer pairs maintained by the admin ── */
      if (faqs.length) {
        var faqLines = faqs.map(function (f) { return 'ถาม: ' + f.question + '\nตอบ: ' + f.answer; });
        parts.push('คำถามที่พบบ่อย (FAQ):\n' + faqLines.join('\n\n'));
      }

      /* ── recent projects: a short list of client names/categories
         only — enough to answer "เคยทำให้ใครบ้าง" without dumping
         full case-study copy into the prompt ── */
      if (portfolios.length) {
        var clients = portfolios
          .map(function (p) { return p.client; })
          .filter(function (c, i, arr) { return c && arr.indexOf(c) === i; })
          .slice(0, 20);
        if (clients.length) {
          parts.push('ลูกค้า/โครงการที่เคยทำ (ตัวอย่าง): ' + clients.join(', '));
        }
      }

      return parts.length ? parts.join('\n\n') : STATIC_FALLBACK_KNOWLEDGE;
    }).catch(function () {
      return STATIC_FALLBACK_KNOWLEDGE;
    });
  }

  /* kick the fetch off immediately so it's usually already resolved
     by the time the visitor sends their first message; askClaude()
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

  /* ── Cloud proxy endpoint (Cloudflare Worker → Google Gemini API, ฟรี ไม่ต้องผูกบัตร) ── */
  /* แก้ URL ด้านล่างให้ตรงกับ Worker URL จริงหลัง deploy (ดู cloudflare-worker/README.md) */
  var CHAT_PROXY_URL = 'https://red-sun-9f54.zillergotspw.workers.dev';

  /* ── Claude API call (ผ่าน chatProxy Cloud Function — ไม่เรียก api.anthropic.com ตรงจาก browser อีกต่อไป) ── */
  async function askClaude(userMsg) {
    history.push({ role: 'user', content: userMsg });

    isTyping = true;
    sendBtn.disabled = true;
    showTyping();

    try {
      var knowledge = await knowledgePromise;
      var res = await fetch(CHAT_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: SYSTEM_RULES + knowledge,
          messages: history
        })
      });

      var data = await res.json();
      var reply = (data.content && data.content[0] && data.content[0].text)
        ? data.content[0].text.trim()
        : 'ขออภัยครับ ขณะนี้ไม่สามารถตอบได้ กรุณาโทร 062-883-3880';

      history.push({ role: 'assistant', content: reply });
      removeTyping();
      addBubble(reply, 'bot');
    } catch (err) {
      removeTyping();
      addBubble('ขออภัยครับ เกิดข้อผิดพลาด กรุณาโทร 062-883-3880 หรือส่งอีเมลมาที่ cssigngroup@gmail.com', 'bot');
    }

    isTyping = false;
    sendBtn.disabled = input.value.trim().length === 0;
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

    askClaude(msg);
  }

  /* ── open / close ── */
  function openChat() {
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
