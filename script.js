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
async function loadEvents() {
  try {
    const response = await fetch("events.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    const eventsContainer = document.querySelector(".events-container");
    if (!eventsContainer) {
      throw new Error("Container des événements non trouvé");
    }

    // Vider le container des événements
    eventsContainer.innerHTML = "";

    // Créer les listes d'événements pour chaque année
    data.events.sort((a, b) => b.year - a.year);
    data.events.forEach((yearData) => {
      yearData.shows.sort((a, b) => new Date(b.date) - new Date(a.date));
      const yearEventList = createEventList(yearData.year, yearData.shows);
      eventsContainer.appendChild(yearEventList);
    });

    // Afficher les événements de 2025 par défaut
    const eventList2025 = eventsContainer.querySelector('.event-list[data-year="2025"]');
    if (eventList2025) {
      eventList2025.classList.add("active");
    }

    // Ajouter les écouteurs d'événements pour les boutons d'année existants
    const yearButtons = document.querySelectorAll(".year-button");
    yearButtons.forEach((button) => {
      button.addEventListener("click", () => {
        // Retirer la classe active de tous les boutons
        yearButtons.forEach((btn) => {
          btn.classList.remove("active");
        });
        
        // Activer le bouton cliqué
        button.classList.add("active");

        // Masquer toutes les listes d'événements
        document.querySelectorAll(".event-list").forEach((list) => {
          list.classList.remove("active");
        });

        // Afficher la liste d'événements correspondante
        const year = button.getAttribute("data-year");
        const targetList = document.querySelector(`.event-list[data-year="${year}"]`);
        if (targetList) {
          targetList.classList.add("active");
        }
      });
    });

    // Activer le bouton 2025 par défaut
    const button2025 = document.querySelector('.year-button[data-year="2025"]');
    if (button2025) {
      button2025.classList.add("active");
    }

  } catch (error) {
    console.error("Erreur lors du chargement des événements:", error);
  }
}

function createEventList(year, events) {
  const eventList = document.createElement("div");
  eventList.className = "event-list";
  eventList.setAttribute("data-year", year);

  events.forEach((event) => {
    // Gérer l'affichage de la ville et de la province
    let location = event.venue;
    if (event.venue === "Montréal" && event.city === "Québec") {
      location = "Montréal, QC";
    } else if (event.venue === event.city) {
      location = event.venue;
    } else {
      location = `${event.venue}, ${event.city}`;
    }

    const eventElement = document.createElement("div");
    eventElement.className = "event";

    // Formater le lineup avec des retours à la ligne
    let formattedLineup = '';
    if (event.lineup) {
      const lineupArray = event.lineup;
      let currentLine = [];
      let lines = [];
      
      lineupArray.forEach((artist, index) => {
        currentLine.push(artist);
        if (currentLine.length === 3 || index === lineupArray.length - 1) {
          lines.push(currentLine.join(", "));
          currentLine = [];
        }
      });
      
      formattedLineup = lines.join("<br>");
    }

    const formattedName = formatEventName(event.name);
    const eventName = event.facebook_event 
      ? `<div class="event-name"><a href="${event.facebook_event}" target="_blank">${formattedName}</a></div>`
      : `<div class="event-name">${formattedName}</div>`;

    eventElement.innerHTML = `
      <div class="event-date">${formatDate(event.date)}</div>
      ${eventName}
      <div class="event-location">${location}</div>
      ${event.lineup ? `<div class="event-lineup">${formattedLineup}</div>` : ""}
    `;

    eventList.appendChild(eventElement);
  });

  return eventList;
}

// Appeler la fonction au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM chargé, chargement des événements...");
  loadEvents();
});

document.addEventListener('DOMContentLoaded', function() {
    const navButtons = document.querySelectorAll('.nav-buttons a');
    const content = document.querySelector('.content');
    const logo = document.querySelector('.logo');
    let contentMoved = false;

    // Fonction pour réinitialiser l'état
    function resetState() {
        // Masquer toutes les sections
        document.querySelectorAll('.releases-section, .events-section, .gallery-section, .medias-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Réinitialiser les boutons
        navButtons.forEach(button => {
            button.classList.remove('active');
        });
        
        // Réinitialiser la position du contenu
        content.style.marginTop = '0';
        contentMoved = false;
    }

    // Ajouter l'événement de clic sur le logo
    logo.addEventListener('click', resetState);

    // Centrer le contenu au chargement
    content.style.marginTop = '0';
    content.style.transition = 'margin-top 0.3s ease';

    navButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Retirer la classe active de tous les boutons
            navButtons.forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Activer le bouton cliqué
            button.classList.add('active');
            
            // Déplacer le contenu vers le bas uniquement la première fois
            if (!contentMoved) {
                requestAnimationFrame(() => {
                    content.style.marginTop = '25px';
                });
                contentMoved = true;
            }
            
            // Afficher la section correspondante
            const sectionId = button.getAttribute('href').substring(1);
            const sections = document.querySelectorAll('section');
            
            sections.forEach(section => {
                section.classList.remove('active');
            });
            
            const targetSection = document.querySelector(`.${sectionId}-section`);
            if (targetSection) {
                targetSection.classList.add('active');
                
                // Charger les médias si c'est la section medias
                if (sectionId === 'medias') {
                    loadMedias();
                }
            }
        });
    });
});

