// Registre des langues — extrait à l'identique de l'app v1 (js/app.js).
// Donnée pure, aucune dépendance.

export const LANGUAGES = {
  catalan: {
    label: "Catalan", langFr: "le catalan",
    tutor: { name: "Núria", city: "Barcelone", f: true },
    stt: "ca-ES", ttsPrefixes: ["ca", "es"],
    rtl: false, reading: null, support: "full",
    voiceHint: "Installe une voix catalane (« Montserrat » sur iOS/macOS) pour la meilleure synthèse ; repli sur une voix espagnole sinon.",
    promptExtra: "Sois attentive aux calques du français et de l'espagnol, fréquents chez les francophones.",
    scenarios: [
      { id: "calcotada", label: "🌍 Une calçotada entre amis", prompt: "Jeu de rôle : tu invites l'élève à une calçotada près de Tarragone. Fais-lui vivre le rituel : calçots grillés au feu, sauce romesco, porró de vi, mains noircies et grand bavoir. Vocabulaire de la fête et de la table." },
      { id: "santjordi", label: "🌍 Sant Jordi", prompt: "Jeu de rôle : c'est la diada de Sant Jordi à Barcelone, la Rambla est couverte de stands de livres et de roses. Explique la tradition, aide l'élève à choisir un livre et une rose, parlez de vos lectures." },
      { id: "castellers", label: "🌍 Une diada castellera", prompt: "Jeu de rôle : vous assistez à une exhibition de castellers. Explique les tours humaines (la pinya, le tronc, l'enxaneta), l'esprit d'équipe, et fais réagir l'élève au spectacle." },
    ],
  },
  espagnol: {
    label: "Espagnol", langFr: "l'espagnol",
    tutor: { name: "Carmen", city: "Séville", f: true },
    stt: "es-ES", ttsPrefixes: ["es"],
    rtl: false, reading: null, support: "full", voiceHint: "",
    promptExtra: "Sois attentive aux faux amis français-espagnol et aux confusions ser/estar.",
    scenarios: [
      { id: "tapas", label: "🌍 De tapas à Séville", prompt: "Jeu de rôle : tournée de tapas dans le centre de Séville, de bar en bar. Commander des raciones, partager, payer à la fin, ambiance andalouse." },
      { id: "feria", label: "🌍 La Feria de Abril", prompt: "Jeu de rôle : tu emmènes l'élève à la Feria de Abril de Séville : casetas, rebujito, sevillanas, tenues de flamenca. Fais-lui vivre la fête." },
      { id: "semanasanta", label: "🌍 La Semana Santa", prompt: "Jeu de rôle : processions de la Semana Santa à Séville : nazarenos, pasos, saetas. Explique les traditions et fais réagir l'élève à ce qu'il voit." },
    ],
  },
  anglais: {
    label: "Anglais (GB)", langFr: "l'anglais britannique",
    tutor: { name: "Oliver", city: "Londres", f: false },
    stt: "en-GB", ttsPrefixes: ["en-gb", "en"],
    rtl: false, reading: null, support: "full", voiceHint: "",
    promptExtra: "Utilise l'anglais britannique (vocabulaire, orthographe, expressions). Corrige les calques du français.",
    scenarios: [
      { id: "pub", label: "🌍 Au pub", prompt: "Jeu de rôle : un pub londonien classique. Commander au comptoir, payer sa tournée (a round), small talk sur la météo et le football, le rituel du last orders." },
      { id: "tube", label: "🌍 Dans le métro de Londres", prompt: "Jeu de rôle : se déplacer dans le Tube : Oyster card, mind the gap, demander sa ligne et sa correspondance, l'étiquette du métro londonien." },
      { id: "sundayroast", label: "🌍 Sunday roast", prompt: "Jeu de rôle : repas de Sunday roast au pub ou en famille : les plats traditionnels, la conversation du dimanche, la politesse britannique." },
    ],
  },
  allemand: {
    label: "Allemand", langFr: "l'allemand",
    tutor: { name: "Lena", city: "Berlin", f: true },
    stt: "de-DE", ttsPrefixes: ["de"],
    rtl: false, reading: null, support: "full", voiceHint: "",
    promptExtra: "Sois attentive aux déclinaisons, aux genres et à l'ordre des mots, difficultés classiques des francophones.",
    scenarios: [
      { id: "biergarten", label: "🌍 Au Biergarten", prompt: "Jeu de rôle : un Biergarten : commander une Maß et des Brezeln, partager une grande table avec des inconnus, trinquer (Prost!), bavarder." },
      { id: "amt", label: "🌍 Au Bürgeramt", prompt: "Jeu de rôle très berlinois : l'élève doit faire son Anmeldung au Bürgeramt. Prendre un ticket, attendre, expliquer sa situation, comprendre le vocabulaire administratif." },
      { id: "flohmarkt", label: "🌍 Flohmarkt au Mauerpark", prompt: "Jeu de rôle : chiner au marché aux puces du Mauerpark : demander les prix, marchander poliment, discuter des trouvailles." },
    ],
  },
  suisse: {
    label: "Suisse allemand", langFr: "le suisse allemand",
    tutor: { name: "Reto", city: "Zurich", f: false },
    stt: "de-CH", ttsPrefixes: ["de"],
    rtl: false, reading: null, support: "partial",
    supportNote: "Le suisse allemand n'a pas de moteur vocal dédié : la reconnaissance comprend mieux l'allemand standard que le dialecte, et la voix de synthèse est allemande (prononciation approximative). La conversation écrite, elle, est pleinement en schwiizerdütsch.",
    voiceHint: "Voix allemande utilisée (pas de voix suisse-allemande existante).",
    promptExtra: "Écris en suisse allemand (dialecte zurichois), avec une orthographe dialectale courante. L'élève peut répondre en allemand standard : accepte-le, mais réponds toujours en dialecte. Les transcriptions vocales arrivent souvent déformées vers l'allemand standard : interprète avec bienveillance.",
    scenarios: [
      { id: "kafi", label: "🌍 Kafi und Gipfeli", prompt: "Jeu de rôle : pause café à Zurich, es Kafi und es Gipfeli. Small talk suisse : la météo, les montagnes, la ponctualité — et les différences avec l'allemand d'Allemagne." },
      { id: "wandern", label: "🌍 Randonnée en montagne", prompt: "Jeu de rôle : préparer et vivre une Wanderung : itinéraire, météo, équipement, pique-nique, saluer les autres randonneurs (Grüezi mitenand!)." },
      { id: "migros", label: "🌍 Courses à la Migros", prompt: "Jeu de rôle : faire ses courses à la Migros : trouver les rayons, produits typiquement suisses, payer, la consigne et le recyclage." },
    ],
  },
  ptpt: {
    label: "Portugais (Portugal)", langFr: "le portugais européen",
    tutor: { name: "Inês", city: "Lisbonne", f: true },
    stt: "pt-PT", ttsPrefixes: ["pt-pt", "pt"],
    rtl: false, reading: null, support: "full", voiceHint: "",
    promptExtra: "Utilise le portugais européen (prononciation, usage de « tu »/« você », vocabulaire du Portugal), pas le brésilien.",
    scenarios: [
      { id: "pasteis", label: "🌍 Pastéis de Belém", prompt: "Jeu de rôle : la file des Pastéis de Belém : commander des pastéis de nata et une bica, canelle ou pas, discuter de la recette secrète." },
      { id: "fado", label: "🌍 Soirée fado à Alfama", prompt: "Jeu de rôle : une maison de fado dans l'Alfama : le silence pendant le chant, la saudade, commander à voix basse, parler musique entre deux fados." },
      { id: "electrico", label: "🌍 Le tram 28", prompt: "Jeu de rôle : traverser Lisbonne dans le mythique elétrico 28 : acheter son billet, demander l'arrêt, commenter les quartiers traversés." },
    ],
  },
  ptbr: {
    label: "Portugais (Brésil)", langFr: "le portugais brésilien",
    tutor: { name: "João", city: "Rio de Janeiro", f: false },
    stt: "pt-BR", ttsPrefixes: ["pt-br", "pt"],
    rtl: false, reading: null, support: "full", voiceHint: "",
    promptExtra: "Utilise le portugais brésilien (« você », vocabulaire et tournures du Brésil).",
    scenarios: [
      { id: "botequim", label: "🌍 Au botequim", prompt: "Jeu de rôle : un bar de quartier carioca : chope bien glacée, petiscos, conversation détendue, football et musique." },
      { id: "praia", label: "🌍 Plage de Copacabana", prompt: "Jeu de rôle : une journée à Copacabana : vendeurs ambulants (açaí, mate, biscoito Globo), louer une chaise et un parasol, baignade et altinha." },
      { id: "feira", label: "🌍 La feira du dimanche", prompt: "Jeu de rôle : un marché de rue brésilien : fruits tropicaux à goûter, pastel de feira, caldo de cana, marchander gentiment." },
    ],
  },
  japonais: {
    label: "Japonais", langFr: "le japonais",
    tutor: { name: "Yuki", city: "Tokyo", f: true },
    stt: "ja-JP", ttsPrefixes: ["ja"],
    rtl: false, reading: "le rōmaji (transcription latine) de ta réplique", support: "full", voiceHint: "",
    promptExtra: "Écris en japonais normal (kanji et kana), avec des kanji adaptés au niveau (débutant : kana et kanji très courants uniquement). Utilise la forme polie (-masu/-desu) avec les débutants.",
    scenarios: [
      { id: "konbini", label: "🌍 Au konbini", prompt: "Jeu de rôle : un konbini japonais : choisir un bentō et une boisson, le faire réchauffer, comprendre les formules ritualisées du personnel, payer." },
      { id: "izakaya", label: "🌍 À l'izakaya", prompt: "Jeu de rôle : soirée à l'izakaya : l'otōshi, commander plusieurs petits plats au fil de la soirée, trinquer (kanpai!), appeler le serveur (sumimasen!)." },
      { id: "onsen", label: "🌍 Aux onsen", prompt: "Jeu de rôle : séjour en ryokan avec onsen : les règles du bain (se laver avant, la petite serviette), le yukata, le vocabulaire du séjour." },
    ],
  },
  arabe: {
    label: "Arabe standard", langFr: "l'arabe standard moderne",
    tutor: { name: "Amina", city: "Le Caire", f: true },
    stt: "ar-SA", ttsPrefixes: ["ar"],
    rtl: true, reading: "une translittération latine de ta réplique", support: "full", voiceHint: "",
    promptExtra: "Utilise l'arabe standard moderne (fusha) en écriture arabe. Pour les débutants, ajoute la voyellation (tachkil) sur les mots difficiles.",
    scenarios: [
      { id: "ahwa", label: "🌍 Au café (ahwa) du Caire", prompt: "Jeu de rôle : un café populaire du Caire : thé à la menthe, café turc, chicha, backgammon, conversation de quartier." },
      { id: "khan", label: "🌍 Souk Khan el-Khalili", prompt: "Jeu de rôle : marchander un souvenir au Khan el-Khalili : prix de départ exagéré, contre-offres, thé offert, l'art de la négociation avec le sourire." },
      { id: "iftar", label: "🌍 Invitation à un iftar", prompt: "Jeu de rôle : l'élève est invité à un iftar pendant ramadan : salutations d'usage, plats servis, coutumes de la table, remerciements." },
    ],
  },
  tunisien: {
    label: "Tunisien (derja)", langFr: "le tunisien (derja)",
    tutor: { name: "Selma", city: "Tunis", f: true },
    stt: "ar-TN", ttsPrefixes: ["ar"],
    // rtl, reading et promptExtra sont résolus selon l'écriture choisie (langConfig).
    rtl: true, reading: null, support: "partial",
    supportNote: "La derja n'a pas de moteur vocal dédié : la reconnaissance passe par l'arabe (approximative pour le dialecte) et la voix de synthèse est en arabe standard. La conversation écrite, elle, est pleinement en tunisien.",
    voiceHint: "Voix arabe standard utilisée (pas de voix tunisienne existante).",
    promptExtraBase: "Tu parles le tunisien (derja), PAS l'arabe standard : vocabulaire et tournures typiquement tunisiens. Les transcriptions vocales de l'élève arrivent souvent déformées vers l'arabe standard : interprète avec bienveillance.",
    scenarios: [
      { id: "medina", label: "🌍 Dans la médina de Tunis", prompt: "Jeu de rôle : les souks de la médina de Tunis : chercher un artisan, marchander en derja, souffler autour d'un thé aux pins." },
      { id: "cafetn", label: "🌍 Au café tunisois", prompt: "Jeu de rôle : un café de quartier à Tunis : commander un direct ou un capucin, discussions foot et famille, expressions typiquement tunisoises." },
      { id: "mariage", label: "🌍 Un mariage tunisien", prompt: "Jeu de rôle : l'élève est invité à un mariage tunisien : les étapes de la fête, le henné, les tenues, présenter ses félicitations en derja." },
    ],
  },
};

export const BASE_SCENARIOS = [
  ["libre", "Conversation libre"],
  ["cafe", "Au café / restaurant"],
  ["marche", "Au marché"],
  ["directions", "Demander son chemin"],
  ["presentations", "Se présenter / rencontres"],
  ["voyage", "Voyage"],
  ["travail", "Au travail"],
];

// Résout la configuration effective (gère la double écriture du tunisien).
export function langConfig(langId, tnScript = "arabe") {
  const base = LANGUAGES[langId];
  if (langId !== "tunisien") return base;
  const arabicScript = tnScript === "arabe";
  return {
    ...base,
    rtl: arabicScript,
    reading: arabicScript
      ? "la version arabizi (alphabet latin, chiffres 3/7/9 pour les sons arabes) de ta réplique"
      : null,
    promptExtra: base.promptExtraBase + (arabicScript
      ? " Écris tes répliques en écriture arabe."
      : " Écris tes répliques en arabizi : alphabet latin avec les chiffres usuels (3 pour ع, 7 pour ح, 9 pour ق…)."),
  };
}
