import express from 'express';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { createServer as createViteServer, build as viteBuild } from 'vite';
import * as dotenv from 'dotenv';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import { adminSessions } from './src/db/schema.ts';
import {
  createGuestOrder,
  getAdminOverviewData,
  getStorefrontData,
  recordExportAuditLog,
  sanitizeSpreadsheetText,
  saveCategoryAdmin,
  saveCouponAdmin,
  deleteCouponAdmin,
  saveProductAdmin,
  deleteProductAdmin,
  bulkDeleteProductsAdmin,
  trackOrderPublic,
  updateOrderAdmin,
  updateStoreSettingsAdmin,
  validateCouponOnServer,
  getBusinessKoroSyncStatus,
  syncBusinessKoroProducts,
  invalidateStorefrontCache,
  getRawBanglaQrImageUrl,
} from './src/db/repository.ts';
import {
  requireAdminAuth,
  AuthRequest,
  checkAdminSetupStatus,
  setupInitialAdminAccount,
  loginAdminWithPassword,
  extractTokenFromRequest,
  getAdminUserBySessionToken,
  changeAdminCredentials,
} from './src/middleware/auth.ts';
import { isValidBdPhone, normalizeBdPhone } from './src/lib/bd-locations.ts';
import { buildZipArchive, ZipEntryInput } from './src/lib/zip-builder.ts';
import { serializeReturnPolicyWithBanglaQr } from './src/lib/visuals.ts';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '15mb' }));

let cachedStorefrontJson = '';
let cachedStorefrontGzip: Buffer | null = null;

app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && req.path !== '/coupons/validate' && req.path !== '/orders/track') {
    invalidateStorefrontCache();
    cachedStorefrontJson = '';
    cachedStorefrontGzip = null;
    res.on('finish', () => {
      invalidateStorefrontCache();
      cachedStorefrontJson = '';
      cachedStorefrontGzip = null;
    });
  }
  next();
});

// Rate limiter for public and login endpoints
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}

function setSessionCookie(res: express.Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.setHeader(
    'Set-Cookie',
    `bbd_admin_session=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${
      7 * 24 * 60 * 60
    }; SameSite=Lax${isProd ? '; Secure' : ''}`
  );
}

function clearSessionCookie(res: express.Response) {
  res.setHeader(
    'Set-Cookie',
    'bbd_admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
  );
}

// Validation Schemas
const guestCheckoutSchema = z.object({
  idempotencyKey: z.string().min(8).max(120),
  fullName: z.string().trim().min(2, 'গ্রাহকের পূর্ণ নাম লিখুন'),
  phone: z
    .string()
    .trim()
    .refine(
      (val) => isValidBdPhone(val),
      'সঠিক ১১ ডিজিটের বাংলাদেশী মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)'
    ),
  email: z.string().trim().email('সঠিক ইমেইল ঠিকানা দিন').optional().or(z.literal('')),
  district: z.string().trim().min(2, 'জেলা নির্বাচন করুন'),
  upazila: z.string().trim().min(2, 'উপজেলা/থানা নির্বাচন করুন'),
  addressLine: z.string().trim().min(5, 'সম্পূর্ণ ডেলিভারি ঠিকানা লিখুন'),
  orderNote: z.string().max(500).optional().or(z.literal('')),
  paymentMethod: z.enum(['COD', 'BANGLA_QR']),
  paymentSenderPhone: z.string().max(60).optional().or(z.literal('')),
  paymentTransactionId: z.string().max(80).optional().or(z.literal('')),
  paymentScreenshotUrl: z.string().max(2_500_000).optional().or(z.literal('')),
  couponCode: z.string().max(40).optional().or(z.literal('')),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        variantId: z.number().int().positive().nullable().optional(),
        quantity: z.number().int().min(1).max(50),
      })
    )
    .min(1, 'কার্টে অন্তত ১টি পণ্য থাকতে হবে'),
});

const orderTrackSchema = z.object({
  orderNumber: z.string().trim().min(5, 'অর্ডার নম্বর দিন'),
  phone: z
    .string()
    .trim()
    .refine((val) => isValidBdPhone(val), 'সঠিক মোবাইল নম্বর দিন'),
});

// ============================================================================
// SITE-NATIVE ADMIN AUTHENTICATION ROUTES (No Google Integration Required)
// ============================================================================

app.get('/api/admin/auth/status', async (req, res) => {
  try {
    const setupStatus = await checkAdminSetupStatus();
    const rawToken = extractTokenFromRequest(req);
    const verified = await getAdminUserBySessionToken(rawToken);

    res.setHeader('Cache-Control', 'no-store, private');
    res.json({
      isSetupComplete: setupStatus.isSetupComplete,
      authenticated: Boolean(verified),
      adminUser: verified
        ? {
            email: verified.adminUser.email,
            name: verified.adminUser.name || 'Admin',
            role: verified.adminUser.role,
          }
        : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'অ্যাডমিন স্ট্যাটাস লোড করা যায়নি।' });
  }
});

