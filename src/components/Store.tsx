import React, { useState, useEffect } from 'react';

interface MerchImage {
  src: string;
  alt: string;
  caption?: string;
}

interface StoreProps {
  onSectionChange?: (section: string) => void;
}

const Store: React.FC<StoreProps> = ({ onSectionChange }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Liste des images de merchandising - CHEMINS RELATIFS POUR PRODUCTION
  const merchImages: MerchImage[] = [
    { src: 'images/Merch_CrewNeck-Back.webp', alt: 'CrewNeck Back', caption: 'CrewNeck - Back' },
    { src: 'images/Merch_CrewNeck-Front.webp', alt: 'CrewNeck Front', caption: 'CrewNeck - Front' },
    { src: 'images/Merch_Hoodie-Back.webp', alt: 'Hoodie Back', caption: 'Hoodie - Back' },
    { src: 'images/Merch_Hoodie F.webp', alt: 'Hoodie Front', caption: 'Hoodie - Front' },
    { src: 'images/Merch_Bag-Brown.webp', alt: 'Bag Brown', caption: 'Bag - Brown' },
    { src: 'images/Merch_Bag-Orange.webp', alt: 'Bag Orange', caption: 'Bag - Orange' },
    { src: 'images/Merch_Bag-Pink.webp', alt: 'Bag Pink', caption: 'Bag - Pink' },
    { src: 'images/Merch_Bag-red.webp', alt: 'Bag Red', caption: 'Bag - Red' },
    { src: 'images/Merch_Bag-Purple.webp', alt: 'Bag Purple', caption: 'Bag - Purple' },
    { src: 'images/Merch_Sylvain-Tshirt-Back.webp', alt: 'Sylvain Tshirt Back', caption: 'Sylvain T-shirt - Back' },
    { src: 'images/Merch_Sylvain-Tshirt-Front.webp', alt: 'Sylvain Tshirt Front', caption: 'Sylvain T-shirt - Front' },
    { src: 'images/Merch_Tshirt-Back.webp', alt: 'Tshirt Back', caption: 'T-shirt - Back' },
    { src: 'images/Merch_Tshirt-Front.webp', alt: 'Tshirt Front', caption: 'T-shirt - Front' }
  ];

  // Ouvrir la lightbox
  const openLightbox = (index: number) => {
    setCurrentImageIndex(index);
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
    setCurrentImageIndex((prev) => (prev + 1) % merchImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + merchImages.length) % merchImages.length);
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
    return () => window.removeEventListener('keydown', handleKeyPress);
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
        For all merch requests, please email us{' '}
        <a href="#contact" 
           style={{ color: '#ffdd00', textDecoration: 'none', cursor: 'pointer' }}
           onClick={(e) => {
          e.preventDefault();
          if (onSectionChange) {
            onSectionChange('message'); // 'message' est la clé pour Contact
          }
        }}>here</a>{' '}
        specifying the item you want and your postal address. We'll send you payment instructions.
      </p>

      {/* GALERIE DE MERCHANDISING - FORCÉE À S'AFFICHER */}
      <div className="merch-gallery" style={{ display: 'grid !important' }}>
        {merchImages.map((image, index) => (
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
        ))}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <div className="lightbox-container" onClick={(e) => e.stopPropagation()}>
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
                src={merchImages[currentImageIndex].src}
                alt={merchImages[currentImageIndex].alt}
                className="lightbox-image"
              />
              {merchImages[currentImageIndex].caption && (
                <div className="lightbox-caption">
                  {merchImages[currentImageIndex].caption}
                </div>
              )}
              {/* Prix */}
              <div className="lightbox-price">
                {merchImages[currentImageIndex].caption?.toLowerCase().includes('crewneck') && '50$ CAD'}
                {merchImages[currentImageIndex].caption?.toLowerCase().includes('hoodie') && '50$ CAD'}
                {merchImages[currentImageIndex].caption?.toLowerCase().includes('bag') && '80$ CAD'}
                {merchImages[currentImageIndex].caption?.toLowerCase().includes('t-shirt') && '40$ CAD'}
              </div>
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