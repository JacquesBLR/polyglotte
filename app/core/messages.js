// Tenue de la liste des messages affichés (#83). Donnée pure, testée.
//
// Pendant le streaming, la réponse du tuteur s'affiche au fur et à mesure : un message
// provisoire, remplacé à chaque fragment puis par la version définitive. Il se reconnaît
// à son drapeau `streaming`.
//
// Ce drapeau vit dans la liste, et non dans une variable de `send()`, pour une raison de
// fond : React exécute les fonctions de mise à jour quand il traite sa file, au rendu
// suivant. Une mise à jour qui consulte une variable extérieure la lit donc telle qu'elle
// est *à ce moment-là*, pas telle qu'elle était à l'appel. C'est ce décalage qui faisait
// disparaître la bulle de l'élève : au premier fragment, le `m.slice(0, -1)` censé retirer
// le provisoire retirait le dernier message de la liste — le sien.
export function retireProvisoire(messages) {
  const dernier = messages[messages.length - 1];
  return dernier && dernier.streaming ? messages.slice(0, -1) : messages;
}
