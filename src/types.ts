export interface ProductMediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  title?: string;
}

export interface ProductOfferMeta {
  badgeText?: string;
  offerEndsAt?: string;
  dealNote?: string;
  promoCouponCode?: string;
  freeDelivery?: boolean;
}

export interface ProductVariant {
  id: number;
  productId: number;
  sku: string;
  size: string | null;
  color: string | null;
  priceAdjustmentBdt: number;
  stockQuantity: number;
  isActive: boolean;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  nameBn: string;
  slug: string;
  categoryId: number;
  categoryName?: string;
  categoryNameBn?: string;
  categorySlug?: string;
  description: string;
  descriptionBn: string;
  priceBdt: number;
  salePriceBdt: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  imageUrl: string;
  galleryUrlsJson: string;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isSpecialOffer: boolean;
  isSeasonal: boolean;
  isPublished: boolean;
  seoTitle?: string;
  seoDescription?: string;
  variants: ProductVariant[];
}

export interface Category {
  id: number;
  name: string;
  nameBn: string;
  slug: string;
  description: string | null;
  parentId: number | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount?: number;
}

export interface ManualPaymentMeta {
  method: 'BANGLA_QR';
  senderPhone: string;
  transactionId: string;
  paidAmountBdt?: number;
  qrDiscountBdt?: number;
  screenshotUrl?: string;
  submittedAt?: string;
}

export interface StoreSettings {
  id: number;
  storeName: string;
  storeNameBn: string;
  tagline: string;
  brandDescription: string;
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

export interface Coupon {
  id: number;
  code: string;
  description: string;
  discountType: string;
  discountValue: number;
  minOrderBdt: number;
  maxDiscountBdt: number | null;
  usageLimit?: number;
  usedCount?: number;
  isActive?: boolean;
}

export interface CartItem {
  key: string; // `${productId}-${variantId || 'std'}`
  product: Product;
  variant: ProductVariant | null;
  quantity: number;
}

export interface OrderItemRecord {
  id: number;
  orderId: number;
  productId: number;
  variantId: number | null;
  productNameSnapshot: string;
  productNameBnSnapshot: string;
  skuSnapshot: string;
  variantSnapshot: string;
  unitPriceBdt: number;
  quantity: number;
  lineTotalBdt: number;
}

export interface OrderHistoryRecord {
  id: number;
  orderId: number;
  previousStatus: string;
  newStatus: string;
  note: string;
  changedByEmail: string;
  createdAt: string;
}

export interface OrderRecord {
  id: number;
  orderNumber: string;
  idempotencyKey: string;
  customerId: number;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string;
  customerEmailSnapshot: string;
  districtSnapshot: string;
  upazilaSnapshot: string;
  shippingAddressSnapshot: string;
  orderNote: string;
  subtotalBdt: number;
  deliveryChargeBdt: number;
  discountBdt: number;
  couponCode: string;
  totalBdt: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  cancellationReason: string;
  refundAmountBdt: number;
  trackingToken: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItemRecord[];
  history: OrderHistoryRecord[];
  manualPayment?: ManualPaymentMeta | null;
}

export interface CustomerRecord {
  id: number;
  customerCode: string;
  fullName: string;
  phone: string;
  email: string;
  district: string;
  upazila: string;
  addressLine: string;
  totalOrders: number;
  totalSpentBdt: number;
  firstOrderAt: string;
  lastOrderAt: string;
  notes: string;
}

export interface AuditLogRecord {
  id: number;
  actorEmail: string;
  actorUid: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  createdAt: string;
}
