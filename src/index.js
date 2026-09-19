'use strict';
/**
 * وكيل خدمة العملاء على واتساب — Baileys
 * الاستماع لرسائل المجموعات ← كشف طلبات الخدمة ← رد خاص تلقائي + إشعار
 */
const path = require('path');
const fs = require('fs');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  downloadContentFromMessage
} = require('@whiskeysockets/baileys');
const { logger } = require('./logger');
const { load, save } = require('./config');
const { Store } = require('./store');
const { matchIntent } = require('./matcher');
const { startWeb } = require('./web');

const AUTH_DIR = path.join(__dirname, '..', 'wa_auth');
fs.mkdirSync(AUTH_DIR, { recursive: true });
fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });

const store = new Store();
let cfg = load();
let sock = null;
let waVersion;
let restarting = false;

/* ---------- أدوات مساعدة ---------- */

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

function nowString() {
  return new Date().toLocaleString('ar', { hour12: false });
}

function isGroupJid(jid) { return String(jid || '').endsWith('@g.us'); }

function jidToPhone(jid) {
  return String(jid || '').split('@')[0].split(':')[0];
}

function isMe(jid) {
  const me = (sock && sock.user && sock.user.id) || '';
  if (!jid || !me) return false;
  return String(jid).split('@')[0].split(':')[0] === String(me).split('@')[0].split(':')[0];
}

// استخراج نص الرسالة (يدعم أنواع عديدة)
function extractText(m) {
  const msg = m.message || {};
  return (
    msg.conversation ||
    (msg.extendedTextMessage && msg.extendedTextMessage.text) ||
    (msg.imageMessage && msg.imageMessage.caption) ||
    (msg.videoMessage && msg.videoMessage.caption) ||
    (msg.documentMessage && msg.documentMessage.caption) ||
    (msg.buttonsResponseMessage && msg.buttonsResponseMessage.selectedDisplayText) ||
    (msg.listResponseMessage && msg.listResponseMessage.title) ||
    ''
  ).trim();
}

function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ---------- إشعار أندرويد (Termux:API) ---------- */
function notifyTermux(title, body) {
  if (!cfg.notifyTermux) return;
  try {
    const { execFile } = require('child_process');
    execFile('termux-notification', ['--title', title, '--content', String(body).slice(0, 200), '--priority', 'high'], (err) => {
      if (err) { /* غير مثبت — تجاهل بهدوء */ }
    });
  } catch (_) { /* تجاهل */ }
}

/* ---------- إرسال الرد الخاص ---------- */
async function sendAutoReply(chatJid, participantJid, groupSubject, msgText, groupJid) {
  const now = Date.now();

  // فلاتر الحماية من الحظر
  if (store.onCooldown(participantJid, cfg.cooldownHours)) {
    store.stats.skipped++;
    store.addLog('skip', 'تخطي (تهدئة سابقة): ' + jidToPhone(participantJid), { jid: participantJid });
    return false;
  }
  const dk = todayKey();
  if (store.dailyCount(participantJid, dk) >= cfg.dailyLimitPerSender) {
    store.stats.skipped++;
    store.addLog('skip', 'تخطي (تجاوز حد اليوم): ' + jidToPhone(participantJid), { jid: participantJid });
    return false;
  }

  const template = cfg.replyTemplate || '';
  const name = jidToPhone(participantJid);
  const text = template
    .replace(/\{name\}/g, name)
    .replace(/\{group\}/g, groupSubject || 'المجموعة')
    .replace(/\{message\}/g, (msgText || '').slice(0, 150))
    .replace(/\{رقم\}/g, name)
    .replace(/\{المجموعة\}/g, groupSubject || 'المجموعة');

  // تأخير عشوائي طبيعي
  const minD = Math.max(1, cfg.minDelaySeconds || 3) * 1000;
  const maxD = Math.max(minD, cfg.maxDelaySeconds || 8) * 1000;
  await delay(Math.floor(minD + Math.random() * (maxD - minD)));

  try {
    await sock.sendMessage(chatJid, { text });
    store.markSent(participantJid);
    store.countDaily(participantJid, dk);
    store.addLog('sent', 'تم إرسال رد خاص إلى ' + name, { group: groupSubject, message: msgText.slice(0, 120) });
    notifyTermux('✅ تم إرسال رد', 'إلى ' + name + ' بسبب رسالته في «' + (groupSubject || groupJid) + '»');
    return true;
  } catch (e) {
    store.addLog('error', 'فشل إرسال الرد: ' + (e && e.message));
    return false;
  }
}

