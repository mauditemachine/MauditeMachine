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

// Convertir le scroll vertical en défilement horizontal
let scrollPosition = 0;
const mainContainer = document.querySelector(".main-container");
const content = document.querySelector(".content");
const releases = document.querySelector(".releases-section");

window.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();

    // Ajuster la vitesse du défilement
    scrollPosition = Math.max(
      0,
      Math.min(scrollPosition + e.deltaY * 0.8, window.innerWidth * 1.5)
    );

    // Appliquer le défilement avec une animation fluide
    mainContainer.style.transform = `translateX(-${scrollPosition}px)`;
  },
  { passive: false }
);
