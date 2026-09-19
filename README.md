# 🤖 وكيل خدمة العملاء — واتساب

بوت يراقب رسائل **المجموعات** على واتساب، وعند رصد أي رسالة تعني **طلب خدمة**
أو **سؤالاً عن مقدم خدمات**، يقوم بـ:

1. 🔔 إرسال **إشعار فوري** إلى هاتفك (تطبيق أندرويد + Termux:API)
2. 💬 إرسال **رسالة خاصة تلقائية** إلى مُرسل الرسالة بنص تحدده أنت من اللوحة

---

## 🧩 المكونات

| المكوّن | التقنية | الوظيفة |
|---|---|---|
| البوت | Node.js + Baileys | اتصال واتساب (ربط جهاز آخر عبر QR)، رصد الرسائل، الرد الخاص، إعادة الاتصال التلقائي |
| لوحة التحكم | واجهة ويب عربية RTL | رمز QR، تحديد رسالة الرد، الكلمات المفتاحية، حدود الحماية، السجل المباشر |
| تطبيق أندرويد | Java + Gradle (WebView) | يعرض لوحة التحكم كتطبيق على هاتفك — **يُبنى عبر GitHub Actions** |
| الإشعارات | Termux:API | إشعار أندرويد فوري عند كل طلب مرصود أو رد مُرسل |

---

## 📱 التشغيل على هاتف أندرويد (Termux)

### 1) ثبّت التطبيقات
- ثبّت **Termux** من F-Droid: https://f-droid.org/packages/com.termux/
- ثبّت إضافة **Termux:API** من F-Droid (للإشعارات)
- ثبّت **Termux:Boot** من F-Droid (اختياري — للتشغيل التلقائي بعد إعادة التشغيل)

### 2) انسخ مجلد البوت وشغّل التثبيت
```bash
termux-setup-storage          # اسمح بالوصول للتخزين
cp -r /sdcard/Download/wa-service-bot ~/wa-service-bot
cd ~/wa-service-bot
bash setup.sh                 # يثبّت Node.js والاعتماديات وأمر التشغيل
```

### 3) الربط مع واتساب (مرة واحدة)
```bash
wa-agent
```
- افتح تطبيق **وكيل خدمة العملاء** (المبني من هذا المستودع) ← سيظهر **رمز QR**
- في واتساب: **الأجهزة المرتبطة ← ربط جهاز آخر ← امسح الرمز**
- عند نجاح الربط تتحول الحالة إلى 🟢 متصل، والجلسة تُحفظ ولا تحتاج للمسح مرة أخرى

### 4) التشغيل الدائم
- أوقف «تحسين البطارية» لتطبيق Termux من إعدادات النظام
- إن ثبّت Termux:Boot: أنشئ ملفاً باسم `~/.termux/boot/wa-agent.sh` يحتوي:
  ```bash
  #!/data/data/com.termux/files/usr/bin/bash
  cd ~/wa-service-bot && node src/index.js
  ```

---

## 🏗️ بناء تطبيق الأندرويد (APK) من هذا المستودع

### الطريقة الأسهل — عبر GitHub Actions (تلقائي)
1. ارفع المستودع إلى GitHub (الخطوات أدناه)
2. افتح تبويب **Actions** في صفحة المستودع ← انتظر سير عمل **Build APK**
3. بعد نجاح البناء حمّل المخرج **WA-Agent-panel-debug-apk** من قسم Artifacts
4. ثبّت ملف الـ APK على هاتفك (اسمح بتثبيت المصادر غير المعروفة)

### أو محلياً (لديك Android Studio أو SDK)
```bash
cd android
./gradlew assembleDebug
# الملف الناتج: android/app/build/outputs/apk/debug/app-debug.apk
```
المشروع Gradle قياسي: `gradlew` + wrapper + `app/build.gradle` — يفتح مباشرة في Android Studio أيضاً.

> نسخة release موقّعة بمفتاح debug تلقائياً (`signingConfig signingConfigs.debug`)
> لتتمكن من تثبيتها مباشرة. لرفعها على متجر Play ستحتاج مفتاح توقيع خاصاً بك.

---

## 🖥️ التشغيل على حاسوب أو خادم (بديل)
```bash
cd wa-service-bot
bash start.sh
```
ثم افتح اللوحة على: http://localhost:3000

---

## 🧠 كيف يعمل الكشف؟
محلل النوايا (`src/matcher.js`) يطبّع النص العربي (التشكيل، الهمزات، التاء المربوطة) ثم:
- **عبارات صريحة**: «مين يقدم»، «ابحث عن»، «مطلوب»، «انصحوني»…
- **اجتماع** فعل طلب («محتاج، ابي، اريد…») مع كلمة خدمة («مبرمج، صيانه، محاسب…»)
- **كلماتك المخصصة** لها الأولوية دائماً

---

## ⚠️ تحذير مهم
الردود التلقائية غير المطلوبة قد تؤدي إلى **تقييد رقمك أو حظره** من واتساب.
البوت يتضمن حماية افتراضية (تهدئة 12 ساعة لكل شخص، حد ردود يومي، تأخير
عشوائي قبل الرد) — لا ترفع الحدود كثيراً واستخدم البوت بمسؤوليتك.

---

## 📁 بنية المشروع
```
wa-service-bot/
├── src/
│   ├── index.js                    # البوت: اتصال Baileys + الرصد + الرد + إعادة الاتصال
│   ├── matcher.js                  # محلل النوايا العربي
│   ├── config.js                   # الإعدادات (تُحفظ في data/config.json)
│   ├── store.js                    # التهدئة والعدادات والسجل
│   ├── web.js                      # خادم لوحة التحكم
│   ├── logger.js
│   └── public/index.html           # واجهة اللوحة (عربية RTL)
├── android/                        # مشروع أندرويد Gradle قياسي
│   ├── app/src/main/java/com/waagent/panel/MainActivity.java
│   ├── app/src/main/res/values/strings.xml
│   ├── app/src/main/AndroidManifest.xml
│   ├── app/build.gradle
│   ├── build.gradle · settings.gradle · gradle.properties
│   └── gradlew + gradle/wrapper/   # Gradle Wrapper (8.7)
├── .github/workflows/build-apk.yml # يبني الـ APK تلقائياً على GitHub Actions
├── setup.sh                        # تثبيت Termux
├── start.sh                        # تشغيل على الحاسوب
└── package.json
```

---

## 🚀 النشر على GitHub
بعد فك الضغط:

1. أنشئ مستودعاً جديداً فارغاً في حسابك على github.com (بدون README)
2. ثم:
```bash
cd wa-service-bot
git remote add origin https://github.com/USERNAME/wa-service-bot.git
git push -u origin main
```

ملاحظات:
- مجلدات `wa_auth/` و `data/` (جلسة واتساب والإعدادات) مرفوعة في `.gitignore` — **لن تُرفع أبداً**، وهذا مقصود لحماية جلستك.
- أول `commit` جاهز مسبقاً على فرع `main` — كل ما تحتاجه هو الأمران أعلاه.
- بعد الرفع سيعمل سير عمل **Build APK** تلقائياً وستجد الـ APK في Artifacts، ويمكنك إنشاء Release لتوزيعه برابط ثابت.