app.post('/api/admin/auth/setup', async (req, res) => {
  const { email, name, password } = req.body || {};
  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'অ্যাডমিন ইমেইল বা ইউজারনেম লিখুন।' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।' });
  }

  try {
    const { admin, token } = await setupInitialAdminAccount({
      email,
      name: name || 'Boichitra Admin',
      password,
    });
    setSessionCookie(res, token);
    res.status(201).json({
      token,
      adminUser: {
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'অ্যাডমিন সেটআপ সম্পন্ন করা যায়নি।' });
  }
});

app.post('/api/admin/auth/login', async (req, res) => {
  const clientIp = req.ip || 'unknown';
  if (!checkRateLimit(`admin_login:${clientIp}`, 10, 60_000)) {
    return res.status(429).json({
      error: 'অতিরিক্ত লগইন প্রচেষ্টা করা হয়েছে। অনুগ্রহ করে ১ মিনিট পর আবার চেষ্টা করুন।',
    });
  }

  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ error: 'ইমেইল/ইউজারনেম এবং পাসওয়ার্ড উভয়ই লিখুন।' });
  }

  try {
    const { admin, token } = await loginAdminWithPassword(
      String(identifier),
      String(password)
    );
    setSessionCookie(res, token);
    res.json({
      token,
      adminUser: {
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error: any) {
    res.status(401).json({ error: error.message || 'লগইন ব্যর্থ হয়েছে।' });
  }
});

app.post('/api/admin/auth/logout', async (req, res) => {
  try {
    const rawToken = extractTokenFromRequest(req);
    const verified = await getAdminUserBySessionToken(rawToken);
    if (verified) {
      await db
        .delete(adminSessions)
        .where(eq(adminSessions.tokenHash, verified.tokenHash));
    }
    clearSessionCookie(res);
    res.json({ success: true });
  } catch {
    clearSessionCookie(res);
    res.json({ success: true });
  }
});

app.post('/api/admin/auth/change-password', requireAdminAuth, async (req: AuthRequest, res) => {
  const { currentPassword, newEmail, newName, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || String(newPassword).length < 6) {
    return res.status(400).json({
      error: 'বর্তমান পাসওয়ার্ড এবং কমপক্ষে ৬ অক্ষরের নতুন পাসওয়ার্ড দিন।',
    });
  }

  try {
    const updated = await changeAdminCredentials(req.adminRecord!.id, {
      currentPassword: String(currentPassword),
      newEmail: newEmail ? String(newEmail) : undefined,
      newName: newName ? String(newName) : undefined,
      newPassword: String(newPassword),
    });
    res.json({
      adminUser: {
        email: updated.email,
        name: updated.name,
        role: updated.role,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'পাসওয়ার্ড পরিবর্তন করা যায়নি।' });
  }
});

// ============================================================================
// PUBLIC STOREFRONT & GUEST CHECKOUT ROUTES
// ============================================================================

app.get('/api/bangla-qr-image', async (_req, res) => {
  try {
    const rawUrl = await getRawBanglaQrImageUrl();
    const match = rawUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (match) {
      const mimeType = match[1];
      const buffer = Buffer.from(match[2], 'base64');
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(buffer);
    }
    if (
      rawUrl.startsWith('http') ||
      (rawUrl.startsWith('/') && rawUrl !== '/api/bangla-qr-image')
    ) {
      return res.redirect(302, rawUrl);
    }
    return res.status(404).end();
  } catch {
    return res.status(404).end();
  }
});

app.get('/api/storefront', async (req, res) => {
  try {
    const data = await getStorefrontData();
    if (!cachedStorefrontJson) {
      const slimSettings =
        data.settings &&
        typeof data.settings.banglaQrImageUrl === 'string' &&
        data.settings.banglaQrImageUrl.length > 2000 &&
        data.settings.banglaQrImageUrl.startsWith('data:image/')
          ? { ...data.settings, banglaQrImageUrl: '/api/bangla-qr-image' }
          : data.settings;
      cachedStorefrontJson = JSON.stringify({ ...data, settings: slimSettings });
      cachedStorefrontGzip = zlib.gzipSync(Buffer.from(cachedStorefrontJson, 'utf-8'));
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const acceptEnc = String(req.headers['accept-encoding'] || '');
    if (cachedStorefrontGzip && acceptEnc.includes('gzip')) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      return res.end(cachedStorefrontGzip);
    }
    return res.end(cachedStorefrontJson);
  } catch (error: any) {
    console.error('GET /api/storefront error:', error);
    res.status(500).json({ error: error.message || 'স্টোরের তথ্য লোড করা যায়নি।' });
  }
});

app.post('/api/coupons/validate', async (req, res) => {
  try {
    const { code, subtotalBdt } = req.body || {};
    if (typeof code !== 'string' || typeof subtotalBdt !== 'number') {
      return res.status(400).json({ valid: false, discountBdt: 0, message: 'অবৈধ রিকোয়েস্ট।' });
    }
    const result = await validateCouponOnServer(code, subtotalBdt);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ valid: false, discountBdt: 0, message: error.message });
  }
});

