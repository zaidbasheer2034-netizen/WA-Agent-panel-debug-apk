'use strict';
/**
 * إعدادات وكيل خدمة العملاء
 * تُحفظ في data/config.json وتُعدَّل من لوحة التحكم (الويب)
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

const DEFAULTS = {
  // تشغيل الردود التلقائية (يمكن إيقاف الرصد دون إيقاف الاتصال)
  enabled: true,

  // رصد رسائل المجموعات والخاص
  listenGroups: true,
  listenPrivate: false,

  // مراقبة جميع المجموعات أم مجموعات محددة فقط
  monitorAllGroups: true,
  monitoredGroups: [],

  // رسالة الرد الخاص — المتغيرات المدعومة: {name} و{group} و{message}
  replyTemplate: [
    'مرحباً {name} 👋',
    'لاحظنا رسالتك في مجموعة «{group}»:',
    '«{message}»',
    '',
    'أنا أقدّم خدمات احترافية ويمكنني تنفيذ طلبك بأفضل جودة وفي أسرع وقت.',
    'أرسل لي التفاصيل هنا وسأرد عليك مباشرة ✅'
  ].join('\n'),

  // كلمات مفتاحية مخصصة يضيفها المستخدم — أي رسالة تحتويها تُعتبر طلب خدمة
  keywords: [],

  // حماية من الحظر: تهدئة لكل مُرسل + حدود إرسال
  cooldownHours: 12,
  dailyLimitPerSender: 2,
  hourlyGlobalLimit: 30,

  // تأخير عشوائي قبل إرسال الرد (ثواني) ليبدو طبيعياً
  minDelaySeconds: 3,
  maxDelaySeconds: 8,

  // إشعارات نظام أندرويد عبر Termux:API (اختياري)
  notifyTermux: true
};

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return Object.assign({}, DEFAULTS, raw);
  } catch (_) {
    return Object.assign({}, DEFAULTS);
  }
}

function save(cfg) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

module.exports = { load, save, DEFAULTS };
