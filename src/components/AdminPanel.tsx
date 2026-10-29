import React, { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  LogOut,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Users,
  AlertTriangle,
  Edit3,
  CheckCircle2,
  X,
  FolderTree,
  Lock,
  KeyRound,
  Images,
  Video,
  Sparkles,
  Trash2,
  Server,
  Copy,
  Share2,
  Check,
} from 'lucide-react';
import {
  AuditLogRecord,
  Category,
  Coupon,
  CustomerRecord,
  OrderRecord,
  Product,
  StoreSettings,
} from '../types.ts';
import { formatBdt } from '../lib/bd-locations.ts';
import {
  createStudioProductSvg,
  createDefaultBanglaQrSvg,
  parseProductGalleryAndOffer,
  serializeProductGalleryAndOffer,
  compressImageFileToDataUrl,
  ParsedMediaItem,
  buildProductPromoUrl,
  copyTextToClipboard,
} from '../lib/visuals.ts';
import * as XLSX from 'xlsx';
import { ResilientProductImage } from './ProductVisualCard.tsx';

interface AdminPanelProps {
  onBackToStore: () => void;
  onStoreUpdated: () => void;
}

interface AdminStats {
  totalOrders: number;
  awaitingConfirmation: number;
  processingOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  grossOrderValueBdt: number;
  paidRevenueBdt: number;
  totalCustomers: number;
  lowStockCount: number;
}

