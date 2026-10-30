export function createStudioProductSvg(
  type: 'hoodie' | 'headphones' | 'smartwatch' | 'panjabi' | 'powerbank' | 'backpack' | 'earbuds' | 'sunglasses' | 'tshirt' | 'speaker',
  primaryColor = '#14213D',
  accentColor = '#286F65',
  label = 'BOICHITRA STUDIO'
): string {
  const shapes: Record<string, string> = {
    hoodie: `
      <path d="M220 140 L270 115 L330 115 L380 140 L440 210 L400 245 L365 200 L365 380 L235 380 L235 200 L200 245 L160 210 Z" fill="${primaryColor}" stroke="#ffffff" stroke-width="2" stroke-opacity="0.15"/>
      <path d="M265 115 Q300 70 335 115 Q300 145 265 115 Z" fill="${accentColor}" opacity="0.9"/>
      <rect x="260" y="285" width="80" height="55" rx="10" fill="#0f172a" opacity="0.35"/>
      <line x1="288" y1="135" x2="288" y2="195" stroke="#e2e8f0" stroke-width="3" stroke-linecap="round"/>
      <line x1="312" y1="135" x2="312" y2="195" stroke="#e2e8f0" stroke-width="3" stroke-linecap="round"/>
    `,
    headphones: `
      <path d="M205 260 A95 95 0 0 1 395 260" fill="none" stroke="${primaryColor}" stroke-width="22" stroke-linecap="round"/>
      <path d="M215 260 A85 85 0 0 1 385 260" fill="none" stroke="${accentColor}" stroke-width="6" stroke-linecap="round"/>
      <rect x="180" y="240" width="42" height="96" rx="21" fill="${primaryColor}"/>
      <rect x="378" y="240" width="42" height="96" rx="21" fill="${primaryColor}"/>
      <rect x="192" y="252" width="18" height="72" rx="9" fill="${accentColor}"/>
      <rect x="390" y="252" width="18" height="72" rx="9" fill="${accentColor}"/>
    `,
    smartwatch: `
      <rect x="262" y="105" width="76" height="290" rx="18" fill="${accentColor}"/>
      <rect x="235" y="165" width="130" height="165" rx="30" fill="#1e293b" stroke="#94a3b8" stroke-width="4"/>
      <rect x="247" y="177" width="106" height="141" rx="22" fill="#090d16"/>
      <circle cx="300" cy="247" r="38" fill="none" stroke="${accentColor}" stroke-width="6" stroke-dasharray="190 60"/>
      <text x="300" y="255" text-anchor="middle" fill="#ffffff" font-family="monospace" font-size="22" font-weight="700">10:42</text>
      <rect x="366" y="210" width="8" height="32" rx="4" fill="#64748b"/>
    `,
    panjabi: `
      <path d="M225 120 L270 105 L330 105 L375 120 L420 230 L385 248 L358 175 L358 395 L242 395 L242 175 L215 248 L180 230 Z" fill="${accentColor}"/>
      <rect x="286" y="110" width="28" height="135" rx="4" fill="${primaryColor}" opacity="0.85"/>
      <circle cx="300" cy="140" r="3.5" fill="#f8fafc"/>
      <circle cx="300" cy="168" r="3.5" fill="#f8fafc"/>
      <circle cx="300" cy="196" r="3.5" fill="#f8fafc"/>
      <circle cx="300" cy="224" r="3.5" fill="#f8fafc"/>
    `,
    powerbank: `
      <rect x="225" y="125" width="150" height="250" rx="24" fill="${primaryColor}"/>
      <rect x="238" y="140" width="124" height="220" rx="18" fill="#1e293b"/>
      <circle cx="300" cy="210" r="34" fill="#0f172a" stroke="${accentColor}" stroke-width="4"/>
      <text x="300" y="217" text-anchor="middle" fill="#10b981" font-family="monospace" font-size="20" font-weight="700">100%</text>
      <path d="M296 280 L284 305 L298 305 L292 330 L316 298 L300 298 Z" fill="${accentColor}"/>
    `,
    backpack: `
      <rect x="215" y="140" width="170" height="235" rx="36" fill="${primaryColor}"/>
      <path d="M265 140 Q300 95 335 140" fill="none" stroke="${primaryColor}" stroke-width="14" stroke-linecap="round"/>
      <rect x="238" y="245" width="124" height="105" rx="18" fill="${accentColor}"/>
      <line x1="255" y1="275" x2="345" y2="275" stroke="#e2e8f0" stroke-width="4" stroke-linecap="round"/>
    `,
    earbuds: `
      <rect x="215" y="190" width="170" height="165" rx="46" fill="${primaryColor}"/>
      <line x1="215" y1="255" x2="385" y2="255" stroke="#334155" stroke-width="3"/>
      <circle cx="300" cy="295" r="5" fill="#10b981"/>
      <ellipse cx="265" cy="155" rx="22" ry="18" fill="${accentColor}"/>
      <rect x="258" y="165" width="12" height="35" rx="6" fill="${accentColor}"/>
      <ellipse cx="335" cy="155" rx="22" ry="18" fill="${accentColor}"/>
      <rect x="330" y="165" width="12" height="35" rx="6" fill="${accentColor}"/>
    `,
    sunglasses: `
      <rect x="170" y="215" width="112" height="74" rx="22" fill="${primaryColor}" stroke="${accentColor}" stroke-width="6"/>
      <rect x="318" y="215" width="112" height="74" rx="22" fill="${primaryColor}" stroke="${accentColor}" stroke-width="6"/>
      <path d="M282 238 Q300 222 318 238" fill="none" stroke="${accentColor}" stroke-width="7" stroke-linecap="round"/>
      <line x1="190" y1="232" x2="235" y2="270" stroke="#ffffff" stroke-width="4" stroke-opacity="0.35" stroke-linecap="round"/>
      <line x1="338" y1="232" x2="383" y2="270" stroke="#ffffff" stroke-width="4" stroke-opacity="0.35" stroke-linecap="round"/>
    `,
    tshirt: `
      <path d="M220 135 L265 120 Q300 142 335 120 L380 135 L430 195 L392 230 L362 192 L362 380 L238 380 L238 192 L208 230 L170 195 Z" fill="${primaryColor}"/>
      <path d="M238 250 L362 250 L362 285 L238 285 Z" fill="${accentColor}" opacity="0.85"/>
    `,
    speaker: `
      <rect x="195" y="185" width="210" height="135" rx="40" fill="${primaryColor}"/>
      <circle cx="255" cy="252" r="38" fill="#0f172a" stroke="${accentColor}" stroke-width="5"/>
      <circle cx="255" cy="252" r="14" fill="${accentColor}"/>
      <circle cx="345" cy="252" r="38" fill="#0f172a" stroke="${accentColor}" stroke-width="5"/>
      <circle cx="345" cy="252" r="14" fill="${accentColor}"/>
    `,
  };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
    <defs>
      <radialGradient id="studioBg" cx="50%" cy="45%" r="65%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="65%" stop-color="#f1f5f9"/>
        <stop offset="100%" stop-color="#e2e8f0"/>
      </radialGradient>
      <ellipse id="shadow" cx="300" cy="395" rx="125" ry="16" fill="#0f172a" opacity="0.10"/>
    </defs>
    <rect width="600" height="450" fill="url(#studioBg)"/>
    <use href="#shadow"/>
    ${shapes[type] || shapes.hoodie}
    <text x="300" y="428" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="11" font-weight="600" letter-spacing="2.5">${label}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

export interface ParsedMediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  title?: string;
}

