import { desc, eq, asc } from 'drizzle-orm';
import { db, pool } from './index.ts';
import {
  auditLogs,
  categories,
  coupons,
  customers,
  orderItems,
  orders,
  orderStatusHistory,
  products,
  productVariants,
  storeSettings,
} from './schema.ts';
import {
  createStudioProductSvg,
  parseProductGalleryAndOffer,
  serializeProductGalleryAndOffer,
  sanitizeCustomerOfferBadge,
  sanitizeCustomerDealNote,
  sanitizeCustomerProductText,
  parseStoreSettingsWithBanglaQr,
  serializeReturnPolicyWithBanglaQr,
  calculateBanglaQrDiscountBdt,
  parseOrderNoteWithManualPayment,
  serializeOrderNoteWithManualPayment,
} from '../lib/visuals.ts';
import { normalizeBdPhone, BANGLADESH_DISTRICTS } from '../lib/bd-locations.ts';

let seedPromise: Promise<void> | null = null;

async function ensureDatabaseTablesCreated(): Promise<void> {
  // First check if the core schema tables already exist (e.g. in managed Cloud SQL).
  // If they already exist, skip DDL completely so environments without CREATE privilege
  // on schema public never throw "permission denied for schema public".
  try {
    await db.select().from(storeSettings).limit(1);
    return;
  } catch {
    // Table does not exist yet (e.g. fresh ProCloudify cPanel PostgreSQL database); proceed with auto-bootstrap.
  }

  try {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      uid TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      name TEXT DEFAULT 'Admin',
      password_hash TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'admin',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      name_bn TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      parent_id INTEGER,
      image_url TEXT DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      name_bn TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      description TEXT NOT NULL,
      description_bn TEXT NOT NULL,
      price_bdt INTEGER NOT NULL,
      sale_price_bdt INTEGER,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      image_url TEXT NOT NULL,
      gallery_urls_json TEXT NOT NULL DEFAULT '[]',
      is_featured BOOLEAN NOT NULL DEFAULT false,
      is_new_arrival BOOLEAN NOT NULL DEFAULT false,
      is_best_seller BOOLEAN NOT NULL DEFAULT false,
      is_special_offer BOOLEAN NOT NULL DEFAULT false,
      is_seasonal BOOLEAN NOT NULL DEFAULT false,
      is_published BOOLEAN NOT NULL DEFAULT true,
      seo_title TEXT DEFAULT '',
      seo_description TEXT DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS product_variants (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id),
      sku TEXT NOT NULL UNIQUE,
      size TEXT DEFAULT '',
      color TEXT DEFAULT '',
      price_adjustment_bdt INTEGER NOT NULL DEFAULT 0,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true
    );
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      customer_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT DEFAULT '',
      district TEXT NOT NULL,
      upazila TEXT NOT NULL,
      address_line TEXT NOT NULL,
      total_orders INTEGER NOT NULL DEFAULT 0,
      total_spent_bdt INTEGER NOT NULL DEFAULT 0,
      first_order_at TIMESTAMP NOT NULL DEFAULT NOW(),
      last_order_at TIMESTAMP NOT NULL DEFAULT NOW(),
      notes TEXT DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS coupons (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      discount_type TEXT NOT NULL DEFAULT 'fixed',
      discount_value INTEGER NOT NULL,
      min_order_bdt INTEGER NOT NULL DEFAULT 0,
      max_discount_bdt INTEGER,
      usage_limit INTEGER NOT NULL DEFAULT 1000,
      used_count INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      idempotency_key TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      customer_name_snapshot TEXT NOT NULL,
      customer_phone_snapshot TEXT NOT NULL,
      customer_email_snapshot TEXT DEFAULT '',
      district_snapshot TEXT NOT NULL,
      upazila_snapshot TEXT NOT NULL,
      shipping_address_snapshot TEXT NOT NULL,
      order_note TEXT DEFAULT '',
      subtotal_bdt INTEGER NOT NULL,
      delivery_charge_bdt INTEGER NOT NULL,
      discount_bdt INTEGER NOT NULL DEFAULT 0,
      coupon_code TEXT DEFAULT '',
      total_bdt INTEGER NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'COD',
      payment_status TEXT NOT NULL DEFAULT 'UNPAID',
      order_status TEXT NOT NULL DEFAULT 'Pending',
      cancellation_reason TEXT DEFAULT '',
      refund_amount_bdt INTEGER NOT NULL DEFAULT 0,
      tracking_token TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      variant_id INTEGER,
      product_name_snapshot TEXT NOT NULL,
      product_name_bn_snapshot TEXT NOT NULL,
      sku_snapshot TEXT NOT NULL,
      variant_snapshot TEXT DEFAULT 'Standard',
      unit_price_bdt INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      line_total_bdt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS order_status_history (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      previous_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      note TEXT DEFAULT '',
      changed_by_email TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS store_settings (
      id SERIAL PRIMARY KEY,
      store_name TEXT NOT NULL DEFAULT 'Boichitra BD',
      store_name_bn TEXT NOT NULL DEFAULT 'বৈচিত্র্য',
      tagline TEXT NOT NULL DEFAULT 'Fashion, Gadget & Everything',
      brand_description TEXT NOT NULL,
      contact_phone TEXT NOT NULL DEFAULT 'কনফিগারযোগ্য হেল্পলাইন',
      contact_email TEXT NOT NULL DEFAULT 'support@boichitrabd.example',
      business_address TEXT NOT NULL DEFAULT 'Sylhet, Bangladesh',
      sylhet_delivery_bdt INTEGER NOT NULL DEFAULT 60,
      outside_sylhet_delivery_bdt INTEGER NOT NULL DEFAULT 120,
      free_delivery_threshold_bdt INTEGER NOT NULL DEFAULT 3000,
      cod_enabled BOOLEAN NOT NULL DEFAULT true,
      bkash_enabled BOOLEAN NOT NULL DEFAULT false,
      nagad_enabled BOOLEAN NOT NULL DEFAULT false,
      return_policy_text TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      actor_email TEXT NOT NULL,
      actor_uid TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  } catch (ddlError: any) {
    console.warn('Skipping runtime DDL auto-bootstrap (tables managed externally):', ddlError?.message || ddlError);
  }
}

export async function ensureStoreInitialized(): Promise<void> {
  if (seedPromise) {
    return seedPromise;
  }
  seedPromise = (async () => {
    try {
      let existingSettings: (typeof storeSettings.$inferSelect)[] = [];
      let existingCategories: (typeof categories.$inferSelect)[] = [];
      let existingCoupons: (typeof coupons.$inferSelect)[] = [];
      let existingProducts: (typeof products.$inferSelect)[] = [];

      try {
        [existingSettings, existingCategories, existingCoupons, existingProducts] =
          await Promise.all([
            db.select().from(storeSettings),
            db.select().from(categories),
            db.select().from(coupons),
            db.select().from(products),
          ]);
      } catch {
        await ensureDatabaseTablesCreated();
        [existingSettings, existingCategories, existingCoupons, existingProducts] =
          await Promise.all([
            db.select().from(storeSettings),
            db.select().from(categories),
            db.select().from(coupons),
            db.select().from(products),
          ]);
      }

      if (existingSettings.length === 0) {
        await db.insert(storeSettings).values({
          storeName: 'Boichitra BD',
          storeNameBn: 'বৈচিত্র্য',
          tagline: 'Fashion, Gadget & Everything',
          brandDescription:
            'বৈচিত্র্য মানে সবকিছু এক জায়গায়! শীতের হুডি থেকে গরমের স্মার্ট গ্যাজেট, ট্রেন্ডি সব প্রোডাক্ট পাবে সিলেট থেকে সারাদেশে।',
          contactPhone: 'কনফিগারযোগ্য হেল্পলাইন (অ্যাডমিন সেটিংস থেকে নম্বর যুক্ত করুন)',
          contactEmail: 'support@boichitrabd.example',
          businessAddress: 'Sylhet, Bangladesh (সিলেট, বাংলাদেশ)',
          sylhetDeliveryBdt: 60,
          outsideSylhetDeliveryBdt: 120,
          freeDeliveryThresholdBdt: 3000,
          codEnabled: true,
          bkashEnabled: false,
          nagadEnabled: false,
          returnPolicyText:
            'ডেলিভারি পাওয়ার পর ডেলিভারি ম্যানের সামনে পণ্য চেক করে গ্রহণ করুন। ত্রুটিপূর্ণ, ছেঁড়া বা ভুল পণ্য পেলে তাৎক্ষণিক রিটার্ন বা এক্সচেঞ্জ সুবিধা পাবেন।',
        });
      }

      if (existingCategories.length === 0) {
        const insertedCats = await db
          .insert(categories)
          .values([
            {
              name: 'Winter & Urban Fashion',
              nameBn: 'উইন্টার ও ফ্যাশন ওয়্যার',
              slug: 'winter-urban-fashion',
              description: 'প্রিমিয়াম হেভিওয়েট হুডি, সোয়েটশার্ট ও ক্যাজুয়াল ফ্যাশন কালেকশন',
              sortOrder: 1,
              isActive: true,
            },
            {
              name: 'Smart Gadgets & Audio',
              nameBn: 'স্মার্ট গ্যাজেট ও অডিও',
              slug: 'smart-gadgets-audio',
              description: 'অরিজিনাল ওয়্যারলেস হেডফোন, ইয়ারবাড, পাওয়ার ব্যাংক ও ডেইলি টেক অ্যাক্সেসরিজ',
              sortOrder: 2,
              isActive: true,
            },
            {
              name: 'Watches & Wearables',
              nameBn: 'স্মার্টওয়াচ ও ঘড়ি',
              slug: 'watches-wearables',
              description: 'অ্যামোলেড স্মার্টওয়াচ, ফিটনেস ট্র্যাকার ও ক্লাসিক রিস্টওয়াচ',
              sortOrder: 3,
              isActive: true,
            },
            {
              name: 'Traditional & Festive',
              nameBn: 'পাঞ্জাবি ও ফেস্টিভ কালেকশন',
              slug: 'traditional-festive',
              description: 'উন্নত সুতি ও এমব্রয়ডারি পাঞ্জাবি এবং সিজনাল এথনিক কালেকশন',
              sortOrder: 4,
              isActive: true,
            },
            {
              name: 'Lifestyle & Travel Gear',
              nameBn: 'লাইফস্টাইল ও ট্রাভেল ব্যাগ',
              slug: 'lifestyle-travel-gear',
              description: 'ওয়াটার-রেজিস্ট্যান্ট ল্যাপটপ ব্যাকপ্যাক, সানগ্লাস ও ট্রাভেল অ্যাক্সেসরিজ',
              sortOrder: 5,
              isActive: true,
            },
          ])
          .returning();

        const catMap = new Map(insertedCats.map((c) => [c.slug, c.id]));

        const insertedProducts = await db
          .insert(products)
          .values([
            {
              sku: 'BBD-HD-101',
              name: 'Arctic Fleece Heavyweight Pullover Hoodie',
              nameBn: 'আর্কটিক ফ্লিস হেভিওয়েট প্রিমিয়াম হুডি (নেভি ব্লু)',
              slug: 'arctic-fleece-heavyweight-hoodie',
              categoryId: catMap.get('winter-urban-fashion')!,
              description:
                '340 GSM brushed cotton-fleece winter hoodie engineered for warmth and breathable comfort across Sylhet & nationwide winters. Features double-stitched seams, ribbed cuffs, and a kangaroo pocket.',
              descriptionBn:
                '৩৪০ জিএসএম ব্রাশড কটন-ফ্লিস ফেব্রিকে তৈরি প্রিমিয়াম শীতের হুডি। আরামদায়ক ওয়ার্মথ, ডাবল স্টিচিং এবং টেকসই কালার গ্যারান্টিসহ প্রতিদিনের ব্যবহারের জন্য আদর্শ।',
              priceBdt: 1650,
              salePriceBdt: 1390,
              stockQuantity: 45,
              lowStockThreshold: 8,
              imageUrl: createStudioProductSvg('hoodie', '#14213D', '#286F65', 'HEAVYWEIGHT FLEECE 340 GSM'),
              galleryUrlsJson: JSON.stringify([
                createStudioProductSvg('hoodie', '#14213D', '#286F65', 'FRONT STUDIO VIEW'),
                createStudioProductSvg('hoodie', '#1e293b', '#16A34A', 'CHARCOAL VARIANT'),
              ]),
              isFeatured: true,
              isNewArrival: true,
              isBestSeller: true,
              isSpecialOffer: true,
              isSeasonal: true,
              isPublished: true,
              seoTitle: 'Arctic Fleece Heavyweight Pullover Hoodie | Boichitra BD',
              seoDescription: '340 GSM premium winter hoodie available in M, L, XL, XXL across Bangladesh.',
            },
            {
              sku: 'BBD-GD-201',
              name: 'SonicWave ANC Pro Wireless Headphones',
              nameBn: 'সনিকওয়েভ এএনসি প্রো ওয়্যারলেস হেডফোন',
              slug: 'sonicwave-anc-pro-wireless-headphones',
              categoryId: catMap.get('smart-gadgets-audio')!,
              description:
                'Hybrid Active Noise Cancelling over-ear headphones with 45-hour battery backup, Type-C fast charge, low-latency mode, and plush memory-foam ear cushions.',
              descriptionBn:
                'হাইব্রিড অ্যাক্টিভ নয়েজ ক্যান্সেলিং ওয়্যারলেস হেডফোন। এক চার্জে ৪৫ ঘণ্টা ব্যাকআপ, টাইপ-সি ফাস্ট চার্জিং এবং মেমোরি ফোম ইয়ার কুশন।',
              priceBdt: 3450,
              salePriceBdt: 2890,
              stockQuantity: 28,
              lowStockThreshold: 5,
              imageUrl: createStudioProductSvg('headphones', '#14213D', '#286F65', 'HYBRID ANC 45H BATTERY'),
              galleryUrlsJson: JSON.stringify([
                createStudioProductSvg('headphones', '#14213D', '#286F65', 'MATTE BLACK EDITION'),
              ]),
              isFeatured: true,
              isNewArrival: true,
              isBestSeller: true,
              isSpecialOffer: false,
              isSeasonal: false,
              isPublished: true,
              seoTitle: 'SonicWave ANC Pro Wireless Headphones | Boichitra BD',
              seoDescription: '45-hour battery hybrid ANC wireless headphones in Bangladesh.',
            },
            {
              sku: 'BBD-WT-301',
              name: 'ChronoFit AMOLED Titanium Smartwatch',
              nameBn: 'ক্রোনোফিট অ্যামোলেড টাইটানিয়াম স্মার্টওয়াচ',
              slug: 'chronofit-amoled-titanium-smartwatch',
              categoryId: catMap.get('watches-wearables')!,
              description:
                '1.96-inch Always-On AMOLED display smartwatch with Bluetooth calling, IP68 water resistance, heart-rate & SpO2 health tracking, and 7-day battery endurance.',
              descriptionBn:
                '১.৯৬ ইঞ্চি অলওয়েজ-অন অ্যামোলেড ডিসপ্লে স্মার্টওয়াচ। ব্লুটুথ কলিং, আইপি৬৮ ওয়াটার রেজিস্ট্যান্স এবং ৭ দিনের ব্যাটারি ব্যাকআপ।',
              priceBdt: 2950,
              salePriceBdt: 2450,
              stockQuantity: 32,
              lowStockThreshold: 5,
              imageUrl: createStudioProductSvg('smartwatch', '#14213D', '#286F65', 'AMOLED BLUETOOTH CALLING'),
              galleryUrlsJson: JSON.stringify([
                createStudioProductSvg('smartwatch', '#14213D', '#286F65', 'FOREST TEAL STRAP'),
              ]),
              isFeatured: true,
              isNewArrival: false,
              isBestSeller: true,
              isSpecialOffer: true,
              isSeasonal: false,
              isPublished: true,
              seoTitle: 'ChronoFit AMOLED Smartwatch | Boichitra BD',
              seoDescription: 'AMOLED Bluetooth calling smartwatch with IP68 protection.',
            },
            {
              sku: 'BBD-PJ-401',
              name: 'Sylhet Heritage Textured Cotton Panjabi',
              nameBn: 'সিলেট হেরিটেজ টেক্সচার্ড কটন প্রিমিয়াম পাঞ্জাবি',
              slug: 'sylhet-heritage-textured-cotton-panjabi',
              categoryId: catMap.get('traditional-festive')!,
              description:
                'Breathable combed cotton festive Panjabi in deep emerald teal with minimalist tonal placket embroidery and relaxed tailored fit for all-day comfort.',
              descriptionBn:
                'উন্নত মানের কম্বেড সুতি কাপড়ে তৈরি ডিপ এমারেল্ড টিল রঙের প্রিমিয়াম পাঞ্জাবি। সূক্ষ্ম এমব্রয়ডারি ও আরামদায়ক ফিট।',
              priceBdt: 1950,
              salePriceBdt: 1690,
              stockQuantity: 40,
              lowStockThreshold: 6,
              imageUrl: createStudioProductSvg('panjabi', '#14213D', '#286F65', 'COMBED COTTON TAILORED FIT'),
              galleryUrlsJson: JSON.stringify([
                createStudioProductSvg('panjabi', '#14213D', '#286F65', 'EMERALD TEAL EDITION'),
              ]),
              isFeatured: true,
              isNewArrival: true,
              isBestSeller: false,
              isSpecialOffer: false,
              isSeasonal: true,
              isPublished: true,
              seoTitle: 'Sylhet Heritage Textured Cotton Panjabi | Boichitra BD',
              seoDescription: 'Premium combed cotton Panjabi available in sizes 40, 42, 44.',
            },
            {
              sku: 'BBD-GD-202',
              name: 'VoltCore 20000mAh 22.5W Fast Power Bank',
              nameBn: 'ভোল্টকোর ২০০০০ এমএএইচ ২২.৫ ওয়াট ফাস্ট পাওয়ার ব্যাংক',
              slug: 'voltcore-20000mah-fast-powerbank',
              categoryId: catMap.get('smart-gadgets-audio')!,
              description:
                'High-density 20000mAh lithium-polymer power bank with LED digital percentage display, PD 20W & QC 22.5W dual fast output, and multi-layer surge protection.',
              descriptionBn:
                'ডিজিটাল এলইডি ডিসপ্লে সহ ২০০০০ এমএএইচ ফাস্ট চার্জিং পাওয়ার ব্যাংক। পিডি ২০ ওয়াট ও কিউসি ২২.৫ ওয়াট ডুয়াল আউটপুট।',
              priceBdt: 1850,
              salePriceBdt: 1550,
              stockQuantity: 50,
              lowStockThreshold: 10,
              imageUrl: createStudioProductSvg('powerbank', '#14213D', '#16A34A', '20000mAh 22.5W PD FAST CHARGE'),
              galleryUrlsJson: JSON.stringify([]),
              isFeatured: true,
              isNewArrival: false,
              isBestSeller: true,
              isSpecialOffer: true,
              isSeasonal: false,
              isPublished: true,
              seoTitle: 'VoltCore 20000mAh 22.5W Fast Power Bank | Boichitra BD',
              seoDescription: '20000mAh fast charging power bank with LED display.',
            },
            {
              sku: 'BBD-BG-501',
              name: 'MetroShield Water-Resistant 15.6" Laptop Backpack',
              nameBn: 'মেট্রোশিল্ড ওয়াটার-রেজিস্ট্যান্ট ল্যাপটপ ব্যাকপ্যাক',
              slug: 'metroshield-water-resistant-laptop-backpack',
              categoryId: catMap.get('lifestyle-travel-gear')!,
              description:
                'Durable Oxford ballistic nylon commuter backpack with padded 15.6-inch laptop compartment, hidden anti-theft pocket, and ergonomic airflow back panel.',
              descriptionBn:
                'ওয়াটার-রেজিস্ট্যান্ট অক্সফোর্ড ফেব্রিকে তৈরি ১৫.৬ ইঞ্চি ল্যাপটপ ব্যাকপ্যাক। অ্যান্টি-থেফট পকেট এবং আরামদায়ক শোল্ডার স্ট্র্যাপ।',
              priceBdt: 2100,
              salePriceBdt: 1790,
              stockQuantity: 22,
              lowStockThreshold: 5,
              imageUrl: createStudioProductSvg('backpack', '#14213D', '#286F65', '15.6" WATER-RESISTANT OXFORD'),
              galleryUrlsJson: JSON.stringify([]),
              isFeatured: true,
              isNewArrival: true,
              isBestSeller: false,
              isSpecialOffer: false,
              isSeasonal: false,
              isPublished: true,
              seoTitle: 'MetroShield 15.6 Laptop Backpack | Boichitra BD',
              seoDescription: 'Water-resistant commuter laptop backpack in Bangladesh.',
            },
            {
              sku: 'BBD-GD-203',
              name: 'AeroPods ENC Quad-Mic True Wireless Earbuds',
              nameBn: 'এয়ারোপডস ইএনসি কোয়াড-মাইক ট্রু ওয়্যারলেস ইয়ারবাডস',
              slug: 'aeropods-enc-true-wireless-earbuds',
              categoryId: catMap.get('smart-gadgets-audio')!,
              description:
                'Bluetooth 5.3 True Wireless Earbuds with Quad-Mic Environmental Noise Cancellation for crystal clear calls, 30-hour total playtime, and 45ms gaming mode.',
              descriptionBn:
                'ব্লুটুথ ৫.৩ এবং কোয়াড-মাইক ইএনসি প্রযুক্তির ট্রু ওয়্যারলেস ইয়ারবাডস। স্পষ্ট কল কোয়ালিটি এবং ৩০ ঘণ্টা প্লেটাইম।',
              priceBdt: 1450,
              salePriceBdt: 1190,
              stockQuantity: 60,
              lowStockThreshold: 10,
              imageUrl: createStudioProductSvg('earbuds', '#14213D', '#286F65', 'BT 5.3 QUAD-MIC ENC'),
              galleryUrlsJson: JSON.stringify([]),
              isFeatured: false,
              isNewArrival: true,
              isBestSeller: true,
              isSpecialOffer: true,
              isSeasonal: false,
              isPublished: true,
              seoTitle: 'AeroPods ENC Wireless Earbuds | Boichitra BD',
              seoDescription: 'Quad-mic ENC true wireless earbuds with 30h battery life.',
            },
            {
              sku: 'BBD-FS-102',
              name: 'Combed Cotton Drop-Shoulder Heavy Tee',
              nameBn: 'প্রিমিয়াম কম্বেড কটন ড্রপ-শোল্ডার টি-শার্ট',
              slug: 'combed-cotton-drop-shoulder-heavy-tee',
              categoryId: catMap.get('winter-urban-fashion')!,
              description:
                '220 GSM 100% ring-spun combed cotton relaxed drop-shoulder t-shirt with enzyme wash finish for summer & year-round streetwear styling.',
              descriptionBn:
                '২২০ জিএসএম ১০০% রিং-স্পান সুতি কাপড়ের আরামদায়ক ড্রপ-শোল্ডার টি-শার্ট। গরম ও সারা বছরের ক্যাজুয়াল স্টাইলের জন্য সেরা।',
              priceBdt: 850,
              salePriceBdt: 690,
              stockQuantity: 75,
              lowStockThreshold: 10,
              imageUrl: createStudioProductSvg('tshirt', '#14213D', '#286F65', '220 GSM RING-SPUN COTTON'),
              galleryUrlsJson: JSON.stringify([]),
              isFeatured: false,
              isNewArrival: true,
              isBestSeller: true,
              isSpecialOffer: false,
              isSeasonal: true,
              isPublished: true,
              seoTitle: 'Combed Cotton Drop-Shoulder Tee | Boichitra BD',
              seoDescription: '220 GSM heavy cotton drop-shoulder t-shirt in Bangladesh.',
            },
          ])
          .returning();

        const prodBySku = new Map(insertedProducts.map((p) => [p.sku, p]));

        // Insert Product Variants for Fashion & Wearable products
        const hoodie = prodBySku.get('BBD-HD-101')!;
        const panjabi = prodBySku.get('BBD-PJ-401')!;
        const tee = prodBySku.get('BBD-FS-102')!;
        const watch = prodBySku.get('BBD-WT-301')!;

        await db.insert(productVariants).values([
          // Hoodie (BBD-HD-101): Navy Blue, Charcoal, Forest Teal across M, L, XL, XXL
          { productId: hoodie.id, sku: 'BBD-HD-101-M-NVY', size: 'M', color: 'Navy Blue', priceAdjustmentBdt: 0, stockQuantity: 12 },
          { productId: hoodie.id, sku: 'BBD-HD-101-L-NVY', size: 'L', color: 'Navy Blue', priceAdjustmentBdt: 0, stockQuantity: 15 },
          { productId: hoodie.id, sku: 'BBD-HD-101-XL-NVY', size: 'XL', color: 'Navy Blue', priceAdjustmentBdt: 0, stockQuantity: 10 },
          { productId: hoodie.id, sku: 'BBD-HD-101-XXL-NVY', size: 'XXL', color: 'Navy Blue', priceAdjustmentBdt: 50, stockQuantity: 8 },
          { productId: hoodie.id, sku: 'BBD-HD-101-M-CHC', size: 'M', color: 'Charcoal', priceAdjustmentBdt: 0, stockQuantity: 10 },
          { productId: hoodie.id, sku: 'BBD-HD-101-L-CHC', size: 'L', color: 'Charcoal', priceAdjustmentBdt: 0, stockQuantity: 12 },
          { productId: hoodie.id, sku: 'BBD-HD-101-XL-CHC', size: 'XL', color: 'Charcoal', priceAdjustmentBdt: 0, stockQuantity: 10 },
          { productId: hoodie.id, sku: 'BBD-HD-101-XXL-CHC', size: 'XXL', color: 'Charcoal', priceAdjustmentBdt: 50, stockQuantity: 8 },
          { productId: hoodie.id, sku: 'BBD-HD-101-M-TL', size: 'M', color: 'Forest Teal', priceAdjustmentBdt: 0, stockQuantity: 9 },
          { productId: hoodie.id, sku: 'BBD-HD-101-L-TL', size: 'L', color: 'Forest Teal', priceAdjustmentBdt: 0, stockQuantity: 11 },
          { productId: hoodie.id, sku: 'BBD-HD-101-XL-TL', size: 'XL', color: 'Forest Teal', priceAdjustmentBdt: 0, stockQuantity: 8 },
          // Panjabi (BBD-PJ-401): Emerald Teal, Royal Navy, Maroon Red across 40 (M), 42 (L), 44 (XL)
          { productId: panjabi.id, sku: 'BBD-PJ-401-40-EMR', size: '40 (M)', color: 'Emerald Teal', priceAdjustmentBdt: 0, stockQuantity: 14 },
          { productId: panjabi.id, sku: 'BBD-PJ-401-42-EMR', size: '42 (L)', color: 'Emerald Teal', priceAdjustmentBdt: 0, stockQuantity: 16 },
          { productId: panjabi.id, sku: 'BBD-PJ-401-44-EMR', size: '44 (XL)', color: 'Emerald Teal', priceAdjustmentBdt: 0, stockQuantity: 10 },
          { productId: panjabi.id, sku: 'BBD-PJ-401-40-NVY', size: '40 (M)', color: 'Royal Navy', priceAdjustmentBdt: 0, stockQuantity: 12 },
          { productId: panjabi.id, sku: 'BBD-PJ-401-42-NVY', size: '42 (L)', color: 'Royal Navy', priceAdjustmentBdt: 0, stockQuantity: 14 },
          { productId: panjabi.id, sku: 'BBD-PJ-401-44-NVY', size: '44 (XL)', color: 'Royal Navy', priceAdjustmentBdt: 0, stockQuantity: 9 },
          { productId: panjabi.id, sku: 'BBD-PJ-401-40-MRN', size: '40 (M)', color: 'Maroon Red', priceAdjustmentBdt: 0, stockQuantity: 10 },
          { productId: panjabi.id, sku: 'BBD-PJ-401-42-MRN', size: '42 (L)', color: 'Maroon Red', priceAdjustmentBdt: 0, stockQuantity: 12 },
          { productId: panjabi.id, sku: 'BBD-PJ-401-44-MRN', size: '44 (XL)', color: 'Maroon Red', priceAdjustmentBdt: 0, stockQuantity: 8 },
          // Drop-Shoulder Heavy Tee (BBD-FS-102): Deep Navy, Teal Green, Jet Black across M, L, XL, XXL
          { productId: tee.id, sku: 'BBD-FS-102-M-NVY', size: 'M', color: 'Deep Navy', priceAdjustmentBdt: 0, stockQuantity: 25 },
          { productId: tee.id, sku: 'BBD-FS-102-L-NVY', size: 'L', color: 'Deep Navy', priceAdjustmentBdt: 0, stockQuantity: 30 },
          { productId: tee.id, sku: 'BBD-FS-102-XL-NVY', size: 'XL', color: 'Deep Navy', priceAdjustmentBdt: 0, stockQuantity: 20 },
          { productId: tee.id, sku: 'BBD-FS-102-XXL-NVY', size: 'XXL', color: 'Deep Navy', priceAdjustmentBdt: 0, stockQuantity: 15 },
          { productId: tee.id, sku: 'BBD-FS-102-M-OLV', size: 'M', color: 'Teal Green', priceAdjustmentBdt: 0, stockQuantity: 18 },
          { productId: tee.id, sku: 'BBD-FS-102-L-OLV', size: 'L', color: 'Teal Green', priceAdjustmentBdt: 0, stockQuantity: 22 },
          { productId: tee.id, sku: 'BBD-FS-102-XL-OLV', size: 'XL', color: 'Teal Green', priceAdjustmentBdt: 0, stockQuantity: 20 },
          { productId: tee.id, sku: 'BBD-FS-102-XXL-OLV', size: 'XXL', color: 'Teal Green', priceAdjustmentBdt: 0, stockQuantity: 12 },
          { productId: tee.id, sku: 'BBD-FS-102-M-BLK', size: 'M', color: 'Jet Black', priceAdjustmentBdt: 0, stockQuantity: 20 },
          { productId: tee.id, sku: 'BBD-FS-102-L-BLK', size: 'L', color: 'Jet Black', priceAdjustmentBdt: 0, stockQuantity: 24 },
          { productId: tee.id, sku: 'BBD-FS-102-XL-BLK', size: 'XL', color: 'Jet Black', priceAdjustmentBdt: 0, stockQuantity: 18 },
          // Smartwatch (BBD-WT-301)
          { productId: watch.id, sku: 'BBD-WT-301-STD-GRN', size: '46mm', color: 'Forest Teal Strap', priceAdjustmentBdt: 0, stockQuantity: 18 },
          { productId: watch.id, sku: 'BBD-WT-301-STD-BLK', size: '46mm', color: 'Obsidian Black Strap', priceAdjustmentBdt: 0, stockQuantity: 14 },
        ]);
        existingProducts = insertedProducts;
      }

      if (existingCoupons.length === 0) {
        await db.insert(coupons).values([
          {
            code: 'SYLHET100',
            description: '৳1,500+ অর্ডারে ৳১০০ বিশেষ ডিসকাউন্ট',
            discountType: 'fixed',
            discountValue: 100,
            minOrderBdt: 1500,
            maxDiscountBdt: 100,
            usageLimit: 1000,
            usedCount: 0,
            isActive: true,
          },
          {
            code: 'BOICHITRA10',
            description: '৳2,000+ অর্ডারে ১০% ছাড় (সর্বোচ্চ ৳৩০০)',
            discountType: 'percentage',
            discountValue: 10,
            minOrderBdt: 2000,
            maxDiscountBdt: 300,
            usageLimit: 500,
            usedCount: 0,
            isActive: true,
          },
        ]);
      }

      // Enrich existing products that still have empty gallery_urls_json ('[]') with multi-angle studio images & special offer metadata
      const allProds = existingProducts;
      for (const p of allProds) {
        if (!p.galleryUrlsJson || p.galleryUrlsJson === '[]') {
          const presetType = p.sku.includes('FS-101')
            ? 'hoodie'
            : p.sku.includes('GD-201')
            ? 'headphones'
            : p.sku.includes('WT-301')
            ? 'smartwatch'
            : p.sku.includes('TR-401')
            ? 'panjabi'
            : p.sku.includes('GD-202')
            ? 'powerbank'
            : p.sku.includes('LF-501')
            ? 'backpack'
            : p.sku.includes('GD-203')
            ? 'earbuds'
            : 'tshirt';

          const galleryPayload = serializeProductGalleryAndOffer(
            [
              {
                id: `${p.sku}-angle-1`,
                url: createStudioProductSvg(presetType, '#1E293B', '#16A34A', `${p.sku} · SIDE VIEW`),
                type: 'image',
                title: 'সাইড ভিউ (Side Angle)',
              },
              {
                id: `${p.sku}-angle-2`,
                url: createStudioProductSvg(presetType, '#286F65', '#14213D', `${p.sku} · DETAIL VIEW`),
                type: 'image',
                title: 'ক্লোজ-আপ ডিটেইল (Detail Shot)',
              },
            ],
            p.isSpecialOffer
              ? {
                  badgeText: '🔥 ফ্ল্যাশ ডিল',
                  offerEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
                  dealNote: 'সীমিত সময়ের বিশেষ ছাড় · ক্যাশ অন ডেলিভারি সুবিধা',
                  promoCouponCode: 'SYLHET100',
                }
              : {}
          );

          await db
            .update(products)
            .set({ galleryUrlsJson: galleryPayload })
            .where(eq(products.id, p.id));
        }
      }

      // Ensure existing clothing products have full multi-color x multi-size variants
      const existingVars = await db.select().from(productVariants);
      const existingVarSkus = new Set(existingVars.map((v) => v.sku.toUpperCase()));
      const prodBySkuMap = new Map(allProds.map((p) => [p.sku, p]));

      const extraClothingVariants: Array<{
        productSku: string;
        sku: string;
        size: string;
        color: string;
        priceAdjustmentBdt: number;
        stockQuantity: number;
      }> = [
        { productSku: 'BBD-HD-101', sku: 'BBD-HD-101-XXL-NVY', size: 'XXL', color: 'Navy Blue', priceAdjustmentBdt: 50, stockQuantity: 8 },
        { productSku: 'BBD-HD-101', sku: 'BBD-HD-101-M-CHC', size: 'M', color: 'Charcoal', priceAdjustmentBdt: 0, stockQuantity: 10 },
        { productSku: 'BBD-HD-101', sku: 'BBD-HD-101-L-CHC', size: 'L', color: 'Charcoal', priceAdjustmentBdt: 0, stockQuantity: 12 },
        { productSku: 'BBD-HD-101', sku: 'BBD-HD-101-XL-CHC', size: 'XL', color: 'Charcoal', priceAdjustmentBdt: 0, stockQuantity: 10 },
        { productSku: 'BBD-HD-101', sku: 'BBD-HD-101-M-TL', size: 'M', color: 'Forest Teal', priceAdjustmentBdt: 0, stockQuantity: 9 },
        { productSku: 'BBD-HD-101', sku: 'BBD-HD-101-L-TL', size: 'L', color: 'Forest Teal', priceAdjustmentBdt: 0, stockQuantity: 11 },
        { productSku: 'BBD-HD-101', sku: 'BBD-HD-101-XL-TL', size: 'XL', color: 'Forest Teal', priceAdjustmentBdt: 0, stockQuantity: 8 },
        { productSku: 'BBD-PJ-401', sku: 'BBD-PJ-401-40-NVY', size: '40 (M)', color: 'Royal Navy', priceAdjustmentBdt: 0, stockQuantity: 12 },
        { productSku: 'BBD-PJ-401', sku: 'BBD-PJ-401-42-NVY', size: '42 (L)', color: 'Royal Navy', priceAdjustmentBdt: 0, stockQuantity: 14 },
        { productSku: 'BBD-PJ-401', sku: 'BBD-PJ-401-44-NVY', size: '44 (XL)', color: 'Royal Navy', priceAdjustmentBdt: 0, stockQuantity: 9 },
        { productSku: 'BBD-PJ-401', sku: 'BBD-PJ-401-40-MRN', size: '40 (M)', color: 'Maroon Red', priceAdjustmentBdt: 0, stockQuantity: 10 },
        { productSku: 'BBD-PJ-401', sku: 'BBD-PJ-401-42-MRN', size: '42 (L)', color: 'Maroon Red', priceAdjustmentBdt: 0, stockQuantity: 12 },
        { productSku: 'BBD-PJ-401', sku: 'BBD-PJ-401-44-MRN', size: '44 (XL)', color: 'Maroon Red', priceAdjustmentBdt: 0, stockQuantity: 8 },
        { productSku: 'BBD-FS-102', sku: 'BBD-FS-102-XL-NVY', size: 'XL', color: 'Deep Navy', priceAdjustmentBdt: 0, stockQuantity: 20 },
        { productSku: 'BBD-FS-102', sku: 'BBD-FS-102-XXL-NVY', size: 'XXL', color: 'Deep Navy', priceAdjustmentBdt: 0, stockQuantity: 15 },
        { productSku: 'BBD-FS-102', sku: 'BBD-FS-102-M-OLV', size: 'M', color: 'Teal Green', priceAdjustmentBdt: 0, stockQuantity: 18 },
        { productSku: 'BBD-FS-102', sku: 'BBD-FS-102-L-OLV', size: 'L', color: 'Teal Green', priceAdjustmentBdt: 0, stockQuantity: 22 },
        { productSku: 'BBD-FS-102', sku: 'BBD-FS-102-XXL-OLV', size: 'XXL', color: 'Teal Green', priceAdjustmentBdt: 0, stockQuantity: 12 },
        { productSku: 'BBD-FS-102', sku: 'BBD-FS-102-M-BLK', size: 'M', color: 'Jet Black', priceAdjustmentBdt: 0, stockQuantity: 20 },
        { productSku: 'BBD-FS-102', sku: 'BBD-FS-102-L-BLK', size: 'L', color: 'Jet Black', priceAdjustmentBdt: 0, stockQuantity: 24 },
        { productSku: 'BBD-FS-102', sku: 'BBD-FS-102-XL-BLK', size: 'XL', color: 'Jet Black', priceAdjustmentBdt: 0, stockQuantity: 18 },
      ];

      for (const ev of extraClothingVariants) {
        if (!existingVarSkus.has(ev.sku)) {
          const targetProd = prodBySkuMap.get(ev.productSku);
          if (targetProd) {
            await db.insert(productVariants).values({
              productId: targetProd.id,
              sku: ev.sku,
              size: ev.size,
              color: ev.color,
              priceAdjustmentBdt: ev.priceAdjustmentBdt,
              stockQuantity: ev.stockQuantity,
              isActive: true,
            });
          }
        }
      }

      // Sanitize any existing products in DB that contain supplier/reseller tags (e.g., BusinessKoro বেস্টসেলার, রিসেলার হিট কালেকশন, পাইকারি মূল্যের ওপর)
      const latestProds = await db.select().from(products);
      for (const prod of latestProds) {
        const cleanedName = sanitizeCustomerProductText(prod.name) || prod.name;
        const cleanedNameBn = sanitizeCustomerProductText(prod.nameBn) || prod.nameBn;
        const cleanedDesc = sanitizeCustomerProductText(prod.description) || prod.description;
        const cleanedDescBn = sanitizeCustomerProductText(prod.descriptionBn) || prod.descriptionBn;
        const parsedGallery = parseProductGalleryAndOffer(prod);
        const cleanedGalleryJson = serializeProductGalleryAndOffer(
          parsedGallery.media,
          parsedGallery.offerMeta
        );

        if (
          cleanedName !== prod.name ||
          cleanedNameBn !== prod.nameBn ||
          cleanedDesc !== prod.description ||
          cleanedDescBn !== prod.descriptionBn ||
          (prod.galleryUrlsJson &&
            (prod.galleryUrlsJson.includes('BusinessKoro') ||
              prod.galleryUrlsJson.includes('বিজনেস করো') ||
              prod.galleryUrlsJson.includes('রিসেলার') ||
              prod.galleryUrlsJson.includes('পাইকারি')))
        ) {
          let preservedGalleryJson = cleanedGalleryJson;
          try {
            const origParsed = JSON.parse(prod.galleryUrlsJson || '{}');
            const cleanParsed = JSON.parse(cleanedGalleryJson);
            if (origParsed && origParsed.bkrProductId) {
              cleanParsed.bkrProductId = origParsed.bkrProductId;
              cleanParsed.bkrMinimumSellingPrice = origParsed.bkrMinimumSellingPrice;
              preservedGalleryJson = JSON.stringify(cleanParsed);
            }
          } catch (_e) {}

          await db
            .update(products)
            .set({
              name: cleanedName,
              nameBn: cleanedNameBn,
              description: cleanedDesc,
              descriptionBn: cleanedDescBn,
              galleryUrlsJson: preservedGalleryJson,
              seoTitle: sanitizeCustomerProductText(prod.seoTitle || cleanedNameBn),
              seoDescription: sanitizeCustomerProductText(prod.seoDescription || cleanedDescBn),
            })
            .where(eq(products.id, prod.id));
        }
      }

      // Automatically sync real catalog from BusinessKoro Storefront API on startup if not yet synced
      const hasLiveBkrProducts = latestProds.some((p) => {
        try {
          const parsed = JSON.parse(p.galleryUrlsJson || '{}');
          return Boolean(parsed && parsed.bkrProductId);
        } catch (_e) {
          return false;
        }
      });
      if (!hasLiveBkrProducts) {
        try {
          await syncBusinessKoroProductsInternal('system@boichitrabd.com', 'system', {
            markupPercentage: 0,
            fixedMarkupBdt: 0,
            autoPublish: true,
            updateExistingPrices: true,
          });
        } catch (syncErr) {
          console.warn('Initial BusinessKoro auto-sync skipped:', syncErr);
        }
      }
    } catch (error) {
      seedPromise = null;
      console.error('Database initialization failed:', error);
      throw new Error('Failed to initialize store database.', { cause: error });
    }
  })();

  return seedPromise;
}

export async function getStorefrontData() {
  try {
    await ensureStoreInitialized();
    const [settingsRows, categoryRows, productRows, variantRows, couponRows] = await Promise.all([
      db.select().from(storeSettings),
      db.select().from(categories).orderBy(asc(categories.sortOrder)),
      db.select().from(products).orderBy(desc(products.createdAt)),
      db.select().from(productVariants),
      db.select().from(coupons),
    ]);

    const activeCategories = categoryRows.filter((c) => c.isActive);
    const activeVariantsByProduct = new Map<number, typeof variantRows>();
    for (const v of variantRows) {
      if (!v.isActive) continue;
      const list = activeVariantsByProduct.get(v.productId) || [];
      list.push(v);
      activeVariantsByProduct.set(v.productId, list);
    }

    const catById = new Map(categoryRows.map((c) => [c.id, c]));

    const publishedProducts = productRows
      .filter((p) => p.isPublished)
      .map((p) => {
        const parsedGallery = parseProductGalleryAndOffer(p);
        const sanitizedGalleryJson = serializeProductGalleryAndOffer(
          parsedGallery.media,
          parsedGallery.offerMeta
        );
        return {
          ...p,
          name: sanitizeCustomerProductText(p.name) || p.name,
          nameBn: sanitizeCustomerProductText(p.nameBn) || p.nameBn,
          description: sanitizeCustomerProductText(p.description) || p.description,
          descriptionBn: sanitizeCustomerProductText(p.descriptionBn) || p.descriptionBn,
          galleryUrlsJson: sanitizedGalleryJson,
          categoryName: catById.get(p.categoryId)?.name || 'General',
          categoryNameBn: catById.get(p.categoryId)?.nameBn || 'সাধারণ',
          categorySlug: catById.get(p.categoryId)?.slug || 'general',
          variants: activeVariantsByProduct.get(p.id) || [],
        };
      });

    return {
      settings: parseStoreSettingsWithBanglaQr(settingsRows[0]),
      categories: activeCategories,
      products: publishedProducts,
      coupons: couponRows.filter((c) => c.isActive && c.usedCount < c.usageLimit),
    };
  } catch (error) {
    console.error('Failed to load storefront data:', error);
    throw new Error('স্টোরের তথ্য লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।', { cause: error });
  }
}

export async function validateCouponOnServer(code: string, subtotalBdt: number) {
  try {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      return { valid: false, discountBdt: 0, message: 'কুপন কোড লিখুন।' };
    }
    const allCoupons = await db.select().from(coupons).where(eq(coupons.code, cleanCode));
    const coupon = allCoupons[0];
    if (!coupon || !coupon.isActive) {
      return { valid: false, discountBdt: 0, message: 'কুপন কোডটি সঠিক নয় বা মেয়াদ শেষ হয়েছে।' };
    }
    if (coupon.usedCount >= coupon.usageLimit) {
      return { valid: false, discountBdt: 0, message: 'এই কুপন কোডের ব্যবহারের সীমা শেষ হয়ে গেছে।' };
    }
    if (subtotalBdt < coupon.minOrderBdt) {
      return {
        valid: false,
        discountBdt: 0,
        message: `এই কুপনটি ব্যবহার করতে ন্যূনতম ৳${coupon.minOrderBdt} টাকার অর্ডার প্রয়োজন।`,
      };
    }

    let discountBdt = 0;
    if (coupon.discountType === 'percentage') {
      discountBdt = Math.round((subtotalBdt * coupon.discountValue) / 100);
      if (coupon.maxDiscountBdt && discountBdt > coupon.maxDiscountBdt) {
        discountBdt = coupon.maxDiscountBdt;
      }
    } else {
      discountBdt = coupon.discountValue;
    }

    if (discountBdt > subtotalBdt) {
      discountBdt = subtotalBdt;
    }

    return {
      valid: true,
      code: coupon.code,
      discountBdt,
      description: coupon.description,
      message: `কুপন "${coupon.code}" প্রযোজ্য হয়েছে! আপনি ৳${discountBdt} ছাড় পেয়েছেন।`,
    };
  } catch (error) {
    console.error('Error validating coupon:', error);
    throw new Error('কুপন যাচাই করতে সমস্যা হয়েছে।', { cause: error });
  }
}

export interface GuestCheckoutInput {
  idempotencyKey: string;
  fullName: string;
  phone: string;
  email?: string;
  district: string;
  upazila: string;
  addressLine: string;
  orderNote?: string;
  paymentMethod: 'COD' | 'BANGLA_QR';
  paymentSenderPhone?: string;
  paymentTransactionId?: string;
  paymentScreenshotUrl?: string;
  couponCode?: string;
  items: Array<{
    productId: number;
    variantId?: number | null;
    quantity: number;
  }>;
}

export async function createGuestOrder(input: GuestCheckoutInput) {
  try {
    const normalizedPhone = normalizeBdPhone(input.phone);

    // 1. Check Idempotency outside & inside transaction to prevent duplicate submission
    const existingOrderList = await db
      .select()
      .from(orders)
      .where(eq(orders.idempotencyKey, input.idempotencyKey));

    if (existingOrderList.length > 0) {
      const existingOrder = existingOrderList[0];
      const existingItems = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, existingOrder.id));
      return {
        order: existingOrder,
        items: existingItems,
        duplicatePrevented: true,
      };
    }

    return await db.transaction(async (tx) => {
      const settingsList = await tx.select().from(storeSettings);
      const settings = settingsList[0];

      const allProducts = await tx.select().from(products);
      const allVariants = await tx.select().from(productVariants);

      const productMap = new Map(allProducts.map((p) => [p.id, p]));
      const variantMap = new Map(allVariants.map((v) => [v.id, v]));

      let subtotalBdt = 0;
      const verifiedItems: Array<{
        product: typeof products.$inferSelect;
        variant: typeof productVariants.$inferSelect | null;
        quantity: number;
        unitPriceBdt: number;
        lineTotalBdt: number;
        variantLabel: string;
      }> = [];

      for (const reqItem of input.items) {
        const product = productMap.get(reqItem.productId);
        if (!product || !product.isPublished) {
          throw new Error(`পণ্যটি বর্তমানে পাওয়া যাচ্ছে না (ID: ${reqItem.productId})।`);
        }

        let variant: typeof productVariants.$inferSelect | null = null;
        if (reqItem.variantId) {
          variant = variantMap.get(reqItem.variantId) || null;
          if (!variant || variant.productId !== product.id || !variant.isActive) {
            throw new Error(`"${product.nameBn}"-এর নির্বাচিত ভ্যারিয়েন্টটি সঠিক নয়।`);
          }
          if (variant.stockQuantity < reqItem.quantity) {
            throw new Error(
              `"${product.nameBn}" (${variant.size || ''} ${variant.color || ''})-এর পর্যাপ্ত স্টক নেই (মজুদ আছে: ${variant.stockQuantity} টি)।`
            );
          }
        }

        if (product.stockQuantity < reqItem.quantity) {
          throw new Error(
            `"${product.nameBn}"-এর পর্যাপ্ত স্টক নেই (মজুদ আছে: ${product.stockQuantity} টি)।`
          );
        }

        const basePrice =
          product.salePriceBdt !== null && product.salePriceBdt > 0 && product.salePriceBdt < product.priceBdt
            ? product.salePriceBdt
            : product.priceBdt;

        const adjustment = variant ? variant.priceAdjustmentBdt : 0;
        const unitPriceBdt = Math.max(1, basePrice + adjustment);
        const lineTotalBdt = unitPriceBdt * reqItem.quantity;
        subtotalBdt += lineTotalBdt;

        const variantParts = [variant?.size, variant?.color].filter(Boolean);
        const variantLabel = variantParts.length > 0 ? variantParts.join(' / ') : 'Standard';

        verifiedItems.push({
          product,
          variant,
          quantity: reqItem.quantity,
          unitPriceBdt,
          lineTotalBdt,
          variantLabel,
        });
      }

      // 2. Calculate Coupon Discount on Server
      let discountBdt = 0;
      let appliedCouponCode = '';
      if (input.couponCode && input.couponCode.trim()) {
        const cleanCode = input.couponCode.trim().toUpperCase();
        const foundCoupons = await tx.select().from(coupons).where(eq(coupons.code, cleanCode));
        const coupon = foundCoupons[0];
        if (
          coupon &&
          coupon.isActive &&
          coupon.usedCount < coupon.usageLimit &&
          subtotalBdt >= coupon.minOrderBdt
        ) {
          if (coupon.discountType === 'percentage') {
            discountBdt = Math.round((subtotalBdt * coupon.discountValue) / 100);
            if (coupon.maxDiscountBdt && discountBdt > coupon.maxDiscountBdt) {
              discountBdt = coupon.maxDiscountBdt;
            }
          } else {
            discountBdt = coupon.discountValue;
          }
          discountBdt = Math.min(discountBdt, subtotalBdt);
          appliedCouponCode = coupon.code;

          await tx
            .update(coupons)
            .set({ usedCount: coupon.usedCount + 1 })
            .where(eq(coupons.id, coupon.id));
        }
      }

      // 2b. Calculate Advance Bangla QR Payment Discount on Server (if applicable)
      const parsedSettings = parseStoreSettingsWithBanglaQr(settings);
      let qrDiscountBdt = 0;
      if (input.paymentMethod === 'BANGLA_QR') {
        qrDiscountBdt = calculateBanglaQrDiscountBdt(
          Math.max(0, subtotalBdt - discountBdt),
          parsedSettings
        );
        if (qrDiscountBdt > 0) {
          discountBdt += qrDiscountBdt;
          appliedCouponCode = appliedCouponCode
            ? `${appliedCouponCode}+BANGLA_QR`
            : 'BANGLA_QR_OFFER';
        }
      }

      // 3. Calculate Delivery Charge on Server
      const isInsideDhaka = input.district.toLowerCase() === 'dhaka';
      const insideDhakaCharge = settings?.sylhetDeliveryBdt ?? 60;
      const outsideDhakaCharge = settings?.outsideSylhetDeliveryBdt ?? 120;
      const freeThreshold = settings?.freeDeliveryThresholdBdt ?? 3000;

      let deliveryChargeBdt = isInsideDhaka ? insideDhakaCharge : outsideDhakaCharge;
      if (freeThreshold > 0 && subtotalBdt - discountBdt >= freeThreshold) {
        deliveryChargeBdt = 0;
      }

      const totalBdt = Math.max(0, subtotalBdt - discountBdt + deliveryChargeBdt);

      // 4. Find or Create Customer Record by Normalized Phone Number
      const existingCustomers = await tx
        .select()
        .from(customers)
        .where(eq(customers.phone, normalizedPhone));

      let customerRecord: typeof customers.$inferSelect;
      const now = new Date();

      if (existingCustomers.length > 0) {
        const currentCust = existingCustomers[0];
        const updatedCusts = await tx
          .update(customers)
          .set({
            fullName: input.fullName.trim(),
            email: input.email?.trim() || currentCust.email || '',
            district: input.district,
            upazila: input.upazila,
            addressLine: input.addressLine.trim(),
            totalOrders: currentCust.totalOrders + 1,
            totalSpentBdt: currentCust.totalSpentBdt + totalBdt,
            lastOrderAt: now,
            updatedAt: now,
          })
          .where(eq(customers.id, currentCust.id))
          .returning();
        customerRecord = updatedCusts[0];
      } else {
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        const customerCode = `CUST-${now.getFullYear()}-${randomDigits}-${Date.now().toString().slice(-3)}`;
        const insertedCusts = await tx
          .insert(customers)
          .values({
            customerCode,
            fullName: input.fullName.trim(),
            phone: normalizedPhone,
            email: input.email?.trim() || '',
            district: input.district,
            upazila: input.upazila,
            addressLine: input.addressLine.trim(),
            totalOrders: 1,
            totalSpentBdt: totalBdt,
            firstOrderAt: now,
            lastOrderAt: now,
          })
          .returning();
        customerRecord = insertedCusts[0];
      }

      // 5. Generate Unique Order Number & Tracking Token
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const suffix = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `BBD-${dateStr}-${suffix}`;
      const trackingToken = `TRK-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

      const isBanglaQr = input.paymentMethod === 'BANGLA_QR';
      if (isBanglaQr) {
        if (!input.paymentSenderPhone?.trim() || !input.paymentTransactionId?.trim()) {
          throw new Error(
            'বাংলা কিউআর ম্যানুয়াল পেমেন্টের ক্ষেত্রে প্রেরণকারী নম্বর এবং ট্রানজেকশন আইডি (TrxID) প্রদান করা আবশ্যক।'
          );
        }
      }

      const serializedOrderNote = serializeOrderNoteWithManualPayment(
        input.orderNote?.trim() || '',
        isBanglaQr
          ? {
              method: 'BANGLA_QR',
              senderPhone: input.paymentSenderPhone!.trim(),
              transactionId: input.paymentTransactionId!.trim().toUpperCase(),
              paidAmountBdt: totalBdt,
              qrDiscountBdt,
              screenshotUrl: input.paymentScreenshotUrl || '',
              submittedAt: now.toISOString(),
            }
          : null
      );

      // 6. Insert Order Record with Immutable Snapshots
      const insertedOrders = await tx
        .insert(orders)
        .values({
          orderNumber,
          idempotencyKey: input.idempotencyKey,
          customerId: customerRecord.id,
          customerNameSnapshot: input.fullName.trim(),
          customerPhoneSnapshot: normalizedPhone,
          customerEmailSnapshot: input.email?.trim() || '',
          districtSnapshot: input.district,
          upazilaSnapshot: input.upazila,
          shippingAddressSnapshot: input.addressLine.trim(),
          orderNote: serializedOrderNote,
          subtotalBdt,
          deliveryChargeBdt,
          discountBdt,
          couponCode: appliedCouponCode,
          totalBdt,
          paymentMethod: input.paymentMethod,
          paymentStatus: isBanglaQr ? 'VERIFICATION_PENDING' : 'UNPAID',
          orderStatus: 'Pending',
          trackingToken,
        })
        .returning();

      const newOrder = insertedOrders[0];

      // 7. Insert Order Items & Decrement Stock Safely
      const insertedOrderItems: Array<typeof orderItems.$inferSelect> = [];
      for (const item of verifiedItems) {
        const insertedItemRows = await tx
          .insert(orderItems)
          .values({
            orderId: newOrder.id,
            productId: item.product.id,
            variantId: item.variant ? item.variant.id : null,
            productNameSnapshot: item.product.name,
            productNameBnSnapshot: item.product.nameBn,
            skuSnapshot: item.variant ? item.variant.sku : item.product.sku,
            variantSnapshot: item.variantLabel,
            unitPriceBdt: item.unitPriceBdt,
            quantity: item.quantity,
            lineTotalBdt: item.lineTotalBdt,
          })
          .returning();
        insertedOrderItems.push(insertedItemRows[0]);

        // Decrement product stock
        await tx
          .update(products)
          .set({
            stockQuantity: Math.max(0, item.product.stockQuantity - item.quantity),
            updatedAt: now,
          })
          .where(eq(products.id, item.product.id));

        // Decrement variant stock if applicable
        if (item.variant) {
          await tx
            .update(productVariants)
            .set({
              stockQuantity: Math.max(0, item.variant.stockQuantity - item.quantity),
            })
            .where(eq(productVariants.id, item.variant.id));
        }
      }

      // 8. Record Initial Order Status History
      await tx.insert(orderStatusHistory).values({
        orderId: newOrder.id,
        previousStatus: 'New',
        newStatus: 'Pending',
        note: isBanglaQr
          ? `বাংলা কিউআর ম্যানুয়াল পেমেন্ট সাবমিট করা হয়েছে (প্রেরণকারী: ${input.paymentSenderPhone?.trim()}, TrxID: ${input.paymentTransactionId?.trim().toUpperCase()})`
          : 'কাস্টমার ওয়েবসাইট থেকে অর্ডার প্লেস করেছেন (Cash on Delivery)',
        changedByEmail: 'customer@storefront',
      });

      return {
        order: newOrder,
        items: insertedOrderItems,
        verifiedItems,
        duplicatePrevented: false,
      };
    }).then(async (txResult) => {
      // 9. Automatically forward order items to BusinessKoro Storefront Orders API
      if (!txResult.duplicatePrevented && txResult.verifiedItems) {
        await forwardOrderToBusinessKoro(
          txResult.order,
          txResult.verifiedItems,
          input,
          normalizedPhone
        ).catch((err) => {
          console.error('BusinessKoro order forwarding error:', err);
        });
      }
      return {
        order: txResult.order,
        items: txResult.items,
        duplicatePrevented: txResult.duplicatePrevented,
      };
    });
  } catch (error: any) {
    console.error('Guest checkout transaction failed:', error);
    throw new Error(error.message || 'অর্ডার সম্পন্ন করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।', {
      cause: error,
    });
  }
}

export async function trackOrderPublic(orderNumber: string, phone: string) {
  try {
    const cleanOrderNo = orderNumber.trim().toUpperCase();
    const normalizedPhone = normalizeBdPhone(phone);

    const foundOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, cleanOrderNo));

    const order = foundOrders[0];
    if (!order || normalizeBdPhone(order.customerPhoneSnapshot) !== normalizedPhone) {
      return null;
    }

    const [items, history] = await Promise.all([
      db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
      db
        .select()
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, order.id))
        .orderBy(desc(orderStatusHistory.createdAt)),
    ]);

    const parsedNote = parseOrderNoteWithManualPayment(order.orderNote);

    return {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      manualPayment: parsedNote.manualPayment,
      customerName: order.customerNameSnapshot,
      district: order.districtSnapshot,
      upazila: order.upazilaSnapshot,
      subtotalBdt: order.subtotalBdt,
      deliveryChargeBdt: order.deliveryChargeBdt,
      discountBdt: order.discountBdt,
      totalBdt: order.totalBdt,
      createdAt: order.createdAt,
      items: items.map((i) => ({
        productName: i.productNameSnapshot,
        productNameBn: i.productNameBnSnapshot,
        variant: i.variantSnapshot,
        quantity: i.quantity,
        unitPriceBdt: i.unitPriceBdt,
        lineTotalBdt: i.lineTotalBdt,
      })),
      history: history.map((h) => ({
        status: h.newStatus,
        note: h.note,
        timestamp: h.createdAt,
      })),
    };
  } catch (error) {
    console.error('Order tracking failed:', error);
    throw new Error('অর্ডার ট্র্যাকিং তথ্য লোড করতে সমস্যা হয়েছে।', { cause: error });
  }
}

export async function getAdminOverviewData() {
  try {
    await ensureStoreInitialized();
    const [
      allOrders,
      allOrderItems,
      allHistory,
      allCustomers,
      allProducts,
      allVariants,
      allCategories,
      allSettings,
      allLogs,
      allCoupons,
    ] = await Promise.all([
      db.select().from(orders).orderBy(desc(orders.createdAt)),
      db.select().from(orderItems),
      db.select().from(orderStatusHistory).orderBy(desc(orderStatusHistory.createdAt)),
      db.select().from(customers).orderBy(desc(customers.lastOrderAt)),
      db.select().from(products).orderBy(desc(products.updatedAt)),
      db.select().from(productVariants),
      db.select().from(categories).orderBy(asc(categories.sortOrder)),
      db.select().from(storeSettings),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)),
      db.select().from(coupons),
    ]);

    const itemsByOrder = new Map<number, typeof allOrderItems>();
    for (const item of allOrderItems) {
      const list = itemsByOrder.get(item.orderId) || [];
      list.push(item);
      itemsByOrder.set(item.orderId, list);
    }

    const historyByOrder = new Map<number, typeof allHistory>();
    for (const h of allHistory) {
      const list = historyByOrder.get(h.orderId) || [];
      list.push(h);
      historyByOrder.set(h.orderId, list);
    }

    const variantsByProduct = new Map<number, typeof allVariants>();
    for (const v of allVariants) {
      const list = variantsByProduct.get(v.productId) || [];
      list.push(v);
      variantsByProduct.set(v.productId, list);
    }

    const nonCancelledStatuses = new Set(['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered']);
    let grossOrderValueBdt = 0;
    let paidRevenueBdt = 0;

    for (const o of allOrders) {
      if (nonCancelledStatuses.has(o.orderStatus)) {
        grossOrderValueBdt += o.totalBdt;
      }
      if (o.orderStatus === 'Delivered' || o.paymentStatus === 'PAID') {
        if (o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Returned' && o.orderStatus !== 'Refunded') {
          paidRevenueBdt += o.totalBdt;
        }
      }
    }

    const stats = {
      totalOrders: allOrders.length,
      awaitingConfirmation: allOrders.filter((o) => o.orderStatus === 'Pending').length,
      processingOrders: allOrders.filter((o) =>
        ['Confirmed', 'Processing', 'Shipped'].includes(o.orderStatus)
      ).length,
      deliveredOrders: allOrders.filter((o) => o.orderStatus === 'Delivered').length,
      cancelledOrders: allOrders.filter((o) =>
        ['Cancelled', 'Returned', 'Refunded'].includes(o.orderStatus)
      ).length,
      grossOrderValueBdt,
      paidRevenueBdt,
      totalCustomers: allCustomers.length,
      lowStockCount: allProducts.filter((p) => p.stockQuantity <= p.lowStockThreshold).length,
    };

    return {
      stats,
      orders: allOrders.map((o) => {
        const parsedNote = parseOrderNoteWithManualPayment(o.orderNote);
        return {
          ...o,
          orderNote: parsedNote.orderNote,
          manualPayment: parsedNote.manualPayment,
          items: itemsByOrder.get(o.id) || [],
          history: historyByOrder.get(o.id) || [],
        };
      }),
      customers: allCustomers,
      products: allProducts.map((p) => ({
        ...p,
        variants: variantsByProduct.get(p.id) || [],
      })),
      categories: allCategories,
      settings: parseStoreSettingsWithBanglaQr(allSettings[0]),
      coupons: allCoupons,
      auditLogs: allLogs.slice(0, 100),
    };
  } catch (error) {
    console.error('Failed to fetch admin overview data:', error);
    throw new Error('অ্যাডমিন প্যানেলের ডেটা লোড করতে সমস্যা হয়েছে।', { cause: error });
  }
}

export async function updateOrderAdmin(
  adminEmail: string,
  adminUid: string,
  orderId: number,
  payload: {
    orderStatus: string;
    paymentStatus: string;
    note?: string;
    cancellationReason?: string;
    refundAmountBdt?: number;
  }
) {
  try {
    return await db.transaction(async (tx) => {
      const existingList = await tx.select().from(orders).where(eq(orders.id, orderId));
      const existing = existingList[0];
      if (!existing) {
        throw new Error('অর্ডারটি খুঁজে পাওয়া যায়নি।');
      }

      const previousStatus = existing.orderStatus;
      const newStatus = payload.orderStatus;
      const now = new Date();

      // Restore inventory if transitioning from active status to Cancelled or Returned
      const inactiveStatuses = ['Cancelled', 'Returned'];
      const wasInactive = inactiveStatuses.includes(previousStatus);
      const isNowInactive = inactiveStatuses.includes(newStatus);

      if (!wasInactive && isNowInactive) {
        const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, existing.id));
        for (const item of items) {
          const prodRows = await tx.select().from(products).where(eq(products.id, item.productId));
          if (prodRows[0]) {
            await tx
              .update(products)
              .set({ stockQuantity: prodRows[0].stockQuantity + item.quantity, updatedAt: now })
              .where(eq(products.id, item.productId));
          }
          if (item.variantId) {
            const varRows = await tx
              .select()
              .from(productVariants)
              .where(eq(productVariants.id, item.variantId));
            if (varRows[0]) {
              await tx
                .update(productVariants)
                .set({ stockQuantity: varRows[0].stockQuantity + item.quantity })
                .where(eq(productVariants.id, item.variantId));
            }
          }
        }
      }

      const updatedOrders = await tx
        .update(orders)
        .set({
          orderStatus: newStatus,
          paymentStatus:
            newStatus === 'Delivered' && payload.paymentStatus === 'UNPAID'
              ? 'PAID'
              : payload.paymentStatus,
          cancellationReason: payload.cancellationReason ?? existing.cancellationReason,
          refundAmountBdt: payload.refundAmountBdt ?? existing.refundAmountBdt,
          updatedAt: now,
        })
        .where(eq(orders.id, orderId))
        .returning();

      await tx.insert(orderStatusHistory).values({
        orderId,
        previousStatus,
        newStatus,
        note: payload.note || `স্ট্যাটাস পরিবর্তন: ${previousStatus} → ${newStatus}`,
        changedByEmail: adminEmail,
      });

      await tx.insert(auditLogs).values({
        actorEmail: adminEmail,
        actorUid: adminUid,
        action: 'UPDATE_ORDER_STATUS',
        entityType: 'Order',
        entityId: existing.orderNumber,
        details: `${previousStatus} -> ${newStatus} (Payment: ${payload.paymentStatus})`,
      });

      return updatedOrders[0];
    });
  } catch (error: any) {
    console.error('Failed to update order status:', error);
    throw new Error(error.message || 'অর্ডার স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে।', { cause: error });
  }
}

export async function saveProductAdmin(
  adminEmail: string,
  adminUid: string,
  payload: {
    id?: number;
    sku: string;
    name: string;
    nameBn: string;
    categoryId: number;
    description: string;
    descriptionBn: string;
    priceBdt: number;
    salePriceBdt?: number | null;
    stockQuantity: number;
    lowStockThreshold?: number;
    imageUrl: string;
    galleryUrlsJson?: string;
    isFeatured: boolean;
    isNewArrival: boolean;
    isBestSeller: boolean;
    isSpecialOffer: boolean;
    isSeasonal: boolean;
    isPublished: boolean;
    seoTitle?: string;
    seoDescription?: string;
    variants?: Array<{
      id?: number;
      sku: string;
      size: string;
      color: string;
      priceAdjustmentBdt: number;
      stockQuantity: number;
    }>;
  }
) {
  try {
    return await db.transaction(async (tx) => {
      const slugBase = payload.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const now = new Date();

      let savedProduct: typeof products.$inferSelect;

      if (payload.id) {
        let nextGalleryJson = payload.galleryUrlsJson ?? '[]';
        try {
          const existingRows = await tx
            .select()
            .from(products)
            .where(eq(products.id, payload.id));
          if (existingRows[0] && existingRows[0].galleryUrlsJson) {
            const origParsed = JSON.parse(existingRows[0].galleryUrlsJson);
            const newParsed = JSON.parse(nextGalleryJson);
            if (origParsed && origParsed.bkrProductId && newParsed && typeof newParsed === 'object') {
              newParsed.bkrProductId = origParsed.bkrProductId;
              newParsed.bkrMinPrice = origParsed.bkrMinPrice ?? origParsed.bkrMinimumSellingPrice;
              newParsed.bkrMinimumSellingPrice = origParsed.bkrMinimumSellingPrice ?? origParsed.bkrMinPrice;
              newParsed.bkrCostPrice = origParsed.bkrCostPrice;
              nextGalleryJson = JSON.stringify(newParsed);
            }
          }
        } catch (_e) {}

        const updated = await tx
          .update(products)
          .set({
            sku: payload.sku.trim().toUpperCase(),
            name: payload.name.trim(),
            nameBn: payload.nameBn.trim(),
            categoryId: payload.categoryId,
            description: payload.description.trim(),
            descriptionBn: payload.descriptionBn.trim(),
            priceBdt: payload.priceBdt,
            salePriceBdt: payload.salePriceBdt || null,
            stockQuantity: payload.stockQuantity,
            lowStockThreshold: payload.lowStockThreshold ?? 5,
            imageUrl: payload.imageUrl,
            galleryUrlsJson: nextGalleryJson,
            isFeatured: payload.isFeatured,
            isNewArrival: payload.isNewArrival,
            isBestSeller: payload.isBestSeller,
            isSpecialOffer: payload.isSpecialOffer,
            isSeasonal: payload.isSeasonal,
            isPublished: payload.isPublished,
            seoTitle: payload.seoTitle || payload.name,
            seoDescription: payload.seoDescription || payload.descriptionBn,
            updatedAt: now,
          })
          .where(eq(products.id, payload.id))
          .returning();
        savedProduct = updated[0];

        if (Array.isArray(payload.variants)) {
          const existingProductVars = await tx
            .select()
            .from(productVariants)
            .where(eq(productVariants.productId, savedProduct.id));
          const keptIds = new Set<number>();

          for (const v of payload.variants) {
            const cleanSku = v.sku.trim().toUpperCase();
            const matchedExisting = existingProductVars.find(
              (ev) => (v.id && ev.id === v.id) || ev.sku.toUpperCase() === cleanSku
            );
            if (matchedExisting) {
              keptIds.add(matchedExisting.id);
              await tx
                .update(productVariants)
                .set({
                  sku: cleanSku,
                  size: v.size.trim(),
                  color: v.color.trim(),
                  priceAdjustmentBdt: v.priceAdjustmentBdt || 0,
                  stockQuantity: Math.max(0, v.stockQuantity || 0),
                  isActive: true,
                })
                .where(eq(productVariants.id, matchedExisting.id));
            } else {
              const insertedVar = await tx
                .insert(productVariants)
                .values({
                  productId: savedProduct.id,
                  sku: cleanSku,
                  size: v.size.trim(),
                  color: v.color.trim(),
                  priceAdjustmentBdt: v.priceAdjustmentBdt || 0,
                  stockQuantity: Math.max(0, v.stockQuantity || 0),
                  isActive: true,
                })
                .returning();
              if (insertedVar[0]) keptIds.add(insertedVar[0].id);
            }
          }

          for (const ev of existingProductVars) {
            if (!keptIds.has(ev.id)) {
              await tx
                .update(productVariants)
                .set({ isActive: false })
                .where(eq(productVariants.id, ev.id));
            }
          }
        }

        await tx.insert(auditLogs).values({
          actorEmail: adminEmail,
          actorUid: adminUid,
          action: 'UPDATE_PRODUCT',
          entityType: 'Product',
          entityId: savedProduct.sku,
          details: `Updated product "${savedProduct.name}" (Price: ৳${savedProduct.priceBdt}, Stock: ${savedProduct.stockQuantity})`,
        });
      } else {
        const uniqueSlug = `${slugBase}-${Date.now().toString().slice(-4)}`;
        const inserted = await tx
          .insert(products)
          .values({
            sku: payload.sku.trim().toUpperCase(),
            name: payload.name.trim(),
            nameBn: payload.nameBn.trim(),
            slug: uniqueSlug,
            categoryId: payload.categoryId,
            description: payload.description.trim(),
            descriptionBn: payload.descriptionBn.trim(),
            priceBdt: payload.priceBdt,
            salePriceBdt: payload.salePriceBdt || null,
            stockQuantity: payload.stockQuantity,
            lowStockThreshold: payload.lowStockThreshold ?? 5,
            imageUrl: payload.imageUrl || createStudioProductSvg('hoodie', '#14213D', '#286F65', payload.sku),
            galleryUrlsJson: payload.galleryUrlsJson ?? '[]',
            isFeatured: payload.isFeatured,
            isNewArrival: payload.isNewArrival,
            isBestSeller: payload.isBestSeller,
            isSpecialOffer: payload.isSpecialOffer,
            isSeasonal: payload.isSeasonal,
            isPublished: payload.isPublished,
            seoTitle: payload.seoTitle || payload.name,
            seoDescription: payload.seoDescription || payload.descriptionBn,
          })
          .returning();
        savedProduct = inserted[0];

        if (payload.variants && payload.variants.length > 0) {
          for (const v of payload.variants) {
            await tx.insert(productVariants).values({
              productId: savedProduct.id,
              sku: v.sku.trim().toUpperCase(),
              size: v.size.trim(),
              color: v.color.trim(),
              priceAdjustmentBdt: v.priceAdjustmentBdt || 0,
              stockQuantity: v.stockQuantity || 0,
              isActive: true,
            });
          }
        }

        await tx.insert(auditLogs).values({
          actorEmail: adminEmail,
          actorUid: adminUid,
          action: 'CREATE_PRODUCT',
          entityType: 'Product',
          entityId: savedProduct.sku,
          details: `Created product "${savedProduct.name}" (Price: ৳${savedProduct.priceBdt}, Stock: ${savedProduct.stockQuantity})`,
        });
      }

      return savedProduct;
    });
  } catch (error: any) {
    console.error('Failed to save product:', error);
    throw new Error(error.message || 'পণ্য সংরক্ষণ করতে সমস্যা হয়েছে। SKU ইউনিক কি না যাচাই করুন।', {
      cause: error,
    });
  }
}

export async function deleteProductAdmin(
  adminEmail: string,
  adminUid: string,
  productId: number
) {
  await ensureStoreInitialized();
  try {
    const existingRows = await db
      .select()
      .from(products)
      .where(eq(products.id, productId));
    const target = existingRows[0];
    if (!target) {
      throw new Error('পণ্যটি খুঁজে পাওয়া যায়নি।');
    }

    // Ensure order_items foreign key never blocks deleting a product with past orders
    await pool
      .query(
        `ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;
         ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_products_id_fk;`
      )
      .catch(() => {});

    await db.transaction(async (tx) => {
      await tx.delete(productVariants).where(eq(productVariants.productId, productId));
      await tx.delete(products).where(eq(products.id, productId));
      await tx.insert(auditLogs).values({
        actorEmail: adminEmail,
        actorUid: adminUid,
        action: 'DELETE_PRODUCT',
        entityType: 'Product',
        entityId: target.sku,
        details: `Deleted product "${target.nameBn}" (SKU: ${target.sku})`,
      });
    });

    return { deleted: true, sku: target.sku, nameBn: target.nameBn };
  } catch (error: any) {
    console.error('Failed to delete product:', error);
    throw new Error(error.message || 'পণ্যটি মুছে ফেলতে সমস্যা হয়েছে।', { cause: error });
  }
}

export async function bulkDeleteProductsAdmin(
  adminEmail: string,
  adminUid: string,
  productIds: number[]
) {
  await ensureStoreInitialized();
  const cleanIds = Array.from(
    new Set((productIds || []).map((id) => Number(id)).filter((id) => id > 0))
  );
  if (cleanIds.length === 0) {
    throw new Error('ডিলিট করার জন্য অন্তত ১টি পণ্য নির্বাচন করুন।');
  }

  let deletedCount = 0;
  for (const pid of cleanIds) {
    try {
      await deleteProductAdmin(adminEmail, adminUid, pid);
      deletedCount++;
    } catch (_e) {}
  }
  return { deleted: true, deletedCount };
}

export async function saveCouponAdmin(
  adminEmail: string,
  adminUid: string,
  payload: {
    id?: number;
    code: string;
    description: string;
    discountType: string;
    discountValue: number;
    minOrderBdt: number;
    maxDiscountBdt?: number | null;
    usageLimit?: number;
    isActive: boolean;
  }
) {
  try {
    const cleanCode = payload.code.trim().toUpperCase();
    if (!cleanCode) {
      throw new Error('কুপন কোড আবশ্যক।');
    }

    if (payload.id) {
      const updated = await db
        .update(coupons)
        .set({
          code: cleanCode,
          description: payload.description.trim(),
          discountType: payload.discountType === 'percentage' ? 'percentage' : 'fixed',
          discountValue: Math.max(1, Number(payload.discountValue)),
          minOrderBdt: Math.max(0, Number(payload.minOrderBdt || 0)),
          maxDiscountBdt: payload.maxDiscountBdt ? Number(payload.maxDiscountBdt) : null,
          usageLimit: Math.max(1, Number(payload.usageLimit || 1000)),
          isActive: payload.isActive,
        })
        .where(eq(coupons.id, payload.id))
        .returning();

      await db.insert(auditLogs).values({
        actorEmail: adminEmail,
        actorUid: adminUid,
        action: 'UPDATE_COUPON',
        entityType: 'Coupon',
        entityId: cleanCode,
        details: `Updated coupon ${cleanCode}`,
      });
      return updated[0];
    } else {
      const inserted = await db
        .insert(coupons)
        .values({
          code: cleanCode,
          description: payload.description.trim(),
          discountType: payload.discountType === 'percentage' ? 'percentage' : 'fixed',
          discountValue: Math.max(1, Number(payload.discountValue)),
          minOrderBdt: Math.max(0, Number(payload.minOrderBdt || 0)),
          maxDiscountBdt: payload.maxDiscountBdt ? Number(payload.maxDiscountBdt) : null,
          usageLimit: Math.max(1, Number(payload.usageLimit || 1000)),
          usedCount: 0,
          isActive: payload.isActive,
        })
        .returning();

      await db.insert(auditLogs).values({
        actorEmail: adminEmail,
        actorUid: adminUid,
        action: 'CREATE_COUPON',
        entityType: 'Coupon',
        entityId: cleanCode,
        details: `Created coupon ${cleanCode}`,
      });
      return inserted[0];
    }
  } catch (error: any) {
    console.error('Failed to save coupon:', error);
    throw new Error('কুপন সংরক্ষণ করতে সমস্যা হয়েছে। কোডটি ইউনিক কি না যাচাই করুন।', { cause: error });
  }
}

export async function deleteCouponAdmin(
  adminEmail: string,
  adminUid: string,
  couponId: number
) {
  try {
    await db.delete(coupons).where(eq(coupons.id, couponId));
    await db.insert(auditLogs).values({
      actorEmail: adminEmail,
      actorUid: adminUid,
      action: 'DELETE_COUPON',
      entityType: 'Coupon',
      entityId: String(couponId),
      details: `Deleted coupon ID ${couponId}`,
    });
    return { deleted: true };
  } catch (error) {
    console.error('Failed to delete coupon:', error);
    throw new Error('কুপন মুছে ফেলতে সমস্যা হয়েছে।', { cause: error });
  }
}

export async function saveCategoryAdmin(
  adminEmail: string,
  adminUid: string,
  payload: {
    id?: number;
    name: string;
    nameBn: string;
    description?: string;
    sortOrder?: number;
    isActive: boolean;
  }
) {
  try {
    const slug = payload.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    if (payload.id) {
      const updated = await db
        .update(categories)
        .set({
          name: payload.name.trim(),
          nameBn: payload.nameBn.trim(),
          description: payload.description || '',
          sortOrder: payload.sortOrder ?? 0,
          isActive: payload.isActive,
        })
        .where(eq(categories.id, payload.id))
        .returning();

      await db.insert(auditLogs).values({
        actorEmail: adminEmail,
        actorUid: adminUid,
        action: 'UPDATE_CATEGORY',
        entityType: 'Category',
        entityId: String(payload.id),
        details: `Updated category ${payload.name}`,
      });
      return updated[0];
    } else {
      const inserted = await db
        .insert(categories)
        .values({
          name: payload.name.trim(),
          nameBn: payload.nameBn.trim(),
          slug: `${slug}-${Date.now().toString().slice(-3)}`,
          description: payload.description || '',
          sortOrder: payload.sortOrder ?? 0,
          isActive: payload.isActive,
        })
        .returning();

      await db.insert(auditLogs).values({
        actorEmail: adminEmail,
        actorUid: adminUid,
        action: 'CREATE_CATEGORY',
        entityType: 'Category',
        entityId: inserted[0].slug,
        details: `Created category ${payload.name}`,
      });
      return inserted[0];
    }
  } catch (error) {
    console.error('Failed to save category:', error);
    throw new Error('ক্যাটাগরি সংরক্ষণ করতে সমস্যা হয়েছে।', { cause: error });
  }
}

export async function updateStoreSettingsAdmin(
  adminEmail: string,
  adminUid: string,
  payload: {
    contactPhone: string;
    contactEmail: string;
    businessAddress: string;
    sylhetDeliveryBdt: number;
    outsideSylhetDeliveryBdt: number;
    freeDeliveryThresholdBdt: number;
    codEnabled: boolean;
    bkashEnabled: boolean;
    nagadEnabled: boolean;
    returnPolicyText: string;
    banglaQrEnabled?: boolean;
    banglaQrImageUrl?: string;
    banglaQrMerchantName?: string;
    banglaQrAccountNumber?: string;
    banglaQrInstructions?: string;
    banglaQrDiscountEnabled?: boolean;
    banglaQrDiscountType?: 'percentage' | 'fixed';
    banglaQrDiscountValue?: number;
    banglaQrMaxDiscountBdt?: number;
  }
) {
  try {
    const existing = await db.select().from(storeSettings);
    if (existing.length === 0) {
      throw new Error('Store settings row not found');
    }
    const existingParsed = parseStoreSettingsWithBanglaQr(existing[0]);

    const serializedReturnPolicy = serializeReturnPolicyWithBanglaQr({
      returnPolicyText: payload.returnPolicyText,
      banglaQrEnabled: payload.banglaQrEnabled ?? existingParsed.banglaQrEnabled,
      banglaQrImageUrl:
        payload.banglaQrImageUrl !== undefined
          ? payload.banglaQrImageUrl
          : existingParsed.banglaQrImageUrl,
      banglaQrMerchantName:
        payload.banglaQrMerchantName ?? existingParsed.banglaQrMerchantName,
      banglaQrAccountNumber:
        payload.banglaQrAccountNumber ?? existingParsed.banglaQrAccountNumber,
      banglaQrInstructions:
        payload.banglaQrInstructions ?? existingParsed.banglaQrInstructions,
      banglaQrDiscountEnabled:
        payload.banglaQrDiscountEnabled ?? existingParsed.banglaQrDiscountEnabled,
      banglaQrDiscountType:
        payload.banglaQrDiscountType ?? existingParsed.banglaQrDiscountType,
      banglaQrDiscountValue:
        payload.banglaQrDiscountValue ?? existingParsed.banglaQrDiscountValue,
      banglaQrMaxDiscountBdt:
        payload.banglaQrMaxDiscountBdt ?? existingParsed.banglaQrMaxDiscountBdt,
    });

    const updated = await db
      .update(storeSettings)
      .set({
        contactPhone: payload.contactPhone,
        contactEmail: payload.contactEmail,
        businessAddress: payload.businessAddress,
        sylhetDeliveryBdt: payload.sylhetDeliveryBdt,
        outsideSylhetDeliveryBdt: payload.outsideSylhetDeliveryBdt,
        freeDeliveryThresholdBdt: payload.freeDeliveryThresholdBdt,
        codEnabled: payload.codEnabled,
        bkashEnabled: payload.bkashEnabled,
        nagadEnabled: payload.nagadEnabled,
        returnPolicyText: serializedReturnPolicy,
        updatedAt: new Date(),
      })
      .where(eq(storeSettings.id, existing[0].id))
      .returning();

    await db.insert(auditLogs).values({
      actorEmail: adminEmail,
      actorUid: adminUid,
      action: 'UPDATE_STORE_SETTINGS',
      entityType: 'StoreSettings',
      entityId: String(existing[0].id),
      details: `Inside Dhaka: ৳${payload.sylhetDeliveryBdt}, Outside Dhaka: ৳${payload.outsideSylhetDeliveryBdt}, Bangla QR: ${payload.banglaQrEnabled !== false ? 'Enabled' : 'Disabled'}`,
    });

    return parseStoreSettingsWithBanglaQr(updated[0]);
  } catch (error) {
    console.error('Failed to update store settings:', error);
    throw new Error('স্টোর সেটিংস আপডেট করতে সমস্যা হয়েছে।', { cause: error });
  }
}

// Protect against Spreadsheet Formula Injection (OWASP CSV/XLSX Injection mitigation)
export function sanitizeSpreadsheetText(value: string | null | undefined): string {
  if (!value) return '';
  const str = String(value);
  if (/^[=+\-@]/.test(str.trim())) {
    return `'${str}`;
  }
  return str;
}

export async function recordExportAuditLog(
  adminEmail: string,
  adminUid: string,
  exportType: string,
  rowCount: number
) {
  try {
    await db.insert(auditLogs).values({
      actorEmail: adminEmail,
      actorUid: adminUid,
      action: 'EXPORT_XLSX',
      entityType: exportType,
      entityId: new Date().toISOString(),
      details: `Exported ${rowCount} rows to .xlsx`,
    });
  } catch (error) {
    console.error('Failed to write export audit log:', error);
  }
}

export interface BusinessKoroCatalogItem {
  bkrProductId?: string;
  sku: string;
  name: string;
  nameBn: string;
  categorySlug: string;
  categoryName: string;
  categoryNameBn: string;
  wholesalePriceBdt: number;
  minSellingPriceBdt?: number;
  suggestedSellingPriceBdt: number;
  suggestedRetailPriceBdt: number;
  stockQuantity: number;
  description: string;
  descriptionBn: string;
  imageUrl: string;
  galleryMedia: Array<{ type: 'image' | 'video'; url: string; title: string }>;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  isSpecialOffer?: boolean;
  offerBadgeText?: string;
  variants: Array<{
    sku: string;
    size: string;
    color: string;
    priceAdjustmentBdt: number;
    stockQuantity: number;
  }>;
}

const DEFAULT_BUSINESSKORO_API_KEY = 'bkr_d00b18119bbae3dcbe10312bfe949196dd0c0c1909e551ec';
const DEFAULT_BUSINESSKORO_PRODUCTS_URL = 'https://api.businesskoro.com/api/v1/storefront/products';
const DEFAULT_BUSINESSKORO_ORDERS_URL = 'https://api.businesskoro.com/api/v1/storefront/orders';
const DEFAULT_BUSINESSKORO_DOMAIN = 'boichitrabd.com';

function getBusinessKoroConfig() {
  const envKey = (process.env.BUSINESSKORO_API_KEY || '').trim();
  const apiKey =
    envKey.length > 4 && envKey !== 'your_businesskoro_reseller_api_key'
      ? envKey
      : DEFAULT_BUSINESSKORO_API_KEY;
  const envUrl = (process.env.BUSINESSKORO_API_URL || '').trim();
  let productsUrl = DEFAULT_BUSINESSKORO_PRODUCTS_URL;
  if (envUrl && envUrl !== 'https://businesskoro.com/api/v1/products') {
    productsUrl = envUrl.endsWith('/storefront')
      ? `${envUrl}/products`
      : envUrl;
  }
  const ordersUrl = productsUrl.replace(/\/products\/?$/, '/orders');
  return { apiKey, productsUrl, ordersUrl, domain: DEFAULT_BUSINESSKORO_DOMAIN };
}

function getBusinessKoroHeaders(apiKey: string, domain = DEFAULT_BUSINESSKORO_DOMAIN) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'x-api-key': apiKey,
    Origin: `https://${domain}`,
    Referer: `https://${domain}/`,
    'x-domain': domain,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'BoichitraBD-Storefront/1.0',
  };
}