app.post('/api/orders/checkout', async (req, res) => {
  const clientIp = req.ip || 'unknown';
  if (!checkRateLimit(`checkout:${clientIp}`, 20, 60_000)) {
    return res.status(429).json({
      error: 'অতিরিক্ত রিকোয়েস্ট পাঠানো হয়েছে। অনুগ্রহ করে ১ মিনিট পর আবার চেষ্টা করুন।',
    });
  }

  const parsed = guestCheckoutSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return res.status(400).json({
      error: firstIssue?.message || 'ফর্মের তথ্যগুলো সঠিকভাবে পূরণ করুন।',
      details: parsed.error.issues,
    });
  }

  try {
    const result = await createGuestOrder(parsed.data);
    res.status(201).json(result);
  } catch (error: any) {
    console.error('POST /api/orders/checkout error:', error);
    res.status(400).json({ error: error.message || 'অর্ডার সম্পন্ন করা যায়নি।' });
  }
});

app.post('/api/orders/track', async (req, res) => {
  const clientIp = req.ip || 'unknown';
  if (!checkRateLimit(`track:${clientIp}`, 15, 60_000)) {
    return res.status(429).json({
      error: 'অতিরিক্ত অনুসন্ধান করা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।',
    });
  }

  const parsed = orderTrackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || 'সঠিক অর্ডার নম্বর ও মোবাইল নম্বর দিন।',
    });
  }

  try {
    const trackingData = await trackOrderPublic(
      parsed.data.orderNumber,
      parsed.data.phone
    );
    if (!trackingData) {
      return res.status(404).json({
        error: 'এই অর্ডার নম্বর এবং মোবাইল নম্বরের সাথে মিলে এমন কোনো অর্ডার পাওয়া যায়নি।',
      });
    }
    res.json(trackingData);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'ট্র্যাকিং তথ্য লোড করা যায়নি।' });
  }
});

// ============================================================================
// PROTECTED ADMIN MANAGEMENT & EXCEL (.XLSX) EXPORT ROUTES
// ============================================================================

app.get('/api/admin/overview', requireAdminAuth, async (req: AuthRequest, res) => {
  try {
    const overview = await getAdminOverviewData();
    const payloadJson = JSON.stringify({
      ...overview,
      adminUser: {
        email: req.user?.email,
        name: req.adminRecord?.name || req.user?.name || 'Admin',
        role: req.adminRecord?.role || 'admin',
      },
    });
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const acceptEnc = String(req.headers['accept-encoding'] || '');
    if (acceptEnc.includes('gzip')) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      return res.end(zlib.gzipSync(Buffer.from(payloadJson, 'utf-8')));
    }
    return res.end(payloadJson);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'অ্যাডমিন ডেটা লোড করা যায়নি।' });
  }
});

app.post('/api/admin/products', requireAdminAuth, async (req: AuthRequest, res) => {
  try {
    const b = req.body;
    if (!b.sku || !b.name || !b.nameBn || !b.categoryId || typeof b.priceBdt !== 'number') {
      return res
        .status(400)
        .json({ error: 'পণ্যের নাম, বাংলা নাম, SKU, ক্যাটাগরি এবং মূল্য আবশ্যক।' });
    }
    const product = await saveProductAdmin(
      req.user?.email || 'admin',
      req.user?.uid || 'admin',
      {
        id: b.id ? Number(b.id) : undefined,
        sku: String(b.sku),
        name: String(b.name),
        nameBn: String(b.nameBn),
        categoryId: Number(b.categoryId),
        description: String(b.description || b.name),
        descriptionBn: String(b.descriptionBn || b.nameBn),
        priceBdt: Math.max(1, Number(b.priceBdt)),
        salePriceBdt: b.salePriceBdt ? Number(b.salePriceBdt) : null,
        stockQuantity: Math.max(0, Number(b.stockQuantity ?? 0)),
        lowStockThreshold: Number(b.lowStockThreshold ?? 5),
        imageUrl: String(b.imageUrl || ''),
        galleryUrlsJson: typeof b.galleryUrlsJson === 'string' ? b.galleryUrlsJson : '[]',
        isFeatured: Boolean(b.isFeatured),
        isNewArrival: Boolean(b.isNewArrival),
        isBestSeller: Boolean(b.isBestSeller),
        isSpecialOffer: Boolean(b.isSpecialOffer),
        isSeasonal: Boolean(b.isSeasonal),
        isPublished: b.isPublished !== false,
        seoTitle: String(b.seoTitle || ''),
        seoDescription: String(b.seoDescription || ''),
        variants: Array.isArray(b.variants) ? b.variants : undefined,
      }
    );
    res.json({ product });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'পণ্য সংরক্ষণ করা যায়নি।' });
  }
});