interface AdminUserInfo {
  email: string;
  name: string;
  role: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  onBackToStore,
  onStoreUpdated,
}) => {
  // Site-Native Admin Session State (in memory + HttpOnly cookie on server)
  const [sessionToken, setSessionToken] = useState<string>('');
  const [adminUser, setAdminUser] = useState<AdminUserInfo | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState<boolean>(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Login / Initial Setup Form Inputs
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [setupName, setSetupName] = useState('Boichitra Admin');
  const [setupEmail, setSetupEmail] = useState('admin@boichitrabd.com');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');

  // Change Password Form Inputs (inside Settings Tab)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'orders' | 'customers' | 'products' | 'offers' | 'categories' | 'settings'
  >('dashboard');

  const [loadingData, setLoadingData] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Filters
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

  // Selected Modals
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<OrderRecord | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);

  // Order Update State
  const [editOrderStatus, setEditOrderStatus] = useState('Pending');
  const [editPaymentStatus, setEditPaymentStatus] = useState('UNPAID');
  const [editOrderNote, setEditOrderNote] = useState('');
  const [editCancelReason, setEditCancelReason] = useState('');
  const [editRefundAmount, setEditRefundAmount] = useState(0);
  const [savingOrder, setSavingOrder] = useState(false);

  // Product Form Modal State
  const [showProductModal, setShowProductModal] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productForm, setProductForm] = useState<{
    id?: number;
    sku: string;
    name: string;
    nameBn: string;
    categoryId: number;
    description: string;
    descriptionBn: string;
    priceBdt: number;
    salePriceBdt: string;
    stockQuantity: number;
    lowStockThreshold: number;
    imageUrl: string;
    visualPreset:
      | 'hoodie'
      | 'headphones'
      | 'smartwatch'
      | 'panjabi'
      | 'powerbank'
      | 'backpack'
      | 'earbuds'
      | 'tshirt';
    isFeatured: boolean;
    isNewArrival: boolean;
    isBestSeller: boolean;
    isSpecialOffer: boolean;
    isSeasonal: boolean;
    isPublished: boolean;
    seoTitle: string;
    seoDescription: string;
    galleryMedia: ParsedMediaItem[];
    offerBadgeText: string;
    offerEndsAt: string;
    offerDealNote: string;
    offerPromoCoupon: string;
    freeDelivery: boolean;
    variants: Array<{
      id?: number;
      sku: string;
      size: string;
      color: string;
      priceAdjustmentBdt: number;
      stockQuantity: number;
    }>;
  }>({
    sku: '',
    name: '',
    nameBn: '',
    categoryId: 1,
    description: '',
    descriptionBn: '',
    priceBdt: 1200,
    salePriceBdt: '',
    stockQuantity: 25,
    lowStockThreshold: 5,
    imageUrl: '',
    visualPreset: 'hoodie',
    isFeatured: true,
    isNewArrival: true,
    isBestSeller: false,
    isSpecialOffer: false,
    isSeasonal: false,
    isPublished: true,
    seoTitle: '',
    seoDescription: '',
    galleryMedia: [],
    offerBadgeText: '🔥 ফ্ল্যাশ ডিল',
    offerEndsAt: '',
    offerDealNote: 'সীমিত সময়ের বিশেষ ছাড় · ক্যাশ অন ডেলিভারি সুবিধা',
    offerPromoCoupon: 'SYLHET100',
    freeDelivery: false,
    variants: [],
  });

  // Quick Clothing Color & Size Generator States inside Product Modal
  const [quickColors, setQuickColors] = useState<string[]>([
    'Navy Blue',
    'Charcoal Black',
  ]);
  const [quickSizes, setQuickSizes] = useState<string[]>(['M', 'L', 'XL', 'XXL']);
  const [customColorInput, setCustomColorInput] = useState('');
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [quickStockPerVariant, setQuickStockPerVariant] = useState(12);

  // Media URL Input States inside Product Modal
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaType, setNewMediaType] = useState<'image' | 'video'>('image');
  const [newMediaTitle, setNewMediaTitle] = useState('');

  // Coupon Form State (inside Special Offers & Coupons Tab)
  const [couponForm, setCouponForm] = useState<{
    id?: number;
    code: string;
    description: string;
    discountType: 'fixed' | 'percentage';
    discountValue: number;
    minOrderBdt: number;
    maxDiscountBdt: string;
    usageLimit: number;
    isActive: boolean;
  }>({
    code: '',
    description: '',
    discountType: 'fixed',
    discountValue: 100,
    minOrderBdt: 1000,
    maxDiscountBdt: '',
    usageLimit: 500,
    isActive: true,
  });

  // Category Form State
  const [categoryForm, setCategoryForm] = useState<{
    id?: number;
    name: string;
    nameBn: string;
    description: string;
    sortOrder: number;
    isActive: boolean;
  }>({
    name: '',
    nameBn: '',
    description: '',
    sortOrder: 1,
    isActive: true,
  });

  const [downloadingXlsx, setDownloadingXlsx] = useState<string | null>(null);

  // Business Koro (businesskoro.com) Auto-Sync State (Server-side API Key via .env)
  const [bkStatus, setBkStatus] = useState<{
    hasServerApiKey: boolean;
    endpointUrl: string;
    syncedProductsCount: number;
    catalogFeedAvailableCount: number;
    lastSyncAt: string | null;
    lastSyncDetails: string | null;
  } | null>(null);
  const [bkMarkupPct, setBkMarkupPct] = useState<number>(0);
  const [bkFixedMarkupBdt, setBkFixedMarkupBdt] = useState<number>(0);
  const [bkAutoPublish, setBkAutoPublish] = useState<boolean>(true);
  const [bkUpdateExistingPrices, setBkUpdateExistingPrices] = useState<boolean>(true);
  const [syncingBusinessKoro, setSyncingBusinessKoro] = useState<boolean>(false);

  // Product Promo Link & Deletion States
  const [copiedPromoKey, setCopiedPromoKey] = useState<string | null>(null);
  const [confirmDeleteProductId, setConfirmDeleteProductId] = useState<number | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState<boolean>(false);
  const [bulkDeleting, setBulkDeleting] = useState<boolean>(false);

  const getAuthHeaders = useCallback(
    (extra: Record<string, string> = {}) => {
      const headers: Record<string, string> = { ...extra };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      return headers;
    },
    [sessionToken]
  );

  const fetchAdminOverview = useCallback(
    async (overrideToken?: string) => {
      setLoadingData(true);
      setAuthError('');
      try {
        const tokenToUse = overrideToken ?? sessionToken;
        const headers: Record<string, string> = {};
        if (tokenToUse) {
          headers['Authorization'] = `Bearer ${tokenToUse}`;
        }
        const res = await fetch('/api/admin/overview', {
          headers,
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'অ্যাডমিন প্যানেলে প্রবেশের অনুমতি নেই।');
        }
        setStats(data.stats);
        setOrders(data.orders || []);
        setCustomers(data.customers || []);
        setProducts(data.products || []);
        setCategories(data.categories || []);
        setCoupons(data.coupons || []);
        setSettings(data.settings || null);
        setAuditLogs(data.auditLogs || []);
        if (data.adminUser) {
          setAdminUser(data.adminUser);
          setNewAdminEmail(data.adminUser.email || '');
          setNewAdminName(data.adminUser.name || '');
        }
        try {
          const bkRes = await fetch('/api/admin/businesskoro/status', {
            headers,
            credentials: 'include',
          });
          if (bkRes.ok) {
            const bkData = await bkRes.json();
            setBkStatus(bkData);
          }
        } catch {
          // ignore status fetch error
        }
      } catch (err: any) {
        setAuthError(err.message || 'অ্যাডমিন যাচাইকরণ ব্যর্থ হয়েছে।');
      } finally {
        setLoadingData(false);
      }
    },
    [sessionToken]
  );

  const handleBusinessKoroSync = async () => {
    setSyncingBusinessKoro(true);
    setFeedbackBanner(null);
    try {
      const res = await fetch('/api/admin/businesskoro/sync', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          markupPercentage: bkMarkupPct,
          fixedMarkupBdt: bkFixedMarkupBdt,
          autoPublish: bkAutoPublish,
          updateExistingPrices: bkUpdateExistingPrices,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Business Koro পণ্য সিঙ্ক ব্যর্থ হয়েছে।');
      }
      setFeedbackBanner({
        type: 'success',
        text:
          data.message ||
          `Business Koro থেকে সফলভাবে ${data.totalSynced || 0}টি পণ্য অটো-সিঙ্ক হয়েছে!`,
      });
      await fetchAdminOverview();
      onStoreUpdated();
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        text: err.message || 'Business Koro সিঙ্ক করতে সমস্যা হয়েছে।',
      });
    } finally {
      setSyncingBusinessKoro(false);
    }
  };

  useEffect(() => {
    (async () => {
      setAuthLoading(true);
      try {
        const res = await fetch('/api/admin/auth/status', {
          credentials: 'include',
        });
        const data = await res.json();
        setIsSetupComplete(Boolean(data.isSetupComplete));
        if (data.authenticated && data.adminUser) {
          setAdminUser(data.adminUser);
          setNewAdminEmail(data.adminUser.email || '');
          setNewAdminName(data.adminUser.name || '');
          await fetchAdminOverview();
        }
      } catch {
        // Ignore initial check error
      } finally {
        setAuthLoading(false);
      }
    })();
  }, [fetchAdminOverview]);

  const handleInitialSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (setupPassword.length < 6) {
      setAuthError('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
      return;
    }
    if (setupPassword !== setupConfirmPassword) {
      setAuthError('পাসওয়ার্ড এবং কনফার্ম পাসওয়ার্ড মিলছে না।');
      return;
    }

    setAuthSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: setupEmail.trim(),
          name: setupName.trim(),
          password: setupPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'অ্যাডমিন অ্যাকাউন্ট তৈরি করা যায়নি।');
      }
      setSessionToken(data.token || '');
      setAdminUser(data.adminUser);
      setIsSetupComplete(true);
      await fetchAdminOverview(data.token);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          identifier: loginIdentifier.trim(),
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'লগইন ব্যর্থ হয়েছে।');
      }
      setSessionToken(data.token || '');
      setAdminUser(data.adminUser);
      setLoginPassword('');
      await fetchAdminOverview(data.token);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
    } catch {
      // ignore
    }
    setSessionToken('');
    setAdminUser(null);
    setStats(null);
    setOrders([]);
    setCustomers([]);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPassword(true);
    setFeedbackBanner(null);
    try {
      const res = await fetch('/api/admin/auth/change-password', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          currentPassword,
          newEmail: newAdminEmail.trim(),
          newName: newAdminName.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAdminUser(data.adminUser);
      setCurrentPassword('');
      setNewPassword('');
      setFeedbackBanner({
        type: 'success',
        text: 'অ্যাডমিন লগইন তথ্য ও পাসওয়ার্ড সফলভাবে আপডেট করা হয়েছে।',
      });
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        text: err.message || 'পাসওয়ার্ড পরিবর্তন করা যায়নি।',
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const generateClientSideXlsx = (type: 'customers' | 'orders') => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const workbook = XLSX.utils.book_new();

    if (type === 'customers') {
      const q = customerSearch.trim().toLowerCase();
      const filtered = customers.filter((c) => {
        if (!q) return true;
        return (
          c.fullName.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.customerCode.toLowerCase().includes(q) ||
          c.district.toLowerCase().includes(q)
        );
      });
      const rows =
        filtered.length > 0
          ? filtered.map((c, idx) => ({
              SL: idx + 1,
              'Customer ID': c.customerCode,
              'Full Name (গ্রাহকের নাম)': c.fullName,
              'Mobile Number (মোবাইল)': c.phone,
              'Email (ইমেইল)': c.email || 'N/A',
              'District (জেলা)': c.district,
              'Upazila/Thana (উপজেলা/থানা)': c.upazila,
              'Delivery Address (ঠিকানা)': c.addressLine,
              'Total Orders (মোট অর্ডার)': Number(c.totalOrders),
              'Total Order Value BDT (মোট ক্রয় ৳)': Number(c.totalSpentBdt),
              'First Order Date (প্রথম অর্ডার)': c.firstOrderAt || '',
              'Last Order Date (সর্বশেষ অর্ডার)': c.lastOrderAt || '',
            }))
          : [{ SL: 1, 'Customer ID': 'NO-DATA', 'Full Name (গ্রাহকের নাম)': 'কোনো কাস্টমার রেকর্ড পাওয়া যায়নি' }];
      const sheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, sheet, 'Boichitra Customers');
      XLSX.writeFile(workbook, `Boichitra_BD_Customers_${dateStr}.xlsx`);
      return;
    }

    const q = orderSearch.trim().toLowerCase();
    const filteredOrders = orders.filter((o) => {
      if (orderStatusFilter !== 'ALL' && o.orderStatus !== orderStatusFilter) return false;
      if (!q) return true;
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerNameSnapshot.toLowerCase().includes(q) ||
        o.customerPhoneSnapshot.toLowerCase().includes(q)
      );
    });
    const orderRows =
      filteredOrders.length > 0
        ? filteredOrders.map((o, idx) => ({
            SL: idx + 1,
            'Order Number (অর্ডার নম্বর)': o.orderNumber,
            'Order Date (তারিখ)': o.createdAt || '',
            'Order Status (স্ট্যাটাস)': o.orderStatus,
            'Payment Method (পেমেন্ট মাধ্যম)':
              o.paymentMethod === 'BANGLA_QR' ? 'Bangla QR (ম্যানুয়াল)' : o.paymentMethod,
            'Payment Status (পেমেন্ট স্ট্যাটাস)': o.paymentStatus,
            'Sender Number (পেমেন্ট নম্বর)': o.manualPayment?.senderPhone || 'N/A',
            'Transaction ID (TrxID)': o.manualPayment?.transactionId || 'N/A',
            'Customer Name (গ্রাহকের নাম)': o.customerNameSnapshot,
            'Mobile Number (মোবাইল)': o.customerPhoneSnapshot,
            'District (জেলা)': o.districtSnapshot,
            'Upazila/Thana (উপজেলা/থানা)': o.upazilaSnapshot,
            'Shipping Address (ডেলিভারি ঠিকানা)': o.shippingAddressSnapshot,
            'Items Summary (পণ্যের বিবরণ)': o.items
              .map((i) => `${i.productNameBnSnapshot} (${i.variantSnapshot}) x${i.quantity}`)
              .join('; '),
            'Subtotal BDT (সাবটোটাল ৳)': Number(o.subtotalBdt),
            'Discount BDT (ছাড় ৳)': Number(o.discountBdt),
            'Delivery Charge BDT (ডেলিভারি চার্জ ৳)': Number(o.deliveryChargeBdt),
            'Total Payable BDT (সর্বমোট ৳)': Number(o.totalBdt),
            'Order Note (নোট)': o.orderNote || '',
          }))
        : [{ SL: 1, 'Order Number (অর্ডার নম্বর)': 'NO-ORDERS', 'Customer Name (গ্রাহকের নাম)': 'কোনো অর্ডার পাওয়া যায়নি' }];

    const ordersSheet = XLSX.utils.json_to_sheet(orderRows);
    XLSX.utils.book_append_sheet(workbook, ordersSheet, 'Orders Summary');
    XLSX.writeFile(workbook, `Boichitra_BD_Orders_${dateStr}.xlsx`);
  };

  const handleDownloadXlsx = async (type: 'customers' | 'orders') => {
    setDownloadingXlsx(type);
    setFeedbackBanner(null);
    try {
      const params = new URLSearchParams();
      if (type === 'customers' && customerSearch) {
        params.set('search', customerSearch);
      }
      if (type === 'orders') {
        if (orderStatusFilter !== 'ALL') params.set('status', orderStatusFilter);
        if (orderSearch) params.set('search', orderSearch);
      }
      const url = `/api/admin/export/${type}.xlsx?${params.toString()}`;
      const res = await fetch(url, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('spreadsheetml')) {
        generateClientSideXlsx(type);
      } else {
        const blob = await res.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10);
        a.href = downloadUrl;
        a.download =
          type === 'customers'
            ? `Boichitra_BD_Customers_${dateStr}.xlsx`
            : `Boichitra_BD_Orders_${dateStr}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      }
      setFeedbackBanner({
        type: 'success',
        text: `${type === 'customers' ? 'কাস্টমার' : 'অর্ডার'} ডেটা সফলভাবে Excel (.xlsx) ফাইলে ডাউনলোড হয়েছে।`,
      });
      await fetchAdminOverview();
    } catch {
      try {
        generateClientSideXlsx(type);
        setFeedbackBanner({
          type: 'success',
          text: `${type === 'customers' ? 'কাস্টমার' : 'অর্ডার'} ডেটা সফলভাবে Excel (.xlsx) ফাইলে ডাউনলোড হয়েছে।`,
        });
      } catch (err: any) {
        setFeedbackBanner({
          type: 'error',
          text: err.message || 'এক্সেল ডাউনলোড ব্যর্থ হয়েছে।',
        });
      }
    } finally {
      setDownloadingXlsx(null);
    }
  };

  const openOrderModal = (order: OrderRecord) => {
    setSelectedOrder(order);
    setEditOrderStatus(order.orderStatus);
    setEditPaymentStatus(order.paymentStatus);
    setEditOrderNote('');
    setEditCancelReason(order.cancellationReason || '');
    setEditRefundAmount(order.refundAmountBdt || 0);
  };

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setSavingOrder(true);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          orderStatus: editOrderStatus,
          paymentStatus: editPaymentStatus,
          note: editOrderNote,
          cancellationReason: editCancelReason,
          refundAmountBdt: editRefundAmount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedbackBanner({
        type: 'success',
        text: `অর্ডার #${selectedOrder.orderNumber}-এর স্ট্যাটাস "${editOrderStatus}"-এ আপডেট করা হয়েছে।`,
      });
      setSelectedOrder(null);
      await fetchAdminOverview();
      onStoreUpdated();
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        text: err.message || 'অর্ডার আপডেট করতে সমস্যা হয়েছে।',
      });
    } finally {
      setSavingOrder(false);
    }
  };

  const openNewProductModal = () => {
    const defaultCat = categories[0]?.id || 1;
    const randomSku = `BBD-PR-${Math.floor(100 + Math.random() * 900)}`;
    const defaultEnds = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16);
    setProductForm({
      sku: randomSku,
      name: '',
      nameBn: '',
      categoryId: defaultCat,
      description: '',
      descriptionBn: '',
      priceBdt: 1200,
      salePriceBdt: '',
      stockQuantity: 30,
      lowStockThreshold: 5,
      imageUrl: createStudioProductSvg('hoodie', '#14213D', '#286F65', randomSku),
      visualPreset: 'hoodie',
      isFeatured: true,
      isNewArrival: true,
      isBestSeller: false,
      isSpecialOffer: false,
      isSeasonal: false,
      isPublished: true,
      seoTitle: '',
      seoDescription: '',
      galleryMedia: [],
      offerBadgeText: '🔥 ফ্ল্যাশ ডিল',
      offerEndsAt: defaultEnds,
      offerDealNote: 'সীমিত সময়ের বিশেষ ছাড় · ক্যাশ অন ডেলিভারি সুবিধা',
      offerPromoCoupon: 'SYLHET100',
      freeDelivery: false,
      variants: [],
    });
    setNewMediaUrl('');
    setNewMediaTitle('');
    setShowProductModal(true);
  };

  const openEditProductModal = (prod: Product) => {
    const parsed = parseProductGalleryAndOffer(prod);
    const defaultEnds = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16);
    setProductForm({
      id: prod.id,
      sku: prod.sku,
      name: prod.name,
      nameBn: prod.nameBn,
      categoryId: prod.categoryId,
      description: prod.description,
      descriptionBn: prod.descriptionBn,
      priceBdt: prod.priceBdt,
      salePriceBdt: prod.salePriceBdt ? String(prod.salePriceBdt) : '',
      stockQuantity: prod.stockQuantity,
      lowStockThreshold: prod.lowStockThreshold,
      imageUrl: prod.imageUrl,
      visualPreset: 'hoodie',
      isFeatured: prod.isFeatured,
      isNewArrival: prod.isNewArrival,
      isBestSeller: prod.isBestSeller,
      isSpecialOffer: prod.isSpecialOffer,
      isSeasonal: prod.isSeasonal,
      isPublished: prod.isPublished,
      seoTitle: prod.seoTitle || '',
      seoDescription: prod.seoDescription || '',
      galleryMedia: parsed.media,
      offerBadgeText: parsed.offerMeta.badgeText || '🔥 ফ্ল্যাশ ডিল',
      offerEndsAt: parsed.offerMeta.offerEndsAt
        ? parsed.offerMeta.offerEndsAt.slice(0, 16)
        : defaultEnds,
      offerDealNote:
        parsed.offerMeta.dealNote || 'সীমিত সময়ের বিশেষ ছাড় · ক্যাশ অন ডেলিভারি সুবিধা',
      offerPromoCoupon: parsed.offerMeta.promoCouponCode || 'SYLHET100',
      freeDelivery: Boolean(parsed.offerMeta.freeDelivery),
      variants: (prod.variants || []).map((v) => ({
        id: v.id,
        sku: v.sku,
        size: v.size || '',
        color: v.color || '',
        priceAdjustmentBdt: v.priceAdjustmentBdt,
        stockQuantity: v.stockQuantity,
      })),
    });
    setNewMediaUrl('');
    setNewMediaTitle('');
    setShowProductModal(true);
  };

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFeedbackBanner({ type: 'error', text: 'শুধুমাত্র ইমেজ ফাইল (JPG, PNG, WEBP) আপলোড করুন।' });
      return;
    }
    try {
      const compressed = await compressImageFileToDataUrl(file, 900, 0.85);
      setProductForm((prev) => ({ ...prev, imageUrl: compressed }));
    } catch {
      setFeedbackBanner({ type: 'error', text: 'ইমেজ প্রসেস করতে সমস্যা হয়েছে।' });
    }
  };

  const handleGalleryImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const addedItems: ParsedMediaItem[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.type.startsWith('image/')) {
        try {
          const dataUrl = await compressImageFileToDataUrl(file, 900, 0.82);
          addedItems.push({
            id: `img-${Date.now()}-${i}`,
            url: dataUrl,
            type: 'image',
            title: file.name.replace(/\.[^.]+$/, ''),
          });
        } catch {
          // skip failed image
        }
      } else if (file.type.startsWith('video/')) {
        if (file.size > 4.5 * 1024 * 1024) {
          setFeedbackBanner({
            type: 'error',
            text: 'সরাসরি ভিডিও ফাইল আপলোডের জন্য সর্বোচ্চ ৪.৫ মেগাবাইট অনুমোদিত। বড় ভিডিওর ক্ষেত্রে YouTube বা ভিডিও লিংক ব্যবহার করুন।',
          });
          continue;
        }
        const videoDataUrl = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result || ''));
          r.onerror = () => resolve('');
          r.readAsDataURL(file);
        });
        if (videoDataUrl) {
          addedItems.push({
            id: `vid-${Date.now()}-${i}`,
            url: videoDataUrl,
            type: 'video',
            title: file.name.replace(/\.[^.]+$/, ''),
          });
        }
      }
    }

    if (addedItems.length > 0) {
      setProductForm((prev) => ({
        ...prev,
        galleryMedia: [...prev.galleryMedia, ...addedItems],
      }));
    }
    e.target.value = '';
  };

  const handleAddMediaByUrl = () => {
    const trimmed = newMediaUrl.trim();
    if (!trimmed) return;
    setProductForm((prev) => ({
      ...prev,
      galleryMedia: [
        ...prev.galleryMedia,
        {
          id: `media-${Date.now()}`,
          url: trimmed,
          type: newMediaType,
          title:
            newMediaTitle.trim() ||
            (newMediaType === 'video' ? 'প্রোডাক্ট ভিডিও' : `অতিরিক্ত ছবি #${prev.galleryMedia.length + 1}`),
        },
      ],
    }));
    setNewMediaUrl('');
    setNewMediaTitle('');
  };

  const handleAddStudioAngle = (angleLabel: string, primaryHex: string, accentHex: string) => {
    const svgUrl = createStudioProductSvg(
      productForm.visualPreset,
      primaryHex,
      accentHex,
      `${productForm.sku || 'BBD'} · ${angleLabel}`
    );
    setProductForm((prev) => ({
      ...prev,
      galleryMedia: [
        ...prev.galleryMedia,
        {
          id: `studio-${Date.now()}`,
          url: svgUrl,
          type: 'image',
          title: angleLabel,
        },
      ],
    }));
  };

  const handleGenerateColorSizeMatrix = () => {
    if (quickColors.length === 0 && quickSizes.length === 0) return;
    const colorsToUse = quickColors.length > 0 ? quickColors : ['Standard'];
    const sizesToUse = quickSizes.length > 0 ? quickSizes : ['Free Size'];

    const existingList = [...productForm.variants];
    const baseSku = (productForm.sku || 'BBD-ITEM').trim().toUpperCase();

    for (const col of colorsToUse) {
      for (const sz of sizesToUse) {
        const alreadyExists = existingList.some(
          (v) =>
            v.color.trim().toLowerCase() === col.trim().toLowerCase() &&
            v.size.trim().toLowerCase() === sz.trim().toLowerCase()
        );
        if (!alreadyExists) {
          const szClean = sz.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'SZ';
          const colClean = col.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3) || 'CL';
          existingList.push({
            sku: `${baseSku}-${szClean}-${colClean}`,
            color: col.trim(),
            size: sz.trim(),
            priceAdjustmentBdt: 0,
            stockQuantity: Math.max(1, Number(quickStockPerVariant) || 10),
          });
        }
      }
    }

    const totalVarStock = existingList.reduce(
      (sum, v) => sum + Math.max(0, Number(v.stockQuantity) || 0),
      0
    );

    setProductForm((prev) => ({
      ...prev,
      variants: existingList,
      stockQuantity: totalVarStock > 0 ? totalVarStock : prev.stockQuantity,
    }));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProduct(true);
    try {
      const serializedGallery = serializeProductGalleryAndOffer(
        productForm.galleryMedia,
        {
          badgeText: productForm.offerBadgeText,
          offerEndsAt: productForm.offerEndsAt,
          dealNote: productForm.offerDealNote,
          promoCouponCode: productForm.offerPromoCoupon,
          freeDelivery: productForm.freeDelivery,
        }
      );

      const cleanedVariants = (productForm.variants || [])
        .filter((v) => v.size.trim() !== '' || v.color.trim() !== '')
        .map((v, idx) => ({
          id: v.id,
          sku:
            v.sku.trim() ||
            `${productForm.sku.trim().toUpperCase()}-V${idx + 1}`,
          size: v.size.trim(),
          color: v.color.trim(),
          priceAdjustmentBdt: Number(v.priceAdjustmentBdt) || 0,
          stockQuantity: Math.max(0, Number(v.stockQuantity) || 0),
        }));

      const totalVariantStock = cleanedVariants.reduce(
        (sum, v) => sum + v.stockQuantity,
        0
      );
      const effectiveTotalStock =
        cleanedVariants.length > 0
          ? Math.max(Number(productForm.stockQuantity) || 0, totalVariantStock)
          : Number(productForm.stockQuantity) || 0;

      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          ...productForm,
          priceBdt: Number(productForm.priceBdt),
          salePriceBdt: productForm.salePriceBdt ? Number(productForm.salePriceBdt) : null,
          stockQuantity: effectiveTotalStock,
          lowStockThreshold: Number(productForm.lowStockThreshold),
          galleryUrlsJson: serializedGallery,
          variants: cleanedVariants,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedbackBanner({
        type: 'success',
        text: `পণ্য "${productForm.nameBn}" (কালার/সাইজ ভ্যারিয়েন্ট, ছবি/ভিডিও ও অফারসহ) সফলভাবে সংরক্ষিত হয়েছে।`,
      });
      setShowProductModal(false);
      await fetchAdminOverview();
      onStoreUpdated();
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        text: err.message || 'পণ্য সংরক্ষণ করা যায়নি।',
      });
    } finally {
      setSavingProduct(false);
    }
  };

  const handleCopyPromoLink = async (
    product: { id?: number; slug?: string; sku?: string; nameBn?: string },
    directCheckout = false
  ) => {
    const url = buildProductPromoUrl(product, { directCheckout });
    await copyTextToClipboard(url);
    const key = `${product.id || product.sku}-${directCheckout ? 'checkout' : 'view'}`;
    setCopiedPromoKey(key);
    setFeedbackBanner({
      type: 'success',
      text: directCheckout
        ? `"${product.nameBn || product.sku}"-এর ডিরেক্ট চেকআউট প্রমোশন লিংক কপি হয়েছে: ${url}`
        : `"${product.nameBn || product.sku}"-এর প্রমোশন লিংক কপি হয়েছে: ${url}`,
    });
    setTimeout(() => setCopiedPromoKey((prev) => (prev === key ? null : prev)), 2500);
  };

  const handleDeleteProduct = async (product: { id: number; nameBn: string; sku: string }) => {
    setDeletingProductId(product.id);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'পণ্যটি মুছে ফেলা যায়নি।');
      }
      setConfirmDeleteProductId(null);
      setSelectedProductIds((prev) => prev.filter((id) => id !== product.id));
      if (showProductModal && productForm.id === product.id) {
        setShowProductModal(false);
      }
      setFeedbackBanner({
        type: 'success',
        text: `পণ্য "${product.nameBn}" (SKU: ${product.sku}) সফলভাবে ডিলিট করা হয়েছে।`,
      });
      await fetchAdminOverview();
      onStoreUpdated();
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        text: err.message || 'পণ্যটি মুছে ফেলা যায়নি।',
      });
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleBulkDeleteProducts = async () => {
    if (selectedProductIds.length === 0) return;
    setBulkDeleting(true);
    try {
      const res = await fetch('/api/admin/products/bulk-delete', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ productIds: selectedProductIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'নির্বাচিত পণ্যগুলো মুছে ফেলা যায়নি।');
      }
      const count = data.deletedCount ?? selectedProductIds.length;
      setSelectedProductIds([]);
      setConfirmBulkDelete(false);
      setFeedbackBanner({
        type: 'success',
        text: `মোট ${count}টি পণ্য সফলভাবে ডিলিট করা হয়েছে।`,
      });
      await fetchAdminOverview();
      onStoreUpdated();
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        text: err.message || 'নির্বাচিত পণ্যগুলো মুছে ফেলা যায়নি।',
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          ...couponForm,
          discountValue: Number(couponForm.discountValue),
          minOrderBdt: Number(couponForm.minOrderBdt),
          maxDiscountBdt: couponForm.maxDiscountBdt ? Number(couponForm.maxDiscountBdt) : null,
          usageLimit: Number(couponForm.usageLimit),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedbackBanner({
        type: 'success',
        text: `কুপন কোড "${couponForm.code.toUpperCase()}" সংরক্ষিত হয়েছে।`,
      });
      setCouponForm({
        code: '',
        description: '',
        discountType: 'fixed',
        discountValue: 100,
        minOrderBdt: 1000,
        maxDiscountBdt: '',
        usageLimit: 500,
        isActive: true,
      });
      await fetchAdminOverview();
      onStoreUpdated();
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        text: err.message || 'কুপন সংরক্ষণ করা যায়নি।',
      });
    }
  };

  const handleDeleteCoupon = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('কুপন মুছে ফেলা যায়নি।');
      setFeedbackBanner({
        type: 'success',
        text: 'কুপন কোডটি মুছে ফেলা হয়েছে।',
      });
      await fetchAdminOverview();
      onStoreUpdated();
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        text: err.message || 'কুপন মুছে ফেলা যায়নি।',
      });
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(categoryForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedbackBanner({
        type: 'success',
        text: `ক্যাটাগরি "${categoryForm.nameBn}" সংরক্ষিত হয়েছে।`,
      });
      setCategoryForm({
        name: '',
        nameBn: '',
        description: '',
        sortOrder: categories.length + 1,
        isActive: true,
      });
      await fetchAdminOverview();
      onStoreUpdated();
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        text: err.message || 'ক্যাটাগরি সংরক্ষণ করা যায়নি।',
      });
    }
  };

  const handleBanglaQrImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    if (!file.type.startsWith('image/')) {
      setFeedbackBanner({
        type: 'error',
        text: 'শুধুমাত্র ইমেজ ফাইল (JPG, PNG, WEBP) আপলোড করুন।',
      });
      return;
    }
    try {
      const compressed = await compressImageFileToDataUrl(file, 950, 0.9);
      setSettings({
        ...settings,
        banglaQrImageUrl: compressed,
        banglaQrEnabled: true,
      });
      setFeedbackBanner({
        type: 'success',
        text: 'বাংলা কিউআর ছবি লোড হয়েছে। নিচে "স্টোর ও পেমেন্ট সেটিংস সংরক্ষণ করুন" বাটনে ক্লিক করে সেভ করুন।',
      });
    } catch {
      setFeedbackBanner({
        type: 'error',
        text: 'কিউআর ছবি প্রসেস করতে সমস্যা হয়েছে।',
      });
    }
    e.target.value = '';
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedbackBanner({
        type: 'success',
        text: 'স্টোর সেটিংস, ডেলিভারি চার্জ ও বাংলা কিউআর পেমেন্ট কনফিগারেশন সফলভাবে আপডেট করা হয়েছে।',
      });
      await fetchAdminOverview();
      onStoreUpdated();
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        text: err.message || 'সেটিংস আপডেট করা যায়নি।',
      });
    }
  };

  // Printable Order Invoice View
  if (invoiceOrder) {
    return (
      <div className="min-h-screen bg-white p-8 max-w-3xl mx-auto text-[#172126]">
        <div className="no-print flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setInvoiceOrder(null)}
            className="px-4 py-2 text-sm font-medium bg-slate-100 rounded-lg hover:bg-slate-200 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>অর্ডার তালিকায় ফিরে যান</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-5 py-2.5 text-sm font-semibold bg-[#14213D] text-white rounded-lg hover:bg-[#286F65] flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>ইনভয়েস প্রিন্ট করুন (Print Invoice)</span>
          </button>
        </div>

        <div className="border border-slate-300 rounded-xl p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <h1 className="text-2xl font-bold text-[#14213D]">Boichitra BD — বৈচিত্র্য</h1>
              <p className="text-xs text-slate-600 mt-0.5">Fashion, Gadget &amp; Everything</p>
              <p className="text-xs text-slate-500 mt-1">
                {settings?.businessAddress || 'Sylhet, Bangladesh'}
              </p>
            </div>
            <div className="text-right tabular-nums">
              <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                ORDER INVOICE
              </div>
              <div className="text-lg font-bold font-mono text-[#14213D] mt-0.5">
                {invoiceOrder.orderNumber}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                তারিখ:{' '}
                {new Date(invoiceOrder.createdAt).toLocaleString('en-GB', {
                  timeZone: 'Asia/Dhaka',
                })}
              </div>
              <div className="text-xs font-medium text-[#286F65] mt-0.5">
                পেমেন্ট:{' '}
                {invoiceOrder.paymentMethod === 'BANGLA_QR'
                  ? 'বাংলা কিউআর (Bangla QR)'
                  : invoiceOrder.paymentMethod}{' '}
                ({invoiceOrder.paymentStatus})
              </div>
              {invoiceOrder.manualPayment?.transactionId && (
                <div className="text-[11px] font-mono text-[#006A4E] font-semibold mt-0.5">
                  TrxID: {invoiceOrder.manualPayment.transactionId} (
                  {invoiceOrder.manualPayment.senderPhone})
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-200 text-sm">
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">
                গ্রাহকের তথ্য (Bill &amp; Ship To):
              </div>
              <div className="font-bold text-base">{invoiceOrder.customerNameSnapshot}</div>
              <div className="font-mono text-sm mt-0.5">
                মোবাইল: {invoiceOrder.customerPhoneSnapshot}
              </div>
              <div className="text-slate-700 mt-1">
                {invoiceOrder.shippingAddressSnapshot}, {invoiceOrder.upazilaSnapshot},{' '}
                {invoiceOrder.districtSnapshot}
              </div>
            </div>
            <div className="sm:text-right">
              <div className="text-xs font-semibold text-slate-500 mb-1">অর্ডার স্ট্যাটাস:</div>
              <div className="text-base font-bold text-[#14213D]">{invoiceOrder.orderStatus}</div>
              {invoiceOrder.orderNote && (
                <div className="text-xs text-slate-600 mt-2">নোট: {invoiceOrder.orderNote}</div>
              )}
            </div>
          </div>

          <table className="w-full text-left text-sm my-6 border-collapse">
            <thead>
              <tr className="border-b border-slate-300 text-slate-600 text-xs">
                <th className="py-2.5">পণ্য (Item)</th>
                <th className="py-2.5">SKU / ভ্যারিয়েন্ট</th>
                <th className="py-2.5 text-right">দর (৳)</th>
                <th className="py-2.5 text-right">পরিমাণ</th>
                <th className="py-2.5 text-right">মোট (৳)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 tabular-nums">
              {invoiceOrder.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 font-medium">
                    <div>{item.productNameBnSnapshot}</div>
                    <div className="text-xs text-slate-500">{item.productNameSnapshot}</div>
                  </td>
                  <td className="py-3 text-xs font-mono">
                    {item.skuSnapshot} · {item.variantSnapshot}
                  </td>
                  <td className="py-3 text-right">{formatBdt(item.unitPriceBdt)}</td>
                  <td className="py-3 text-right">{item.quantity}</td>
                  <td className="py-3 text-right font-semibold">
                    {formatBdt(item.lineTotalBdt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end border-t border-slate-300 pt-4">
            <div className="w-72 space-y-1.5 text-sm tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-600">সাবটোটাল:</span>
                <span>{formatBdt(invoiceOrder.subtotalBdt)}</span>
              </div>
              {invoiceOrder.discountBdt > 0 && (
                <div className="flex justify-between text-[#16A34A]">
                  <span>
                    ডিসকাউন্ট
                    {invoiceOrder.couponCode ? ` (${invoiceOrder.couponCode})` : ''}:
                  </span>
                  <span>-{formatBdt(invoiceOrder.discountBdt)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">ডেলিভারি চার্জ:</span>
                <span>{formatBdt(invoiceOrder.deliveryChargeBdt)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-[#14213D] border-t border-slate-300 pt-2">
                <span>সর্বমোট প্রদেয়:</span>
                <span>{formatBdt(invoiceOrder.totalBdt)}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
            Boichitra BD — বৈচিত্র্য থেকে কেনাকাটার জন্য ধন্যবাদ!
          </div>
        </div>
      </div>
    );
  }

  // Site-Native Admin Login / First-Time Setup Screen
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F5F7] p-6">
        <div className="text-sm font-medium text-slate-600">
          অ্যাডমিন সেশন যাচাই করা হচ্ছে...
        </div>
      </div>
    );
  }

  if (!adminUser || !stats) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-[#F3F5F7] px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/90 shadow-sm p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-[#14213D]">Boichitra BD — বৈচিত্র্য</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {isSetupComplete
                  ? 'অ্যাডমিন লগইন (Site-Native Admin Login)'
                  : 'প্রথমবার অ্যাডমিন অ্যাকাউন্ট সেটআপ'}
              </p>
            </div>
            <Lock className="w-6 h-6 text-[#286F65]" />
          </div>

          {authError && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
              {authError}
            </div>
          )}

          {!isSetupComplete ? (
            <form onSubmit={handleInitialSetup} className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 leading-relaxed">
                আপনার ওয়েবসাইটে এখনো কোনো অ্যাডমিন পাসওয়ার্ড সেট করা হয়নি। নিচে আপনার পছন্দের ইমেইল/ইউজারনেম এবং পাসওয়ার্ড দিয়ে সরাসরি সাইট থেকেই অ্যাডমিন অ্যাকাউন্ট চালু করুন।
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  অ্যাডমিনের নাম (Admin Name) *
                </label>
                <input
                  type="text"
                  required
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  placeholder="যেমন: Boichitra Admin"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  অ্যাডমিন ইমেইল বা ইউজারনেম *
                </label>
                <input
                  type="text"
                  required
                  value={setupEmail}
                  onChange={(e) => setSetupEmail(e.target.value)}
                  placeholder="admin@boichitrabd.com"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  placeholder="শক্তিশালী পাসওয়ার্ড দিন"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  পাসওয়ার্ড নিশ্চিত করুন (Confirm Password) *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={setupConfirmPassword}
                  onChange={(e) => setSetupConfirmPassword(e.target.value)}
                  placeholder="পুনরায় পাসওয়ার্ড দিন"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-3 px-4 bg-[#14213D] hover:bg-[#286F65] text-white font-semibold text-sm rounded-xl transition-colors"
              >
                {authSubmitting
                  ? 'সেটআপ হচ্ছে...'
                  : 'অ্যাডমিন অ্যাকাউন্ট তৈরি ও লগইন করুন'}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordLogin} className="space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                আপনার নির্ধারিত ইমেইল/ইউজারনেম এবং পাসওয়ার্ড দিয়ে সরাসরি অ্যাডমিন প্যানেলে প্রবেশ করুন।
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ইমেইল অথবা ইউজারনেম *
                </label>
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="আপনার অ্যাডমিন ইমেইল বা নাম লিখুন"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  পাসওয়ার্ড (Password) *
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-3 px-4 bg-[#14213D] hover:bg-[#286F65] text-white font-semibold text-sm rounded-xl transition-colors"
              >
                {authSubmitting ? 'লগইন হচ্ছে...' : 'লগইন করুন (Sign In)'}
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-slate-100 flex justify-center">
            <button
              type="button"
              onClick={onBackToStore}
              className="text-xs font-medium text-[#286F65] hover:underline flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>মূল স্টোরফ্রন্টে ফিরে যান</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const filteredOrders = orders.filter((o) => {
    if (orderStatusFilter !== 'ALL' && o.orderStatus !== orderStatusFilter) return false;
    if (!orderSearch.trim()) return true;
    const q = orderSearch.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerNameSnapshot.toLowerCase().includes(q) ||
      o.customerPhoneSnapshot.toLowerCase().includes(q)
    );
  });

  const filteredCustomers = customers.filter((c) => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    return (
      c.fullName.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.customerCode.toLowerCase().includes(q) ||
      c.district.toLowerCase().includes(q)
    );
  });

  const filteredProducts = products.filter((p) => {
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.nameBn.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#F3F5F7] text-[#172126]">
      {/* Top Admin Header */}
      <header className="bg-[#14213D] text-white border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBackToStore}
              className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>স্টোর দেখুন</span>
            </button>
            <div className="font-bold text-base tracking-tight whitespace-nowrap">
              Boichitra BD — বৈচিত্র্য অ্যাডমিন প্যানেল
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-slate-300 font-mono">
              {adminUser.name} ({adminUser.email})
            </span>
            <button
              type="button"
              onClick={() => fetchAdminOverview()}
              title="রিফ্রেশ করুন"
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs font-medium bg-red-600/90 hover:bg-red-600 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>লগআউট</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-2 overflow-x-auto pb-2 pt-1">
          {[
            { id: 'dashboard', label: 'ড্যাশবোর্ড', icon: ShieldCheck },
            { id: 'orders', label: `অর্ডার সমূহ (${orders.length})`, icon: ShoppingBag },
            { id: 'customers', label: `কাস্টমার রেকর্ড (${customers.length})`, icon: Users },
            { id: 'products', label: `পণ্য ও স্টক (${products.length})`, icon: Package },
            {
              id: 'offers',
              label: `বিশেষ অফার ও কুপন (${products.filter((p) => p.isSpecialOffer).length})`,
              icon: Sparkles,
            },
            { id: 'categories', label: 'ক্যাটাগরি', icon: FolderTree },
            { id: 'settings', label: 'সেটিংস ও হোস্টিং গাইড', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#286F65] text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {feedbackBanner && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-center justify-between ${
              feedbackBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedbackBanner.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-xs underline ml-4"
            >
              বন্ধ করুন
            </button>
          </div>
        )}

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && stats && (
          <div className="space-y-8">
            {/* Excel Export Bar */}
            <div className="bg-white rounded-xl border border-slate-200/90 p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[#14213D]">
                  এক্সেল রিপোর্ট ও প্রোডাকশন ডিপ্লয়মেন্ট (Exports &amp; ProCloudify Package)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  স্টোর ডেটাবেস থেকে সরাসরি বাংলা ইউনিকোড সমর্থিত Excel (.xlsx) রিপোর্ট অথবা ProCloudify cPanel জিপ ডাউনলোড করুন।
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={downloadingXlsx !== null}
                  onClick={() => handleDownloadXlsx('orders')}
                  className="px-4 py-2.5 bg-[#14213D] hover:bg-[#286F65] text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>
                    {downloadingXlsx === 'orders'
                      ? 'ডাউনলোড হচ্ছে...'
                      : 'অর্ডার রেকর্ড ডাউনলোড (.xlsx)'}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={downloadingXlsx !== null}
                  onClick={() => handleDownloadXlsx('customers')}
                  className="px-4 py-2.5 bg-[#286F65] hover:bg-[#14213D] text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {downloadingXlsx === 'customers'
                      ? 'ডাউনলোড হচ্ছে...'
                      : 'কাস্টমার রেকর্ড ডাউনলোড (.xlsx)'}
                  </span>
                </button>
                <a
                  href="/api/procloudify-cpanel-php.zip"
                  download="Boichitra_BD_ProCloudify_cPanel_PHP.zip"
                  className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                >
                  <Server className="w-4 h-4" />
                  <span>ProCloudify cPanel (PHP - No Node.js) জিপ ডাউনলোড</span>
                </a>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 tabular-nums">
              <div className="bg-white rounded-xl border border-slate-200/80 p-5">
                <div className="text-xs text-slate-500 font-medium">মোট অর্ডার (Total Orders)</div>
                <div className="text-2xl font-bold text-[#14213D] mt-1">{stats.totalOrders}</div>
                <div className="text-xs text-slate-500 mt-2">
                  অপেক্ষমাণ (Pending):{' '}
                  <strong className="text-amber-700">{stats.awaitingConfirmation}</strong>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200/80 p-5">
                <div className="text-xs text-slate-500 font-medium">প্রসেসিং ও ডেলিভার্ড</div>
                <div className="text-2xl font-bold text-[#286F65] mt-1">
                  {stats.processingOrders} / {stats.deliveredOrders}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  বাতিল অর্ডার (Cancelled):{' '}
                  <strong className="text-red-600">{stats.cancelledOrders}</strong>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200/80 p-5">
                <div className="text-xs text-slate-500 font-medium">
                  মোট অর্ডার মূল্য (বাতিল বাদে)
                </div>
                <div className="text-2xl font-bold text-[#14213D] mt-1">
                  {formatBdt(stats.grossOrderValueBdt)}
                </div>
                <div className="text-xs text-slate-500 mt-2">সক্রিয় অর্ডারের মোট মূল্য</div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200/80 p-5">
                <div className="text-xs text-slate-500 font-medium">
                  পরিশোধিত রাজস্ব (Paid Revenue)
                </div>
                <div className="text-2xl font-bold text-[#16A34A] mt-1">
                  {formatBdt(stats.paidRevenueBdt)}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  মোট কাস্টমার: <strong>{stats.totalCustomers} জন</strong>
                </div>
              </div>
            </div>

            {/* Recent Orders & Low Stock Alert */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-[#14213D]">সাম্প্রতিক অর্ডার সমূহ</h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('orders')}
                    className="text-xs font-semibold text-[#286F65] hover:underline"
                  >
                    সব অর্ডার দেখুন →
                  </button>
                </div>

                {orders.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">
                    এখনো কোনো অর্ডার জমা পড়েনি।
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs tabular-nums">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2.5 pr-3">অর্ডার নম্বর</th>
                          <th className="py-2.5 pr-3">গ্রাহক ও মোবাইল</th>
                          <th className="py-2.5 pr-3">জেলা</th>
                          <th className="py-2.5 pr-3">মোট টাকা</th>
                          <th className="py-2.5 pr-3">স্ট্যাটাস</th>
                          <th className="py-2.5 text-right">অ্যাকশন</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orders.slice(0, 8).map((o) => (
                          <tr key={o.id} className="hover:bg-slate-50">
                            <td className="py-3 pr-3 font-mono font-semibold text-[#14213D]">
                              {o.orderNumber}
                            </td>
                            <td className="py-3 pr-3">
                              <div className="font-medium text-slate-900">
                                {o.customerNameSnapshot}
                              </div>
                              <div className="text-slate-500 font-mono">
                                {o.customerPhoneSnapshot}
                              </div>
                            </td>
                            <td className="py-3 pr-3">{o.districtSnapshot}</td>
                            <td className="py-3 pr-3 font-bold">{formatBdt(o.totalBdt)}</td>
                            <td className="py-3 pr-3 font-semibold text-[#286F65]">
                              {o.orderStatus}
                            </td>
                            <td className="py-3 text-right">
                              <button
                                type="button"
                                onClick={() => openOrderModal(o)}
                                className="text-xs font-semibold text-[#14213D] hover:underline"
                              >
                                বিস্তারিত
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-slate-200/80 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-[#14213D] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>কম স্টক সতর্কতা (Low Stock)</span>
                  </h3>
                </div>
                <div className="space-y-3 tabular-nums">
                  {products.filter((p) => p.stockQuantity <= p.lowStockThreshold).length ===
                  0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">
                      সব পণ্যের পর্যাপ্ত স্টক রয়েছে।
                    </p>
                  ) : (
                    products
                      .filter((p) => p.stockQuantity <= p.lowStockThreshold)
                      .map((p) => (
                        <div
                          key={p.id}
                          className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/80 flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="text-xs font-semibold text-slate-900">
                              {p.nameBn}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              SKU: {p.sku}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-red-700">
                              স্টক: {p.stockQuantity} টি
                            </span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ORDERS MANAGEMENT */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <div className="relative flex-1 min-w-[240px] max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="অর্ডার নম্বর, নাম বা মোবাইল দিয়ে খুঁজুন..."
                    className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#286F65]"
                  />
                </div>

                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="ALL">সকল স্ট্যাটাস (All Statuses)</option>
                  <option value="Pending">Pending (অপেক্ষমাণ)</option>
                  <option value="Confirmed">Confirmed (কনফার্মড)</option>
                  <option value="Processing">Processing (প্রসেসিং)</option>
                  <option value="Shipped">Shipped (কুরিয়ারে পাঠানো হয়েছে)</option>
                  <option value="Delivered">Delivered (ডেলিভার্ড)</option>
                  <option value="Cancelled">Cancelled (বাতিল)</option>
                  <option value="Returned">Returned (রিটার্নড)</option>
                  <option value="Refunded">Refunded (রিফান্ডেড)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => handleDownloadXlsx('orders')}
                className="px-4 py-2 bg-[#14213D] hover:bg-[#286F65] text-white text-xs font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>অর্ডার এক্সেল ডাউনলোড (.xlsx)</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-3 pr-3">অর্ডার নম্বর ও তারিখ</th>
                    <th className="py-3 pr-3">গ্রাহক</th>
                    <th className="py-3 pr-3">ঠিকানা</th>
                    <th className="py-3 pr-3">পণ্য সংখ্যা</th>
                    <th className="py-3 pr-3">সর্বমোট (৳)</th>
                    <th className="py-3 pr-3">পেমেন্ট</th>
                    <th className="py-3 pr-3">অর্ডার স্ট্যাটাস</th>
                    <th className="py-3 text-right">ম্যানেজ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="py-3.5 pr-3">
                        <div className="font-mono font-bold text-[#14213D]">{o.orderNumber}</div>
                        <div className="text-[11px] text-slate-500">
                          {new Date(o.createdAt).toLocaleString('en-GB', {
                            timeZone: 'Asia/Dhaka',
                          })}
                        </div>
                      </td>
                      <td className="py-3.5 pr-3">
                        <div className="font-semibold text-slate-900">
                          {o.customerNameSnapshot}
                        </div>
                        <div className="font-mono text-slate-600">
                          {o.customerPhoneSnapshot}
                        </div>
                      </td>
                      <td className="py-3.5 pr-3 max-w-[200px]">
                        <div className="truncate">{o.shippingAddressSnapshot}</div>
                        <div className="text-slate-500">
                          {o.upazilaSnapshot}, {o.districtSnapshot}
                        </div>
                      </td>
                      <td className="py-3.5 pr-3">{o.items.length} টি আইটেম</td>
                      <td className="py-3.5 pr-3 font-bold text-[#14213D]">
                        {formatBdt(o.totalBdt)}
                      </td>
                      <td className="py-3.5 pr-3">
                        <div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                              o.paymentMethod === 'BANGLA_QR'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {o.paymentMethod === 'BANGLA_QR' ? 'বাংলা কিউআর' : o.paymentMethod}
                          </span>{' '}
                          ·{' '}
                          <span
                            className={
                              o.paymentStatus === 'PAID'
                                ? 'text-[#16A34A] font-bold'
                                : o.paymentStatus === 'VERIFICATION_PENDING'
                                ? 'text-amber-700 font-bold'
                                : 'text-slate-600 font-medium'
                            }
                          >
                            {o.paymentStatus === 'VERIFICATION_PENDING'
                              ? 'যাচাই অপেক্ষমাণ'
                              : o.paymentStatus}
                          </span>
                        </div>
                        {o.manualPayment && (
                          <div className="text-[11px] font-mono text-slate-600 mt-1">
                            TrxID: <strong className="text-[#14213D]">{o.manualPayment.transactionId}</strong>
                            {' · '}
                            {o.manualPayment.senderPhone}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 pr-3 font-semibold text-[#286F65]">
                        {o.orderStatus}
                      </td>
                      <td className="py-3.5 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openOrderModal(o)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-[#14213D] hover:text-white rounded text-xs font-medium transition-colors"
                        >
                          আপডেট
                        </button>
                        <button
                          type="button"
                          onClick={() => setInvoiceOrder(o)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-[#286F65] hover:text-white rounded text-xs font-medium transition-colors"
                        >
                          ইনভয়েস
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CUSTOMERS MANAGEMENT */}
        {activeTab === 'customers' && (
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="গ্রাহকের নাম, মোবাইল নম্বর, আইডি বা জেলা দিয়ে খুঁজুন..."
                  className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#286F65]"
                />
              </div>

              <button
                type="button"
                onClick={() => handleDownloadXlsx('customers')}
                className="px-4 py-2 bg-[#286F65] hover:bg-[#14213D] text-white text-xs font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>কাস্টমার তালিকা ডাউনলোড (.xlsx)</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-3 pr-3">কাস্টমার আইডি</th>
                    <th className="py-3 pr-3">নাম ও মোবাইল</th>
                    <th className="py-3 pr-3">ডেলিভারি ঠিকানা</th>
                    <th className="py-3 pr-3">মোট অর্ডার</th>
                    <th className="py-3 pr-3">মোট অর্ডার মূল্য</th>
                    <th className="py-3 pr-3">প্রথম ও সর্বশেষ অর্ডার</th>
                    <th className="py-3 text-right">অর্ডার হিস্ট্রি</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-3.5 pr-3 font-mono font-semibold text-[#14213D]">
                        {c.customerCode}
                      </td>
                      <td className="py-3.5 pr-3">
                        <div className="font-semibold text-slate-900">{c.fullName}</div>
                        <div className="font-mono text-slate-600">{c.phone}</div>
                        {c.email && (
                          <div className="text-[11px] text-slate-400">{c.email}</div>
                        )}
                      </td>
                      <td className="py-3.5 pr-3 max-w-[240px]">
                        <div className="truncate">{c.addressLine}</div>
                        <div className="text-slate-500">
                          {c.upazila}, {c.district}
                        </div>
                      </td>
                      <td className="py-3.5 pr-3 font-bold">{c.totalOrders} টি</td>
                      <td className="py-3.5 pr-3 font-bold text-[#286F65]">
                        {formatBdt(c.totalSpentBdt)}
                      </td>
                      <td className="py-3.5 pr-3 text-[11px] text-slate-500">
                        <div>
                          প্রথম: {new Date(c.firstOrderAt).toLocaleDateString('en-GB')}
                        </div>
                        <div>
                          সর্বশেষ: {new Date(c.lastOrderAt).toLocaleDateString('en-GB')}
                        </div>
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(c)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-[#14213D] hover:text-white rounded text-xs font-medium transition-colors"
                        >
                          অর্ডার দেখুন
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: PRODUCTS MANAGEMENT */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            {/* Business Koro (businesskoro.com) Auto Product Sync & Dropshipping Panel */}
            <div className="bg-white rounded-xl border-2 border-[#286F65]/30 p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-[#14213D] text-white text-[11px] font-bold tracking-wide">
                      DROPSHIPPING AUTO-SYNC
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                        bkStatus?.hasServerApiKey
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {bkStatus?.hasServerApiKey
                        ? '✓ সার্ভার BUSINESSKORO_API_KEY সংযুক্ত'
                        : '⚡ বিল্ট-ইন BusinessKoro রিসেলার ক্যাটালগ রেডি (সার্ভার .env কি ঐচ্ছিক)'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#14213D] mt-2">
                    Business Koro (businesskoro.com) অটো প্রোডাক্ট সিঙ্ক ও রিসেলার ইন্টিগ্রেশন
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    ১-ক্লিকে Business Koro-এর সকল পণ্য, ক্যাটাগরি, ছবি, স্টক এবং কাপড়ের আলাদা কালার ও সাইজ ভ্যারিয়েন্ট আপনার নির্ধারিত রিসেলার প্রফিট মার্জিনসহ স্বয়ংক্রিয়ভাবে স্টোরে যুক্ত করুন।
                  </p>
                </div>

                <div className="text-right text-xs tabular-nums bg-slate-50 px-3.5 py-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-500">সিঙ্ককৃত BusinessKoro পণ্য</div>
                  <div className="text-lg font-extrabold text-[#286F65]">
                    {bkStatus?.syncedProductsCount ??
                      products.filter((p) => p.sku.startsWith('BBD-BK-')).length}{' '}
                    টি পণ্য
                  </div>
                  {bkStatus?.lastSyncAt && (
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      সর্বশেষ সিঙ্ক:{' '}
                      {new Date(bkStatus.lastSyncAt).toLocaleString('en-GB', {
                        timeZone: 'Asia/Dhaka',
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    অতিরিক্ত মার্কআপ (%) [০% = Suggested Price]
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    value={bkMarkupPct}
                    onChange={(e) => setBkMarkupPct(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#286F65] font-semibold"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    ০% রাখলে BusinessKoro-এর Suggested Price সরাসরি সেট হবে
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    অতিরিক্ত ফিক্সড মার্জিন (৳ BDT)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={bkFixedMarkupBdt}
                    onChange={(e) => setBkFixedMarkupBdt(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#286F65] font-semibold"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    প্রতি পণ্যে নির্দিষ্ট টাকা যোগ করতে চাইলে (ঐচ্ছিক)
                  </span>
                </div>

                <div className="flex flex-col justify-center gap-2 bg-slate-50/80 px-3 py-2 rounded-lg border border-slate-200/80">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bkAutoPublish}
                      onChange={(e) => setBkAutoPublish(e.target.checked)}
                      className="rounded border-slate-300 text-[#286F65]"
                    />
                    <span>সিঙ্কের সাথে সাথে স্টোরে লাইভ (Auto-Publish)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bkUpdateExistingPrices}
                      onChange={(e) => setBkUpdateExistingPrices(e.target.checked)}
                      className="rounded border-slate-300 text-[#286F65]"
                    />
                    <span>পূর্ববর্তী পণ্যের মূল্য ও স্টক আপডেট করুন</span>
                  </label>
                </div>

                <div className="flex items-center">
                  <button
                    type="button"
                    disabled={syncingBusinessKoro}
                    onClick={handleBusinessKoroSync}
                    className="w-full py-3 px-4 bg-[#286F65] hover:bg-[#14213D] disabled:opacity-60 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <RefreshCw
                      className={`w-4 h-4 shrink-0 ${
                        syncingBusinessKoro ? 'animate-spin' : ''
                      }`}
                    />
                    <span>
                      {syncingBusinessKoro
                        ? 'Business Koro থেকে সিঙ্ক হচ্ছে...'
                        : 'Business Koro থেকে সকল পণ্য অটো-ইমপোর্ট করুন'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-slate-600 bg-slate-50 px-3.5 py-2 rounded-lg border border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>অটো প্রোডাক্ট ও অর্ডার সিঙ্ক সক্রিয়:</strong> প্রোডাক্ট লিস্ট{' '}
                  <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[#14213D]">
                    GET /api/v1/storefront/products
                  </code>{' '}
                  এবং কাস্টমার অর্ডার{' '}
                  <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[#14213D]">
                    POST /api/v1/storefront/orders
                  </code>{' '}
                  স্বয়ংক্রিয়ভাবে সংযুক্ত।
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  Endpoint: {bkStatus?.endpointUrl || 'https://api.businesskoro.com/api/v1/storefront/products'}
                </span>
              </div>
            </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="পণ্যের নাম বা SKU দিয়ে খুঁজুন..."
                  className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#286F65]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedProductIds.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                    <span className="text-xs font-bold text-red-800">
                      {selectedProductIds.length}টি নির্বাচিত
                    </span>
                    {confirmBulkDelete ? (
                      <>
                        <button
                          type="button"
                          disabled={bulkDeleting}
                          onClick={handleBulkDeleteProducts}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold"
                        >
                          {bulkDeleting ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, ডিলিট করুন'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmBulkDelete(false)}
                          className="px-2 py-1 bg-white border border-slate-300 text-slate-700 rounded text-xs font-semibold"
                        >
                          না
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmBulkDelete(true)}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>নির্বাচিত পণ্য ডিলিট করুন</span>
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={openNewProductModal}
                  className="px-4 py-2.5 bg-[#14213D] hover:bg-[#286F65] text-white text-xs font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>নতুন পণ্য যুক্ত করুন (Add Product)</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-3 pr-2 w-8">
                      <input
                        type="checkbox"
                        aria-label="সব পণ্য সিলেক্ট করুন"
                        checked={
                          filteredProducts.length > 0 &&
                          filteredProducts.every((p) => selectedProductIds.includes(p.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProductIds(filteredProducts.map((p) => p.id));
                          } else {
                            setSelectedProductIds([]);
                            setConfirmBulkDelete(false);
                          }
                        }}
                        className="rounded border-slate-300"
                      />
                    </th>
                    <th className="py-3 pr-3">পণ্য</th>
                    <th className="py-3 pr-3">SKU</th>
                    <th className="py-3 pr-3">মূল্য (Regular / Sale)</th>
                    <th className="py-3 pr-3">স্টক</th>
                    <th className="py-3 pr-3">স্ট্যাটাস</th>
                    <th className="py-3 text-right">প্রমোশন লিংক ও অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => {
                    const parsedMedia = parseProductGalleryAndOffer(p);
                    const isChecked = selectedProductIds.includes(p.id);
                    const viewPromoKey = `${p.id}-view`;
                    const checkoutPromoKey = `${p.id}-checkout`;
                    return (
                      <tr key={p.id} className={isChecked ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}>
                        <td className="py-3 pr-2">
                          <input
                            type="checkbox"
                            aria-label={`${p.nameBn} সিলেক্ট করুন`}
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProductIds((prev) =>
                                  prev.includes(p.id) ? prev : [...prev, p.id]
                                );
                              } else {
                                setSelectedProductIds((prev) =>
                                  prev.filter((id) => id !== p.id)
                                );
                              }
                            }}
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="py-3 pr-3 flex items-center gap-3">
                          <div className="w-12 h-10 rounded bg-slate-100 overflow-hidden shrink-0">
                            <ResilientProductImage
                              src={p.imageUrl}
                              alt={p.nameBn}
                              sku={p.sku}
                            />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{p.nameBn}</div>
                            <div className="text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>{p.name}</span>
                              <span className="text-[11px] text-[#286F65] font-medium">
                                · {parsedMedia.imageCount}টি ছবি
                                {parsedMedia.videoCount > 0
                                  ? `, ${parsedMedia.videoCount}টি ভিডিও`
                                  : ''}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-3 font-mono">{p.sku}</td>
                        <td className="py-3 pr-3">
                          <span className="font-bold text-[#14213D]">
                            {formatBdt(p.salePriceBdt || p.priceBdt)}
                          </span>
                          {p.salePriceBdt && (
                            <span className="text-slate-400 line-through ml-1.5">
                              {formatBdt(p.priceBdt)}
                            </span>
                          )}
                          {p.isSpecialOffer && (
                            <div className="text-[10px] font-semibold text-[#16A34A] mt-0.5">
                              {parsedMedia.offerMeta.badgeText || '🔥 বিশেষ অফার'}
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <span
                            className={
                              p.stockQuantity <= p.lowStockThreshold
                                ? 'text-red-600 font-bold'
                                : 'text-slate-800 font-medium'
                            }
                          >
                            {p.stockQuantity} টি
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          {p.isPublished ? (
                            <span className="text-[#16A34A] font-semibold">Published</span>
                          ) : (
                            <span className="text-slate-400">Draft/Hidden</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCopyPromoLink(p, false)}
                              title="প্রমোশনের জন্য পণ্যের ডিরেক্ট লিংক কপি করুন"
                              className={`px-2.5 py-1.5 rounded text-[11px] font-semibold inline-flex items-center gap-1 transition-colors ${
                                copiedPromoKey === viewPromoKey
                                  ? 'bg-[#16A34A] text-white'
                                  : 'bg-emerald-50 hover:bg-[#286F65] text-[#006A4E] hover:text-white border border-emerald-200'
                              }`}
                            >
                              {copiedPromoKey === viewPromoKey ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>কপি হয়েছে!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>প্রমো লিংক</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyPromoLink(p, true)}
                              title="ফেসবুক অ্যাডস ডিরেক্ট চেকআউট লিংক কপি করুন"
                              className={`px-2.5 py-1.5 rounded text-[11px] font-semibold inline-flex items-center gap-1 transition-colors ${
                                copiedPromoKey === checkoutPromoKey
                                  ? 'bg-[#16A34A] text-white'
                                  : 'bg-slate-100 hover:bg-[#14213D] text-[#14213D] hover:text-white'
                              }`}
                            >
                              <Share2 className="w-3 h-3" />
                              <span>
                                {copiedPromoKey === checkoutPromoKey
                                  ? 'চেকআউট লিংক কপি!'
                                  : 'অ্যাড লিংক'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditProductModal(p)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-[#14213D] hover:text-white rounded text-[11px] font-medium inline-flex items-center gap-1 transition-colors"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>এডিট</span>
                            </button>

                            {confirmDeleteProductId === p.id ? (
                              <div className="inline-flex items-center gap-1 bg-red-50 border border-red-200 px-2 py-1 rounded">
                                <span className="text-[10px] font-bold text-red-700">মুছবেন?</span>
                                <button
                                  type="button"
                                  disabled={deletingProductId === p.id}
                                  onClick={() => handleDeleteProduct(p)}
                                  className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold"
                                >
                                  {deletingProductId === p.id ? '...' : 'হ্যাঁ'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteProductId(null)}
                                  className="px-1.5 py-0.5 bg-white border border-slate-300 text-slate-700 rounded text-[10px] font-semibold"
                                >
                                  না
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteProductId(p.id)}
                                title="পণ্যটি ডিলিট করুন"
                                className="px-2.5 py-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 rounded text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>ডিলিট</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        )}

        {/* TAB 4B: SPECIAL OFFERS, FLASH DEALS & COUPONS MANAGEMENT */}
        {activeTab === 'offers' && (
          <div className="space-y-6">
            {/* Active Special Offer Products Manager */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-[#14213D] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#286F65]" />
                    <span>বিশেষ অফার ও ফ্ল্যাশ ডিল পণ্যসমূহ (Special Offer Campaign)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    যেকোনো পণ্যে ডিসকাউন্ট মূল্য, অফার ব্যাজ (যেমন: 🔥 ফ্ল্যাশ ডিল), কাউন্টডাউন টাইমার এবং অফার নোট যুক্ত করুন।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNewProductModal}
                  className="px-4 py-2 bg-[#14213D] hover:bg-[#286F65] text-white text-xs font-semibold rounded-lg flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>নতুন অফার পণ্য যোগ করুন</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 tabular-nums">
                {products.map((p) => {
                  const parsed = parseProductGalleryAndOffer(p);
                  const salePrice = p.salePriceBdt || p.priceBdt;
                  const discountPct =
                    p.salePriceBdt && p.salePriceBdt < p.priceBdt
                      ? Math.round(((p.priceBdt - p.salePriceBdt) / p.priceBdt) * 100)
                      : 0;

                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                        p.isSpecialOffer
                          ? 'bg-emerald-50/40 border-[#286F65]/40'
                          : 'bg-slate-50/60 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-14 rounded-lg overflow-hidden bg-white border border-slate-200 shrink-0">
                          <ResilientProductImage
                            src={p.imageUrl}
                            alt={p.nameBn}
                            sku={p.sku}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {p.isSpecialOffer ? (
                              <span className="px-2 py-0.5 rounded bg-[#14213D] text-white text-[10px] font-bold">
                                {parsed.offerMeta.badgeText || '🔥 ফ্ল্যাশ ডিল'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-medium">
                                সাধারণ পণ্য
                              </span>
                            )}
                            {discountPct > 0 && (
                              <span className="text-[11px] font-bold text-[#16A34A]">
                                {discountPct}% ছাড়
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-[#14213D] truncate mt-1">
                            {p.nameBn}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            অফার মূল্য: <strong>{formatBdt(salePrice)}</strong>{' '}
                            {p.salePriceBdt && (
                              <span className="line-through text-slate-400 ml-1">
                                {formatBdt(p.priceBdt)}
                              </span>
                            )}
                          </div>
                          {parsed.offerMeta.dealNote && (
                            <div className="text-[11px] text-[#286F65] truncate mt-0.5">
                              ★ {parsed.offerMeta.dealNote}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 text-xs">
                        <span className="text-slate-500">
                          মিডিয়া: {parsed.imageCount} ছবি · {parsed.videoCount} ভিডিও
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyPromoLink(p, false)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-[#286F65] text-[#006A4E] hover:text-white border border-emerald-200 rounded-lg font-semibold text-[11px] inline-flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            <span>প্রমো লিংক</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditProductModal(p)}
                            className="px-2.5 py-1.5 bg-[#14213D] hover:bg-[#286F65] text-white rounded-lg font-semibold text-[11px]"
                          >
                            কাস্টমাইজ
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p)}
                            title="পণ্যটি ডিলিট করুন"
                            className="p-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Promotional Coupon Codes Manager */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-slate-200/80 p-5">
                <h3 className="text-base font-bold text-[#14213D] mb-4">
                  {couponForm.id ? 'কুপন কোড সম্পাদনা করুন' : 'নতুন ডিসকাউন্ট কুপন তৈরি করুন'}
                </h3>
                <form onSubmit={handleSaveCoupon} className="space-y-3.5 text-xs tabular-nums">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      কুপন কোড (Coupon Code) *
                    </label>
                    <input
                      type="text"
                      required
                      value={couponForm.code}
                      onChange={(e) =>
                        setCouponForm({
                          ...couponForm,
                          code: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="যেমন: DHAKA50, EID200, FLASH15"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      অফার বিবরণ (বাংলায়) *
                    </label>
                    <input
                      type="text"
                      required
                      value={couponForm.description}
                      onChange={(e) =>
                        setCouponForm({ ...couponForm, description: e.target.value })
                      }
                      placeholder="যেমন: ৳১,৫০০+ অর্ডারে ৳১০০ বিশেষ ছাড়"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        ছাড়ের ধরন
                      </label>
                      <select
                        value={couponForm.discountType}
                        onChange={(e) =>
                          setCouponForm({
                            ...couponForm,
                            discountType: e.target.value as 'fixed' | 'percentage',
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="fixed">নির্দিষ্ট টাকা (৳ Fixed)</option>
                        <option value="percentage">শতাংশ (% Percentage)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        {couponForm.discountType === 'percentage'
                          ? 'ছাড়ের হার (%)'
                          : 'ছাড়ের পরিমাণ (৳)'}
                      </label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={couponForm.discountValue}
                        onChange={(e) =>
                          setCouponForm({
                            ...couponForm,
                            discountValue: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        ন্যূনতম অর্ডার (৳)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={couponForm.minOrderBdt}
                        onChange={(e) =>
                          setCouponForm({
                            ...couponForm,
                            minOrderBdt: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        সর্বোচ্চ ছাড় (৳ ঐচ্ছিক)
                      </label>
                      <input
                        type="number"
                        value={couponForm.maxDiscountBdt}
                        onChange={(e) =>
                          setCouponForm({
                            ...couponForm,
                            maxDiscountBdt: e.target.value,
                          })
                        }
                        placeholder="যেমন: 300"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={couponForm.isActive}
                      onChange={(e) =>
                        setCouponForm({ ...couponForm, isActive: e.target.checked })
                      }
                    />
                    <span className="font-semibold">কুপনটি সক্রিয় (Active)</span>
                  </label>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-[#14213D] hover:bg-[#286F65] text-white font-semibold rounded-lg"
                    >
                      কুপন সংরক্ষণ করুন
                    </button>
                    {couponForm.id && (
                      <button
                        type="button"
                        onClick={() =>
                          setCouponForm({
                            code: '',
                            description: '',
                            discountType: 'fixed',
                            discountValue: 100,
                            minOrderBdt: 1000,
                            maxDiscountBdt: '',
                            usageLimit: 500,
                            isActive: true,
                          })
                        }
                        className="px-3 py-2.5 bg-slate-100 rounded-lg"
                      >
                        বাতিল
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5">
                <h3 className="text-base font-bold text-[#14213D] mb-4">
                  সক্রিয় প্রমো ও ডিসকাউন্ট কুপন তালিকা
                </h3>
                <div className="divide-y divide-slate-100 text-xs tabular-nums">
                  {coupons.map((c) => (
                    <div
                      key={c.id}
                      className="py-3.5 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-[#14213D] bg-slate-100 px-2.5 py-0.5 rounded">
                            {c.code}
                          </span>
                          <span className="font-semibold text-[#16A34A]">
                            {c.discountType === 'percentage'
                              ? `${c.discountValue}% ছাড়`
                              : `৳${c.discountValue} ছাড়`}
                          </span>
                          <span className="text-slate-400">
                            (ন্যূনতম অর্ডার: {formatBdt(c.minOrderBdt)})
                          </span>
                        </div>
                        <div className="text-slate-600 mt-1">{c.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCouponForm({
                              id: c.id,
                              code: c.code,
                              description: c.description,
                              discountType:
                                c.discountType === 'percentage' ? 'percentage' : 'fixed',
                              discountValue: c.discountValue,
                              minOrderBdt: c.minOrderBdt,
                              maxDiscountBdt: c.maxDiscountBdt ? String(c.maxDiscountBdt) : '',
                              usageLimit: c.usageLimit || 500,
                              isActive: c.isActive !== false,
                            })
                          }
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded font-medium"
                        >
                          এডিট
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCoupon(c.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CATEGORIES MANAGEMENT */}
        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-slate-200/80 p-5">
              <h3 className="text-base font-bold text-[#14213D] mb-4">
                {categoryForm.id ? 'ক্যাটাগরি সম্পাদনা করুন' : 'নতুন ক্যাটাগরি তৈরি করুন'}
              </h3>
              <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    ক্যাটাগরির নাম (বাংলা) *
                  </label>
                  <input
                    type="text"
                    required
                    value={categoryForm.nameBn}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, nameBn: e.target.value })
                    }
                    placeholder="যেমন: স্মার্ট গ্যাজেট ও অডিও"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Category Name (English) *
                  </label>
                  <input
                    type="text"
                    required
                    value={categoryForm.name}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, name: e.target.value })
                    }
                    placeholder="e.g. Smart Gadgets & Audio"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">বিবরণ</label>
                  <input
                    type="text"
                    value={categoryForm.description}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block font-semibold text-slate-700 mb-1">
                      ক্রম (Order)
                    </label>
                    <input
                      type="number"
                      value={categoryForm.sortOrder}
                      onChange={(e) =>
                        setCategoryForm({
                          ...categoryForm,
                          sortOrder: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <label className="flex items-center gap-2 mt-5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={categoryForm.isActive}
                      onChange={(e) =>
                        setCategoryForm({ ...categoryForm, isActive: e.target.checked })
                      }
                    />
                    <span className="font-semibold">সক্রিয় (Active)</span>
                  </label>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#14213D] hover:bg-[#286F65] text-white font-semibold rounded-lg"
                  >
                    সংরক্ষণ করুন
                  </button>
                  {categoryForm.id && (
                    <button
                      type="button"
                      onClick={() =>
                        setCategoryForm({
                          name: '',
                          nameBn: '',
                          description: '',
                          sortOrder: categories.length + 1,
                          isActive: true,
                        })
                      }
                      className="px-3 py-2.5 bg-slate-100 rounded-lg"
                    >
                      বাতিল
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5">
              <h3 className="text-base font-bold text-[#14213D] mb-4">সকল ক্যাটাগরি সমূহ</h3>
              <div className="divide-y divide-slate-100 text-xs">
                {categories.map((cat) => (
                  <div key={cat.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-slate-900">
                        {cat.nameBn}{' '}
                        <span className="text-slate-500 font-normal">({cat.name})</span>
                      </div>
                      <div className="text-slate-500 mt-0.5">{cat.description}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          cat.isActive ? 'text-[#16A34A] font-semibold' : 'text-slate-400'
                        }
                      >
                        {cat.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCategoryForm({
                            id: cat.id,
                            name: cat.name,
                            nameBn: cat.nameBn,
                            description: cat.description || '',
                            sortOrder: cat.sortOrder,
                            isActive: cat.isActive,
                          })
                        }
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-medium"
                      >
                        এডিট
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: STORE SETTINGS, PASSWORD CHANGE & AUDIT LOGS */}
        {activeTab === 'settings' && settings && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Store Settings Form */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-6">
                <h3 className="text-base font-bold text-[#14213D] mb-4">
                  স্টোর কনফিগারেশন ও ডেলিভারি চার্জ সেটিংস
                </h3>
                <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                  {/* Quick Free Delivery Control Box */}
                  <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-[#286F65]/30 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-[#14213D] flex items-center gap-1.5">
                        🚚 ফ্রি ডেলিভারি কুইক কন্ট্রোল (Free Delivery Setup)
                      </span>
                      {settings.sylhetDeliveryBdt === 0 &&
                      settings.outsideSylhetDeliveryBdt === 0 ? (
                        <span className="px-2.5 py-0.5 rounded-md bg-[#286F65] text-white font-bold text-[11px]">
                          ✓ সকল অর্ডারে ফ্রি ডেলিভারি চালু আছে
                        </span>
                      ) : settings.sylhetDeliveryBdt === 0 ? (
                        <span className="px-2.5 py-0.5 rounded-md bg-amber-600 text-white font-bold text-[11px]">
                          ঢাকার ভিতরে ফ্রি ডেলিভারি চালু আছে
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      আপনি চাইলে এক ক্লিকেই পুরো স্টোরের সব অর্ডারে ডেলিভারি চার্জ সম্পূর্ণ ফ্রি (৳০) করে দিতে পারেন, অথবা নিচের বক্সে পছন্দমতো চার্জ বসিয়ে Save করতে পারেন। এছাড়া নির্দিষ্ট কোনো পণ্যে ফ্রি ডেলিভারি দিতে চাইলে <strong>পণ্য ও স্টক</strong> ট্যাব থেকে পণ্যটি Edit করে <strong>&ldquo;🚚 ফ্রি ডেলিভারি&rdquo;</strong> টিক দিন।
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setSettings({
                            ...settings,
                            sylhetDeliveryBdt: 0,
                            outsideSylhetDeliveryBdt: 0,
                          })
                        }
                        className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                          settings.sylhetDeliveryBdt === 0 &&
                          settings.outsideSylhetDeliveryBdt === 0
                            ? 'bg-[#286F65] text-white shadow-sm'
                            : 'bg-white text-[#286F65] border border-[#286F65]/40 hover:bg-emerald-100/50'
                        }`}
                      >
                        ✓ সকল অর্ডারে ফ্রি ডেলিভারি (৳০)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSettings({
                            ...settings,
                            sylhetDeliveryBdt: 0,
                            outsideSylhetDeliveryBdt:
                              settings.outsideSylhetDeliveryBdt > 0
                                ? settings.outsideSylhetDeliveryBdt
                                : 130,
                          })
                        }
                        className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                          settings.sylhetDeliveryBdt === 0 &&
                          settings.outsideSylhetDeliveryBdt > 0
                            ? 'bg-[#14213D] text-white shadow-sm'
                            : 'bg-white text-[#14213D] border border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        শুধুমাত্র ঢাকার ভিতরে ফ্রি (৳০)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSettings({
                            ...settings,
                            sylhetDeliveryBdt: 70,
                            outsideSylhetDeliveryBdt: 130,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg font-semibold text-[11px] bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition cursor-pointer"
                      >
                        রেগুলার চার্জ (৳৭০ / ৳১৩০)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        ঢাকার ভিতরে ডেলিভারি চার্জ (৳)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={settings.sylhetDeliveryBdt}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            sylhetDeliveryBdt: Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        ঢাকার বাইরে ডেলিভারি চার্জ (৳)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={settings.outsideSylhetDeliveryBdt}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            outsideSylhetDeliveryBdt: Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        ফ্রি ডেলিভারি ন্যূনতম অর্ডার (৳)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={settings.freeDeliveryThresholdBdt}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            freeDeliveryThresholdBdt: Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      কাস্টমার সাপোর্ট ও হেল্পলাইন নম্বর
                    </label>
                    <input
                      type="text"
                      value={settings.contactPhone}
                      onChange={(e) =>
                        setSettings({ ...settings, contactPhone: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      সাপোর্ট ইমেইল
                    </label>
                    <input
                      type="email"
                      value={settings.contactEmail}
                      onChange={(e) =>
                        setSettings({ ...settings, contactEmail: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      ব্যবসায়িক ঠিকানা
                    </label>
                    <input
                      type="text"
                      value={settings.businessAddress}
                      onChange={(e) =>
                        setSettings({ ...settings, businessAddress: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      রিটার্ন ও রিফান্ড পলিসি
                    </label>
                    <textarea
                      rows={3}
                      value={settings.returnPolicyText}
                      onChange={(e) =>
                        setSettings({ ...settings, returnPolicyText: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>

                  {/* Bangla QR Manual Payment Configuration Section */}
                  <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/80 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-[#14213D]">
                          বাংলা কিউআর (Bangla QR) ম্যানুয়াল পেমেন্ট সেটিংস
                        </h4>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          আপনার দোকান বা মার্চেন্টের বাংলা কিউআর ছবি আপলোড করুন। কাস্টমাররা চেকআউটের সময় স্ক্যান করে পেমেন্ট ও TrxID দিতে পারবেন।
                        </p>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-emerald-300">
                        <input
                          type="checkbox"
                          checked={settings.banglaQrEnabled !== false}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              banglaQrEnabled: e.target.checked,
                            })
                          }
                        />
                        <span className="font-bold text-emerald-900">বাংলা কিউআর সক্রিয়</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                      <div className="bg-white p-3 rounded-xl border border-emerald-200 text-center space-y-2">
                        <div className="text-[11px] font-bold text-slate-700">
                          বর্তমান বাংলা কিউআর প্রিভিউ
                        </div>
                        <div className="w-full aspect-[4/5] max-w-[170px] mx-auto rounded-lg overflow-hidden border border-slate-200 bg-white flex items-center justify-center">
                          <img
                            src={
                              settings.banglaQrImageUrl ||
                              createDefaultBanglaQrSvg(
                                settings.banglaQrMerchantName,
                                settings.banglaQrAccountNumber
                              )
                            }
                            alt="Bangla QR Preview"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <label className="block w-full py-2 px-3 bg-[#286F65] hover:bg-[#14213D] text-white font-semibold rounded-lg cursor-pointer transition-colors text-[11px]">
                          <span>কিউআর ছবি আপলোড করুন</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleBanglaQrImageUpload}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              banglaQrImageUrl: createDefaultBanglaQrSvg(
                                settings.banglaQrMerchantName || 'Boichitra BD — বৈচিত্র্য',
                                settings.banglaQrAccountNumber || 'বাংলা কিউআর মার্চেন্ট'
                              ),
                            })
                          }
                          className="w-full py-1 text-[11px] text-slate-600 hover:text-red-600 underline"
                        >
                          ডিফল্ট টেমপ্লেট রিসেট করুন
                        </button>
                      </div>

                      <div className="sm:col-span-2 space-y-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            মার্চেন্ট / প্রতিষ্ঠানের নাম (কিউআর হেডারে দেখাবে)
                          </label>
                          <input
                            type="text"
                            value={settings.banglaQrMerchantName || 'Boichitra BD — বৈচিত্র্য'}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                banglaQrMerchantName: e.target.value,
                              })
                            }
                            placeholder="Boichitra BD — বৈচিত্র্য"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            রিসিভার অ্যাকাউন্ট / বিকাশ / নগদ / ব্যাংক তথ্য
                          </label>
                          <input
                            type="text"
                            value={
                              settings.banglaQrAccountNumber ||
                              'বাংলা কিউআর মার্চেন্ট / পার্সোনাল রিসিভার'
                            }
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                banglaQrAccountNumber: e.target.value,
                              })
                            }
                            placeholder="যেমন: 017XXXXXXXX (বিকাশ / নগদ / বাংলা কিউআর)"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            কাস্টমারের জন্য পেমেন্ট নির্দেশনা
                          </label>
                          <textarea
                            rows={2}
                            value={settings.banglaQrInstructions || ''}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                banglaQrInstructions: e.target.value,
                              })
                            }
                            placeholder="যেকোনো ব্যাংক অ্যাপ, বিকাশ, নগদ, রকেট বা উপায় থেকে বাংলা কিউআর স্ক্যান করে পেমেন্ট সম্পন্ন করুন..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Advance Bangla QR Payment Special Discount Configurator */}
                    <div className="p-3.5 rounded-xl bg-white border border-emerald-200 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-[#14213D] text-xs flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-[#16A34A]" />
                            <span>অগ্রিম বাংলা কিউআর পেমেন্টে বিশেষ ছাড় (Advance Payment Special Discount)</span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            কাস্টমার ক্যাশ অন ডেলিভারির পরিবর্তে বাংলা কিউআর দিয়ে অগ্রিম পেমেন্ট করলে স্বয়ংক্রিয়ভাবে বিশেষ ডিসকাউন্ট পাবেন।
                          </p>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-300">
                          <input
                            type="checkbox"
                            checked={settings.banglaQrDiscountEnabled !== false}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                banglaQrDiscountEnabled: e.target.checked,
                              })
                            }
                          />
                          <span className="font-bold text-emerald-950 text-[11px]">
                            বিশেষ ছাড় চালু
                          </span>
                        </label>
                      </div>

                      {settings.banglaQrDiscountEnabled !== false && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">
                                ছাড়ের ধরন (Discount Type)
                              </label>
                              <select
                                value={settings.banglaQrDiscountType || 'percentage'}
                                onChange={(e) =>
                                  setSettings({
                                    ...settings,
                                    banglaQrDiscountType:
                                      e.target.value === 'fixed' ? 'fixed' : 'percentage',
                                  })
                                }
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                              >
                                <option value="percentage">শতাংশ ছাড় (% Percentage)</option>
                                <option value="fixed">নির্দিষ্ট টাকা ছাড় (৳ Fixed)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">
                                ছাড়ের পরিমাণ (
                                {settings.banglaQrDiscountType === 'fixed' ? '৳ টাকা' : '% শতাংশ'}
                                )
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={settings.banglaQrDiscountValue ?? 5}
                                onChange={(e) =>
                                  setSettings({
                                    ...settings,
                                    banglaQrDiscountValue: Math.max(0, Number(e.target.value)),
                                  })
                                }
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">
                                সর্বোচ্চ ছাড়ের সীমা (৳ Max Cap)
                              </label>
                              <input
                                type="number"
                                min={0}
                                disabled={settings.banglaQrDiscountType === 'fixed'}
                                value={settings.banglaQrMaxDiscountBdt ?? 300}
                                onChange={(e) =>
                                  setSettings({
                                    ...settings,
                                    banglaQrMaxDiscountBdt: Math.max(0, Number(e.target.value)),
                                  })
                                }
                                placeholder="যেমন: 300 (0 দিলে সীমাহীন)"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[11px] font-semibold text-slate-500 mr-1">
                              কুইক প্রিসেট:
                            </span>
                            {[
                              { label: '৫% ছাড় (সর্বোচ্চ ৳৩০০)', type: 'percentage' as const, val: 5, cap: 300 },
                              { label: '১০% ছাড় (সর্বোচ্চ ৳৫০০)', type: 'percentage' as const, val: 10, cap: 500 },
                              { label: 'ফ্ল্যাট ৳৫০ ছাড়', type: 'fixed' as const, val: 50, cap: 0 },
                              { label: 'ফ্ল্যাট ৳১০০ ছাড়', type: 'fixed' as const, val: 100, cap: 0 },
                            ].map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() =>
                                  setSettings({
                                    ...settings,
                                    banglaQrDiscountEnabled: true,
                                    banglaQrDiscountType: preset.type,
                                    banglaQrDiscountValue: preset.val,
                                    banglaQrMaxDiscountBdt: preset.cap,
                                  })
                                }
                                className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-semibold text-[11px]"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-[#14213D] hover:bg-[#286F65] text-white font-semibold rounded-lg"
                    >
                      স্টোর ও পেমেন্ট সেটিংস সংরক্ষণ করুন
                    </button>
                  </div>
                </form>
              </div>

              {/* Site-Native Admin Password & Profile Change Form */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <KeyRound className="w-4 h-4 text-[#286F65]" />
                  <h3 className="text-base font-bold text-[#14213D]">
                    অ্যাডমিন লগইন ইমেইল ও পাসওয়ার্ড পরিবর্তন করুন
                  </h3>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      অ্যাডমিন নাম (ইউজারনেম)
                    </label>
                    <input
                      type="text"
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      অ্যাডমিন লগইন ইমেইল
                    </label>
                    <input
                      type="text"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      বর্তমান পাসওয়ার্ড (Current Password) *
                    </label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="বর্তমান পাসওয়ার্ড দিন"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="নতুন পাসওয়ার্ড দিন"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={changingPassword}
                      className="px-5 py-2.5 bg-[#286F65] hover:bg-[#14213D] text-white font-semibold rounded-lg"
                    >
                      {changingPassword ? 'আপডেট হচ্ছে...' : 'পাসওয়ার্ড আপডেট করুন'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* ProCloudify.com.bd cPanel Hosting & Deployment Guide (PHP / No Node.js Edition) */}
            <div className="bg-white rounded-xl border-2 border-[#286F65] p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#14213D] text-white flex items-center justify-center shrink-0">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#14213D]">
                      ProCloudify (https://procloudify.com.bd/) হোস্টিং ডিপ্লয়মেন্ট (Node.js ছাড়াই PHP cPanel-এ ১০০% সচল!)
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      আপনার ProCloudify cPanel-এ <strong>Node.js না থাকলেও</strong> কোনো সমস্যা নেই! এই সাইটটিতে বিল্ট-ইন <strong>PHP + SQLite Engine (api.php + .htaccess)</strong> যুক্ত করা হয়েছে।
                    </p>
                  </div>
                </div>
                <a
                  href="/api/procloudify-cpanel-php.zip"
                  download="Boichitra_BD_ProCloudify_cPanel_PHP.zip"
                  className="px-5 py-3 bg-[#16A34A] hover:bg-[#14213D] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>📦 ProCloudify cPanel (PHP) জিপ ফাইল ডাউনলোড করুন</span>
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs leading-relaxed">
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                  <div className="font-bold text-[#14213D]">
                    ধাপ ১: রেডিমেড জিপ ফাইল ডাউনলোড করুন
                  </div>
                  <p className="text-slate-700">
                    উপরের সবুজ <strong>&ldquo;ProCloudify cPanel (PHP) জিপ ফাইল ডাউনলোড করুন&rdquo;</strong> বাটনে ক্লিক করলে আপনার বর্তমান সব পণ্য, ক্যাটাগরি, কুপন ও বাংলা কিউআর সেটিংসসহ <code className="font-mono bg-white px-1 py-0.5 rounded border">Boichitra_BD_ProCloudify_cPanel_PHP.zip</code> ডাউনলোড হয়ে যাবে।
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                  <div className="font-bold text-[#14213D]">
                    ধাপ ২: ProCloudify File Manager-এ আপলোড ও Extract
                  </div>
                  <ul className="text-slate-700 space-y-1">
                    <li>১. আপনার ProCloudify cPanel-এ লগইন করে <strong>File Manager</strong>-এ যান।</li>
                    <li>২. বাম পাশ থেকে <code className="font-mono font-bold text-[#286F65]">public_html</code> ফোল্ডারে ঢুকুন।</li>
                    <li>৩. উপরের <strong>Upload</strong> বাটনে ক্লিক করে জিপ ফাইলটি আপলোড করুন এবং ফাইলটির ওপর Right-Click করে <strong>Extract</strong> করুন।</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                  <div className="font-bold text-[#14213D]">
                    ধাপ ৩: কোনো Node.js বা আলাদা ডেটাবেস সেটআপ লাগবে না!
                  </div>
                  <p className="text-slate-700">
                    জিপ ফাইলের ভেতরে থাকা <code className="font-mono bg-white px-1 py-0.5 rounded border">api.php</code> এবং <code className="font-mono bg-white px-1 py-0.5 rounded border">.htaccess</code> স্বয়ংক্রিয়ভাবে PHP-এর মাধ্যমে সুরক্ষিত SQLite ডেটাবেস তৈরি করে নেবে। কাস্টমার অর্ডার, অর্ডার ট্র্যাকিং, বাংলা কিউআর পেমেন্ট এবং অ্যাডমিন প্যানেল—সবকিছু সরাসরি কাজ করবে!
                  </p>
                </div>
              </div>

              {/* GitHub Deployment Guide (cPanel Git Version Control & GitHub Actions) */}
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-[#14213D]">
                      🚀 GitHub এর মাধ্যমে ডিপ্লয়মেন্ট (Node.js ছাড়াই cPanel Git™ অথবা GitHub Actions Auto-Deploy)
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      আপনার প্রজেক্টে ইতিমধ্যে <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded border">.cpanel.yml</code> এবং <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded border">.github/workflows/deploy-procloudify.yml</code> যুক্ত করা হয়েছে। ফলে আপনি ২ ভাবে GitHub থেকে ডিপ্লয় করতে পারবেন:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-bold text-[#14213D] text-sm">
                      পদ্ধতি A: cPanel &ldquo;Git™ Version Control&rdquo; (সবচেয়ে সহজ)
                    </div>
                    <ol className="text-slate-700 space-y-1.5 list-decimal list-inside">
                      <li>প্রথমে প্রজেক্টটি আপনার <strong>GitHub Repository</strong>-তে এক্সপোর্ট বা পুশ করুন। (এতে বিল্ট-ইন <code className="font-mono bg-white px-1 rounded border">dist/</code> ফোল্ডার ও <code className="font-mono bg-white px-1 rounded border">.cpanel.yml</code> প্রস্তুত আছে)।</li>
                      <li>আপনার ProCloudify cPanel-এ লগইন করে <strong>Files / Tools</strong> সেকশন থেকে <strong>Git™ Version Control</strong>-এ যান এবং <strong>Create</strong> বাটনে ক্লিক করুন।</li>
                      <li><strong>Clone URL</strong> বক্সে আপনার GitHub রিপোজিটরির লিংক দিন এবং নিচে <strong>Create</strong> চাপুন।</li>
                      <li>তৈরি হওয়ার পর <strong>Manage</strong> &rarr; <strong>Pull or Deploy</strong> ট্যাবে গিয়ে <strong>Deploy HEAD Commit</strong> বাটনে ক্লিক করলেই <code className="font-mono bg-white px-1 rounded border">.cpanel.yml</code> স্বয়ংক্রিয়ভাবে সব ফাইল <code className="font-mono font-bold text-[#286F65]">public_html</code>-এ কপি করে সাইট লাইভ করে দেবে!</li>
                    </ol>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-bold text-[#14213D] text-sm">
                      পদ্ধতি B: GitHub Actions + FTP Auto-Deploy (১০০% অটোমেটিক)
                    </div>
                    <p className="text-slate-600">
                      আপনার cPanel-এ Node.js না থাকলেও <strong>GitHub-এর নিজস্ব ক্লাউড সার্ভারে Node.js 22 চালিয়ে</strong> সাইটটি বিল্ড হবে এবং অটোমেটিক আপনার cPanel-এ আপলোড হবে:
                    </p>
                    <ol className="text-slate-700 space-y-1.5 list-decimal list-inside">
                      <li>GitHub রিপোজিটরির <strong>Settings &rarr; Secrets and variables &rarr; Actions</strong>-এ যান।</li>
                      <li>নিচের ৩টি <strong>New repository secret</strong> যোগ করুন:
                        <ul className="pl-5 mt-1 space-y-0.5 font-mono text-[11px] text-[#14213D]">
                          <li>• FTP_SERVER : আপনার ডোমেইন বা FTP হোস্ট (যেমন: ftp.yourdomain.com)</li>
                          <li>• FTP_USERNAME : আপনার ProCloudify cPanel FTP ইউজারনেম</li>
                          <li>• FTP_PASSWORD : আপনার FTP পাসওয়ার্ড</li>
                        </ul>
                      </li>
                      <li>এরপর GitHub-এ যেকোনো পরিবর্তন Push করলেই <strong>GitHub Actions</strong> স্বয়ংক্রিয়ভাবে সাইটটি বিল্ড করে আপনার লাইভ ডেটাবেস (<code className="font-mono">boichitra_storage</code>) অক্ষুণ্ণ রেখে <code className="font-mono font-bold text-[#286F65]">public_html</code> আপডেট করে দেবে!</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Audit Log */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-6">
              <h3 className="text-base font-bold text-[#14213D] mb-4">
                সিকিউরিটি অডিট লগ (Admin Audit Trail)
              </h3>
              <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100 text-xs tabular-nums">
                {auditLogs.length === 0 ? (
                  <p className="text-slate-500 py-6 text-center">কোনো অডিট লগ নেই।</p>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#14213D]">
                          {log.action}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(log.createdAt).toLocaleString('en-GB', {
                            timeZone: 'Asia/Dhaka',
                          })}
                        </span>
                      </div>
                      <div className="text-slate-700 mt-0.5">{log.details}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        By: {log.actorEmail} · Entity: {log.entityType} ({log.entityId})
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: Order Details & Status Update */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#14213D] font-mono">
                  অর্ডার #{selectedOrder.orderNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  গ্রাহক: {selectedOrder.customerNameSnapshot} (
                  {selectedOrder.customerPhoneSnapshot})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-semibold text-slate-700 mb-1">
                  ডেলিভারি ঠিকানা স্ন্যাপশট:
                </div>
                <div>
                  {selectedOrder.shippingAddressSnapshot}, {selectedOrder.upazilaSnapshot},{' '}
                  {selectedOrder.districtSnapshot}
                </div>
                {selectedOrder.orderNote && (
                  <div className="mt-1 text-amber-800 font-medium">
                    কাস্টমার নোট: {selectedOrder.orderNote}
                  </div>
                )}
              </div>

              <div>
                <div className="font-semibold text-slate-700 mb-2">অর্ডারকৃত পণ্যসমূহ:</div>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl p-3 tabular-nums">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="py-2 flex justify-between gap-2">
                      <div>
                        <span className="font-semibold">{item.productNameBnSnapshot}</span> (
                        {item.variantSnapshot}) x{item.quantity}
                      </div>
                      <div className="font-bold">{formatBdt(item.lineTotalBdt)}</div>
                    </div>
                  ))}
                  <div className="pt-2 flex justify-between font-bold text-sm text-[#14213D]">
                    <span>সর্বমোট (ডেলিভারি চার্জ সহ):</span>
                    <span>{formatBdt(selectedOrder.totalBdt)}</span>
                  </div>
                </div>
              </div>

              {/* Manual Bangla QR Payment Verification Card (if applicable) */}
              {(selectedOrder.paymentMethod === 'BANGLA_QR' || selectedOrder.manualPayment) && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#006A4E] text-white font-bold text-[11px]">
                        বাংলা কিউআর ম্যানুয়াল পেমেন্ট (Bangla QR)
                      </span>
                      <div className="text-xs text-slate-700 font-semibold mt-1">
                        প্রেরণকারী নম্বর:{' '}
                        <span className="font-mono font-bold text-[#14213D]">
                          {selectedOrder.manualPayment?.senderPhone || 'প্রদান করা হয়নি'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 font-semibold mt-0.5">
                        ট্রানজেকশন আইডি (TrxID):{' '}
                        <span className="font-mono font-bold text-[#006A4E] bg-white px-2 py-0.5 rounded border border-emerald-300">
                          {selectedOrder.manualPayment?.transactionId || 'প্রদান করা হয়নি'}
                        </span>
                      </div>
                      {selectedOrder.manualPayment?.qrDiscountBdt ? (
                        <div className="text-xs text-[#16A34A] font-bold mt-0.5">
                          অগ্রিম বাংলা কিউআর বিশেষ ছাড়: -{formatBdt(selectedOrder.manualPayment.qrDiscountBdt)}
                        </div>
                      ) : null}
                    </div>

                    {editPaymentStatus !== 'PAID' && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditPaymentStatus('PAID');
                          if (editOrderStatus === 'Pending') {
                            setEditOrderStatus('Confirmed');
                          }
                          setEditOrderNote(
                            `বাংলা কিউআর পেমেন্ট ভেরিফাই করা হয়েছে (TrxID: ${
                              selectedOrder.manualPayment?.transactionId || ''
                            })`
                          );
                        }}
                        className="px-3.5 py-2 bg-[#16A34A] hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-sm transition-colors"
                      >
                        ✓ পেমেন্ট ভেরিফাই ও PAID মার্ক করুন
                      </button>
                    )}
                  </div>

                  {selectedOrder.manualPayment?.screenshotUrl && (
                    <div className="pt-2 border-t border-emerald-200/80">
                      <div className="text-[11px] font-bold text-slate-700 mb-1.5">
                        কাস্টমারের আপলোডকৃত পেমেন্ট স্ক্রিনশট / রিসিট:
                      </div>
                      <img
                        src={selectedOrder.manualPayment.screenshotUrl}
                        alt="Payment Screenshot"
                        className="max-h-56 rounded-lg border border-slate-300 bg-white object-contain"
                      />
                    </div>
                  )}
                </div>
              )}

              <form
                onSubmit={handleUpdateOrder}
                className="space-y-3 pt-2 border-t border-slate-200"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      অর্ডার স্ট্যাটাস পরিবর্তন করুন
                    </label>
                    <select
                      value={editOrderStatus}
                      onChange={(e) => setEditOrderStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="Pending">Pending (অপেক্ষমাণ)</option>
                      <option value="Confirmed">Confirmed (কনফার্মড)</option>
                      <option value="Processing">Processing (প্রসেসিং)</option>
                      <option value="Shipped">Shipped (কুরিয়ারে পাঠানো হয়েছে)</option>
                      <option value="Delivered">Delivered (ডেলিভার্ড)</option>
                      <option value="Cancelled">
                        Cancelled (বাতিল - স্টক ফেরত যাবে)
                      </option>
                      <option value="Returned">Returned (রিটার্নড)</option>
                      <option value="Refunded">Refunded (রিফান্ডেড)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      পেমেন্ট স্ট্যাটাস
                    </label>
                    <select
                      value={editPaymentStatus}
                      onChange={(e) => setEditPaymentStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="UNPAID">UNPAID (অপরিশোধিত / COD)</option>
                      <option value="VERIFICATION_PENDING">
                        VERIFICATION_PENDING (বাংলা কিউআর যাচাই অপেক্ষমাণ)
                      </option>
                      <option value="PAID">PAID (পরিশোধিত)</option>
                      <option value="REFUNDED">REFUNDED (রিফান্ডেড)</option>
                    </select>
                  </div>
                </div>

                {editOrderStatus === 'Cancelled' && (
                  <div>
                    <label className="block font-semibold text-red-700 mb-1">
                      বাতিলের কারণ (Cancellation Reason)
                    </label>
                    <input
                      type="text"
                      value={editCancelReason}
                      onChange={(e) => setEditCancelReason(e.target.value)}
                      placeholder="গ্রাহকের অনুরোধে বাতিল / ফোন রিসিভ করেননি..."
                      className="w-full px-3 py-2 border border-red-300 rounded-lg"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    স্ট্যাটাস নোট (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={editOrderNote}
                    onChange={(e) => setEditOrderNote(e.target.value)}
                    placeholder="যেমন: ফোনে কনফার্ম করা হয়েছে, সিলেট সদরে ডেলিভারির জন্য প্রস্তুত..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="px-4 py-2 bg-slate-100 rounded-lg font-medium"
                  >
                    বন্ধ করুন
                  </button>
                  <button
                    type="submit"
                    disabled={savingOrder}
                    className="px-5 py-2 bg-[#14213D] hover:bg-[#286F65] text-white font-semibold rounded-lg"
                  >
                    {savingOrder ? 'আপডেট হচ্ছে...' : 'স্ট্যাটাস আপডেট করুন'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Customer Order History */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-[#14213D]">
                  {selectedCustomer.fullName} ({selectedCustomer.phone})
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {selectedCustomer.customerCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs tabular-nums">
              {orders
                .filter((o) => o.customerId === selectedCustomer.id)
                .map((o) => (
                  <div
                    key={o.id}
                    className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-mono font-bold text-[#14213D]">
                        {o.orderNumber}
                      </div>
                      <div className="text-slate-500">
                        {new Date(o.createdAt).toLocaleString('en-GB', {
                          timeZone: 'Asia/Dhaka',
                        })}
                      </div>
                      <div className="text-slate-700 mt-1">
                        {o.items
                          .map((i) => `${i.productNameBnSnapshot} x${i.quantity}`)
                          .join(', ')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm">{formatBdt(o.totalBdt)}</div>
                      <div className="text-[#286F65] font-semibold mt-0.5">
                        {o.orderStatus}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Create / Edit Product */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <h3 className="text-base font-bold text-[#14213D]">
                {productForm.id
                  ? 'পণ্য সম্পাদনা করুন (Edit Product)'
                  : 'নতুন পণ্য যোগ করুন (Add New Product)'}
              </h3>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {productForm.id && (
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-[#14213D]">
                    🔗 প্রমোশনাল লিংক (Facebook / Meta Ads &amp; Direct Order Link):
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyPromoLink(
                          products.find((p) => p.id === productForm.id) || {
                            id: productForm.id,
                            sku: productForm.sku,
                            nameBn: productForm.nameBn,
                          },
                          false
                        )
                      }
                      className="px-2.5 py-1.5 bg-[#14213D] hover:bg-[#286F65] text-white rounded-lg font-bold inline-flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>পণ্যের লিংক কপি</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyPromoLink(
                          products.find((p) => p.id === productForm.id) || {
                            id: productForm.id,
                            sku: productForm.sku,
                            nameBn: productForm.nameBn,
                          },
                          true
                        )
                      }
                      className="px-2.5 py-1.5 bg-[#286F65] hover:bg-[#14213D] text-white rounded-lg font-bold inline-flex items-center gap-1"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>ডিরেক্ট চেকআউট অ্যাড লিংক</span>
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  readOnly
                  value={buildProductPromoUrl(
                    products.find((p) => p.id === productForm.id) || {
                      id: productForm.id,
                      sku: productForm.sku,
                    }
                  )}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg font-mono text-[11px] text-slate-700 select-all"
                />
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    পণ্যের নাম (বাংলা) *
                  </label>
                  <input
                    type="text"
                    required
                    value={productForm.nameBn}
                    onChange={(e) =>
                      setProductForm({ ...productForm, nameBn: e.target.value })
                    }
                    placeholder="যেমন: প্রিমিয়াম উইন্টার হুডি"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Product Name (English) *
                  </label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={(e) =>
                      setProductForm({ ...productForm, name: e.target.value })
                    }
                    placeholder="e.g. Premium Winter Hoodie"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    SKU কোড *
                  </label>
                  <input
                    type="text"
                    required
                    value={productForm.sku}
                    onChange={(e) =>
                      setProductForm({ ...productForm, sku: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    ক্যাটাগরি *
                  </label>
                  <select
                    value={productForm.categoryId}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        categoryId: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameBn} ({c.name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    স্টক পরিমাণ *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={productForm.stockQuantity}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        stockQuantity: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 tabular-nums">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    রেগুলার মূল্য (BDT ৳) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={productForm.priceBdt}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        priceBdt: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    ডিসকাউন্ট / সেল মূল্য (ঐচ্ছিক ৳)
                  </label>
                  <input
                    type="number"
                    value={productForm.salePriceBdt}
                    onChange={(e) =>
                      setProductForm({ ...productForm, salePriceBdt: e.target.value })
                    }
                    placeholder="ফাঁকা রাখলে রেগুলার মূল্য প্রযোজ্য হবে"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                  {/* Quick Percentage Discount Calculator Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="text-[11px] text-slate-500">দ্রুত ছাড় হিসাব:</span>
                    {[10, 15, 20, 30, 50].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          const discounted = Math.round(
                            productForm.priceBdt * (1 - pct / 100)
                          );
                          setProductForm({
                            ...productForm,
                            salePriceBdt: String(discounted),
                            isSpecialOffer: true,
                          });
                        }}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-[#286F65] hover:text-white rounded text-[10px] font-semibold transition-colors"
                      >
                        {pct}% ছাড়
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Primary Image Upload / Studio Generator */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="block font-semibold text-[#14213D]">
                  ১. পণ্যের মূল ছবি (Primary Thumbnail Image)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-16 h-14 rounded-lg overflow-hidden bg-white border border-slate-300 shrink-0">
                    <ResilientProductImage
                      src={productForm.imageUrl}
                      alt={productForm.nameBn || 'Preview'}
                      sku={productForm.sku}
                    />
                  </div>
                  <div className="space-y-2 flex-1 min-w-[200px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileUpload}
                        className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#14213D] file:text-white hover:file:bg-[#286F65]"
                      />
                      <select
                        value={productForm.visualPreset}
                        onChange={(e) => {
                          const preset = e.target.value as any;
                          setProductForm({
                            ...productForm,
                            visualPreset: preset,
                            imageUrl: createStudioProductSvg(
                              preset,
                              '#14213D',
                              '#286F65',
                              productForm.sku || 'BOICHITRA BD'
                            ),
                          });
                        }}
                        className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                      >
                        <option value="hoodie">Studio Hoodie Illustration</option>
                        <option value="headphones">Studio Headphones Illustration</option>
                        <option value="smartwatch">Studio Smartwatch Illustration</option>
                        <option value="panjabi">Studio Panjabi Illustration</option>
                        <option value="powerbank">Studio Powerbank Illustration</option>
                        <option value="backpack">Studio Backpack Illustration</option>
                        <option value="earbuds">Studio Earbuds Illustration</option>
                        <option value="tshirt">Studio T-Shirt Illustration</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      value={productForm.imageUrl.startsWith('data:') ? '' : productForm.imageUrl}
                      onChange={(e) =>
                        setProductForm({ ...productForm, imageUrl: e.target.value })
                      }
                      placeholder="অথবা মূল ছবির সরাসরি ইমেজ লিংক (https://...) পেস্ট করুন"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* MULTIPLE IMAGES & VIDEOS GALLERY SECTION */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-[#14213D] flex items-center gap-1.5">
                      <Images className="w-4 h-4 text-[#286F65]" />
                      <span>
                        ২. একাধিক ছবি ও ভিডিও গ্যালারি (Multiple Images &amp; Product Videos)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      একসাথে একাধিক ছবি আপলোড করুন অথবা YouTube / Facebook / MP4 ভিডিও লিংক যুক্ত করুন।
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddStudioAngle('SIDE VIEW', '#1E293B', '#16A34A')}
                      className="px-2.5 py-1 bg-white border border-slate-300 hover:border-[#286F65] rounded text-[11px] font-medium"
                    >
                      + সাইড ভিউ ছবি
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddStudioAngle('DETAIL VIEW', '#286F65', '#14213D')}
                      className="px-2.5 py-1 bg-white border border-slate-300 hover:border-[#286F65] rounded text-[11px] font-medium"
                    >
                      + ক্লোজ-আপ ছবি
                    </button>
                  </div>
                </div>

                {/* Multi-File Upload Input (Images + Short Videos) */}
                <div className="p-3 bg-white rounded-lg border border-dashed border-slate-300 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-600">
                    <strong>ফাইল থেকে একাধিক ছবি বা ভিডিও দিন:</strong> (একসাথে একাধিক ফাইল সিলেক্ট করা যাবে)
                  </div>
                  <input
                    type="file"
                    accept="image/*,video/mp4,video/webm"
                    multiple
                    onChange={handleGalleryImagesUpload}
                    className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#286F65] file:text-white hover:file:bg-[#14213D]"
                  />
                </div>

                {/* Add Image or Video by URL (YouTube, Facebook, Direct MP4, Image URL) */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <select
                    value={newMediaType}
                    onChange={(e) => setNewMediaType(e.target.value as 'image' | 'video')}
                    className="sm:col-span-3 px-2.5 py-2 border border-slate-300 rounded-lg bg-white text-xs font-semibold"
                  >
                    <option value="image">📷 অতিরিক্ত ছবি (URL)</option>
                    <option value="video">🎬 ভিডিও (YouTube/MP4)</option>
                  </select>
                  <input
                    type="text"
                    value={newMediaUrl}
                    onChange={(e) => setNewMediaUrl(e.target.value)}
                    placeholder={
                      newMediaType === 'video'
                        ? 'YouTube লিংক (https://youtu.be/...) বা MP4 ভিডিও লিংক দিন'
                        : 'ছবির সরাসরি লিংক (https://...) দিন'
                    }
                    className="sm:col-span-5 px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs"
                  />
                  <input
                    type="text"
                    value={newMediaTitle}
                    onChange={(e) => setNewMediaTitle(e.target.value)}
                    placeholder="ক্যাপশন (যেমন: আনবক্সিং ভিডিও)"
                    className="sm:col-span-2 px-2.5 py-2 border border-slate-300 rounded-lg bg-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddMediaByUrl}
                    className="sm:col-span-2 py-2 px-3 bg-[#14213D] hover:bg-[#286F65] text-white font-semibold rounded-lg text-xs"
                  >
                    + যুক্ত করুন
                  </button>
                </div>

                {/* Gallery Items Preview List */}
                {productForm.galleryMedia.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    {productForm.galleryMedia.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-2 rounded-lg bg-white border border-slate-200 flex flex-col justify-between gap-1.5"
                      >
                        <div className="relative aspect-4/3 rounded bg-slate-100 overflow-hidden flex items-center justify-center">
                          {item.type === 'video' ? (
                            <div className="text-center p-2">
                              <Video className="w-6 h-6 text-[#16A34A] mx-auto" />
                              <span className="text-[10px] font-bold text-[#14213D] block mt-1">
                                প্রোডাক্ট ভিডিও
                              </span>
                            </div>
                          ) : (
                            <ResilientProductImage
                              src={item.url}
                              alt={item.title || `Gallery ${idx + 1}`}
                              sku={productForm.sku}
                            />
                          )}
                          <span
                            className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-white ${
                              item.type === 'video' ? 'bg-[#16A34A]' : 'bg-[#14213D]/85'
                            }`}
                          >
                            {item.type === 'video' ? '▶ ভিডিও' : `ছবি #${idx + 2}`}
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-600 truncate">
                          {item.title || (item.type === 'video' ? 'ভিডিও' : 'গ্যালারি ছবি')}
                        </div>

                        <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100">
                          {item.type === 'image' ? (
                            <button
                              type="button"
                              onClick={() => {
                                const oldPrimary = productForm.imageUrl;
                                const updatedGallery = productForm.galleryMedia.map((m, i) =>
                                  i === idx ? { ...m, url: oldPrimary, title: 'পূর্বের মূল ছবি' } : m
                                );
                                setProductForm({
                                  ...productForm,
                                  imageUrl: item.url,
                                  galleryMedia: updatedGallery,
                                });
                              }}
                              className="text-[10px] font-semibold text-[#286F65] hover:underline"
                            >
                              মূল ছবি করুন
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400">ভিডিও লিংক</span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setProductForm({
                                ...productForm,
                                galleryMedia: productForm.galleryMedia.filter(
                                  (_, i) => i !== idx
                                ),
                              })
                            }
                            className="text-[10px] font-semibold text-red-600 hover:underline"
                          >
                            মুছুন
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. CLOTHING SEPARATE COLOR & SIZE VARIANT MANAGER */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-[#14213D]">
                      ৩. কাপড়ের আলাদা কালার ও সাইজ ভ্যারিয়েন্ট (Separate Color &amp; Size Options)
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      হুডি, টি-শার্ট, পাঞ্জাবি বা কাপড়ের জন্য একাধিক কালার এবং সাইজ আলাদাভাবে সিলেক্ট করে এক ক্লিকে তৈরি করুন।
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextIdx = productForm.variants.length + 1;
                      setProductForm({
                        ...productForm,
                        variants: [
                          ...productForm.variants,
                          {
                            sku: `${(productForm.sku || 'BBD').toUpperCase()}-V${nextIdx}`,
                            color: 'Navy Blue',
                            size: 'L',
                            priceAdjustmentBdt: 0,
                            stockQuantity: 10,
                          },
                        ],
                      });
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:border-[#14213D] rounded-lg text-xs font-semibold text-[#14213D]"
                  >
                    + নতুন কালার/সাইজ সারি যোগ করুন
                  </button>
                </div>

                {/* Quick Multi-Color x Multi-Size Matrix Generator */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3">
                  <div className="text-[11px] font-bold text-[#286F65]">
                    ⚡ দ্রুত কালার ও সাইজ জেনারেটর (এক ক্লিকে সব কম্বিনেশন তৈরি করুন):
                  </div>

                  {/* Selectable Colors */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-700">
                      কালারগুলো টিক দিন (Select Colors):
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        'Navy Blue',
                        'Charcoal Black',
                        'Jet Black',
                        'Emerald Teal',
                        'Royal Navy',
                        'Maroon Red',
                        'Deep Navy',
                        'Teal Green',
                        'Olive Green',
                        'White',
                      ].map((col) => {
                        const active = quickColors.includes(col);
                        return (
                          <button
                            key={col}
                            type="button"
                            onClick={() =>
                              setQuickColors((prev) =>
                                prev.includes(col)
                                  ? prev.filter((c) => c !== col)
                                  : [...prev, col]
                              )
                            }
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                              active
                                ? 'bg-[#14213D] text-white border-[#14213D]'
                                : 'bg-slate-50 text-slate-700 border-slate-300 hover:border-[#286F65]'
                            }`}
                          >
                            {active ? '✓ ' : '+ '}
                            {col}
                          </button>
                        );
                      })}
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="text"
                          value={customColorInput}
                          onChange={(e) => setCustomColorInput(e.target.value)}
                          placeholder="অন্য কালার..."
                          className="w-28 px-2 py-1 border border-slate-300 rounded text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const c = customColorInput.trim();
                            if (c && !quickColors.includes(c)) {
                              setQuickColors([...quickColors, c]);
                            }
                            setCustomColorInput('');
                          }}
                          className="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded text-[11px] font-semibold"
                        >
                          যোগ
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Selectable Sizes */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-700">
                      সাইজগুলো টিক দিন (Select Sizes):
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        'S',
                        'M',
                        'L',
                        'XL',
                        'XXL',
                        '38 (S)',
                        '40 (M)',
                        '42 (L)',
                        '44 (XL)',
                        '46 (XXL)',
                      ].map((sz) => {
                        const active = quickSizes.includes(sz);
                        return (
                          <button
                            key={sz}
                            type="button"
                            onClick={() =>
                              setQuickSizes((prev) =>
                                prev.includes(sz)
                                  ? prev.filter((s) => s !== sz)
                                  : [...prev, sz]
                              )
                            }
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                              active
                                ? 'bg-[#286F65] text-white border-[#286F65]'
                                : 'bg-slate-50 text-slate-700 border-slate-300 hover:border-[#286F65]'
                            }`}
                          >
                            {active ? '✓ ' : '+ '}
                            {sz}
                          </button>
                        );
                      })}
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="text"
                          value={customSizeInput}
                          onChange={(e) => setCustomSizeInput(e.target.value)}
                          placeholder="অন্য সাইজ..."
                          className="w-24 px-2 py-1 border border-slate-300 rounded text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const s = customSizeInput.trim();
                            if (s && !quickSizes.includes(s)) {
                              setQuickSizes([...quickSizes, s]);
                            }
                            setCustomSizeInput('');
                          }}
                          className="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded text-[11px] font-semibold"
                        >
                          যোগ
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-slate-600 font-medium">প্রতি ভ্যারিয়েন্ট স্টক:</span>
                      <input
                        type="number"
                        min={1}
                        value={quickStockPerVariant}
                        onChange={(e) => setQuickStockPerVariant(Number(e.target.value))}
                        className="w-16 px-2 py-1 border border-slate-300 rounded font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateColorSizeMatrix}
                      className="px-3.5 py-1.5 bg-[#14213D] hover:bg-[#286F65] text-white font-semibold rounded-lg text-xs transition-colors"
                    >
                      কালার ও সাইজ কম্বিনেশন তৈরি করুন ({quickColors.length} × {quickSizes.length})
                    </button>
                  </div>
                </div>

                {/* Variant Rows List */}
                {productForm.variants.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-slate-600 px-2">
                      <div className="col-span-3">কালার (Color)</div>
                      <div className="col-span-2">সাইজ (Size)</div>
                      <div className="col-span-3">ভ্যারিয়েন্ট SKU</div>
                      <div className="col-span-2">স্টক (Stock)</div>
                      <div className="col-span-2 text-right">অ্যাকশন</div>
                    </div>
                    {productForm.variants.map((v, idx) => (
                      <div
                        key={v.id || idx}
                        className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-slate-200 text-xs tabular-nums"
                      >
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={v.color}
                            onChange={(e) => {
                              const next = [...productForm.variants];
                              next[idx] = { ...next[idx], color: e.target.value };
                              setProductForm({ ...productForm, variants: next });
                            }}
                            placeholder="কালার (যেমন: Navy Blue)"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="text"
                            value={v.size}
                            onChange={(e) => {
                              const next = [...productForm.variants];
                              next[idx] = { ...next[idx], size: e.target.value };
                              setProductForm({ ...productForm, variants: next });
                            }}
                            placeholder="সাইজ (যেমন: XL)"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-bold"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={v.sku}
                            onChange={(e) => {
                              const next = [...productForm.variants];
                              next[idx] = { ...next[idx], sku: e.target.value };
                              setProductForm({ ...productForm, variants: next });
                            }}
                            placeholder="SKU"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-[11px] font-mono"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min={0}
                            value={v.stockQuantity}
                            onChange={(e) => {
                              const next = [...productForm.variants];
                              next[idx] = {
                                ...next[idx],
                                stockQuantity: Number(e.target.value),
                              };
                              const sumStock = next.reduce(
                                (s, item) => s + Math.max(0, Number(item.stockQuantity) || 0),
                                0
                              );
                              setProductForm({
                                ...productForm,
                                variants: next,
                                stockQuantity: sumStock,
                              });
                            }}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                          />
                        </div>
                        <div className="col-span-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              const next = productForm.variants.filter((_, i) => i !== idx);
                              const sumStock = next.reduce(
                                (s, item) => s + Math.max(0, Number(item.stockQuantity) || 0),
                                0
                              );
                              setProductForm({
                                ...productForm,
                                variants: next,
                                stockQuantity:
                                  next.length > 0 ? sumStock : productForm.stockQuantity,
                              });
                            }}
                            className="text-red-600 hover:underline text-[11px] font-semibold"
                          >
                            মুছুন
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 bg-white p-3 rounded-lg border border-dashed border-slate-300 text-center">
                    এই পণ্যে এখনো কোনো কালার বা সাইজ ভ্যারিয়েন্ট যোগ করা হয়নি। কাপড় বা ফ্যাশন পণ্যের জন্য উপরের বাটনে ক্লিক করে কালার ও সাইজ যুক্ত করুন।
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  পণ্যের বিবরণ (বাংলা) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={productForm.descriptionBn}
                  onChange={(e) =>
                    setProductForm({ ...productForm, descriptionBn: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Product Description (English) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm({ ...productForm, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.isPublished}
                    onChange={(e) =>
                      setProductForm({ ...productForm, isPublished: e.target.checked })
                    }
                  />
                  <span className="font-semibold">Published (প্রকাশিত)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.isFeatured}
                    onChange={(e) =>
                      setProductForm({ ...productForm, isFeatured: e.target.checked })
                    }
                  />
                  <span>Featured</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.isNewArrival}
                    onChange={(e) =>
                      setProductForm({ ...productForm, isNewArrival: e.target.checked })
                    }
                  />
                  <span>New Arrival</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.isBestSeller}
                    onChange={(e) =>
                      setProductForm({ ...productForm, isBestSeller: e.target.checked })
                    }
                  />
                  <span>Best Seller</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-[#286F65]">
                  <input
                    type="checkbox"
                    checked={productForm.isSpecialOffer}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        isSpecialOffer: e.target.checked,
                      })
                    }
                  />
                  <span>🔥 Special Offer (বিশেষ অফার)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  <input
                    type="checkbox"
                    checked={productForm.freeDelivery}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        freeDelivery: e.target.checked,
                      })
                    }
                  />
                  <span>🚚 ফ্রি ডেলিভারি (এই পণ্যে ডেলিভারি চার্জ সম্পূর্ণ ফ্রি)</span>
                </label>
              </div>

              {/* ADVANCED SPECIAL OFFER SETTINGS BOX */}
              {productForm.isSpecialOffer && (
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-[#286F65]/40 space-y-3">
                  <div className="font-bold text-[#14213D] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#286F65]" />
                    <span>বিশেষ অফার ও ফ্ল্যাশ ডিল সেটিংস (Special Offer Configuration)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        অফার ব্যাজ / ট্যাগ (Offer Badge)
                      </label>
                      <input
                        type="text"
                        value={productForm.offerBadgeText}
                        onChange={(e) =>
                          setProductForm({
                            ...productForm,
                            offerBadgeText: e.target.value,
                          })
                        }
                        placeholder="যেমন: 🔥 ফ্ল্যাশ ডিল"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {[
                          '🔥 ফ্ল্যাশ ডিল',
                          '⚡ মেগা অফার',
                          '🎁 স্পেশাল কম্বো',
                          '❄️ উইন্টার ক্লিয়ারেন্স',
                          '🔥 সীমিত স্টক',
                        ].map((presetBadge) => (
                          <button
                            key={presetBadge}
                            type="button"
                            onClick={() =>
                              setProductForm({
                                ...productForm,
                                offerBadgeText: presetBadge,
                              })
                            }
                            className="px-2 py-0.5 bg-white border border-slate-200 hover:border-[#286F65] rounded text-[10px]"
                          >
                            {presetBadge}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        অফার শেষ হওয়ার সময় (Countdown End Time)
                      </label>
                      <input
                        type="datetime-local"
                        value={productForm.offerEndsAt}
                        onChange={(e) =>
                          setProductForm({
                            ...productForm,
                            offerEndsAt: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        অফার স্পেশাল নোট / বোনাস সুবিধা
                      </label>
                      <input
                        type="text"
                        value={productForm.offerDealNote}
                        onChange={(e) =>
                          setProductForm({
                            ...productForm,
                            offerDealNote: e.target.value,
                          })
                        }
                        placeholder="যেমন: সাথে ফ্রি গিফট বক্স / সীমিত সময়ের ছাড়"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        হাইলাইটকৃত প্রমো কুপন কোড (ঐচ্ছিক)
                      </label>
                      <input
                        type="text"
                        value={productForm.offerPromoCoupon}
                        onChange={(e) =>
                          setProductForm({
                            ...productForm,
                            offerPromoCoupon: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="যেমন: SYLHET100 বা BOICHITRA10"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono uppercase"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
                <div>
                  {productForm.id && (
                    <button
                      type="button"
                      disabled={deletingProductId === productForm.id}
                      onClick={() =>
                        handleDeleteProduct({
                          id: productForm.id!,
                          nameBn: productForm.nameBn,
                          sku: productForm.sku,
                        })
                      }
                      className="px-3.5 py-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 rounded-lg font-semibold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>
                        {deletingProductId === productForm.id
                          ? 'ডিলিট হচ্ছে...'
                          : 'পণ্যটি স্থায়ীভাবে ডিলিট করুন'}
                      </span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowProductModal(false)}
                    className="px-4 py-2 bg-slate-100 rounded-lg font-medium"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    disabled={savingProduct}
                    className="px-5 py-2 bg-[#14213D] hover:bg-[#286F65] text-white font-semibold rounded-lg"
                  >
                    {savingProduct ? 'সংরক্ষণ হচ্ছে...' : 'পণ্য সংরক্ষণ করুন'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
