# 📦 MediaDown — محمّل الوسائط الاجتماعية

موقع لتحميل الفيديوهات والصور من منصات التواصل الاجتماعي بجودة مختارة مع تصدير ZIP.

## المنصات المدعومة
YouTube, Instagram, TikTok, Twitter/X, Facebook, Vimeo, وأكثر من 1000 موقع آخر عبر yt-dlp

---

## 🚀 التشغيل المحلي

### 1. المتطلبات
- Node.js 18+
- Python 3.7+
- pip

### 2. تثبيت المكتبات
```bash
npm install
pip install yt-dlp
```

### 3. تشغيل السيرفر
```bash
node server.js
```

### 4. افتح المتصفح
```
http://localhost:3000
```

---

## 🌐 النشر على الإنترنت (Railway.app)

1. ارفع المشروع على GitHub
2. اذهب إلى [railway.app](https://railway.app) وابدأ مشروع جديد
3. في إعدادات البيئة أضف:
   ```
   NODE_ENV=production
   ```
4. في ملف `railway.toml` أو Dockerfile أضف:
   ```bash
   pip install yt-dlp
   ```
5. Railway سيشغّل `npm start` تلقائياً

### Render.com (بديل مجاني)
1. ارفع على GitHub
2. أنشئ Web Service جديد
3. Build Command: `npm install && pip install yt-dlp`
4. Start Command: `node server.js`

---

## 📁 هيكل المشروع
```
mediadown/
├── server.js        # السيرفر الرئيسي (Express + yt-dlp)
├── package.json     # المكتبات
├── public/
│   └── index.html   # واجهة المستخدم
└── downloads/       # مجلد مؤقت للملفات (يُنظَّف تلقائياً)
```

---

## ⚙️ كيف يعمل
1. تُدخل رابط الفيديو
2. السيرفر يستدعي `yt-dlp` لجلب الجودات المتاحة
3. تختار الجودة المناسبة
4. السيرفر يحمّل الفيديو في الخلفية
5. يُضغَط الملف في ZIP وتحمّله

---

## 🔧 ملاحظات
- ملفات الـ ZIP تُحذف تلقائياً بعد 10 دقائق
- جميع الجلسات تُنظَّف كل ساعة
- لا يدعم قوائم التشغيل (Playlists) في هذا الإصدار
