import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// 1. Admin Users (Site-Native Email/Username & Hashed Password Authentication)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').default('Admin'),
  passwordHash: text('password_hash').default(''),
  role: text('role').notNull().default('admin'), // 'admin'
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at').defaultNow(),
});

// 1b. Admin Sessions (Persistent Server-Side Session Tokens in PostgreSQL)
export const adminSessions = pgTable('admin_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Categories
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  nameBn: text('name_bn').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').default(''),
  parentId: integer('parent_id'),
  imageUrl: text('image_url').default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Products
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  nameBn: text('name_bn').notNull(),
  slug: text('slug').notNull().unique(),
  categoryId: integer('category_id')
    .references(() => categories.id)
    .notNull(),
  description: text('description').notNull(),
  descriptionBn: text('description_bn').notNull(),
  priceBdt: integer('price_bdt').notNull(),
  salePriceBdt: integer('sale_price_bdt'),
  stockQuantity: integer('stock_quantity').notNull().default(0),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
  imageUrl: text('image_url').notNull(),
  galleryUrlsJson: text('gallery_urls_json').notNull().default('[]'),
  isFeatured: boolean('is_featured').notNull().default(false),
  isNewArrival: boolean('is_new_arrival').notNull().default(false),
  isBestSeller: boolean('is_best_seller').notNull().default(false),
  isSpecialOffer: boolean('is_special_offer').notNull().default(false),
  isSeasonal: boolean('is_seasonal').notNull().default(false),
  isPublished: boolean('is_published').notNull().default(true),
  seoTitle: text('seo_title').default(''),
  seoDescription: text('seo_description').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. Product Variants (Size, Color, Variant SKU & Stock)
export const productVariants = pgTable('product_variants', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  sku: text('sku').notNull().unique(),
  size: text('size').default(''),
  color: text('color').default(''),
  priceAdjustmentBdt: integer('price_adjustment_bdt').notNull().default(0),
  stockQuantity: integer('stock_quantity').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

// 5. Customers (Guest Checkout Persistent Customer Record)
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  customerCode: text('customer_code').notNull().unique(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').default(''),
  district: text('district').notNull(),
  upazila: text('upazila').notNull(),
  addressLine: text('address_line').notNull(),
  totalOrders: integer('total_orders').notNull().default(0),
  totalSpentBdt: integer('total_spent_bdt').notNull().default(0),
  firstOrderAt: timestamp('first_order_at').defaultNow().notNull(),
  lastOrderAt: timestamp('last_order_at').defaultNow().notNull(),
  notes: text('notes').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 6. Coupons
export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  discountType: text('discount_type').notNull().default('fixed'),
  discountValue: integer('discount_value').notNull(),
  minOrderBdt: integer('min_order_bdt').notNull().default(0),
  maxDiscountBdt: integer('max_discount_bdt'),
  usageLimit: integer('usage_limit').notNull().default(1000),
  usedCount: integer('used_count').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. Orders (Guest Checkout Order with Immutable Customer & Address Snapshots)
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  customerNameSnapshot: text('customer_name_snapshot').notNull(),
  customerPhoneSnapshot: text('customer_phone_snapshot').notNull(),
  customerEmailSnapshot: text('customer_email_snapshot').default(''),
  districtSnapshot: text('district_snapshot').notNull(),
  upazilaSnapshot: text('upazila_snapshot').notNull(),
  shippingAddressSnapshot: text('shipping_address_snapshot').notNull(),
  orderNote: text('order_note').default(''),
  subtotalBdt: integer('subtotal_bdt').notNull(),
  deliveryChargeBdt: integer('delivery_charge_bdt').notNull(),
  discountBdt: integer('discount_bdt').notNull().default(0),
  couponCode: text('coupon_code').default(''),
  totalBdt: integer('total_bdt').notNull(),
  paymentMethod: text('payment_method').notNull().default('COD'),
  paymentStatus: text('payment_status').notNull().default('UNPAID'),
  orderStatus: text('order_status').notNull().default('Pending'),
  cancellationReason: text('cancellation_reason').default(''),
  refundAmountBdt: integer('refund_amount_bdt').notNull().default(0),
  trackingToken: text('tracking_token').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 8. Order Items (Immutable Price & Product Snapshots)
export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  variantId: integer('variant_id'),
  productNameSnapshot: text('product_name_snapshot').notNull(),
  productNameBnSnapshot: text('product_name_bn_snapshot').notNull(),
  skuSnapshot: text('sku_snapshot').notNull(),
  variantSnapshot: text('variant_snapshot').default('Standard'),
  unitPriceBdt: integer('unit_price_bdt').notNull(),
  quantity: integer('quantity').notNull(),
  lineTotalBdt: integer('line_total_bdt').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. Order Status History
export const orderStatusHistory = pgTable('order_status_history', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id)
    .notNull(),
  previousStatus: text('previous_status').notNull(),
  newStatus: text('new_status').notNull(),
  note: text('note').default(''),
  changedByEmail: text('changed_by_email').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 10. Store Settings
export const storeSettings = pgTable('store_settings', {
  id: serial('id').primaryKey(),
  storeName: text('store_name').notNull().default('Boichitra BD'),
  storeNameBn: text('store_name_bn').notNull().default('বৈচিত্র্য'),
  tagline: text('tagline').notNull().default('Fashion, Gadget & Everything'),
  brandDescription: text('brand_description')
    .notNull()
    .default(
      'বৈচিত্র্য মানে সবকিছু এক জায়গায়! শীতের হুডি থেকে গরমের স্মার্ট গ্যাজেট, ট্রেন্ডি সব প্রোডাক্ট পাবে সিলেট থেকে সারাদেশে।'
    ),
  contactPhone: text('contact_phone').notNull().default('কনফিগারযোগ্য হেল্পলাইন (অ্যাডমিন প্যানেল থেকে যুক্ত করুন)'),
  contactEmail: text('contact_email').notNull().default('support@boichitrabd.example'),
  businessAddress: text('business_address').notNull().default('Sylhet, Bangladesh (সিলেট, বাংলাদেশ)'),
  sylhetDeliveryBdt: integer('sylhet_delivery_bdt').notNull().default(60),
  outsideSylhetDeliveryBdt: integer('outside_sylhet_delivery_bdt').notNull().default(120),
  freeDeliveryThresholdBdt: integer('free_delivery_threshold_bdt').notNull().default(3000),
  codEnabled: boolean('cod_enabled').notNull().default(true),
  bkashEnabled: boolean('bkash_enabled').notNull().default(false),
  nagadEnabled: boolean('nagad_enabled').notNull().default(false),
  returnPolicyText: text('return_policy_text')
    .notNull()
    .default(
      'ডেলিভারি পাওয়ার পর পণ্যটি ডেলিভারি ম্যানের সামনে চেক করে নিন। ত্রুটিপূর্ণ বা ভুল পণ্য পেলে তাৎক্ষণিক রিটার্ন বা এক্সচেঞ্জ সুবিধা প্রযোজ্য।'
    ),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 11. Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorEmail: text('actor_email').notNull(),
  actorUid: text('actor_uid').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  details: text('details').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  variants: many(productVariants),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
  statusHistory: many(orderStatusHistory),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
  order: one(orders, {
    fields: [orderStatusHistory.orderId],
    references: [orders.id],
  }),
}));
