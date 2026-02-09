import React, { useState, useEffect } from 'react';
import { loadMerchItems } from '../utils/adminApi';

interface StoreProps {
  onSectionChange?: (section: string, prefill?: { subject: string; message: string }) => void;
}

interface MerchItem {
  id: number;
  src: string;
  alt: string;
  caption: string;
  price: string;
  category: string;
  active: boolean;
  sizes?: {
    S: boolean;
    M: boolean;
    L: boolean;
    XL: boolean;
  };
  soldOut: boolean;
}

// Grouper les produits par type unique (ex: "T-shirt", "Sylvain T-shirt", etc.)
interface ProductGroup {
  name: string;
  price: string;
  category: string;
  sizes?: { S: boolean; M: boolean; L: boolean; XL: boolean };
  soldOut: boolean;
  images: MerchItem[];
  mainImage: MerchItem;
}

const Store: React.FC<StoreProps> = ({ onSectionChange }) => {
  const [merchItems, setMerchItems] = useState<MerchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<ProductGroup | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const loadMerchData = async () => {
      try {
        const data = await loadMerchItems();
        const activeItems = data.filter((item: MerchItem) => item.active);
        setMerchItems(activeItems);
      } catch (error) {
        console.error('Erreur chargement store:', error);
        // Données de fallback
        const fallbackData: MerchItem[] = [
          { id: 13, src: 'images/Merch_Tshirt-Front.webp', alt: 'Tshirt Front', caption: 'T-shirt', price: '30$ CAD', category: 'tshirt', active: true, sizes: { S: true, M: true, L: true, XL: true }, soldOut: false },
          { id: 12, src: 'images/Merch_Tshirt-Back.webp', alt: 'Tshirt Back', caption: 'T-shirt', price: '30$ CAD', category: 'tshirt', active: true, sizes: { S: true, M: true, L: true, XL: true }, soldOut: false },
          { id: 2, src: 'images/Merch_CrewNeck-Front.webp', alt: 'Sweatshirt Front', caption: 'Sweatshirt', price: '50$ CAD', category: 'sweatshirt', active: true, sizes: { S: false, M: true, L: true, XL: true }, soldOut: false },
          { id: 1, src: 'images/Merch_CrewNeck-Back.webp', alt: 'Sweatshirt Back', caption: 'Sweatshirt', price: '50$ CAD', category: 'sweatshirt', active: true, sizes: { S: false, M: true, L: true, XL: true }, soldOut: false },
          { id: 4, src: 'images/Merch_Hoodie F.webp', alt: 'Hoodie Front', caption: 'Hoodie', price: '50$ CAD', category: 'hoodie', active: true, sizes: { S: false, M: false, L: true, XL: false }, soldOut: false },
          { id: 3, src: 'images/Merch_Hoodie-Back.webp', alt: 'Hoodie Back', caption: 'Hoodie', price: '50$ CAD', category: 'hoodie', active: true, sizes: { S: false, M: false, L: true, XL: false }, soldOut: false },
          { id: 5, src: 'images/Merch_Bag-Brown.webp', alt: 'Bag Brown', caption: 'Hip Bag Brown', price: '80$ CAD', category: 'bag', active: true, soldOut: true },
          { id: 6, src: 'images/Merch_Bag-Orange.webp', alt: 'Bag Orange', caption: 'Hip Bag Orange', price: '80$ CAD', category: 'bag', active: true, soldOut: false },
          { id: 7, src: 'images/Merch_Bag-Pink.webp', alt: 'Bag Pink', caption: 'Hip Bag Pink', price: '80$ CAD', category: 'bag', active: true, soldOut: false },
          { id: 8, src: 'images/Merch_Bag-red.webp', alt: 'Bag Red', caption: 'Hip Bag Red', price: '80$ CAD', category: 'bag', active: true, soldOut: true },
          { id: 9, src: 'images/Merch_Bag-Purple.webp', alt: 'Bag Purple', caption: 'Hip Bag Purple', price: '80$ CAD', category: 'bag', active: true, soldOut: false },
        ];
        setMerchItems(fallbackData);
      } finally {
        setLoading(false);
      }
    };
    loadMerchData();
  }, []);

  // Grouper les produits par nom (caption)
  const getProductGroups = (): ProductGroup[] => {
    const groups: { [key: string]: ProductGroup } = {};
    
    merchItems.forEach(item => {
      const key = item.caption;
      if (!groups[key]) {
        // Trouver l'image "Front" si disponible
        const frontImage = merchItems.find(
          i => i.caption === item.caption && i.alt.toLowerCase().includes('front')
        );
        groups[key] = {
          name: item.caption,
          price: item.price,
          category: item.category,
          sizes: item.sizes,
          soldOut: item.soldOut,
          images: [],
          mainImage: frontImage || item
        };
      }
      groups[key].images.push(item);
    });
    
    // Ordonner: T-shirts, Sweatshirts, Hoodies, Bags
    const order = ['tshirt', 'sweatshirt', 'hoodie', 'bag'];
    return Object.values(groups).sort((a, b) => {
      return order.indexOf(a.category) - order.indexOf(b.category);
    });
  };

  const openLightbox = (product: ProductGroup) => {
    setCurrentProduct(product);
    setCurrentImageIndex(0);
    setLightboxOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setCurrentProduct(null);
    document.body.style.overflow = 'auto';
  };

  const nextImage = () => {
    if (currentProduct) {
      setCurrentImageIndex((prev) => (prev + 1) % currentProduct.images.length);
    }
  };

  const prevImage = () => {
    if (currentProduct) {
      setCurrentImageIndex((prev) => (prev - 1 + currentProduct.images.length) % currentProduct.images.length);
    }
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [lightboxOpen, currentProduct]);

  useEffect(() => {
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  const products = getProductGroups();

  return (
    <div className="store-page">
      {/* Message d'intro */}
      <div className="store-intro">
        <p>
          To place an order, send us an email via the{' '}
          <a 
            href="#contact" 
            onClick={(e) => {
              e.preventDefault();
              if (onSectionChange) onSectionChange('message');
            }}
          >
            contact form
          </a>{' '}
          specifying the item, size and your shipping address. All sizes are available to order. Prices are taxes included. Shipping fees apply.
        </p>
      </div>

      {/* Grille de produits */}
      <div className="store-grid">
        {loading ? (
          <div className="store-loading">Loading...</div>
        ) : (
          products.map((product) => (
            <div 
              key={product.name} 
              className="product-card"
              onClick={() => openLightbox(product)}
            >
              
              {/* Image du produit */}
              <div className="product-image-wrapper">
                <img 
                  src={product.mainImage.src} 
                  alt={product.name}
                  className="product-image"
                  loading="lazy"
                />
                {product.images.length > 1 && (
                  <div className="product-image-count">
                    <span>{product.images.length} photos</span>
                  </div>
                )}
              </div>

              {/* Infos produit */}
              <div className="product-info">
                <h3 className="product-name">{product.name}</h3>
                <div className="product-price">{product.price}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && currentProduct && (
        <div className="store-lightbox" onClick={closeLightbox}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            {/* Bouton fermer */}
            <button className="lightbox-close" onClick={closeLightbox}>×</button>

            {/* Galerie d'images */}
            <div className="lightbox-gallery">
              {/* Navigation */}
              {currentProduct.images.length > 1 && (
                <>
                  <button className="lightbox-nav prev" onClick={prevImage}>‹</button>
                  <button className="lightbox-nav next" onClick={nextImage}>›</button>
                </>
              )}

              {/* Image principale */}
              <div className="lightbox-main-image">
                <img 
                  src={currentProduct.images[currentImageIndex].src}
                  alt={currentProduct.images[currentImageIndex].alt}
                />
              </div>

              {/* Thumbnails */}
              {currentProduct.images.length > 1 && (
                <div className="lightbox-thumbnails">
                  {currentProduct.images.map((img, idx) => (
                    <button
                      key={img.id}
                      className={`thumbnail ${idx === currentImageIndex ? 'active' : ''}`}
                      onClick={() => setCurrentImageIndex(idx)}
                    >
                      <img src={img.src} alt={img.alt} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Détails produit */}
            <div className="lightbox-details">
              <h2 className="lightbox-title">{currentProduct.name}</h2>
              <div className="lightbox-price">{currentProduct.price}</div>

              {/* Instructions */}
              <div className="lightbox-order-info">
                <p>
                  To order this item, send us an email via the contact form 
                  specifying the product{currentProduct.category !== 'bag' ? ', size' : ''} and your shipping address. 
                  Price is taxes included. Shipping fees apply.
                </p>
                <button 
                  className="order-button"
                  onClick={() => {
                    closeLightbox();
                    const hasSize = currentProduct.category !== 'bag';
                    if (onSectionChange) onSectionChange('message', {
                      subject: `Order: ${currentProduct.name}`,
                      message: `Item: ${currentProduct.name}\nPrice: ${currentProduct.price} (taxes included)\n${hasSize ? 'Size: \n' : ''}Shipping address: \n\n`
                    });
                  }}
                >
                  Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Store;