// Gestion du défilement pour les liens
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            const headerHeight = document.querySelector('header').offsetHeight;
            const targetPosition = targetElement.offsetTop - headerHeight;
            const navButtons = document.querySelector('.nav-buttons');
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });

            // Mettre à jour la position des boutons
            const content = document.querySelector('.content');
            const scrollPosition = content.offsetTop;
            navButtons.style.setProperty('--scroll-position', `${scrollPosition}px`);
        }
    });
});

function loadMedias() {
    console.log('Chargement des médias...');
    const mediasGrid = document.querySelector('.medias-grid');
    if (!mediasGrid) {
        console.error('Grid des médias non trouvée');
        return;
    }

    mediasGrid.innerHTML = '';

    // Liste des images avec leur chemin exact comme dans le dossier
    const images = [
        'medias/_DSC2160.jpg',
        'medias/_DSC1941-Enhanced-NR.jpg',
        'medias/_DSC2148.jpg',
        'medias/_DSC1808.jpg',
        'medias/_DSC1881.jpg',
        'medias/_DSC1700.jpg',
        'medias/_DSC1748.jpg',
        'medias/YUL_0324-2.jpg',
        'medias/YUL_0330.jpg',
        'medias/JoGorsky_2025-02_Pinup-Valentines_091.jpg',
        'medias/JoGorsky_2024-10_Monstrocity-Halloween_074.jpg',
        'medias/JoGorsky_2024-10_Monstrocity-Halloween_077.jpg',
        'medias/DSCF9997_edit1.jpg',
        'medias/DSCF9991_edit1.jpg',
        'medias/DSCF0006_edit1.jpg',
        'medias/7AF2D730-3F53-4942-984E-FABAC8C9B85E.jpg',
        'medias/BackOnTrack.jpg',
        'medias/53690C8F-98DC-4FAF-843F-51397D20FF2D.jpg',
        'medias/603061_10151506175820841_595710399_n.jpg',
        'medias/490136002_1295168252328550_8660311190006501321_n.jpg',
        'medias/53450172_10156790040030617_1595252434005917696_n.jpg',
        'medias/490067921_1292151209296921_5995931051282217909_n.jpg',
        'medias/489986640_1292139175964791_2919881732553449897_n.jpg',
        'medias/489778241_1290850926093616_6991561513293875678_n.jpg',
        'medias/48926454_2070768166315570_8931209051207892992_n.jpg',
        'medias/488940464_2799921333526417_141836174029281402_n.jpg',
        'medias/486897031_1279576410554401_1145892451889541566_n.jpg',
        'medias/488646470_1326016755628570_2410850110883712291_n.jpg',
        'medias/486120772_1274717617706947_6471383342551582185_n.jpg',
        'medias/484991166_1273289784516397_7148890529883039197_n.jpg',
        'medias/485846148_1274711884374187_5193956134369394734_n.jpg',
        'medias/484116540_1268874791624563_3155457056479926862_n.jpg',
        'medias/484072285_1269674868211222_2174957021717192732_n.jpg',
        'medias/482077931_1261499695695406_397840931313933555_n.jpg',
        'medias/481827383_1260267672485275_3042503024244017336_n.jpg',
        'medias/481215611_10170529645455704_3353980767803661656_n.jpg',
        'medias/481817311_1260267739151935_8963921778788233154_n.jpg',
        'medias/481055264_1255935092918533_4999418014579335237_n.jpg',
        'medias/480516004_1248040373708005_6765612200641323104_n.jpg',
        'medias/480405408_1246208003891242_3165125023039024413_n.jpg',
        'medias/477796844_1239415191237190_4521000639724874009_n.jpg',
        'medias/476466146_1239403404571702_8836682943722289976_n.jpg',
        'medias/476366677_1237157288129647_9215939268300617979_n.jpg',
        'medias/474647968_122114264516675204_8080891412134578876_n.jpg',
        'medias/474949846_1228743278971048_7129362653676765597_n.jpg',
        'medias/471768015_10162982088466742_7341299966859513018_n.jpg',
        'medias/468058207_10161709388195250_5980577003542126220_n.jpg',
        'medias/465443606_8816058191786500_5848349860795371422_n.jpg',
        'medias/468003839_10162118532339339_8128711830347312927_n.jpg',
        'medias/465442212_8819246738134312_3320819386583277512_n.png',
        'medias/465243523_8811672392225080_4659232987364234466_n.jpg',
        'medias/465248249_27387254090919077_5959571479588312308_n.jpg',
        'medias/465033217_8794700263922293_571422124688353774_n.jpg',
        'medias/464925581_8781568315236146_6865271803075876529_n.jpg',
        'medias/465011687_8800183093374010_1934512091476301747_n.jpg',
        'medias/464921350_8781568558569455_7872671644658881068_n.jpg',
        'medias/464223407_7900524950046981_2526282748558312212_n.png',
        'medias/464110614_7894713827294760_2571209963198621556_n.jpg',
        'medias/463927235_3420762761392507_3255454865376167519_n.jpg',
        'medias/463451653_2824957097663228_7197539423889751589_n.jpg',
        'medias/463404884_2825050047653933_8646214419928350736_n.jpg',
        'medias/462957857_27194370663512163_7711997564493638080_n.png',
        'medias/462865694_8685759721483015_5923342074493657173_n.jpg',
        'medias/462924246_8678821442176843_3484756366266998679_n.jpg',
        'medias/462731227_8663215283737459_7770872208017119645_n.jpg',
        'medias/462809259_8678821465510174_6870811168329643396_n.jpg',
        'medias/462706501_27175587862057110_962844321954982944_n.jpg',
        'medias/462621276_8673075696084751_1751831420627070539_n.jpg',
        'medias/462689911_8673299302729715_414954332908294319_n.jpg',
        'medias/462375898_8643394372386217_4514593083391467089_n.jpg',
        'medias/462449302_8643346829057638_3989803892867381019_n.jpg',
        'medias/459186464_1042053933814072_887394904461510536_n.jpg',
        'medias/459356611_577106314641628_7948540754089562955_n.jpg',
        'medias/462363904_8658776097514711_5533106840675938478_n.jpg',
        'medias/44368292_1980244745367913_929446281657450496_n.jpg',
        'medias/459004621_1555689078386610_7094668039658845235_n.jpg',
        'medias/367800056_672152048156122_793282389538458180_n.jpg',
        'medias/36587425_1406065489492992_6577183101707878400_n.jpg',
        'medias/352547420_6224793250971161_6547627283662643830_n.jpg',
        'medias/363393321_317589543949568_2775297006998526690_n.jpg',
        'medias/35236221_1796469780412078_2056604506543620096_n.jpg',
        'medias/33245584_1359256770840531_6633888055973380096_n.jpg',
        'medias/33364897_1359257034173838_6311272906089299968_n.jpg',
        'medias/317673616_1133154394065517_5577655773881691687_n.jpg',
        'medias/305839661_1563103054147144_2047561859068751024_n.jpg',
        'medias/30DC4B78-4917-44C0-BB30-B1283BA5924B.jpg',
        'medias/22279542_10154949783416961_1236740403543318439_n.jpg',
        'medias/242FAB21-F40A-47D7-990A-C6D381272F08.jpg',
        'medias/20250301_013718.jpg',
        'medias/2022-03-28(496).jpg',
        'medias/2022-03-28(498).jpg',
        'medias/2022-03-28(349).jpg',
        'medias/2022-03-28(350).jpg',
        'medias/2022-03-28(417).jpg'
    ];

    function createThumbnail(imagePath, index) {
        return new Promise((resolve) => {
            const thumbnail = document.createElement('div');
            thumbnail.className = 'media-thumbnail';
            
            const img = new Image();
            img.alt = 'Media thumbnail';
            
            // Nettoyer le chemin de l'image
            const cleanPath = imagePath
                .replace(/\n/g, '') // Enlever les retours à la ligne
                .replace(/\./g, '.') // Remplacer les points potentiellement cassés
                .trim(); // Enlever les espaces en début/fin
            
            img.onload = () => {
                thumbnail.appendChild(img);
                thumbnail.addEventListener('click', () => openLightbox(index));
                resolve(thumbnail);
            };
            
            img.onerror = () => {
                console.error(`Erreur de chargement: ${cleanPath}`);
                // Essayer avec l'encodage complet
                const encodedPath = encodeURIComponent(cleanPath)
                    .replace(/%2F/g, '/') // Restaurer les slashes
                    .replace(/%20/g, ' ') // Restaurer les espaces
                    .replace(/%27/g, "'") // Restaurer les apostrophes
                    .replace(/%28/g, '(') // Restaurer les parenthèses
                    .replace(/%29/g, ')');
                
                img.src = encodedPath;
                
                // Si ça échoue encore, dernier essai avec un autre encodage
                img.onerror = () => {
                    const lastTry = btoa(cleanPath);
                    img.src = `data:image/jpeg;base64,${lastTry}`;
                    
                    img.onerror = () => {
                        console.error(`Échec définitif: ${cleanPath}`);
                        thumbnail.style.backgroundColor = 'red';
                        thumbnail.style.cursor = 'not-allowed';
                        resolve(thumbnail);
                    };
                };
            };
            
            img.src = cleanPath;
        });
    }

    // Charger toutes les images
    Promise.all(images.map((path, index) => createThumbnail(path, index)))
        .then(thumbnails => {
            thumbnails.forEach(thumbnail => mediasGrid.appendChild(thumbnail));
        });

    // Initialisation de la lightbox
    const lightbox = document.querySelector('.lightbox');
    const lightboxImage = document.querySelector('.lightbox-image');
    const lightboxClose = document.querySelector('.lightbox-close');
    const lightboxPrev = document.querySelector('.lightbox-prev');
    const lightboxNext = document.querySelector('.lightbox-next');
    let currentImageIndex = 0;
    let autoSlideInterval;

    function showImage(index) {
        if (index < 0) index = images.length - 1;
        if (index >= images.length) index = 0;
        currentImageIndex = index;
        const encodedPath = encodeURI(images[index]);
        lightboxImage.src = encodedPath;
    }

    function startAutoSlide() {
        autoSlideInterval = setInterval(() => {
            showImage(currentImageIndex + 1);
        }, 5000); // Change d'image toutes les 5 secondes
    }

    function stopAutoSlide() {
        if (autoSlideInterval) {
            clearInterval(autoSlideInterval);
        }
    }

    function openLightbox(index) {
        currentImageIndex = index;
        lightboxImage.src = images[index];
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
        startAutoSlide();
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
        stopAutoSlide();
    }

    // Ajout des événements pour la navigation
    lightboxPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        stopAutoSlide();
        showImage(currentImageIndex - 1);
        startAutoSlide();
    });

    lightboxNext.addEventListener('click', (e) => {
        e.stopPropagation();
        stopAutoSlide();
        showImage(currentImageIndex + 1);
        startAutoSlide();
    });

    lightboxClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeLightbox();
    });

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    // Navigation au clavier
    document.addEventListener('keydown', (e) => {
        if (lightbox.classList.contains('active')) {
            if (e.key === 'Escape') {
                closeLightbox();
            } else if (e.key === 'ArrowLeft') {
                stopAutoSlide();
                showImage(currentImageIndex - 1);
                startAutoSlide();
            } else if (e.key === 'ArrowRight') {
                stopAutoSlide();
                showImage(currentImageIndex + 1);
                startAutoSlide();
            }
        }
    });
}

