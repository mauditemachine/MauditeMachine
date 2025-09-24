import React, { useState, useEffect } from 'react';
import { MerchItem, loadMerchItems } from '../utils/adminApi';

interface MerchImage {
  src: string;
  alt: string;
  caption?: string;
  price?: string;
  soldOut?: boolean;
  sizes?: {
    S: boolean;
    M: boolean;
    L: boolean;
    XL: boolean;
  };
}

interface StoreProps {
  onSectionChange?: (section: string) => void;
}

interface SizeSelectorProps {
  sizes?: {
    S: boolean;
    M: boolean;
    L: boolean;
    XL: boolean;
  };
  isMobile?: boolean;
}

const SizeSelector: React.FC<SizeSelectorProps> = ({ sizes, isMobile = false }) => {
  if (!sizes) return null;

  const sizeLabels = ['S', 'M', 'L', 'XL'];
  
  return (
    <div className={`size-selector ${isMobile ? 'mobile-only' : ''}`}>
      {sizeLabels.map(size => (
        <div 
          key={size} 
          className={`size-option ${!sizes[size as keyof typeof sizes] ? 'out-of-stock' : ''}`}
          style={{ pointerEvents: 'none', cursor: 'default' }}
        >
          {!sizes[size as keyof typeof sizes] && <span className="cross"></span>}
          <span className="size-label">{size}</span>
        </div>
      ))}
    </div>
  );
};

