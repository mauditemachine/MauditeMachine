import React, { useState, useEffect } from 'react';

interface StoreProps {
  onSectionChange?: (section: string) => void;
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

const Store: React.FC<StoreProps> = ({ onSectionChange }) => {
  const [merchItems, setMerchItems] = useState<MerchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentGroupImages, setCurrentGroupImages] = useState<MerchItem[]>([]);

  useEffect(() => {
    const loadMerchData = async () => {
      try {
        console.log('🔍 Début chargement /store.json');
        const response = await fetch('/store.json');
        console.log('🔍 Response status:', response.status, response.ok);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('🔍 Données brutes:', data);
        console.log('🔍 Type des données:', Array.isArray(data), typeof data);
        console.log('🔍 Nombre total d\'articles:', data.length);
        
        const activeItems = data.filter((item: MerchItem) => item.active);
        console.log('🔍 Articles actifs:', activeItems.length);
        console.log('🔍 Premier article actif:', activeItems[0]);
        
        setMerchItems(activeItems);
      } catch (error) {
        console.error('❌ ERREUR chargement store:', error);
        // Données de test en cas d'erreur - utiliser les vraies données avec plusieurs images par catégorie
        const testData = [
          // T-shirts - T-shirt normal en premier
          {
            id: 13,
            src: 'images/Merch_Tshirt-Front.webp',
            alt: 'Tshirt Front',
            caption: 'T-shirt',
            price: '30$ CAD',
            category: 'tshirt',
            active: true,
            sizes: { S: true, M: true, L: true, XL: true },
            soldOut: false
          },
          {
            id: 12,
            src: 'images/Merch_Tshirt-Back.webp',
            alt: 'Tshirt Back',
            caption: 'T-shirt',
            price: '30$ CAD',
            category: 'tshirt',
            active: true,
            sizes: { S: true, M: true, L: true, XL: true },
            soldOut: false
          },
          {
            id: 11,
            src: 'images/Merch_Sylvain-Tshirt-Front.webp',
            alt: 'Sylvain Tshirt Front',
            caption: 'Sylvain T-shirt',
            price: '30$ CAD',
            category: 'tshirt',
            active: true,
            sizes: { S: true, M: true, L: true, XL: true },
            soldOut: false
          },
          {
            id: 10,
            src: 'images/Merch_Sylvain-Tshirt-Back.webp',
            alt: 'Sylvain Tshirt Back',
            caption: 'Sylvain T-shirt',
            price: '30$ CAD',
            category: 'tshirt',
            active: true,
            sizes: { S: true, M: true, L: true, XL: true },
            soldOut: false
          },
          // Sweatshirts
          {
            id: 1,
            src: 'images/Merch_CrewNeck-Back.webp',
            alt: 'Sweatshirt Back',
            caption: 'Sweatshirt',
            price: '50$ CAD',
            category: 'sweatshirt',
            active: true,
            sizes: { S: false, M: true, L: true, XL: true },
            soldOut: false
          },
          {
            id: 2,
            src: 'images/Merch_CrewNeck-Front.webp',
            alt: 'Sweatshirt Front',
            caption: 'Sweatshirt',
            price: '50$ CAD',
            category: 'sweatshirt',
            active: true,
            sizes: { S: false, M: true, L: true, XL: true },
            soldOut: false
          },
          // Hoodies
          {
            id: 3,
            src: 'images/Merch_Hoodie-Back.webp',
            alt: 'Hoodie Back',
            caption: 'Hoodie',
            price: '50$ CAD',
            category: 'hoodie',
            active: true,
            sizes: { S: false, M: false, L: true, XL: false },
            soldOut: false
          },
          {
            id: 4,
            src: 'images/Merch_Hoodie F.webp',
            alt: 'Hoodie Front',
            caption: 'Hoodie',
            price: '50$ CAD',
            category: 'hoodie',
            active: true,
            sizes: { S: false, M: false, L: true, XL: false },
            soldOut: false
          },
          // Hip Bags
          {
            id: 5,
            src: 'images/Merch_Bag-Brown.webp',
            alt: 'Bag Brown',
            caption: 'Hip Bag Brown',
            price: '80$ CAD',
            category: 'bag',
            active: true,
            soldOut: true
          },
          {
            id: 6,
            src: 'images/Merch_Bag-Orange.webp',
            alt: 'Bag Orange',
            caption: 'Hip Bag Orange',
            price: '80$ CAD',
            category: 'bag',
            active: true,
            soldOut: false
          },
          {
            id: 7,
            src: 'images/Merch_Bag-Pink.webp',
            alt: 'Bag Pink',
            caption: 'Hip Bag Pink',
            price: '80$ CAD',
            category: 'bag',
            active: true,
            soldOut: false
          },
          {
            id: 8,
            src: 'images/Merch_Bag-red.webp',
            alt: 'Bag Red',
            caption: 'Hip Bag Red',
            price: '80$ CAD',
            category: 'bag',
            active: true,
            soldOut: true
          },
          {
            id: 9,
            src: 'images/Merch_Bag-Purple.webp',
            alt: 'Bag Purple',
            caption: 'Hip Bag Purple',
            price: '80$ CAD',
            category: 'bag',
            active: true,
            soldOut: false
          }
        ];
        console.log('🔍 Utilisation des données de test:', testData);
        setMerchItems(testData);
      } finally {
        setLoading(false);
      }
    };
    
    loadMerchData();
  }, []);

