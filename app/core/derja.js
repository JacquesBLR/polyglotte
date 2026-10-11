// Ancrage du tunisien dans de la derja réelle (#85). Donnée pure.
//
// Sans consigne précise, un modèle écrit un « arabe maghrébin moyen » : il mélange des
// formes marocaines et algériennes à de l'arabe standard. C'est ce que l'élève entend
// quand il dit que ce n'est pas du tunisien — le défaut est dans le texte, pas dans la
// voix.
//
// Les oppositions ci-dessous ne sont pas de mémoire : elles sont comptées sur les 1 950
// phrases du corpus TUNIFRA (fbougares/TUNIFRA, radio tunisienne, transcriptions alignées
// au français), celui dont vient déjà l'extrait de référence de la voix.
//
//   برشا 158 occurrences · بزاف 0      قداش 21 · شحال 0      توة 77 · دابا 0
//   متاع 287 · ديال 0                  نحب 43 · بغيت 0       هاذا/هاذي 76 · هاد 0
//   كيفاش 101 · شنوة/شنيا 84           باهي 69 · ياخي 7      عالسلامة 8
//
// Les trois exemples sont cités du corpus : du tunisien attesté, pas reconstitué.
export const GUIDE_DERJA = `
Écris un tunisien attesté, jamais un « arabe maghrébin moyen » ni de l'arabe standard déguisé.
Oppositions à respecter (la forme tunisienne d'abord, celle à ne pas employer ensuite) :
- برشا (beaucoup), jamais بزاف ;
- قداش (combien), jamais شحال ;
- توة (maintenant), jamais دابا ;
- متاع (possession : كتاب متاعي), jamais ديال ;
- نحب (je veux, j'aime), jamais بغيت ;
- هاذا / هاذي (ce, cette), jamais هاد ;
- شنوة / شنيا (quoi) et كيفاش (comment), jamais واش, ni ماذا, ni هل.
Marqueurs tunisiens à employer naturellement : باهي (bien, d'accord), ياخي (n'est-ce pas),
زادا (aussi), اللي (qui, que), عالسلامة (salut), شنيا أحوالك (comment vas-tu).
En arabizi, ces formes s'écrivent : barcha, 9addech, tawa, mta3, n7eb, hedha / hedhi,
chnowa / chniya, kifech, bahi, yekhi, zeda, 3asslema.
Exemples de tunisien réel, cités d'un corpus de radio tunisienne :
- عالسلامة إيمان عالسلامة تسنيم شنيا أموركم (salut Imen, salut Tasnim, comment allez-vous ?)
- وإنتي تسنيم كيفاش كان الظروف العمل في التقرير متاعك (et toi Tasnim, comment étaient les conditions de travail de ton reportage ?)
- آنا الحقيقة إعتمدت على الإنترنت ماللول شفت برشا مصادر (moi honnêtement, j'ai d'abord utilisé internet, j'ai consulté beaucoup de sources)`;
