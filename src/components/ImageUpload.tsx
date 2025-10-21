import React, { useState, useRef } from 'react';

interface ImageUploadProps {
  value: string;
  onChange: (imagePath: string) => void;
  placeholder?: string;
  useButton?: boolean; // Nouvelle prop pour choisir entre bouton et drop zone
}

const ImageUpload: React.FC<ImageUploadProps> = ({ value, onChange, placeholder = "", useButton = false }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    // Vérifier le type de fichier plus spécifiquement
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const isValidType = validTypes.includes(file.type) || file.name.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/);
    
    if (!isValidType) {
      alert('Veuillez sélectionner un fichier image valide (JPG, PNG, WEBP, GIF).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      alert('L\'image est trop volumineuse. Taille maximum: 5MB');
      return;
    }

    setIsUploading(true);

    try {
      console.log('🚀 Début de l\'upload:', { name: file.name, type: file.type, size: file.size });
      
      // Vérifier si on est en localhost (serveur disponible)
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      if (isLocalhost) {
        // En localhost, uploader via l'API
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await fetch('http://localhost:3001/api/upload-image', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          throw new Error('Erreur lors de l\'upload de l\'image');
        }
        
        const result = await response.json();
        console.log('✅ Image uploadée:', result.imagePath);
        
        // Retourner le chemin de l'image
        onChange(result.imagePath);
      } else {
        // En production, générer un nom de fichier et informer l'utilisateur
        const timestamp = Date.now();
        const extension = file.name.split('.').pop() || 'webp';
        const fileName = `uploaded-${timestamp}.${extension}`;
        const imagePath = `images/${fileName}`;
        
        console.log('📦 Mode production: Chemin généré:', imagePath);
        alert(`⚠️ Mode production: Vous devez manuellement uploader le fichier "${fileName}" dans le dossier public/images/`);
        
        onChange(imagePath);
      }
      
      console.log('✅ Upload terminé avec succès');
      
    } catch (error) {
      console.error('❌ Erreur détaillée lors de l\'upload:', error);
      alert(`Erreur lors de l'upload de l'image: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        try {
          // Calculer les nouvelles dimensions
          let { width, height } = img;
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Dessiner l'image redimensionnée
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Convertir en base64 avec compression
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          const base64 = compressedDataUrl.split(',')[1];
          
          console.log(`Image compressée: ${file.name} - ${base64.length} caractères`);
          resolve(base64);
        } catch (error) {
          console.error('Erreur lors de la compression:', error);
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Erreur lors du chargement de l\'image'));
      };
      
      // Charger l'image
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        reject(new Error('Erreur lors de la lecture du fichier'));
      };
      reader.readAsDataURL(file);
    });
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Vérifier la taille du fichier (limite à 2MB)
      if (file.size > 2 * 1024 * 1024) {
        reject(new Error('Fichier trop volumineux. Taille maximum: 2MB'));
        return;
      }
      
      // Utiliser la compression pour les images
      if (file.type.startsWith('image/')) {
        compressImage(file, 800, 0.7)
          .then(resolve)
          .catch(reject);
      } else {
        // Pour les autres fichiers, utiliser la méthode normale
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  return (
    <div className="admin-image-upload">
      <div className="admin-form-group">
        <label>
          Image:
        </label>
        
        {/* Zone de drop ou bouton selon useButton */}
        {useButton ? (
          <div className="admin-upload-button-container">
            <button
              type="button"
              onClick={handleButtonClick}
              disabled={isUploading}
              className="admin-btn secondary small"
              style={{ marginBottom: '10px' }}
            >
              {isUploading ? (
                <>
                  <div className="spinner" style={{ width: '12px', height: '12px', marginRight: '8px' }}></div>
                  Upload en cours...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: '12px', height: '12px', marginRight: '8px', fill: 'currentColor' }}>
                    <path d="M129.5 464L179.5 304L558.9 304L508.9 464L129.5 464zM320.2 512L509 512C530 512 548.6 498.4 554.8 478.3L604.8 318.3C614.5 287.4 591.4 256 559 256L179.6 256C158.6 256 140 269.6 133.8 289.7L112.2 358.4L112.2 160C112.2 151.2 119.4 144 128.2 144L266.9 144C270.4 144 273.7 145.1 276.5 147.2L314.9 176C328.7 186.4 345.6 192 362.9 192L480.2 192C489 192 496.2 199.2 496.2 208L544.2 208C544.2 172.7 515.5 144 480.2 144L362.9 144C356 144 349.2 141.8 343.7 137.6L305.3 108.8C294.2 100.5 280.8 96 266.9 96L128.2 96C92.9 96 64.2 124.7 64.2 160L64.2 448C64.2 483.3 92.9 512 128.2 512L320.2 512z"/>
                  </svg>
                  Parcourir
                </>
              )}
            </button>
          </div>
        ) : (
          <div
            className={`admin-upload-zone ${dragOver ? 'drag-over' : ''} ${isUploading ? 'uploading' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleButtonClick}
          >
            {isUploading ? (
              <div className="upload-loading">
                <div className="spinner"></div>
                <span>Upload en cours...</span>
              </div>
            ) : (
              <div className="upload-content">
                <i className="fa-solid fa-cloud-upload-alt"></i>
                <p>Glissez-déposez une image ici ou cliquez pour parcourir</p>
              </div>
            )}
          </div>
        )}

        {/* Input file caché */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />

        {/* Aperçu de l'image */}
        {value && (
          <div className="image-preview">
            <img 
              src={value.startsWith('data:') ? value : `/${value}`} 
              alt="Aperçu" 
              onError={(e) => {
                // Si l'image ne charge pas, essayer avec le chemin complet
                const target = e.target as HTMLImageElement;
                if (!value.startsWith('data:') && !value.startsWith('/')) {
                  target.src = `/${value}`;
                }
              }}
            />
            <button
              type="button"
              onClick={() => onChange('')}
              className="remove-image-btn"
              title="Supprimer l'image"
            >
              <i className="fa-solid fa-times"></i>
            </button>
          </div>
        )}

        {/* Input pour le chemin manuel */}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ marginTop: '10px' }}
        />
      </div>
    </div>
  );
};

export default ImageUpload;