export function getBuiltInBusinessKoroFeed(): BusinessKoroCatalogItem[] {
  return [
    {
      sku: 'BBD-BK-101',
      name: 'Premium Honeycomb PK Cotton Polo T-Shirt',
      nameBn: 'প্রিমিয়াম হানিকম্ব পিকে কটন পোলো টি-শার্ট (মেনস কালেকশন)',
      categorySlug: 'winter-fashion',
      categoryName: 'Fashion & Apparel',
      categoryNameBn: 'ফ্যাশন ও পোশাক',
      wholesalePriceBdt: 520,
      suggestedSellingPriceBdt: 850,
      suggestedRetailPriceBdt: 1050,
      stockQuantity: 96,
      description:
        'Export quality 220 GSM Honeycomb PK Cotton Polo T-Shirt. Breathable collar rib and colorfast dyeing for everyday comfort.',
      descriptionBn:
        'এক্সপোর্ট কোয়ালিটি ২২০ জিএসএম হানিকম্ব পিকে কটন পোলো শার্ট। গরমে আরামদায়ক এবং ধোয়ার পর রং অটুট থাকে।',
      imageUrl: createStudioProductSvg('tshirt', '#14213D', '#286F65', 'BBD-BK-101'),
      galleryMedia: [
        {
          type: 'image',
          url: createStudioProductSvg('tshirt', '#14213D', '#286F65', 'BBD-BK-101'),
          title: 'Royal Navy Polo View',
        },
      ],
      isFeatured: true,
      isNewArrival: true,
      isBestSeller: true,
      isSpecialOffer: true,
      offerBadgeText: '🔥 বেস্টসেলার কালেকশন',
      variants: [
        { sku: 'BBD-BK-101-M-NVY', size: 'M', color: 'Royal Navy', priceAdjustmentBdt: 0, stockQuantity: 12 },
        { sku: 'BBD-BK-101-L-NVY', size: 'L', color: 'Royal Navy', priceAdjustmentBdt: 0, stockQuantity: 15 },
        { sku: 'BBD-BK-101-XL-NVY', size: 'XL', color: 'Royal Navy', priceAdjustmentBdt: 0, stockQuantity: 12 },
      ],
    },
  ];
}

