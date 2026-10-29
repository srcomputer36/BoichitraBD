/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  ShoppingBag,
  Search,
  Truck,
  ShieldCheck,
  RefreshCw,
  MapPin,
  Phone,
  CheckCircle2,
  X,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  PackageSearch,
  Tag,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Lock,
  Play,
  Sparkles,
  Copy,
  Clock,
  QrCode,
} from 'lucide-react';
import {
  CartItem,
  Category,
  Coupon,
  Product,
  ProductVariant,
  StoreSettings,
} from './types.ts';
import {
  BANGLADESH_DISTRICTS,
  formatBdt,
  isValidBdPhone,
  normalizeBdPhone,
} from './lib/bd-locations.ts';
import {
  createStudioProductSvg,
  createDefaultBanglaQrSvg,
  parseProductGalleryAndOffer,
  getEmbedVideoInfo,
  compressImageFileToDataUrl,
  calculateBanglaQrDiscountBdt,
  getBanglaQrDiscountBadgeText,
  extractDistinctColorsAndSizes,
  findBestMatchingVariant,
  getColorSwatchHex,
  buildProductPromoUrl,
  copyTextToClipboard,
} from './lib/visuals.ts';
import { ProductCard, ResilientProductImage } from './components/ProductVisualCard.tsx';

const AdminPanel = React.lazy(() =>
  import('./components/AdminPanel.tsx').then((m) => ({ default: m.AdminPanel }))
);

const ITEMS_PER_PAGE = 12;
const STOREFRONT_CACHE_KEY = 'boichitra_storefront_fast_v5';

function readCachedStorefront(): {
  settings: StoreSettings | null;
  categories: Category[];
  products: Product[];
  coupons: Coupon[];
} | null {
  try {
    const raw = localStorage.getItem(STOREFRONT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.products) && parsed.products.length > 0) {
      return parsed;
    }
  } catch (_e) {}
  return null;
}

