'use strict';
/** مسجّل صامت لتجنب إطلاق بيانات الاعتماد في المنصة */
const pino = require('pino');
const logger = pino({
  level: process.env.LOG_LEVEL || 'silent',
  timestamp: () => `,"time":"${new Date().toJSON()}"`
});
module.exports = { logger };
