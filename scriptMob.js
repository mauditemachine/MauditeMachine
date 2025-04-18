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

// Fonction pour formater le nom de l'événement
function formatEventName(name) {
  // Liste des mots qui ne devraient pas être capitalisés (sauf au début)
  const minorWords = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'with'];

  // D'abord tout mettre en minuscules
  name = name.toLowerCase();

  // Séparer les mots
  return name.split(' ').map((word, index) => {
    // Si c'est le premier mot ou si ce n'est pas un mot mineur
    if (index === 0 || !minorWords.includes(word)) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
    return word;
  }).join(' ');
}

// Fonction pour charger les événements
function loadEvents() {
  fetch('events.json')
    .then(response => response.json())
    .then(data => {
      const eventsSection = document.querySelector('.events-section');
      const eventsList = document.querySelector('.events-list');
      eventsList.innerHTML = ''; // Clear existing content

      // Get current date
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      // Create containers for future and past events
      const futureEventsContainer = document.createElement('div');
      futureEventsContainer.className = 'future-events';
      const pastEventsContainer = document.createElement('div');
      pastEventsContainer.className = 'past-events';

      // Add titles
      const futureTitle = document.createElement('h3');
      futureTitle.className = 'future-events-title';
      futureTitle.textContent = 'Next Events';
      futureEventsContainer.appendChild(futureTitle);

      const pastTitle = document.createElement('h3');
      pastTitle.className = 'past-events-title';
      pastTitle.textContent = 'Past Events';
      pastEventsContainer.appendChild(pastTitle);

      // Find events for 2025
      const year2025 = data.events.find(event => event.year === 2025);
      if (year2025) {
        // Sort events by date
        year2025.shows.sort((a, b) => new Date(a.date) - new Date(b.date));

        year2025.shows.forEach(show => {
          const eventDate = new Date(show.date);
          eventDate.setHours(0, 0, 0, 0);

          const eventElement = document.createElement('div');
          eventElement.className = 'event-item';

          const dateElement = document.createElement('div');
          dateElement.className = 'event-date';
          dateElement.textContent = formatDate(show.date);

          const nameElement = document.createElement('div');
          nameElement.className = 'event-name';
          nameElement.textContent = show.name;

          const locationElement = document.createElement('div');
          locationElement.className = 'event-location';
          locationElement.textContent = `${show.venue}, ${show.city}`;

          eventElement.appendChild(dateElement);
          eventElement.appendChild(nameElement);
          eventElement.appendChild(locationElement);

          // Add to appropriate container based on date
          if (eventDate >= currentDate) {
            futureEventsContainer.appendChild(eventElement);
          } else {
            pastEventsContainer.appendChild(eventElement);
          }
        });
      }

      // Add containers to the events list
      if (futureEventsContainer.children.length > 1) { // Check if there are any future events (excluding the title)
        eventsList.appendChild(futureEventsContainer);
      }
      if (pastEventsContainer.children.length > 1) { // Check if there are any past events (excluding the title)
        eventsList.appendChild(pastEventsContainer);
      }

      // Add active class to show the section
      eventsSection.classList.add('active');
    })
    .catch(error => {
      console.error('Error loading events:', error);
    });
}

// Charger la galerie au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM chargé, chargement des événements...");
  loadEvents();
});

// Galerie et Lightbox
const galleryGrid = document.querySelector(".gallery-grid");
const imageLightbox = document.querySelector(".lightbox");
const imageLightboxImg = imageLightbox.querySelector("img");
const imageCloseLightbox = document.querySelector(".close-lightbox");
const prevBtn = document.querySelector(".prev");
const nextBtn = document.querySelector(".next");

let currentImageIndex = 0;
let images = [];