app.delete('/api/admin/products/:id', requireAdminAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || id <= 0) {
      return res.status(400).json({ error: 'অবৈধ পণ্যের আইডি।' });
    }
    const result = await deleteProductAdmin(
      req.user?.email || 'admin',
      req.user?.uid || 'admin',
      id
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'পণ্যটি মুছে ফেলা যায়নি।' });
  }
});

app.post('/api/admin/products/bulk-delete', requireAdminAuth, async (req: AuthRequest, res) => {
  try {
    const ids = Array.isArray(req.body?.productIds) ? req.body.productIds : [];
    const result = await bulkDeleteProductsAdmin(
      req.user?.email || 'admin',
      req.user?.uid || 'admin',
      ids
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'নির্বাচিত পণ্যগুলো মুছে ফেলা যায়নি।' });
  }
});

app.post('/api/admin/coupons', requireAdminAuth, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    if (!b.code || !b.description || !b.discountValue) {
      return res.status(400).json({ error: 'কুপন কোড, বিবরণ এবং ছাড়ের পরিমাণ আবশ্যক।' });
    }
    const coupon = await saveCouponAdmin(
      req.user?.email || 'admin',
      req.user?.uid || 'admin',
      {
        id: b.id ? Number(b.id) : undefined,
        code: String(b.code),
        description: String(b.description),
        discountType: b.discountType === 'percentage' ? 'percentage' : 'fixed',
        discountValue: Number(b.discountValue),
        minOrderBdt: Number(b.minOrderBdt ?? 0),
        maxDiscountBdt: b.maxDiscountBdt ? Number(b.maxDiscountBdt) : null,
        usageLimit: Number(b.usageLimit ?? 1000),
        isActive: b.isActive !== false,
      }
    );
    res.json({ coupon });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'কুপন সংরক্ষণ করা যায়নি।' });
  }
});

app.delete('/api/admin/coupons/:id', requireAdminAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await deleteCouponAdmin(req.user?.email || 'admin', req.user?.uid || 'admin', id);
    res.json({ deleted: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'কুপন মুছে ফেলা যায়নি।' });
  }
});

app.post('/api/admin/categories', requireAdminAuth, async (req: AuthRequest, res) => {
  try {
    const b = req.body;
    if (!b.name || !b.nameBn) {
      return res.status(400).json({ error: 'ক্যাটাগরির ইংরেজি ও বাংলা নাম আবশ্যক।' });
    }
    const category = await saveCategoryAdmin(
      req.user?.email || 'admin',
      req.user?.uid || 'admin',
      {
        id: b.id ? Number(b.id) : undefined,
        name: String(b.name),
        nameBn: String(b.nameBn),
        description: String(b.description || ''),
        sortOrder: Number(b.sortOrder ?? 0),
        isActive: b.isActive !== false,
      }
    );
    res.json({ category });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'ক্যাটাগরি সংরক্ষণ করা যায়নি।' });
  }
});

const ALLOWED_ORDER_STATUSES = new Set([
  'Pending',
  'Confirmed',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
  'Returned',
  'Refunded',
]);

app.patch('/api/admin/orders/:id', requireAdminAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    const { orderStatus, paymentStatus, note, cancellationReason, refundAmountBdt } =
      req.body || {};
    if (!ALLOWED_ORDER_STATUSES.has(orderStatus)) {
      return res.status(400).json({ error: 'অবৈধ অর্ডার স্ট্যাটাস।' });
    }
    const updated = await updateOrderAdmin(
      req.user?.email || 'admin',
      req.user?.uid || 'admin',
      orderId,
      {
        orderStatus,
        paymentStatus: paymentStatus || 'UNPAID',
        note,
        cancellationReason,
        refundAmountBdt: refundAmountBdt ? Number(refundAmountBdt) : 0,
      }
    );
    res.json({ order: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'অর্ডার আপডেট করা যায়নি।' });
  }
});

app.put('/api/admin/settings', requireAdminAuth, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    const updated = await updateStoreSettingsAdmin(
      req.user?.email || 'admin',
      req.user?.uid || 'admin',
      {
        contactPhone: String(b.contactPhone || ''),
        contactEmail: String(b.contactEmail || ''),
        businessAddress: String(b.businessAddress || ''),
        sylhetDeliveryBdt: Math.max(0, Number(b.sylhetDeliveryBdt ?? 60)),
        outsideSylhetDeliveryBdt: Math.max(0, Number(b.outsideSylhetDeliveryBdt ?? 120)),
        freeDeliveryThresholdBdt: Math.max(0, Number(b.freeDeliveryThresholdBdt ?? 3000)),
        codEnabled: Boolean(b.codEnabled),
        bkashEnabled: Boolean(b.bkashEnabled),
        nagadEnabled: Boolean(b.nagadEnabled),
        returnPolicyText: String(b.returnPolicyText || ''),
        banglaQrEnabled: b.banglaQrEnabled !== false,
        banglaQrImageUrl:
          typeof b.banglaQrImageUrl === 'string' ? b.banglaQrImageUrl : undefined,
        banglaQrMerchantName:
          typeof b.banglaQrMerchantName === 'string' ? b.banglaQrMerchantName : undefined,
        banglaQrAccountNumber:
          typeof b.banglaQrAccountNumber === 'string' ? b.banglaQrAccountNumber : undefined,
        banglaQrInstructions:
          typeof b.banglaQrInstructions === 'string' ? b.banglaQrInstructions : undefined,
        banglaQrDiscountEnabled: b.banglaQrDiscountEnabled !== false,
        banglaQrDiscountType:
          b.banglaQrDiscountType === 'fixed' ? 'fixed' : 'percentage',
        banglaQrDiscountValue:
          b.banglaQrDiscountValue !== undefined ? Number(b.banglaQrDiscountValue) : undefined,
        banglaQrMaxDiscountBdt:
          b.banglaQrMaxDiscountBdt !== undefined ? Number(b.banglaQrMaxDiscountBdt) : undefined,
      }
    );
    res.json({ settings: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'সেটিংস আপডেট করা যায়নি।' });
  }
});

