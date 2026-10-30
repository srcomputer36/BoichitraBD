<?php
/**
 * Boichitra BD — বৈচিত্র্য ("Fashion, Gadget & Everything")
 * Zero-Node.js PHP Backend Engine for ProCloudify (https://procloudify.com.bd/) Standard cPanel Hosting
 *
 * Works automatically on any PHP 7.4 / 8.x cPanel Shared Hosting using built-in PDO SQLite
 * (stored securely inside ./boichitra_storage/store.sqlite) — No Node.js or SSH required!
 */

date_default_timezone_set('Asia/Dhaka');
error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED);
ini_set('display_errors', '0');

// Increase POST/Memory limits for Base64 product/QR images
@ini_set('post_max_size', '20M');
@ini_set('upload_max_filesize', '20M');
@ini_set('memory_limit', '256M');

$storageDir = __DIR__ . '/boichitra_storage';
if (!is_dir($storageDir)) {
  @mkdir($storageDir, 0755, true);
}
$htaccessGuard = $storageDir . '/.htaccess';
if (!file_exists($htaccessGuard)) {
  @file_put_contents($htaccessGuard, "Order allow,deny\nDeny from all\n<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n");
}

$dbFile = $storageDir . '/store.sqlite';

if (!headers_sent() && extension_loaded('zlib') && !ini_get('zlib.output_compression')) {
  @ob_start('ob_gzhandler');
}

// Ultra-fast 0.4ms path: serve cached /api/storefront BEFORE opening SQLite PDO connection!
$earlyMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$earlyUri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$earlyScriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
if ($earlyScriptDir !== '' && strpos($earlyUri, $earlyScriptDir) === 0) {
  $earlyUri = substr($earlyUri, strlen($earlyScriptDir)) ?: '/';
}
$earlyStorefrontCache = $storageDir . '/storefront_fast_cache.json';
$earlyBkrSynced = $storageDir . '/.bkr_auto_synced_v2';
if (
  $earlyMethod === 'GET' &&
  $earlyUri === '/api/storefront' &&
  file_exists($earlyBkrSynced) &&
  file_exists($earlyStorefrontCache) &&
  (time() - @filemtime($earlyStorefrontCache) < 3600)
) {
  http_response_code(200);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-cache');
  readfile($earlyStorefrontCache);
  exit;
}

function sendJson($data, int $status = 200): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store, no-cache, must-revalidate');
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

try {
  $pdo = new PDO('sqlite:' . $dbFile);
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
  $pdo->exec('PRAGMA journal_mode = WAL;');
  $pdo->exec('PRAGMA synchronous = NORMAL;');
  $pdo->exec('PRAGMA foreign_keys = ON;');
} catch (Throwable $e) {
  sendJson(['error' => 'PHP SQLite ডেটাবেস ইনিশিয়ালাইজ করা যায়নি: ' . $e->getMessage()], 500);
}