// Charger les images de la galerie
function loadGallery() {
  // Images du dossier medias
  images = [
    { src: "medias/464921350_8781568558569455_7872671644658881068_n.jpg", alt: "Performance" },
    { src: "medias/463927235_3420762761392507_3255454865376167519_n.jpg", alt: "Performance" },
    { src: "medias/480405408_1246208003891242_3165125023039024413_n.jpg", alt: "Performance" },
    { src: "medias/476466146_1239403404571702_8836682943722289976_n.jpg", alt: "Performance" },
    { src: "medias/474647968_122114264516675204_8080891412134578876_n.jpg", alt: "Performance" },
    { src: "medias/48926454_2070768166315570_8931209051207892992_n.jpg", alt: "Performance" },
    { src: "medias/484072285_1269674868211222_2174957021717192732_n.jpg", alt: "Performance" },
    { src: "medias/476366677_1237157288129647_9215939268300617979_n.jpg", alt: "Performance" },
    { src: "medias/481827383_1260267672485275_3042503024244017336_n.jpg", alt: "Performance" },
    { src: "medias/463451653_2824957097663228_7197539423889751589_n.jpg", alt: "Performance" },
    { src: "medias/490136002_1295168252328550_8660311190006501321_n.jpg", alt: "Performance" },
    { src: "medias/489778241_1290850926093616_6991561513293875678_n.jpg", alt: "Performance" },
    { src: "medias/464925581_8781568315236146_6865271803075876529_n.jpg", alt: "Performance" },
    { src: "medias/481817311_1260267739151935_8963921778788233154_n.jpg", alt: "Performance" },
    { src: "medias/484116540_1268874791624563_3155457056479926862_n.jpg", alt: "Performance" },
    { src: "medias/486120772_1274717617706947_6471383342551582185_n.jpg", alt: "Performance" },
    { src: "medias/482077931_1261499695695406_397840931313933555_n.jpg", alt: "Performance" },
    { src: "medias/465248249_27387254090919077_5959571479588312308_n.jpg", alt: "Performance" },
    { src: "medias/462689911_8673299302729715_414954332908294319_n.jpg", alt: "Performance" },
    { src: "medias/463404884_2825050047653933_8646214419928350736_n.jpg", alt: "Performance" },
    { src: "medias/464110614_7894713827294760_2571209963198621556_n.jpg", alt: "Performance" },
    { src: "medias/464223407_7900524950046981_2526282748558312212_n.png", alt: "Performance" },
    { src: "medias/33245584_1359256770840531_6633888055973380096_n.jpg", alt: "Performance" },
    { src: "medias/33364897_1359257034173838_6311272906089299968_n.jpg", alt: "Performance" },
    { src: "medias/36587425_1406065489492992_6577183101707878400_n.jpg", alt: "Performance" },
    { src: "medias/462706501_27175587862057110_962844321954982944_n.jpg", alt: "Performance" },
    { src: "medias/468058207_10161709388195250_5980577003542126220_n.jpg", alt: "Performance" },
    { src: "medias/53450172_10156790040030617_1595252434005917696_n.jpg", alt: "Performance" },
    { src: "medias/462449302_8643346829057638_3989803892867381019_n.jpg", alt: "Performance" },
    { src: "medias/462363904_8658776097514711_5533106840675938478_n.jpg", alt: "Performance" },
    { src: "medias/462375898_8643394372386217_4514593083391467089_n.jpg", alt: "Performance" },
    { src: "medias/488940464_2799921333526417_141836174029281402_n.jpg", alt: "Performance" },
    { src: "medias/468003839_10162118532339339_8128711830347312927_n.jpg", alt: "Performance" },
    { src: "medias/462621276_8673075696084751_1751831420627070539_n.jpg", alt: "Performance" },
    { src: "medias/462731227_8663215283737459_7770872208017119645_n.jpg", alt: "Performance" },
    { src: "medias/462924246_8678821442176843_3484756366266998679_n.jpg", alt: "Performance" },
    { src: "medias/462809259_8678821465510174_6870811168329643396_n.jpg", alt: "Performance" },
    { src: "medias/462865694_8685759721483015_5923342074493657173_n.jpg", alt: "Performance" },
    { src: "medias/462957857_27194370663512163_7711997564493638080_n.png", alt: "Performance" },
    { src: "medias/465033217_8794700263922293_571422124688353774_n.jpg", alt: "Performance" },
    { src: "medias/465243523_8811672392225080_4659232987364234466_n.jpg", alt: "Performance" },
    { src: "medias/465011687_8800183093374010_1934512091476301747_n.jpg", alt: "Performance" },
    { src: "medias/465443606_8816058191786500_5848349860795371422_n.jpg", alt: "Performance" },
    { src: "medias/465442212_8819246738134312_3320819386583277512_n.png", alt: "Performance" },
    { src: "medias/35236221_1796469780412078_2056604506543620096_n.jpg", alt: "Performance" },
    { src: "medias/44368292_1980244745367913_929446281657450496_n.jpg", alt: "Performance" },
    { src: "medias/471768015_10162982088466742_7341299966859513018_n.jpg", alt: "Performance" },
    { src: "medias/474949846_1228743278971048_7129362653676765597_n.jpg", alt: "Performance" },
    { src: "medias/477796844_1239415191237190_4521000639724874009_n.jpg", alt: "Performance" },
    { src: "medias/480516004_1248040373708005_6765612200641323104_n.jpg", alt: "Performance" },
    { src: "medias/481055264_1255935092918533_4999418014579335237_n.jpg", alt: "Performance" },
    { src: "medias/352547420_6224793250971161_6547627283662643830_n.jpg", alt: "Performance" },
    { src: "medias/488646470_1326016755628570_2410850110883712291_n.jpg", alt: "Performance" },
    { src: "medias/484991166_1273289784516397_7148890529883039197_n.jpg", alt: "Performance" },
    { src: "medias/485846148_1274711884374187_5193956134369394734_n.jpg", alt: "Performance" },
    { src: "medias/486897031_1279576410554401_1145892451889541566_n.jpg", alt: "Performance" },
    { src: "medias/489986640_1292139175964791_2919881732553449897_n.jpg", alt: "Performance" },
    { src: "medias/490067921_1292151209296921_5995931051282217909_n.jpg", alt: "Performance" },
    { src: "medias/481215611_10170529645455704_3353980767803661656_n.jpg", alt: "Performance" },
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
  ];

  // Mélanger aléatoirement le tableau d'images
  for (let i = images.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [images[i], images[j]] = [images[j], images[i]];
  }

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
  imageLightboxImg.src = images[index].src;
  imageLightboxImg.alt = images[index].alt;
  imageLightbox.style.display = "block";
}