app.get('/api/admin/businesskoro/status', requireAdminAuth, async (_req: AuthRequest, res) => {
  try {
    const status = await getBusinessKoroSyncStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Business Koro স্ট্যাটাস লোড করা যায়নি।' });
  }
});

app.post('/api/admin/businesskoro/sync', requireAdminAuth, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    const result = await syncBusinessKoroProducts(
      req.user?.email || 'admin',
      req.user?.uid || 'admin',
      {
        markupPercentage:
          b.markupPercentage !== undefined ? Number(b.markupPercentage) : 0,
        fixedMarkupBdt: b.fixedMarkupBdt !== undefined ? Number(b.fixedMarkupBdt) : 0,
        autoPublish: b.autoPublish !== false,
        updateExistingPrices: b.updateExistingPrices !== false,
        restoreDeleted: Boolean(b.restoreDeleted),
      }
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Business Koro পণ্য সিঙ্ক করা যায়নি।' });
  }
});

app.get('/api/admin/export/customers.xlsx', requireAdminAuth, async (req: AuthRequest, res) => {
  try {
    const overview = await getAdminOverviewData();
    const searchQuery = String(req.query.search || '').trim().toLowerCase();

    const filteredCustomers = overview.customers.filter((c) => {
      if (!searchQuery) return true;
      return (
        c.fullName.toLowerCase().includes(searchQuery) ||
        c.phone.toLowerCase().includes(searchQuery) ||
        c.customerCode.toLowerCase().includes(searchQuery) ||
        c.district.toLowerCase().includes(searchQuery)
      );
    });

    const rows = filteredCustomers.map((c, idx) => ({
      'SL': idx + 1,
      'Customer ID': sanitizeSpreadsheetText(c.customerCode),
      'Full Name (গ্রাহকের নাম)': sanitizeSpreadsheetText(c.fullName),
      'Mobile Number (মোবাইল)': sanitizeSpreadsheetText(normalizeBdPhone(c.phone)),
      'Email (ইমেইল)': sanitizeSpreadsheetText(c.email || 'N/A'),
      'District (জেলা)': sanitizeSpreadsheetText(c.district),
      'Upazila/Thana (উপজেলা/থানা)': sanitizeSpreadsheetText(c.upazila),
      'Delivery Address (ঠিকানা)': sanitizeSpreadsheetText(c.addressLine),
      'Total Orders (মোট অর্ডার)': Number(c.totalOrders),
      'Total Order Value BDT (মোট ক্রয় ৳)': Number(c.totalSpentBdt),
      'First Order Date (প্রথম অর্ডার)': c.firstOrderAt
        ? new Date(c.firstOrderAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })
        : '',
      'Last Order Date (সর্বশেষ অর্ডার)': c.lastOrderAt
        ? new Date(c.lastOrderAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })
        : '',
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(
      rows.length > 0
        ? rows
        : [
            {
              'SL': 1,
              'Customer ID': 'NO-DATA',
              'Full Name (গ্রাহকের নাম)': 'কোনো কাস্টমার রেকর্ড পাওয়া যায়নি',
              'Mobile Number (মোবাইল)': '',
              'Email (ইমেইল)': '',
              'District (জেলা)': '',
              'Upazila/Thana (উপজেলা/থানা)': '',
              'Delivery Address (ঠিকানা)': '',
              'Total Orders (মোট অর্ডার)': 0,
              'Total Order Value BDT (মোট ক্রয় ৳)': 0,
              'First Order Date (প্রথম অর্ডার)': '',
              'Last Order Date (সর্বশেষ অর্ডার)': '',
            },
          ]
    );

    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 26 },
      { wch: 16 },
      { wch: 24 },
      { wch: 16 },
      { wch: 24 },
      { wch: 38 },
      { wch: 16 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Boichitra Customers');

    await recordExportAuditLog(
      req.user?.email || 'admin',
      req.user?.uid || 'admin',
      'Customers_XLSX',
      filteredCustomers.length
    );

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const dateStamp = new Date().toISOString().slice(0, 10);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Boichitra_BD_Customers_${dateStamp}.xlsx"`
    );
    res.send(buffer);
  } catch (error: any) {
    console.error('Export customers XLSX error:', error);
    res.status(500).json({ error: 'কাস্টমার এক্সেল ফাইল তৈরিতে সমস্যা হয়েছে।' });
  }
});

