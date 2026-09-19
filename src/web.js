'use strict';
/**
 * لوحة التحكم — Express + واجهة عربية RTL
 * - عرض QR للربط (ربط جهاز آخر)
 * - تعديل رسالة الرد والكلمات المفتاحية والإعدادات
 * - سجل مباشر للطلبات المرصودة والإشعارات
 */
const express = require('express');
const path = require('path');
const QRCode = require('qrcode');

function startWeb(ctx) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  const { store, getConfig, setConfig } = ctx;

  app.get('/api/status', async (req, res) => {
    const cfg = getConfig();
    let qrDataUrl = null;
    if (store.qrString) {
      try { qrDataUrl = await QRCode.toDataURL(store.qrString, { width: 320, margin: 1 }); } catch (_) {}
    }
    res.json({
      connState: store.connState || 'unknown',
      me: store.me || null,
      qr: qrDataUrl,
      qrAge: store.qrAt ? Date.now() - store.qrAt : null,
      enabled: cfg.enabled,
      stats: store.stats,
      logs: store.logs.slice(0, 60)
    });
  });

  app.get('/api/config', (req, res) => res.json(getConfig()));

  app.post('/api/config', (req, res) => {
    const cfg = getConfig();
    const b = req.body || {};
    if (typeof b.enabled === 'boolean') cfg.enabled = b.enabled;
    if (typeof b.listenGroups === 'boolean') cfg.listenGroups = b.listenGroups;
    if (typeof b.listenPrivate === 'boolean') cfg.listenPrivate = b.listenPrivate;
    if (typeof b.monitorAllGroups === 'boolean') cfg.monitorAllGroups = b.monitorAllGroups;
    if (typeof b.replyTemplate === 'string' && b.replyTemplate.trim()) cfg.replyTemplate = b.replyTemplate;
    if (Array.isArray(b.keywords)) cfg.keywords = b.keywords.map((k) => String(k).trim()).filter(Boolean);
    if (b.cooldownHours !== undefined) cfg.cooldownHours = Math.max(0, Number(b.cooldownHours) || 0);
    if (b.dailyLimitPerSender !== undefined) cfg.dailyLimitPerSender = Math.max(0, Number(b.dailyLimitPerSender) || 0);
    if (b.minDelaySeconds !== undefined) cfg.minDelaySeconds = Math.max(0, Number(b.minDelaySeconds) || 0);
    if (b.maxDelaySeconds !== undefined) cfg.maxDelaySeconds = Math.max(0, Number(b.maxDelaySeconds) || 0);
    if (typeof b.notifyTermux === 'boolean') cfg.notifyTermux = b.notifyTermux;
    setConfig(cfg);
    store.addLog('ok', 'تم حفظ الإعدادات من اللوحة');
    res.json({ ok: true, config: cfg });
  });

  app.post('/api/relink', (req, res) => {
    // حذف بيانات الجلسة لإظهار QR جديد
    try {
      const fs = require('fs');
      const AUTH_DIR = path.join(__dirname, '..', 'wa_auth');
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    } catch (_) {}
    store.addLog('info', 'طلب إعادة ربط — سيظهر QR جديد بعد إعادة التشغيل التلقائية');
    res.json({ ok: true, note: 'أعد تشغيل البوت (Ctrl+C ثم npm start) ليظهر QR جديد' });
  });

  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

  app.listen(process.env.PORT || 3000, () => {});
}

module.exports = { startWeb };