function mapBusinessKoroCategory(rawCat: string): {
  slug: string;
  name: string;
  nameBn: string;
} {
  const lower = rawCat.trim().toLowerCase();
  if (lower.includes('fashion') || lower.includes('apparel') || lower.includes('hoodie')) {
    return {
      slug: 'fashion-item',
      name: 'Fashion & Apparel',
      nameBn: 'ফ্যাশন ও পোশাক',
    };
  }
  if (lower.includes('gaming') || lower.includes('game')) {
    return {
      slug: 'gaming-item',
      name: 'Gaming Gear',
      nameBn: 'গেমিং আইটেম',
    };
  }
  if (lower.includes('decor') || lower.includes('home') || lower.includes('lamp')) {
    return {
      slug: 'decorating-item',
      name: 'Home & Decor',
      nameBn: 'হোম ও ডেকোরেশন',
    };
  }
  if (lower.includes('gadget') || lower.includes('tech') || lower.includes('watch')) {
    return {
      slug: 'smart-gadgets',
      name: 'Smart Gadgets',
      nameBn: 'স্মার্ট গ্যাজেট',
    };
  }
  const slug =
    lower.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'featured-collection';
  return {
    slug,
    name: rawCat.trim() || 'Smart Gadgets',
    nameBn: rawCat.trim() || 'স্মার্ট গ্যাজেট',
  };
}

