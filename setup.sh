#!/data/data/com.termux/files/usr/bin/bash
# تثبيت متطلبات البوت على Termux — شغّله مرة واحدة:
#   bash setup.sh
set -e
echo "==> تحديث الحزم وتثبيت Node.js..."
pkg update -y && pkg upgrade -y
pkg install -y nodejs-lts git termux-api

echo "==> تثبيت اعتماديات البوت..."
cd "$(dirname "$0")"
npm install --no-audit --no-fund

echo "==> إضافة أمر التشغيل السريع (wa-agent)..."
cat > /data/data/com.termux/files/usr/bin/wa-agent <<'EOF'
#!/data/data/com.termux/files/usr/bin/bash
cd "$HOME/wa-service-bot"
node src/index.js
EOF
chmod +x /data/data/com.termux/files/usr/bin/wa-agent

echo "==> إضافة تشغيل تلقائي عند فتح Termux..."
grep -q wa-agent ~/.bashrc 2>/dev/null || echo '(wa-agent > /dev/null 2>&1 &)' >> ~/.bashrc

echo ""
echo "✅ تم التثبيت!"
echo "   للتشغيل:  اكتب  wa-agent"
echo "   ثم افتح تطبيق «وكيل خدمة العملاء» على هاتفك لتظهر لوحة التحكم"
