// Animation du texte de description
const description = document.querySelector(".description");
const text = description.textContent;
description.textContent = "";

// Créer les spans pour chaque lettre
for (let i = 0; i < text.length; i++) {
  const span = document.createElement("span");
  span.textContent = text[i];
  span.style.transition = "opacity 0.5s ease";
  description.appendChild(span);
}

const letters = description.querySelectorAll("span");

function animateRandomLetter() {
  const randomIndex = Math.floor(Math.random() * letters.length);
  const letter = letters[randomIndex];

  // Faire disparaître la lettre
  letter.style.opacity = "0";

  // Faire réapparaître la lettre après un délai aléatoire (entre 1 et 3 secondes)
  setTimeout(() => {
    letter.style.opacity = "1";
  }, Math.random() * 2000 + 1000);
}

// Démarrer plusieurs animations en parallèle
function startAnimations() {
  // Lancer une nouvelle animation toutes les 200-500ms
  setInterval(() => {
    if (Math.random() < 0.3) {
      // 30% de chance de lancer une animation
      animateRandomLetter();
    }
  }, Math.random() * 300 + 200);
}

startAnimations();

// SUPPRESSION du code de scroll horizontal

// Fonction pour formater la date en français
function formatDate(dateString) {
  const date = new Date(dateString);
  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  };
  return date.toLocaleDateString("en-US", options);
}

// Fonction pour fermer tous les accordéons sauf celui spécifié
function closeOtherAccordions(exceptAccordion) {
  document.querySelectorAll(".year-content.active").forEach((accordion) => {
    if (accordion !== exceptAccordion) {
      accordion.classList.remove("active");
      accordion.previousElementSibling.querySelector(".arrow").style.transform = "rotate(0deg)";
    }
  });
}

// Fonction pour charger les événements
async function loadEvents() {
  try {
    console.log("Début du chargement des événements");
    const response = await fetch("events.json");
    console.log("Statut de la réponse:", response.status);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    console.log("Fichier JSON récupéré");
    const data = await response.json();
    console.log("Données JSON parsées:", data);

    const eventsContainer = document.querySelector(".events-container");
    console.log("Container des événements trouvé:", eventsContainer);
    if (!eventsContainer) {
      throw new Error("Container des événements non trouvé");
    }

    // Vider le container avant d'ajouter les nouveaux événements
    eventsContainer.innerHTML = "";
    console.log("Container vidé");

    // Trier les années par ordre décroissant
    data.events.sort((a, b) => b.year - a.year);
    console.log("Événements triés par année");

    data.events.forEach((yearData) => {
      console.log(`Traitement de l'année ${yearData.year}`);
      // Trier les événements de l'année par date décroissante
      yearData.shows.sort((a, b) => new Date(b.date) - new Date(a.date));
      const yearAccordion = createAccordionYear(yearData.year, yearData.shows);
      eventsContainer.appendChild(yearAccordion);
    });

    console.log("Tous les accordéons ont été ajoutés");

    // Ouvrir le premier accordéon par défaut
    const firstAccordion = eventsContainer.querySelector(".year-content");
    if (firstAccordion) {
      firstAccordion.classList.add("active");
      firstAccordion.previousElementSibling.querySelector(".arrow").style.transform = "rotate(180deg)";
      console.log("Premier accordéon ouvert");
    }
  } catch (error) {
    console.error("Erreur lors du chargement des événements:", error);
  }
}