function normalizeRemoteBusinessKoroPayload(rawItems: any[]): BusinessKoroCatalogItem[] {
  const normalized: BusinessKoroCatalogItem[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    if (!item || typeof item !== 'object') continue;

    const bkrProductId = item.id ? String(item.id).trim() : '';
    const shortId = bkrProductId
      ? bkrProductId.split('-')[0].toUpperCase()
      : String(item.sku || item.product_code || `ITEM-${i + 1}`)
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '');
    const sku = `BBD-BK-${shortId}`;

    const rawName = String(
      item.name || item.title || item.product_name || `Premium Product ${sku}`
    ).trim();
    const name = sanitizeCustomerProductText(rawName) || rawName;
    const rawNameBn = String(item.name_bn || item.title_bn || item.nameBn || name).trim();
    const nameBn = sanitizeCustomerProductText(rawNameBn) || rawNameBn;

    const costPrice = Math.max(
      50,
      Math.round(
        Number(
          item.costPrice ??
            item.wholesale_price ??
            item.reseller_price ??
            item.cost_price ??
            item.price ??
            400
        ) || 400
      )
    );
    const minSellingPrice = Math.max(
      costPrice,
      Math.round(
        Number(
          item.minimumSellingPrice?.customerPaysDelivery ??
            costPrice + Number(item.packagingCost || 25)
        ) || costPrice
      )
    );
    const suggestedSelling = Math.max(
      minSellingPrice,
      Math.round(
        Number(
          item.suggestedPrice ??
            item.suggestedPriceMin ??
            item.retail_price ??
            Math.round(costPrice * 1.35)
        ) || minSellingPrice
      )
    );
    const suggestedRetail = Math.max(
      suggestedSelling + 150,
      Math.round(
        Number(
          item.suggestedPriceMax ??
            item.regular_price ??
            item.mrp ??
            Math.round(suggestedSelling * 1.22)
        ) || Math.round(suggestedSelling * 1.22)
      )
    );

    const inStock = item.inStock !== false;
    const stockQty = !inStock
      ? 0
      : Math.max(
          1,
          Number(item.stockQuantity ?? item.stock_quantity ?? item.stock ?? 50) || 50
        );

    const rawCat = String(
      item.category_name ||
        (typeof item.category === 'string' ? item.category : item.category?.name) ||
        'Smart Gadgets'
    ).trim();
    const mappedCat = mapBusinessKoroCategory(rawCat);

    const primaryImg = String(
      item.image ||
        item.image_url ||
        (Array.isArray(item.images) && item.images[0]
          ? typeof item.images[0] === 'string'
            ? item.images[0]
            : item.images[0].url || item.images[0].src
          : '') ||
        item.thumbnail ||
        createStudioProductSvg('smartwatch', '#14213D', '#286F65', sku)
    ).trim();

    const galleryMedia: Array<{ type: 'image' | 'video'; url: string; title: string }> = [
      { type: 'image', url: primaryImg, title: nameBn },
    ];
    if (Array.isArray(item.images || item.gallery)) {
      const list = item.images || item.gallery;
      for (const g of list) {
        const gUrl = typeof g === 'string' ? g : g?.url || g?.src || '';
        if (gUrl && gUrl !== primaryImg) {
          galleryMedia.push({ type: 'image', url: String(gUrl), title: nameBn });
        }
      }
    }

    const variants: Array<{
      sku: string;
      size: string;
      color: string;
      priceAdjustmentBdt: number;
      stockQuantity: number;
    }> = [];

    if (Array.isArray(item.variants || item.variations)) {
      const vList = item.variants || item.variations;
      for (let vIdx = 0; vIdx < vList.length; vIdx++) {
        const v = vList[vIdx];
        if (!v || typeof v !== 'object') continue;
        const vSize = String(v.size || v.attribute_size || '').trim();
        const vColor = String(v.color || v.colour || v.attribute_color || '').trim();
        if (!vSize && !vColor) continue;
        const vInStock = v.inStock !== false;
        const vStock = !vInStock
          ? 0
          : Math.max(0, Number(v.stockQuantity ?? v.stock_quantity ?? v.stock ?? 20) || 20);
        const vSku = `${sku}-V${vIdx + 1}`;
        variants.push({
          sku: vSku,
          size: vSize,
          color: vColor,
          priceAdjustmentBdt: Number(v.price_adjustment ?? v.priceAdjustmentBdt ?? 0) || 0,
          stockQuantity: vStock,
        });
      }
    }

    const rawDesc = String(item.description || item.short_description || name).trim();
    const rawDescBn = String(item.description_bn || item.description || nameBn).trim();

    normalized.push({
      bkrProductId,
      sku,
      name,
      nameBn,
      categorySlug: mappedCat.slug,
      categoryName: mappedCat.name,
      categoryNameBn: mappedCat.nameBn,
      wholesalePriceBdt: costPrice,
      minSellingPriceBdt: minSellingPrice,
      suggestedSellingPriceBdt: suggestedSelling,
      suggestedRetailPriceBdt: suggestedRetail,
      stockQuantity: stockQty,
      description: sanitizeCustomerProductText(rawDesc) || rawDesc,
      descriptionBn: sanitizeCustomerProductText(rawDescBn) || rawDescBn,
      imageUrl: primaryImg,
      galleryMedia,
      isFeatured: i < 12,
      isNewArrival: i < 18,
      isBestSeller: i % 2 === 0,
      isSpecialOffer: suggestedRetail > suggestedSelling,
      offerBadgeText: '🔥 বিশেষ অফার',
      variants,
    });
  }
  return normalized;
}

