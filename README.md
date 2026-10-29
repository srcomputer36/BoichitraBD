# Boichitra BD — বৈচিত্র্য | Custom E-Commerce Platform

**Tagline:** Fashion, Gadget & Everything  
**Brand Description:** "বৈচিত্র্য মানে সবকিছু এক জায়গায়! শীতের হুডি থেকে গরমের স্মার্ট গ্যাজেট, ট্রেন্ডি সব প্রোডাক্ট পাবে সিলেট থেকে সারাদেশে।"  
**Business Location:** Sylhet, Bangladesh  
**Currency:** BDT (৳) | **Timezone:** Asia/Dhaka

---

## ১. প্রজেক্ট পরিচিতি (Overview in Simple Bangla)

**Boichitra BD — বৈচিত্র্য** একটি সম্পূর্ণ কাস্টম-কোডেড ই-কমার্স প্ল্যাটফর্ম। এতে WordPress, WooCommerce বা Shopify ব্যবহার করা হয়নি।

### মূল বৈশিষ্ট্যসমূহ (Key Features):
1. **গেস্ট চেকআউট (Guest Checkout — লগইন ছাড়াই অর্ডার):** গ্রাহকরা কোনো অ্যাকাউন্ট তৈরি বা লগইন ছাড়াই পণ্য ব্রাউজ করতে এবং নাম, মোবাইল নম্বর, জেলা, উপজেলা ও ঠিকানা দিয়ে সরাসরি অর্ডার করতে পারবেন।
2. **PostgreSQL সার্ভার ডেটাবেস:** সকল পণ্য, অর্ডার, কাস্টমার রেকর্ড এবং ইনভেন্টরি স্টক সরাসরি **Google Cloud SQL (PostgreSQL)** ডেটাবেসে সংরক্ষিত হয়। ব্রাউজার `localStorage`-কে কখনোই মূল ডেটাবেস হিসেবে ব্যবহার করা হয়নি।
3. **সার্ভার-সাইড প্রাইস ও স্টক ভ্যালিডেশন:** অর্ডার করার সময় সার্ভার নিজে পণ্যের দাম, ভ্যারিয়েন্ট, কুপন ডিসকাউন্ট, ডেলিভারি চার্জ (সিলেটে ৳৬০, সারাদেশে ৳১২০, ৳৩০০০+ অর্ডারে ফ্রি) এবং স্টক যাচাই করে ডেটাবেস ট্রানজেকশনের মাধ্যমে স্টক আপডেট করে।
4. **ডুপ্লিকেট অর্ডার প্রতিরোধ (Idempotency Protection):** ইন্টারনেট ধীরগতির কারণে কেউ দুবার ক্লিক করলেও একই অর্ডার দুবার তৈরি হবে না।
5. **সংরক্ষিত অ্যাডমিন প্যানেল (`/admin`):** শুধুমাত্র অনুমোদিত অ্যাডমিন Google Sign-In (Firebase Authentication + Server-side Token Verification)-এর মাধ্যমে অ্যাডমিন প্যানেলে প্রবেশ করতে পারবেন।
6. **আসল Excel (.xlsx) ডাউনলোড:** অ্যাডমিন প্যানেল থেকে এক ক্লিকে কাস্টমার রেকর্ড এবং অর্ডার রেকর্ড বাংলা টেক্সটসহ আসল `.xlsx` ফাইলে ডাউনলোড করা যায়।

---

## ২. টেকনোলজি স্ট্যাক (Technology Stack)

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Backend:** Express.js (`server.ts`), Zod Server-Side Validation, Rate Limiting
- **Database & ORM:** PostgreSQL (Google Cloud SQL) + Drizzle ORM (`src/db/schema.ts`)
- **Authentication:** Firebase Authentication (Client) + Firebase Admin SDK (`src/lib/firebase-admin.ts`)
- **Excel Generation:** `xlsx` server-side workbook buffer generation with Formula Injection Protection

---

## ৩. সেটআপ ও চালানোর নিয়ম (Setup & Running Instructions)

### Environment Variables (`.env`):
`.env.example` ফাইলটি দেখে প্রয়োজনীয় ভেরিয়েবলগুলো কনফিগার করুন:
- `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME` (Cloud SQL রানটাইম কানেকশন)
- `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD` (Drizzle Kit স্কিমা মাইগ্রেশন)
- `ADMIN_EMAILS` (কমা দিয়ে আলাদা করা অনুমোদিত অ্যাডমিন ইমেইল তালিকা)

### কমান্ডসমূহ:
```bash
# ১. ডিপেন্ডেন্সি ইনস্টল করুন
npm install

# ২. টাইপস্ক্রিপ্ট ও কোড যাচাই করুন
npm run lint

# ৩. প্রোডাকশন বিল্ড তৈরি করুন
npm run build

# ৪. সার্ভার চালু করুন (Port 3000)
npm run dev
```

---

## ৪. অ্যাডমিন বুটস্ট্র্যাপ ও অ্যাক্সেস (Admin Bootstrap Procedure)

- স্টোরের নিচে ফুটারে থাকা **"অ্যাডমিন পোর্টাল (Admin Login)"** বাটনে ক্লিক করুন অথবা `/admin` পাথে যান।
- `ADMIN_EMAILS` এনভায়রনমেন্ট ভেরিয়েবলে থাকা অনুমোদিত ইমেইল দিয়ে Google লগইন করুন। কোনো ইউনিভার্সাল ডিফল্ট পাসওয়ার্ড রাখা হয়নি।

---

## ৫. ডেটাবেস ব্যাকআপ ও রিস্টোর (Database Backup & Restore)

- **Cloud SQL Automated Backups:** Google Cloud Console > SQL > Instance (`ai-studio-80353b61`) > **Backups** থেকে প্রতিদিনের অটোমেটেড ব্যাকআপ এবং Point-in-time recovery চালু রাখুন।
- **Excel (.xlsx) অফলাইন ব্যাকআপ:** অ্যাডমিন ড্যাশবোর্ড থেকে নিয়মিত **অর্ডার রেকর্ড ডাউনলোড (.xlsx)** এবং **কাস্টমার রেকর্ড ডাউনলোড (.xlsx)** বাটনে ক্লিক করে অফলাইন এক্সেল কপি সংরক্ষণ করুন।
