import React, { useState, useRef } from 'react';

interface ImageUploadProps {
  value: string;
  onChange: (imagePath: string) => void;
  placeholder?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ value, onChange, placeholder = "ex: images/Simetra.webp" }) => {
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

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      alert('L\'image est trop volumineuse. Taille maximum: 2MB');
      return;
    }

    setIsUploading(true);

    try {
      console.log('Début de l\'upload:', { name: file.name, type: file.type, size: file.size });
      
      // Convertir l'image en base64
      const base64 = await convertToBase64(file);
      console.log('Base64 généré, longueur:', base64.length);
      
      // Créer un nom de fichier unique
      const timestamp = Date.now();
      const extension = file.name.split('.').pop() || 'webp';
      const fileName = `uploaded-${timestamp}.${extension}`;
      
      // Pour l'instant, on stocke en base64 dans localStorage
      // Dans un vrai projet, vous uploaderiez vers un serveur
      const imageData = {
        fileName,
        base64,
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      };
      
      // Sauvegarder dans localStorage avec gestion du quota
      const existingImages = JSON.parse(localStorage.getItem('admin_uploaded_images') || '[]');
      
      // Nettoyer les anciennes images pour économiser l'espace
      const recentImages = existingImages.slice(-2); // Garder seulement les 2 dernières
      
      recentImages.push(imageData);
      
      try {
        localStorage.setItem('admin_uploaded_images', JSON.stringify(recentImages));
        console.log('Image sauvegardée dans localStorage');
      } catch (storageError) {
        console.error('Erreur localStorage:', storageError);
        // Si localStorage est encore plein, garder seulement la dernière image
        if (storageError instanceof Error && storageError.message.includes('quota')) {
          console.log('localStorage plein, garde seulement la dernière image');
          localStorage.setItem('admin_uploaded_images', JSON.stringify([imageData]));
        } else {
          throw storageError;
        }
      }
      
      // Mettre à jour le chemin de l'image avec le type MIME correct
      const dataUrl = `data:${file.type};base64,${base64}`;
      console.log('Data URL créé:', dataUrl.substring(0, 50) + '...');
      onChange(dataUrl);
      
      console.log('Upload terminé avec succès');
      
    } catch (error) {
      console.error('Erreur détaillée lors de l\'upload:', error);
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
        <label className="admin-form-label">
          Image:
        </label>
        
        {/* Zone de drop et input manuel */}
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
              <small>Formats acceptés: JPG, PNG, WEBP (max 2MB)</small>
            </div>
          )}
        </div>

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
          className="admin-form-input"
          style={{ marginTop: '10px' }}
        />
        <small className="upload-help">
          Vous pouvez aussi saisir manuellement le chemin de l'image (ex: images/Simetra.webp)
        </small>
      </div>
    </div>
  );
};

export default ImageUpload;
