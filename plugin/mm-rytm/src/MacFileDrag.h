// MM-RYTM, le glisser d'un fichier vers Ableton depuis la face (macOS). 2026-11-10, Mika : "ca a fait planter Live, c'est tres
// grave" : le glisser de JUCE (performExternalDragDropOfFiles) prend l'evenement en cours de la fenetre, quel qu'il soit ;
// appele depuis un message de la WebView (pas depuis un mouseDown de JUCE), cet evenement n'est pas toujours un evenement
// souris et AppKit leve alors une exception que personne n'attrape : l'hote tombe. Ici : le bouton doit etre enfonce,
// l'evenement du glisser est fabrique a la position de la souris (jamais celui en cours), et toute exception d'AppKit est
// attrapee. Rien de JUCE : un fichier Objective-C++ seul.
#pragma once

#include <functional>
#include <string>

namespace mm {

// Lance le glisser du fichier utf8Path depuis la vue nsView (un NSView*, le peer de la fenetre du plugin). "" : parti ;
// sinon pourquoi il n'est pas parti (jamais une exception, jamais un plantage). onEnd : a la fin du glisser (thread principal).
std::string startFileDrag(void* nsView, const std::string& utf8Path, std::function<void()> onEnd);

} // namespace mm