// Charger les médias au démarrage
document.addEventListener('DOMContentLoaded', () => {
  loadMedias();
  loadEvents();
});

// Gestion du lecteur audio
document.addEventListener('DOMContentLoaded', function() {
    const audio = document.getElementById('featured-audio');
    const playButton = document.querySelector('.play-button');
    const waveformContainer = document.getElementById('waveform');
    
    // Initialiser Wavesurfer
    const wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#666',
        progressColor: '#FFDD00',
        cursorColor: '#FFDD00',
        barWidth: 2,
        barGap: 1,
        barRadius: 0,
        height: 100,
        responsive: true,
        normalize: true,
        fillParent: true,
        minPxPerSec: 1,
        interact: true,
        hideScrollbar: true,
        backend: 'MediaElement'
    });

    // Charger l'audio avec gestion d'erreur
    wavesurfer.on('error', function(err) {
        console.error('Erreur WaveSurfer:', err);
    });

    // Charger l'audio
    wavesurfer.load('files/Maudite Machine - Autopsynth (Original Mix).mp3');

    // Gestion du bouton play/pause
    playButton.addEventListener('click', function() {
        wavesurfer.playPause();
    });

    // Mettre à jour le bouton play/pause
    wavesurfer.on('play', function() {
        playButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
    });

    wavesurfer.on('pause', function() {
        playButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    });

    // Gestion du clic sur la waveform
    waveformContainer.addEventListener('click', function(e) {
        const rect = waveformContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = x / waveformContainer.offsetWidth;
        wavesurfer.seekTo(percent);
    });
});