export async function getBusinessKoroSyncStatus() {
  await ensureStoreInitialized();
  const cfg = getBusinessKoroConfig();

  const [allProds, allLogs] = await Promise.all([
    db.select().from(products),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)),
  ]);

  const syncedProducts = allProds.filter((p) =>
    p.sku.toUpperCase().startsWith('BBD-BK-')
  );
  const lastSyncLog = allLogs.find((l) => l.action === 'BUSINESSKORO_SYNC');

  return {
    hasServerApiKey: Boolean(cfg.apiKey),
    endpointUrl: cfg.productsUrl,
    syncedProductsCount: syncedProducts.length,
    catalogFeedAvailableCount: Math.max(54, syncedProducts.length),
    lastSyncAt: lastSyncLog?.createdAt || null,
    lastSyncDetails: lastSyncLog?.details || null,
  };
}

async function syncBusinessKoroProductsInternal(
  adminEmail: string,
  adminUid: string,
  options: {
    markupPercentage?: number;
    fixedMarkupBdt?: number;
    autoPublish?: boolean;
    updateExistingPrices?: boolean;
    restoreDeleted?: boolean;
  }
) {
  const markupPct = Math.max(0, Math.min(300, Number(options.markupPercentage ?? 0)));
  const fixedMarkup = Math.max(0, Number(options.fixedMarkupBdt ?? 0));
  const autoPublish = options.autoPublish !== false;
  const updateExistingPrices = options.updateExistingPrices !== false;
  const restoreDeleted = Boolean(options.restoreDeleted);

  const cfg = getBusinessKoroConfig();
  let catalogItems: BusinessKoroCatalogItem[] = [];
  let syncMode: 'LIVE_API' | 'VERIFIED_RESELLER_FEED' = 'VERIFIED_RESELLER_FEED';
  let remoteNotice = '';
  let insideDhakaCharge = 70;
  let outsideDhakaCharge = 130;

  try {
    const response = await fetch(cfg.productsUrl, {
      method: 'GET',
      headers: getBusinessKoroHeaders(cfg.apiKey, cfg.domain),
      signal: AbortSignal.timeout(12000),
    });

    if (response.ok) {
      const json: any = await response.json();
      if (json?.deliveryCharges) {
        insideDhakaCharge = Number(json.deliveryCharges.insideDhaka) || 70;
        outsideDhakaCharge = Number(json.deliveryCharges.outsideDhaka) || 130;
      }
      const rawList = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.products)
        ? json.products
        : [];
      const parsed = normalizeRemoteBusinessKoroPayload(rawList);
      if (parsed.length > 0) {
        catalogItems = parsed;
        syncMode = 'LIVE_API';
      }
    } else {
      remoteNotice = `লাইভ এপিআই HTTP ${response.status} রিটার্ন করেছে।`;
    }
  } catch (err: any) {
    remoteNotice = 'লাইভ এপিআই সংযোগে সাড়া পাওয়া যায়নি।';
  }

  if (catalogItems.length === 0) {
    throw new Error(remoteNotice || 'BusinessKoro API থেকে পণ্য লোড করা যায়নি।');
  }

  return await db.transaction(async (tx) => {
    // Update delivery charges from BusinessKoro if present
    const allSettings = await tx.select().from(storeSettings);
    if (allSettings[0]) {
      await tx
        .update(storeSettings)
        .set({
          sylhetDeliveryBdt: insideDhakaCharge,
          outsideSylhetDeliveryBdt: outsideDhakaCharge,
        })
        .where(eq(storeSettings.id, allSettings[0].id));
    }

    // Hide initial demo SKUs when real BusinessKoro products arrive
    const demoSkus = new Set([
      'BBD-HD-101',
      'BBD-GD-201',
      'BBD-WT-301',
      'BBD-PJ-401',
      'BBD-GD-202',
      'BBD-BG-501',
      'BBD-GD-203',
      'BBD-FS-102',
      'BBD-BK-101',
      'BBD-BK-102',
      'BBD-BK-201',
      'BBD-BK-202',
      'BBD-BK-301',
      'BBD-BK-401',
    ]);

    const existingCats = await tx.select().from(categories);
    const existingProds = await tx.select().from(products);
    const existingVars = await tx.select().from(productVariants);
    const deletedLogs = await tx
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, 'DELETE_PRODUCT'));
    const deletedSkuSet = new Set(
      deletedLogs.map((l) => (l.entityId || '').trim().toUpperCase())
    );

    for (const ep of existingProds) {
      if (demoSkus.has(ep.sku.toUpperCase()) && ep.isPublished) {
        await tx
          .update(products)
          .set({ isPublished: false })
          .where(eq(products.id, ep.id));
      }
    }

    const catBySlug = new Map(existingCats.map((c) => [c.slug.toLowerCase(), c]));
    const prodBySku = new Map(existingProds.map((p) => [p.sku.toUpperCase(), p]));
    const varsByProductId = new Map<number, Array<typeof productVariants.$inferSelect>>();
    for (const v of existingVars) {
      const list = varsByProductId.get(v.productId) || [];
      list.push(v);
      varsByProductId.set(v.productId, list);
    }

    let createdCount = 0;
    let updatedCount = 0;
    let variantsSyncedCount = 0;
    const now = new Date();

    for (const item of catalogItems) {
      if (!restoreDeleted && deletedSkuSet.has(item.sku.toUpperCase())) {
        continue;
      }
      let cat = catBySlug.get(item.categorySlug.toLowerCase());
      if (!cat) {
        const insertedCat = await tx
          .insert(categories)
          .values({
            name: item.categoryName,
            nameBn: item.categoryNameBn,
            slug: item.categorySlug.toLowerCase(),
            description: `${item.categoryNameBn} — প্রিমিয়াম কালেকশন`,
            sortOrder: catBySlug.size + 1,
            isActive: true,
          })
          .returning();
        cat = insertedCat[0];
        catBySlug.set(cat.slug.toLowerCase(), cat);
      }

      const minPrice = item.minSellingPriceBdt || item.wholesalePriceBdt;
      const baseSellingPrice =
        markupPct > 0
          ? Math.max(
              item.suggestedSellingPriceBdt,
              Math.round(item.wholesalePriceBdt * (1 + markupPct / 100))
            )
          : item.suggestedSellingPriceBdt;
      const calculatedSalePrice = Math.max(minPrice, baseSellingPrice + fixedMarkup);
      const regularPrice = Math.max(
        calculatedSalePrice + 150,
        item.suggestedRetailPriceBdt,
        Math.round(calculatedSalePrice * 1.18)
      );

      const baseSerialized = serializeProductGalleryAndOffer(
        item.galleryMedia.map((gm, idx) => ({
          id: `${item.sku}-media-${idx + 1}`,
          type: gm.type,
          url: gm.url,
          title: sanitizeCustomerProductText(gm.title) || gm.title,
        })),
        {
          badgeText: sanitizeCustomerOfferBadge(item.offerBadgeText || '🔥 বিশেষ অফার'),
          offerEndsAt: '',
          dealNote: 'সীমিত সময়ের বিশেষ ছাড় · সারাদেশে ক্যাশ অন ডেলিভারি সুবিধা',
          promoCouponCode: '',
        }
      );
      let galleryPayloadObj: any = {};
      try {
        galleryPayloadObj = JSON.parse(baseSerialized);
      } catch (_e) {}
      galleryPayloadObj.bkrProductId = item.bkrProductId || '';
      galleryPayloadObj.bkrMinPrice = minPrice;
      galleryPayloadObj.bkrCostPrice = item.wholesalePriceBdt;
      const serializedGallery = JSON.stringify(galleryPayloadObj);

      const cleanSku = item.sku.trim().toUpperCase();
      const existingProd = prodBySku.get(cleanSku);

      let productId: number;

      if (existingProd) {
        await tx
          .update(products)
          .set({
            name: item.name,
            nameBn: item.nameBn,
            categoryId: cat.id,
            description: item.description,
            descriptionBn: item.descriptionBn,
            priceBdt: updateExistingPrices ? regularPrice : existingProd.priceBdt,
            salePriceBdt: updateExistingPrices ? calculatedSalePrice : existingProd.salePriceBdt,
            stockQuantity: item.stockQuantity,
            imageUrl: item.imageUrl || existingProd.imageUrl,
            galleryUrlsJson: serializedGallery,
            isPublished: autoPublish ? true : existingProd.isPublished,
            updatedAt: now,
          })
          .where(eq(products.id, existingProd.id));
        productId = existingProd.id;
        updatedCount++;
      } else {
        const slugBase = item.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        const uniqueSlug = `${slugBase}-${cleanSku.toLowerCase()}`;

        const insertedProd = await tx
          .insert(products)
          .values({
            sku: cleanSku,
            name: item.name,
            nameBn: item.nameBn,
            slug: uniqueSlug,
            categoryId: cat.id,
            description: item.description,
            descriptionBn: item.descriptionBn,
            priceBdt: regularPrice,
            salePriceBdt: calculatedSalePrice,
            stockQuantity: item.stockQuantity,
            lowStockThreshold: 5,
            imageUrl: item.imageUrl,
            galleryUrlsJson: serializedGallery,
            isFeatured: Boolean(item.isFeatured),
            isNewArrival: Boolean(item.isNewArrival),
            isBestSeller: Boolean(item.isBestSeller),
            isSpecialOffer: Boolean(item.isSpecialOffer),
            isSeasonal: false,
            isPublished: autoPublish,
            seoTitle: item.nameBn,
            seoDescription: item.descriptionBn,
          })
          .returning();
        productId = insertedProd[0].id;
        prodBySku.set(cleanSku, insertedProd[0]);
        createdCount++;
      }

      const currentVars = varsByProductId.get(productId) || [];
      for (const v of item.variants) {
        const vSku = v.sku.trim().toUpperCase();
        const matchedVar = currentVars.find((cv) => cv.sku.toUpperCase() === vSku);
        if (matchedVar) {
          await tx
            .update(productVariants)
            .set({
              size: v.size,
              color: v.color,
              priceAdjustmentBdt: v.priceAdjustmentBdt,
              stockQuantity: v.stockQuantity,
              isActive: true,
            })
            .where(eq(productVariants.id, matchedVar.id));
        } else {
          await tx.insert(productVariants).values({
            productId,
            sku: vSku,
            size: v.size,
            color: v.color,
            priceAdjustmentBdt: v.priceAdjustmentBdt,
            stockQuantity: v.stockQuantity,
            isActive: true,
          });
        }
        variantsSyncedCount++;
      }
    }

    const summaryDetails = `Mode: ${syncMode} | Products: ${catalogItems.length} (Created: ${createdCount}, Updated: ${updatedCount}, Variants: ${variantsSyncedCount})`;

    await tx.insert(auditLogs).values({
      actorEmail: adminEmail,
      actorUid: adminUid,
      action: 'BUSINESSKORO_SYNC',
      entityType: 'BusinessKoro',
      entityId: syncMode,
      details: summaryDetails,
    });

    return {
      mode: syncMode,
      totalSynced: catalogItems.length,
      createdCount,
      updatedCount,
      variantsSyncedCount,
      markupPercentage: markupPct,
      fixedMarkupBdt: fixedMarkup,
      remoteNotice,
      message: `Business Koro থেকে মোট ${catalogItems.length}টি পণ্য (${createdCount}টি নতুন, ${updatedCount}টি আপডেট) এবং ${variantsSyncedCount}টি কালার/সাইজ ভ্যারিয়েন্ট সফলভাবে আপনার স্টোরে অটো-সিঙ্ক হয়েছে!`,
    };
  });
}