app.get('/api/admin/export/orders.xlsx', requireAdminAuth, async (req: AuthRequest, res) => {
  try {
    const overview = await getAdminOverviewData();
    const statusFilter = String(req.query.status || 'ALL');
    const searchQuery = String(req.query.search || '').trim().toLowerCase();

    const filteredOrders = overview.orders.filter((o) => {
      if (statusFilter !== 'ALL' && o.orderStatus !== statusFilter) return false;
      if (!searchQuery) return true;
      return (
        o.orderNumber.toLowerCase().includes(searchQuery) ||
        o.customerNameSnapshot.toLowerCase().includes(searchQuery) ||
        o.customerPhoneSnapshot.toLowerCase().includes(searchQuery)
      );
    });

    const orderRows = filteredOrders.map((o, idx) => ({
      'SL': idx + 1,
      'Order Number (অর্ডার নম্বর)': sanitizeSpreadsheetText(o.orderNumber),
      'Order Date (তারিখ - Asia/Dhaka)': o.createdAt
        ? new Date(o.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })
        : '',
      'Order Status (স্ট্যাটাস)': sanitizeSpreadsheetText(o.orderStatus),
      'Payment Method (পেমেন্ট মাধ্যম)': sanitizeSpreadsheetText(
        o.paymentMethod === 'BANGLA_QR' ? 'Bangla QR (ম্যানুয়াল)' : o.paymentMethod
      ),
      'Payment Status (পেমেন্ট স্ট্যাটাস)': sanitizeSpreadsheetText(o.paymentStatus),
      'Sender Number (পেমেন্ট নম্বর)': sanitizeSpreadsheetText(
        o.manualPayment?.senderPhone || 'N/A'
      ),
      'Transaction ID (TrxID)': sanitizeSpreadsheetText(
        o.manualPayment?.transactionId || 'N/A'
      ),
      'Customer Name (গ্রাহকের নাম)': sanitizeSpreadsheetText(o.customerNameSnapshot),
      'Mobile Number (মোবাইল)': sanitizeSpreadsheetText(o.customerPhoneSnapshot),
      'District (জেলা)': sanitizeSpreadsheetText(o.districtSnapshot),
      'Upazila/Thana (উপজেলা/থানা)': sanitizeSpreadsheetText(o.upazilaSnapshot),
      'Shipping Address (ডেলিভারি ঠিকানা)': sanitizeSpreadsheetText(o.shippingAddressSnapshot),
      'Items Summary (পণ্যের বিবরণ)': sanitizeSpreadsheetText(
        o.items
          .map((i) => `${i.productNameBnSnapshot} (${i.variantSnapshot}) x${i.quantity}`)
          .join('; ')
      ),
      'Subtotal BDT (সাবটোটাল ৳)': Number(o.subtotalBdt),
      'Discount BDT (ছাড় ৳)': Number(o.discountBdt),
      'Delivery Charge BDT (ডেলিভারি চার্জ ৳)': Number(o.deliveryChargeBdt),
      'Total Payable BDT (সর্বমোট ৳)': Number(o.totalBdt),
      'Order Note (নোট)': sanitizeSpreadsheetText(o.orderNote || ''),
      'Cancellation Reason': sanitizeSpreadsheetText(o.cancellationReason || ''),
    }));

    const lineItemRows: Array<Record<string, any>> = [];
    for (const o of filteredOrders) {
      for (const item of o.items) {
        lineItemRows.push({
          'Order Number': sanitizeSpreadsheetText(o.orderNumber),
          'Order Status': sanitizeSpreadsheetText(o.orderStatus),
          'Customer Name': sanitizeSpreadsheetText(o.customerNameSnapshot),
          'Customer Phone': sanitizeSpreadsheetText(o.customerPhoneSnapshot),
          'SKU': sanitizeSpreadsheetText(item.skuSnapshot),
          'Product Name (English)': sanitizeSpreadsheetText(item.productNameSnapshot),
          'Product Name (বাংলা)': sanitizeSpreadsheetText(item.productNameBnSnapshot),
          'Variant (সাইজ/কালার)': sanitizeSpreadsheetText(item.variantSnapshot),
          'Unit Price BDT (একক মূল্য ৳)': Number(item.unitPriceBdt),
          'Quantity (পরিমাণ)': Number(item.quantity),
          'Line Total BDT (মোট মূল্য ৳)': Number(item.lineTotalBdt),
        });
      }
    }

    const workbook = XLSX.utils.book_new();
    const ordersSheet = XLSX.utils.json_to_sheet(
      orderRows.length > 0
        ? orderRows
        : [
            {
              'SL': 1,
              'Order Number (অর্ডার নম্বর)': 'NO-ORDERS',
              'Order Date (তারিখ - Asia/Dhaka)': '',
              'Order Status (স্ট্যাটাস)': '',
              'Payment Method (পেমেন্ট মাধ্যম)': '',
              'Payment Status (পেমেন্ট স্ট্যাটাস)': '',
              'Sender Number (পেমেন্ট নম্বর)': '',
              'Transaction ID (TrxID)': '',
              'Customer Name (গ্রাহকের নাম)': 'কোনো অর্ডার পাওয়া যায়নি',
              'Mobile Number (মোবাইল)': '',
              'District (জেলা)': '',
              'Upazila/Thana (উপজেলা/থানা)': '',
              'Shipping Address (ডেলিভারি ঠিকানা)': '',
              'Items Summary (পণ্যের বিবরণ)': '',
              'Subtotal BDT (সাবটোটাল ৳)': 0,
              'Discount BDT (ছাড় ৳)': 0,
              'Delivery Charge BDT (ডেলিভারি চার্জ ৳)': 0,
              'Total Payable BDT (সর্বমোট ৳)': 0,
              'Order Note (নোট)': '',
              'Cancellation Reason': '',
            },
          ]
    );

    ordersSheet['!cols'] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 22 },
      { wch: 15 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 24 },
      { wch: 16 },
      { wch: 15 },
      { wch: 22 },
      { wch: 36 },
      { wch: 45 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 25 },
      { wch: 22 },
    ];

    const itemsSheet = XLSX.utils.json_to_sheet(
      lineItemRows.length > 0
        ? lineItemRows
        : [
            {
              'Order Number': 'NO-ITEMS',
              'Order Status': '',
              'Customer Name': '',
              'Customer Phone': '',
              'SKU': '',
              'Product Name (English)': '',
              'Product Name (বাংলা)': '',
              'Variant (সাইজ/কালার)': '',
              'Unit Price BDT (একক মূল্য ৳)': 0,
              'Quantity (পরিমাণ)': 0,
              'Line Total BDT (মোট মূল্য ৳)': 0,
            },
          ]
    );

    itemsSheet['!cols'] = [
      { wch: 20 },
      { wch: 14 },
      { wch: 24 },
      { wch: 16 },
      { wch: 18 },
      { wch: 32 },
      { wch: 34 },
      { wch: 20 },
      { wch: 18 },
      { wch: 14 },
      { wch: 18 },
    ];

    XLSX.utils.book_append_sheet(workbook, ordersSheet, 'Orders Summary');
    XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Order Line Items');

    await recordExportAuditLog(
      req.user?.email || 'admin',
      req.user?.uid || 'admin',
      'Orders_XLSX',
      filteredOrders.length
    );

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const dateStamp = new Date().toISOString().slice(0, 10);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Boichitra_BD_Orders_${dateStamp}.xlsx"`
    );
    res.send(buffer);
  } catch (error: any) {
    console.error('Export orders XLSX error:', error);
    res.status(500).json({ error: 'অর্ডার এক্সেল ফাইল তৈরিতে সমস্যা হয়েছে।' });
  }
});