  // Obtenir un représentant par catégorie
  const getDisplayItems = () => {
    const categories = ['tshirt', 'sweatshirt', 'hoodie', 'bag'];
    return categories.map(category => {
      const categoryItems = merchItems.filter(item => item.category === category);
      if (categoryItems.length === 0) return null;
      
      // Pour T-shirt, prendre spécifiquement le T-shirt normal (pas Sylvain) et Front
      if (category === 'tshirt') {
        const normalTshirt = categoryItems.find(item => 
          !item.alt.toLowerCase().includes('sylvain') && 
          item.alt.toLowerCase().includes('front')
        );
        if (normalTshirt) return normalTshirt;
      }
      
      // Pour Sweatshirt, prendre spécifiquement l'id 2 (Sweatshirt Front)
      if (category === 'sweatshirt') {
        const sweatshirtFront = categoryItems.find(item => item.id === 2);
        if (sweatshirtFront) return sweatshirtFront;
      }
      
      // Pour Hoodie, prendre spécifiquement l'id 4 (Hoodie Front)
      if (category === 'hoodie') {
        const hoodieFront = categoryItems.find(item => item.id === 4);
        if (hoodieFront) return hoodieFront;
      }
      
      // Pour les autres catégories, prendre le premier item
      return categoryItems[0];
    }).filter(Boolean);
  };

  // Ouvrir la lightbox
  const openLightbox = (index: number) => {
    const displayItems = getDisplayItems();
    const clickedItem = displayItems[index];
    
    // Obtenir toutes les images de la même catégorie
    const categoryItems = merchItems.filter(item => item.category === clickedItem.category);
    
    // Trouver l'index de l'item cliqué dans sa catégorie
    const itemIndex = categoryItems.findIndex(item => item.id === clickedItem.id);
    
    setCurrentGroupImages(categoryItems);
    setCurrentImageIndex(itemIndex >= 0 ? itemIndex : 0);
    setLightboxOpen(true);
    document.body.style.overflow = 'hidden';
  };

  // Fermer la lightbox
  const closeLightbox = () => {
    setLightboxOpen(false);
    document.body.style.overflow = 'auto';
  };

  // Navigation dans la lightbox
  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % currentGroupImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + currentGroupImages.length) % currentGroupImages.length);
  };

  // Gestion des touches clavier
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;
      
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    };

    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [lightboxOpen]);

  // Nettoyer le style du body au démontage
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const displayItems = getDisplayItems();

  return (
    <>
      <p className="message-subtitle">
        For all merch requests, please email{' '}
        <a href="#contact" 
           style={{ color: '#ffdd00', textDecoration: 'none', cursor: 'pointer' }}
           onClick={(e) => {
          e.preventDefault();
          if (onSectionChange) {
            onSectionChange('message');
          }
        }}>here</a>{' '}
        specifying the item and postal address. Payment instructions will be provided upon request.
      </p>

      <div className="merch-gallery">
        {loading ? (
          <div className="loading-state">
            <p>Chargement...</p>
          </div>
        ) : displayItems.length === 0 ? (
          <div className="empty-state">
            <p>Aucun article trouvé</p>
          </div>
        ) : (
          displayItems.map((item, index) => (
            <div key={item.id} className="message-card merch-item" onClick={() => openLightbox(index)}>
              <div className="merch-image-container">
                <img 
                  src={item.src}
                  alt={item.alt}
                  className="merch-image"
                  loading="lazy"
                />
                <div className="merch-overlay">
                  <i className="fas fa-search-plus"></i>
                </div>
              </div>
              
              <div className="merch-caption">
                {item.caption}
              </div>
              
              {/* Sélecteur de tailles */}
              {item.sizes && (
                <div className="size-selector">
                  {Object.entries(item.sizes).map(([size, available]) => (
                    <div 
                      key={size}
                      className={`size-option ${available ? 'available' : 'out-of-stock'}`}
                    >
                      <span className="size-label">{size}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && currentGroupImages.length > 0 && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <div className="lightbox-container" onClick={(e) => e.stopPropagation()}>
            {/* Bouton fermer */}
            <button className="lightbox-close" onClick={closeLightbox}>
              ✕
            </button>

            {/* Flèche précédente */}
            {currentGroupImages.length > 1 && (
              <button className="lightbox-nav prev" onClick={prevImage}>
                ‹
              </button>
            )}

            {/* Flèche suivante */}
            {currentGroupImages.length > 1 && (
              <button className="lightbox-nav next" onClick={nextImage}>
                ›
              </button>
            )}
            
            {/* Image principale */}
            <div className="lightbox-content">
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img 
                  src={currentGroupImages[currentImageIndex].src}
                  alt={currentGroupImages[currentImageIndex].alt}
                  className="lightbox-image"
                />
                
                {/* Message Out Of Stock par-dessus l'image */}
                {currentGroupImages[currentImageIndex].soldOut && (
                  <div style={{
                    position: 'absolute',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(255, 0, 0, 0.9)',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    fontSize: '18px',
                    textAlign: 'center',
                    zIndex: 10
                  }}>
                    Out Of Stock
                  </div>
                )}
              </div>
              
              {/* Caption et prix */}
              <div className="lightbox-info">
                <h3>{currentGroupImages[currentImageIndex].caption}</h3>
                <p>{currentGroupImages[currentImageIndex].price}</p>
                
                {/* Tailles dans lightbox */}
                {currentGroupImages[currentImageIndex].sizes && (
                  <div className="lightbox-sizes">
                    {Object.entries(currentGroupImages[currentImageIndex].sizes).map(([size, available]) => (
                      <div 
                        key={size}
                        className={`lightbox-size-option ${available ? 'available' : 'out-of-stock'}`}
                      >
                        <span className="size-label">{size}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Store;