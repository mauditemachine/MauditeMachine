from PIL import Image, ImageEnhance
import os
import glob

def compress_image(input_path, output_path, max_size=(1200, 1200), quality=85):
    # Ouvrir l'image
    with Image.open(input_path) as img:
        # Convertir en RGB si nécessaire
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        # Calculer les nouvelles dimensions en gardant le ratio
        ratio = min(max_size[0]/img.size[0], max_size[1]/img.size[1])
        new_size = (int(img.size[0]*ratio), int(img.size[1]*ratio))
        
        # Redimensionner l'image
        img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        # Sauvegarder avec compression
        img.save(output_path, 'JPEG', quality=quality, optimize=True)

def process_directory(input_dir, output_dir):
    # Créer le dossier de sortie s'il n'existe pas
    os.makedirs(output_dir, exist_ok=True)
    
    # Traiter toutes les images dans le dossier
    for img_path in glob.glob(os.path.join(input_dir, '*.jpg')):
        filename = os.path.basename(img_path)
        output_path = os.path.join(output_dir, filename)
        print(f"Compression de {filename}...")
        compress_image(img_path, output_path)

def compress_and_adjust_background():
    # Chemin de l'image
    input_path = "files/BackgroundCailloux.png"
    output_path = "files/background_optimized.png"
    
    # Ouvrir l'image
    img = Image.open(input_path)
    
    # Sauvegarder avec compression maximale
    img.save(output_path, "PNG", optimize=True, quality=85)
    
    # Afficher les tailles
    original_size = os.path.getsize(input_path)
    new_size = os.path.getsize(output_path)
    print(f"Taille originale: {original_size/1024:.2f} KB")
    print(f"Taille optimisée: {new_size/1024:.2f} KB")
    print(f"Réduction: {(1 - new_size/original_size)*100:.1f}%")

if __name__ == "__main__":
    input_dir = "medias"
    output_dir = "medias_compressed"
    process_directory(input_dir, output_dir)
    print("Compression terminée !")
    compress_and_adjust_background() 