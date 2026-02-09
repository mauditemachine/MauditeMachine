import React, { useState, useRef } from 'react';

interface ImageUploadProps {
  value: string;
  onChange: (imagePath: string) => void;
  placeholder?: string;
  useButton?: boolean;
  folder?: string; // Dossier de destination (images, events, etc.)
}

const ImageUpload: React.FC<ImageUploadProps> = ({ value, onChange, placeholder = "", useButton = false, folder = "images" }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Détecter si on est en production
  const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

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
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      if (isLocalhost) {
        // En localhost, uploader via l'API serveur
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await fetch(`http://localhost:3001/api/upload-image?folder=${folder}`, {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) throw new Error('Upload failed');
        
        const result = await response.json();
        onChange(result.imagePath);
      } else {
        // En production, compresser et convertir en base64
        const compressed = await compressImage(file, 400, 0.6);
        onChange(`data:image/jpeg;base64,${compressed}`);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(`Upload error: ${error.message || 'Unknown error'}`);
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
        
        {/* Bouton upload - toujours visible */}
        <div className="admin-upload-button-container">
          <button
            type="button"
            onClick={handleButtonClick}
            disabled={isUploading}
            className="admin-btn-secondary"
          >
            {isUploading ? 'Uploading...' : 'Browse'}
          </button>
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
          value={value && !value.startsWith('data:') ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="admin-input"
        />
      </div>
    </div>
  );
};

export default ImageUpload;