export interface ParsedOfferMeta {
  badgeText?: string;
  offerEndsAt?: string;
  dealNote?: string;
  promoCouponCode?: string;
  freeDelivery?: boolean;
}

export function isLikelyVideoUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.trim().toLowerCase();
  return (
    lower.startsWith('data:video/') ||
    lower.endsWith('.mp4') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.ogg') ||
    lower.includes('youtube.com/watch') ||
    lower.includes('youtu.be/') ||
    lower.includes('youtube.com/shorts/') ||
    lower.includes('youtube.com/embed/') ||
    lower.includes('facebook.com/') && lower.includes('/videos/') ||
    lower.includes('fb.watch/')
  );
}

export function getEmbedVideoInfo(url: string): {
  kind: 'youtube' | 'facebook' | 'native';
  src: string;
} {
  const trimmed = (url || '').trim();

  // YouTube parsing
  const ytMatch =
    trimmed.match(/[?&]v=([a-zA-Z0-9_-]{6,})/) ||
    trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/) ||
    trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/) ||
    trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/);

  if (ytMatch && ytMatch[1]) {
    return {
      kind: 'youtube',
      src: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`,
    };
  }

  // Facebook video parsing
  if (
    (trimmed.includes('facebook.com') && trimmed.includes('/videos/')) ||
    trimmed.includes('fb.watch/')
  ) {
    return {
      kind: 'facebook',
      src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
        trimmed
      )}&show_text=false`,
    };
  }

  return {
    kind: 'native',
    src: trimmed,
  };
}