function createAccordionYear(year, events) {
  const yearAccordion = document.createElement("div");
  yearAccordion.className = "year-accordion";
  yearAccordion.innerHTML = `
    <div class="year-header">
      <h3>${year}</h3>
      <span class="arrow">▼</span>
    </div>
    <div class="year-content">
      ${events
        .map(
          (event) => `
        <div class="event-item ${event.facebook_event ? "has-link" : ""}" ${
            event.facebook_event ? `onclick="window.open('${event.facebook_event}', '_blank')"` : ""
          }>
          <div class="event-header">
            <h4>${event.name}</h4>
            <span class="event-date">${formatDate(event.date)}</span>
          </div>
          <div class="event-details">
            <p class="event-venue">${event.venue}, ${event.city}</p>
            ${event.lineup ? `<p class="event-lineup">Lineup: ${event.lineup.join(", ")}</p>` : ""}
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;

  const header = yearAccordion.querySelector(".year-header");
  const content = yearAccordion.querySelector(".year-content");
  const arrow = yearAccordion.querySelector(".arrow");

  header.addEventListener("click", () => {
    // Fermer tous les autres accordéons
    document.querySelectorAll(".year-accordion").forEach((otherAccordion) => {
      if (otherAccordion !== yearAccordion) {
        const otherContent = otherAccordion.querySelector(".year-content");
        const otherArrow = otherAccordion.querySelector(".arrow");
        otherContent.classList.remove("active");
        otherContent.style.maxHeight = "0";
        otherArrow.style.transform = "rotate(0deg)";
      }
    });

    // Basculer l'état de l'accordéon actuel
    const isActive = content.classList.contains("active");
    content.classList.toggle("active");
    content.style.maxHeight = isActive ? "0" : content.scrollHeight + "px";
    arrow.style.transform = isActive ? "rotate(0deg)" : "rotate(180deg)";
  });

  return yearAccordion;
}

// Appeler la fonction au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM chargé, chargement des événements...");
  loadEvents();
});

// Galerie et Lightbox
const galleryGrid = document.querySelector(".gallery-grid");
const lightbox = document.querySelector(".lightbox");
const lightboxImg = document.querySelector(".lightbox-content img");
const closeBtn = document.querySelector(".close");
const prevBtn = document.querySelector(".prev");
const nextBtn = document.querySelector(".next");

let currentImageIndex = 0;
let images = [];

