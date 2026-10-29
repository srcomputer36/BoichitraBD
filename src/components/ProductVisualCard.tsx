import React, { useState } from 'react';
import { ShoppingBag, Eye, Play, Images, Share2, Check } from 'lucide-react';
import { Product, ProductVariant } from '../types.ts';
import { formatBdt } from '../lib/bd-locations.ts';
import {
  createStudioProductSvg,
  parseProductGalleryAndOffer,
  extractDistinctColorsAndSizes,
  findBestMatchingVariant,
  getColorSwatchHex,
  buildProductPromoUrl,
  copyTextToClipboard,
} from '../lib/visuals.ts';

interface ProductImageProps {
  src: string;
  alt: string;
  sku?: string;
  className?: string;
}

export const ResilientProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  sku = 'BOICHITRA BD',
  className = 'w-full h-full object-cover',
}) => {
  const [hasError, setHasError] = useState(false);
  const fallbackSrc = createStudioProductSvg('hoodie', '#14213D', '#286F65', sku);

  return (
    <img
      src={hasError || !src ? fallbackSrc : src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={() => setHasError(true)}
      className={className}
    />
  );
};

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product, preselectedVariant?: ProductVariant | null) => void;
  onQuickAdd: (product: Product, selectedVariant?: ProductVariant | null) => void;
  onSelectCategory?: (categoryId: number) => void;
  storeFreeDelivery?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  onQuickAdd,
  onSelectCategory,
  storeFreeDelivery = false,
}) => {
  const { allMediaWithPrimary, offerMeta, imageCount, videoCount } =
    parseProductGalleryAndOffer(product);
  const imageItems = allMediaWithPrimary.filter((m) => m.type === 'image');
  const [previewIdx, setPreviewIdx] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyCardLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = buildProductPromoUrl(product);
    await copyTextToClipboard(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  // Per-card separate Color & Size variant state
  const [cardVariantId, setCardVariantId] = useState<number | null>(() =>
    product.variants && product.variants.length > 0 ? product.variants[0].id : null
  );

  const selectedCardVariant =
    product.variants.find((v) => v.id === cardVariantId) ||
    (product.variants.length > 0 ? product.variants[0] : null);

  const { colors, sizes } = extractDistinctColorsAndSizes(product.variants || []);
  const activeColor = selectedCardVariant?.color || colors[0] || '';
  const activeSize = selectedCardVariant?.size || sizes[0] || '';

  const handleSelectColor = (e: React.MouseEvent, col: string) => {
    e.stopPropagation();
    const matched = findBestMatchingVariant(product.variants, col, activeSize, true);
    if (matched) {
      setCardVariantId(matched.id);
    }
  };

  const handleSelectSize = (e: React.MouseEvent, sz: string) => {
    e.stopPropagation();
    const matched = findBestMatchingVariant(product.variants, activeColor, sz, false);
    if (matched) {
      setCardVariantId(matched.id);
    }
  };

  const activeImageSrc =
    imageItems[previewIdx]?.url || product.imageUrl;

  const baseEffectivePrice =
    product.salePriceBdt && product.salePriceBdt < product.priceBdt
      ? product.salePriceBdt
      : product.priceBdt;

  const variantAdjustment = selectedCardVariant ? selectedCardVariant.priceAdjustmentBdt : 0;
  const effectivePrice = baseEffectivePrice + variantAdjustment;

  const hasDiscount =
    product.salePriceBdt !== null &&
    product.salePriceBdt > 0 &&
    product.salePriceBdt < product.priceBdt;

  const discountPercent = hasDiscount
    ? Math.round(((product.priceBdt - baseEffectivePrice) / product.priceBdt) * 100)
    : 0;

  const outOfStock =
    product.stockQuantity <= 0 ||
    (selectedCardVariant !== null && selectedCardVariant.stockQuantity <= 0);

  return (
    <article className="group bg-white rounded-xl border border-slate-200/80 overflow-hidden flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md">
      <div>
        {/* Product Image Container (4:3 aspect ratio, neutral solid backdrop) */}
        <div
          onClick={() => onSelect(product, selectedCardVariant)}
          className="relative aspect-4/3 bg-slate-100 cursor-pointer overflow-hidden"
        >
          <ResilientProductImage
            src={activeImageSrc}
            alt={`${product.nameBn} - ${product.name}`}
            sku={product.sku}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          />

          {/* Top-left Status / Special Offer Tag */}
          <div className="absolute top-3 left-3 flex flex-col items-start gap-1">
            {product.stockQuantity <= 0 ? (
              <span className="text-[11px] font-semibold tracking-wide text-red-700 bg-white/95 px-2 py-0.5 rounded shadow-2xs">
                স্টক শেষ (Out of Stock)
              </span>
            ) : (
              <>
                {(offerMeta.freeDelivery || storeFreeDelivery) && (
                  <span className="text-[11px] font-bold tracking-wide text-white bg-[#006A4E]/95 px-2 py-0.5 rounded shadow-2xs">
                    🚚 ফ্রি ডেলিভারি
                  </span>
                )}
                {product.isSpecialOffer && (
                  <span className="text-[11px] font-bold tracking-wide text-white bg-[#14213D]/95 px-2 py-0.5 rounded shadow-2xs">
                    {offerMeta.badgeText || 'বিশেষ অফার'}
                  </span>
                )}
                {hasDiscount && (
                  <span className="text-[11px] font-semibold tracking-wide text-[#16A34A] bg-white/95 px-2 py-0.5 rounded tabular-nums shadow-2xs">
                    সাশ্রয় {formatBdt(product.priceBdt - baseEffectivePrice)} ({discountPercent}% ছাড়)
                  </span>
                )}
              </>
            )}
          </div>

          {/* Bottom-left Media Count Indicators (Multiple Photos / Video) */}
          {(imageCount > 1 || videoCount > 0) && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
              {imageCount > 1 && (
                <span className="px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium inline-flex items-center gap-1 tabular-nums">
                  <Images className="w-3 h-3" />
                  <span>{imageCount}টি ছবি</span>
                </span>
              )}
              {videoCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-[#16A34A] text-white text-[10px] font-semibold inline-flex items-center gap-1 tabular-nums">
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>ভিডিও</span>
                </span>
              )}
            </div>
          )}

          <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyCardLink}
              title="প্রমোশন / পণ্যের লিংক কপি করুন"
              aria-label={`লিংক কপি করুন: ${product.nameBn}`}
              className={`px-2 py-1.5 rounded-lg shadow-sm text-[11px] font-semibold inline-flex items-center gap-1 transition-all ${
                copiedLink
                  ? 'bg-[#16A34A] text-white'
                  : 'bg-white/95 text-[#14213D] hover:bg-[#14213D] hover:text-white'
              }`}
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>কপি হয়েছে!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>লিংক</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(product, selectedCardVariant);
              }}
              aria-label={`বিস্তারিত দেখুন: ${product.nameBn}`}
              className="p-2 bg-white/95 text-[#14213D] rounded-lg shadow-sm hover:bg-[#14213D] hover:text-white transition-colors"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mini Image Switcher Bar when multiple images exist */}
        {imageItems.length > 1 && (
          <div className="px-4 pt-2.5 flex items-center gap-1.5 overflow-x-auto">
            {imageItems.slice(0, 5).map((imgItem, idx) => (
              <button
                key={imgItem.id}
                type="button"
                onMouseEnter={() => setPreviewIdx(idx)}
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewIdx(idx);
                }}
                aria-label={`ছবি ${idx + 1}`}
                className={`w-8 h-6 rounded overflow-hidden border transition-all shrink-0 ${
                  previewIdx === idx
                    ? 'border-[#286F65] ring-1 ring-[#286F65]'
                    : 'border-slate-200 opacity-70 hover:opacity-100'
                }`}
              >
                <ResilientProductImage
                  src={imgItem.url}
                  alt={imgItem.title || product.nameBn}
                  sku={product.sku}
                />
              </button>
            ))}
          </div>
        )}

        {/* Clean Unboxed Metadata & Title */}
        <div className="p-4 pb-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
            {onSelectCategory ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCategory(product.categoryId);
                }}
                className="truncate font-semibold text-[#286F65] hover:text-[#14213D] hover:underline transition-colors"
                title={`${product.categoryNameBn || product.categoryName} বিভাগের সকল পণ্য দেখুন`}
              >
                {product.categoryNameBn || product.categoryName}
              </button>
            ) : (
              <span className="truncate">{product.categoryNameBn || product.categoryName}</span>
            )}
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[11px] tabular-nums">{product.sku}</span>
            <span aria-hidden="true">·</span>
            <span className={outOfStock ? 'text-red-600 font-medium' : 'text-[#286F65] font-medium'}>
              {outOfStock
                ? 'স্টক নেই'
                : `স্টকে আছে (${selectedCardVariant ? selectedCardVariant.stockQuantity : product.stockQuantity})`}
            </span>
          </div>

          <h3
            onClick={() => onSelect(product, selectedCardVariant)}
            className="text-base font-semibold text-[#172126] group-hover:text-[#286F65] transition-colors cursor-pointer line-clamp-1"
          >
            {product.nameBn}
          </h3>
          <p
            onClick={() => onSelect(product, selectedCardVariant)}
            className="text-xs text-slate-500 line-clamp-1 mt-0.5 cursor-pointer"
          >
            {product.name}
          </p>
          {product.isSpecialOffer && offerMeta.dealNote && (
            <p className="text-[11px] text-[#286F65] font-medium mt-1 line-clamp-1">
              ★ {offerMeta.dealNote}
            </p>
          )}

          {/* SEPARATE COLOR & SIZE SELECTOR FOR CLOTHING / VARIANT PRODUCTS */}
          {product.variants.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
              {/* 1. Separate Color Selector */}
              {colors.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-600 shrink-0">
                    কালার:
                  </span>
                  {colors.map((col) => {
                    const isSelectedCol = activeColor === col;
                    const swatchHex = getColorSwatchHex(col);
                    const hasStockInCol = product.variants.some(
                      (v) => (v.color || '').trim() === col && v.stockQuantity > 0
                    );
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={(e) => handleSelectColor(e, col)}
                        disabled={!hasStockInCol}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium border inline-flex items-center gap-1.5 transition-all ${
                          !hasStockInCol
                            ? 'bg-slate-50 text-slate-400 border-slate-200 opacity-50 cursor-not-allowed'
                            : isSelectedCol
                            ? 'bg-[#14213D] text-white border-[#14213D] shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-[#286F65]'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-white/60 shrink-0"
                          style={{ backgroundColor: swatchHex }}
                        />
                        <span>{col}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 2. Separate Size Selector */}
              {sizes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-600 shrink-0">
                    সাইজ:
                  </span>
                  {sizes.map((sz) => {
                    const isSelectedSz = activeSize === sz;
                    const exactCombo = product.variants.find(
                      (v) =>
                        (v.color || '').trim() === activeColor && (v.size || '').trim() === sz
                    );
                    const anySizeStock = product.variants.some(
                      (v) => (v.size || '').trim() === sz && v.stockQuantity > 0
                    );
                    const isExactAvailable = exactCombo ? exactCombo.stockQuantity > 0 : false;

                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={(e) => handleSelectSize(e, sz)}
                        disabled={!anySizeStock}
                        title={
                          !isExactAvailable && anySizeStock
                            ? `${sz} সাইজ অন্য কালারে উপলব্ধ`
                            : `${sz} সাইজ নির্বাচন করুন`
                        }
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all tabular-nums ${
                          !anySizeStock
                            ? 'bg-slate-50 text-slate-400 border-slate-200 line-through cursor-not-allowed'
                            : isSelectedSz
                            ? 'bg-[#286F65] text-white border-[#286F65] shadow-2xs'
                            : isExactAvailable
                            ? 'bg-white text-[#14213D] border-slate-300 hover:border-[#286F65]'
                            : 'bg-slate-50 text-slate-500 border-dashed border-slate-300 hover:border-[#286F65]'
                        }`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Price Baseline & Action */}
      <div className="p-4 pt-3 flex items-center justify-between gap-3 border-t border-slate-100 mt-2">
        <div className="flex items-baseline gap-2 tabular-nums">
          <span className="text-lg font-bold text-[#14213D]">
            {formatBdt(effectivePrice)}
          </span>
          {hasDiscount && (
            <span className="text-xs text-slate-400 line-through">
              {formatBdt(product.priceBdt + variantAdjustment)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {product.variants.length > 0 && (
            <button
              type="button"
              onClick={() => onSelect(product, selectedCardVariant)}
              className="px-2.5 py-2 rounded-lg text-xs font-medium border border-slate-300 text-slate-700 hover:border-[#14213D] hover:text-[#14213D] transition-colors whitespace-nowrap"
            >
              বিস্তারিত
            </button>
          )}
          <button
            type="button"
            disabled={outOfStock}
            onClick={() => onQuickAdd(product, selectedCardVariant)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              outOfStock
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-[#14213D] text-white hover:bg-[#286F65] focus-visible:ring-2 focus-visible:ring-[#286F65]'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>কার্টে নিন</span>
          </button>
        </div>
      </div>
    </article>
  );
};


