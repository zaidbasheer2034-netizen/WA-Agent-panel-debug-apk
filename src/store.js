'use strict';
/**
 * تخزين: فترات التهدئة، عدّادات يومية، وسجل الأحداث المعروض في اللوحة
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return {}; }
}
function writeJson(p, obj) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}

class Store {
  constructor() {
    this.cooldownPath = path.join(DATA_DIR, 'cooldowns.json');
    this.dailyPath = path.join(DATA_DIR, 'daily.json');
    this.cooldowns = readJson(this.cooldownPath); // { senderJid: lastSentTs }
    this.daily = readJson(this.dailyPath);        // { 'YYYY-MM-DD': { senderJid: count } }
    this.logs = [];
    this.maxLogs = 300;
    this.stats = { matched: 0, sent: 0, skipped: 0, startedAt: Date.now() };
  }

  onCooldown(jid, hours) {
    const last = this.cooldowns[jid] || 0;
    return Date.now() - last < hours * 3600 * 1000;
  }

  markSent(jid) {
    this.cooldowns[jid] = Date.now();
    writeJson(this.cooldownPath, this.cooldowns);
    this.stats.sent++;
  }

  dailyCount(jid, date) {
    const d = this.daily[date] || {};
    return d[jid] || 0;
  }

  countDaily(jid, date) {
    if (!this.daily[date]) this.daily[date] = {};
    this.daily[date][jid] = (this.daily[date][jid] || 0) + 1;
    // تنظيف الأيام الأقدم من 7 أيام
    const keys = Object.keys(this.daily).sort();
    while (keys.length > 7) delete this.daily[keys.shift()];
    writeJson(this.dailyPath, this.daily);
  }

  addLog(type, text, extra) {
    const entry = {
      id: Date.now() + '-' + Math.floor(Math.random() * 10000),
      ts: Date.now(),
      type: type || 'info',
      text: String(text || ''),
      extra: extra || {}
    };
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) this.logs.length = this.maxLogs;
    return entry;
  }
}

module.exports = { Store };