/* ---------- معالجة الرسائل الواردة ---------- */
async function onMessagesUpsert({ type, messages }) {
  if (!messages || !messages.length) return;
  for (const m of messages) {
    if (!m || !m.key) continue;
    const fromMe = m.key.fromMe;
    const chatJid = m.key.remoteJid;
    const text = extractText(m);

    // تجاهل أحداث النظام والرسائل الفارغة
    if (m.message && m.message.protocolMessage) continue;
    if (!text) continue;

    // رسائل خاصة (فقط رد آلي اختياري)
    if (!isGroupJid(chatJid)) {
      if (cfg.listenPrivate && !fromMe) {
        const r = matchIntent(text, cfg);
        if (r.matched && cfg.enabled && !isMe(chatJid)) {
          store.stats.matched++;
          store.addLog('match', 'رسالة خاصة تطلب خدمة من ' + jidToPhone(chatJid), { message: text.slice(0, 160), reason: r.reason });
          notifyTermux('🔔 طلب خدمة (خاص)', jidToPhone(chatJid) + ': ' + text.slice(0, 120));
          await sendAutoReply(chatJid, chatJid, '', text, '');
        }
      }
      continue;
    }

    // رسائل مجموعة
    if (!cfg.listenGroups) continue;
    if (!cfg.monitorAllGroups) {
      const groups = Array.isArray(cfg.monitoredGroups) ? cfg.monitoredGroups : [];
      if (!groups.includes(chatJid)) continue;
    }

    if (fromMe) continue; // لا نتفاعل مع رسائلنا

    const participant = m.key.participant;
    if (!participant || isMe(participant)) continue;

    const r = matchIntent(text, cfg);
    if (!r.matched) continue;

    if (!cfg.enabled) {
      store.stats.matched++;
      store.addLog('match', 'رصد (الرد متوقف): ' + jidToPhone(participant), { message: text.slice(0, 160), reason: r.reason });
      continue;
    }

    let groupSubject = '';
    try {
      const meta = await sock.groupMetadata(chatJid);
      groupSubject = meta.subject || '';
    } catch (_) { groupSubject = ''; }

    store.stats.matched++;
    store.addLog('match', '🔔 طلب خدمة في «' + (groupSubject || chatJid) + '» من ' + jidToPhone(participant), {
      message: text.slice(0, 200),
      reason: r.reason,
      groupJid: chatJid,
      participant: jidToPhone(participant)
    });
    notifyTermux('🔔 طلب خدمة في مجموعة', (groupSubject || '') + ' — ' + jidToPhone(participant) + ': ' + text.slice(0, 110));

    await sendAutoReply(chatJid, participant, groupSubject, text, chatJid);
  }
}

/* ---------- الاتصال وإعادة المحاولة ---------- */
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  if (!waVersion) {
    try { waVersion = await fetchLatestBaileysVersion(); } catch (_) { waVersion = undefined; }
  }

  sock = makeWASocket({
    version: waVersion,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    browser: ['Chrome (Linux)', 'Chrome', '120.0.6099.0'],
    syncFullHistory: false,
    markOnlineOnConnect: false,
    logger
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      store.qrString = qr;           // تُعرض في لوحة الويب
      store.qrAt = Date.now();
      store.addLog('info', 'QR جديد — امسحه من واتساب (الأجهزة المرتبطة ← ربط جهاز آخر)');
      try { require('qrcode-terminal').generate(qr, { small: true }); } catch (_) {}
    }
    if (connection === 'connecting') {
      store.connState = 'connecting';
    }
    if (connection === 'open') {
      store.connState = 'connected';
      store.qrString = null;
      store.me = sock.user && sock.user.id;
      store.addLog('ok', '✅ تم الاتصال بواتساب: ' + (sock.user && sock.user.id));
      notifyTermux('🟢 البوت متصل', 'جاهز لرصد رسائل المجموعات');
    }
    if (connection === 'close') {
      const code = (lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode) || 0;
      store.connState = 'closed';
      if (code === DisconnectReason.loggedOut) {
        store.addLog('error', 'تم تسجيل الخروج من واتساب — امسح QR مرة أخرى (احذف مجلد wa_auth لإعادة الربط)');
        store.qrString = null;
        return; // انتظر أمر إعادة الربط من اللوحة
      }
      // إعادة الاتصال تلقائياً
      if (!restarting) {
        restarting = true;
        const waitS = 5;
        store.addLog('info', 'انقطع الاتصال — إعادة المحاولة بعد ' + waitS + ' ثوانٍ (كود ' + code + ')');
        setTimeout(() => {
          restarting = false;
          startBot().catch((e) => { store.addLog('error', 'فشل إعادة التشغيل: ' + e.message); });
        }, waitS * 1000);
      }
    }
  });

  sock.ev.on('messages.upsert', (u) => { onMessagesUpsert(u).catch((e) => store.addLog('error', 'خطأ معالجة رسالة: ' + e.message)); });

  return sock;
}

/* ---------- تشغيل ---------- */
store.connState = 'starting';
startBot().catch((e) => store.addLog('error', 'خطأ بدء البوت: ' + (e && e.message)));

const PORT = process.env.PORT || 3000;
startWeb({ store, getConfig: () => cfg, setConfig: (c) => { cfg = c; save(c); }, restartBot: startBot });
store.addLog('ok', 'لوحة التحكم تعمل على المنفذ ' + PORT);