const Store: React.FC<StoreProps> = ({ onSectionChange }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [merchImages, setMerchImages] = useState<MerchImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentGroupImages, setCurrentGroupImages] = useState<MerchImage[]>([]);

  // Charger les données de merchandising au montage du composant
  useEffect(() => {
    const loadMerchData = async () => {
      try {
        setLoading(true);
        console.log('🛍️ Chargement des données de merchandising...');
        
        // Charger directement depuis le fichier JSON public
        const response = await fetch('/store.json');
        if (!response.ok) {
          throw new Error('Erreur lors du chargement du merchandising');
        }
        const merchData = await response.json();
        
        console.log('✅ Données chargées:', merchData.length, 'articles');
        console.log('📏 Première taille:', merchData[0]?.sizes);
        
        // Convertir les données MerchItem en MerchImage pour la compatibilité
        const convertedData: MerchImage[] = merchData
          .filter(item => item.active) // Ne prendre que les articles actifs
          .map(item => ({
            src: item.src,
            alt: item.alt,
            caption: item.caption,
            price: item.price,
            soldOut: item.soldOut,
            sizes: item.sizes || {
              S: true,
              M: true,
              L: true,
              XL: true
            }
          }));
        
        console.log('🎯 Articles convertis:', convertedData.length);
        console.log('📏 Tailles du premier article:', convertedData[0]?.sizes);
        
        setMerchImages(convertedData);
      } catch (error) {
        console.error('Erreur lors du chargement du merchandising:', error);
        // En cas d'erreur, utiliser les données par défaut avec tailles
        const defaultSizes = { S: true, M: true, L: true, XL: true };
        setMerchImages([
          { src: 'images/Merch_CrewNeck-Back.webp', alt: 'Sweatshirt', caption: 'Sweatshirt', price: '50$ CAD', sizes: defaultSizes },
          { src: 'images/Merch_CrewNeck-Front.webp', alt: 'Sweatshirt', caption: 'Sweatshirt', price: '50$ CAD', sizes: defaultSizes },
          { src: 'images/Merch_Hoodie-Back.webp', alt: 'Hoodie', caption: 'Hoodie', price: '50$ CAD', sizes: defaultSizes },
          { src: 'images/Merch_Hoodie F.webp', alt: 'Hoodie', caption: 'Hoodie', price: '50$ CAD', sizes: defaultSizes },
          { src: 'images/Merch_Bag-Brown.webp', alt: 'Bag Brown', caption: 'Hip Bag Brown', price: '80$ CAD' },
          { src: 'images/Merch_Bag-Orange.webp', alt: 'Bag Orange', caption: 'Hip-Bag Orange', price: '80$ CAD' },
          { src: 'images/Merch_Bag-Pink.webp', alt: 'Bag Pink', caption: 'Hip-Bag Pink', price: '80$ CAD' },
          { src: 'images/Merch_Bag-red.webp', alt: 'Bag Red', caption: 'Hip-Bag Red', price: '80$ CAD' },
          { src: 'images/Merch_Bag-Purple.webp', alt: 'Bag Purple', caption: 'Hip-Bag Purple', price: '80$ CAD' },
          { src: 'images/Merch_Sylvain-Tshirt-Back.webp', alt: 'Sylvain Tshirt', caption: 'Sylvain T-shirt', price: '40$ CAD', sizes: defaultSizes },
          { src: 'images/Merch_Sylvain-Tshirt-Front.webp', alt: 'Sylvain Tshirt', caption: 'Sylvain T-shirt', price: '40$ CAD', sizes: defaultSizes },
          { src: 'images/Merch_Tshirt-Back.webp', alt: 'Tshirt', caption: 'T-shirt', price: '40$ CAD', sizes: defaultSizes },
          { src: 'images/Merch_Tshirt-Front.webp', alt: 'Tshirt', caption: 'T-shirt', price: '40$ CAD', sizes: defaultSizes }
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadMerchData();

    // Écouter les changements dans localStorage pour recharger les données
    const handleStorageChange = () => {
      loadMerchData();
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Écouter les changements dans la même fenêtre (pour les modifications dans l'admin)
    const handleCustomStorageChange = (e: CustomEvent) => {
      if (e.detail.key === 'merchItems') {
        loadMerchData();
      }
    };

    window.addEventListener('merchItemsUpdated', handleCustomStorageChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('merchItemsUpdated', handleCustomStorageChange as EventListener);
    };
  }, []);

  // Fonction pour regrouper les articles par catégorie et masquer les vues "Back"
  const groupMerchItems = (items: MerchImage[]) => {
    const grouped: { [key: string]: MerchImage[] } = {};
    
    items.forEach(item => {
      // Extraire le nom de base (sans -Back, -Front, etc.)
      let baseName = item.alt;
      let category = 'other';
      
      // Identifier la catégorie
      if (baseName.toLowerCase().includes('crewneck') || baseName.toLowerCase().includes('sweatshirt')) {
        category = 'sweatshirt';
        baseName = 'Sweatshirt';
      } else if (baseName.toLowerCase().includes('hoodie')) {
        category = 'hoodie';
        baseName = 'Hoodie';
      } else if (baseName.toLowerCase().includes('tshirt') || baseName.toLowerCase().includes('t-shirt')) {
        category = 'tshirt';
        baseName = baseName.includes('Sylvain') ? 'Sylvain T-shirt' : 'T-shirt';
      } else if (baseName.toLowerCase().includes('bag')) {
        category = 'bag';
        baseName = 'Hip Bags';
      }
      
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });
    
    // Trier les T-shirts : T-shirt, T-shirt, Sylvain T-shirt, Sylvain T-shirt
    if (grouped['tshirt']) {
      grouped['tshirt'].sort((a, b) => {
        const aIsSylvain = a.alt.toLowerCase().includes('sylvain');
        const bIsSylvain = b.alt.toLowerCase().includes('sylvain');
        const aIsBack = a.alt.toLowerCase().includes('back');
        const bIsBack = b.alt.toLowerCase().includes('back');
        
        // Ordre : T-shirt, T-shirt, Sylvain, Sylvain
        if (!aIsSylvain && !bIsSylvain) {
          return aIsBack ? 1 : -1; // T-shirt avant T-shirt
        } else if (aIsSylvain && bIsSylvain) {
          return aIsBack ? 1 : -1; // Sylvain avant Sylvain
        } else if (!aIsSylvain && bIsSylvain) {
          return -1; // T-shirt avant Sylvain
        } else {
          return 1; // Sylvain après T-shirt
        }
      });
    }
    
    return grouped;
  };

  // Fonction pour obtenir exactement 4 rectangles (1 par catégorie)
  const getDisplayImages = (items: MerchImage[]) => {
    const grouped = groupMerchItems(items);
    const displayImages: MerchImage[] = [];
    
    // Ordre spécifique : T-shirt, Sweatshirt, Hoodie, Hip Bag
    const categoryOrder = ['tshirt', 'sweatshirt', 'hoodie', 'bag'];
    
    categoryOrder.forEach(category => {
      if (grouped[category] && grouped[category].length > 0) {
        let representativeItem: MerchImage | undefined;
        
        if (category === 'tshirt') {
          // Pour T-shirt : prendre le T-shirt normal (pas Sylvain) et pas Back
          representativeItem = grouped[category].find(item => 
            !item.alt.toLowerCase().includes('back') && !item.alt.toLowerCase().includes('sylvain')
          );
        } else if (category === 'bag') {
          // Pour Hip Bag : prendre Purple en premier
          representativeItem = grouped[category].find(item => 
            item.alt.toLowerCase().includes('purple')
          );
        } else {
          // Pour Sweatshirt et Hoodie : prendre la vue Front
          representativeItem = grouped[category].find(item => 
            !item.alt.toLowerCase().includes('back')
          );
        }
        
        // Si pas trouvé, prendre le premier de la catégorie
        if (!representativeItem && grouped[category].length > 0) {
          representativeItem = grouped[category][0];
        }
        
        if (representativeItem) {
          // Calculer les tailles combinées pour cette catégorie
          const combinedSizes = { S: false, M: false, L: false, XL: false };
          
          if (category !== 'bag') {
            grouped[category].forEach(item => {
              if (item.sizes) {
                Object.keys(item.sizes).forEach(size => {
                  if (item.sizes![size as keyof typeof item.sizes]) {
                    combinedSizes[size as keyof typeof combinedSizes] = true;
                  }
                });
              }
            });
          }
          
          // Créer l'item représentatif avec les tailles combinées
          displayImages.push({
            ...representativeItem,
            caption: category === 'tshirt' ? 'T-shirt' :
                     category === 'sweatshirt' ? 'Sweatshirt' :
                     category === 'hoodie' ? 'Hoodie' :
                     'Hip Bag',
            sizes: category === 'bag' ? undefined : combinedSizes
          });
        }
      }
    });
    
    return displayImages;
  };

  // Fonction pour obtenir toutes les images d'un groupe (pour la lightbox)
  const getAllImagesForGroup = (items: MerchImage[], clickedItem: MerchImage) => {
    const grouped = groupMerchItems(items);
    
    // Identifier la catégorie de l'item cliqué
    let category = 'other';
    if (clickedItem.alt.toLowerCase().includes('crewneck') || clickedItem.alt.toLowerCase().includes('sweatshirt')) {
      category = 'sweatshirt';
    } else if (clickedItem.alt.toLowerCase().includes('hoodie')) {
      category = 'hoodie';
    } else if (clickedItem.alt.toLowerCase().includes('tshirt') || clickedItem.alt.toLowerCase().includes('t-shirt')) {
      category = 'tshirt';
    } else if (clickedItem.alt.toLowerCase().includes('bag')) {
      category = 'bag';
    }
    
    // Retourner toutes les images du groupe
    let groupImages = grouped[category] || [clickedItem];
    
    // Pour les T-shirts, réorganiser pour l'ordre : T-shirt, T-shirt, Sylvain, Sylvain
    if (category === 'tshirt') {
      const tshirtFront = groupImages.find(item => 
        !item.alt.toLowerCase().includes('back') && !item.alt.toLowerCase().includes('sylvain')
      );
      const tshirtBack = groupImages.find(item => 
        item.alt.toLowerCase().includes('back') && !item.alt.toLowerCase().includes('sylvain')
      );
      const sylvainFront = groupImages.find(item => 
        !item.alt.toLowerCase().includes('back') && item.alt.toLowerCase().includes('sylvain')
      );
      const sylvainBack = groupImages.find(item => 
        item.alt.toLowerCase().includes('back') && item.alt.toLowerCase().includes('sylvain')
      );
      
      groupImages = [];
      if (tshirtFront) groupImages.push(tshirtFront);
      if (tshirtBack) groupImages.push(tshirtBack);
      if (sylvainFront) groupImages.push(sylvainFront);
      if (sylvainBack) groupImages.push(sylvainBack);
    }
    
    // Pour les hip bags, réorganiser pour mettre Purple en premier
    if (category === 'bag') {
      const purpleBag = groupImages.find(item => 
        item.alt.toLowerCase().includes('purple')
      );
      const otherBags = groupImages.filter(item => 
        !item.alt.toLowerCase().includes('purple')
      );
      
      if (purpleBag) {
        groupImages = [purpleBag, ...otherBags];
      }
    }
    
    return groupImages;
  };

  // Ouvrir la lightbox
  const openLightbox = (index: number) => {
    const displayImages = getDisplayImages(merchImages);
    const clickedItem = displayImages[index];
    const allGroupImages = getAllImagesForGroup(merchImages, clickedItem);
    
    // Trouver l'index de l'item cliqué dans le groupe complet
    const groupIndex = allGroupImages.findIndex(item => item.src === clickedItem.src);
    
    setCurrentGroupImages(allGroupImages);
    setCurrentImageIndex(groupIndex);
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

  // Gestion des touches clavier et clics extérieurs
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;
      
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (!lightboxOpen) return;
      
      const target = e.target as HTMLElement;
      const lightboxContainer = document.querySelector('.lightbox-container');
      
      // Si le clic n'est pas dans le conteneur de la lightbox, fermer
      if (lightboxContainer && !lightboxContainer.contains(target)) {
        console.log('Clic extérieur détecté, fermeture lightbox');
        closeLightbox();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [lightboxOpen]);

  // Nettoyer le style du body au démontage
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <>
      {/* TEXTE D'INSTRUCTIONS POUR LES COMMANDES */}
      <p className="message-subtitle">
        For all merch requests, please email{' '}
        <a href="#contact" 
           style={{ color: '#ffdd00', textDecoration: 'none', cursor: 'pointer' }}
           onClick={(e) => {
          e.preventDefault();
          if (onSectionChange) {
            onSectionChange('message'); // 'message' est la clé pour Contact
          }
        }}>here</a>{' '}
        specifying the item and postal address. Payment instructions will be provided upon request.
      </p>

      {/* GALERIE DE MERCHANDISING - FORCÉE À S'AFFICHER */}
      <div className="merch-gallery" style={{ display: 'grid !important' }}>
        {loading ? (
          <div className="loading-state" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>
            <p>Chargement du merchandising...</p>
          </div>
        ) : merchImages.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>
            <p>Aucun article disponible pour le moment.</p>
          </div>
        ) : (
          getDisplayImages(merchImages).map((image, index) => (
          <div key={index} className="message-card merch-item" onClick={() => openLightbox(index)}>
            <div className="merch-image-container">
              <img 
                src={image.src}
                alt={image.alt}
                className="merch-image"
                loading="lazy"
                onError={(e) => {
                  console.error('❌ ERREUR IMAGE:', image.src);
                  console.error('Event:', e);
                }}
                onLoad={() => {
                  console.log('✅ IMAGE CHARGÉE:', image.src);
                }}
              />
              <div className="merch-overlay">
                <i className="fas fa-search-plus"></i>
              </div>
            </div>
            
            {/* Nom de l'image */}
            {image.caption && (
              <div className="merch-caption">
                {image.alt.toLowerCase().includes('bag') ? 'Hip Bag' : image.caption}
              </div>
            )}
            
            {/* Tailles disponibles (pas pour les hip bags) */}
            {!image.alt.toLowerCase().includes('bag') && <SizeSelector sizes={image.sizes} />}
            
            {/* Message SOLD OUT */}
            {image.soldOut && (
              <div style={{
                position: 'absolute',
                bottom: '10px',
                left: '50%',
                transform: 'translateX(-50%)',
                  background: 'rgba(255, 0, 0, 0.9)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '4px',
                fontWeight: 'bold',
                fontSize: '14px',
                textAlign: 'center',
                zIndex: 10
              }}>
                SOLD OUT
              </div>
            )}
          </div>
        ))
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && currentGroupImages.length > 0 && (
        <div 
          className="lightbox-overlay" 
          onClick={(e) => {
            console.log('Clic sur overlay, fermeture lightbox');
            closeLightbox();
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'transparent',
            zIndex: 10000,
            cursor: 'pointer'
          }}
        >
          <div 
            className="lightbox-container" 
            onClick={(e) => {
              console.log('Clic sur container, arrêt propagation');
              e.stopPropagation();
            }}
            style={{
              cursor: 'default'
            }}
          >
            {/* Bouton fermer */}
            <button className="lightbox-close" onClick={closeLightbox}>
              <i className="fas fa-times"></i>
            </button>
            
            {/* Navigation précédente */}
            <button className="lightbox-nav lightbox-prev" onClick={prevImage}>
              <i className="fas fa-chevron-left"></i>
            </button>
            
            {/* Image principale */}
            <div className="lightbox-image-container">
              <img 
                src={currentGroupImages[currentImageIndex].src}
                alt={currentGroupImages[currentImageIndex].alt}
                className="lightbox-image"
              />
              
              {/* Caption de l'image */}
              {currentGroupImages[currentImageIndex].caption && (
                <div className="lightbox-caption">
                  {currentGroupImages[currentImageIndex].caption}
                </div>
              )}
              
              {/* Tailles disponibles dans lightbox (pas pour les hip bags) */}
              {!currentGroupImages[currentImageIndex].alt.toLowerCase().includes('bag') && (
                <SizeSelector 
                  sizes={currentGroupImages[currentImageIndex].sizes} 
                  isMobile={true}
                />
              )}
              
              {/* Prix */}
              {currentGroupImages[currentImageIndex].price && (
                <div className="lightbox-price">
                  {currentGroupImages[currentImageIndex].price}
                </div>
              )}
              {/* Message SOLD OUT */}
              {currentGroupImages[currentImageIndex].soldOut && (
                <div style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                 background: 'rgba(255, 0, 0, 0.9)',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  textAlign: 'center',
                  zIndex: 10
                }}>
                  SOLD OUT
                </div>
              )}
            </div>
            
            {/* Navigation suivante */}
            <button className="lightbox-nav lightbox-next" onClick={nextImage}>
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Store;