function closeLightbox() {
  imageLightbox.style.display = "none";
}

function showPrevImage() {
  currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
  imageLightboxImg.src = images[currentImageIndex].src;
  imageLightboxImg.alt = images[currentImageIndex].alt;
}

function showNextImage() {
  currentImageIndex = (currentImageIndex + 1) % images.length;
  imageLightboxImg.src = images[currentImageIndex].src;
  imageLightboxImg.alt = images[currentImageIndex].alt;
}

// Événements
imageCloseLightbox.addEventListener("click", closeLightbox);
prevBtn.addEventListener("click", showPrevImage);
nextBtn.addEventListener("click", showNextImage);
imageLightbox.addEventListener("click", (e) => {
  if (e.target === imageLightbox) closeLightbox();
});

// Ajout de la navigation au clavier
document.addEventListener("keydown", (e) => {
  if (imageLightbox.style.display === "block") {
    if (e.key === "ArrowLeft") {
      showPrevImage();
    } else if (e.key === "ArrowRight") {
      showNextImage();
    } else if (e.key === "Escape") {
      closeLightbox();
    }
  }
});

// Gestion des sections et navigation
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM chargé');
    
    // Gestion des boutons de navigation
    const navButtons = document.querySelectorAll('.nav-buttons a');
    const sections = {
        'releases': document.querySelector('.releases-section'),
        'events': document.querySelector('.events-section'),
        'media': document.querySelector('.gallery-section')
    };

    // Initialiser la section events comme active
    if (sections.events) {
        sections.events.classList.add('active');
        document.querySelector('.nav-buttons a[href="#events"]').classList.add('active');
    }

    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Retirer la classe active de tous les boutons et sections
            navButtons.forEach(btn => btn.classList.remove('active'));
            Object.values(sections).forEach(section => {
                if (section) section.classList.remove('active');
            });
            
            // Ajouter la classe active au bouton cliqué
            button.classList.add('active');
            
            // Afficher la section correspondante
            const sectionId = button.getAttribute('href').substring(1);
            if (sections[sectionId]) {
                sections[sectionId].classList.add('active');
                console.log('Section active:', sectionId);
                
                // Si c'est la section media, charger la galerie
                if (sectionId === 'media') {
                    console.log('Chargement de la galerie...');
                    loadGallery();
                    // Forcer le reflow pour s'assurer que la transition est appliquée
                    sections[sectionId].offsetHeight;
                }
            }
        });
    });

    // Charger les événements
    loadEvents();
});