export function sanitizeCustomerOfferBadge(badge?: string | null): string {
  const raw = (badge || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (
    lower.includes('businesskoro') ||
    lower.includes('business koro') ||
    raw.includes('বিজনেস করো') ||
    raw.includes('রিসেলার') ||
    lower.includes('reseller') ||
    raw.includes('পাইকারি') ||
    lower.includes('wholesale')
  ) {
    if (raw.includes('বেস্টসেলার') || lower.includes('bestseller')) {
      return '🔥 বেস্টসেলার কালেকশন';
    }
    if (raw.includes('হিট') || raw.includes('কালেকশন')) {
      return '✨ প্রিমিয়াম কালেকশন';
    }
    return '🔥 বিশেষ অফার';
  }
  return raw;
}

export function sanitizeCustomerDealNote(note?: string | null): string {
  const raw = (note || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (
    raw.includes('পাইকারি') ||
    raw.includes('রিসেলার') ||
    raw.includes('মার্জিন') ||
    lower.includes('businesskoro') ||
    lower.includes('business koro') ||
    raw.includes('বিজনেস করো') ||
    lower.includes('wholesale') ||
    lower.includes('reseller') ||
    lower.includes('margin') ||
    lower.includes('markup')
  ) {
    return 'সীমিত সময়ের বিশেষ ছাড় · ক্যাশ অন ডেলিভারি সুবিধা';
  }
  return raw;
}

export function sanitizeCustomerProductText(text?: string | null): string {
  const raw = (text || '').trim();
  if (!raw) return '';
  return raw
    .replace(/BusinessKoro\s*[—\-:]?\s*/gi, '')
    .replace(/Business\s*Koro\s*[—\-:]?\s*/gi, '')
    .replace(/বিজনেস\s*করো\s*\(businesskoro\.com\)\s*ভেরিফাইড\s*রিসেলার\s*কালেকশনের\s*/gi, '')
    .replace(/বিজনেস\s*করো\s*[—\-:]?\s*/gi, '')
    .replace(/from\s+Business\s*Koro\s+Bangladesh\s+reseller\s+collection\.?\s*/gi, '')
    .replace(/Imported\s+via\s+Business\s*Koro\s+catalog\.?\s*/gi, '')
    .replace(/ভেরিফাইড\s*রিসেলার\s*কালেকশনের\s*/gi, '')
    .replace(/রিসেলার\s*হিট\s*কালেকশন/gi, 'প্রিমিয়াম কালেকশন')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function parseProductGalleryAndOffer(product: {
  imageUrl?: string;
  galleryUrlsJson?: string | null;
  sku?: string;
  isSpecialOffer?: boolean;
}): {
  media: ParsedMediaItem[];
  allMediaWithPrimary: ParsedMediaItem[];
  offerMeta: ParsedOfferMeta;
  imageCount: number;
  videoCount: number;
} {
  let rawMedia: ParsedMediaItem[] = [];
  let offerMeta: ParsedOfferMeta = {};

  if (product.galleryUrlsJson) {
    try {
      const parsed = JSON.parse(product.galleryUrlsJson);
      if (Array.isArray(parsed)) {
        rawMedia = parsed
          .filter((item) => item && (typeof item === 'string' || typeof item.url === 'string'))
          .map((item, idx) => {
            if (typeof item === 'string') {
              return {
                id: `media-${idx}`,
                url: item,
                type: isLikelyVideoUrl(item) ? 'video' : 'image',
              };
            }
            return {
              id: item.id || `media-${idx}`,
              url: item.url,
              type: item.type === 'video' || isLikelyVideoUrl(item.url) ? 'video' : 'image',
              title: sanitizeCustomerProductText(item.title || ''),
            };
          });
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.media)) {
          rawMedia = parsed.media
            .filter((item: any) => item && typeof item.url === 'string' && item.url.trim())
            .map((item: any, idx: number) => ({
              id: item.id || `media-${idx}`,
              url: item.url,
              type: item.type === 'video' || isLikelyVideoUrl(item.url) ? 'video' : 'image',
              title: sanitizeCustomerProductText(item.title || ''),
            }));
        }
        const rawOfferObj =
          parsed.offerMeta && typeof parsed.offerMeta === 'object'
            ? parsed.offerMeta
            : parsed.offer && typeof parsed.offer === 'object'
            ? parsed.offer
            : null;
        if (rawOfferObj) {
          const rawPromoCode = String(rawOfferObj.promoCouponCode || '').trim();
          offerMeta = {
            badgeText: sanitizeCustomerOfferBadge(rawOfferObj.badgeText || ''),
            offerEndsAt: rawOfferObj.offerEndsAt || '',
            dealNote: sanitizeCustomerDealNote(rawOfferObj.dealNote || ''),
            promoCouponCode: rawPromoCode === 'SYLHET100' ? '' : rawPromoCode,
            freeDelivery: Boolean(rawOfferObj.freeDelivery),
          };
        }
      }
    } catch {
      rawMedia = [];
    }
  }

  const primaryUrl =
    product.imageUrl ||
    createStudioProductSvg('hoodie', '#14213D', '#286F65', product.sku || 'BOICHITRA BD');

  const allMediaWithPrimary: ParsedMediaItem[] = [
    {
      id: 'primary-img',
      url: primaryUrl,
      type: 'image',
      title: 'মূল ছবি (Primary)',
    },
    ...rawMedia.filter((m) => m.url !== primaryUrl),
  ];

  const imageCount = allMediaWithPrimary.filter((m) => m.type === 'image').length;
  const videoCount = allMediaWithPrimary.filter((m) => m.type === 'video').length;

  return {
    media: rawMedia,
    allMediaWithPrimary,
    offerMeta,
    imageCount,
    videoCount,
  };
}

export function serializeProductGalleryAndOffer(
  media: ParsedMediaItem[],
  offerMeta?: ParsedOfferMeta
): string {
  const cleanedMedia = (media || [])
    .filter((m) => m && typeof m.url === 'string' && m.url.trim().length > 0)
    .map((m, idx) => ({
      id: m.id || `media-${idx}-${Date.now()}`,
      url: m.url.trim(),
      type: m.type === 'video' || isLikelyVideoUrl(m.url) ? ('video' as const) : ('image' as const),
      title: sanitizeCustomerProductText(m.title || ''),
    }));

  const cleanedOffer: ParsedOfferMeta = {};
  const cleanBadge = sanitizeCustomerOfferBadge(offerMeta?.badgeText);
  const cleanDealNote = sanitizeCustomerDealNote(offerMeta?.dealNote);
  if (cleanBadge) cleanedOffer.badgeText = cleanBadge;
  if (offerMeta?.offerEndsAt?.trim()) cleanedOffer.offerEndsAt = offerMeta.offerEndsAt.trim();
  if (cleanDealNote) cleanedOffer.dealNote = cleanDealNote;
  if (offerMeta?.promoCouponCode?.trim())
    cleanedOffer.promoCouponCode = offerMeta.promoCouponCode.trim().toUpperCase();
  if (offerMeta?.freeDelivery) {
    cleanedOffer.freeDelivery = true;
  }

  return JSON.stringify({
    media: cleanedMedia,
    offerMeta: cleanedOffer,
  });
}

export function compressImageFileToDataUrl(file: File, maxDim = 900, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ফাইল রিড করতে সমস্যা হয়েছে'));
    reader.onload = () => {
      const result = String(reader.result || '');
      if (file.type === 'image/svg+xml') {
        resolve(result);
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(result);
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(result);
            return;
          }
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch {
          resolve(result);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

export function createDefaultBanglaQrSvg(
  merchantName = 'Boichitra BD — বৈচিত্র্য',
  accountLabel = 'বাংলা কিউআর মার্চেন্ট'
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 500" width="420" height="500">
    <rect width="420" height="500" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="3"/>
    <!-- Top Bangla QR Header -->
    <rect x="0" y="0" width="420" height="78" rx="24" fill="#006A4E"/>
    <rect x="0" y="45" width="420" height="33" fill="#006A4E"/>
    <circle cx="52" cy="39" r="19" fill="#F42A41"/>
    <text x="84" y="36" fill="#FFFFFF" font-family="sans-serif" font-size="21" font-weight="800" letter-spacing="0.5">BANGLA QR • বাংলা কিউআর</text>
    <text x="84" y="57" fill="#D1FAE5" font-family="sans-serif" font-size="12" font-weight="600">National QR Standard • Bangladesh Bank Approved</text>

    <!-- Merchant Title -->
    <text x="210" y="108" text-anchor="middle" fill="#14213D" font-family="sans-serif" font-size="18" font-weight="800">${merchantName}</text>
    <text x="210" y="128" text-anchor="middle" fill="#286F65" font-family="sans-serif" font-size="12" font-weight="700">${accountLabel}</text>

    <!-- QR Frame -->
    <rect x="85" y="142" width="250" height="250" rx="18" fill="#FFFFFF" stroke="#006A4E" stroke-width="4"/>
    <!-- Corner Finder Patterns -->
    <rect x="103" y="160" width="54" height="54" rx="6" fill="none" stroke="#14213D" stroke-width="8"/>
    <rect x="117" y="174" width="26" height="26" rx="3" fill="#006A4E"/>

    <rect x="263" y="160" width="54" height="54" rx="6" fill="none" stroke="#14213D" stroke-width="8"/>
    <rect x="277" y="174" width="26" height="26" rx="3" fill="#006A4E"/>

    <rect x="103" y="320" width="54" height="54" rx="6" fill="none" stroke="#14213D" stroke-width="8"/>
    <rect x="117" y="334" width="26" height="26" rx="3" fill="#006A4E"/>

    <!-- QR Data Matrix Pattern -->
    <g fill="#14213D">
      <rect x="172" y="160" width="12" height="12"/><rect x="196" y="160" width="24" height="12"/><rect x="232" y="160" width="12" height="24"/>
      <rect x="172" y="184" width="24" height="12"/><rect x="208" y="184" width="12" height="24"/><rect x="244" y="196" width="12" height="12"/>
      <rect x="168" y="212" width="16" height="12"/><rect x="224" y="212" width="24" height="12"/>
      <rect x="103" y="228" width="24" height="12"/><rect x="139" y="228" width="12" height="24"/><rect x="268" y="228" width="24" height="12"/><rect x="304" y="228" width="12" height="24"/>
      <rect x="103" y="252" width="12" height="24"/><rect x="127" y="264" width="24" height="12"/><rect x="256" y="252" width="12" height="24"/><rect x="280" y="264" width="24" height="12"/>
      <rect x="103" y="288" width="36" height="12"/><rect x="151" y="288" width="12" height="20"/><rect x="268" y="288" width="16" height="16"/><rect x="296" y="288" width="20" height="12"/>
      <rect x="172" y="316" width="24" height="12"/><rect x="208" y="316" width="12" height="24"/><rect x="232" y="328" width="24" height="12"/><rect x="268" y="316" width="36" height="12"/>
      <rect x="172" y="340" width="12" height="24"/><rect x="196" y="352" width="24" height="12"/><rect x="232" y="352" width="12" height="22"/><rect x="256" y="340" width="24" height="16"/><rect x="292" y="340" width="24" height="24"/>
      <rect x="256" y="364" width="24" height="10"/>
    </g>

    <!-- Center Bangla QR Badge -->
    <rect x="178" y="235" width="64" height="64" rx="14" fill="#FFFFFF" stroke="#006A4E" stroke-width="3"/>
    <circle cx="210" cy="260" r="14" fill="#F42A41"/>
    <text x="210" y="290" text-anchor="middle" fill="#006A4E" font-family="sans-serif" font-size="10" font-weight="900">বাংলা QR</text>

    <!-- Supported Apps Footer -->
    <rect x="30" y="408" width="360" height="42" rx="12" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
    <text x="210" y="434" text-anchor="middle" fill="#1E293B" font-family="sans-serif" font-size="12.5" font-weight="700">bKash • Nagad • Rocket • Upay • All Bank Apps</text>
    <text x="210" y="476" text-anchor="middle" fill="#64748B" font-family="sans-serif" font-size="11" font-weight="600">অ্যাডমিন প্যানেল (Settings) থেকে আপনার নিজস্ব বাংলা কিউআর ছবি আপলোড করুন</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

export interface BanglaQrSettingsMeta {
  returnPolicyText: string;
  banglaQrEnabled: boolean;
  banglaQrImageUrl: string;
  banglaQrMerchantName: string;
  banglaQrAccountNumber: string;
  banglaQrInstructions: string;
  banglaQrDiscountEnabled: boolean;
  banglaQrDiscountType: 'percentage' | 'fixed';
  banglaQrDiscountValue: number;
  banglaQrMaxDiscountBdt: number;
}

const DEFAULT_RETURN_POLICY =
  'ডেলিভারি পাওয়ার পর ডেলিভারি ম্যানের সামনে পণ্য চেক করে গ্রহণ করুন। ত্রুটিপূর্ণ, ছেঁড়া বা ভুল পণ্য পেলে তাৎক্ষণিক রিটার্ন বা এক্সচেঞ্জ সুবিধা পাবেন।';

const DEFAULT_BANGLA_QR_INSTRUCTIONS =
  'যেকোনো ব্যাংক অ্যাপ, বিকাশ (bKash), নগদ (Nagad), রকেট (Rocket) বা উপায় (Upay) অ্যাপ থেকে উপরের বাংলা কিউআর (Bangla QR) কোডটি স্ক্যান করে পেমেন্ট সম্পন্ন করুন। এরপর নিচে আপনার প্রেরণকারী নম্বর ও ট্রানজেকশন আইডি (TrxID) লিখুন।';

export function parseStoreSettingsWithBanglaQr<T extends { returnPolicyText?: string | null }>(
  rawSettings: T
): T & BanglaQrSettingsMeta {
  const rawText = rawSettings?.returnPolicyText || DEFAULT_RETURN_POLICY;
  let returnPolicyText = rawText;
  let banglaQrEnabled = true;
  let banglaQrImageUrl = '';
  let banglaQrMerchantName = 'Boichitra BD — বৈচিত্র্য';
  let banglaQrAccountNumber = 'বাংলা কিউআর মার্চেন্ট / পার্সোনাল রিসিভার';
  let banglaQrInstructions = DEFAULT_BANGLA_QR_INSTRUCTIONS;
  let banglaQrDiscountEnabled = true;
  let banglaQrDiscountType: 'percentage' | 'fixed' = 'percentage';
  let banglaQrDiscountValue = 5;
  let banglaQrMaxDiscountBdt = 300;

  if (rawText.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed && parsed.__boichitraSettingsV2) {
        returnPolicyText = parsed.returnPolicyText || DEFAULT_RETURN_POLICY;
        banglaQrEnabled = parsed.banglaQrEnabled !== false;
        banglaQrImageUrl = parsed.banglaQrImageUrl || '';
        banglaQrMerchantName = parsed.banglaQrMerchantName || 'Boichitra BD — বৈচিত্র্য';
        banglaQrAccountNumber =
          parsed.banglaQrAccountNumber || 'বাংলা কিউআর মার্চেন্ট / পার্সোনাল রিসিভার';
        banglaQrInstructions = parsed.banglaQrInstructions || DEFAULT_BANGLA_QR_INSTRUCTIONS;
        banglaQrDiscountEnabled = parsed.banglaQrDiscountEnabled !== false;
        banglaQrDiscountType =
          parsed.banglaQrDiscountType === 'fixed' ? 'fixed' : 'percentage';
        banglaQrDiscountValue =
          typeof parsed.banglaQrDiscountValue === 'number' && parsed.banglaQrDiscountValue >= 0
            ? parsed.banglaQrDiscountValue
            : 5;
        banglaQrMaxDiscountBdt =
          typeof parsed.banglaQrMaxDiscountBdt === 'number' && parsed.banglaQrMaxDiscountBdt >= 0
            ? parsed.banglaQrMaxDiscountBdt
            : 300;
      }
    } catch {
      // Keep plain text fallback
    }
  }

  return {
    ...rawSettings,
    returnPolicyText,
    banglaQrEnabled,
    banglaQrImageUrl:
      banglaQrImageUrl || createDefaultBanglaQrSvg(banglaQrMerchantName, banglaQrAccountNumber),
    banglaQrMerchantName,
    banglaQrAccountNumber,
    banglaQrInstructions,
    banglaQrDiscountEnabled,
    banglaQrDiscountType,
    banglaQrDiscountValue,
    banglaQrMaxDiscountBdt,
  };
}

export function serializeReturnPolicyWithBanglaQr(input: {
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
}): string {
  return JSON.stringify({
    __boichitraSettingsV2: true,
    returnPolicyText: (input.returnPolicyText || DEFAULT_RETURN_POLICY).trim(),
    banglaQrEnabled: input.banglaQrEnabled !== false,
    banglaQrImageUrl: (input.banglaQrImageUrl || '').trim(),
    banglaQrMerchantName: (input.banglaQrMerchantName || 'Boichitra BD — বৈচিত্র্য').trim(),
    banglaQrAccountNumber: (
      input.banglaQrAccountNumber || 'বাংলা কিউআর মার্চেন্ট / পার্সোনাল রিসিভার'
    ).trim(),
    banglaQrInstructions: (input.banglaQrInstructions || DEFAULT_BANGLA_QR_INSTRUCTIONS).trim(),
    banglaQrDiscountEnabled: input.banglaQrDiscountEnabled !== false,
    banglaQrDiscountType: input.banglaQrDiscountType === 'fixed' ? 'fixed' : 'percentage',
    banglaQrDiscountValue: Math.max(0, Number(input.banglaQrDiscountValue ?? 5)),
    banglaQrMaxDiscountBdt: Math.max(0, Number(input.banglaQrMaxDiscountBdt ?? 300)),
  });
}

export function calculateBanglaQrDiscountBdt(
  subtotalAfterCouponBdt: number,
  settings?: {
    banglaQrEnabled?: boolean;
    banglaQrDiscountEnabled?: boolean;
    banglaQrDiscountType?: 'percentage' | 'fixed';
    banglaQrDiscountValue?: number;
    banglaQrMaxDiscountBdt?: number;
  } | null
): number {
  if (subtotalAfterCouponBdt <= 0) return 0;
  if (settings?.banglaQrEnabled === false || settings?.banglaQrDiscountEnabled === false) {
    return 0;
  }
  const type = settings?.banglaQrDiscountType || 'percentage';
  const val = Number(settings?.banglaQrDiscountValue ?? 5);
  const maxCap = Number(settings?.banglaQrMaxDiscountBdt ?? 300);

  if (val <= 0) return 0;

  let discount = 0;
  if (type === 'percentage') {
    discount = Math.round((subtotalAfterCouponBdt * val) / 100);
    if (maxCap > 0 && discount > maxCap) {
      discount = maxCap;
    }
  } else {
    discount = Math.round(val);
  }

  return Math.min(discount, subtotalAfterCouponBdt);
}

export function getBanglaQrDiscountBadgeText(settings?: {
  banglaQrEnabled?: boolean;
  banglaQrDiscountEnabled?: boolean;
  banglaQrDiscountType?: 'percentage' | 'fixed';
  banglaQrDiscountValue?: number;
  banglaQrMaxDiscountBdt?: number;
} | null): string {
  if (settings?.banglaQrEnabled === false || settings?.banglaQrDiscountEnabled === false) {
    return '';
  }
  const type = settings?.banglaQrDiscountType || 'percentage';
  const val = Number(settings?.banglaQrDiscountValue ?? 5);
  const maxCap = Number(settings?.banglaQrMaxDiscountBdt ?? 300);
  if (val <= 0) return '';

  if (type === 'percentage') {
    return maxCap > 0
      ? `অগ্রিম বাংলা কিউআর পেমেন্টে ${val}% বিশেষ ছাড় (সর্বোচ্চ ৳${maxCap})`
      : `অগ্রিম বাংলা কিউআর পেমেন্টে ${val}% বিশেষ ছাড়!`;
  }
  return `অগ্রিম বাংলা কিউআর পেমেন্টে ৳${val} বিশেষ ছাড়!`;
}

export interface ParsedManualPayment {
  method: 'BANGLA_QR';
  senderPhone: string;
  transactionId: string;
  paidAmountBdt?: number;
  qrDiscountBdt?: number;
  screenshotUrl?: string;
  submittedAt?: string;
}

export function parseOrderNoteWithManualPayment(rawOrderNote: string | null | undefined): {
  orderNote: string;
  manualPayment: ParsedManualPayment | null;
} {
  const raw = rawOrderNote || '';
  if (raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.__boichitraOrderV2) {
        return {
          orderNote: parsed.orderNote || '',
          manualPayment: parsed.manualPayment || null,
        };
      }
    } catch {
      // Fallback to plain note
    }
  }
  return {
    orderNote: raw,
    manualPayment: null,
  };
}

export function serializeOrderNoteWithManualPayment(
  orderNote: string,
  manualPayment?: ParsedManualPayment | null
): string {
  if (!manualPayment) {
    return (orderNote || '').trim();
  }
  return JSON.stringify({
    __boichitraOrderV2: true,
    orderNote: (orderNote || '').trim(),
    manualPayment,
  });
}

// ============================================================================
// CLOTHING COLOR & SIZE VARIANT HELPERS
// ============================================================================

export function getColorSwatchHex(colorName: string): string {
  const c = (colorName || '').toLowerCase();
  if (c.includes('navy') || c.includes('নেভি') || c.includes('blue') || c.includes('নীল')) {
    return '#14213D';
  }
  if (
    c.includes('teal') ||
    c.includes('emerald') ||
    c.includes('টিল') ||
    c.includes('এমেরাল্ড') ||
    c.includes('সবুজ') ||
    c.includes('forest')
  ) {
    return '#286F65';
  }
  if (c.includes('olive') || c.includes('অলিভ')) {
    return '#3F6212';
  }
  if (c.includes('charcoal') || c.includes('চারকোল') || c.includes('ash') || c.includes('অ্যাশ')) {
    return '#374151';
  }
  if (c.includes('black') || c.includes('কালো') || c.includes('ব্ল্যাক') || c.includes('obsidian')) {
    return '#111827';
  }
  if (c.includes('maroon') || c.includes('মেরুন') || c.includes('red') || c.includes('লাল') || c.includes('burgundy')) {
    return '#7F1D1D';
  }
  if (c.includes('white') || c.includes('সাদা') || c.includes('হোয়াইট') || c.includes('cream')) {
    return '#F8FAFC';
  }
  if (c.includes('coffee') || c.includes('brown') || c.includes('কফি') || c.includes('খয়েরি') || c.includes('beige')) {
    return '#78350F';
  }
  if (c.includes('mustard') || c.includes('yellow') || c.includes('মাস্টার্ড') || c.includes('হলুদ') || c.includes('gold')) {
    return '#B45309';
  }
  return '#286F65';
}

export function extractDistinctColorsAndSizes<
  T extends {
    id: number;
    size: string | null;
    color: string | null;
    stockQuantity: number;
    priceAdjustmentBdt: number;
  }
>(variants: T[]): {
  colors: string[];
  sizes: string[];
  hasSeparateColorAndSize: boolean;
} {
  const colorSet = new Set<string>();
  const sizeSet = new Set<string>();

  for (const v of variants || []) {
    const col = (v.color || '').trim();
    const sz = (v.size || '').trim();
    if (col) colorSet.add(col);
    if (sz) sizeSet.add(sz);
  }

  const colors = Array.from(colorSet);
  const sizes = Array.from(sizeSet);

  return {
    colors,
    sizes,
    hasSeparateColorAndSize: colors.length > 0 && sizes.length > 0,
  };
}

export function findBestMatchingVariant<
  T extends {
    id: number;
    size: string | null;
    color: string | null;
    stockQuantity: number;
  }
>(
  variants: T[],
  targetColor: string,
  targetSize: string,
  preferColorMatch = true
): T | null {
  if (!variants || variants.length === 0) return null;

  const exact = variants.find(
    (v) =>
      (v.color || '').trim() === targetColor.trim() &&
      (v.size || '').trim() === targetSize.trim()
  );
  if (exact) return exact;

  if (preferColorMatch) {
    const sameColorInStock = variants.find(
      (v) => (v.color || '').trim() === targetColor.trim() && v.stockQuantity > 0
    );
    if (sameColorInStock) return sameColorInStock;

    const sameColorAny = variants.find((v) => (v.color || '').trim() === targetColor.trim());
    if (sameColorAny) return sameColorAny;
  } else {
    const sameSizeInStock = variants.find(
      (v) => (v.size || '').trim() === targetSize.trim() && v.stockQuantity > 0
    );
    if (sameSizeInStock) return sameSizeInStock;

    const sameSizeAny = variants.find((v) => (v.size || '').trim() === targetSize.trim());
    if (sameSizeAny) return sameSizeAny;
  }

  return variants[0];
}

// ============================================================================
// PRODUCT PROMOTION DEEP-LINK & CLIPBOARD HELPERS
// ============================================================================

export function buildProductPromoUrl(
  product: { id?: number; slug?: string; sku?: string },
  options?: { directCheckout?: boolean; customOrigin?: string }
): string {
  const identifier = (product.slug || product.sku || String(product.id || '')).trim();
  const origin =
    options?.customOrigin ||
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://boichitrabd.com');

  const params = new URLSearchParams();
  if (identifier) {
    params.set('product', identifier);
  }
  if (options?.directCheckout) {
    params.set('checkout', '1');
  }
  const qs = params.toString();
  return qs ? `${origin.replace(/\/+$/, '')}/?${qs}` : `${origin.replace(/\/+$/, '')}/`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below for iframe or non-HTTPS contexts
  }
  try {
    if (typeof document !== 'undefined') {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    }
  } catch {
    return false;
  }
  return false;
}

export function trackMetaPixelEvent(
  eventName: 'PageView' | 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase',
  params?: Record<string, any>
): void {
  try {
    if (typeof window !== 'undefined' && typeof (window as any).fbq === 'function') {
      if (params && Object.keys(params).length > 0) {
        (window as any).fbq('track', eventName, params);
      } else {
        (window as any).fbq('track', eventName);
      }
    }
  } catch {
    // Never let analytics block user interaction
  }
}




