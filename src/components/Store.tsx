import React, { useState, useEffect } from 'react';
import { MerchItem, loadMerchItems } from '../utils/adminApi';

interface MerchImage {
  src: string;
  alt: string;
  caption?: string;
  price?: string;
}

interface StoreProps {
  onSectionChange?: (section: string) => void;
}

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
        const merchData = await loadMerchItems();
        
        // Convertir les données MerchItem en MerchImage pour la compatibilité
        const convertedData: MerchImage[] = merchData
          .filter(item => item.active) // Ne prendre que les articles actifs
          .map(item => ({
            src: item.src,
            alt: item.alt,
            caption: item.caption,
            price: item.price
          }));
        
        setMerchImages(convertedData);
      } catch (error) {
        console.error('Erreur lors du chargement du merchandising:', error);
        // En cas d'erreur, utiliser les données par défaut
        setMerchImages([
          { src: 'images/Merch_CrewNeck-Back.webp', alt: 'CrewNeck Back', caption: 'CrewNeck - Back', price: '50$ CAD' },
          { src: 'images/Merch_CrewNeck-Front.webp', alt: 'CrewNeck Front', caption: 'CrewNeck - Front', price: '50$ CAD' },
          { src: 'images/Merch_Hoodie-Back.webp', alt: 'Hoodie Back', caption: 'Hoodie - Back', price: '50$ CAD' },
          { src: 'images/Merch_Hoodie F.webp', alt: 'Hoodie Front', caption: 'Hoodie - Front', price: '50$ CAD' },
          { src: 'images/Merch_Bag-Brown.webp', alt: 'Bag Brown', caption: 'Bag - Brown', price: '80$ CAD' },
          { src: 'images/Merch_Bag-Orange.webp', alt: 'Bag Orange', caption: 'Bag - Orange', price: '80$ CAD' },
          { src: 'images/Merch_Bag-Pink.webp', alt: 'Bag Pink', caption: 'Bag - Pink', price: '80$ CAD' },
          { src: 'images/Merch_Bag-red.webp', alt: 'Bag Red', caption: 'Bag - Red', price: '80$ CAD' },
          { src: 'images/Merch_Bag-Purple.webp', alt: 'Bag Purple', caption: 'Bag - Purple', price: '80$ CAD' },
          { src: 'images/Merch_Sylvain-Tshirt-Back.webp', alt: 'Sylvain Tshirt Back', caption: 'Sylvain T-shirt - Back', price: '40$ CAD' },
          { src: 'images/Merch_Sylvain-Tshirt-Front.webp', alt: 'Sylvain Tshirt Front', caption: 'Sylvain T-shirt - Front', price: '40$ CAD' },
          { src: 'images/Merch_Tshirt-Back.webp', alt: 'Tshirt Back', caption: 'T-shirt - Back', price: '40$ CAD' },
          { src: 'images/Merch_Tshirt-Front.webp', alt: 'Tshirt Front', caption: 'T-shirt - Front', price: '40$ CAD' }
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadMerchData();
  }, []);

  // Fonction pour regrouper les articles par catégorie et masquer les vues "Back"
  const groupMerchItems = (items: MerchImage[]) => {
    const grouped: { [key: string]: MerchImage[] } = {};
    
    items.forEach(item => {
      // Extraire le nom de base (sans -Back, -Front, etc.)
      let baseName = item.alt;
      let category = 'other';
      
      // Identifier la catégorie
      if (baseName.toLowerCase().includes('crewneck')) {
        category = 'crewneck';
        baseName = 'CrewNeck';
      } else if (baseName.toLowerCase().includes('hoodie')) {
        category = 'hoodie';
        baseName = 'Hoodie';
      } else if (baseName.toLowerCase().includes('tshirt') || baseName.toLowerCase().includes('t-shirt')) {
        category = 'tshirt';
        baseName = baseName.includes('Sylvain') ? 'Sylvain T-shirt' : 'T-shirt';
      } else if (baseName.toLowerCase().includes('bag')) {
        category = 'bag';
        baseName = 'Hip Bag';
      }
      
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });
    
    // Trier les T-shirts : T-shirt Front, T-shirt Back, Sylvain T-shirt Front, Sylvain T-shirt Back
    if (grouped['tshirt']) {
      grouped['tshirt'].sort((a, b) => {
        const aIsSylvain = a.alt.toLowerCase().includes('sylvain');
        const bIsSylvain = b.alt.toLowerCase().includes('sylvain');
        const aIsBack = a.alt.toLowerCase().includes('back');
        const bIsBack = b.alt.toLowerCase().includes('back');
        
        // Ordre : T-shirt Front, T-shirt Back, Sylvain Front, Sylvain Back
        if (!aIsSylvain && !bIsSylvain) {
          return aIsBack ? 1 : -1; // T-shirt Front avant T-shirt Back
        } else if (aIsSylvain && bIsSylvain) {
          return aIsBack ? 1 : -1; // Sylvain Front avant Sylvain Back
        } else if (!aIsSylvain && bIsSylvain) {
          return -1; // T-shirt avant Sylvain
        } else {
          return 1; // Sylvain après T-shirt
        }
      });
    }
    
    return grouped;
  };

  // Fonction pour obtenir les images à afficher (masquer les vues Back pour les vêtements)
  const getDisplayImages = (items: MerchImage[]) => {
    const grouped = groupMerchItems(items);
    const displayImages: MerchImage[] = [];
    
    // Ordre spécifique : T-shirt, CrewNeck, Hoodie, puis Hip Bag Purple en premier
    const categoryOrder = ['tshirt', 'crewneck', 'hoodie'];
    
    // Pour les vêtements, ne montrer que les vues Front dans l'ordre spécifié
    categoryOrder.forEach(category => {
      if (grouped[category]) {
        if (category === 'tshirt') {
          // Pour les T-shirts, afficher seulement T-shirt Front (pas Sylvain)
          const tshirtFront = grouped[category].find(item => 
            !item.alt.toLowerCase().includes('back') && !item.alt.toLowerCase().includes('sylvain')
          );
          
          if (tshirtFront) displayImages.push(tshirtFront);
        } else {
          // Pour les autres vêtements, ne montrer que les vues Front
          const frontItems = grouped[category].filter(item => 
            !item.alt.toLowerCase().includes('back')
          );
          if (frontItems.length > 0) {
            displayImages.push(...frontItems);
          }
        }
      }
    });
    
    // Pour les hip bags, afficher seulement Purple en premier
    if (grouped['bag']) {
      const purpleBag = grouped['bag'].find(item => 
        item.alt.toLowerCase().includes('purple')
      );
      
      if (purpleBag) {
        displayImages.push(purpleBag);
      }
    }
    
    return displayImages;
  };

  // Fonction pour obtenir toutes les images d'un groupe (pour la lightbox)
  const getAllImagesForGroup = (items: MerchImage[], clickedItem: MerchImage) => {
    const grouped = groupMerchItems(items);
    
    // Identifier la catégorie de l'item cliqué
    let category = 'other';
    if (clickedItem.alt.toLowerCase().includes('crewneck')) {
      category = 'crewneck';
    } else if (clickedItem.alt.toLowerCase().includes('hoodie')) {
      category = 'hoodie';
    } else if (clickedItem.alt.toLowerCase().includes('tshirt') || clickedItem.alt.toLowerCase().includes('t-shirt')) {
      category = 'tshirt';
    } else if (clickedItem.alt.toLowerCase().includes('bag')) {
      category = 'bag';
    }
    
    // Retourner toutes les images du groupe
    let groupImages = grouped[category] || [clickedItem];
    
    // Pour les T-shirts, réorganiser pour l'ordre : T-shirt Front, T-shirt Back, Sylvain Front, Sylvain Back
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
              {currentGroupImages[currentImageIndex].caption && (
                <div className="lightbox-caption">
                  {currentGroupImages[currentImageIndex].caption}
                </div>
              )}
              {/* Prix */}
              {currentGroupImages[currentImageIndex].price && (
                <div className="lightbox-price">
                  {currentGroupImages[currentImageIndex].price}
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