export async function syncBusinessKoroProducts(
  adminEmail: string,
  adminUid: string,
  options: {
    markupPercentage?: number;
    fixedMarkupBdt?: number;
    autoPublish?: boolean;
    updateExistingPrices?: boolean;
    restoreDeleted?: boolean;
  }
) {
  await ensureStoreInitialized();
  return syncBusinessKoroProductsInternal(adminEmail, adminUid, options);
}

async function forwardOrderToBusinessKoro(
  orderRecord: typeof orders.$inferSelect,
  verifiedItems: Array<{
    product: typeof products.$inferSelect;
    variant: typeof productVariants.$inferSelect | null;
    quantity: number;
    unitPriceBdt: number;
    lineTotalBdt: number;
    variantLabel: string;
  }>,
  input: GuestCheckoutInput,
  normalizedPhone: string
) {
  const cfg = getBusinessKoroConfig();
  if (!cfg.apiKey) return;

  const districtObj = BANGLADESH_DISTRICTS.find(
    (d) => d.name.toLowerCase() === input.district.trim().toLowerCase()
  );
  const customerDivision = (districtObj?.division || 'Dhaka').slice(0, 100);
  const customerDistrict = (input.district.trim() || 'Dhaka').slice(0, 100);
  const rawArea = input.upazila.split('(')[0].trim() || input.upazila.trim() || customerDistrict;
  const customerArea = rawArea.slice(0, 100);

  for (const item of verifiedItems) {
    let bkrProductId = '';
    let bkrMinPrice = 0;
    try {
      const parsed = JSON.parse(item.product.galleryUrlsJson || '{}');
      bkrProductId = String(parsed.bkrProductId || '').trim();
      bkrMinPrice = Number(parsed.bkrMinPrice || parsed.bkrMinimumSellingPrice || 0);
    } catch (_e) {}

    if (!bkrProductId) continue;

    const sellingPrice = Math.max(
      1,
      bkrMinPrice * item.quantity,
      Number(item.lineTotalBdt) || Number(item.unitPriceBdt)
    );

    const noteParts = [
      `Order: ${orderRecord.orderNumber}`,
      item.variantLabel !== 'Standard' ? `Variant: ${item.variantLabel}` : '',
      item.quantity > 1 ? `Qty: ${item.quantity}` : '',
      input.orderNote?.trim() || '',
    ].filter(Boolean);

    const payload = {
      productId: bkrProductId,
      customerName: input.fullName.trim().slice(0, 120),
      customerPhone: normalizedPhone,
      customerAddress: `${input.addressLine.trim()}, ${input.upazila.trim()}, ${input.district.trim()}`.slice(0, 500),
      customerDivision,
      customerDistrict,
      customerArea,
      sellingPrice,
      deliveryChargePaidByCustomer: true,
      customerNote: noteParts.join(' | ').slice(0, 500),
    };

    try {
      const res = await fetch(cfg.ordersUrl, {
        method: 'POST',
        headers: getBusinessKoroHeaders(cfg.apiKey, cfg.domain),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      const respText = await res.text();
      await db.insert(auditLogs).values({
        actorEmail: 'system@boichitrabd.com',
        actorUid: 'system',
        action: 'BUSINESSKORO_ORDER_PUSH',
        entityType: 'Order',
        entityId: orderRecord.orderNumber,
        details: `Product ${bkrProductId} -> HTTP ${res.status}: ${respText.slice(0, 220)}`,
      });
    } catch (err: any) {
      await db.insert(auditLogs).values({
        actorEmail: 'system@boichitrabd.com',
        actorUid: 'system',
        action: 'BUSINESSKORO_ORDER_PUSH_ERROR',
        entityType: 'Order',
        entityId: orderRecord.orderNumber,
        details: `Failed to push ${bkrProductId}: ${err?.message || 'Network error'}`,
      });
    }
  }
}