function collectFilesRecursively(dirPath: string, baseDir: string = dirPath): ZipEntryInput[] {
  const results: ZipEntryInput[] = [];
  if (!fs.existsSync(dirPath)) return results;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      results.push(...collectFilesRecursively(fullPath, baseDir));
    } else if (entry.isFile()) {
      results.push({
        name: relPath,
        content: fs.readFileSync(fullPath),
      });
    }
  }
  return results;
}

// 1-Click Ready-to-Upload ProCloudify cPanel (PHP + Static HTML/JS — No Node.js Required) ZIP Bundle
app.get('/api/procloudify-cpanel-php.zip', async (_req, res) => {
  try {
    const distDir = path.join(process.cwd(), 'dist');
    const distIndex = path.join(distDir, 'index.html');
    if (!fs.existsSync(distIndex)) {
      await viteBuild();
    }

    const overview = await getAdminOverviewData();
    const rawReturnPolicyText = serializeReturnPolicyWithBanglaQr({
      returnPolicyText: overview.settings.returnPolicyText,
      banglaQrEnabled: overview.settings.banglaQrEnabled,
      banglaQrImageUrl: overview.settings.banglaQrImageUrl,
      banglaQrMerchantName: overview.settings.banglaQrMerchantName,
      banglaQrAccountNumber: overview.settings.banglaQrAccountNumber,
      banglaQrInstructions: overview.settings.banglaQrInstructions,
      banglaQrDiscountEnabled: overview.settings.banglaQrDiscountEnabled,
      banglaQrDiscountType: overview.settings.banglaQrDiscountType,
      banglaQrDiscountValue: overview.settings.banglaQrDiscountValue,
      banglaQrMaxDiscountBdt: overview.settings.banglaQrMaxDiscountBdt,
    });

    const seedSnapshot = {
      rawSettings: {
        ...overview.settings,
        rawReturnPolicyText,
      },
      categories: overview.categories,
      products: overview.products,
      coupons: overview.coupons,
    };

    const zipEntries: ZipEntryInput[] = [];
    const distFiles = collectFilesRecursively(distDir, distDir);
    for (const file of distFiles) {
      if (file.name === 'api.php' || file.name === '.htaccess') continue;
      zipEntries.push(file);
    }

    const htaccessPath = path.join(process.cwd(), 'public', '.htaccess');
    if (fs.existsSync(htaccessPath)) {
      zipEntries.push({
        name: '.htaccess',
        content: fs.readFileSync(htaccessPath),
      });
    }

    const apiPhpPath = path.join(process.cwd(), 'public', 'api.php');
    if (fs.existsSync(apiPhpPath)) {
      let apiPhpSource = fs.readFileSync(apiPhpPath, 'utf8');
      const phpJsonExpr = `json_decode(${JSON.stringify(JSON.stringify(seedSnapshot))}, true)`;
      apiPhpSource = apiPhpSource.replace(
        '/*__BOICHITRA_INITIAL_SEED_JSON__*/ null',
        phpJsonExpr
      );
      zipEntries.push({
        name: 'api.php',
        content: Buffer.from(apiPhpSource, 'utf8'),
      });
    }

    const readmeTxt = `========================================================================
Boichitra BD — বৈচিত্র্য (ProCloudify cPanel PHP Edition — No Node.js Needed!)
========================================================================

আপনার ProCloudify (https://procloudify.com.bd/) হোস্টিংয়ে Node.js না থাকলেও
এই জিপ ফাইলটি সরাসরি সাধারণ PHP cPanel শেয়ার্ড হোস্টিংয়ে ১০০% কাজ করবে!

কীভাবে আপলোড করবেন (মাত্র ৩টি ধাপ):
------------------------------------------------------------------------
১. আপনার ProCloudify cPanel-এ লগইন করে "File Manager"-এ যান।
২. বাম পাশ থেকে "public_html" ফোল্ডারের ভেতরে ঢুকুন (আগের ডিফল্ট ফাইল থাকলে মুছে ফেলুন)।
৩. উপরের "Upload" বাটনে ক্লিক করে এই জিপ ফাইলটি (Boichitra_BD_ProCloudify_cPanel_PHP.zip)
   আপলোড করুন এবং ফাইলটির ওপর Right-Click করে "Extract" করুন।

ব্যস! আর কোনো ডেটাবেস সেটআপ বা কমান্ড দিতে হবে না।
- আপনার ওয়েবসাইট সাথে সাথে লাইভ হয়ে যাবে।
- আপনার বর্তমান সব পণ্য, ক্যাটাগরি, কুপন ও বাংলা কিউআর সেটিংস স্বয়ংক্রিয়ভাবে যুক্ত থাকবে।
- অ্যাডমিন প্যানেলে (/admin) ঢুকে আপনার ইমেইল ও পাসওয়ার্ড সেটআপ করে সব অর্ডার পরিচালনা করতে পারবেন।
========================================================================
`;
    zipEntries.push({
      name: 'HOW_TO_UPLOAD_PROCLOUDIFY_BN.txt',
      content: Buffer.from(readmeTxt, 'utf8'),
    });

    const zipBuffer = buildZipArchive(zipEntries);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Boichitra_BD_ProCloudify_cPanel_PHP.zip"'
    );
    res.send(zipBuffer);
  } catch (error: any) {
    console.error('Error building ProCloudify PHP ZIP:', error);
    res.status(500).json({
      error: 'ProCloudify cPanel জিপ প্যাকেজ তৈরিতে সমস্যা হয়েছে: ' + (error?.message || ''),
    });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    store: 'Boichitra BD — বৈচিত্র্য',
    timezone: 'Asia/Dhaka',
    timestamp: new Date().toISOString(),
  });
});

app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/admin\nSitemap: ${baseUrl}/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const data = await getStorefrontData();
    const urls = [
      `<url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
      ...data.products.map(
        (p: any) =>
          `<url><loc>${baseUrl}/?product=${encodeURIComponent(p.slug)}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`
      ),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
    res.type('application/xml').send(xml);
  } catch {
    res.status(500).send('Error generating sitemap');
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Boichitra BD Server running on http://0.0.0.0:${PORT}`);
    // Pre-warm storefront cache immediately on startup so first visitor gets <2ms response
    getStorefrontData()
      .then((data) => {
        const slimSettings =
          data.settings &&
          typeof data.settings.banglaQrImageUrl === 'string' &&
          data.settings.banglaQrImageUrl.length > 2000 &&
          data.settings.banglaQrImageUrl.startsWith('data:image/')
            ? { ...data.settings, banglaQrImageUrl: '/api/bangla-qr-image' }
            : data.settings;
        cachedStorefrontJson = JSON.stringify({ ...data, settings: slimSettings });
        cachedStorefrontGzip = zlib.gzipSync(Buffer.from(cachedStorefrontJson, 'utf-8'));
      })
      .catch(() => {});
  });
}

startServer();