export default function App() {
  // Route state: 'store' or 'admin'
  const [route, setRoute] = useState<'store' | 'admin'>(() => {
    if (
      window.location.pathname.startsWith('/admin') ||
      window.location.hash === '#admin'
    ) {
      return 'admin';
    }
    return 'store';
  });

  const initialCache = useMemo(() => readCachedStorefront(), []);

  // Storefront Server Data (hydrated immediately from cache if available)
  const [settings, setSettings] = useState<StoreSettings | null>(
    () => initialCache?.settings || null
  );
  const [categories, setCategories] = useState<Category[]>(
    () => initialCache?.categories || []
  );
  const [products, setProducts] = useState<Product[]>(
    () => initialCache?.products || []
  );
  const [coupons, setCoupons] = useState<Coupon[]>(
    () => initialCache?.coupons || []
  );
  const [loading, setLoading] = useState<boolean>(() => !initialCache);
  const [loadError, setLoadError] = useState('');

  // Catalog Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'ALL'>('ALL');
  const [collectionTab, setCollectionTab] = useState<
    'all' | 'featured' | 'new' | 'bestseller' | 'offer' | 'seasonal'
  >('all');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(15000);
  const [sortBy, setSortBy] = useState<'newest' | 'price-asc' | 'price-desc'>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  // Selected Product Detail (PDP) Modal
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [pdpQuantity, setPdpQuantity] = useState(1);
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);
  const [copiedCouponCode, setCopiedCouponCode] = useState<string | null>(null);
  const [copiedPdpLinkType, setCopiedPdpLinkType] = useState<'product' | 'checkout' | null>(null);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());

  // Shopping Cart (convenience state in browser; server revalidates all prices & stock on checkout)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'checkout' | 'confirmed'>('cart');
  const [cartNotice, setCartNotice] = useState<string | null>(null);

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountBdt: number;
    message: string;
  } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Guest Checkout Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('Dhaka');
  const [selectedUpazila, setSelectedUpazila] = useState(
    BANGLADESH_DISTRICTS.find((d) => d.name === 'Dhaka')?.upazilas[0] ||
      BANGLADESH_DISTRICTS[0].upazilas[0]
  );
  const [addressLine, setAddressLine] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'BANGLA_QR'>('COD');
  const [paymentSenderPhone, setPaymentSenderPhone] = useState('');
  const [paymentTransactionId, setPaymentTransactionId] = useState('');
  const [paymentScreenshotUrl, setPaymentScreenshotUrl] = useState('');
  const [showQrLightbox, setShowQrLightbox] = useState(false);
  const [checkoutIdempotencyKey, setCheckoutIdempotencyKey] = useState(() =>
    `IDEMP-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [confirmedOrderData, setConfirmedOrderData] = useState<any | null>(null);

  // Public Order Tracking Modal State
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackOrderNo, setTrackOrderNo] = useState('');
  const [trackPhone, setTrackPhone] = useState('');
  const [trackingResult, setTrackingResult] = useState<any | null>(null);
  const [trackingError, setTrackingError] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);

  // Policy Modal
  const [policyModal, setPolicyModal] = useState<'return' | 'privacy' | null>(null);

  const loadStorefront = useCallback(async () => {
    if (!readCachedStorefront()) {
      setLoading(true);
    }
    setLoadError('');
    try {
      let data: any = null;
      const win = window as any;
      if (win.__BOICHITRA_STOREFRONT_PREFETCH__) {
        const prefetched = win.__BOICHITRA_STOREFRONT_PREFETCH__;
        win.__BOICHITRA_STOREFRONT_PREFETCH__ = null;
        data = await prefetched;
      }
      if (!data || !Array.isArray(data.products)) {
        const res = await fetch('/api/storefront');
        data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'স্টোরের তথ্য লোড করতে সমস্যা হয়েছে।');
        }
      }
      setSettings(data.settings);
      setCategories(data.categories || []);
      setProducts(data.products || []);
      setCoupons(data.coupons || []);
      try {
        localStorage.setItem(
          STOREFRONT_CACHE_KEY,
          JSON.stringify({
            settings: data.settings,
            categories: data.categories || [],
            products: data.products || [],
            coupons: data.coupons || [],
          })
        );
      } catch (_e) {}
    } catch (err: any) {
      if (!readCachedStorefront()) {
        setLoadError(err.message || 'সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি।');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStorefront();
  }, [loadStorefront]);

  // Sync route state with browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      if (
        window.location.pathname.startsWith('/admin') ||
        window.location.hash === '#admin'
      ) {
        setRoute('admin');
      } else {
        setRoute('store');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Auto-open product modal (or direct checkout) when visiting deep-link URL (?product=slug or ?product=slug&checkout=1)
  const deepLinkHandledRef = useRef<string>('');
  useEffect(() => {
    if (products.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const productParam = (params.get('product') || params.get('sku') || '').trim();
    const isDirectCheckout = params.get('checkout') === '1' || params.get('buy') === '1';
    const sig = `${productParam}|${isDirectCheckout ? '1' : '0'}`;
    if (productParam && deepLinkHandledRef.current !== sig) {
      const lower = productParam.toLowerCase();
      const matched = products.find(
        (p) =>
          p.slug.toLowerCase() === lower ||
          p.sku.toLowerCase() === lower ||
          String(p.id) === lower
      );
      if (matched) {
        deepLinkHandledRef.current = sig;
        const defaultVar = matched.variants.length > 0 ? matched.variants[0] : null;
        if (isDirectCheckout) {
          const key = `${matched.id}-${defaultVar ? defaultVar.id : 'std'}`;
          setCart((prev) =>
            prev.some((i) => i.key === key)
              ? prev
              : [...prev, { key, product: matched, variant: defaultVar, quantity: 1 }]
          );
          setCheckoutStep('checkout');
          setIsCartOpen(true);
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete('checkout');
            url.searchParams.delete('buy');
            window.history.replaceState({}, '', url.pathname + url.search + url.hash);
          } catch (_e) {}
        } else {
          setActiveProduct(matched);
          setSelectedVariant(defaultVar);
          setPdpQuantity(1);
          setActiveMediaIdx(0);
        }
      }
    }
  }, [products]);

  // Update Upazila options when District changes
  const currentDistrictObj = useMemo(
    () =>
      BANGLADESH_DISTRICTS.find((d) => d.name === selectedDistrict) ||
      BANGLADESH_DISTRICTS[0],
    [selectedDistrict]
  );

  useEffect(() => {
    if (
      currentDistrictObj &&
      !currentDistrictObj.upazilas.includes(selectedUpazila)
    ) {
      setSelectedUpazila(currentDistrictObj.upazilas[0]);
    }
  }, [currentDistrictObj, selectedUpazila]);

  const categoryProductCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of products) {
      counts.set(p.categoryId, (counts.get(p.categoryId) || 0) + 1);
    }
    return counts;
  }, [products]);

  const handleSelectCategory = useCallback(
    (catId: number | 'ALL', scrollToCatalog = true) => {
      setSelectedCategoryId(catId);
      setCollectionTab('all');
      setSearchQuery('');
      if (scrollToCatalog) {
        setTimeout(() => {
          document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
        }, 40);
      }
    },
    []
  );

  // Filter & Sort Products
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const selectedCatObj =
      selectedCategoryId === 'ALL'
        ? null
        : categories.find((c) => c.id === selectedCategoryId) || null;

    const list = products.filter((p) => {
      if (selectedCategoryId !== 'ALL') {
        const matchesId = Number(p.categoryId) === Number(selectedCategoryId);
        const matchesSlug =
          Boolean(selectedCatObj?.slug) &&
          Boolean(p.categorySlug) &&
          p.categorySlug?.toLowerCase() === selectedCatObj?.slug.toLowerCase();
        if (!matchesId && !matchesSlug) {
          return false;
        }
      }
      if (collectionTab === 'featured' && !p.isFeatured) return false;
      if (collectionTab === 'new' && !p.isNewArrival) return false;
      if (collectionTab === 'bestseller' && !p.isBestSeller) return false;
      if (collectionTab === 'offer' && !p.isSpecialOffer) return false;
      if (collectionTab === 'seasonal' && !p.isSeasonal) return false;

      const effectivePrice =
        p.salePriceBdt && p.salePriceBdt < p.priceBdt ? p.salePriceBdt : p.priceBdt;
      if (effectivePrice > maxPriceFilter) return false;

      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.nameBn.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.descriptionBn.toLowerCase().includes(q) ||
        (p.categoryNameBn && p.categoryNameBn.toLowerCase().includes(q)) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(q))
      );
    });

    if (sortBy === 'price-asc' || sortBy === 'price-desc') {
      return [...list].sort((a, b) => {
        const priceA =
          a.salePriceBdt && a.salePriceBdt < a.priceBdt ? a.salePriceBdt : a.priceBdt;
        const priceB =
          b.salePriceBdt && b.salePriceBdt < b.priceBdt ? b.salePriceBdt : b.priceBdt;
        if (sortBy === 'price-asc') return priceA - priceB;
        return priceB - priceA;
      });
    }
    // Preserve server-side latest-updated order (BusinessKoro's latest updated products first)
    return list;
  }, [products, categories, selectedCategoryId, collectionTab, maxPriceFilter, searchQuery, sortBy]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategoryId, collectionTab, maxPriceFilter, searchQuery, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  // Cart Calculations
  const cartItemCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  const cartSubtotalBdt = useMemo(() => {
    return cart.reduce((sum, item) => {
      const base =
        item.product.salePriceBdt && item.product.salePriceBdt < item.product.priceBdt
          ? item.product.salePriceBdt
          : item.product.priceBdt;
      const adj = item.variant ? item.variant.priceAdjustmentBdt : 0;
      return sum + (base + adj) * item.quantity;
    }, 0);
  }, [cart]);

  const discountBdt = useMemo(() => {
    if (!appliedCoupon) return 0;
    return Math.min(appliedCoupon.discountBdt, cartSubtotalBdt);
  }, [appliedCoupon, cartSubtotalBdt]);

  const potentialQrDiscountBdt = useMemo(() => {
    const subtotalAfterCoupon = Math.max(0, cartSubtotalBdt - discountBdt);
    return calculateBanglaQrDiscountBdt(subtotalAfterCoupon, settings);
  }, [cartSubtotalBdt, discountBdt, settings]);

  const activeQrDiscountBdt = useMemo(() => {
    return paymentMethod === 'BANGLA_QR' ? potentialQrDiscountBdt : 0;
  }, [paymentMethod, potentialQrDiscountBdt]);

  const totalDiscountBdt = discountBdt + activeQrDiscountBdt;

  const deliveryChargeBdt = useMemo(() => {
    if (cart.length === 0) return 0;
    const freeThreshold = settings?.freeDeliveryThresholdBdt ?? 3000;
    if (freeThreshold > 0 && cartSubtotalBdt - totalDiscountBdt >= freeThreshold) {
      return 0;
    }
    const isInsideDhaka = selectedDistrict.toLowerCase() === 'dhaka';
    return isInsideDhaka
      ? settings?.sylhetDeliveryBdt ?? 60
      : settings?.outsideSylhetDeliveryBdt ?? 120;
  }, [cart.length, settings, cartSubtotalBdt, totalDiscountBdt, selectedDistrict]);

  const finalTotalBdt = Math.max(
    0,
    cartSubtotalBdt - totalDiscountBdt + deliveryChargeBdt
  );

  // Handlers
  const openProductDetail = (
    product: Product,
    preselectedVariant?: ProductVariant | null
  ) => {
    setActiveProduct(product);
    setSelectedVariant(
      preselectedVariant !== undefined
        ? preselectedVariant
        : product.variants.length > 0
        ? product.variants[0]
        : null
    );
    setPdpQuantity(1);
    setActiveMediaIdx(0);
    setCopiedPdpLinkType(null);
    try {
      const slugOrSku = product.slug || product.sku;
      if (slugOrSku) {
        window.history.replaceState({}, '', `/?product=${encodeURIComponent(slugOrSku)}`);
      }
    } catch (_e) {}
  };

  const closeProductDetail = () => {
    setActiveProduct(null);
    try {
      if (window.location.search.includes('product=')) {
        window.history.replaceState({}, '', window.location.pathname || '/');
      }
    } catch (_e) {}
  };

  const handleCopyProductLink = async (product: Product, directCheckout = false) => {
    const link = buildProductPromoUrl(product, { directCheckout });
    await copyTextToClipboard(link);
    setCopiedPdpLinkType(directCheckout ? 'checkout' : 'product');
    setCartNotice(
      directCheckout
        ? `ডিরেক্ট অর্ডার প্রমোশন লিংক কপি হয়েছে: ${link}`
        : `পণ্যের প্রমোশন লিংক কপি হয়েছে: ${link}`
    );
    setTimeout(() => {
      setCopiedPdpLinkType(null);
      setCartNotice(null);
    }, 3500);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const specialOfferProducts = useMemo(
    () => products.filter((p) => p.isSpecialOffer),
    [products]
  );

  const handleCopyCoupon = (code: string) => {
    setCouponInput(code);
    setCopiedCouponCode(code);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    setCartNotice(`কুপন কোড "${code}" কপি হয়েছে! চেকআউটের সময় প্রযোজ্য হবে।`);
    setTimeout(() => {
      setCopiedCouponCode(null);
      setCartNotice(null);
    }, 3000);
  };

  const addToCart = (
    product: Product,
    variant: ProductVariant | null,
    qty: number,
    openCheckoutDirectly = false
  ) => {
    const maxStock = variant ? variant.stockQuantity : product.stockQuantity;
    if (maxStock <= 0) return;

    const key = `${product.id}-${variant ? variant.id : 'std'}`;
    setCart((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        const nextQty = Math.min(maxStock, existing.quantity + qty);
        return prev.map((i) => (i.key === key ? { ...i, quantity: nextQty } : i));
      }
      return [...prev, { key, product, variant, quantity: Math.min(maxStock, qty) }];
    });

    // Generate a fresh idempotency key whenever cart changes
    setCheckoutIdempotencyKey(
      `IDEMP-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    );

    if (openCheckoutDirectly) {
      setActiveProduct(null);
      setCheckoutStep('checkout');
      setIsCartOpen(true);
    } else {
      const variantDetails = variant
        ? ` (${[
            variant.color ? `কালার: ${variant.color}` : '',
            variant.size ? `সাইজ: ${variant.size}` : '',
          ]
            .filter(Boolean)
            .join(', ')})`
        : '';
      setCartNotice(`"${product.nameBn}"${variantDetails} কার্টে যোগ করা হয়েছে।`);
      setTimeout(() => setCartNotice(null), 3000);
    }
  };

  const changeCartItemVariant = (oldKey: string, newVariant: ProductVariant) => {
    setCart((prev) => {
      const currentItem = prev.find((i) => i.key === oldKey);
      if (!currentItem) return prev;
      const newKey = `${currentItem.product.id}-${newVariant.id}`;
      if (newKey === oldKey) return prev;

      const maxStock = Math.max(1, newVariant.stockQuantity);
      const existingTarget = prev.find((i) => i.key === newKey);
      if (existingTarget) {
        return prev
          .filter((i) => i.key !== oldKey)
          .map((i) =>
            i.key === newKey
              ? { ...i, quantity: Math.min(maxStock, i.quantity + currentItem.quantity) }
              : i
          );
      }
      return prev.map((i) =>
        i.key === oldKey
          ? {
              ...i,
              key: newKey,
              variant: newVariant,
              quantity: Math.min(maxStock, i.quantity),
            }
          : i
      );
    });
    setAppliedCoupon(null);
  };

  const updateCartQuantity = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.key !== key) return item;
          const maxStock = item.variant
            ? item.variant.stockQuantity
            : item.product.stockQuantity;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          return { ...item, quantity: Math.min(maxStock, nextQty) };
        })
        .filter(Boolean) as CartItem[]
    );
    setAppliedCoupon(null);
  };

  const removeFromCart = (key: string) => {
    setCart((prev) => prev.filter((i) => i.key !== key));
    setAppliedCoupon(null);
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setValidatingCoupon(true);
    setCouponError('');
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponInput.trim(),
          subtotalBdt: cartSubtotalBdt,
        }),
      });
      const data = await res.json();
      if (!data.valid) {
        setAppliedCoupon(null);
        setCouponError(data.message || 'কুপন কোডটি প্রযোজ্য নয়।');
      } else {
        setAppliedCoupon({
          code: data.code,
          discountBdt: data.discountBdt,
          message: data.message,
        });
      }
    } catch {
      setCouponError('কুপন যাচাই করা যায়নি।');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handlePaymentScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setCheckoutError('পেমেন্ট স্ক্রিনশট হিসেবে শুধুমাত্র ছবি (JPG, PNG, WEBP) নির্বাচন করুন।');
      return;
    }
    try {
      const compressed = await compressImageFileToDataUrl(file, 900, 0.82);
      setPaymentScreenshotUrl(compressed);
    } catch {
      setCheckoutError('স্ক্রিনশট প্রসেস করতে সমস্যা হয়েছে।');
    }
    e.target.value = '';
  };

  const handlePlaceGuestOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError('');

    if (!customerName.trim() || customerName.trim().length < 2) {
      setCheckoutError('অনুগ্রহ করে আপনার পূর্ণ নাম লিখুন।');
      return;
    }
    if (!isValidBdPhone(customerPhone)) {
      setCheckoutError('সঠিক ১১ ডিজিটের বাংলাদেশী মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।');
      return;
    }
    if (!addressLine.trim() || addressLine.trim().length < 5) {
      setCheckoutError('অনুগ্রহ করে বাসা/রোড/এলাকাসহ সম্পূর্ণ ডেলিভারি ঠিকানা লিখুন।');
      return;
    }
    if (paymentMethod === 'BANGLA_QR') {
      if (!paymentSenderPhone.trim() || paymentSenderPhone.trim().length < 4) {
        setCheckoutError('বাংলা কিউআর পেমেন্টের ক্ষেত্রে যে নম্বর/অ্যাকাউন্ট থেকে পেমেন্ট করেছেন তা লিখুন।');
        return;
      }
      if (!paymentTransactionId.trim() || paymentTransactionId.trim().length < 4) {
        setCheckoutError('অনুগ্রহ করে আপনার পেমেন্টের ট্রানজেকশন আইডি (TrxID) লিখুন।');
        return;
      }
    }

    setSubmittingOrder(true);
    try {
      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: checkoutIdempotencyKey,
          fullName: customerName.trim(),
          phone: normalizeBdPhone(customerPhone),
          email: customerEmail.trim(),
          district: selectedDistrict,
          upazila: selectedUpazila,
          addressLine: addressLine.trim(),
          orderNote: orderNote.trim(),
          paymentMethod,
          paymentSenderPhone: paymentMethod === 'BANGLA_QR' ? paymentSenderPhone.trim() : '',
          paymentTransactionId:
            paymentMethod === 'BANGLA_QR' ? paymentTransactionId.trim().toUpperCase() : '',
          paymentScreenshotUrl: paymentMethod === 'BANGLA_QR' ? paymentScreenshotUrl : '',
          couponCode: appliedCoupon?.code || '',
          items: cart.map((item) => ({
            productId: item.product.id,
            variantId: item.variant ? item.variant.id : null,
            quantity: item.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'অর্ডার সম্পন্ন করা যায়নি।');
      }

      setConfirmedOrderData(data);
      setCart([]);
      setAppliedCoupon(null);
      setPaymentTransactionId('');
      setPaymentScreenshotUrl('');
      setCheckoutStep('confirmed');
      await loadStorefront();
    } catch (err: any) {
      setCheckoutError(err.message || 'অর্ডার সাবমিট করতে সমস্যা হয়েছে।');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleTrackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackingError('');
    setTrackingResult(null);
    setTrackingLoading(true);
    try {
      const res = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: trackOrderNo.trim(),
          phone: trackPhone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'অর্ডার খুঁজে পাওয়া যায়নি।');
      }
      setTrackingResult(data);
    } catch (err: any) {
      setTrackingError(err.message);
    } finally {
      setTrackingLoading(false);
    }
  };

  // Render Admin Panel if route === 'admin'
  if (route === 'admin') {
    return (
      <React.Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-[#F3F5F7] text-[#14213D] font-semibold text-sm">
            অ্যাডমিন প্যানেল লোড হচ্ছে...
          </div>
        }
      >
        <AdminPanel
          onBackToStore={() => {
            window.history.pushState({}, '', '/');
            setRoute('store');
          }}
          onStoreUpdated={loadStorefront}
        />
      </React.Suspense>
    );
  }

  const heroVisual = createStudioProductSvg(
    'hoodie',
    '#14213D',
    '#286F65',
    'BOICHITRA BD · SYLHET TO NATIONWIDE'
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F5F7] text-[#172126]">
      {/* 1. TOP BAR CONTRACT: Strictly 1 row, 3 zones separated by gap-8 (Brand wordmark | 5 concise nav links | 1 primary Cart CTA) */}
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-30">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setSelectedCategoryId('ALL');
              setCollectionTab('all');
              setSearchQuery('');
            }}
            className="text-lg sm:text-xl font-bold tracking-tight text-[#14213D] whitespace-nowrap shrink-0"
          >
            Boichitra BD — বৈচিত্র্য
          </a>

          {/* Zone 2: 5 concise single-line text navigation links */}
          <nav
            aria-label="প্রধান নেভিগেশন"
            className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <a
              href="#catalog"
              onClick={() => {
                setSelectedCategoryId('ALL');
                setCollectionTab('all');
              }}
              className="hover:text-[#14213D] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              সকল পণ্য
            </a>
            <a
              href="#catalog"
              onClick={() => setCollectionTab('new')}
              className="hover:text-[#14213D] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              নতুন কালেকশন
            </a>
            <a
              href="#catalog"
              onClick={() => setCollectionTab('bestseller')}
              className="hover:text-[#14213D] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              বেস্ট সেলার
            </a>
            <a
              href="#catalog"
              onClick={() => setCollectionTab('offer')}
              className="hover:text-[#14213D] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              বিশেষ অফার
            </a>
            <button
              type="button"
              onClick={() => setShowTrackingModal(true)}
              className="hover:text-[#14213D] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              অর্ডার ট্র্যাকিং
            </button>
          </nav>

          {/* Zone 3: 1 primary action (Shopping Cart Drawer Button with live item count) */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setCheckoutStep(cart.length > 0 && checkoutStep === 'confirmed' ? 'cart' : checkoutStep);
                setIsCartOpen(true);
              }}
              aria-label="শপিং কার্ট খুলুন"
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#14213D] hover:bg-[#286F65] rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 tabular-nums"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>কার্ট ({cartItemCount})</span>
              {cartSubtotalBdt > 0 && (
                <span className="hidden sm:inline text-slate-200">
                  · {formatBdt(cartSubtotalBdt)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Toast Feedback Banner */}
      {cartNotice && (
        <div className="fixed bottom-5 right-5 z-40 bg-[#14213D] text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 text-xs sm:text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
          <span>{cartNotice}</span>
          <button
            type="button"
            onClick={() => {
              setCheckoutStep('cart');
              setIsCartOpen(true);
              setCartNotice(null);
            }}
            className="underline font-semibold text-emerald-300 ml-2 whitespace-nowrap"
          >
            কার্ট দেখুন →
          </button>
        </div>
      )}

      {/* 2. STOREFRONT SEARCH & DEPARTMENT UTILITY BAR */}
      <div className="bg-white border-b border-slate-200/70">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Department Dropdown */}
          <div className="flex items-center gap-2">
            <select
              aria-label="বিভাগ নির্বাচন করুন"
              value={selectedCategoryId}
              onChange={(e) =>
                handleSelectCategory(
                  e.target.value === 'ALL' ? 'ALL' : Number(e.target.value),
                  true
                )
              }
              className="px-3.5 py-2 text-xs sm:text-sm font-medium bg-slate-100 hover:bg-slate-200/70 text-[#14213D] rounded-lg border border-slate-200/80 focus:outline-none focus:border-[#286F65]"
            >
              <option value="ALL">সকল বিভাগ ({products.length}টি পণ্য)</option>
              {categories.map((cat) => {
                const count = cat.productCount ?? categoryProductCounts.get(cat.id) ?? 0;
                return (
                  <option key={cat.id} value={cat.id}>
                    {cat.nameBn} ({count}টি পণ্য) — {cat.name}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Large Product Search Bar */}
          <div className="relative flex-1 min-w-[240px] max-w-xl">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="পণ্য খুঁজুন: হুডি, হেডফোন, স্মার্টওয়াচ, পাঞ্জাবি, পাওয়ার ব্যাংক..."
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-[#286F65]"
            />
          </div>

          {/* Delivery Trust Info & Mobile Track Button */}
          <div className="flex items-center gap-4 text-xs text-slate-600 tabular-nums">
            <span className="hidden md:inline">
              ঢাকার ভিতরে ডেলিভারি <strong>{formatBdt(settings?.sylhetDeliveryBdt ?? 60)}</strong> · ঢাকার বাইরে{' '}
              <strong>{formatBdt(settings?.outsideSylhetDeliveryBdt ?? 120)}</strong>
            </span>
            <button
              type="button"
              onClick={() => setShowTrackingModal(true)}
              className="lg:hidden px-3 py-1.5 bg-slate-100 rounded-lg font-medium text-[#14213D] whitespace-nowrap"
            >
              অর্ডার ট্র্যাক করুন
            </button>
          </div>
        </div>
      </div>

      <main id="top" className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-12">
        {/* 3. XSTORE-INSPIRED SPLIT HERO SHOWCASE */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Primary Hero Campaign Card (7 columns on desktop) */}
          <div className="lg:col-span-7 bg-[#14213D] text-white rounded-2xl p-6 sm:p-10 flex flex-col justify-between relative overflow-hidden">
            <div className="space-y-4 max-w-xl z-10">
              <div className="text-xs font-semibold tracking-wider text-emerald-300">
                Fashion, Gadget &amp; Everything · সিলেট থেকে সারাদেশে
              </div>

              <h1
                className="font-bold tracking-tight leading-tight text-white"
                style={{ fontSize: 'clamp(1.85rem, 3.2vw, 2.85rem)', textWrap: 'balance' }}
              >
                সবকিছু এক জায়গায়, আপনার পছন্দমতো!
              </h1>

              <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                বৈচিত্র্য মানে সবকিছু এক জায়গায়! শীতের হুডি থেকে গরমের স্মার্ট গ্যাজেট, ট্রেন্ডি সব প্রোডাক্ট পাবে সিলেট থেকে সারাদেশে।
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <a
                  href="#catalog"
                  className="px-5 py-3 bg-[#16A34A] hover:bg-[#286F65] text-white text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <span>এখনই শপিং করুন (Shop Now)</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setCollectionTab('offer');
                    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  বিশেষ অফার দেখুন
                </button>
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-white/15 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-300 z-10 tabular-nums">
              <span>অ্যাকাউন্ট ছাড়াই সরাসরি অর্ডার (Guest Checkout)</span>
              <span aria-hidden="true">·</span>
              <span>ক্যাশ অন ডেলিভারি সুবিধা</span>
              <span aria-hidden="true">·</span>
              <span>
                {formatBdt(settings?.freeDeliveryThresholdBdt ?? 3000)}+ অর্ডারে ফ্রি ডেলিভারি
              </span>
            </div>
          </div>

          {/* Secondary Promotional Split Column (5 columns on desktop) */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 flex items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="text-xs font-medium text-[#286F65]">Discover Your Style</div>
                <h2 className="text-lg font-bold text-[#14213D]">
                  শীতের হুডি ও ফেস্টিভ পাঞ্জাবি কালেকশন
                </h2>
                <p className="text-xs text-slate-600">
                  ৩৪০ জিএসএম হেভিওয়েট ফ্লিস হুডি ও প্রিমিয়াম সুতি পাঞ্জাবি।
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const fashionCat = categories.find(
                      (c) =>
                        c.slug.includes('fashion') ||
                        c.name.toLowerCase().includes('fashion')
                    );
                    if (fashionCat) {
                      handleSelectCategory(fashionCat.id, true);
                    } else {
                      setSelectedCategoryId('ALL');
                      setCollectionTab('seasonal');
                      document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="text-xs font-semibold text-[#14213D] hover:text-[#286F65] inline-flex items-center gap-1 pt-1"
                >
                  <span>ফ্যাশন কালেকশন দেখুন</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="w-28 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                <img
                  src={heroVisual}
                  alt="Winter Hoodie Showcase"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 flex items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="text-xs font-medium text-[#286F65]">
                  Smart Gadgets for Everyday Life
                </div>
                <h2 className="text-lg font-bold text-[#14213D]">
                  এএনসি হেডফোন, স্মার্টওয়াচ ও পাওয়ার ব্যাংক
                </h2>
                <p className="text-xs text-slate-600 tabular-nums">
                  কুপন কোড <strong className="font-mono text-[#14213D]">SYLHET100</strong> ব্যবহারে ৳১০০ ছাড়!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const gadgetCat = categories.find(
                      (c) =>
                        c.slug === 'smart-gadgets' ||
                        c.slug.includes('gadget') ||
                        c.slug.includes('power') ||
                        c.slug.includes('audio')
                    );
                    if (gadgetCat) {
                      handleSelectCategory(gadgetCat.id, true);
                    } else {
                      handleSelectCategory('ALL', true);
                    }
                  }}
                  className="text-xs font-semibold text-[#14213D] hover:text-[#286F65] inline-flex items-center gap-1 pt-1"
                >
                  <span>গ্যাজেট কালেকশন দেখুন</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="w-28 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                <img
                  src={createStudioProductSvg('headphones', '#14213D', '#286F65', 'ANC AUDIO')}
                  alt="Smart Gadgets Showcase"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Department / Category Shortcuts */}
        <section aria-label="বিভাগ সমূহ">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-[#14213D]">
              পছন্দের বিভাগ থেকে বেছে নিন (Departments)
            </h2>
            {selectedCategoryId !== 'ALL' && (
              <button
                type="button"
                onClick={() => handleSelectCategory('ALL', false)}
                className="text-xs font-semibold text-[#286F65] hover:underline"
              >
                সকল বিভাগ দেখান ({products.length}টি পণ্য)
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              const count = cat.productCount ?? categoryProductCounts.get(cat.id) ?? 0;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() =>
                    handleSelectCategory(isSelected ? 'ALL' : cat.id, true)
                  }
                  className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between gap-1.5 ${
                    isSelected
                      ? 'bg-[#14213D] text-white border-[#14213D] shadow-sm'
                      : 'bg-white text-[#172126] border-slate-200/90 hover:border-[#286F65]'
                  }`}
                >
                  <div>
                    <div className="text-sm font-bold truncate">{cat.nameBn}</div>
                    <div
                      className={`text-xs truncate mt-0.5 ${
                        isSelected ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {cat.name}
                    </div>
                  </div>
                  <div
                    className={`text-[11px] font-semibold tabular-nums ${
                      isSelected ? 'text-emerald-300' : 'text-[#286F65]'
                    }`}
                  >
                    {count}টি পণ্য →
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3B. UPGRADED SPECIAL OFFER & FLASH DEAL SPOTLIGHT SECTION */}
        {specialOfferProducts.length > 0 && (
          <section
            aria-label="বিশেষ অফার ও ফ্ল্যাশ ডিল"
            className="bg-white rounded-2xl border border-[#286F65]/35 p-5 sm:p-6 space-y-5 shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#16A34A]">
                  <Sparkles className="w-4 h-4" />
                  <span>বিশেষ অফার ও ফ্ল্যাশ ডিল (Special Offers &amp; Flash Deals)</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-[#14213D]">
                  সীমিত সময়ের ধামাকা ডিসকাউন্ট ও প্রমো কুপন অফার
                </h2>
              </div>

              {/* Live Countdown Timer & Active Promo Coupons */}
              <div className="flex flex-wrap items-center gap-3 tabular-nums">
                {(() => {
                  const firstOfferMeta = parseProductGalleryAndOffer(
                    specialOfferProducts[0]
                  ).offerMeta;
                  const targetMs = firstOfferMeta.offerEndsAt
                    ? new Date(firstOfferMeta.offerEndsAt).getTime()
                    : countdownNow + 3 * 24 * 3600 * 1000;
                  const diffSec = Math.max(0, Math.floor((targetMs - countdownNow) / 1000));
                  const days = Math.floor(diffSec / 86400);
                  const hours = Math.floor((diffSec % 86400) / 3600);
                  const mins = Math.floor((diffSec % 3600) / 60);
                  const secs = diffSec % 60;

                  return (
                    <div className="flex items-center gap-2 bg-[#14213D] text-white px-3.5 py-2 rounded-xl text-xs">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-slate-300">অফার শেষ হতে বাকি:</span>
                      <span className="font-mono font-bold text-white">
                        {days}দিন : {String(hours).padStart(2, '0')}ঘ :{' '}
                        {String(mins).padStart(2, '0')}মি : {String(secs).padStart(2, '0')}সে
                      </span>
                    </div>
                  );
                })()}

                {coupons.slice(0, 2).map((cp) => (
                  <button
                    key={cp.id}
                    type="button"
                    onClick={() => handleCopyCoupon(cp.code)}
                    className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs flex items-center gap-2 transition-colors"
                  >
                    <Tag className="w-3.5 h-3.5 text-[#16A34A]" />
                    <span className="text-slate-700">
                      কুপন: <strong className="font-mono text-[#14213D]">{cp.code}</strong>
                    </span>
                    <span className="text-[11px] font-semibold text-[#286F65] inline-flex items-center gap-1">
                      <Copy className="w-3 h-3" />
                      <span>{copiedCouponCode === cp.code ? 'কপি হয়েছে!' : 'কপি করুন'}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 tabular-nums">
              {specialOfferProducts.slice(0, 3).map((offerProd) => {
                const parsed = parseProductGalleryAndOffer(offerProd);
                const effPrice =
                  offerProd.salePriceBdt && offerProd.salePriceBdt < offerProd.priceBdt
                    ? offerProd.salePriceBdt
                    : offerProd.priceBdt;
                const savedBdt = Math.max(0, offerProd.priceBdt - effPrice);
                const savePct =
                  savedBdt > 0
                    ? Math.round((savedBdt / offerProd.priceBdt) * 100)
                    : 0;
                const stockBarPct = Math.min(
                  92,
                  Math.max(25, 100 - offerProd.stockQuantity)
                );

                return (
                  <div
                    key={offerProd.id}
                    className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 flex flex-col justify-between gap-3 hover:border-[#286F65] transition-colors"
                  >
                    <div className="flex gap-3.5">
                      <div
                        onClick={() => openProductDetail(offerProd)}
                        className="relative w-28 h-24 rounded-lg overflow-hidden bg-white border border-slate-200 shrink-0 cursor-pointer"
                      >
                        <ResilientProductImage
                          src={offerProd.imageUrl}
                          alt={offerProd.nameBn}
                          sku={offerProd.sku}
                        />
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[#14213D] text-white text-[10px] font-bold">
                          {parsed.offerMeta.badgeText || '🔥 ফ্ল্যাশ ডিল'}
                        </span>
                        {parsed.videoCount > 0 && (
                          <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[#16A34A] text-white text-[9px] font-bold inline-flex items-center gap-0.5">
                            <Play className="w-2.5 h-2.5 fill-current" /> ভিডিও
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5">
                          {savePct > 0 && (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-[#16A34A] text-[10px] font-bold">
                              {savePct}% ছাড় · সাশ্রয় {formatBdt(savedBdt)}
                            </span>
                          )}
                        </div>
                        <h3
                          onClick={() => openProductDetail(offerProd)}
                          className="text-sm font-bold text-[#14213D] hover:text-[#286F65] cursor-pointer line-clamp-1"
                        >
                          {offerProd.nameBn}
                        </h3>
                        <div className="flex items-baseline gap-2">
                          <span className="text-base font-bold text-[#14213D]">
                            {formatBdt(effPrice)}
                          </span>
                          {savedBdt > 0 && (
                            <span className="text-xs text-slate-400 line-through">
                              {formatBdt(offerProd.priceBdt)}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#286F65] font-medium line-clamp-1">
                          {parsed.offerMeta.dealNote ||
                            'সীমিত সময়ের বিশেষ অফার · ক্যাশ অন ডেলিভারি'}
                        </p>
                      </div>
                    </div>

                    {/* Stock Progress Bar & Actions */}
                    <div className="space-y-2.5 pt-2 border-t border-slate-200/70">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-600">
                          <span>অফার স্টক বাকি: <strong>{offerProd.stockQuantity} টি</strong></span>
                          <span className="text-[#286F65] font-semibold">
                            {parsed.imageCount}টি ছবি
                            {parsed.videoCount > 0 ? ` · ${parsed.videoCount}টি ভিডিও` : ''}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#286F65] rounded-full"
                            style={{ width: `${stockBarPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openProductDetail(offerProd)}
                          className="flex-1 py-2 px-3 bg-white border border-slate-300 hover:border-[#14213D] text-[#14213D] text-xs font-semibold rounded-lg transition-colors"
                        >
                          ছবি ও বিস্তারিত দেখুন
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (offerProd.variants.length > 0) {
                              openProductDetail(offerProd);
                            } else {
                              addToCart(offerProd, null, 1, false);
                            }
                          }}
                          className="flex-1 py-2 px-3 bg-[#14213D] hover:bg-[#286F65] text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          অফারটি কার্টে নিন
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 4. MAIN PRODUCT CATALOG SECTION */}
        <section id="catalog" className="space-y-6">
          {/* Interactive Collection Filter Tabs & Sorting Bar */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 flex flex-wrap items-center justify-between gap-4">
            {/* Functional Filter Buttons (Allowed per Zero-Pill Rule) */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg overflow-x-auto">
              {[
                { id: 'all', label: 'সকল পণ্য (All)' },
                { id: 'featured', label: 'ফিচার্ড (Featured)' },
                { id: 'new', label: 'নতুন আগমন (New Arrivals)' },
                { id: 'bestseller', label: 'বেস্ট সেলার (Best Sellers)' },
                { id: 'offer', label: 'বিশেষ অফার (Special Offers)' },
                { id: 'seasonal', label: 'সিজনাল (Seasonal)' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCollectionTab(tab.id as any)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    collectionTab === tab.id
                      ? 'bg-white text-[#14213D] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Price Filter & Sort Controls */}
            <div className="flex flex-wrap items-center gap-4 text-xs tabular-nums">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <label htmlFor="priceRange" className="text-slate-600 font-medium whitespace-nowrap">
                  সর্বোচ্চ মূল্য: <strong>{formatBdt(maxPriceFilter)}</strong>
                </label>
                <input
                  id="priceRange"
                  type="range"
                  min={500}
                  max={15000}
                  step={100}
                  value={maxPriceFilter}
                  onChange={(e) => setMaxPriceFilter(Number(e.target.value))}
                  className="w-24 accent-[#286F65]"
                />
              </div>

              <select
                aria-label="পণ্য সাজান"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium"
              >
                <option value="newest">সাজান: নতুন পণ্য আগে</option>
                <option value="price-asc">মূল্য: কম থেকে বেশি</option>
                <option value="price-desc">মূল্য: বেশি থেকে কম</option>
              </select>
            </div>
          </div>

          {/* Loading / Error / Product Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="bg-white rounded-xl border border-slate-200/70 h-80 animate-pulse p-4 flex flex-col justify-between"
                >
                  <div className="bg-slate-200 h-48 rounded-lg" />
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="bg-white rounded-xl border border-red-200 p-8 text-center space-y-3">
              <p className="text-sm font-semibold text-red-700">{loadError}</p>
              <button
                type="button"
                onClick={loadStorefront}
                className="px-4 py-2 bg-[#14213D] text-white text-xs font-semibold rounded-lg"
              >
                আবার চেষ্টা করুন
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center space-y-3">
              <p className="text-base font-semibold text-[#14213D]">
                আপনার অনুসন্ধানের সাথে মিলে এমন কোনো পণ্য পাওয়া যায়নি।
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId('ALL');
                  setCollectionTab('all');
                  setSearchQuery('');
                  setMaxPriceFilter(15000);
                }}
                className="px-4 py-2 bg-[#14213D] text-white text-xs font-semibold rounded-lg"
              >
                সকল ফিল্টার রিসেট করুন
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={(prod, chosenVar) => openProductDetail(prod, chosenVar)}
                    onSelectCategory={(catId) => handleSelectCategory(catId, true)}
                    onQuickAdd={(prod, chosenVar) => {
                      const variantToUse =
                        chosenVar !== undefined
                          ? chosenVar
                          : prod.variants.length > 0
                          ? prod.variants[0]
                          : null;
                      addToCart(prod, variantToUse, 1, false);
                    }}
                  />
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-200/80 text-xs tabular-nums">
                  <div className="text-slate-600">
                    মোট <strong>{filteredProducts.length}</strong> টি পণ্যের মধ্যে পৃষ্ঠা{' '}
                    <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium disabled:opacity-40 inline-flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>পূর্ববর্তী</span>
                    </button>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium disabled:opacity-40 inline-flex items-center gap-1"
                    >
                      <span>পরবর্তী</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* 5. WHY SHOP WITH BOICHITRA BD (Trust & Service Commitments) */}
        <section className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8">
          <div className="max-w-2xl mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-[#14213D]">
              কেন Boichitra BD — বৈচিত্র্য থেকে কেনাকাটা করবেন?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              সিলেট থেকে পরিচালিত বিশ্বস্ত মাল্টি-ক্যাটাগরি অনলাইন শপিং প্ল্যাটফর্ম।
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-lg bg-slate-100 text-[#14213D] flex items-center justify-center">
                <Truck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#14213D]">
                ঢাকার ভিতরে ও সারাদেশে হোম ডেলিভারি
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed tabular-nums">
                ঢাকার ভিতরে মাত্র {formatBdt(settings?.sylhetDeliveryBdt ?? 60)} এবং ঢাকার বাইরে সারাদেশে{' '}
                {formatBdt(settings?.outsideSylhetDeliveryBdt ?? 120)} ডেলিভারি চার্জ।{' '}
                {formatBdt(settings?.freeDeliveryThresholdBdt ?? 3000)}+ টাকার অর্ডারে ডেলিভারি চার্জ সম্পূর্ণ ফ্রি।
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-9 h-9 rounded-lg bg-slate-100 text-[#286F65] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#14213D]">
                অ্যাকাউন্ট ছাড়াই সহজ অর্ডার ও ক্যাশ অন ডেলিভারি
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                কোনো রেজিস্ট্রেশন বা পাসওয়ার্ডের ঝামেলা ছাড়াই নাম, মোবাইল নম্বর ও ঠিকানা দিয়ে অর্ডার করুন এবং পণ্য হাতে পেয়ে মূল্য পরিশোধ করুন।
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-9 h-9 rounded-lg bg-slate-100 text-[#14213D] flex items-center justify-center">
                <RefreshCw className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#14213D]">
                সহজ রিটার্ন ও কোয়ালিটি নিশ্চয়তা
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {settings?.returnPolicyText ||
                  'ডেলিভারি পাওয়ার পর পণ্যটি ডেলিভারি ম্যানের সামনে চেক করে নিন। ত্রুটিপূর্ণ বা ভুল পণ্য পেলে তাৎক্ষণিক রিটার্ন সুবিধা।'}
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* 6. FOOTER */}
      <footer className="bg-[#14213D] text-slate-300 mt-12 border-t border-slate-800">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-4 gap-8 text-xs">
          <div className="md:col-span-2 space-y-3">
            <div className="text-lg font-bold text-white">Boichitra BD — বৈচিত্র্য</div>
            <div className="text-emerald-300 font-medium">Fashion, Gadget &amp; Everything</div>
            <p className="text-slate-300 leading-relaxed max-w-md">
              "বৈচিত্র্য মানে সবকিছু এক জায়গায়! শীতের হুডি থেকে গরমের স্মার্ট গ্যাজেট, ট্রেন্ডি সব প্রোডাক্ট পাবে সিলেট থেকে সারাদেশে।"
            </p>
            <div className="pt-2 space-y-1 text-slate-400">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{settings?.businessAddress || 'Sylhet, Bangladesh (সিলেট, বাংলাদেশ)'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>হেল্পলাইন: {settings?.contactPhone}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="text-sm font-bold text-white">দ্রুত লিংক (Quick Links)</div>
            <ul className="space-y-2">
              <li>
                <a
                  href="#catalog"
                  onClick={() => setCollectionTab('all')}
                  className="hover:text-white transition-colors"
                >
                  সকল পণ্য (Shop All)
                </a>
              </li>
              <li>
                <a
                  href="#catalog"
                  onClick={() => setCollectionTab('new')}
                  className="hover:text-white transition-colors"
                >
                  নতুন কালেকশন (New Arrivals)
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setShowTrackingModal(true)}
                  className="hover:text-white transition-colors"
                >
                  অর্ডার ট্র্যাকিং (Track Order)
                </button>
              </li>
              <li>
                <a
                  href="/sitemap.xml"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  XML Sitemap
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <div className="text-sm font-bold text-white">নীতিমালা ও ব্যবস্থাপনা</div>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => setPolicyModal('return')}
                  className="hover:text-white transition-colors"
                >
                  রিটার্ন ও রিফান্ড পলিসি
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setPolicyModal('privacy')}
                  className="hover:text-white transition-colors"
                >
                  প্রাইভেসি ও কাস্টমার ডেটা নীতিমালা
                </button>
              </li>
              <li className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    window.history.pushState({}, '', '/admin');
                    setRoute('admin');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>অ্যাডমিন পোর্টাল (Admin Login)</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 py-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Boichitra BD — বৈচিত্র্য। সর্বস্বত্ব সংরক্ষিত · Sylhet, Bangladesh.
        </div>
      </footer>

      {/* =====================================================================
          MODAL A: PRODUCT DETAILS VIEW (CONTIGUOUS PURCHASE MODULE + JSON-LD)
         ===================================================================== */}
      {activeProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activeProduct.nameBn}
          className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4 overflow-y-auto"
        >
          {/* Dynamic Product Schema.org Structured Data */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Product',
                name: activeProduct.nameBn,
                alternateName: activeProduct.name,
                sku: activeProduct.sku,
                description: activeProduct.descriptionBn,
                offers: {
                  '@type': 'Offer',
                  priceCurrency: 'BDT',
                  price:
                    activeProduct.salePriceBdt &&
                    activeProduct.salePriceBdt < activeProduct.priceBdt
                      ? activeProduct.salePriceBdt
                      : activeProduct.priceBdt,
                  availability:
                    activeProduct.stockQuantity > 0
                      ? 'https://schema.org/InStock'
                      : 'https://schema.org/OutOfStock',
                },
              }),
            }}
          />

          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto relative">
            <button
              type="button"
              onClick={closeProductDetail}
              aria-label="বন্ধ করুন"
              className="absolute top-4 right-4 p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {/* Left: Multi-Image & Video Product Gallery */}
              {(() => {
                const parsedGallery = parseProductGalleryAndOffer(activeProduct);
                const mediaItems = parsedGallery.allMediaWithPrimary;
                const safeIdx =
                  activeMediaIdx >= 0 && activeMediaIdx < mediaItems.length
                    ? activeMediaIdx
                    : 0;
                const currentMedia = mediaItems[safeIdx] || {
                  id: 'fallback',
                  url: activeProduct.imageUrl,
                  type: 'image' as const,
                };

                return (
                  <div className="space-y-3">
                    {/* Main Stage (Image or Video Player) */}
                    <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-slate-900 border border-slate-200/80 flex items-center justify-center">
                      {currentMedia.type === 'video' ? (
                        (() => {
                          const vInfo = getEmbedVideoInfo(currentMedia.url);
                          if (vInfo.kind === 'youtube' || vInfo.kind === 'facebook') {
                            return (
                              <iframe
                                src={vInfo.src}
                                title={currentMedia.title || activeProduct.nameBn}
                                className="w-full h-full border-0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            );
                          }
                          return (
                            <video
                              src={vInfo.src}
                              controls
                              playsInline
                              className="w-full h-full object-contain bg-black"
                            />
                          );
                        })()
                      ) : (
                        <div className="w-full h-full bg-slate-100">
                          <ResilientProductImage
                            src={currentMedia.url}
                            alt={currentMedia.title || activeProduct.nameBn}
                            sku={activeProduct.sku}
                          />
                        </div>
                      )}

                      {/* Previous / Next Navigation Arrows when multiple media items exist */}
                      {mediaItems.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveMediaIdx(
                                (safeIdx - 1 + mediaItems.length) % mediaItems.length
                              )
                            }
                            aria-label="পূর্ববর্তী ছবি বা ভিডিও"
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/90 hover:bg-white text-[#14213D] shadow-md"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveMediaIdx((safeIdx + 1) % mediaItems.length)
                            }
                            aria-label="পরবর্তী ছবি বা ভিডিও"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/90 hover:bg-white text-[#14213D] shadow-md"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-black/70 text-white text-[11px] font-mono tabular-nums">
                            {safeIdx + 1} / {mediaItems.length}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Thumbnail Strip for All Photos & Videos */}
                    {mediaItems.length > 1 && (
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {mediaItems.map((m, idx) => (
                          <button
                            key={m.id || idx}
                            type="button"
                            onClick={() => setActiveMediaIdx(idx)}
                            className={`relative w-16 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                              safeIdx === idx
                                ? 'border-[#286F65] ring-2 ring-[#286F65]/30'
                                : 'border-slate-200 opacity-75 hover:opacity-100'
                            }`}
                          >
                            {m.type === 'video' ? (
                              <div className="w-full h-full bg-[#14213D] text-white flex flex-col items-center justify-center">
                                <Play className="w-4 h-4 fill-emerald-400 text-emerald-400" />
                                <span className="text-[9px] font-bold mt-0.5">ভিডিও</span>
                              </div>
                            ) : (
                              <ResilientProductImage
                                src={m.url}
                                alt={m.title || activeProduct.nameBn}
                                sku={activeProduct.sku}
                              />
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1.5 tabular-nums">
                      <div className="font-semibold text-[#14213D]">ডেলিভারি ও পেমেন্ট তথ্য:</div>
                      <div>
                        · ঢাকার ভিতরে ডেলিভারি চার্জ {formatBdt(settings?.sylhetDeliveryBdt ?? 60)}, ঢাকার বাইরে{' '}
                        {formatBdt(settings?.outsideSylhetDeliveryBdt ?? 120)}
                      </div>
                      <div>· ক্যাশ অন ডেলিভারি অথবা বাংলা কিউআর (Bangla QR) পেমেন্ট</div>
                      {getBanglaQrDiscountBadgeText(settings) && (
                        <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-300 text-[#006A4E] text-xs sm:text-sm font-extrabold flex items-center gap-2">
                          <QrCode className="w-4 h-4 shrink-0 text-[#006A4E]" />
                          <span>🎁 {getBanglaQrDiscountBadgeText(settings)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Right: Contiguous Purchase Module */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {activeProduct.isSpecialOffer && (
                    <span className="px-2 py-0.5 rounded bg-[#14213D] text-white font-bold text-[11px]">
                      {parseProductGalleryAndOffer(activeProduct).offerMeta.badgeText ||
                        '🔥 বিশেষ অফার'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const catId = activeProduct.categoryId;
                      closeProductDetail();
                      handleSelectCategory(catId, true);
                    }}
                    className="font-semibold text-[#286F65] hover:text-[#14213D] hover:underline"
                  >
                    {activeProduct.categoryNameBn || activeProduct.categoryName}
                  </button>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">SKU: {activeProduct.sku}</span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={
                      activeProduct.stockQuantity > 0
                        ? 'text-[#16A34A] font-semibold'
                        : 'text-red-600 font-semibold'
                    }
                  >
                    {activeProduct.stockQuantity > 0
                      ? `স্টকে আছে (${activeProduct.stockQuantity} টি)`
                      : 'স্টক শেষ'}
                  </span>
                </div>

                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#14213D]">
                    {activeProduct.nameBn}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    {activeProduct.name}
                  </p>
                </div>

                {/* Price Calculation & Prominent Bangla QR Instant Discount Callout */}
                <div className="space-y-2.5 pt-1 tabular-nums">
                  {(() => {
                    const base =
                      activeProduct.salePriceBdt &&
                      activeProduct.salePriceBdt < activeProduct.priceBdt
                        ? activeProduct.salePriceBdt
                        : activeProduct.priceBdt;
                    const adj = selectedVariant ? selectedVariant.priceAdjustmentBdt : 0;
                    const currentPrice = base + adj;
                    const originalPrice = activeProduct.priceBdt + adj;
                    const savedBdt = Math.max(0, originalPrice - currentPrice);
                    const savePct =
                      savedBdt > 0 ? Math.round((savedBdt / originalPrice) * 100) : 0;
                    const pdpQrSavingsBdt = calculateBanglaQrDiscountBdt(
                      currentPrice * pdpQuantity,
                      settings
                    );
                    return (
                      <>
                        <div className="flex flex-wrap items-baseline gap-3">
                          <span className="text-2xl font-bold text-[#14213D]">
                            {formatBdt(currentPrice)}
                          </span>
                          {savedBdt > 0 && (
                            <>
                              <span className="text-sm text-slate-400 line-through">
                                {formatBdt(originalPrice)}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-xs font-bold text-[#16A34A]">
                                সাশ্রয় {formatBdt(savedBdt)} ({savePct}% ছাড়)
                              </span>
                            </>
                          )}
                        </div>

                        {settings?.banglaQrEnabled !== false && pdpQrSavingsBdt > 0 && (
                          <div className="p-3 rounded-xl bg-emerald-50 border-2 border-[#006A4E]/35 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 rounded-lg bg-[#006A4E] text-white shrink-0">
                                <QrCode className="w-4 h-4" />
                              </span>
                              <div>
                                <div className="text-xs sm:text-sm font-extrabold text-[#006A4E]">
                                  বাংলা কিউআর পেমেন্টে আরও {formatBdt(pdpQrSavingsBdt)} ছাড়!
                                </div>
                                <div className="text-[11px] font-medium text-emerald-900">
                                  {getBanglaQrDiscountBadgeText(settings)}
                                </div>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-lg bg-[#16A34A] text-white text-xs sm:text-sm font-extrabold shrink-0">
                              -{formatBdt(pdpQrSavingsBdt)} সাশ্রয়
                            </span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {activeProduct.isSpecialOffer && (
                  <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs space-y-1">
                    <div className="font-semibold text-[#14213D]">
                      ★{' '}
                      {parseProductGalleryAndOffer(activeProduct).offerMeta.dealNote ||
                        'সীমিত সময়ের বিশেষ অফার · ক্যাশ অন ডেলিভারি সুবিধা'}
                    </div>
                    {parseProductGalleryAndOffer(activeProduct).offerMeta
                      .promoCouponCode && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-600">
                          অতিরিক্ত ছাড় পেতে কুপন ব্যবহার করুন:{' '}
                          <strong className="font-mono text-[#14213D]">
                            {
                              parseProductGalleryAndOffer(activeProduct).offerMeta
                                .promoCouponCode
                            }
                          </strong>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyCoupon(
                              parseProductGalleryAndOffer(activeProduct).offerMeta
                                .promoCouponCode!
                            )
                          }
                          className="text-[#286F65] font-bold hover:underline"
                        >
                          কপি করুন
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {activeProduct.descriptionBn}
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {activeProduct.description}
                </p>

                {/* Separate Color (কালার) & Size (সাইজ) Selection */}
                {activeProduct.variants.length > 0 && (() => {
                  const { colors, sizes } = extractDistinctColorsAndSizes(
                    activeProduct.variants
                  );
                  const activeColor = selectedVariant?.color || colors[0] || '';
                  const activeSize = selectedVariant?.size || sizes[0] || '';

                  return (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3.5 mt-2">
                      {/* 1. Separate Color Selection */}
                      {colors.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-[#14213D]">
                              ১. কালার নির্বাচন করুন (Select Color):
                            </span>
                            <span className="font-semibold text-[#286F65]">
                              {activeColor}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {colors.map((col) => {
                              const isSelectedCol = activeColor === col;
                              const swatchHex = getColorSwatchHex(col);
                              const hasStockInCol = activeProduct.variants.some(
                                (v) => (v.color || '').trim() === col && v.stockQuantity > 0
                              );
                              return (
                                <button
                                  key={col}
                                  type="button"
                                  disabled={!hasStockInCol}
                                  onClick={() => {
                                    const matched = findBestMatchingVariant(
                                      activeProduct.variants,
                                      col,
                                      activeSize,
                                      true
                                    );
                                    if (matched) setSelectedVariant(matched);
                                  }}
                                  className={`px-3 py-2 rounded-lg text-xs font-semibold border inline-flex items-center gap-2 transition-all ${
                                    !hasStockInCol
                                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                                      : isSelectedCol
                                      ? 'bg-[#14213D] text-white border-[#14213D] ring-2 ring-[#14213D]/20'
                                      : 'bg-white text-slate-800 border-slate-300 hover:border-[#286F65]'
                                  }`}
                                >
                                  <span
                                    className="w-3.5 h-3.5 rounded-full border border-white/70 shadow-2xs shrink-0"
                                    style={{ backgroundColor: swatchHex }}
                                  />
                                  <span>{col}</span>
                                  {isSelectedCol && (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 2. Separate Size Selection */}
                      {sizes.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-[#14213D]">
                              {colors.length > 0
                                ? '২. সাইজ নির্বাচন করুন (Select Size):'
                                : 'সাইজ নির্বাচন করুন (Select Size):'}
                            </span>
                            <span className="font-semibold text-[#286F65]">
                              {activeSize}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {sizes.map((sz) => {
                              const isSelectedSz = activeSize === sz;
                              const exactCombo = activeProduct.variants.find(
                                (v) =>
                                  (v.color || '').trim() === activeColor &&
                                  (v.size || '').trim() === sz
                              );
                              const anySizeStock = activeProduct.variants.some(
                                (v) => (v.size || '').trim() === sz && v.stockQuantity > 0
                              );
                              const isExactAvailable = exactCombo
                                ? exactCombo.stockQuantity > 0
                                : false;

                              return (
                                <button
                                  key={sz}
                                  type="button"
                                  disabled={!anySizeStock}
                                  onClick={() => {
                                    const matched = findBestMatchingVariant(
                                      activeProduct.variants,
                                      activeColor,
                                      sz,
                                      false
                                    );
                                    if (matched) setSelectedVariant(matched);
                                  }}
                                  className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-all tabular-nums ${
                                    !anySizeStock
                                      ? 'bg-slate-100 text-slate-400 border-slate-200 line-through cursor-not-allowed'
                                      : isSelectedSz
                                      ? 'bg-[#286F65] text-white border-[#286F65] ring-2 ring-[#286F65]/25'
                                      : isExactAvailable
                                      ? 'bg-white text-[#14213D] border-slate-300 hover:border-[#286F65]'
                                      : 'bg-slate-100 text-slate-600 border-dashed border-slate-300 hover:border-[#286F65]'
                                  }`}
                                >
                                  <span>{sz}</span>
                                  {exactCombo && exactCombo.priceAdjustmentBdt !== 0 && (
                                    <span className="ml-1 text-[10px] opacity-90">
                                      ({exactCombo.priceAdjustmentBdt > 0 ? '+' : ''}৳
                                      {exactCombo.priceAdjustmentBdt})
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Selected Variant Summary & Size Guide Note */}
                      {selectedVariant && (
                        <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 tabular-nums">
                          <div>
                            নির্বাচিত:{' '}
                            <strong className="text-[#14213D]">
                              {[
                                selectedVariant.color ? `কালার: ${selectedVariant.color}` : '',
                                selectedVariant.size ? `সাইজ: ${selectedVariant.size}` : '',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </strong>
                          </div>
                          <div>
                            স্টক উপলব্ধ:{' '}
                            <strong className="text-[#16A34A]">
                              {selectedVariant.stockQuantity} টি
                            </strong>{' '}
                            <span className="font-mono text-slate-400">
                              ({selectedVariant.sku})
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Quantity Selector & Primary Buy CTAs */}
                <div className="pt-3 space-y-3">
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-semibold text-slate-700">পরিমাণ:</span>
                    <div className="inline-flex items-center border border-slate-300 rounded-lg tabular-nums">
                      <button
                        type="button"
                        onClick={() => setPdpQuantity((q) => Math.max(1, q - 1))}
                        className="p-2 hover:bg-slate-100"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-4 text-sm font-bold">{pdpQuantity}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const max = selectedVariant
                            ? selectedVariant.stockQuantity
                            : activeProduct.stockQuantity;
                          setPdpQuantity((q) => Math.min(max, q + 1));
                        }}
                        className="p-2 hover:bg-slate-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      disabled={activeProduct.stockQuantity <= 0}
                      onClick={() => {
                        addToCart(activeProduct, selectedVariant, pdpQuantity, false);
                        closeProductDetail();
                      }}
                      className="py-3 px-4 rounded-xl border border-[#14213D] text-[#14213D] hover:bg-slate-100 font-semibold text-sm transition-colors"
                    >
                      কার্টে যোগ করুন (Add to Cart)
                    </button>

                    <button
                      type="button"
                      disabled={activeProduct.stockQuantity <= 0}
                      onClick={() =>
                        addToCart(activeProduct, selectedVariant, pdpQuantity, true)
                      }
                      className="py-3 px-4 rounded-xl bg-[#14213D] hover:bg-[#286F65] text-white font-semibold text-sm transition-colors"
                    >
                      এখনই অর্ডার করুন (Buy Now)
                    </button>
                  </div>

                  {/* Direct Product Promotion & Share Link Box */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2 mt-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#14213D]">
                        🔗 প্রমোশন ও শেয়ার লিংক (Facebook Ads / Share Link):
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyProductLink(activeProduct, false)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                            copiedPdpLinkType === 'product'
                              ? 'bg-[#16A34A] text-white'
                              : 'bg-[#14213D] hover:bg-[#286F65] text-white'
                          }`}
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>
                            {copiedPdpLinkType === 'product'
                              ? '✓ পণ্যের লিংক কপি হয়েছে!'
                              : 'পণ্যের লিংক কপি করুন'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyProductLink(activeProduct, true)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                            copiedPdpLinkType === 'checkout'
                              ? 'bg-[#16A34A] text-white'
                              : 'bg-[#286F65] hover:bg-[#14213D] text-white'
                          }`}
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>
                            {copiedPdpLinkType === 'checkout'
                              ? '✓ ডিরেক্ট চেকআউট লিংক কপি!'
                              : 'ডিরেক্ট অর্ডার অ্যাড লিংক'}
                          </span>
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      readOnly
                      value={buildProductPromoUrl(activeProduct)}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-[11px] text-slate-600 select-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL B: SLIDE-OVER SHOPPING CART & MANDATORY GUEST CHECKOUT DRAWER
         ===================================================================== */}
      {isCartOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="শপিং কার্ট ও গেস্ট চেকআউট"
          className="fixed inset-0 z-50 bg-black/50 flex justify-end"
        >
          <div className="bg-white w-full max-w-lg h-full flex flex-col justify-between shadow-2xl overflow-hidden">
            {/* Drawer Header */}
            <div className="px-6 py-4 bg-[#14213D] text-white flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">
                  {checkoutStep === 'cart'
                    ? `আপনার শপিং কার্ট (${cartItemCount})`
                    : checkoutStep === 'checkout'
                    ? 'গেস্ট চেকআউট (অ্যাকাউন্ট ছাড়াই অর্ডার)'
                    : 'অর্ডার সফলভাবে সম্পন্ন হয়েছে!'}
                </h2>
                <p className="text-[11px] text-slate-300">
                  Boichitra BD — বৈচিত্র্য · ক্যাশ অন ডেলিভারি
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* STEP 1: CART VIEW */}
              {checkoutStep === 'cart' && (
                <>
                  {cart.length === 0 ? (
                    <div className="text-center py-16 space-y-3">
                      <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
                      <p className="text-base font-semibold text-slate-700">
                        আপনার কার্টে বর্তমানে কোনো পণ্য নেই।
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsCartOpen(false)}
                        className="px-5 py-2.5 bg-[#14213D] text-white text-xs font-semibold rounded-xl"
                      >
                        পণ্য দেখতে ফিরে যান
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="divide-y divide-slate-200">
                        {cart.map((item) => {
                          const base =
                            item.product.salePriceBdt &&
                            item.product.salePriceBdt < item.product.priceBdt
                              ? item.product.salePriceBdt
                              : item.product.priceBdt;
                          const unitPrice =
                            base + (item.variant ? item.variant.priceAdjustmentBdt : 0);
                          return (
                            <div key={item.key} className="py-4 flex gap-3.5 tabular-nums">
                              <div className="w-16 h-14 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                                <ResilientProductImage
                                  src={item.product.imageUrl}
                                  alt={item.product.nameBn}
                                  sku={item.product.sku}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-[#14213D] truncate">
                                  {item.product.nameBn}
                                </div>
                                {item.variant && item.product.variants.length > 0 && (() => {
                                  const { colors, sizes } = extractDistinctColorsAndSizes(
                                    item.product.variants
                                  );
                                  const curColor = item.variant.color || colors[0] || '';
                                  const curSize = item.variant.size || sizes[0] || '';
                                  return (
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                                      {colors.length > 0 && (
                                        <label className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                          <span className="text-slate-500 font-medium">কালার:</span>
                                          <select
                                            aria-label="কালার পরিবর্তন করুন"
                                            value={curColor}
                                            onChange={(e) => {
                                              const nextCol = e.target.value;
                                              const matched = findBestMatchingVariant(
                                                item.product.variants,
                                                nextCol,
                                                curSize,
                                                true
                                              );
                                              if (matched) {
                                                changeCartItemVariant(item.key, matched);
                                              }
                                            }}
                                            className="font-bold text-[#14213D] bg-transparent focus:outline-none cursor-pointer"
                                          >
                                            {colors.map((c) => (
                                              <option key={c} value={c}>
                                                {c}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                      )}

                                      {sizes.length > 0 && (
                                        <label className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                          <span className="text-slate-500 font-medium">সাইজ:</span>
                                          <select
                                            aria-label="সাইজ পরিবর্তন করুন"
                                            value={curSize}
                                            onChange={(e) => {
                                              const nextSz = e.target.value;
                                              const matched = findBestMatchingVariant(
                                                item.product.variants,
                                                curColor,
                                                nextSz,
                                                false
                                              );
                                              if (matched) {
                                                changeCartItemVariant(item.key, matched);
                                              }
                                            }}
                                            className="font-bold text-[#286F65] bg-transparent focus:outline-none cursor-pointer"
                                          >
                                            {sizes.map((s) => (
                                              <option key={s} value={s}>
                                                {s}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                      )}
                                    </div>
                                  );
                                })()}
                                <div className="text-xs font-bold text-[#286F65] mt-1">
                                  {formatBdt(unitPrice)} × {item.quantity} ={' '}
                                  {formatBdt(unitPrice * item.quantity)}
                                </div>

                                <div className="flex items-center gap-3 mt-2">
                                  <div className="inline-flex items-center border border-slate-300 rounded">
                                    <button
                                      type="button"
                                      onClick={() => updateCartQuantity(item.key, -1)}
                                      className="px-2 py-1 hover:bg-slate-100"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="px-2.5 text-xs font-bold">
                                      {item.quantity}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => updateCartQuantity(item.key, 1)}
                                      className="px-2 py-1 hover:bg-slate-100"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => removeFromCart(item.key)}
                                    className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>সরান</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Coupon Input Box */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-[#286F65]" />
                            <span>কুপন কোড প্রযোজ্য থাকলে দিন:</span>
                          </span>
                          {coupons.length > 0 && (
                            <span className="font-mono text-[11px] text-slate-500">
                              উপলব্ধ: {coupons.map((c) => c.code).join(', ')}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={couponInput}
                            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                            placeholder="যেমন: SYLHET100"
                            className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono uppercase"
                          />
                          <button
                            type="button"
                            disabled={validatingCoupon}
                            onClick={handleApplyCoupon}
                            className="px-4 py-2 bg-[#14213D] hover:bg-[#286F65] text-white text-xs font-semibold rounded-lg"
                          >
                            এপ্লাই
                          </button>
                        </div>
                        {couponError && (
                          <div className="text-xs text-red-600">{couponError}</div>
                        )}
                        {appliedCoupon && (
                          <div className="text-xs text-[#16A34A] font-medium">
                            {appliedCoupon.message}
                          </div>
                        )}
                      </div>

                      {/* Prominent Bangla QR Instant Discount Callout in Cart */}
                      {settings?.banglaQrEnabled !== false && potentialQrDiscountBdt > 0 && (
                        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-[#006A4E] space-y-2.5 shadow-xs tabular-nums">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 rounded-xl bg-[#006A4E] text-white shrink-0">
                                <QrCode className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="text-xs font-bold uppercase tracking-wide text-[#006A4E]">
                                  বাংলা কিউআর স্পেশাল ডিসকাউন্ট অফার
                                </div>
                                <div className="text-sm sm:text-base font-extrabold text-[#14213D] leading-snug">
                                  বাংলা কিউআর পেমেন্টে পাচ্ছেন অতিরিক্ত{' '}
                                  <span className="text-[#16A34A] underline decoration-2 underline-offset-2">
                                    {formatBdt(potentialQrDiscountBdt)} ছাড়!
                                  </span>
                                </div>
                              </div>
                            </div>
                            <span className="px-3 py-1.5 rounded-xl bg-[#16A34A] text-white text-sm sm:text-base font-extrabold shrink-0 shadow-xs">
                              -{formatBdt(potentialQrDiscountBdt)}
                            </span>
                          </div>
                          {getBanglaQrDiscountBadgeText(settings) && (
                            <div className="text-xs font-bold text-emerald-950 bg-white/90 px-3 py-1.5 rounded-lg border border-emerald-200">
                              ✨ {getBanglaQrDiscountBadgeText(settings)}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentMethod('BANGLA_QR');
                              setCheckoutStep('checkout');
                            }}
                            className="w-full py-2.5 px-4 rounded-xl bg-[#006A4E] hover:bg-[#14213D] text-white text-xs sm:text-sm font-extrabold transition-colors flex items-center justify-center gap-2 shadow-xs"
                          >
                            <QrCode className="w-4 h-4" />
                            <span>
                              বাংলা কিউআর ছাড়ে চেকআউট করুন ({formatBdt(potentialQrDiscountBdt)} সাশ্রয়)
                            </span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* STEP 2: MANDATORY GUEST CHECKOUT FORM */}
              {checkoutStep === 'checkout' && (
                <form
                  id="guestCheckoutForm"
                  onSubmit={handlePlaceGuestOrder}
                  className="space-y-4 text-xs"
                >
                  <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950">
                    অর্ডার করার জন্য কোনো অ্যাকাউন্ট বা লগইনের প্রয়োজন নেই। নিচের তথ্যগুলো পূরণ করে সরাসরি অর্ডার কনফার্ম করুন।
                  </div>

                  {checkoutError && (
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 font-medium">
                      {checkoutError}
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      আপনার পূর্ণ নাম (Full Name) *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="আপনার নাম লিখুন"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      মোবাইল নম্বর (১১ ডিজিট বাংলাদেশী নম্বর) *
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="017XXXXXXXX"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        জেলা (District) *
                      </label>
                      <select
                        value={selectedDistrict}
                        onChange={(e) => setSelectedDistrict(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white text-sm"
                      >
                        {BANGLADESH_DISTRICTS.map((d) => (
                          <option key={d.name} value={d.name}>
                            {d.nameBn} ({d.name})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        উপজেলা / থানা (Upazila/Thana) *
                      </label>
                      <select
                        value={selectedUpazila}
                        onChange={(e) => setSelectedUpazila(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white text-sm"
                      >
                        {currentDistrictObj.upazilas.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      সম্পূর্ণ ডেলিভারি ঠিকানা (বাসা/রোড/বাজার/এলাকা) *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      placeholder="বাসা নং, রোড নং, গ্রাম বা এলাকার বিস্তারিত ঠিকানা লিখুন..."
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        ইমেইল (ঐচ্ছিক)
                      </label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="example@mail.com"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        অর্ডার নোট (ঐচ্ছিক)
                      </label>
                      <input
                        type="text"
                        value={orderNote}
                        onChange={(e) => setOrderNote(e.target.value)}
                        placeholder="ডেলিভারি সংক্রান্ত কোনো নির্দেশনা..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Payment Method Selection: COD or Bangla QR Manual Payment */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5 tabular-nums">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold text-[#14213D] text-xs sm:text-sm">
                        পেমেন্ট পদ্ধতি নির্বাচন করুন (Payment Method):
                      </div>
                      {settings?.banglaQrEnabled !== false && potentialQrDiscountBdt > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-300 text-[#006A4E] text-xs font-extrabold">
                          🔥 বাংলা কিউআর পেমেন্টে {formatBdt(potentialQrDiscountBdt)} ছাড়!
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <label
                        className={`p-3.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                          paymentMethod === 'COD'
                            ? 'bg-white border-[#14213D] ring-2 ring-[#14213D]/15'
                            : 'bg-white/70 border-slate-200 hover:bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethod === 'COD'}
                          onChange={() => setPaymentMethod('COD')}
                          className="accent-[#14213D] mt-1"
                        />
                        <div>
                          <div className="font-bold text-slate-900 text-xs sm:text-sm">
                            ক্যাশ অন ডেলিভারি (Cash on Delivery)
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            পণ্য হাতে পেয়ে ডেলিভারি ম্যানের কাছে নগদ টাকায় মূল্য পরিশোধ করুন।
                          </div>
                        </div>
                      </label>

                      {settings?.banglaQrEnabled !== false && (
                        <label
                          className={`p-4 rounded-2xl border-2 flex items-start gap-3 cursor-pointer transition-all ${
                            paymentMethod === 'BANGLA_QR'
                              ? 'bg-emerald-50/90 border-[#006A4E] ring-3 ring-[#006A4E]/20 shadow-sm'
                              : 'bg-white border-[#006A4E]/40 hover:border-[#006A4E] hover:bg-emerald-50/30'
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            checked={paymentMethod === 'BANGLA_QR'}
                            onChange={() => {
                              setPaymentMethod('BANGLA_QR');
                              if (!paymentSenderPhone && customerPhone) {
                                setPaymentSenderPhone(customerPhone);
                              }
                            }}
                            className="accent-[#006A4E] mt-1 w-4 h-4 shrink-0"
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-extrabold text-[#006A4E] text-sm sm:text-base flex items-center gap-1.5">
                                <QrCode className="w-5 h-5 shrink-0" />
                                <span>বাংলা কিউআর অগ্রিম পেমেন্ট (Bangla QR)</span>
                              </span>
                              <span className="px-2.5 py-1 rounded-lg bg-[#006A4E] text-white text-xs font-bold">
                                স্ক্যান ও পে
                              </span>
                            </div>

                            {/* BIG EYE-CATCHING DISCOUNT CALLOUT */}
                            {(potentialQrDiscountBdt > 0 ||
                              getBanglaQrDiscountBadgeText(settings)) && (
                              <div className="p-3 rounded-xl bg-[#006A4E] text-white flex flex-wrap items-center justify-between gap-2 shadow-xs">
                                <div className="space-y-0.5">
                                  <div className="text-xs sm:text-sm font-extrabold text-emerald-200">
                                    🎁 {getBanglaQrDiscountBadgeText(settings) || 'বাংলা কিউআর স্পেশাল ডিসকাউন্ট'}
                                  </div>
                                  {potentialQrDiscountBdt > 0 && (
                                    <div className="text-sm sm:text-base font-black text-white">
                                      এই অর্ডারে আপনার তাৎক্ষণিক সাশ্রয়:{' '}
                                      <span className="underline decoration-emerald-300 decoration-2 underline-offset-2">
                                        {formatBdt(potentialQrDiscountBdt)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {potentialQrDiscountBdt > 0 && (
                                  <span className="px-3.5 py-1.5 rounded-xl bg-white text-[#006A4E] text-base sm:text-lg font-black tracking-tight shadow-xs shrink-0">
                                    -{formatBdt(potentialQrDiscountBdt)} ছাড়!
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="text-xs text-slate-700 font-medium">
                              বিকাশ, নগদ, রকেট, উপায় বা যেকোনো ব্যাংক অ্যাপ দিয়ে বাংলা কিউআর স্ক্যান করে সহজেই পেমেন্ট করুন।
                            </div>
                          </div>
                        </label>
                      )}
                    </div>

                    {/* Large Eye-Catching Prompt to switch to Bangla QR when COD is selected */}
                    {paymentMethod === 'COD' &&
                      settings?.banglaQrEnabled !== false &&
                      potentialQrDiscountBdt > 0 && (
                        <div className="p-4 rounded-2xl bg-[#14213D] text-white border-2 border-[#16A34A] space-y-2.5 shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="text-xs font-bold text-emerald-300 uppercase tracking-wide">
                                💡 স্পেশাল সেভিংস অফার (Instant Savings)
                              </div>
                              <div className="text-sm sm:text-base font-extrabold text-white">
                                বাংলা কিউআর পেমেন্ট করলে এখনই অতিরিক্ত{' '}
                                <span className="text-emerald-300 underline decoration-2 underline-offset-2">
                                  {formatBdt(potentialQrDiscountBdt)} ছাড়
                                </span>{' '}
                                পাবেন!
                              </div>
                            </div>
                            <span className="px-3 py-1 rounded-xl bg-[#16A34A] text-white text-sm sm:text-base font-black shrink-0">
                              -{formatBdt(potentialQrDiscountBdt)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentMethod('BANGLA_QR');
                              if (!paymentSenderPhone && customerPhone) {
                                setPaymentSenderPhone(customerPhone);
                              }
                            }}
                            className="w-full py-2.5 px-4 rounded-xl bg-[#16A34A] hover:bg-[#286F65] text-white font-extrabold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 shadow-xs"
                          >
                            <QrCode className="w-4 h-4" />
                            <span>
                              বাংলা কিউআর সিলেক্ট করে {formatBdt(potentialQrDiscountBdt)} ছাড় নিন →
                            </span>
                          </button>
                        </div>
                      )}

                    {/* Expanded Bangla QR Manual Payment Panel */}
                    {paymentMethod === 'BANGLA_QR' && (
                      <div className="p-4 rounded-2xl bg-white border-2 border-[#006A4E] space-y-4 mt-2 shadow-xs">
                        {activeQrDiscountBdt > 0 && (
                          <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-[#16A34A] text-emerald-950 flex flex-wrap items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="text-xs sm:text-sm font-extrabold text-[#006A4E]">
                                🎉 অগ্রিম বাংলা কিউআর বিশেষ ছাড় যুক্ত হয়েছে!
                              </div>
                              <div className="text-[11px] font-semibold text-emerald-900">
                                আপনার মোট বিল থেকে তাৎক্ষণিক {formatBdt(activeQrDiscountBdt)} কমানো হয়েছে
                              </div>
                            </div>
                            <span className="px-3.5 py-1.5 rounded-xl bg-[#16A34A] text-white font-mono text-base sm:text-lg font-black shadow-xs">
                              -{formatBdt(activeQrDiscountBdt)}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                          <div className="w-44 shrink-0 text-center space-y-1.5">
                            <div
                              onClick={() => setShowQrLightbox(true)}
                              className="w-44 aspect-[4/5] rounded-xl overflow-hidden border-2 border-[#006A4E] bg-white shadow-sm cursor-pointer hover:opacity-95 transition-opacity"
                              title="বড় করে দেখতে ক্লিক করুন"
                            >
                              <img
                                src={
                                  settings?.banglaQrImageUrl ||
                                  createDefaultBanglaQrSvg(
                                    settings?.banglaQrMerchantName,
                                    settings?.banglaQrAccountNumber
                                  )
                                }
                                alt="Boichitra BD Bangla QR"
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowQrLightbox(true)}
                              className="text-[11px] font-bold text-[#006A4E] hover:underline"
                            >
                              🔍 কিউআর কোড বড় করে দেখুন
                            </button>
                          </div>

                          <div className="flex-1 space-y-2 text-xs">
                            <div className="p-2.5 rounded-xl bg-emerald-100/90 border border-emerald-300 text-emerald-950 space-y-0.5 tabular-nums">
                              {activeQrDiscountBdt > 0 && (
                                <div className="text-[11px] text-slate-600">
                                  আগের বিল:{' '}
                                  <span className="line-through font-semibold">
                                    {formatBdt(finalTotalBdt + activeQrDiscountBdt)}
                                  </span>{' '}
                                  <span className="text-[#16A34A] font-extrabold">
                                    ({formatBdt(activeQrDiscountBdt)} ছাড়)
                                  </span>
                                </div>
                              )}
                              <div className="text-sm sm:text-base font-extrabold text-[#006A4E]">
                                পরিশোধযোগ্য টাকা: {formatBdt(finalTotalBdt)}
                              </div>
                            </div>
                            <div className="font-bold text-[#14213D]">
                              {settings?.banglaQrMerchantName || 'Boichitra BD — বৈচিত্র্য'}
                            </div>
                            {settings?.banglaQrAccountNumber && (
                              <div className="text-[11px] font-mono font-semibold text-[#286F65] bg-slate-100 px-2.5 py-1 rounded">
                                {settings.banglaQrAccountNumber}
                              </div>
                            )}
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              {settings?.banglaQrInstructions ||
                                'যেকোনো ব্যাংক অ্যাপ, বিকাশ, নগদ, রকেট বা উপায় থেকে বাংলা কিউআর (Bangla QR) স্ক্যান করে পেমেন্ট সম্পন্ন করুন এবং নিচে আপনার প্রেরণকারী নম্বর ও ট্রানজেকশন আইডি (TrxID) লিখুন।'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200">
                          <div>
                            <label className="block font-bold text-slate-800 mb-1">
                              পেমেন্ট প্রেরণকারী নম্বর / অ্যাকাউন্ট *
                            </label>
                            <input
                              type="text"
                              required={paymentMethod === 'BANGLA_QR'}
                              value={paymentSenderPhone}
                              onChange={(e) => setPaymentSenderPhone(e.target.value)}
                              placeholder="যেমন: 017XXXXXXXX"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs bg-white"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-slate-800 mb-1">
                              ট্রানজেকশন আইডি (Transaction ID / TrxID) *
                            </label>
                            <input
                              type="text"
                              required={paymentMethod === 'BANGLA_QR'}
                              value={paymentTransactionId}
                              onChange={(e) =>
                                setPaymentTransactionId(e.target.value.toUpperCase())
                              }
                              placeholder="যেমন: BI84920XKL"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase text-xs bg-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            পেমেন্টের স্ক্রিনশট বা রিসিট আপলোড (ঐচ্ছিক - Optional)
                          </label>
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg cursor-pointer transition-colors text-[11px] border border-slate-300">
                              <span>📷 পেমেন্ট স্ক্রিনশট যোগ করুন</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handlePaymentScreenshotUpload}
                                className="hidden"
                              />
                            </label>
                            {paymentScreenshotUrl && (
                              <div className="flex items-center gap-2">
                                <img
                                  src={paymentScreenshotUrl}
                                  alt="Payment Receipt"
                                  className="h-10 w-10 rounded object-cover border border-emerald-400"
                                />
                                <button
                                  type="button"
                                  onClick={() => setPaymentScreenshotUrl('')}
                                  className="text-[11px] text-red-600 underline"
                                >
                                  মুছে ফেলুন
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </form>
              )}

              {/* STEP 3: ORDER CONFIRMATION RECEIPT */}
              {checkoutStep === 'confirmed' && confirmedOrderData?.order && (
                <div className="space-y-5 text-xs tabular-nums">
                  <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-[#16A34A] mx-auto" />
                    <h3 className="text-lg font-bold text-[#14213D]">
                      ধন্যবাদ! আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে।
                    </h3>
                    <div className="text-sm font-mono font-bold text-[#286F65]">
                      অর্ডার নম্বর: {confirmedOrderData.order.orderNumber}
                    </div>
                    {confirmedOrderData.order.paymentMethod === 'BANGLA_QR' ? (
                      <div className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 font-semibold text-xs">
                        বাংলা কিউআর পেমেন্ট জমা হয়েছে (অ্যাডমিন যাচাইকরণ অপেক্ষমাণ)
                      </div>
                    ) : null}
                    <p className="text-xs text-slate-600">
                      আমাদের প্রতিনিধি শীঘ্রই আপনার মোবাইল নম্বরে ({confirmedOrderData.order.customerPhoneSnapshot}) কল করে অর্ডারটি কনফার্ম করবেন।
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="font-bold text-[#14213D] border-b border-slate-200 pb-2">
                      অর্ডার সারসংক্ষেপ:
                    </div>
                    {confirmedOrderData.items?.map((item: any) => (
                      <div key={item.id} className="flex justify-between py-1">
                        <span>
                          {item.productNameBnSnapshot} ({item.variantSnapshot}) × {item.quantity}
                        </span>
                        <span className="font-semibold">{formatBdt(item.lineTotalBdt)}</span>
                      </div>
                    ))}
                    <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-sm text-[#14213D]">
                      <span>
                        সর্বমোট (
                        {confirmedOrderData.order.paymentMethod === 'BANGLA_QR'
                          ? 'বাংলা কিউআর পেমেন্ট'
                          : 'ক্যাশ অন ডেলিভারি'}
                        ):
                      </span>
                      <span>{formatBdt(confirmedOrderData.order.totalBdt)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTrackOrderNo(confirmedOrderData.order.orderNumber);
                        setTrackPhone(confirmedOrderData.order.customerPhoneSnapshot);
                        setIsCartOpen(false);
                        setShowTrackingModal(true);
                      }}
                      className="w-full py-3 bg-[#14213D] hover:bg-[#286F65] text-white font-semibold rounded-xl"
                    >
                      অর্ডার স্ট্যাটাস ট্র্যাক করুন
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCheckoutStep('cart');
                        setIsCartOpen(false);
                      }}
                      className="w-full py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-xl"
                    >
                      কেনাকাটা চালিয়ে যান
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Totals & Action Buttons */}
            {cart.length > 0 && checkoutStep !== 'confirmed' && (
              <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4 tabular-nums">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>সাবটোটাল ({cartItemCount} টি আইটেম):</span>
                    <span className="font-semibold">{formatBdt(cartSubtotalBdt)}</span>
                  </div>
                  {discountBdt > 0 && (
                    <div className="flex justify-between text-[#16A34A] font-medium">
                      <span>কুপন ডিসকাউন্ট ({appliedCoupon?.code}):</span>
                      <span>-{formatBdt(discountBdt)}</span>
                    </div>
                  )}
                  {activeQrDiscountBdt > 0 && (
                    <div className="p-2.5 rounded-xl bg-emerald-100/90 border border-emerald-300 flex justify-between items-center text-[#006A4E] text-xs sm:text-sm font-extrabold">
                      <span className="flex items-center gap-1.5">
                        <QrCode className="w-4 h-4 shrink-0" />
                        <span>বাংলা কিউআর পেমেন্ট বিশেষ ছাড়:</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#16A34A] text-white font-mono">
                        -{formatBdt(activeQrDiscountBdt)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>
                      ডেলিভারি চার্জ ({selectedDistrict === 'Dhaka' ? 'ঢাকার ভিতরে' : 'ঢাকার বাইরে'}):
                    </span>
                    <span className="font-semibold">
                      {deliveryChargeBdt === 0 ? 'ফ্রি (৳0)' : formatBdt(deliveryChargeBdt)}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-[#14213D] border-t border-slate-200 pt-2">
                    <span>সর্বমোট প্রদেয়:</span>
                    <span>{formatBdt(finalTotalBdt)}</span>
                  </div>
                </div>

                {checkoutStep === 'cart' ? (
                  <button
                    type="button"
                    onClick={() => setCheckoutStep('checkout')}
                    className="w-full py-3.5 bg-[#14213D] hover:bg-[#286F65] text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <span>চেকআউট করুন (Proceed to Checkout)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setCheckoutStep('cart')}
                      className="px-4 py-3 bg-white border border-slate-300 text-xs font-semibold rounded-xl"
                    >
                      কার্টে ফিরুন
                    </button>
                    <button
                      type="submit"
                      form="guestCheckoutForm"
                      disabled={submittingOrder}
                      className="flex-1 py-3.5 bg-[#16A34A] hover:bg-[#286F65] text-white font-bold text-sm rounded-xl transition-colors"
                    >
                      {submittingOrder
                        ? 'অর্ডার প্রসেস হচ্ছে...'
                        : `অর্ডার কনফার্ম করুন (${formatBdt(finalTotalBdt)})`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL C: PUBLIC ORDER TRACKING (Requires Order Number + Phone Number)
         ===================================================================== */}
      {showTrackingModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="অর্ডার ট্র্যাকিং"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <PackageSearch className="w-5 h-5 text-[#286F65]" />
                <h3 className="text-base font-bold text-[#14213D]">
                  আপনার অর্ডার ট্র্যাক করুন (Order Tracking)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTrackingModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTrackOrder} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  অর্ডার নম্বর (Order Number) *
                </label>
                <input
                  type="text"
                  required
                  value={trackOrderNo}
                  onChange={(e) => setTrackOrderNo(e.target.value.toUpperCase())}
                  placeholder="যেমন: BBD-20261028-1234"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  অর্ডারে ব্যবহৃত মোবাইল নম্বর *
                </label>
                <input
                  type="tel"
                  required
                  value={trackPhone}
                  onChange={(e) => setTrackPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={trackingLoading}
                className="w-full py-2.5 bg-[#14213D] hover:bg-[#286F65] text-white font-semibold rounded-lg"
              >
                {trackingLoading ? 'খোঁজা হচ্ছে...' : 'স্ট্যাটাস দেখুন'}
              </button>
            </form>

            {trackingError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {trackingError}
              </div>
            )}

            {trackingResult && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs tabular-nums">
                <div className="flex items-start justify-between border-b border-slate-200 pb-2.5 gap-2">
                  <div>
                    <div className="font-mono font-bold text-[#14213D] text-sm">
                      {trackingResult.orderNumber}
                    </div>
                    <div className="text-slate-600 mt-0.5">
                      গ্রাহক: {trackingResult.customerName}
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      ঠিকানা: {trackingResult.upazila}, {trackingResult.district}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[#286F65] text-sm">
                      {trackingResult.orderStatus}
                    </div>
                    <div className="text-slate-600 font-medium mt-0.5">
                      {trackingResult.paymentMethod === 'BANGLA_QR'
                        ? 'বাংলা কিউআর পেমেন্ট'
                        : 'ক্যাশ অন ডেলিভারি (COD)'}{' '}
                      · {trackingResult.paymentStatus}
                    </div>
                    {trackingResult.manualPayment?.transactionId && (
                      <div className="text-[11px] font-mono text-[#006A4E] font-semibold mt-0.5">
                        TrxID: {trackingResult.manualPayment.transactionId}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  {trackingResult.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between">
                      <span>
                        {item.productNameBn} ({item.variant}) × {item.quantity}
                      </span>
                      <span className="font-semibold">{formatBdt(item.lineTotalBdt)}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 pt-2 space-y-1 text-slate-600">
                    <div className="flex justify-between">
                      <span>সাবটোটাল:</span>
                      <span>{formatBdt(trackingResult.subtotalBdt)}</span>
                    </div>
                    {trackingResult.discountBdt > 0 && (
                      <div className="flex justify-between text-[#16A34A] font-medium">
                        <span>বিশেষ ছাড় / ডিসকাউন্ট:</span>
                        <span>-{formatBdt(trackingResult.discountBdt)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>ডেলিভারি চার্জ:</span>
                      <span>{formatBdt(trackingResult.deliveryChargeBdt)}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-[#14213D] text-sm">
                      <span>সর্বমোট প্রদেয়:</span>
                      <span>{formatBdt(trackingResult.totalBdt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL D: RETURN & PRIVACY POLICIES
         ===================================================================== */}
      {policyModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 text-xs leading-relaxed">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-[#14213D]">
                {policyModal === 'return'
                  ? 'রিটার্ন ও রিফান্ড পলিসি (Return & Refund Policy)'
                  : 'প্রাইভেসি ও কাস্টমার ডেটা নীতিমালা (Privacy Policy)'}
              </h3>
              <button
                type="button"
                onClick={() => setPolicyModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {policyModal === 'return' ? (
              <div className="space-y-2 text-slate-700">
                <p>{settings?.returnPolicyText}</p>
                <p>
                  ১. ডেলিভারি ম্যান উপস্থিত থাকা অবস্থায় প্যাকেট খুলে পণ্য যাচাই করার অনুরোধ করা হচ্ছে।
                </p>
                <p>
                  ২. পণ্যে কোনো প্রস্তুতকারকজনিত ত্রুটি বা ভুল সাইজ/কালার ডেলিভারি হলে কোনো অতিরিক্ত চার্জ ছাড়াই এক্সচেঞ্জ বা রিটার্ন করা যাবে।
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-slate-700">
                <p>
                  ১. Boichitra BD — বৈচিত্র্য শুধুমাত্র অর্ডার প্রসেসিং এবং কুরিয়ার ডেলিভারির প্রয়োজনে গ্রাহকের নাম, মোবাইল নম্বর এবং ডেলিভারি ঠিকানা সংরক্ষণ করে।
                </p>
                <p>
                  ২. গ্রাহকের ব্যক্তিগত তথ্য কোনো তৃতীয় পক্ষের কাছে বিক্রি বা প্রকাশ করা হয় না এবং আমাদের পাবলিক ওয়েবসাইটে কোনো কাস্টমার ডিরেক্টরি উন্মুক্ত নয়।
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL E: BANGLA QR LIGHTBOX ZOOM MODAL
         ===================================================================== */}
      {showQrLightbox && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-black/75 flex items-center justify-center p-4"
          onClick={() => setShowQrLightbox(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl text-center space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="font-bold text-sm text-[#006A4E]">
                বাংলা কিউআর স্ক্যান করুন (Bangla QR)
              </div>
              <button
                type="button"
                onClick={() => setShowQrLightbox(false)}
                className="p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="w-full aspect-[4/5] rounded-xl overflow-hidden border-2 border-[#006A4E] bg-white">
              <img
                src={
                  settings?.banglaQrImageUrl ||
                  createDefaultBanglaQrSvg(
                    settings?.banglaQrMerchantName,
                    settings?.banglaQrAccountNumber
                  )
                }
                alt="Bangla QR Fullscreen"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-sm font-bold text-[#14213D] tabular-nums">
              পরিশোধযোগ্য টাকা: {formatBdt(finalTotalBdt)}
            </div>
            <button
              type="button"
              onClick={() => setShowQrLightbox(false)}
              className="w-full py-2.5 bg-[#14213D] text-white text-xs font-semibold rounded-xl"
            >
              বন্ধ করুন ও TrxID লিখুন
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