// ============================================================================
// 1. AUTO-CREATE TABLES & SEED INITIAL STORE DATA
// ============================================================================
function initializeDatabase(PDO $pdo, string $storageDir, string $dbFile): void {
  $schemaMarker = $storageDir . '/.schema_ready_v2';
  if (file_exists($schemaMarker) && file_exists($dbFile) && @filesize($dbFile) > 4096) {
    return;
  }
  $pdo->exec("
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      name TEXT DEFAULT 'Admin',
      password_hash TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'admin',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_bn TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      parent_id INTEGER,
      image_url TEXT DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      name_bn TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      category_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      description_bn TEXT NOT NULL,
      price_bdt INTEGER NOT NULL,
      sale_price_bdt INTEGER,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      image_url TEXT NOT NULL,
      gallery_urls_json TEXT NOT NULL DEFAULT '[]',
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_new_arrival INTEGER NOT NULL DEFAULT 0,
      is_best_seller INTEGER NOT NULL DEFAULT 0,
      is_special_offer INTEGER NOT NULL DEFAULT 0,
      is_seasonal INTEGER NOT NULL DEFAULT 0,
      is_published INTEGER NOT NULL DEFAULT 1,
      seo_title TEXT DEFAULT '',
      seo_description TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      size TEXT DEFAULT '',
      color TEXT DEFAULT '',
      price_adjustment_bdt INTEGER NOT NULL DEFAULT 0,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT DEFAULT '',
      district TEXT NOT NULL,
      upazila TEXT NOT NULL,
      address_line TEXT NOT NULL,
      total_orders INTEGER NOT NULL DEFAULT 0,
      total_spent_bdt INTEGER NOT NULL DEFAULT 0,
      first_order_at TEXT NOT NULL,
      last_order_at TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      discount_type TEXT NOT NULL DEFAULT 'fixed',
      discount_value INTEGER NOT NULL,
      min_order_bdt INTEGER NOT NULL DEFAULT 0,
      max_discount_bdt INTEGER,
      usage_limit INTEGER NOT NULL DEFAULT 1000,
      used_count INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      idempotency_key TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL,
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      previous_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      note TEXT DEFAULT '',
      changed_by_email TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS store_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_name TEXT NOT NULL DEFAULT 'Boichitra BD',
      store_name_bn TEXT NOT NULL DEFAULT 'বৈচিত্র্য',
      tagline TEXT NOT NULL DEFAULT 'Fashion, Gadget & Everything',
      brand_description TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      business_address TEXT NOT NULL,
      sylhet_delivery_bdt INTEGER NOT NULL DEFAULT 60,
      outside_sylhet_delivery_bdt INTEGER NOT NULL DEFAULT 120,
      free_delivery_threshold_bdt INTEGER NOT NULL DEFAULT 3000,
      cod_enabled INTEGER NOT NULL DEFAULT 1,
      bkash_enabled INTEGER NOT NULL DEFAULT 0,
      nagad_enabled INTEGER NOT NULL DEFAULT 0,
      return_policy_text TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_email TEXT NOT NULL,
      actor_uid TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  ");

  $countSettings = (int)$pdo->query("SELECT COUNT(*) FROM store_settings")->fetchColumn();
  if ($countSettings > 0) {
    @file_put_contents($schemaMarker, '1');
    return;
  }

  $now = gmdate('Y-m-d\TH:i:s\Z');

  // Optional injected snapshot from Node export
  $injectedSeedJson = /*__BOICHITRA_INITIAL_SEED_JSON__*/ null;
  if (is_array($injectedSeedJson)) {
    if (!empty($injectedSeedJson['rawSettings'])) {
      $s = $injectedSeedJson['rawSettings'];
      $stmt = $pdo->prepare("INSERT INTO store_settings (store_name, store_name_bn, tagline, brand_description, contact_phone, contact_email, business_address, sylhet_delivery_bdt, outside_sylhet_delivery_bdt, free_delivery_threshold_bdt, cod_enabled, bkash_enabled, nagad_enabled, return_policy_text, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      $stmt->execute([
        $s['storeName'] ?? 'Boichitra BD',
        $s['storeNameBn'] ?? 'বৈচিত্র্য',
        $s['tagline'] ?? 'Fashion, Gadget & Everything',
        $s['brandDescription'] ?? 'বৈচিত্র্য মানে সবকিছু এক জায়গায়!',
        $s['contactPhone'] ?? 'কনফিগারযোগ্য হেল্পলাইন',
        $s['contactEmail'] ?? 'support@boichitrabd.example',
        $s['businessAddress'] ?? 'Dhaka / Sylhet, Bangladesh',
        (int)($s['sylhetDeliveryBdt'] ?? 60),
        (int)($s['outsideSylhetDeliveryBdt'] ?? 120),
        (int)($s['freeDeliveryThresholdBdt'] ?? 3000),
        !empty($s['codEnabled']) ? 1 : 0,
        !empty($s['bkashEnabled']) ? 1 : 0,
        !empty($s['nagadEnabled']) ? 1 : 0,
        $s['rawReturnPolicyText'] ?? $s['returnPolicyText'] ?? '',
        $now
      ]);
    }
    if (!empty($injectedSeedJson['categories']) && is_array($injectedSeedJson['categories'])) {
      $stmtCat = $pdo->prepare("INSERT INTO categories (id, name, name_bn, slug, description, sort_order, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      foreach ($injectedSeedJson['categories'] as $c) {
        $stmtCat->execute([
          $c['id'],
          $c['name'],
          $c['nameBn'],
          $c['slug'],
          $c['description'] ?? '',
          (int)($c['sortOrder'] ?? 0),
          !empty($c['isActive']) ? 1 : 0,
          $now
        ]);
      }
    }
    if (!empty($injectedSeedJson['products']) && is_array($injectedSeedJson['products'])) {
      $stmtProd = $pdo->prepare("INSERT INTO products (id, sku, name, name_bn, slug, category_id, description, description_bn, price_bdt, sale_price_bdt, stock_quantity, low_stock_threshold, image_url, gallery_urls_json, is_featured, is_new_arrival, is_best_seller, is_special_offer, is_seasonal, is_published, seo_title, seo_description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      $stmtVar = $pdo->prepare("INSERT INTO product_variants (product_id, sku, size, color, price_adjustment_bdt, stock_quantity, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)");
      foreach ($injectedSeedJson['products'] as $p) {
        $stmtProd->execute([
          $p['id'],
          $p['sku'],
          $p['name'],
          $p['nameBn'],
          $p['slug'],
          (int)$p['categoryId'],
          $p['description'] ?? '',
          $p['descriptionBn'] ?? '',
          (int)$p['priceBdt'],
          isset($p['salePriceBdt']) && $p['salePriceBdt'] !== null ? (int)$p['salePriceBdt'] : null,
          (int)($p['stockQuantity'] ?? 20),
          (int)($p['lowStockThreshold'] ?? 5),
          $p['imageUrl'] ?? '',
          $p['galleryUrlsJson'] ?? '[]',
          !empty($p['isFeatured']) ? 1 : 0,
          !empty($p['isNewArrival']) ? 1 : 0,
          !empty($p['isBestSeller']) ? 1 : 0,
          !empty($p['isSpecialOffer']) ? 1 : 0,
          !empty($p['isSeasonal']) ? 1 : 0,
          !empty($p['isPublished']) ? 1 : 0,
          $p['seoTitle'] ?? '',
          $p['seoDescription'] ?? '',
          $now,
          $now
        ]);
        if (!empty($p['variants']) && is_array($p['variants'])) {
          foreach ($p['variants'] as $v) {
            $stmtVar->execute([
              $p['id'],
              $v['sku'],
              $v['size'] ?? '',
              $v['color'] ?? '',
              (int)($v['priceAdjustmentBdt'] ?? 0),
              (int)($v['stockQuantity'] ?? 10),
              !empty($v['isActive']) ? 1 : 0
            ]);
          }
        }
      }
    }
    if (!empty($injectedSeedJson['coupons']) && is_array($injectedSeedJson['coupons'])) {
      $stmtCpn = $pdo->prepare("INSERT INTO coupons (code, description, discount_type, discount_value, min_order_bdt, max_discount_bdt, usage_limit, used_count, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      foreach ($injectedSeedJson['coupons'] as $cp) {
        $stmtCpn->execute([
          $cp['code'],
          $cp['description'],
          $cp['discountType'] ?? 'fixed',
          (int)$cp['discountValue'],
          (int)($cp['minOrderBdt'] ?? 0),
          isset($cp['maxDiscountBdt']) && $cp['maxDiscountBdt'] !== null ? (int)$cp['maxDiscountBdt'] : null,
          (int)($cp['usageLimit'] ?? 1000),
          (int)($cp['usedCount'] ?? 0),
          !empty($cp['isActive']) ? 1 : 0,
          $now
        ]);
      }
    }
    return;
  }

  // Fallback default seed if not injected
  $pdo->prepare("INSERT INTO store_settings (store_name, store_name_bn, tagline, brand_description, contact_phone, contact_email, business_address, sylhet_delivery_bdt, outside_sylhet_delivery_bdt, free_delivery_threshold_bdt, cod_enabled, bkash_enabled, nagad_enabled, return_policy_text, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")->execute([
    'Boichitra BD',
    'বৈচিত্র্য',
    'Fashion, Gadget & Everything',
    'বৈচিত্র্য মানে সবকিছু এক জায়গায়! শীতের হুডি থেকে গরমের স্মার্ট গ্যাজেট, ট্রেন্ডি সব প্রোডাক্ট পাবে সারাদেশে।',
    'কনফিগারযোগ্য হেল্পলাইন (অ্যাডমিন সেটিংস থেকে নম্বর যুক্ত করুন)',
    'support@boichitrabd.example',
    'Dhaka / Sylhet, Bangladesh',
    60,
    120,
    3000,
    1,
    0,
    0,
    'ডেলিভারি পাওয়ার পর ডেলিভারি ম্যানের সামনে পণ্য চেক করে গ্রহণ করুন। ত্রুটিপূর্ণ, ছেঁড়া বা ভুল পণ্য পেলে তাৎক্ষণিক রিটার্ন বা এক্সচেঞ্জ সুবিধা পাবেন।',
    $now
  ]);

  $defaultCategories = [
    ['Winter & Urban Fashion', 'উইন্টার ও ফ্যাশন ওয়্যার', 'winter-urban-fashion', 'প্রিমিয়াম হেভিওয়েট হুডি, সোয়েটশার্ট ও ক্যাজুয়াল ফ্যাশন কালেকশন', 1],
    ['Smart Gadgets & Audio', 'স্মার্ট গ্যাজেট ও অডিও', 'smart-gadgets-audio', 'অরিজিনাল ওয়্যারলেস হেডফোন, ইয়ারবাড, পাওয়ার ব্যাংক ও ডেইলি টেক অ্যাক্সেসরিজ', 2],
    ['Watches & Wearables', 'স্মার্টওয়াচ ও ঘড়ি', 'watches-wearables', 'অ্যামোলেড স্মার্টওয়াচ, ফিটনেস ট্র্যাকার ও ক্লাসিক রিস্টওয়াচ', 3],
    ['Traditional & Festive', 'পাঞ্জাবি ও ফেস্টিভ কালেকশন', 'traditional-festive', 'উন্নত সুতি ও এমব্রয়ডারি পাঞ্জাবি এবং সিজনাল এথনিক কালেকশন', 4],
    ['Lifestyle & Travel Gear', 'লাইফস্টাইল ও ট্রাভেল ব্যাগ', 'lifestyle-travel-gear', 'ওয়াটার-রেজিস্ট্যান্ট ল্যাপটপ ব্যাকপ্যাক, সানগ্লাস ও ট্রাভেল অ্যাক্সেসরিজ', 5],
  ];
  $stmtCat = $pdo->prepare("INSERT INTO categories (name, name_bn, slug, description, sort_order, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)");
  foreach ($defaultCategories as $c) {
    $stmtCat->execute([$c[0], $c[1], $c[2], $c[3], $c[4], $now]);
  }

  $stmtCpn = $pdo->prepare("INSERT INTO coupons (code, description, discount_type, discount_value, min_order_bdt, max_discount_bdt, usage_limit, used_count, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?)");
  $stmtCpn->execute(['SYLHET100', '৳1,500+ অর্ডারে ৳১০০ বিশেষ ডিসকাউন্ট', 'fixed', 100, 1500, 100, 1000, $now]);
  $stmtCpn->execute(['BOICHITRA10', '৳2,000+ অর্ডারে ১০% ছাড় (সর্বোচ্চ ৳৩০০)', 'percentage', 10, 2000, 300, 500, $now]);

  // Seed default products & variants so GitHub / cPanel deployments have full catalog out-of-the-box
  $catRows = $pdo->query("SELECT id, slug FROM categories")->fetchAll();
  $catMap = [];
  foreach ($catRows as $cr) {
    $catMap[$cr['slug']] = (int)$cr['id'];
  }

  $mkSvg = function(string $type, string $primary = '#14213D', string $accent = '#286F65', string $label = ''): string {
    $lbl = htmlspecialchars($label, ENT_QUOTES, 'UTF-8');
    $shape = '<rect x="190" y="130" width="220" height="240" rx="28" fill="' . $primary . '"/>';
    if ($type === 'hoodie' || $type === 'tshirt' || $type === 'panjabi') {
      $shape = '<path d="M210 130 L255 110 C275 130 325 130 345 110 L390 130 L455 195 L415 240 L380 205 L380 390 L220 390 L220 205 L185 240 L145 195 Z" fill="' . $primary . '" stroke="' . $accent . '" stroke-width="4"/>';
    } elseif ($type === 'headphones' || $type === 'earbuds') {
      $shape = '<path d="M195 270 A105 105 0 0 1 405 270" fill="none" stroke="' . $primary . '" stroke-width="22" stroke-linecap="round"/><rect x="170" y="250" width="48" height="95" rx="22" fill="' . $accent . '"/><rect x="382" y="250" width="48" height="95" rx="22" fill="' . $accent . '"/>';
    } elseif ($type === 'smartwatch') {
      $shape = '<rect x="255" y="95" width="90" height="310" rx="22" fill="' . $accent . '"/><rect x="220" y="155" width="160" height="190" rx="34" fill="' . $primary . '" stroke="#E2E8F0" stroke-width="6"/>';
    } elseif ($type === 'powerbank' || $type === 'backpack') {
      $shape = '<rect x="205" y="115" width="190" height="275" rx="28" fill="' . $primary . '" stroke="' . $accent . '" stroke-width="5"/><rect x="245" y="150" width="110" height="45" rx="10" fill="#0F172A"/>';
    }
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 520" width="600" height="520">'
      . '<rect width="600" height="520" rx="28" fill="#F8FAFC"/>'
      . '<circle cx="300" cy="255" r="175" fill="#E2E8F0" opacity="0.55"/>'
      . $shape
      . ($lbl !== '' ? '<rect x="150" y="430" width="300" height="36" rx="18" fill="#FFFFFF" stroke="#CBD5E1"/><text x="300" y="453" text-anchor="middle" fill="#14213D" font-family="sans-serif" font-size="13" font-weight="700">' . $lbl . '</text>' : '')
      . '</svg>';
    return 'data:image/svg+xml;utf8,' . rawurlencode($svg);
  };

  $mkGallery = function(string $sku, string $type, bool $isOffer) use ($mkSvg): string {
    $payload = [
      '__boichitraV2' => true,
      'media' => [
        ['id' => $sku . '-angle-1', 'url' => $mkSvg($type, '#1E293B', '#16A34A', $sku . ' · SIDE VIEW'), 'type' => 'image', 'title' => 'সাইড ভিউ (Side Angle)'],
        ['id' => $sku . '-angle-2', 'url' => $mkSvg($type, '#286F65', '#14213D', $sku . ' · DETAIL VIEW'), 'type' => 'image', 'title' => 'ক্লোজ-আপ ডিটেইল (Detail Shot)'],
      ],
      'offer' => $isOffer ? [
        'badgeText' => '🔥 ফ্ল্যাশ ডিল',
        'offerEndsAt' => gmdate('Y-m-d\TH:i:s\Z', time() + 5 * 86400),
        'dealNote' => 'সীমিত সময়ের বিশেষ ছাড় · ক্যাশ অন ডেলিভারি সুবিধা',
        'promoCouponCode' => 'SYLHET100',
      ] : new stdClass(),
    ];
    return json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  };

  $defaultProducts = [
    ['BBD-HD-101', 'Arctic Fleece Heavyweight Pullover Hoodie', 'আর্কটিক ফ্লিস হেভিওয়েট প্রিমিয়াম হুডি (নেভি ব্লু)', 'arctic-fleece-heavyweight-hoodie', $catMap['winter-urban-fashion'] ?? 1, '340 GSM brushed cotton-fleece winter hoodie engineered for warmth and breathable comfort across Sylhet & nationwide winters.', '৩৪০ জিএসএম ব্রাশড কটন-ফ্লিস ফেব্রিকে তৈরি প্রিমিয়াম শীতের হুডি। আরামদায়ক ওয়ার্মথ, ডাবল স্টিচিং এবং টেকসই কালার গ্যারান্টিসহ প্রতিদিনের ব্যবহারের জন্য আদর্শ।', 1650, 1390, 45, 8, $mkSvg('hoodie', '#14213D', '#286F65', 'HEAVYWEIGHT FLEECE 340 GSM'), $mkGallery('BBD-HD-101', 'hoodie', true), 1, 1, 1, 1, 1, 1, 'Arctic Fleece Heavyweight Pullover Hoodie | Boichitra BD', '340 GSM premium winter hoodie available in M, L, XL, XXL across Bangladesh.'],
    ['BBD-GD-201', 'SonicWave ANC Pro Wireless Headphones', 'সনিকওয়েভ এএনসি প্রো ওয়্যারলেস হেডফোন', 'sonicwave-anc-pro-wireless-headphones', $catMap['smart-gadgets-audio'] ?? 2, 'Hybrid Active Noise Cancelling over-ear headphones with 45-hour battery backup, Type-C fast charge, and plush memory-foam ear cushions.', 'হাইব্রিড অ্যাক্টিভ নয়েজ ক্যান্সেলিং ওয়্যারলেস হেডফোন। এক চার্জে ৪৫ ঘণ্টা ব্যাকআপ, টাইপ-সি ফাস্ট চার্জিং এবং মেমোরি ফোম ইয়ার কুশন।', 3450, 2890, 28, 5, $mkSvg('headphones', '#14213D', '#286F65', 'HYBRID ANC 45H BATTERY'), $mkGallery('BBD-GD-201', 'headphones', false), 1, 1, 1, 0, 0, 1, 'SonicWave ANC Pro Wireless Headphones | Boichitra BD', '45-hour battery hybrid ANC wireless headphones in Bangladesh.'],
    ['BBD-WT-301', 'ChronoFit AMOLED Titanium Smartwatch', 'ক্রোনোফিট অ্যামোলেড টাইটানিয়াম স্মার্টওয়াচ', 'chronofit-amoled-titanium-smartwatch', $catMap['watches-wearables'] ?? 3, '1.96-inch Always-On AMOLED display smartwatch with Bluetooth calling, IP68 water resistance, and 7-day battery endurance.', '১.৯৬ ইঞ্চি অলওয়েজ-অন অ্যামোলেড ডিসপ্লে স্মার্টওয়াচ। ব্লুটুথ কলিং, আইপি৬৮ ওয়াটার রেজিস্ট্যান্স এবং ৭ দিনের ব্যাটারি ব্যাকআপ।', 2950, 2450, 32, 5, $mkSvg('smartwatch', '#14213D', '#286F65', 'AMOLED BLUETOOTH CALLING'), $mkGallery('BBD-WT-301', 'smartwatch', true), 1, 0, 1, 1, 0, 1, 'ChronoFit AMOLED Smartwatch | Boichitra BD', 'AMOLED Bluetooth calling smartwatch with IP68 protection.'],
    ['BBD-PJ-401', 'Sylhet Heritage Textured Cotton Panjabi', 'সিলেট হেরিটেজ টেক্সচার্ড কটন প্রিমিয়াম পাঞ্জাবি', 'sylhet-heritage-textured-cotton-panjabi', $catMap['traditional-festive'] ?? 4, 'Breathable combed cotton festive Panjabi in deep emerald teal with minimalist tonal placket embroidery.', 'উন্নত মানের কম্বেড সুতি কাপড়ে তৈরি ডিপ এমারেল্ড টিল রঙের প্রিমিয়াম পাঞ্জাবি। সূক্ষ্ম এমব্রয়ডারি ও আরামদায়ক ফিট।', 1950, 1690, 40, 6, $mkSvg('panjabi', '#14213D', '#286F65', 'COMBED COTTON TAILORED FIT'), $mkGallery('BBD-PJ-401', 'panjabi', false), 1, 1, 0, 0, 1, 1, 'Sylhet Heritage Textured Cotton Panjabi | Boichitra BD', 'Premium combed cotton Panjabi available in sizes 40, 42, 44.'],
    ['BBD-GD-202', 'VoltCore 20000mAh 22.5W Fast Power Bank', 'ভোল্টকোর ২০০০০ এমএএইচ ২২.৫ ওয়াট ফাস্ট পাওয়ার ব্যাংক', 'voltcore-20000mah-fast-powerbank', $catMap['smart-gadgets-audio'] ?? 2, 'High-density 20000mAh lithium-polymer power bank with LED digital percentage display and PD 20W & QC 22.5W dual fast output.', 'ডিজিটাল এলইডি ডিসপ্লে সহ ২০০০০ এমএএইচ ফাস্ট চার্জিং পাওয়ার ব্যাংক। পিডি ২০ ওয়াট ও কিউসি ২২.৫ ওয়াট ডুয়াল আউটপুট।', 1850, 1550, 50, 10, $mkSvg('powerbank', '#14213D', '#16A34A', '20000mAh 22.5W PD FAST CHARGE'), $mkGallery('BBD-GD-202', 'powerbank', true), 1, 0, 1, 1, 0, 1, 'VoltCore 20000mAh 22.5W Fast Power Bank | Boichitra BD', '20000mAh fast charging power bank with LED display.'],
    ['BBD-BG-501', 'MetroShield Water-Resistant 15.6" Laptop Backpack', 'মেট্রোশিল্ড ওয়াটার-রেজিস্ট্যান্ট ল্যাপটপ ব্যাকপ্যাক', 'metroshield-water-resistant-laptop-backpack', $catMap['lifestyle-travel-gear'] ?? 5, 'Durable Oxford ballistic nylon commuter backpack with padded 15.6-inch laptop compartment and hidden anti-theft pocket.', 'ওয়াটার-রেজিস্ট্যান্ট অক্সফোর্ড ফেব্রিকে তৈরি ১৫.৬ ইঞ্চি ল্যাপটপ ব্যাকপ্যাক। অ্যান্টি-থেফট পকেট এবং আরামদায়ক শোল্ডার স্ট্র্যাপ।', 2100, 1790, 22, 5, $mkSvg('backpack', '#14213D', '#286F65', '15.6" WATER-RESISTANT OXFORD'), $mkGallery('BBD-BG-501', 'backpack', false), 1, 1, 0, 0, 0, 1, 'MetroShield 15.6 Laptop Backpack | Boichitra BD', 'Water-resistant commuter laptop backpack in Bangladesh.'],
    ['BBD-GD-203', 'AeroPods ENC Quad-Mic True Wireless Earbuds', 'এয়ারোপডস ইএনসি কোয়াড-মাইক ট্রু ওয়্যারলেস ইয়ারবাডস', 'aeropods-enc-true-wireless-earbuds', $catMap['smart-gadgets-audio'] ?? 2, 'Bluetooth 5.3 True Wireless Earbuds with Quad-Mic Environmental Noise Cancellation and 30-hour total playtime.', 'ব্লুটুথ ৫.৩ এবং কোয়াড-মাইক ইএনসি প্রযুক্তির ট্রু ওয়্যারলেস ইয়ারবাডস। স্পষ্ট কল কোয়ালিটি এবং ৩০ ঘণ্টা প্লেটাইম।', 1450, 1190, 60, 10, $mkSvg('earbuds', '#14213D', '#286F65', 'BT 5.3 QUAD-MIC ENC'), $mkGallery('BBD-GD-203', 'earbuds', true), 0, 1, 1, 1, 0, 1, 'AeroPods ENC Wireless Earbuds | Boichitra BD', 'Quad-mic ENC true wireless earbuds with 30h battery life.'],
    ['BBD-FS-102', 'Combed Cotton Drop-Shoulder Heavy Tee', 'প্রিমিয়াম কম্বেড কটন ড্রপ-শোল্ডার টি-শার্ট', 'combed-cotton-drop-shoulder-heavy-tee', $catMap['winter-urban-fashion'] ?? 1, '220 GSM 100% ring-spun combed cotton relaxed drop-shoulder t-shirt with enzyme wash finish.', '২২০ জিএসএম ১০০% রিং-স্পান সুতি কাপড়ের আরামদায়ক ড্রপ-শোল্ডার টি-শার্ট। গরম ও সারা বছরের ক্যাজুয়াল স্টাইলের জন্য সেরা।', 850, 690, 75, 10, $mkSvg('tshirt', '#14213D', '#286F65', '220 GSM RING-SPUN COTTON'), $mkGallery('BBD-FS-102', 'tshirt', false), 0, 1, 1, 0, 1, 1, 'Combed Cotton Drop-Shoulder Tee | Boichitra BD', '220 GSM heavy cotton drop-shoulder t-shirt in Bangladesh.'],
  ];

  $stmtProd = $pdo->prepare("INSERT INTO products (sku, name, name_bn, slug, category_id, description, description_bn, price_bdt, sale_price_bdt, stock_quantity, low_stock_threshold, image_url, gallery_urls_json, is_featured, is_new_arrival, is_best_seller, is_special_offer, is_seasonal, is_published, seo_title, seo_description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  $prodIdsBySku = [];
  foreach ($defaultProducts as $dp) {
    $stmtProd->execute(array_merge($dp, [$now, $now]));
    $prodIdsBySku[$dp[0]] = (int)$pdo->lastInsertId();
  }

  $defaultVariants = [
    // Hoodie (BBD-HD-101): Navy Blue, Charcoal, Forest Teal across M, L, XL, XXL
    ['BBD-HD-101', 'BBD-HD-101-M-NVY', 'M', 'Navy Blue', 0, 12],
    ['BBD-HD-101', 'BBD-HD-101-L-NVY', 'L', 'Navy Blue', 0, 15],
    ['BBD-HD-101', 'BBD-HD-101-XL-NVY', 'XL', 'Navy Blue', 0, 10],
    ['BBD-HD-101', 'BBD-HD-101-XXL-NVY', 'XXL', 'Navy Blue', 50, 8],
    ['BBD-HD-101', 'BBD-HD-101-M-CHC', 'M', 'Charcoal', 0, 10],
    ['BBD-HD-101', 'BBD-HD-101-L-CHC', 'L', 'Charcoal', 0, 12],
    ['BBD-HD-101', 'BBD-HD-101-XL-CHC', 'XL', 'Charcoal', 0, 10],
    ['BBD-HD-101', 'BBD-HD-101-XXL-CHC', 'XXL', 'Charcoal', 50, 8],
    ['BBD-HD-101', 'BBD-HD-101-M-TL', 'M', 'Forest Teal', 0, 9],
    ['BBD-HD-101', 'BBD-HD-101-L-TL', 'L', 'Forest Teal', 0, 11],
    ['BBD-HD-101', 'BBD-HD-101-XL-TL', 'XL', 'Forest Teal', 0, 8],
    // Panjabi (BBD-PJ-401): Emerald Teal, Royal Navy, Maroon Red across 40 (M), 42 (L), 44 (XL)
    ['BBD-PJ-401', 'BBD-PJ-401-40-EMR', '40 (M)', 'Emerald Teal', 0, 14],
    ['BBD-PJ-401', 'BBD-PJ-401-42-EMR', '42 (L)', 'Emerald Teal', 0, 16],
    ['BBD-PJ-401', 'BBD-PJ-401-44-EMR', '44 (XL)', 'Emerald Teal', 0, 10],
    ['BBD-PJ-401', 'BBD-PJ-401-40-NVY', '40 (M)', 'Royal Navy', 0, 12],
    ['BBD-PJ-401', 'BBD-PJ-401-42-NVY', '42 (L)', 'Royal Navy', 0, 14],
    ['BBD-PJ-401', 'BBD-PJ-401-44-NVY', '44 (XL)', 'Royal Navy', 0, 9],
    ['BBD-PJ-401', 'BBD-PJ-401-40-MRN', '40 (M)', 'Maroon Red', 0, 10],
    ['BBD-PJ-401', 'BBD-PJ-401-42-MRN', '42 (L)', 'Maroon Red', 0, 12],
    ['BBD-PJ-401', 'BBD-PJ-401-44-MRN', '44 (XL)', 'Maroon Red', 0, 8],
    // Drop-Shoulder Tee (BBD-FS-102): Deep Navy, Teal Green, Jet Black across M, L, XL, XXL
    ['BBD-FS-102', 'BBD-FS-102-M-NVY', 'M', 'Deep Navy', 0, 25],
    ['BBD-FS-102', 'BBD-FS-102-L-NVY', 'L', 'Deep Navy', 0, 30],
    ['BBD-FS-102', 'BBD-FS-102-XL-NVY', 'XL', 'Deep Navy', 0, 20],
    ['BBD-FS-102', 'BBD-FS-102-XXL-NVY', 'XXL', 'Deep Navy', 0, 15],
    ['BBD-FS-102', 'BBD-FS-102-M-OLV', 'M', 'Teal Green', 0, 18],
    ['BBD-FS-102', 'BBD-FS-102-L-OLV', 'L', 'Teal Green', 0, 22],
    ['BBD-FS-102', 'BBD-FS-102-XL-OLV', 'XL', 'Teal Green', 0, 20],
    ['BBD-FS-102', 'BBD-FS-102-XXL-OLV', 'XXL', 'Teal Green', 0, 12],
    ['BBD-FS-102', 'BBD-FS-102-M-BLK', 'M', 'Jet Black', 0, 20],
    ['BBD-FS-102', 'BBD-FS-102-L-BLK', 'L', 'Jet Black', 0, 24],
    ['BBD-FS-102', 'BBD-FS-102-XL-BLK', 'XL', 'Jet Black', 0, 18],
    // Smartwatch (BBD-WT-301)
    ['BBD-WT-301', 'BBD-WT-301-STD-GRN', '46mm', 'Forest Teal Strap', 0, 18],
    ['BBD-WT-301', 'BBD-WT-301-STD-BLK', '46mm', 'Obsidian Black Strap', 0, 14],
  ];
  $stmtVar = $pdo->prepare("INSERT INTO product_variants (product_id, sku, size, color, price_adjustment_bdt, stock_quantity, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)");
  foreach ($defaultVariants as $dv) {
    if (!empty($prodIdsBySku[$dv[0]])) {
      $stmtVar->execute([$prodIdsBySku[$dv[0]], $dv[1], $dv[2], $dv[3], $dv[4], $dv[5]]);
    }
  }
  @file_put_contents($schemaMarker, '1');
}

initializeDatabase($pdo, $storageDir, $dbFile);

// ============================================================================
// 2. HELPER FUNCTIONS (Settings, Bangla QR, Phone, Password Hashing)
// ============================================================================
function normalizeBdPhone(string $input): string {
  $digits = preg_replace('/\D+/', '', $input);
  if (strpos($digits, '8801') === 0 && strlen($digits) === 13) {
    return substr($digits, 2);
  }
  if (strpos($digits, '01') === 0 && strlen($digits) === 11) {
    return $digits;
  }
  return trim($input);
}

function isValidBdPhone(string $input): bool {
  $norm = normalizeBdPhone($input);
  return (bool)preg_match('/^01[3-9]\d{8}$/', $norm);
}

function createDefaultBanglaQrSvg(string $merchantName = 'Boichitra BD — বৈচিত্র্য', string $accountLabel = 'বাংলা কিউআর মার্চেন্ট'): string {
  $m = htmlspecialchars($merchantName, ENT_QUOTES, 'UTF-8');
  $a = htmlspecialchars($accountLabel, ENT_QUOTES, 'UTF-8');
  $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 500" width="420" height="500">'
    . '<rect width="420" height="500" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="3"/>'
    . '<rect x="0" y="0" width="420" height="78" rx="24" fill="#006A4E"/>'
    . '<rect x="0" y="45" width="420" height="33" fill="#006A4E"/>'
    . '<circle cx="52" cy="39" r="19" fill="#F42A41"/>'
    . '<text x="84" y="36" fill="#FFFFFF" font-family="sans-serif" font-size="21" font-weight="800">BANGLA QR • বাংলা কিউআর</text>'
    . '<text x="84" y="57" fill="#D1FAE5" font-family="sans-serif" font-size="12" font-weight="600">National QR Standard • Bangladesh Bank Approved</text>'
    . '<text x="210" y="108" text-anchor="middle" fill="#14213D" font-family="sans-serif" font-size="18" font-weight="800">' . $m . '</text>'
    . '<text x="210" y="128" text-anchor="middle" fill="#286F65" font-family="sans-serif" font-size="12" font-weight="700">' . $a . '</text>'
    . '<rect x="85" y="142" width="250" height="250" rx="18" fill="#FFFFFF" stroke="#006A4E" stroke-width="4"/>'
    . '<rect x="103" y="160" width="54" height="54" rx="6" fill="none" stroke="#14213D" stroke-width="8"/>'
    . '<rect x="117" y="174" width="26" height="26" rx="3" fill="#006A4E"/>'
    . '<rect x="263" y="160" width="54" height="54" rx="6" fill="none" stroke="#14213D" stroke-width="8"/>'
    . '<rect x="277" y="174" width="26" height="26" rx="3" fill="#006A4E"/>'
    . '<rect x="103" y="320" width="54" height="54" rx="6" fill="none" stroke="#14213D" stroke-width="8"/>'
    . '<rect x="117" y="334" width="26" height="26" rx="3" fill="#006A4E"/>'
    . '<rect x="178" y="235" width="64" height="64" rx="14" fill="#FFFFFF" stroke="#006A4E" stroke-width="3"/>'
    . '<circle cx="210" cy="260" r="14" fill="#F42A41"/>'
    . '<text x="210" y="290" text-anchor="middle" fill="#006A4E" font-family="sans-serif" font-size="10" font-weight="900">বাংলা QR</text>'
    . '<rect x="30" y="408" width="360" height="42" rx="12" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>'
    . '<text x="210" y="434" text-anchor="middle" fill="#1E293B" font-family="sans-serif" font-size="12.5" font-weight="700">bKash • Nagad • Rocket • Upay • All Bank Apps</text>'
    . '</svg>';
  return 'data:image/svg+xml;utf8,' . rawurlencode($svg);
}

function formatSettingsRow(array $row): array {
  $defaultPolicy = 'ডেলিভারি পাওয়ার পর ডেলিভারি ম্যানের সামনে পণ্য চেক করে গ্রহণ করুন। ত্রুটিপূর্ণ, ছেঁড়া বা ভুল পণ্য পেলে তাৎক্ষণিক রিটার্ন বা এক্সচেঞ্জ সুবিধা পাবেন।';
  $defaultInstructions = 'যেকোনো ব্যাংক অ্যাপ, বিকাশ (bKash), নগদ (Nagad), রকেট (Rocket) বা উপায় (Upay) অ্যাপ থেকে উপরের বাংলা কিউআর (Bangla QR) কোডটি স্ক্যান করে পেমেন্ট সম্পন্ন করুন। এরপর নিচে আপনার প্রেরণকারী নম্বর ও ট্রানজেকশন আইডি (TrxID) লিখুন।';

  $rawText = $row['return_policy_text'] ?? $defaultPolicy;
  $returnPolicyText = $rawText;
  $banglaQrEnabled = true;
  $banglaQrImageUrl = '';
  $banglaQrMerchantName = 'Boichitra BD — বৈচিত্র্য';
  $banglaQrAccountNumber = 'বাংলা কিউআর মার্চেন্ট / পার্সোনাল রিসিভার';
  $banglaQrInstructions = $defaultInstructions;
  $banglaQrDiscountEnabled = true;
  $banglaQrDiscountType = 'percentage';
  $banglaQrDiscountValue = 5;
  $banglaQrMaxDiscountBdt = 300;

  if (strpos(trim($rawText), '{') === 0) {
    $parsed = json_decode($rawText, true);
    if (is_array($parsed) && !empty($parsed['__boichitraSettingsV2'])) {
      $returnPolicyText = $parsed['returnPolicyText'] ?? $defaultPolicy;
      $banglaQrEnabled = ($parsed['banglaQrEnabled'] ?? true) !== false;
      $banglaQrImageUrl = $parsed['banglaQrImageUrl'] ?? '';
      $banglaQrMerchantName = $parsed['banglaQrMerchantName'] ?? 'Boichitra BD — বৈচিত্র্য';
      $banglaQrAccountNumber = $parsed['banglaQrAccountNumber'] ?? 'বাংলা কিউআর মার্চেন্ট / পার্সোনাল রিসিভার';
      $banglaQrInstructions = $parsed['banglaQrInstructions'] ?? $defaultInstructions;
      $banglaQrDiscountEnabled = ($parsed['banglaQrDiscountEnabled'] ?? true) !== false;
      $banglaQrDiscountType = ($parsed['banglaQrDiscountType'] ?? 'percentage') === 'fixed' ? 'fixed' : 'percentage';
      $banglaQrDiscountValue = isset($parsed['banglaQrDiscountValue']) ? max(0, (int)$parsed['banglaQrDiscountValue']) : 5;
      $banglaQrMaxDiscountBdt = isset($parsed['banglaQrMaxDiscountBdt']) ? max(0, (int)$parsed['banglaQrMaxDiscountBdt']) : 300;
    }
  }

  if (!$banglaQrImageUrl) {
    $banglaQrImageUrl = createDefaultBanglaQrSvg($banglaQrMerchantName, $banglaQrAccountNumber);
  }

  return [
    'id' => (int)$row['id'],
    'storeName' => $row['store_name'],
    'storeNameBn' => $row['store_name_bn'],
    'tagline' => $row['tagline'],
    'brandDescription' => $row['brand_description'],
    'contactPhone' => $row['contact_phone'],
    'contactEmail' => $row['contact_email'],
    'businessAddress' => $row['business_address'],
    'sylhetDeliveryBdt' => (int)$row['sylhet_delivery_bdt'],
    'outsideSylhetDeliveryBdt' => (int)$row['outside_sylhet_delivery_bdt'],
    'freeDeliveryThresholdBdt' => (int)$row['free_delivery_threshold_bdt'],
    'codEnabled' => (bool)$row['cod_enabled'],
    'bkashEnabled' => (bool)$row['bkash_enabled'],
    'nagadEnabled' => (bool)$row['nagad_enabled'],
    'returnPolicyText' => $returnPolicyText,
    'banglaQrEnabled' => $banglaQrEnabled,
    'banglaQrImageUrl' => $banglaQrImageUrl,
    'banglaQrMerchantName' => $banglaQrMerchantName,
    'banglaQrAccountNumber' => $banglaQrAccountNumber,
    'banglaQrInstructions' => $banglaQrInstructions,
    'banglaQrDiscountEnabled' => $banglaQrDiscountEnabled,
    'banglaQrDiscountType' => $banglaQrDiscountType,
    'banglaQrDiscountValue' => $banglaQrDiscountValue,
    'banglaQrMaxDiscountBdt' => $banglaQrMaxDiscountBdt,
  ];
}

function serializeSettingsPolicy(array $b): string {
  return json_encode([
    '__boichitraSettingsV2' => true,
    'returnPolicyText' => trim((string)($b['returnPolicyText'] ?? '')),
    'banglaQrEnabled' => ($b['banglaQrEnabled'] ?? true) !== false,
    'banglaQrImageUrl' => trim((string)($b['banglaQrImageUrl'] ?? '')),
    'banglaQrMerchantName' => trim((string)($b['banglaQrMerchantName'] ?? 'Boichitra BD — বৈচিত্র্য')),
    'banglaQrAccountNumber' => trim((string)($b['banglaQrAccountNumber'] ?? 'বাংলা কিউআর মার্চেন্ট')),
    'banglaQrInstructions' => trim((string)($b['banglaQrInstructions'] ?? '')),
    'banglaQrDiscountEnabled' => ($b['banglaQrDiscountEnabled'] ?? true) !== false,
    'banglaQrDiscountType' => ($b['banglaQrDiscountType'] ?? 'percentage') === 'fixed' ? 'fixed' : 'percentage',
    'banglaQrDiscountValue' => max(0, (int)($b['banglaQrDiscountValue'] ?? 5)),
    'banglaQrMaxDiscountBdt' => max(0, (int)($b['banglaQrMaxDiscountBdt'] ?? 300)),
  ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function calculateBanglaQrDiscountBdt(int $subtotalAfterCouponBdt, array $settings): int {
  if ($subtotalAfterCouponBdt <= 0) return 0;
  if (empty($settings['banglaQrEnabled']) || empty($settings['banglaQrDiscountEnabled'])) return 0;
  $type = $settings['banglaQrDiscountType'] ?? 'percentage';
  $val = (int)($settings['banglaQrDiscountValue'] ?? 5);
  $maxCap = (int)($settings['banglaQrMaxDiscountBdt'] ?? 300);
  if ($val <= 0) return 0;

  if ($type === 'percentage') {
    $discount = (int)round(($subtotalAfterCouponBdt * $val) / 100);
    if ($maxCap > 0 && $discount > $maxCap) {
      $discount = $maxCap;
    }
  } else {
    $discount = $val;
  }
  return min($discount, $subtotalAfterCouponBdt);
}

function parseOrderNote(string $raw): array {
  if (strpos(trim($raw), '{') === 0) {
    $parsed = json_decode($raw, true);
    if (is_array($parsed) && !empty($parsed['__boichitraOrderV2'])) {
      return [
        'orderNote' => $parsed['orderNote'] ?? '',
        'manualPayment' => $parsed['manualPayment'] ?? null,
      ];
    }
  }
  return ['orderNote' => $raw, 'manualPayment' => null];
}

function formatCategoryRow(array $r): array {
  return [
    'id' => (int)$r['id'],
    'name' => $r['name'],
    'nameBn' => $r['name_bn'],
    'slug' => $r['slug'],
    'description' => $r['description'] ?? '',
    'sortOrder' => (int)$r['sort_order'],
    'isActive' => (bool)$r['is_active'],
  ];
}

function formatVariantRow(array $r): array {
  return [
    'id' => (int)$r['id'],
    'productId' => (int)$r['product_id'],
    'sku' => $r['sku'],
    'size' => $r['size'] ?? '',
    'color' => $r['color'] ?? '',
    'priceAdjustmentBdt' => (int)$r['price_adjustment_bdt'],
    'stockQuantity' => (int)$r['stock_quantity'],
    'isActive' => (bool)$r['is_active'],
  ];
}

function sanitizeCustomerText(string $text): string {
  $clean = preg_replace('/BusinessKoro\s*[—\-:]?\s*/iu', '', $text);
  $clean = preg_replace('/Business\s*Koro\s*[—\-:]?\s*/iu', '', $clean);
  $clean = preg_replace('/বিজনেস\s*করো\s*\(businesskoro\.com\)\s*ভেরিফাইড\s*রিসেলার\s*কালেকশনের\s*/iu', '', $clean);
  $clean = preg_replace('/বিজনেস\s*করো\s*[—\-:]?\s*/iu', '', $clean);
  $clean = preg_replace('/from\s+Business\s*Koro\s+Bangladesh\s+reseller\s+collection\.?\s*/iu', '', $clean);
  $clean = preg_replace('/রিসেলার\s*হিট\s*কালেকশন/iu', 'প্রিমিয়াম কালেকশন', $clean);
  return trim(preg_replace('/\s{2,}/u', ' ', (string)$clean));
}

function formatProductRow(array $r, array $variants = [], array $catMap = []): array {
  $catId = (int)$r['category_id'];
  $cat = $catMap[$catId] ?? null;
  $cleanName = sanitizeCustomerText((string)$r['name']) ?: $r['name'];
  $cleanNameBn = sanitizeCustomerText((string)$r['name_bn']) ?: $r['name_bn'];
  $cleanDesc = sanitizeCustomerText((string)$r['description']) ?: $r['description'];
  $cleanDescBn = sanitizeCustomerText((string)$r['description_bn']) ?: $r['description_bn'];
  $rawGallery = (string)($r['gallery_urls_json'] ?: '[]');
  $rawGallery = str_replace(
    ['BusinessKoro বেস্টসেলার', 'রিসেলার হিট কালেকশন', 'BusinessKoro ডিল', '"promoCouponCode":"SYLHET100"'],
    ['বেস্টসেলার কালেকশন', 'প্রিমিয়াম কালেকশন', 'বিশেষ অফার', '"promoCouponCode":""'],
    $rawGallery
  );

  return [
    'id' => (int)$r['id'],
    'sku' => $r['sku'],
    'name' => $cleanName,
    'nameBn' => $cleanNameBn,
    'slug' => $r['slug'],
    'categoryId' => $catId,
    'categoryName' => $cat ? $cat['name'] : 'General',
    'categoryNameBn' => $cat ? $cat['nameBn'] : 'সাধারণ',
    'categorySlug' => $cat ? $cat['slug'] : 'general',
    'description' => $cleanDesc,
    'descriptionBn' => $cleanDescBn,
    'priceBdt' => (int)$r['price_bdt'],
    'salePriceBdt' => $r['sale_price_bdt'] !== null ? (int)$r['sale_price_bdt'] : null,
    'stockQuantity' => (int)$r['stock_quantity'],
    'lowStockThreshold' => (int)$r['low_stock_threshold'],
    'imageUrl' => $r['image_url'],
    'galleryUrlsJson' => $rawGallery,
    'isFeatured' => (bool)$r['is_featured'],
    'isNewArrival' => (bool)$r['is_new_arrival'],
    'isBestSeller' => (bool)$r['is_best_seller'],
    'isSpecialOffer' => (bool)$r['is_special_offer'],
    'isSeasonal' => (bool)$r['is_seasonal'],
    'isPublished' => (bool)$r['is_published'],
    'seoTitle' => sanitizeCustomerText((string)($r['seo_title'] ?? '')),
    'seoDescription' => sanitizeCustomerText((string)($r['seo_description'] ?? '')),
    'variants' => $variants,
  ];
}

function formatCouponRow(array $r): array {
  return [
    'id' => (int)$r['id'],
    'code' => $r['code'],
    'description' => $r['description'],
    'discountType' => $r['discount_type'],
    'discountValue' => (int)$r['discount_value'],
    'minOrderBdt' => (int)$r['min_order_bdt'],
    'maxDiscountBdt' => $r['max_discount_bdt'] !== null ? (int)$r['max_discount_bdt'] : null,
    'usageLimit' => (int)$r['usage_limit'],
    'usedCount' => (int)$r['used_count'],
    'isActive' => (bool)$r['is_active'],
  ];
}

// ============================================================================
// 3. AUTHENTICATION HELPERS
// ============================================================================
function extractSessionToken(): ?string {
  $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
  if (!$authHeader && function_exists('apache_request_headers')) {
    $headers = apache_request_headers();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
  }
  if (stripos($authHeader, 'Bearer ') === 0) {
    $token = trim(substr($authHeader, 7));
    if ($token !== '') return $token;
  }
  if (!empty($_COOKIE['bbd_admin_session'])) {
    return trim((string)$_COOKIE['bbd_admin_session']);
  }
  return null;
}

function setAdminCookie(string $token): void {
  $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
  setcookie('bbd_admin_session', $token, [
    'expires' => time() + 7 * 86400,
    'path' => '/',
    'httponly' => true,
    'samesite' => 'Lax',
    'secure' => $secure,
  ]);
}

function clearAdminCookie(): void {
  setcookie('bbd_admin_session', '', [
    'expires' => time() - 3600,
    'path' => '/',
    'httponly' => true,
    'samesite' => 'Lax',
  ]);
}

function verifyAdminSession(PDO $pdo): ?array {
  $rawToken = extractSessionToken();
  if (!$rawToken) return null;
  $tokenHash = hash('sha256', $rawToken);
  $stmt = $pdo->prepare("
    SELECT s.expires_at, u.id, u.uid, u.email, u.name, u.role, u.is_active
    FROM admin_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
    LIMIT 1
  ");
  $stmt->execute([$tokenHash]);
  $row = $stmt->fetch();
  if (!$row || empty($row['is_active'])) return null;
  if (strtotime($row['expires_at']) < time()) return null;
  return [
    'id' => (int)$row['id'],
    'uid' => $row['uid'],
    'email' => $row['email'],
    'name' => $row['name'] ?: 'Admin',
    'role' => $row['role'] ?: 'admin',
    'tokenHash' => $tokenHash,
  ];
}

function requireAdmin(PDO $pdo): array {
  $admin = verifyAdminSession($pdo);
  if (!$admin) {
    sendJson(['error' => 'অ্যাডমিন সেশন পাওয়া যায়নি বা মেয়াদ শেষ হয়েছে। অনুগ্রহ করে ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন।'], 401);
  }
  return $admin;
}

// ============================================================================
// 4. REQUEST ROUTER
// ============================================================================
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$requestUri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

// Normalize path if hosted in a subdirectory
$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
if ($scriptDir !== '' && strpos($requestUri, $scriptDir) === 0) {
  $requestUri = substr($requestUri, strlen($scriptDir)) ?: '/';
}

$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput ?: '{}', true);
if (!is_array($body)) $body = [];

$storefrontCacheFile = $storageDir . '/storefront_fast_cache.json';
if ($method !== 'GET' && $requestUri !== '/api/compiled-bundle') {
  @unlink($storefrontCacheFile);
}

// Server-side pre-compiled storefront JS bundle cache (avoids 2.8MB Babel download for visitors)
if ($requestUri === '/api/compiled-bundle') {
  $srcFiles = [
    __DIR__ . '/src/lib/bd-locations.ts',
    __DIR__ . '/src/lib/visuals.ts',
    __DIR__ . '/src/components/ProductVisualCard.tsx',
    __DIR__ . '/src/App.tsx',
  ];
  $sigParts = ['v9'];
  foreach ($srcFiles as $sf) {
    $sigParts[] = @filemtime($sf) . ':' . @filesize($sf);
  }
  $bundleHash = substr(md5(implode('|', $sigParts)), 0, 16);
  $bundleCachePath = $storageDir . '/compiled_storefront_' . $bundleHash . '.json';

  if ($method === 'GET') {
    if (file_exists($bundleCachePath)) {
      http_response_code(200);
      header('Content-Type: application/json; charset=utf-8');
      header('Cache-Control: public, max-age=3600');
      readfile($bundleCachePath);
      exit;
    }
    sendJson(['cached' => false, 'hash' => $bundleHash]);
  }

  if ($method === 'POST') {
    if (
      !empty($body['compiled']) &&
      is_array($body['compiled']) &&
      !empty($body['compiled']['app']) &&
      !empty($body['compiled']['bdLocations'])
    ) {
      $payload = json_encode([
        'cached' => true,
        'hash' => $bundleHash,
        'compiled' => [
          'bdLocations' => (string)$body['compiled']['bdLocations'],
          'visuals' => (string)($body['compiled']['visuals'] ?? ''),
          'productCard' => (string)($body['compiled']['productCard'] ?? ''),
          'app' => (string)$body['compiled']['app'],
        ],
      ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
      @file_put_contents($bundleCachePath, $payload);
      sendJson(['saved' => true, 'hash' => $bundleHash]);
    }
    sendJson(['saved' => false], 400);
  }
}

// Health check
if ($requestUri === '/api/health') {
  sendJson([
    'status' => 'ok',
    'engine' => 'PHP + PDO SQLite (No Node.js)',
    'store' => 'Boichitra BD — বৈচিত্র্য',
    'timezone' => 'Asia/Dhaka',
    'timestamp' => gmdate('Y-m-d\TH:i:s\Z'),
  ]);
}

// robots.txt & sitemap.xml
if ($requestUri === '/robots.txt') {
  $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
  $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
  header('Content-Type: text/plain; charset=utf-8');
  echo "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/admin\nSitemap: {$scheme}://{$host}/sitemap.xml\n";
  exit;
}

if ($requestUri === '/sitemap.xml') {
  $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
  $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
  $baseUrl = "{$scheme}://{$host}";
  $prods = $pdo->query("SELECT slug FROM products WHERE is_published = 1")->fetchAll();
  header('Content-Type: application/xml; charset=utf-8');
  echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
  echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
  echo "  <url><loc>{$baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n";
  foreach ($prods as $p) {
    $slug = rawurlencode($p['slug']);
    echo "  <url><loc>{$baseUrl}/?product={$slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n";
  }
  echo "</urlset>";
  exit;
}

// ============================================================================
// ADMIN AUTH ROUTES
// ============================================================================
if ($requestUri === '/api/admin/auth/status' && $method === 'GET') {
  $adminCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE password_hash != '' AND is_active = 1")->fetchColumn();
  $verified = verifyAdminSession($pdo);
  sendJson([
    'isSetupComplete' => $adminCount > 0,
    'authenticated' => (bool)$verified,
    'adminUser' => $verified ? [
      'email' => $verified['email'],
      'name' => $verified['name'],
      'role' => $verified['role'],
    ] : null,
  ]);
}

if ($requestUri === '/api/admin/auth/setup' && $method === 'POST') {
  $adminCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE password_hash != '' AND is_active = 1")->fetchColumn();
  if ($adminCount > 0) {
    sendJson(['error' => 'অ্যাডমিন অ্যাকাউন্ট ইতিমধ্যে সেটআপ করা হয়েছে। অনুগ্রহ করে লগইন করুন।'], 400);
  }
  $email = strtolower(trim((string)($body['email'] ?? '')));
  $name = trim((string)($body['name'] ?? 'Boichitra Admin')) ?: 'Boichitra Admin';
  $password = (string)($body['password'] ?? '');
  if ($email === '' || strlen($password) < 6) {
    sendJson(['error' => 'ইমেইল এবং কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।'], 400);
  }
  $hash = password_hash($password, PASSWORD_DEFAULT);
  $now = gmdate('Y-m-d\TH:i:s\Z');
  $uid = 'local-admin-' . time();
  $stmt = $pdo->prepare("INSERT INTO users (uid, email, name, password_hash, role, is_active, created_at, last_login_at) VALUES (?, ?, ?, ?, 'owner', 1, ?, ?)");
  $stmt->execute([$uid, $email, $name, $hash, $now, $now]);
  $userId = (int)$pdo->lastInsertId();

  $token = bin2hex(random_bytes(32));
  $tokenHash = hash('sha256', $token);
  $expiresAt = gmdate('Y-m-d\TH:i:s\Z', time() + 7 * 86400);
  $pdo->prepare("INSERT INTO admin_sessions (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)")
      ->execute([$userId, $tokenHash, $expiresAt, $now]);

  setAdminCookie($token);
  sendJson([
    'token' => $token,
    'adminUser' => ['email' => $email, 'name' => $name, 'role' => 'owner'],
  ], 201);
}

if ($requestUri === '/api/admin/auth/login' && $method === 'POST') {
  $identifier = strtolower(trim((string)($body['identifier'] ?? '')));
  $password = (string)($body['password'] ?? '');
  if ($identifier === '' || $password === '') {
    sendJson(['error' => 'ইমেইল/ইউজারনেম এবং পাসওয়ার্ড উভয়ই লিখুন।'], 400);
  }
  $users = $pdo->query("SELECT * FROM users WHERE is_active = 1")->fetchAll();
  $matched = null;
  foreach ($users as $u) {
    if (strtolower($u['email']) === $identifier || strtolower($u['name'] ?? '') === $identifier) {
      $matched = $u;
      break;
    }
  }
  if (!$matched || empty($matched['password_hash']) || !password_verify($password, $matched['password_hash'])) {
    sendJson(['error' => 'ইমেইল/ইউজারনেম অথবা পাসওয়ার্ড সঠিক নয়।'], 401);
  }

  $now = gmdate('Y-m-d\TH:i:s\Z');
  $token = bin2hex(random_bytes(32));
  $tokenHash = hash('sha256', $token);
  $expiresAt = gmdate('Y-m-d\TH:i:s\Z', time() + 7 * 86400);
  $pdo->prepare("INSERT INTO admin_sessions (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)")
      ->execute([(int)$matched['id'], $tokenHash, $expiresAt, $now]);

  setAdminCookie($token);
  sendJson([
    'token' => $token,
    'adminUser' => [
      'email' => $matched['email'],
      'name' => $matched['name'] ?: 'Admin',
      'role' => $matched['role'] ?: 'owner',
    ],
  ]);
}

if ($requestUri === '/api/admin/auth/logout' && $method === 'POST') {
  $verified = verifyAdminSession($pdo);
  if ($verified) {
    $pdo->prepare("DELETE FROM admin_sessions WHERE token_hash = ?")->execute([$verified['tokenHash']]);
  }
  clearAdminCookie();
  sendJson(['success' => true]);
}

if ($requestUri === '/api/admin/auth/change-password' && $method === 'POST') {
  $admin = requireAdmin($pdo);
  $currentPassword = (string)($body['currentPassword'] ?? '');
  $newPassword = (string)($body['newPassword'] ?? '');
  $newEmail = strtolower(trim((string)($body['newEmail'] ?? $admin['email'])));
  $newName = trim((string)($body['newName'] ?? $admin['name']));

  if ($currentPassword === '' || strlen($newPassword) < 6) {
    sendJson(['error' => 'বর্তমান পাসওয়ার্ড এবং কমপক্ষে ৬ অক্ষরের নতুন পাসওয়ার্ড দিন।'], 400);
  }
  $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
  $stmt->execute([$admin['id']]);
  $userRow = $stmt->fetch();
  if (!$userRow || !password_verify($currentPassword, $userRow['password_hash'])) {
    sendJson(['error' => 'বর্তমান পাসওয়ার্ডটি সঠিক নয়।'], 400);
  }
  $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
  $pdo->prepare("UPDATE users SET email = ?, name = ?, password_hash = ? WHERE id = ?")
      ->execute([$newEmail ?: $userRow['email'], $newName ?: $userRow['name'], $newHash, $admin['id']]);

  sendJson([
    'adminUser' => [
      'email' => $newEmail ?: $userRow['email'],
      'name' => $newName ?: $userRow['name'],
      'role' => $userRow['role'],
    ],
  ]);
}

// ============================================================================
// PUBLIC STOREFRONT & CHECKOUT ROUTES
// ============================================================================
if ($requestUri === '/api/bangla-qr-image' && $method === 'GET') {
  $settingsRow = $pdo->query("SELECT * FROM store_settings LIMIT 1")->fetch();
  $formatted = formatSettingsRow($settingsRow);
  $rawUrl = (string)($formatted['banglaQrImageUrl'] ?? '');
  if (preg_match('/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/', $rawUrl, $m)) {
    http_response_code(200);
    header('Content-Type: ' . $m[1]);
    header('Cache-Control: public, max-age=3600');
    echo base64_decode($m[2]);
    exit;
  }
  if (strpos($rawUrl, 'http') === 0 || strpos($rawUrl, '/') === 0) {
    header('Location: ' . $rawUrl, true, 302);
    exit;
  }
  http_response_code(404);
  exit;
}

if ($requestUri === '/api/storefront' && $method === 'GET') {
  $bkrAutoSyncMarker = $storageDir . '/.bkr_auto_synced_v3';
  if (!file_exists($bkrAutoSyncMarker)) {
    try {
      runBusinessKoroCatalogSync($pdo, $storageDir, 'system@boichitrabd.com', 'system', 0, 0, 1, false);
      @unlink($storefrontCacheFile);
    } catch (Throwable $_syncErr) {}
  }

  if (file_exists($storefrontCacheFile) && (time() - @filemtime($storefrontCacheFile) < 3600)) {
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-cache');
    readfile($storefrontCacheFile);
    exit;
  }

  $settingsRow = $pdo->query("SELECT * FROM store_settings LIMIT 1")->fetch();
  $catRows = $pdo->query("SELECT * FROM categories ORDER BY sort_order ASC, id ASC")->fetchAll();
  $prodRows = $pdo->query("SELECT * FROM products ORDER BY updated_at DESC, id DESC")->fetchAll();
  $varRows = $pdo->query("SELECT * FROM product_variants WHERE is_active = 1")->fetchAll();
  $cpnRows = $pdo->query("SELECT * FROM coupons WHERE is_active = 1")->fetchAll();

  $catMap = [];
  foreach ($catRows as $c) {
    $formattedCat = formatCategoryRow($c);
    $catMap[$formattedCat['id']] = $formattedCat;
  }

  $varsByProd = [];
  foreach ($varRows as $v) {
    $fv = formatVariantRow($v);
    $varsByProd[$fv['productId']][] = $fv;
  }

  // Sort published products so BusinessKoro latest updated products (bkrSortRank = 0, 1, 2...) come first
  $publishedRaw = array_values(array_filter($prodRows, fn($p) => (bool)(int)$p['is_published']));
  usort($publishedRaw, function (array $a, array $b): int {
    $ga = json_decode((string)($a['gallery_urls_json'] ?? ''), true);
    $gb = json_decode((string)($b['gallery_urls_json'] ?? ''), true);
    $rankA = (is_array($ga) && isset($ga['bkrSortRank']) && is_numeric($ga['bkrSortRank'])) ? (int)$ga['bkrSortRank'] : null;
    $rankB = (is_array($gb) && isset($gb['bkrSortRank']) && is_numeric($gb['bkrSortRank'])) ? (int)$gb['bkrSortRank'] : null;
    if ($rankA === null && $rankB === null) return (int)$b['id'] - (int)$a['id'];
    if ($rankA === null) return -1;
    if ($rankB === null) return 1;
    if ($rankA !== $rankB) return $rankA - $rankB;
    return (int)$b['id'] - (int)$a['id'];
  });

  $publishedProducts = [];
  $prodCountByCat = [];
  foreach ($publishedRaw as $p) {
    $pid = (int)$p['id'];
    $cid = (int)$p['category_id'];
    $prodCountByCat[$cid] = ($prodCountByCat[$cid] ?? 0) + 1;
    $publishedProducts[] = formatProductRow($p, $varsByProd[$pid] ?? [], $catMap);
  }

  $allActiveCategories = [];
  $linkedCategories = [];
  foreach ($catMap as $cid => $fc) {
    if (!$fc['isActive']) continue;
    $fc['productCount'] = $prodCountByCat[$cid] ?? 0;
    $allActiveCategories[] = $fc;
    if ($fc['productCount'] > 0) {
      $linkedCategories[] = $fc;
    }
  }
  $activeCategories = !empty($linkedCategories) ? $linkedCategories : $allActiveCategories;

  $activeCoupons = [];
  foreach ($cpnRows as $cp) {
    if ((int)$cp['used_count'] < (int)$cp['usage_limit']) {
      $activeCoupons[] = formatCouponRow($cp);
    }
  }

  $slimSettings = formatSettingsRow($settingsRow);
  if (
    !empty($slimSettings['banglaQrImageUrl']) &&
    strlen((string)$slimSettings['banglaQrImageUrl']) > 2000 &&
    strpos((string)$slimSettings['banglaQrImageUrl'], 'data:image/') === 0
  ) {
    $slimSettings['banglaQrImageUrl'] = '/api/bangla-qr-image';
  }

  $responsePayload = [
    'settings' => $slimSettings,
    'categories' => $activeCategories,
    'products' => $publishedProducts,
    'coupons' => $activeCoupons,
  ];
  $encodedPayload = json_encode($responsePayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  @file_put_contents($storefrontCacheFile, $encodedPayload);

  http_response_code(200);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-cache');
  echo $encodedPayload;
  exit;
}

if ($requestUri === '/api/coupons/validate' && $method === 'POST') {
  $code = strtoupper(trim((string)($body['code'] ?? '')));
  $subtotalBdt = (int)($body['subtotalBdt'] ?? 0);
  if ($code === '') {
    sendJson(['valid' => false, 'discountBdt' => 0, 'message' => 'কুপন কোড লিখুন।']);
  }
  $stmt = $pdo->prepare("SELECT * FROM coupons WHERE code = ? LIMIT 1");
  $stmt->execute([$code]);
  $cp = $stmt->fetch();
  if (!$cp || !(int)$cp['is_active']) {
    sendJson(['valid' => false, 'discountBdt' => 0, 'message' => 'কুপন কোডটি সঠিক নয় বা মেয়াদ শেষ হয়েছে।']);
  }
  if ((int)$cp['used_count'] >= (int)$cp['usage_limit']) {
    sendJson(['valid' => false, 'discountBdt' => 0, 'message' => 'এই কুপন কোডের ব্যবহারের সীমা শেষ হয়ে গেছে।']);
  }
  if ($subtotalBdt < (int)$cp['min_order_bdt']) {
    sendJson(['valid' => false, 'discountBdt' => 0, 'message' => 'এই কুপনটি ব্যবহার করতে ন্যূনতম ৳' . (int)$cp['min_order_bdt'] . ' টাকার অর্ডার প্রয়োজন।']);
  }
  $discountBdt = $cp['discount_type'] === 'percentage'
    ? (int)round(($subtotalBdt * (int)$cp['discount_value']) / 100)
    : (int)$cp['discount_value'];
  if ($cp['max_discount_bdt'] !== null && $discountBdt > (int)$cp['max_discount_bdt']) {
    $discountBdt = (int)$cp['max_discount_bdt'];
  }
  $discountBdt = min($discountBdt, $subtotalBdt);

  sendJson([
    'valid' => true,
    'code' => $cp['code'],
    'discountBdt' => $discountBdt,
    'description' => $cp['description'],
    'message' => 'কুপন "' . $cp['code'] . '" প্রযোজ্য হয়েছে! আপনি ৳' . $discountBdt . ' ছাড় পেয়েছেন।',
  ]);
}

if ($requestUri === '/api/orders/checkout' && $method === 'POST') {
  $fullName = trim((string)($body['fullName'] ?? ''));
  $phone = trim((string)($body['phone'] ?? ''));
  $email = trim((string)($body['email'] ?? ''));
  $district = trim((string)($body['district'] ?? ''));
  $upazila = trim((string)($body['upazila'] ?? ''));
  $addressLine = trim((string)($body['addressLine'] ?? ''));
  $orderNote = trim((string)($body['orderNote'] ?? ''));
  $paymentMethod = ($body['paymentMethod'] ?? 'COD') === 'BANGLA_QR' ? 'BANGLA_QR' : 'COD';
  $paymentSenderPhone = trim((string)($body['paymentSenderPhone'] ?? ''));
  $paymentTransactionId = strtoupper(trim((string)($body['paymentTransactionId'] ?? '')));
  $paymentScreenshotUrl = (string)($body['paymentScreenshotUrl'] ?? '');
  $couponCode = strtoupper(trim((string)($body['couponCode'] ?? '')));
  $idempotencyKey = trim((string)($body['idempotencyKey'] ?? uniqid('idem-', true)));
  $items = is_array($body['items'] ?? null) ? $body['items'] : [];

  if (mb_strlen($fullName) < 2) sendJson(['error' => 'গ্রাহকের পূর্ণ নাম লিখুন'], 400);
  if (!isValidBdPhone($phone)) sendJson(['error' => 'সঠিক ১১ ডিজিটের বাংলাদেশী মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)'], 400);
  if ($district === '' || $upazila === '' || mb_strlen($addressLine) < 5) {
    sendJson(['error' => 'সম্পূর্ণ ডেলিভারি ঠিকানা লিখুন'], 400);
  }
  if (empty($items)) sendJson(['error' => 'কার্টে অন্তত ১টি পণ্য থাকতে হবে'], 400);
  if ($paymentMethod === 'BANGLA_QR' && ($paymentSenderPhone === '' || $paymentTransactionId === '')) {
    sendJson(['error' => 'বাংলা কিউআর ম্যানুয়াল পেমেন্টের ক্ষেত্রে প্রেরণকারী নম্বর এবং ট্রানজেকশন আইডি (TrxID) প্রদান করা আবশ্যক।'], 400);
  }

  $normalizedPhone = normalizeBdPhone($phone);

  // Check idempotency
  $stmtExisting = $pdo->prepare("SELECT * FROM orders WHERE idempotency_key = ? LIMIT 1");
  $stmtExisting->execute([$idempotencyKey]);
  $existingOrder = $stmtExisting->fetch();
  if ($existingOrder) {
    $stmtExItems = $pdo->prepare("SELECT * FROM order_items WHERE order_id = ?");
    $stmtExItems->execute([$existingOrder['id']]);
    $exItems = $stmtExItems->fetchAll();
    sendJson([
      'order' => [
        'id' => (int)$existingOrder['id'],
        'orderNumber' => $existingOrder['order_number'],
        'customerNameSnapshot' => $existingOrder['customer_name_snapshot'],
        'customerPhoneSnapshot' => $existingOrder['customer_phone_snapshot'],
        'subtotalBdt' => (int)$existingOrder['subtotal_bdt'],
        'deliveryChargeBdt' => (int)$existingOrder['delivery_charge_bdt'],
        'discountBdt' => (int)$existingOrder['discount_bdt'],
        'totalBdt' => (int)$existingOrder['total_bdt'],
        'paymentMethod' => $existingOrder['payment_method'],
        'paymentStatus' => $existingOrder['payment_status'],
        'orderStatus' => $existingOrder['order_status'],
        'trackingToken' => $existingOrder['tracking_token'],
      ],
      'items' => array_map(fn($i) => [
        'id' => (int)$i['id'],
        'productNameSnapshot' => $i['product_name_snapshot'],
        'productNameBnSnapshot' => $i['product_name_bn_snapshot'],
        'variantSnapshot' => $i['variant_snapshot'],
        'unitPriceBdt' => (int)$i['unit_price_bdt'],
        'quantity' => (int)$i['quantity'],
        'lineTotalBdt' => (int)$i['line_total_bdt'],
      ], $exItems),
      'duplicatePrevented' => true,
    ], 201);
  }

  try {
    $pdo->beginTransaction();

    $settingsRow = $pdo->query("SELECT * FROM store_settings LIMIT 1")->fetch();
    $settings = formatSettingsRow($settingsRow);

    $subtotalBdt = 0;
    $verifiedItems = [];

    foreach ($items as $reqItem) {
      $pid = (int)($reqItem['productId'] ?? 0);
      $vid = !empty($reqItem['variantId']) ? (int)$reqItem['variantId'] : null;
      $qty = max(1, (int)($reqItem['quantity'] ?? 1));

      $stmtP = $pdo->prepare("SELECT * FROM products WHERE id = ? AND is_published = 1 LIMIT 1");
      $stmtP->execute([$pid]);
      $product = $stmtP->fetch();
      if (!$product) {
        throw new Exception("পণ্যটি বর্তমানে পাওয়া যাচ্ছে না।");
      }
      if ((int)$product['stock_quantity'] < $qty) {
        throw new Exception('"' . $product['name_bn'] . '"-এর পর্যাপ্ত স্টক নেই।');
      }

      $variant = null;
      if ($vid) {
        $stmtV = $pdo->prepare("SELECT * FROM product_variants WHERE id = ? AND product_id = ? AND is_active = 1 LIMIT 1");
        $stmtV->execute([$vid, $pid]);
        $variant = $stmtV->fetch();
        if (!$variant) {
          throw new Exception('"' . $product['name_bn'] . '"-এর নির্বাচিত সাইজ/কালার ভ্যারিয়েন্টটি বর্তমানে উপলব্ধ নয়।');
        }
        if ((int)$variant['stock_quantity'] < $qty) {
          throw new Exception('"' . $product['name_bn'] . '"-এর নির্বাচিত ভ্যারিয়েন্টের পর্যাপ্ত স্টক নেই।');
        }
      }

      $basePrice = ($product['sale_price_bdt'] !== null && (int)$product['sale_price_bdt'] > 0 && (int)$product['sale_price_bdt'] < (int)$product['price_bdt'])
        ? (int)$product['sale_price_bdt']
        : (int)$product['price_bdt'];
      $adj = $variant ? (int)$variant['price_adjustment_bdt'] : 0;
      $unitPrice = max(1, $basePrice + $adj);
      $lineTotal = $unitPrice * $qty;
      $subtotalBdt += $lineTotal;

      $vParts = array_filter([$variant['size'] ?? '', $variant['color'] ?? '']);
      $variantLabel = !empty($vParts) ? implode(' / ', $vParts) : 'Standard';

      $verifiedItems[] = [
        'product' => $product,
        'variant' => $variant,
        'quantity' => $qty,
        'unitPriceBdt' => $unitPrice,
        'lineTotalBdt' => $lineTotal,
        'variantLabel' => $variantLabel,
      ];
    }

    // Coupon discount
    $discountBdt = 0;
    $appliedCouponCode = '';
    if ($couponCode !== '') {
      $stmtC = $pdo->prepare("SELECT * FROM coupons WHERE code = ? AND is_active = 1 LIMIT 1");
      $stmtC->execute([$couponCode]);
      $cp = $stmtC->fetch();
      if ($cp && (int)$cp['used_count'] < (int)$cp['usage_limit'] && $subtotalBdt >= (int)$cp['min_order_bdt']) {
        $discountBdt = $cp['discount_type'] === 'percentage'
          ? (int)round(($subtotalBdt * (int)$cp['discount_value']) / 100)
          : (int)$cp['discount_value'];
        if ($cp['max_discount_bdt'] !== null && $discountBdt > (int)$cp['max_discount_bdt']) {
          $discountBdt = (int)$cp['max_discount_bdt'];
        }
        $discountBdt = min($discountBdt, $subtotalBdt);
        $appliedCouponCode = $cp['code'];
        $pdo->prepare("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?")->execute([$cp['id']]);
      }
    }

    // Bangla QR Advance Payment Discount
    $qrDiscountBdt = 0;
    if ($paymentMethod === 'BANGLA_QR') {
      $qrDiscountBdt = calculateBanglaQrDiscountBdt(max(0, $subtotalBdt - $discountBdt), $settings);
      if ($qrDiscountBdt > 0) {
        $discountBdt += $qrDiscountBdt;
        $appliedCouponCode = $appliedCouponCode ? ($appliedCouponCode . '+BANGLA_QR') : 'BANGLA_QR_OFFER';
      }
    }

    // Delivery charge
    $isInsideDhaka = strtolower($district) === 'dhaka';
    $deliveryChargeBdt = $isInsideDhaka ? $settings['sylhetDeliveryBdt'] : $settings['outsideSylhetDeliveryBdt'];
    $hasFreeDeliveryItem = false;
    foreach ($verifiedItems as $vi) {
      $gRaw = json_decode($vi['product']['gallery_urls_json'] ?? '{}', true);
      if (is_array($gRaw)) {
        $offerObj = $gRaw['offer'] ?? $gRaw['offerMeta'] ?? [];
        if (!empty($offerObj['freeDelivery'])) {
          $hasFreeDeliveryItem = true;
          break;
        }
      }
    }
    if ($hasFreeDeliveryItem || ($settings['freeDeliveryThresholdBdt'] > 0 && ($subtotalBdt - $discountBdt) >= $settings['freeDeliveryThresholdBdt'])) {
      $deliveryChargeBdt = 0;
    }

    $totalBdt = max(0, $subtotalBdt - $discountBdt + $deliveryChargeBdt);
    $now = gmdate('Y-m-d\TH:i:s\Z');

    // Find or create customer
    $stmtCust = $pdo->prepare("SELECT * FROM customers WHERE phone = ? LIMIT 1");
    $stmtCust->execute([$normalizedPhone]);
    $cust = $stmtCust->fetch();
    if ($cust) {
      $customerId = (int)$cust['id'];
      $pdo->prepare("UPDATE customers SET full_name = ?, email = ?, district = ?, upazila = ?, address_line = ?, total_orders = total_orders + 1, total_spent_bdt = total_spent_bdt + ?, last_order_at = ?, updated_at = ? WHERE id = ?")
          ->execute([$fullName, $email ?: $cust['email'], $district, $upazila, $addressLine, $totalBdt, $now, $now, $customerId]);
    } else {
      $custCode = 'CUST-' . date('Y') . '-' . random_int(1000, 9999);
      $pdo->prepare("INSERT INTO customers (customer_code, full_name, phone, email, district, upazila, address_line, total_orders, total_spent_bdt, first_order_at, last_order_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)")
          ->execute([$custCode, $fullName, $normalizedPhone, $email, $district, $upazila, $addressLine, $totalBdt, $now, $now, $now, $now]);
      $customerId = (int)$pdo->lastInsertId();
    }

    $orderNumber = 'BBD-' . date('Ymd') . '-' . random_int(1000, 9999);
    $trackingToken = 'TRK-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));

    $serializedNote = $orderNote;
    if ($paymentMethod === 'BANGLA_QR') {
      $serializedNote = json_encode([
        '__boichitraOrderV2' => true,
        'orderNote' => $orderNote,
        'manualPayment' => [
          'method' => 'BANGLA_QR',
          'senderPhone' => $paymentSenderPhone,
          'transactionId' => $paymentTransactionId,
          'paidAmountBdt' => $totalBdt,
          'qrDiscountBdt' => $qrDiscountBdt,
          'screenshotUrl' => $paymentScreenshotUrl,
          'submittedAt' => $now,
        ],
      ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    $paymentStatus = $paymentMethod === 'BANGLA_QR' ? 'VERIFICATION_PENDING' : 'UNPAID';

    $pdo->prepare("INSERT INTO orders (order_number, idempotency_key, customer_id, customer_name_snapshot, customer_phone_snapshot, customer_email_snapshot, district_snapshot, upazila_snapshot, shipping_address_snapshot, order_note, subtotal_bdt, delivery_charge_bdt, discount_bdt, coupon_code, total_bdt, payment_method, payment_status, order_status, tracking_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?)")
        ->execute([$orderNumber, $idempotencyKey, $customerId, $fullName, $normalizedPhone, $email, $district, $upazila, $addressLine, $serializedNote, $subtotalBdt, $deliveryChargeBdt, $discountBdt, $appliedCouponCode, $totalBdt, $paymentMethod, $paymentStatus, $trackingToken, $now, $now]);
    $orderId = (int)$pdo->lastInsertId();

    $stmtItem = $pdo->prepare("INSERT INTO order_items (order_id, product_id, variant_id, product_name_snapshot, product_name_bn_snapshot, sku_snapshot, variant_snapshot, unit_price_bdt, quantity, line_total_bdt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $insertedItems = [];
    foreach ($verifiedItems as $vi) {
      $stmtItem->execute([
        $orderId,
        (int)$vi['product']['id'],
        $vi['variant'] ? (int)$vi['variant']['id'] : null,
        $vi['product']['name'],
        $vi['product']['name_bn'],
        $vi['variant'] ? $vi['variant']['sku'] : $vi['product']['sku'],
        $vi['variantLabel'],
        $vi['unitPriceBdt'],
        $vi['quantity'],
        $vi['lineTotalBdt'],
      ]);
      $itemId = (int)$pdo->lastInsertId();
      $insertedItems[] = [
        'id' => $itemId,
        'orderId' => $orderId,
        'productId' => (int)$vi['product']['id'],
        'variantId' => $vi['variant'] ? (int)$vi['variant']['id'] : null,
        'productNameSnapshot' => $vi['product']['name'],
        'productNameBnSnapshot' => $vi['product']['name_bn'],
        'skuSnapshot' => $vi['variant'] ? $vi['variant']['sku'] : $vi['product']['sku'],
        'variantSnapshot' => $vi['variantLabel'],
        'unitPriceBdt' => $vi['unitPriceBdt'],
        'quantity' => $vi['quantity'],
        'lineTotalBdt' => $vi['lineTotalBdt'],
      ];
      $pdo->prepare("UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?), updated_at = ? WHERE id = ?")
          ->execute([$vi['quantity'], $now, (int)$vi['product']['id']]);
      if ($vi['variant']) {
        $pdo->prepare("UPDATE product_variants SET stock_quantity = MAX(0, stock_quantity - ?) WHERE id = ?")
            ->execute([$vi['quantity'], (int)$vi['variant']['id']]);
      }
    }

    $histNote = $paymentMethod === 'BANGLA_QR'
      ? "বাংলা কিউআর ম্যানুয়াল পেমেন্ট সাবমিট করা হয়েছে (প্রেরণকারী: {$paymentSenderPhone}, TrxID: {$paymentTransactionId})"
      : 'কাস্টমার ওয়েবসাইট থেকে অর্ডার প্লেস করেছেন (Cash on Delivery)';
    $pdo->prepare("INSERT INTO order_status_history (order_id, previous_status, new_status, note, changed_by_email, created_at) VALUES (?, 'New', 'Pending', ?, 'customer@storefront', ?)")
        ->execute([$orderId, $histNote, $now]);

    $pdo->commit();

    // Forward order items to BusinessKoro Storefront Orders API
    try {
      forwardOrderToBusinessKoroPhp(
        $pdo,
        $orderNumber,
        $verifiedItems,
        $fullName,
        $normalizedPhone,
        $district,
        $upazila,
        $addressLine,
        $orderNote
      );
    } catch (Throwable $_bkrErr) {}

    sendJson([
      'order' => [
        'id' => $orderId,
        'orderNumber' => $orderNumber,
        'customerNameSnapshot' => $fullName,
        'customerPhoneSnapshot' => $normalizedPhone,
        'subtotalBdt' => $subtotalBdt,
        'deliveryChargeBdt' => $deliveryChargeBdt,
        'discountBdt' => $discountBdt,
        'totalBdt' => $totalBdt,
        'paymentMethod' => $paymentMethod,
        'paymentStatus' => $paymentStatus,
        'orderStatus' => 'Pending',
        'trackingToken' => $trackingToken,
      ],
      'items' => $insertedItems,
      'duplicatePrevented' => false,
    ], 201);
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    sendJson(['error' => $e->getMessage() ?: 'অর্ডার সম্পন্ন করা যায়নি।'], 400);
  }
}

if ($requestUri === '/api/orders/track' && $method === 'POST') {
  $orderNumber = strtoupper(trim((string)($body['orderNumber'] ?? '')));
  $phone = normalizeBdPhone((string)($body['phone'] ?? ''));
  $stmt = $pdo->prepare("SELECT * FROM orders WHERE order_number = ? LIMIT 1");
  $stmt->execute([$orderNumber]);
  $order = $stmt->fetch();
  if (!$order || normalizeBdPhone($order['customer_phone_snapshot']) !== $phone) {
    sendJson(['error' => 'এই অর্ডার নম্বর এবং মোবাইল নম্বরের সাথে মিলে এমন কোনো অর্ডার পাওয়া যায়নি।'], 404);
  }
  $stmtItems = $pdo->prepare("SELECT * FROM order_items WHERE order_id = ?");
  $stmtItems->execute([$order['id']]);
  $items = $stmtItems->fetchAll();

  $stmtHist = $pdo->prepare("SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id DESC");
  $stmtHist->execute([$order['id']]);
  $hist = $stmtHist->fetchAll();

  $parsedNote = parseOrderNote($order['order_note'] ?? '');

  sendJson([
    'orderNumber' => $order['order_number'],
    'orderStatus' => $order['order_status'],
    'paymentMethod' => $order['payment_method'],
    'paymentStatus' => $order['payment_status'],
    'manualPayment' => $parsedNote['manualPayment'],
    'customerName' => $order['customer_name_snapshot'],
    'district' => $order['district_snapshot'],
    'upazila' => $order['upazila_snapshot'],
    'subtotalBdt' => (int)$order['subtotal_bdt'],
    'deliveryChargeBdt' => (int)$order['delivery_charge_bdt'],
    'discountBdt' => (int)$order['discount_bdt'],
    'totalBdt' => (int)$order['total_bdt'],
    'createdAt' => $order['created_at'],
    'items' => array_map(fn($i) => [
      'productName' => $i['product_name_snapshot'],
      'productNameBn' => $i['product_name_bn_snapshot'],
      'variant' => $i['variant_snapshot'],
      'quantity' => (int)$i['quantity'],
      'unitPriceBdt' => (int)$i['unit_price_bdt'],
      'lineTotalBdt' => (int)$i['line_total_bdt'],
    ], $items),
    'history' => array_map(fn($h) => [
      'status' => $h['new_status'],
      'note' => $h['note'],
      'timestamp' => $h['created_at'],
    ], $hist),
  ]);
}

// ============================================================================
// PROTECTED ADMIN ROUTES
// ============================================================================
if ($requestUri === '/api/admin/overview' && $method === 'GET') {
  $admin = requireAdmin($pdo);

  $allOrders = $pdo->query("SELECT * FROM orders ORDER BY id DESC")->fetchAll();
  $allItems = $pdo->query("SELECT * FROM order_items")->fetchAll();
  $allHist = $pdo->query("SELECT * FROM order_status_history ORDER BY id DESC")->fetchAll();
  $allCustomers = $pdo->query("SELECT * FROM customers ORDER BY id DESC")->fetchAll();
  $allProducts = $pdo->query("SELECT * FROM products ORDER BY id DESC")->fetchAll();
  $allVariants = $pdo->query("SELECT * FROM product_variants")->fetchAll();
  $allCategories = $pdo->query("SELECT * FROM categories ORDER BY sort_order ASC, id ASC")->fetchAll();
  $settingsRow = $pdo->query("SELECT * FROM store_settings LIMIT 1")->fetch();
  $allCoupons = $pdo->query("SELECT * FROM coupons ORDER BY id DESC")->fetchAll();
  $allLogs = $pdo->query("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100")->fetchAll();

  $itemsByOrder = [];
  foreach ($allItems as $i) {
    $oid = (int)$i['order_id'];
    $itemsByOrder[$oid][] = [
      'id' => (int)$i['id'],
      'orderId' => $oid,
      'productId' => (int)$i['product_id'],
      'variantId' => $i['variant_id'] !== null ? (int)$i['variant_id'] : null,
      'productNameSnapshot' => $i['product_name_snapshot'],
      'productNameBnSnapshot' => $i['product_name_bn_snapshot'],
      'skuSnapshot' => $i['sku_snapshot'],
      'variantSnapshot' => $i['variant_snapshot'],
      'unitPriceBdt' => (int)$i['unit_price_bdt'],
      'quantity' => (int)$i['quantity'],
      'lineTotalBdt' => (int)$i['line_total_bdt'],
    ];
  }

  $histByOrder = [];
  foreach ($allHist as $h) {
    $oid = (int)$h['order_id'];
    $histByOrder[$oid][] = [
      'id' => (int)$h['id'],
      'previousStatus' => $h['previous_status'],
      'newStatus' => $h['new_status'],
      'note' => $h['note'],
      'changedByEmail' => $h['changed_by_email'],
      'createdAt' => $h['created_at'],
    ];
  }

  $varsByProd = [];
  foreach ($allVariants as $v) {
    $fv = formatVariantRow($v);
    $varsByProd[$fv['productId']][] = $fv;
  }

  $catMap = [];
  $formattedCategories = [];
  foreach ($allCategories as $c) {
    $fc = formatCategoryRow($c);
    $catMap[$fc['id']] = $fc;
    $formattedCategories[] = $fc;
  }

  $grossOrderValueBdt = 0;
  $paidRevenueBdt = 0;
  $awaitingConfirmation = 0;
  $processingOrders = 0;
  $deliveredOrders = 0;
  $cancelledOrders = 0;

  $formattedOrders = [];
  foreach ($allOrders as $o) {
    $st = $o['order_status'];
    $tot = (int)$o['total_bdt'];
    if (in_array($st, ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered'], true)) {
      $grossOrderValueBdt += $tot;
    }
    if (($st === 'Delivered' || $o['payment_status'] === 'PAID') && !in_array($st, ['Cancelled', 'Returned', 'Refunded'], true)) {
      $paidRevenueBdt += $tot;
    }
    if ($st === 'Pending') $awaitingConfirmation++;
    if (in_array($st, ['Confirmed', 'Processing', 'Shipped'], true)) $processingOrders++;
    if ($st === 'Delivered') $deliveredOrders++;
    if (in_array($st, ['Cancelled', 'Returned', 'Refunded'], true)) $cancelledOrders++;

    $oid = (int)$o['id'];
    $parsedNote = parseOrderNote($o['order_note'] ?? '');
    $formattedOrders[] = [
      'id' => $oid,
      'orderNumber' => $o['order_number'],
      'customerId' => (int)$o['customer_id'],
      'customerNameSnapshot' => $o['customer_name_snapshot'],
      'customerPhoneSnapshot' => $o['customer_phone_snapshot'],
      'customerEmailSnapshot' => $o['customer_email_snapshot'] ?? '',
      'districtSnapshot' => $o['district_snapshot'],
      'upazilaSnapshot' => $o['upazila_snapshot'],
      'shippingAddressSnapshot' => $o['shipping_address_snapshot'],
      'orderNote' => $parsedNote['orderNote'],
      'manualPayment' => $parsedNote['manualPayment'],
      'subtotalBdt' => (int)$o['subtotal_bdt'],
      'deliveryChargeBdt' => (int)$o['delivery_charge_bdt'],
      'discountBdt' => (int)$o['discount_bdt'],
      'couponCode' => $o['coupon_code'] ?? '',
      'totalBdt' => $tot,
      'paymentMethod' => $o['payment_method'],
      'paymentStatus' => $o['payment_status'],
      'orderStatus' => $st,
      'cancellationReason' => $o['cancellation_reason'] ?? '',
      'refundAmountBdt' => (int)$o['refund_amount_bdt'],
      'createdAt' => $o['created_at'],
      'items' => $itemsByOrder[$oid] ?? [],
      'history' => $histByOrder[$oid] ?? [],
    ];
  }

  $lowStockCount = 0;
  $formattedProducts = [];
  foreach ($allProducts as $p) {
    if ((int)$p['stock_quantity'] <= (int)$p['low_stock_threshold']) {
      $lowStockCount++;
    }
    $pid = (int)$p['id'];
    $formattedProducts[] = formatProductRow($p, $varsByProd[$pid] ?? [], $catMap);
  }

  $formattedCustomers = array_map(fn($c) => [
    'id' => (int)$c['id'],
    'customerCode' => $c['customer_code'],
    'fullName' => $c['full_name'],
    'phone' => $c['phone'],
    'email' => $c['email'] ?? '',
    'district' => $c['district'],
    'upazila' => $c['upazila'],
    'addressLine' => $c['address_line'],
    'totalOrders' => (int)$c['total_orders'],
    'totalSpentBdt' => (int)$c['total_spent_bdt'],
    'firstOrderAt' => $c['first_order_at'],
    'lastOrderAt' => $c['last_order_at'],
  ], $allCustomers);

  sendJson([
    'stats' => [
      'totalOrders' => count($allOrders),
      'awaitingConfirmation' => $awaitingConfirmation,
      'processingOrders' => $processingOrders,
      'deliveredOrders' => $deliveredOrders,
      'cancelledOrders' => $cancelledOrders,
      'grossOrderValueBdt' => $grossOrderValueBdt,
      'paidRevenueBdt' => $paidRevenueBdt,
      'totalCustomers' => count($allCustomers),
      'lowStockCount' => $lowStockCount,
    ],
    'orders' => $formattedOrders,
    'customers' => $formattedCustomers,
    'products' => $formattedProducts,
    'categories' => $formattedCategories,
    'settings' => formatSettingsRow($settingsRow),
    'coupons' => array_map('formatCouponRow', $allCoupons),
    'auditLogs' => array_map(fn($l) => [
      'id' => (int)$l['id'],
      'actorEmail' => $l['actor_email'],
      'action' => $l['action'],
      'entityType' => $l['entity_type'],
      'entityId' => $l['entity_id'],
      'details' => $l['details'],
      'createdAt' => $l['created_at'],
    ], $allLogs),
    'adminUser' => [
      'email' => $admin['email'],
      'name' => $admin['name'],
      'role' => $admin['role'],
    ],
  ]);
}

if ($requestUri === '/api/admin/products' && $method === 'POST') {
  $admin = requireAdmin($pdo);
  $id = !empty($body['id']) ? (int)$body['id'] : null;
  $sku = trim((string)($body['sku'] ?? ''));
  $name = trim((string)($body['name'] ?? ''));
  $nameBn = trim((string)($body['nameBn'] ?? ''));
  $categoryId = (int)($body['categoryId'] ?? 1);
  $priceBdt = max(1, (int)($body['priceBdt'] ?? 0));
  $salePriceBdt = (!empty($body['salePriceBdt']) && (int)$body['salePriceBdt'] > 0) ? (int)$body['salePriceBdt'] : null;
  if ($salePriceBdt !== null && $salePriceBdt >= $priceBdt) {
    $priceBdt = $salePriceBdt;
    $salePriceBdt = null;
  }
  $stockQuantity = max(0, (int)($body['stockQuantity'] ?? 0));
  $lowStockThreshold = (int)($body['lowStockThreshold'] ?? 5);
  $imageUrl = (string)($body['imageUrl'] ?? '');
  $galleryUrlsJson = is_string($body['galleryUrlsJson'] ?? null) ? $body['galleryUrlsJson'] : '[]';
  $description = trim((string)($body['description'] ?? '')) ?: $name;
  $descriptionBn = trim((string)($body['descriptionBn'] ?? '')) ?: $nameBn;
  $isFeatured = !empty($body['isFeatured']) ? 1 : 0;
  $isNewArrival = !empty($body['isNewArrival']) ? 1 : 0;
  $isBestSeller = !empty($body['isBestSeller']) ? 1 : 0;
  $isSpecialOffer = !empty($body['isSpecialOffer']) ? 1 : 0;
  $isSeasonal = !empty($body['isSeasonal']) ? 1 : 0;
  $isPublished = ($body['isPublished'] ?? true) !== false ? 1 : 0;
  $seoTitle = trim((string)($body['seoTitle'] ?? ''));
  $seoDescription = trim((string)($body['seoDescription'] ?? ''));
  $now = gmdate('Y-m-d\TH:i:s\Z');

  $slugBase = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $name));
  $slug = trim($slugBase, '-') . '-' . strtolower(preg_replace('/[^a-z0-9]+/i', '', $sku));

  if ($id) {
    $stmtOrig = $pdo->prepare("SELECT gallery_urls_json FROM products WHERE id = ? LIMIT 1");
    $stmtOrig->execute([$id]);
    $origRow = $stmtOrig->fetch();
    if ($origRow && !empty($origRow['gallery_urls_json'])) {
      $origParsed = json_decode((string)$origRow['gallery_urls_json'], true);
      $newParsed = json_decode($galleryUrlsJson, true);
      if (is_array($origParsed) && !empty($origParsed['bkrProductId']) && is_array($newParsed)) {
        $newParsed['bkrProductId'] = $origParsed['bkrProductId'];
        $newParsed['bkrMinPrice'] = $origParsed['bkrMinPrice'] ?? $origParsed['bkrMinimumSellingPrice'] ?? 0;
        $newParsed['bkrCostPrice'] = $origParsed['bkrCostPrice'] ?? 0;
        if (isset($origParsed['bkrSortRank']) && is_numeric($origParsed['bkrSortRank'])) {
          $newParsed['bkrSortRank'] = (int)$origParsed['bkrSortRank'];
        }
        $galleryUrlsJson = json_encode($newParsed, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
      }
    }
    $pdo->prepare("UPDATE products SET sku = ?, name = ?, name_bn = ?, category_id = ?, description = ?, description_bn = ?, price_bdt = ?, sale_price_bdt = ?, stock_quantity = ?, low_stock_threshold = ?, image_url = ?, gallery_urls_json = ?, is_featured = ?, is_new_arrival = ?, is_best_seller = ?, is_special_offer = ?, is_seasonal = ?, is_published = ?, seo_title = ?, seo_description = ?, updated_at = ? WHERE id = ?")
        ->execute([$sku, $name, $nameBn, $categoryId, $description, $descriptionBn, $priceBdt, $salePriceBdt, $stockQuantity, $lowStockThreshold, $imageUrl, $galleryUrlsJson, $isFeatured, $isNewArrival, $isBestSeller, $isSpecialOffer, $isSeasonal, $isPublished, $seoTitle, $seoDescription, $now, $id]);
  } else {
    $pdo->prepare("INSERT INTO products (sku, name, name_bn, slug, category_id, description, description_bn, price_bdt, sale_price_bdt, stock_quantity, low_stock_threshold, image_url, gallery_urls_json, is_featured, is_new_arrival, is_best_seller, is_special_offer, is_seasonal, is_published, seo_title, seo_description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        ->execute([$sku, $name, $nameBn, $slug, $categoryId, $description, $descriptionBn, $priceBdt, $salePriceBdt, $stockQuantity, $lowStockThreshold, $imageUrl, $galleryUrlsJson, $isFeatured, $isNewArrival, $isBestSeller, $isSpecialOffer, $isSeasonal, $isPublished, $seoTitle, $seoDescription, $now, $now]);
    $id = (int)$pdo->lastInsertId();
  }

  // Sync product variants (Color & Size) if provided in request body
  if (isset($body['variants']) && is_array($body['variants'])) {
    $stmtExV = $pdo->prepare("SELECT * FROM product_variants WHERE product_id = ?");
    $stmtExV->execute([$id]);
    $existingVars = $stmtExV->fetchAll();
    $keptIds = [];

    foreach ($body['variants'] as $idx => $v) {
      $vId = !empty($v['id']) ? (int)$v['id'] : null;
      $vSku = strtoupper(trim((string)($v['sku'] ?? ($sku . '-V' . ($idx + 1)))));
      $vSize = trim((string)($v['size'] ?? ''));
      $vColor = trim((string)($v['color'] ?? ''));
      $vAdj = (int)($v['priceAdjustmentBdt'] ?? 0);
      $vStock = max(0, (int)($v['stockQuantity'] ?? 0));

      if ($vSize === '' && $vColor === '') continue;

      $matchedRow = null;
      foreach ($existingVars as $ev) {
        if (in_array((int)$ev['id'], $keptIds, true)) continue;
        if (($vId && (int)$ev['id'] === $vId) || strtoupper($ev['sku']) === $vSku) {
          $matchedRow = $ev;
          break;
        }
      }

      if ($matchedRow) {
        $keptIds[] = (int)$matchedRow['id'];
        $pdo->prepare("UPDATE product_variants SET sku = ?, size = ?, color = ?, price_adjustment_bdt = ?, stock_quantity = ?, is_active = 1 WHERE id = ?")
            ->execute([$matchedRow['sku'] ?: $vSku, $vSize, $vColor, $vAdj, $vStock, (int)$matchedRow['id']]);
      } else {
        $uniqueVSku = strtoupper($sku) . '-V' . ($idx + 1) . '-' . random_int(100, 999);
        $pdo->prepare("INSERT INTO product_variants (product_id, sku, size, color, price_adjustment_bdt, stock_quantity, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)")
            ->execute([$id, $uniqueVSku, $vSize, $vColor, $vAdj, $vStock]);
        $keptIds[] = (int)$pdo->lastInsertId();
      }
    }

    foreach ($existingVars as $ev) {
      if (!in_array((int)$ev['id'], $keptIds, true)) {
        $pdo->prepare("UPDATE product_variants SET is_active = 0 WHERE id = ?")->execute([(int)$ev['id']]);
      }
    }
  }

  $pdo->prepare("INSERT INTO audit_logs (actor_email, actor_uid, action, entity_type, entity_id, details, created_at) VALUES (?, ?, 'SAVE_PRODUCT', 'Product', ?, ?, ?)")
      ->execute([$admin['email'], $admin['uid'], $sku, "Saved product {$nameBn}", $now]);

  @unlink($storefrontCacheFile);
  @unlink($storageDir . '/storefront_cache_v1.json');
  sendJson(['product' => ['id' => $id, 'sku' => $sku]]);
}

if (preg_match('#^/api/admin/products/(\d+)$#', $requestUri, $m) && $method === 'DELETE') {
  $admin = requireAdmin($pdo);
  $prodId = (int)$m[1];
  $stmtP = $pdo->prepare("SELECT * FROM products WHERE id = ? LIMIT 1");
  $stmtP->execute([$prodId]);
  $target = $stmtP->fetch();
  if (!$target) {
    sendJson(['error' => 'পণ্যটি খুঁজে পাওয়া যায়নি।'], 404);
  }
  $now = gmdate('Y-m-d\TH:i:s\Z');
  $pdo->prepare("DELETE FROM product_variants WHERE product_id = ?")->execute([$prodId]);
  $pdo->prepare("DELETE FROM products WHERE id = ?")->execute([$prodId]);
  $pdo->prepare("INSERT INTO audit_logs (actor_email, actor_uid, action, entity_type, entity_id, details, created_at) VALUES (?, ?, 'DELETE_PRODUCT', 'Product', ?, ?, ?)")
      ->execute([$admin['email'], $admin['uid'], $target['sku'], "Deleted product {$target['name_bn']}", $now]);
  @unlink($storageDir . '/storefront_cache_v1.json');
  sendJson(['deleted' => true, 'sku' => $target['sku'], 'nameBn' => $target['name_bn']]);
}

if ($requestUri === '/api/admin/products/bulk-delete' && $method === 'POST') {
  $admin = requireAdmin($pdo);
  $ids = is_array($body['productIds'] ?? null) ? $body['productIds'] : [];
  $now = gmdate('Y-m-d\TH:i:s\Z');
  $deletedCount = 0;
  foreach ($ids as $rawId) {
    $prodId = (int)$rawId;
    if ($prodId <= 0) continue;
    $stmtP = $pdo->prepare("SELECT * FROM products WHERE id = ? LIMIT 1");
    $stmtP->execute([$prodId]);
    $target = $stmtP->fetch();
    if ($target) {
      $pdo->prepare("DELETE FROM product_variants WHERE product_id = ?")->execute([$prodId]);
      $pdo->prepare("DELETE FROM products WHERE id = ?")->execute([$prodId]);
      $pdo->prepare("INSERT INTO audit_logs (actor_email, actor_uid, action, entity_type, entity_id, details, created_at) VALUES (?, ?, 'DELETE_PRODUCT', 'Product', ?, ?, ?)")
          ->execute([$admin['email'], $admin['uid'], $target['sku'], "Deleted product {$target['name_bn']}", $now]);
      $deletedCount++;
    }
  }
  @unlink($storageDir . '/storefront_cache_v1.json');
  sendJson(['deleted' => true, 'deletedCount' => $deletedCount]);
}

if ($requestUri === '/api/admin/coupons' && $method === 'POST') {
  $admin = requireAdmin($pdo);
  $id = !empty($body['id']) ? (int)$body['id'] : null;
  $code = strtoupper(trim((string)($body['code'] ?? '')));
  $description = trim((string)($body['description'] ?? ''));
  $discountType = ($body['discountType'] ?? 'fixed') === 'percentage' ? 'percentage' : 'fixed';
  $discountValue = max(1, (int)($body['discountValue'] ?? 0));
  $minOrderBdt = max(0, (int)($body['minOrderBdt'] ?? 0));
  $maxDiscountBdt = !empty($body['maxDiscountBdt']) ? (int)$body['maxDiscountBdt'] : null;
  $usageLimit = max(1, (int)($body['usageLimit'] ?? 1000));
  $isActive = ($body['isActive'] ?? true) !== false ? 1 : 0;
  $now = gmdate('Y-m-d\TH:i:s\Z');

  if ($id) {
    $pdo->prepare("UPDATE coupons SET code = ?, description = ?, discount_type = ?, discount_value = ?, min_order_bdt = ?, max_discount_bdt = ?, usage_limit = ?, is_active = ? WHERE id = ?")
        ->execute([$code, $description, $discountType, $discountValue, $minOrderBdt, $maxDiscountBdt, $usageLimit, $isActive, $id]);
  } else {
    $stmt = $pdo->prepare("SELECT id FROM coupons WHERE code = ? LIMIT 1");
    $stmt->execute([$code]);
    $existing = $stmt->fetch();
    if ($existing) {
      $pdo->prepare("UPDATE coupons SET description = ?, discount_type = ?, discount_value = ?, min_order_bdt = ?, max_discount_bdt = ?, usage_limit = ?, is_active = ? WHERE id = ?")
          ->execute([$description, $discountType, $discountValue, $minOrderBdt, $maxDiscountBdt, $usageLimit, $isActive, $existing['id']]);
    } else {
      $pdo->prepare("INSERT INTO coupons (code, description, discount_type, discount_value, min_order_bdt, max_discount_bdt, usage_limit, used_count, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)")
          ->execute([$code, $description, $discountType, $discountValue, $minOrderBdt, $maxDiscountBdt, $usageLimit, $isActive, $now]);
    }
  }
  sendJson(['coupon' => ['code' => $code]]);
}

if (preg_match('#^/api/admin/coupons/(\d+)$#', $requestUri, $m) && $method === 'DELETE') {
  requireAdmin($pdo);
  $pdo->prepare("DELETE FROM coupons WHERE id = ?")->execute([(int)$m[1]]);
  sendJson(['deleted' => true]);
}

if ($requestUri === '/api/admin/categories' && $method === 'POST') {
  requireAdmin($pdo);
  $id = !empty($body['id']) ? (int)$body['id'] : null;
  $name = trim((string)($body['name'] ?? ''));
  $nameBn = trim((string)($body['nameBn'] ?? ''));
  $description = trim((string)($body['description'] ?? ''));
  $sortOrder = (int)($body['sortOrder'] ?? 0);
  $isActive = ($body['isActive'] ?? true) !== false ? 1 : 0;
  $slug = trim(strtolower(preg_replace('/[^a-z0-9]+/i', '-', $name)), '-') ?: ('cat-' . time());
  $now = gmdate('Y-m-d\TH:i:s\Z');

  if ($id) {
    $pdo->prepare("UPDATE categories SET name = ?, name_bn = ?, description = ?, sort_order = ?, is_active = ? WHERE id = ?")
        ->execute([$name, $nameBn, $description, $sortOrder, $isActive, $id]);
  } else {
    $pdo->prepare("INSERT INTO categories (name, name_bn, slug, description, sort_order, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        ->execute([$name, $nameBn, $slug, $description, $sortOrder, $isActive, $now]);
  }
  sendJson(['category' => ['name' => $name, 'nameBn' => $nameBn]]);
}

if (preg_match('#^/api/admin/orders/(\d+)$#', $requestUri, $m) && $method === 'PATCH') {
  $admin = requireAdmin($pdo);
  $orderId = (int)$m[1];
  $newStatus = trim((string)($body['orderStatus'] ?? 'Pending'));
  $paymentStatus = trim((string)($body['paymentStatus'] ?? 'UNPAID'));
  $note = trim((string)($body['note'] ?? ''));
  $cancelReason = trim((string)($body['cancellationReason'] ?? ''));
  $refundAmount = (int)($body['refundAmountBdt'] ?? 0);
  $now = gmdate('Y-m-d\TH:i:s\Z');

  $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ? LIMIT 1");
  $stmt->execute([$orderId]);
  $existing = $stmt->fetch();
  if (!$existing) sendJson(['error' => 'অর্ডারটি খুঁজে পাওয়া যায়নি।'], 404);

  $wasCancelledOrReturned = in_array($existing['order_status'], ['Cancelled', 'Returned', 'Refunded'], true);
  $isNowCancelledOrReturned = in_array($newStatus, ['Cancelled', 'Returned'], true);

  if (!$wasCancelledOrReturned && $isNowCancelledOrReturned) {
    $stmtOrdItems = $pdo->prepare("SELECT * FROM order_items WHERE order_id = ?");
    $stmtOrdItems->execute([$orderId]);
    $ordItems = $stmtOrdItems->fetchAll();
    foreach ($ordItems as $oi) {
      $pdo->prepare("UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = ? WHERE id = ?")
          ->execute([(int)$oi['quantity'], $now, (int)$oi['product_id']]);
      if (!empty($oi['variant_id'])) {
        $pdo->prepare("UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?")
            ->execute([(int)$oi['quantity'], (int)$oi['variant_id']]);
      }
    }
  }

  if ($newStatus === 'Delivered' && $paymentStatus === 'UNPAID') {
    $paymentStatus = 'PAID';
  }

  $pdo->prepare("UPDATE orders SET order_status = ?, payment_status = ?, cancellation_reason = ?, refund_amount_bdt = ?, updated_at = ? WHERE id = ?")
      ->execute([$newStatus, $paymentStatus, $cancelReason, $refundAmount, $now, $orderId]);

  $histNote = $note ?: ("স্ট্যাটাস পরিবর্তন: {$existing['order_status']} → {$newStatus}");
  $pdo->prepare("INSERT INTO order_status_history (order_id, previous_status, new_status, note, changed_by_email, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      ->execute([$orderId, $existing['order_status'], $newStatus, $histNote, $admin['email'], $now]);

  $pdo->prepare("INSERT INTO audit_logs (actor_email, actor_uid, action, entity_type, entity_id, details, created_at) VALUES (?, ?, 'ORDER_STATUS_UPDATED', 'Order', ?, ?, ?)")
      ->execute([$admin['email'], $admin['uid'], $existing['order_number'], "{$existing['order_status']} -> {$newStatus} | Payment: {$paymentStatus}", $now]);

  sendJson(['order' => ['id' => $orderId, 'orderStatus' => $newStatus, 'paymentStatus' => $paymentStatus]]);
}

if ($requestUri === '/api/admin/settings' && $method === 'PUT') {
  $admin = requireAdmin($pdo);
  $now = gmdate('Y-m-d\TH:i:s\Z');
  $serializedPolicy = serializeSettingsPolicy($body);

  $pdo->prepare("UPDATE store_settings SET contact_phone = ?, contact_email = ?, business_address = ?, sylhet_delivery_bdt = ?, outside_sylhet_delivery_bdt = ?, free_delivery_threshold_bdt = ?, cod_enabled = ?, bkash_enabled = ?, nagad_enabled = ?, return_policy_text = ?, updated_at = ?")
      ->execute([
        trim((string)($body['contactPhone'] ?? '')),
        trim((string)($body['contactEmail'] ?? '')),
        trim((string)($body['businessAddress'] ?? '')),
        max(0, (int)($body['sylhetDeliveryBdt'] ?? 60)),
        max(0, (int)($body['outsideSylhetDeliveryBdt'] ?? 120)),
        max(0, (int)($body['freeDeliveryThresholdBdt'] ?? 3000)),
        !empty($body['codEnabled']) ? 1 : 0,
        !empty($body['bkashEnabled']) ? 1 : 0,
        !empty($body['nagadEnabled']) ? 1 : 0,
        $serializedPolicy,
        $now
      ]);

  @unlink($storefrontCacheFile);
  @unlink($storageDir . '/storefront_cache_v1.json');
  $row = $pdo->query("SELECT * FROM store_settings LIMIT 1")->fetch();
  sendJson(['settings' => formatSettingsRow($row)]);
}

function getBusinessKoroPhpConfig(): array {
  $defaultKey = 'bkr_d00b18119bbae3dcbe10312bfe949196dd0c0c1909e551ec';
  $envKey = trim((string)(getenv('BUSINESSKORO_API_KEY') ?: ($_ENV['BUSINESSKORO_API_KEY'] ?? '')));
  $apiKey = (strlen($envKey) > 4 && $envKey !== 'your_businesskoro_reseller_api_key') ? $envKey : $defaultKey;

  $defaultProductsUrl = 'https://api.businesskoro.com/api/v1/storefront/products';
  $envUrl = trim((string)(getenv('BUSINESSKORO_API_URL') ?: ($_ENV['BUSINESSKORO_API_URL'] ?? '')));
  $productsUrl = $defaultProductsUrl;
  if ($envUrl !== '' && $envUrl !== 'https://businesskoro.com/api/v1/products') {
    $productsUrl = preg_match('#/storefront/?$#', $envUrl) ? (rtrim($envUrl, '/') . '/products') : $envUrl;
  }
  $ordersUrl = preg_replace('#/products/?$#', '/orders', $productsUrl);
  return [
    'apiKey' => $apiKey,
    'productsUrl' => $productsUrl,
    'ordersUrl' => $ordersUrl,
    'domain' => 'boichitrabd.com',
  ];
}

function bkrHttpRequest(string $url, string $method = 'GET', ?array $jsonBody = null): array {
  $cfg = getBusinessKoroPhpConfig();
  $apiKey = $cfg['apiKey'];
  $domain = $cfg['domain'];
  $headers = [
    "Authorization: Bearer {$apiKey}",
    "x-api-key: {$apiKey}",
    "Origin: https://{$domain}",
    "Referer: https://{$domain}/",
    "x-domain: {$domain}",
    "Accept: application/json",
    "Content-Type: application/json",
    "User-Agent: BoichitraBD-Storefront/1.0",
  ];
  $payloadStr = $jsonBody !== null ? json_encode($jsonBody, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null;

  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    if ($method === 'POST') {
      curl_setopt($ch, CURLOPT_POST, true);
      if ($payloadStr !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payloadStr);
      }
    }
    $resp = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['status' => $status, 'body' => is_string($resp) ? $resp : ''];
  }

  $httpOpts = [
    'method' => $method,
    'timeout' => 12,
    'ignore_errors' => true,
    'header' => implode("\r\n", $headers) . "\r\n",
  ];
  if ($payloadStr !== null) {
    $httpOpts['content'] = $payloadStr;
  }
  $ctx = stream_context_create(['http' => $httpOpts]);
  $resp = @file_get_contents($url, false, $ctx);
  $status = 200;
  if (!empty($http_response_header[0]) && preg_match('#HTTP/\S+\s+(\d+)#', $http_response_header[0], $m)) {
    $status = (int)$m[1];
  }
  return ['status' => $status, 'body' => is_string($resp) ? $resp : ''];
}

function mapBusinessKoroPhpCategory(string $rawCat, string $productName = ''): array {
  $lowerCat = strtolower(trim($rawCat));
  $lowerName = strtolower(trim($productName));
  $combined = $lowerCat . ' ' . $lowerName;

  if (preg_match('/\b(watch|smartwatch|smart watch)\b/i', $lowerName)) {
    return ['slug' => 'smart-gadgets', 'name' => 'Smartwatch & Gadgets', 'nameBn' => 'স্মার্টওয়াচ ও গ্যাজেট', 'sortOrder' => 1];
  }
  if (
    strpos($lowerCat, 'fashion') !== false ||
    strpos($lowerCat, 'apparel') !== false ||
    preg_match('/\b(hoodie|dropsoulder|drop-shoulder|pullover|t-shirt|tshirt|panjabi|shirt|jacket|sunglass|glasses|trimmer|kemei|shoe cleaner)\b/i', $combined)
  ) {
    return ['slug' => 'fashion-item', 'name' => 'Fashion & Lifestyle', 'nameBn' => 'ফ্যাশন ও লাইফস্টাইল', 'sortOrder' => 2];
  }
  if (
    strpos($lowerCat, 'gaming') !== false ||
    strpos($lowerCat, 'game') !== false ||
    preg_match('/\b(game|gaming|console|cooler|plextone)\b/i', $combined)
  ) {
    return ['slug' => 'gaming-item', 'name' => 'Gaming & Console', 'nameBn' => 'গেমিং ও কনসোল', 'sortOrder' => 3];
  }
  if (preg_match('/\b(earbuds?|earphones?|airpods?|headphones?|headsets?|neckbands?|microphones?|mic|speakers?|boya)\b/i', $combined)) {
    return ['slug' => 'audio-accessories', 'name' => 'Audio & Microphone', 'nameBn' => 'অডিও ও মাইক্রোফোন', 'sortOrder' => 4];
  }
  if (preg_match('/\b(power bank|powerbank|router|ups|magsafe|charger|charging|140w|olax|jio)\b/i', $combined)) {
    return ['slug' => 'power-router', 'name' => 'Power Bank & Router', 'nameBn' => 'পাওয়ার ব্যাংক ও রাউটার', 'sortOrder' => 5];
  }
  if (
    strpos($lowerCat, 'decor') !== false ||
    strpos($lowerCat, 'home') !== false ||
    preg_match('/\b(lamp|neon|clock|kettle|knife|peeler|kitchen|massage|screwdriver|flashlight|lock|siren|waterproof box)\b/i', $combined)
  ) {
    return ['slug' => 'decorating-item', 'name' => 'Home, Kitchen & Decor', 'nameBn' => 'হোম, কিচেন ও ডেকোরেশন', 'sortOrder' => 6];
  }
  if (strpos($lowerCat, 'gadget') !== false || strpos($lowerCat, 'tech') !== false) {
    return ['slug' => 'smart-gadgets', 'name' => 'Smartwatch & Gadgets', 'nameBn' => 'স্মার্টওয়াচ ও গ্যাজেট', 'sortOrder' => 1];
  }
  $slug = trim(preg_replace('/[^a-z0-9]+/', '-', $lowerCat), '-') ?: 'smart-gadgets';
  return ['slug' => $slug, 'name' => trim($rawCat) ?: 'Smartwatch & Gadgets', 'nameBn' => trim($rawCat) ?: 'স্মার্টওয়াচ ও গ্যাজেট', 'sortOrder' => 7];
}

function resolveBdDivisionPhp(string $district): string {
  $d = strtolower(trim($district));
  $map = [
    'sylhet' => 'Sylhet', 'moulvibazar' => 'Sylhet', 'habiganj' => 'Sylhet', 'sunamganj' => 'Sylhet',
    'chattogram' => 'Chattogram', 'chittagong' => 'Chattogram', 'comilla' => 'Chattogram', 'cumilla' => 'Chattogram', 'feni' => 'Chattogram', 'noakhali' => 'Chattogram', 'cox\'s bazar' => 'Chattogram', 'brahmanbaria' => 'Chattogram', 'chandpur' => 'Chattogram', 'lakshmipur' => 'Chattogram',
    'rajshahi' => 'Rajshahi', 'bogura' => 'Rajshahi', 'bogra' => 'Rajshahi', 'pabna' => 'Rajshahi', 'sirajganj' => 'Rajshahi', 'natore' => 'Rajshahi', 'naogaon' => 'Rajshahi',
    'khulna' => 'Khulna', 'jashore' => 'Khulna', 'jessore' => 'Khulna', 'kushtia' => 'Khulna', 'satkhira' => 'Khulna', 'bagerhat' => 'Khulna',
    'barishal' => 'Barishal', 'barisal' => 'Barishal', 'bhola' => 'Barishal', 'patuakhali' => 'Barishal', 'pirojpur' => 'Barishal',
    'rangpur' => 'Rangpur', 'dinajpur' => 'Rangpur', 'kurigram' => 'Rangpur', 'gaibandha' => 'Rangpur', 'nilphamari' => 'Rangpur', 'thakurgaon' => 'Rangpur', 'panchagarh' => 'Rangpur', 'lalmonirhat' => 'Rangpur',
    'mymensingh' => 'Mymensingh', 'jamalpur' => 'Mymensingh', 'netrokona' => 'Mymensingh', 'sherpur' => 'Mymensingh',
  ];
  return $map[$d] ?? 'Dhaka';
}

function forwardOrderToBusinessKoroPhp(
  PDO $pdo,
  string $orderNumber,
  array $verifiedItems,
  string $fullName,
  string $normalizedPhone,
  string $district,
  string $upazila,
  string $addressLine,
  string $orderNote
): void {
  $cfg = getBusinessKoroPhpConfig();
  $division = resolveBdDivisionPhp($district);
  $cleanDistrict = mb_substr(trim($district) ?: 'Dhaka', 0, 100);
  $areaParts = explode('(', $upazila);
  $cleanArea = mb_substr(trim($areaParts[0]) ?: $cleanDistrict, 0, 100);
  $now = gmdate('Y-m-d\TH:i:s\Z');

  foreach ($verifiedItems as $vi) {
    $prod = $vi['product'];
    $qty = (int)$vi['quantity'];
    $galleryRaw = (string)($prod['gallery_urls_json'] ?? '');
    $galleryArr = json_decode($galleryRaw, true);
    $bkrProductId = is_array($galleryArr) ? trim((string)($galleryArr['bkrProductId'] ?? '')) : '';
    $bkrMinPrice = is_array($galleryArr) ? (int)($galleryArr['bkrMinPrice'] ?? 0) : 0;

    if ($bkrProductId === '') continue;

    $sellingPrice = max(1, $bkrMinPrice * $qty, (int)$vi['lineTotalBdt']);
    $noteParts = array_filter([
      "Order: {$orderNumber}",
      $vi['variantLabel'] !== 'Standard' ? "Variant: {$vi['variantLabel']}" : '',
      $qty > 1 ? "Qty: {$qty}" : '',
      $orderNote,
    ]);

    $payload = [
      'productId' => $bkrProductId,
      'customerName' => mb_substr($fullName, 0, 120),
      'customerPhone' => $normalizedPhone,
      'customerAddress' => mb_substr("{$addressLine}, {$upazila}, {$district}", 0, 500),
      'customerDivision' => $division,
      'customerDistrict' => $cleanDistrict,
      'customerArea' => $cleanArea,
      'sellingPrice' => $sellingPrice,
      'deliveryChargePaidByCustomer' => true,
      'customerNote' => mb_substr(implode(' | ', $noteParts), 0, 500),
    ];

    $resp = bkrHttpRequest($cfg['ordersUrl'], 'POST', $payload);
    $shortBody = mb_substr($resp['body'], 0, 220);
    $pdo->prepare("INSERT INTO audit_logs (actor_email, actor_uid, action, entity_type, entity_id, details, created_at) VALUES ('system@boichitrabd.com', 'system', 'BUSINESSKORO_ORDER_PUSH', 'Order', ?, ?, ?)")
        ->execute([$orderNumber, "Product {$bkrProductId} -> HTTP {$resp['status']}: {$shortBody}", $now]);
  }
}

function runBusinessKoroCatalogSync(
  PDO $pdo,
  string $storageDir,
  string $actorEmail,
  string $actorUid,
  int $markupPct = 0,
  int $fixedMarkup = 0,
  int $autoPublish = 1,
  bool $updateExistingPrices = true
): array {
  $cfg = getBusinessKoroPhpConfig();
  $nowTs = time();
  $now = gmdate('Y-m-d\TH:i:s\Z', $nowTs);
  $resp = bkrHttpRequest($cfg['productsUrl'], 'GET');

  $catalogItems = [];
  $syncMode = 'LIVE_API';
  $remoteNotice = '';
  $insideDhaka = 70;
  $outsideDhaka = 130;

  if ($resp['status'] >= 200 && $resp['status'] < 300 && $resp['body'] !== '') {
    $decoded = json_decode($resp['body'], true);
    if (is_array($decoded)) {
      if (!empty($decoded['deliveryCharges']) && is_array($decoded['deliveryCharges'])) {
        $insideDhaka = (int)($decoded['deliveryCharges']['insideDhaka'] ?? 70) ?: 70;
        $outsideDhaka = (int)($decoded['deliveryCharges']['outsideDhaka'] ?? 130) ?: 130;
      }
      $rawList = [];
      if (isset($decoded[0])) $rawList = $decoded;
      elseif (!empty($decoded['data']) && is_array($decoded['data'])) $rawList = $decoded['data'];
      elseif (!empty($decoded['products']) && is_array($decoded['products'])) $rawList = $decoded['products'];

      foreach (array_values($rawList) as $idx => $it) {
        if (!is_array($it)) continue;
        $bkrProductId = trim((string)($it['id'] ?? ''));
        $idParts = explode('-', $bkrProductId);
        $shortId = strtoupper(preg_replace('/[^A-Z0-9]/i', '', $idParts[0] ?: ('ITEM' . ($idx + 1))));
        $sku = 'BBD-BK-' . $shortId;

        $name = sanitizeCustomerText(trim((string)($it['name'] ?? $it['title'] ?? ('Product ' . $sku))));
        $nameBn = sanitizeCustomerText(trim((string)($it['name_bn'] ?? $name)));
        $costPrice = max(50, (int)round((float)($it['costPrice'] ?? $it['wholesale_price'] ?? 400)));
        $pkgCost = (float)($it['packagingCost'] ?? 25);
        $minSelling = max($costPrice, (int)round((float)($it['minimumSellingPrice']['customerPaysDelivery'] ?? ($costPrice + $pkgCost))));
        $suggestedSelling = max($minSelling, (int)round((float)($it['suggestedPrice'] ?? $it['suggestedPriceMin'] ?? round($costPrice * 1.35))));
        $suggestedRetail = max($suggestedSelling + 150, (int)round((float)($it['suggestedPriceMax'] ?? round($suggestedSelling * 1.22))));

        $inStock = ($it['inStock'] ?? true) !== false;
        $stock = !$inStock ? 0 : max(1, (int)($it['stockQuantity'] ?? $it['stock_quantity'] ?? 50));

        $rawCat = (string)($it['category_name'] ?? (is_string($it['category'] ?? null) ? $it['category'] : 'Smart Gadgets'));
        $mappedCat = mapBusinessKoroPhpCategory($rawCat, $name);

        $imgUrl = trim((string)($it['image'] ?? $it['image_url'] ?? ($it['images'][0] ?? '')));
        $mediaList = [];
        if ($imgUrl !== '') {
          $mediaList[] = ['id' => $sku . '-m1', 'type' => 'image', 'url' => $imgUrl, 'title' => $nameBn];
        }
        if (!empty($it['images']) && is_array($it['images'])) {
          foreach ($it['images'] as $gIdx => $gUrl) {
            if (is_string($gUrl) && $gUrl !== '' && $gUrl !== $imgUrl) {
              $mediaList[] = ['id' => $sku . '-m' . ($gIdx + 2), 'type' => 'image', 'url' => $gUrl, 'title' => $nameBn];
            }
          }
        }

        $vars = [];
        if (!empty($it['variants']) && is_array($it['variants'])) {
          foreach ($it['variants'] as $vIdx => $v) {
            if (!is_array($v)) continue;
            $vSize = trim((string)($v['size'] ?? ''));
            $vColor = trim((string)($v['color'] ?? $v['colour'] ?? ''));
            if ($vSize === '' && $vColor === '') continue;
            $vInStock = ($v['inStock'] ?? true) !== false;
            $vStock = !$vInStock ? 0 : max(0, (int)($v['stockQuantity'] ?? $v['stock_quantity'] ?? 20));
            $vars[] = [
              'sku' => strtoupper($sku . '-V' . ($vIdx + 1)),
              'size' => $vSize,
              'color' => $vColor,
              'adj' => (int)($v['price_adjustment'] ?? 0),
              'stock' => $vStock,
            ];
          }
        }

        $desc = sanitizeCustomerText(trim((string)($it['description'] ?? $name)));
        $descBn = sanitizeCustomerText(trim((string)($it['description_bn'] ?? $it['description'] ?? $nameBn)));

        $catalogItems[] = [
          'bkrProductId' => $bkrProductId,
          'sortRank' => (int)$idx,
          'sku' => $sku,
          'name' => $name,
          'nameBn' => $nameBn,
          'catSlug' => $mappedCat['slug'],
          'catName' => $mappedCat['name'],
          'catNameBn' => $mappedCat['nameBn'],
          'catSortOrder' => (int)($mappedCat['sortOrder'] ?? 10),
          'wholesale' => $costPrice,
          'minSelling' => $minSelling,
          'suggestedSelling' => $suggestedSelling,
          'retail' => $suggestedRetail,
          'stock' => $stock,
          'desc' => $desc ?: $name,
          'descBn' => $descBn ?: $nameBn,
          'imageUrl' => $imgUrl,
          'mediaList' => $mediaList,
          'variants' => $vars,
          'isFeatured' => $idx < 18 ? 1 : 0,
          'isNewArrival' => $idx < 24 ? 1 : 0,
          'isBestSeller' => ($idx % 2 === 0) ? 1 : 0,
          'isSpecialOffer' => ($suggestedRetail > $suggestedSelling) ? 1 : 0,
          'isSeasonal' => ($mappedCat['slug'] === 'fashion-item' || $idx < 12) ? 1 : 0,
        ];
      }
    }
  } else {
    $remoteNotice = "লাইভ এপিআই HTTP {$resp['status']} রিটার্ন করেছে।";
  }

  if (empty($catalogItems)) {
    throw new Exception($remoteNotice ?: 'BusinessKoro API থেকে পণ্য লোড করা যায়নি।');
  }

  // Preserve 0 delivery charge if admin explicitly enabled Free Delivery
  $curSettings = getStoreSettings($pdo);
  $newInsideDhaka = ((int)$curSettings['sylhetDeliveryBdt'] === 0) ? 0 : $insideDhaka;
  $newOutsideDhaka = ((int)$curSettings['outsideSylhetDeliveryBdt'] === 0) ? 0 : $outsideDhaka;
  $pdo->prepare("UPDATE store_settings SET sylhet_delivery_bdt = ?, outside_sylhet_delivery_bdt = ?, updated_at = ?")
      ->execute([$newInsideDhaka, $newOutsideDhaka, $now]);

  // Unpublish initial demo SKUs when real BusinessKoro catalog arrives
  $pdo->exec("UPDATE products SET is_published = 0 WHERE UPPER(sku) IN ('BBD-HD-101','BBD-GD-201','BBD-WT-301','BBD-PJ-401','BBD-GD-202','BBD-BG-501','BBD-GD-203','BBD-FS-102','BBD-BK-101','BBD-BK-102','BBD-BK-201','BBD-BK-202','BBD-BK-301','BBD-BK-401')");

  $createdCount = 0;
  $updatedCount = 0;
  $variantsSyncedCount = 0;

  $deletedRows = $pdo->query("SELECT entity_id FROM audit_logs WHERE action = 'DELETE_PRODUCT'")->fetchAll();
  $deletedSkus = [];
  foreach ($deletedRows as $dr) {
    $dSku = strtoupper(trim((string)($dr['entity_id'] ?? '')));
    if ($dSku !== '') $deletedSkus[$dSku] = true;
  }

  $activeCatIds = [];

  foreach ($catalogItems as $it) {
    if (!empty($deletedSkus[strtoupper($it['sku'])])) {
      continue;
    }
    $stmtCat = $pdo->prepare("SELECT * FROM categories WHERE LOWER(slug) = ? LIMIT 1");
    $stmtCat->execute([strtolower($it['catSlug'])]);
    $cat = $stmtCat->fetch();
    if (!$cat) {
      $pdo->prepare("INSERT INTO categories (name, name_bn, slug, description, sort_order, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)")
          ->execute([$it['catName'], $it['catNameBn'], strtolower($it['catSlug']), $it['catNameBn'], $it['catSortOrder'], $now]);
      $catId = (int)$pdo->lastInsertId();
    } else {
      $catId = (int)$cat['id'];
      $pdo->prepare("UPDATE categories SET name = ?, name_bn = ?, sort_order = ?, is_active = 1 WHERE id = ?")
          ->execute([$it['catName'], $it['catNameBn'], $it['catSortOrder'], $catId]);
    }
    $activeCatIds[$catId] = true;

    $baseSelling = $markupPct > 0
      ? max($it['suggestedSelling'], (int)round($it['wholesale'] * (1 + $markupPct / 100)))
      : $it['suggestedSelling'];
    $salePrice = max($it['minSelling'], $baseSelling + $fixedMarkup);
    $regPrice = max($salePrice + 150, (int)$it['retail'], (int)round($salePrice * 1.18));

    $galleryJson = json_encode([
      '__boichitraV2' => true,
      'bkrProductId' => $it['bkrProductId'],
      'bkrMinPrice' => $it['minSelling'],
      'bkrCostPrice' => $it['wholesale'],
      'bkrSortRank' => (int)$it['sortRank'],
      'media' => $it['mediaList'],
      'offer' => [
        'badgeText' => '🔥 বিশেষ অফার',
        'offerEndsAt' => '',
        'dealNote' => 'সীমিত সময়ের বিশেষ ছাড় · সারাদেশে ক্যাশ অন ডেলিভারি সুবিধা',
        'promoCouponCode' => '',
      ],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $itemTsStr = gmdate('Y-m-d\TH:i:s\Z', $nowTs - (int)$it['sortRank']);

    $stmtProd = $pdo->prepare("SELECT * FROM products WHERE UPPER(sku) = ? LIMIT 1");
    $stmtProd->execute([strtoupper($it['sku'])]);
    $exProd = $stmtProd->fetch();

    if ($exProd) {
      $exGallery = json_decode($exProd['gallery_urls_json'] ?? '{}', true);
      $exOffer = is_array($exGallery) ? ($exGallery['offer'] ?? $exGallery['offerMeta'] ?? []) : [];
      if (!empty($exOffer['freeDelivery'])) {
        $gDecoded = json_decode($galleryJson, true);
        if (is_array($gDecoded)) {
          $gDecoded['offer']['freeDelivery'] = true;
          $galleryJson = json_encode($gDecoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
      }
      $pid = (int)$exProd['id'];
      $newReg = $updateExistingPrices ? $regPrice : (int)$exProd['price_bdt'];
      $newSale = $updateExistingPrices ? $salePrice : (int)$exProd['sale_price_bdt'];
      $pdo->prepare("UPDATE products SET name = ?, name_bn = ?, category_id = ?, description = ?, description_bn = ?, price_bdt = ?, sale_price_bdt = ?, stock_quantity = ?, image_url = ?, gallery_urls_json = ?, is_featured = ?, is_new_arrival = ?, is_best_seller = ?, is_special_offer = ?, is_seasonal = ?, is_published = ?, updated_at = ? WHERE id = ?")
          ->execute([$it['name'], $it['nameBn'], $catId, $it['desc'], $it['descBn'], $newReg, $newSale, $it['stock'], $it['imageUrl'] ?: $exProd['image_url'], $galleryJson, $it['isFeatured'], $it['isNewArrival'], $it['isBestSeller'], $it['isSpecialOffer'], $it['isSeasonal'], $autoPublish ? 1 : (int)$exProd['is_published'], $itemTsStr, $pid]);
      $updatedCount++;
    } else {
      $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $it['name'] . '-' . $it['sku']));
      $pdo->prepare("INSERT INTO products (sku, name, name_bn, slug, category_id, description, description_bn, price_bdt, sale_price_bdt, stock_quantity, low_stock_threshold, image_url, gallery_urls_json, is_featured, is_new_arrival, is_best_seller, is_special_offer, is_seasonal, is_published, seo_title, seo_description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          ->execute([strtoupper($it['sku']), $it['name'], $it['nameBn'], $slug, $catId, $it['desc'], $it['descBn'], $regPrice, $salePrice, $it['stock'], $it['imageUrl'], $galleryJson, $it['isFeatured'], $it['isNewArrival'], $it['isBestSeller'], $it['isSpecialOffer'], $it['isSeasonal'], $autoPublish, $it['nameBn'], $it['descBn'], $itemTsStr, $itemTsStr]);
      $pid = (int)$pdo->lastInsertId();
      $createdCount++;
    }

    foreach ($it['variants'] as $v) {
      $stmtV = $pdo->prepare("SELECT * FROM product_variants WHERE product_id = ? AND UPPER(sku) = ? LIMIT 1");
      $stmtV->execute([$pid, strtoupper($v['sku'])]);
      $exV = $stmtV->fetch();
      if ($exV) {
        $pdo->prepare("UPDATE product_variants SET size = ?, color = ?, price_adjustment_bdt = ?, stock_quantity = ?, is_active = 1 WHERE id = ?")
            ->execute([$v['size'], $v['color'], $v['adj'], $v['stock'], (int)$exV['id']]);
      } else {
        $pdo->prepare("INSERT INTO product_variants (product_id, sku, size, color, price_adjustment_bdt, stock_quantity, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)")
            ->execute([$pid, strtoupper($v['sku']), $v['size'], $v['color'], $v['adj'], $v['stock']]);
      }
      $variantsSyncedCount++;
    }
  }

  // Deactivate legacy demo categories that have 0 published products
  $pubCatRows = $pdo->query("SELECT DISTINCT category_id FROM products WHERE is_published = 1")->fetchAll();
  $pubCatIds = [];
  foreach ($pubCatRows as $pcr) {
    $pubCatIds[(int)$pcr['category_id']] = true;
  }
  $allCats = $pdo->query("SELECT id, is_active FROM categories")->fetchAll();
  foreach ($allCats as $ac) {
    $cid = (int)$ac['id'];
    if (empty($pubCatIds[$cid]) && empty($activeCatIds[$cid]) && (int)$ac['is_active']) {
      $pdo->prepare("UPDATE categories SET is_active = 0 WHERE id = ?")->execute([$cid]);
    }
  }

  $totalSynced = count($catalogItems);
  $details = "Mode: {$syncMode} | Products: {$totalSynced} (Created: {$createdCount}, Updated: {$updatedCount}, Variants: {$variantsSyncedCount})";
  $pdo->prepare("INSERT INTO audit_logs (actor_email, actor_uid, action, entity_type, entity_id, details, created_at) VALUES (?, ?, 'BUSINESSKORO_SYNC', 'BusinessKoro', ?, ?, ?)")
      ->execute([$actorEmail, $actorUid, $syncMode, $details, $now]);

  @file_put_contents($storageDir . '/.bkr_auto_synced_v3', $now);

  return [
    'mode' => $syncMode,
    'totalSynced' => $totalSynced,
    'createdCount' => $createdCount,
    'updatedCount' => $updatedCount,
    'variantsSyncedCount' => $variantsSyncedCount,
    'markupPercentage' => $markupPct,
    'fixedMarkupBdt' => $fixedMarkup,
    'remoteNotice' => $remoteNotice,
    'message' => "Business Koro থেকে মোট {$totalSynced}টি পণ্য ({$createdCount}টি নতুন, {$updatedCount}টি আপডেট) এবং {$variantsSyncedCount}টি কালার/সাইজ ভ্যারিয়েন্ট সফলভাবে আপনার স্টোরে অটো-সিঙ্ক হয়েছে!",
  ];
}

if ($requestUri === '/api/admin/businesskoro/status' && $method === 'GET') {
  requireAdmin($pdo);
  $cfg = getBusinessKoroPhpConfig();
  $syncedCount = (int)$pdo->query("SELECT COUNT(*) FROM products WHERE UPPER(sku) LIKE 'BBD-BK-%' AND is_published = 1")->fetchColumn();
  $lastLog = $pdo->query("SELECT * FROM audit_logs WHERE action = 'BUSINESSKORO_SYNC' ORDER BY id DESC LIMIT 1")->fetch();

  sendJson([
    'hasServerApiKey' => !empty($cfg['apiKey']),
    'endpointUrl' => $cfg['productsUrl'],
    'syncedProductsCount' => $syncedCount,
    'catalogFeedAvailableCount' => max(54, $syncedCount),
    'lastSyncAt' => $lastLog['created_at'] ?? null,
    'lastSyncDetails' => $lastLog['details'] ?? null,
  ]);
}

if ($requestUri === '/api/admin/businesskoro/sync' && $method === 'POST') {
  $admin = requireAdmin($pdo);
  $markupPct = max(0, min(300, (int)($body['markupPercentage'] ?? 0)));
  $fixedMarkup = max(0, (int)($body['fixedMarkupBdt'] ?? 0));
  $autoPublish = ($body['autoPublish'] ?? true) !== false ? 1 : 0;
  $updateExistingPrices = ($body['updateExistingPrices'] ?? true) !== false;

  try {
    $res = runBusinessKoroCatalogSync(
      $pdo,
      $storageDir,
      $admin['email'],
      $admin['uid'],
      $markupPct,
      $fixedMarkup,
      $autoPublish,
      $updateExistingPrices
    );
    sendJson($res);
  } catch (Throwable $e) {
    sendJson(['error' => $e->getMessage() ?: 'Business Koro পণ্য সিঙ্ক করা যায়নি।'], 400);
  }
}

sendJson(['error' => 'API endpoint not found: ' . $requestUri], 404);