// Charger les images de la galerie
function loadGallery() {
  // Images du dossier medias
  images = [
    { src: "medias/BackOnTrack.jpg", alt: "Back On Track" },
    { src: "medias/YUL_0330.jpg", alt: "YUL" },
    { src: "medias/YUL_0324-2.jpg", alt: "YUL" },
    { src: "medias/Photo (7272)uu.jpg", alt: "Performance" },
    { src: "medias/Locomote 12.jpg", alt: "Locomote" },
    { src: "medias/JoGorsky_2025-02_Pinup-Valentines_091.jpg", alt: "Pinup Valentines" },
    { src: "medias/JoGorsky_2024-10_Monstrocity-Halloween_077.jpg", alt: "Monstrocity Halloween" },
    { src: "medias/JoGorsky_2024-10_Monstrocity-Halloween_074.jpg", alt: "Monstrocity Halloween" },
    { src: "medias/DSCF9997_edit1.jpg", alt: "Performance" },
    { src: "medias/DSCF9991_edit1.jpg", alt: "Performance" },
    { src: "medias/DSCF0006_edit1.jpg", alt: "Performance" },
    { src: "medias/7AF2D730-3F53-4942-984E-FABAC8C9B85E.jpg", alt: "Performance" },
    { src: "medias/603061_10151506175820841_595710399_n.jpg", alt: "Performance" },
    { src: "medias/53690C8F-98DC-4FAF-843F-51397D20FF2D.jpg", alt: "Performance" },
    { src: "medias/459356611_577106314641628_7948540754089562955_n.jpg", alt: "Performance" },
    { src: "medias/459186464_1042053933814072_887394904461510536_n.jpg", alt: "Performance" },
    { src: "medias/459004621_1555689078386610_7094668039658845235_n.jpg", alt: "Performance" },
    { src: "medias/367800056_672152048156122_793282389538458180_n.jpg", alt: "Performance" },
    { src: "medias/363393321_317589543949568_2775297006998526690_n.jpg", alt: "Performance" },
    { src: "medias/317673616_1133154394065517_5577655773881691687_n.jpg", alt: "Performance" },
    { src: "medias/30DC4B78-4917-44C0-BB30-B1283BA5924B.jpg", alt: "Performance" },
    { src: "medias/305839661_1563103054147144_2047561859068751024_n.jpg", alt: "Performance" },
    { src: "medias/242FAB21-F40A-47D7-990A-C6D381272F08.jpg", alt: "Performance" },
    { src: "medias/22279542_10154949783416961_1236740403543318439_n.jpg", alt: "Performance" },
    { src: "medias/20250301_013718.jpg", alt: "Performance" },
    { src: "medias/2022-03-28(498).jpg", alt: "Performance" },
    { src: "medias/2022-03-28(496).jpg", alt: "Performance" },
    { src: "medias/2022-03-28(417).jpg", alt: "Performance" },
    { src: "medias/2022-03-28(350).jpg", alt: "Performance" },
    { src: "medias/2022-03-28(349).jpg", alt: "Performance" },
    { src: "medias/2022-03-28(322).jpg", alt: "Performance" },
    { src: "medias/2022-03-28(3114).jpg", alt: "Performance" },
    { src: "medias/2022-03-28(220).jpg", alt: "Performance" },
    { src: "medias/2022-03-28(214).jpg", alt: "Performance" },
    { src: "medias/20171117_211200186_iOS.jpg", alt: "Performance" },
    { src: "medias/20170905_155016666_iOS.jpg", alt: "Performance" },
    { src: "medias/1235522_10151710663451785_138335720_n.jpg", alt: "Performance" },
    { src: "medias/_DSC2160.jpg", alt: "Performance" },
    { src: "medias/_DSC2148.jpg", alt: "Performance" },
    { src: "medias/_DSC1941-Enhanced-NR.jpg", alt: "Performance" },
    { src: "medias/_DSC1881.jpg", alt: "Performance" },
    { src: "medias/_DSC1808.jpg", alt: "Performance" },
    { src: "medias/_DSC1748.jpg", alt: "Performance" },
    { src: "medias/_DSC1700.jpg", alt: "Performance" },
  ];

  console.log("Nombre d'images à charger:", images.length);

  images.forEach((image, index) => {
    const item = document.createElement("div");
    item.className = "gallery-item";
    const img = document.createElement("img");
    const fileName = image.src.split("/").pop();
    const encodedFileName = encodeURIComponent(fileName);
    const fullPath = image.src.replace(fileName, encodedFileName);
    console.log("Chargement de l'image:", fullPath);
    img.src = fullPath;
    img.alt = image.alt;

    // Ajouter un gestionnaire d'erreur pour chaque image
    img.onerror = function () {
      console.error("Erreur de chargement de l'image:", fullPath);
      // Essayer de charger l'image sans encodage
      img.src = image.src;
      console.log("Tentative de chargement sans encodage:", image.src);
    };

    item.appendChild(img);
    item.addEventListener("click", () => openLightbox(index));
    galleryGrid.appendChild(item);
  });
}

function openLightbox(index) {
  currentImageIndex = index;
  lightboxImg.src = images[index].src;
  lightboxImg.alt = images[index].alt;
  lightbox.style.display = "block";
}

function closeLightbox() {
  lightbox.style.display = "none";
}

function showPrevImage() {
  currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
  lightboxImg.src = images[currentImageIndex].src;
  lightboxImg.alt = images[currentImageIndex].alt;
}

function showNextImage() {
  currentImageIndex = (currentImageIndex + 1) % images.length;
  lightboxImg.src = images[currentImageIndex].src;
  lightboxImg.alt = images[currentImageIndex].alt;
}

// Événements
closeBtn.addEventListener("click", closeLightbox);
prevBtn.addEventListener("click", showPrevImage);
nextBtn.addEventListener("click", showNextImage);
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});

// Ajout de la navigation au clavier
document.addEventListener("keydown", (e) => {
  if (lightbox.style.display === "block") {
    if (e.key === "ArrowLeft") {
      showPrevImage();
    } else if (e.key === "ArrowRight") {
      showNextImage();
    } else if (e.key === "Escape") {
      closeLightbox();
    }
  }
});

// Charger la galerie au chargement de la page
document.addEventListener("DOMContentLoaded", loadGallery);
