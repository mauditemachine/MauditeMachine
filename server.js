import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Augmenter la limite à 50MB

// Chemin vers les fichiers JSON
const PUBLIC_DIR = path.join(__dirname, 'public');

// Configuration de multer pour l'upload d'images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Déterminer le dossier de destination selon le paramètre 'folder' 
    const folder = req.query.folder || 'images';
    const destDir = path.join(PUBLIC_DIR, folder);
    // Créer le dossier s'il n'existe pas
    fs.mkdir(destDir, { recursive: true }).then(() => {
      cb(null, destDir);
    }).catch(() => {
      cb(null, path.join(PUBLIC_DIR, 'images'));
    });
  },
  filename: function (req, file, cb) {
    // Générer un nom de fichier unique avec timestamp
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    cb(null, `uploaded-${timestamp}${extension}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: function (req, file, cb) {
    // Accepter seulement les images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seulement les fichiers images sont acceptés'));
    }
  }
});

// Route pour sauvegarder les messages
app.post('/api/save-messages', async (req, res) => {
  try {
    const messages = req.body;
    const filePath = path.join(PUBLIC_DIR, 'messages.json');
    
    await fs.writeFile(filePath, JSON.stringify(messages, null, 2));
    
    console.log('✅ Messages sauvegardés dans messages.json');
    res.json({ success: true, message: 'Messages sauvegardés avec succès' });
  } catch (error) {
    console.error('❌ Erreur sauvegarde messages:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde' });
  }
});

// Route pour sauvegarder les événements
app.post('/api/save-events', async (req, res) => {
  try {
    const events = req.body;
    const filePath = path.join(PUBLIC_DIR, 'events.json');
    
    await fs.writeFile(filePath, JSON.stringify(events, null, 2));
    
    console.log('✅ Événements sauvegardés dans events.json');
    res.json({ success: true, message: 'Événements sauvegardés avec succès' });
  } catch (error) {
    console.error('❌ Erreur sauvegarde événements:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde' });
  }
});

// Route pour sauvegarder le merchandising
app.post('/api/save-merch', async (req, res) => {
  try {
    const merchItems = req.body;
    const filePath = path.join(PUBLIC_DIR, 'store.json');
    
    await fs.writeFile(filePath, JSON.stringify(merchItems, null, 2));
    
    console.log('✅ Merchandising sauvegardé dans store.json');
    res.json({ success: true, message: 'Merchandising sauvegardé avec succès' });
  } catch (error) {
    console.error('❌ Erreur sauvegarde merchandising:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde' });
  }
});

// Route pour sauvegarder la bio
app.post('/api/save-bio', async (req, res) => {
  try {
    const bio = req.body;
    const filePath = path.join(PUBLIC_DIR, 'bio.json');
    
    await fs.writeFile(filePath, JSON.stringify(bio, null, 2));
    
    console.log('✅ Bio sauvegardée dans bio.json');
    res.json({ success: true, message: 'Bio sauvegardée avec succès' });
  } catch (error) {
    console.error('❌ Erreur sauvegarde bio:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde' });
  }
});

// Route pour uploader des images
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier uploadé' });
    }
    
    // Retourner le chemin relatif de l'image
    const folder = req.query.folder || 'images';
    const imagePath = `${folder}/${req.file.filename}`;
    
    console.log('✅ Image uploadée:', imagePath);
    res.json({ 
      success: true, 
      imagePath: imagePath,
      message: 'Image uploadée avec succès' 
    });
  } catch (error) {
    console.error('❌ Erreur upload image:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'upload' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur API démarré sur http://localhost:${PORT}`);
  console.log('📁 Fichiers JSON mis à jour automatiquement dans public/');
  console.log('📸 Upload d\'images disponible sur /api/upload-image');
});