// Gestion du menu hamburger
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM chargé');
    
    const hamburger = document.querySelector('.hamburger');
    const topLinks = document.querySelector('.top-links');
    const menuContent = document.querySelector('.menu-content');

    if (hamburger && topLinks) {
        hamburger.addEventListener('click', function(e) {
            e.stopPropagation();
            topLinks.classList.toggle('active');
        });

        document.addEventListener('click', function(e) {
            if (!menuContent.contains(e.target) && !hamburger.contains(e.target)) {
                topLinks.classList.remove('active');
            }
        });

        menuContent.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }

    // Gestion des accordéons d'événements
    const accordionItems = document.querySelectorAll('.accordion-item');
    
    accordionItems.forEach(item => {
        const header = item.querySelector('.accordion-header');
        const content = item.querySelector('.accordion-content');
        
        header.addEventListener('click', () => {
            // Fermer tous les autres accordéons
            accordionItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Ouvrir/fermer l'accordéon cliqué
            item.classList.toggle('active');
        });
    });

    // Charger les événements depuis le fichier JSON
    fetch('events.json')
        .then(response => response.json())
        .then(data => {
            data.events.forEach(yearData => {
                const accordionItem = document.querySelector(`.accordion-item[data-year="${yearData.year}"]`);
                if (accordionItem) {
                    const content = accordionItem.querySelector('.accordion-content');
                    content.innerHTML = ''; // Vider le contenu existant

                    yearData.shows.forEach(event => {
                        const eventElement = document.createElement('div');
                        eventElement.className = 'event';

                        const date = new Date(event.date);
                        const formattedDate = date.toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });

                        let location = event.venue;
                        if (event.city) {
                            location += `, ${event.city}`;
                        }

                        let eventHTML = `
                            <div class="event-date">${formattedDate}</div>
                            ${event.facebook_event 
                                ? `<div class="event-name"><a href="${event.facebook_event}" target="_blank">${event.name}</a></div>`
                                : `<div class="event-name">${event.name}</div>`
                            }
                            <div class="event-location">${location}</div>
                        `;

                        if (event.lineup && event.lineup.length > 0) {
                            eventHTML += `<div class="event-lineup">Lineup: ${event.lineup.join(', ')}</div>`;
                        }

                        eventElement.innerHTML = eventHTML;
                        content.appendChild(eventElement);
                    });
                }
            });
        })
        .catch(error => {
            console.error('Erreur lors du chargement des événements:', error);
        });
});

// Chargement des releases
document.addEventListener('DOMContentLoaded', function() {
    loadReleases();
});

// Variables pour le slider
const slider = document.querySelector('.slider');
const sliderTrack = document.querySelector('.slider-track');
const prevButton = document.querySelector('.slider-button.prev');
const nextButton = document.querySelector('.slider-button.next');

let currentSlide = 0;
let startX = 0;
let currentX = 0;
let isDragging = false;

// Fonction pour créer les slides
function createSlides() {
  sliderTrack.innerHTML = '';
  images.forEach((image, index) => {
    const slide = document.createElement('div');
    slide.className = 'slide';
    const img = document.createElement('img');
    img.src = image.src;
    img.alt = image.alt;
    slide.appendChild(img);
    sliderTrack.appendChild(slide);
  });
  goToSlide(0);
}

// Fonction pour aller à une slide spécifique
function goToSlide(index) {
  currentSlide = index;
  const offset = -index * 100;
  sliderTrack.style.transform = `translateX(${offset}%)`;
}

// Gestion des événements tactiles
function handleTouchStart(e) {
  startX = e.touches[0].clientX;
  isDragging = true;
  sliderTrack.style.transition = 'none';
}

function handleTouchMove(e) {
  if (!isDragging) return;
  currentX = e.touches[0].clientX;
  const diff = currentX - startX;
  const slideWidth = slider.offsetWidth;
  const percentMove = (diff / slideWidth) * 100;
  const offset = -currentSlide * 100 + percentMove;
  sliderTrack.style.transform = `translateX(${offset}%)`;
}

function handleTouchEnd() {
  if (!isDragging) return;
  isDragging = false;
  sliderTrack.style.transition = 'transform 0.3s ease-out';
  const diff = currentX - startX;
  const slideWidth = slider.offsetWidth;
  const percentMove = (diff / slideWidth) * 100;

  if (Math.abs(percentMove) > 20) {
    if (percentMove > 0 && currentSlide > 0) {
      goToSlide(currentSlide - 1);
    } else if (percentMove < 0 && currentSlide < images.length - 1) {
      goToSlide(currentSlide + 1);
    } else {
      goToSlide(currentSlide);
    }
  } else {
    goToSlide(currentSlide);
  }
}

// Initialisation du slider
document.addEventListener('DOMContentLoaded', () => {
  // ... existing code ...
  
  // Initialiser le slider
  if (slider && sliderTrack) {
    createSlides();
    
    // Ajouter les événements pour les boutons
    if (prevButton) {
      prevButton.addEventListener('click', () => {
        if (currentSlide > 0) {
          goToSlide(currentSlide - 1);
        }
      });
    }
    
    if (nextButton) {
      nextButton.addEventListener('click', () => {
        if (currentSlide < images.length - 1) {
          goToSlide(currentSlide + 1);
        }
      });
    }
    
    // Ajouter les événements tactiles
    slider.addEventListener('touchstart', handleTouchStart);
    slider.addEventListener('touchmove', handleTouchMove);
    slider.addEventListener('touchend', handleTouchEnd);
  }
});
