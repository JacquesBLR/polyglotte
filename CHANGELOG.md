# Changelog

Tous les changements notables de ce projet sont consignés ici.
Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) — versionnage
[sémantique](https://semver.org/lang/fr/). Les tags git correspondants sont posés via les
Releases GitHub (commit de chaque version indiqué ci-dessous).

## [2.0.0-beta.37] — 2026-10-12

### Added
- **Parcours guidé** (#111) : un programme de 30 leçons, de A1 à C1 (6 par niveau CECRL),
  commun aux 10 langues et ancré dans la ville du tuteur. L'élève n'avait jusqu'ici qu'un
  choix de scénarios, sans rien qui dise quoi travailler ensuite ni ce qui était couvert.
  C'est ce qu'organisent les produits de référence : Babbel en cours par niveau (objectif
  communicatif, grammaire, lexique), Duolingo en chemin d'unités alignées sur le CECRL,
  Speak en curriculum dont chaque leçon finit par une conversation guidée avec le tuteur IA.
  Chaque leçon déclare trois **objectifs « je peux »**, tirés des descripteurs du CECRL :
  ce sont les **missions** de la séance (#91), fixées par l'app avant le premier tour et
  cochées par le tuteur. Elle déclare aussi un point de grammaire, que le tuteur transpose
  à la langue, un lexique et une situation. Une leçon est **validée** quand ses trois missions
  sont cochées. C'est calculé depuis l'historique, par langue (entrée `lecon`), sans rien
  stocker de plus. L'accueil affiche l'avancement du niveau et la prochaine leçon ; l'écran
  « 📚 Parcours » liste le programme avec ce qui est validé. Rien n'est verrouillé.
  Vérifié via gw : *Commander à boire et à manger* en espagnol valide 3/3 missions en
  3 répliques qui les accomplissent, et 0/3 sur 3 répliques hors sujet ; *Donner son avis*
  en japonais (B1) valide 3/3. Rendu de l'accueil et du programme contrôlé au navigateur
  (Chromium, 420 px).

## [2.0.0-beta.36] — 2026-10-12

### Changed
- **Résumé de séance allégé en alphabet latin** (dernier discutable de #107) : comme le
  schéma du tour depuis #103, le schéma du résumé ne déclare plus le `reading` du
  vocabulaire quand la langue n'a pas de translittération. Ses 0 à 8 entrées portaient
  chacune un `"reading":null` que le modèle devait écrire pour rien (environ 5 jetons
  par mot, jusqu’à ~40 jetons, ~3 s au rythme du résident). Japonais, arabe et tunisien en écriture
  arabe gardent le champ. Le banc de latence suit le même schéma. Mesuré via gw (espagnol,
  2 résumés avant, 2 après) : 440/441 jetons avant, 536/349 après — l'écart est dans le bruit
  de la longueur du bilan, le gain est structurel et ne se lit pas sur deux essais.

## [2.0.0-beta.35] — 2026-10-12

### Fixed
Deux discutables de la relecture du soir (#110) dont la correction ne demandait pas de
choix, chacun avec un test (`tests/relecture-soir-110.test.mjs`) :
- **D2, principe du test de niveau** : la consigne demandait au modèle d'expliquer le test
  « en UNE phrase en français » dans `reply`, qui doit pourtant être écrite dans
  l'écriture de la langue ; en japonais et en arabe, il l'omettait toujours (9/9 via gw),
  et le débutant n'avait jamais l'explication. L'app affiche désormais elle-même le
  principe, en français, avant la première question (texte fixe : toujours là, sans jeton
  de plus) ; le modèle pose directement sa question.
- **D3, latence de la relance d'écriture** : quand le contrôle d'écriture (#107) relançait
  le tuteur, la sonde chronométrait avant la relance et ne voyait qu'un appel sur les deux
  que l'élève attendait. La mesure est prise après la relance, marquée `relance`, et
  l'écran Progrès compte les tours réécrits.

Restent à Jacques : D1 (portée du filet du personnage mystère) et D4 (traduction sortie en
anglais, écart du modèle non reproduit).

## [2.0.0-beta.34] — 2026-10-12

### Fixed
Discutables de la relecture du 12/10 (#107) qui étaient des défauts, chacun avec un test
(`tests/relecture-2026-10-12-c.test.mjs`, rouge sur 2.0.0-beta.33) :
- **Appels en échec invisibles** : la sonde de latence ne chronométrait que les succès ; un
  serveur qui coupe ne laissait aucune trace. Chaque échec (coupé par le plafond, connexion
  coupée, serveur injoignable, erreur du serveur, réponse illisible ou vide) est journalisé
  avec son type et sa durée jusqu'à l'échec ; Progrès affiche le **taux d'échec** par nature
  d'appel. Les temps médians ne portent que sur les succès. Un flux coupé en cours de
  réponse lève désormais un message en français au lieu de l'erreur brute du moteur JS.
- **Tunisien en arabizi malgré l'écriture arabe** : reproduit via gw (1 [START] sur 12
  entièrement en arabizi, 1 tour mêlé de latin). Le guide derja montrait les graphies
  arabizi aussi en écriture arabe ; elles ne sont plus données qu'en mode arabizi, et la
  consigne d'écriture est durcie (« jamais en arabizi, même si l'élève écrit en arabizi »),
  y compris dans la règle de `reply`. Après : 0 sur 12. Et un **contrôle d'écriture** par
  langue (latin, arabe, japonais) vérifie chaque réplique ; hors écriture, le tuteur est
  relancé **une fois** (4 relances réelles sur 4 rendues en écriture arabe).
- **Médiane basse** : sur un nombre pair de mesures, la médiane prenait la valeur basse et
  minimisait la lenteur affichée ; c'est maintenant la moyenne des deux valeurs centrales.
- **E4** : un [START] en échec suivi d'un message de l'élève laissait les erreurs injectées
  non marquées « réactivées » ; elles le sont au premier tour réussi de la séance.
- **Alerte du résumé** : 59,95 s s'affichait « 60 s » sans alerte au seuil de 60 s ; le
  seuil se compare au dixième de seconde affiché.

Reste à Jacques (#107) : `SUMMARY_SCHEMA` non allégé (quelques jetons, pas un défaut).

## [2.0.0-beta.33] — 2026-10-12

### Fixed
Défauts confirmés par la relecture adverse de #99, #100, #102 et #104 (#107), chacun avec un
test de reproduction (`tests/relecture-2026-10-12-b.test.mjs`, rouge sur l'ancien code) :
- **T1** : une réponse **coupée par le plafond de jetons** n'était repérée que vide : en
  streaming, la réplique déjà dite disparaissait, la voix continuait, et l'élève lisait « pas
  de JSON » ou un message du moteur JS en anglais. Le streaming, `callLocal` et `callClaude`
  lèvent désormais une erreur « coupée avant la fin — réessaie » ; la voix est arrêtée ; un
  JSON invalide est signalé en français.
- **T2** : sous Claude, un résumé coupé (`stop_reason: max_tokens`) s'affichait en **JSON
  brut** comme bilan.
- **T3** : un résumé en échec vidait quand même l'historique — ✅ ramenait à l'accueil et le
  bilan était perdu. L'historique n'est vidé qu'en cas de succès (✅ relance le résumé) ;
  coupé après un bilan lisible complet, ce bilan reste affiché, sans verser carnets ni niveau.
- **X1** : deux fautes de même forme corrigée (« Jo vol un cafè », « Jo vull una cafè »)
  partageaient une explication ; elle est liée aussi à la phrase fautive.
- **L1** : les tours du test de niveau, non streamés, faussaient la médiane du « premier
  mot » ; ils ont leur nature (`evaluation`), et le premier mot ne compte que les appels
  streamés.
- **M5** : la description du champ `missions` disait « [START] uniquement » alors que le
  champ sert au rattrapage (#101, M3) ; et le modèle ne peut pas savoir qu'il n'a rien
  annoncé. L'app le lui dit : rattrapage au tour 2 mesuré via gw **2/4 → 4/4**.
- **P6b** : drapeaux et touches numérotées n'étaient pas retirés de la phrase à répéter
  (« Visca Catalunya 🇪🇸! » parfaitement dit → 67 au lieu de 100).

Restent à Jacques (discutables, #107) : réplique tunisienne en arabizi malgré l'écriture
arabe, appels en échec absents de la sonde, médiane basse sur un nombre pair, E4 après un
[START] en échec, arrondi de l'alerte du résumé, `SUMMARY_SCHEMA` non allégé.

## [2.0.0-beta.32] — 2026-10-12

### Added
- 🕵️ **Personnage mystère** (#105) : un scénario où le tuteur joue un personnage dont le
  **métier est secret**, que l'élève doit découvrir en le questionnant dans la langue cible.
  Tous les autres scénarios sont des jeux de rôle où chacun sait tout ; ici, c'est
  l'information manquante qui oblige à poser des questions, vérifier, reformuler — la tâche à
  écart d'information (Doughty & Pica, *TESOL Quarterly* 20(2), 1986 ; Prabhu, 1987), moteur
  de l'hypothèse de l'interaction (Long, 1996). Les jeux de rôle de Speak ou Duolingo Max
  affichent leur objectif ; aucun ne le cache.
  - le secret est **tiré par l'app** (12 métiers, 6 proposés) et n'entre que dans le prompt
    système ; après 2 questions, « Je devine » propose les 6 métiers et la vérification est
    **locale**, sans appel au modèle ; le prompt est ensuite reconstruit pour que le tuteur
    parle librement de son métier ;
  - consigne graduée par niveau (questions fermées et indices concrets au débutant, indices
    indirects à l'avancé) ; pas de missions dans ce scénario (ni au prompt ni au schéma :
    `schemaTour({ missions: false })`) ;
  - filet de sécurité : un métier échappé dans les champs en français (traduction,
    suggestions, vocabulaire) est masqué ou retiré avant affichage ;
  - historique `mystere: { metier, trouve, questions }`, tuile « personnages devinés » et
    détail par séance dans Progrès.
- **Vérifié** : 3 parties réelles via gw (catalan débutant, japonais intermédiaire, espagnol
  avancé ; 15 tours) — le tuteur n'a jamais nommé son métier dans sa réplique, une fuite dans
  le vocabulaire (« 先生 = professeur, docteur ») a été retirée par le filet ; partie complète
  jouée dans l'app web construite (Chromium headless) jusqu'à la révélation.

## [2.0.0-beta.31] — 2026-10-12

### Changed
- ⚡ **Un tour de conversation plus court** (#103). Le banc de la beta.29 le montrait : le
  premier mot arrive vite (~1 s), c'est la **longueur** de la sortie qui coûte — le résident
  vLLM décode ~11 à 15 jetons/s. Sondé ce matin : le schéma strict imposait à chaque tour des
  clés vides (`"reading":null` en langue latine, `"missions":[]` après le premier tour, que le
  modèle remplissait parfois de missions réinventées) et le modèle indentait son JSON (le
  premier tour : 173 à 250 jetons indentés, 132 à 171 minifiés). Désormais :
  - le schéma du tour ne déclare que les champs qui peuvent y servir (`schemaTour`) :
    `reading` seulement pour une écriture non latine, ni `correction` ni `cultural_note` en
    immersion (toujours null par consigne), `missions` tant qu'aucune n'est annoncée,
    `missions_accomplies` seulement quand il y a des missions à cocher. **Aucun champ
    pédagogique retiré** : traduction, correction, suggestions, vocabulaire et note
    culturelle restent à chaque tour ;
  - le système demande un JSON **minifié** (l'option `disable_any_whitespace` de vLLM 0.27,
    essayée, est restée sans effet) ;
  - `max_tokens` par nature d'appel au lieu de 2 048 partout : tour 700, test de niveau 500,
    résumé 1 600, explication 700 — trois fois au moins le plus long mesuré ; ils bornent un
    décodage qui s'emballe, sans raccourcir une réponse normale.
- **Mesure avant/après**, 2 × 10 tours réels alternés via gw (`X-Atelier-Backend: vllm`,
  `X-Atelier-Projet: polyglotte`), mêmes répliques d'élève : médiane par tour **18,2 s →
  14,6 s** (−20 %), jetons par tour 217 → 162 (−25 %), réplique complète 4,8 s → 4,2 s, 40 tours
  sur 40 en JSON valide. Le débit du résident était bas pendant la mesure (11,5 jetons/s,
  autres agents en charge) : le gain relatif est le chiffre à retenir.
- 📋 **Résumé de séance en streaming** : le bilan lisible s'affiche au fil de l'eau (complet
  en 14 à 30 s) au lieu de 45 à 55 s d'écran figé ; carnets et niveau observé sont versés une
  fois la réponse complète.
- ⏱️ Le journal de latence note aussi l'instant où la **réplique** (ou le texte du résumé) est
  complète — ce que l'élève attend vraiment, la traduction et les suggestions arrivant pendant
  qu'il l'écoute ; médiane dans les statistiques, et dans la ligne `[latence]` de la console.
- `scripts/banc-latence.mjs` rejoue désormais les tours comme l'app (schéma allégé, plafonds,
  missions réinjectées, résumé streamé) et compte les jetons ; `--schema complet` rejoue la
  requête d'avant pour comparer dans les mêmes conditions de charge.

### Added
- 🌙 `.github/workflows/banc-latence.yml` : le banc chaque nuit (04:10), ligne JSON gardée en
  artefact 90 jours, job rouge si la médiane du premier jeton dépasse le seuil d'alerte.
  **Désarmé** : il lui faut un runner self-hosted propre au dépôt sur le DGX (label `dgx`, gw
  n'est joignable que de là), et la variable `BANC_LATENCE_ARME=true` ; d'ici là le job est
  « skipped ». Un contrôle de cohérence vérifie que la garde reste en place.

### Fixed
Points « discutables » de la relecture du 12/10 (#101) dont la correction ne demandait aucun
choix pédagogique :
- **E4** : les erreurs du carnet ne sont marquées « réactivées » qu'une fois le premier tour
  réussi — un [START] en échec les écartait une journée sans qu'elles aient servi
- **M3** : si le modèle n'annonce aucune mission au premier tour, elles sont redemandées au
  tour suivant au lieu de ne jamais venir
- **M4** : la tuile comptait des séances, pas des missions : « scénarios réussis »
- **I2** : l'écran Progrès relisait tout le stockage à chaque re-rendu de l'app
- **P6 (en partie)** : un emoji de la réplique n'est plus un « mot » impossible à prononcer.
  Restent à Jacques : R5, O3, P6 (chiffres en lettres, accents), I1

## [2.0.0-beta.30] — 2026-10-12

### Fixed
Défauts confirmés par la relecture adverse des cinq PR de la nuit (#101), chacun reproduit
par un test (`tests/relecture-2026-10-12.test.mjs`, rouge avant, vert après).
- 🗣️ **Répète après moi** : la ponctuation arabe (، ؛ ؟), le tatweel et les crochets
  japonais (『』〜) faisaient rater des mots bien prononcés — une phrase tunisienne parfaite
  plafonnait à 60 %. En tunisien arabizi, la reconnaissance rend de l'écriture arabe qu'on ne
  peut pas aligner sur une réplique en alphabet latin : chaque essai valait 0 et faussait la
  moyenne ; le bouton est retiré dans ce cas. La moyenne de séance dérivait par arrondis
  cumulés (100 puis neuf fois 99 donnait 100) : la somme exacte est conservée. Une
  reconnaissance muette ne lève plus d'exception, et le micro de conversation ne peut plus
  s'ouvrir pendant une répétition — la phrase répétée serait partie au tuteur
- 🩹 **Carnet d'erreurs** : une erreur due échappait au délai d'un jour, si bien que les
  trois mêmes revenaient à chaque séance et que les suivantes ne passaient jamais ; le
  délai vaut désormais pour toutes. Le dédoublonnage ignore la ponctuation (« Bon dia! »
  relevé en conversation et « Bon dia » repris par le résumé ne font plus deux cartes, comme
  la beta.26 le promettait) ; une correction mal typée ne lève plus dans le vide
- 🎯 **Objectif hebdomadaire** : une séance ouverte puis quittée sans que l'élève ait parlé
  comptait comme un jour pratiqué ; dans les fuseaux où minuit saute au changement d'heure
  (Santiago, Beyrouth), le lundi perdait ses séances entre 0 h et 1 h
- 📋 **Résumé** : la tendance du niveau observé mêlait les langues (catalan B2 puis japonais
  A1 annonçait « une séance plus difficile ») — elle suit la langue de la dernière séance ;
  un JSON sans texte n'est plus montré brut ; la troncature du bilan ne coupe plus un emoji
- 🎭 **Missions** : les missions identiques sont dédoublonnées, et le prompt borne les
  numéros au nombre réellement annoncé
- « Explique-moi » (#97) partage la clé de dédoublonnage du carnet, pour retrouver son
  entrée quand la ponctuation diffère

## [2.0.0-beta.29] — 2026-10-12

### Added
- ⏱️ **Sonde de latence du tuteur** (#98). La nuit du 11 au 12 octobre a vu ~13 s par
  tour et 36 s pour le résumé, sans que l'app le mesure ni le dise : l'élève attendait sans
  savoir si le tuteur réfléchissait ou si c'était cassé. Chaque appel au modèle (tour de
  conversation, résumé, explication) est désormais chronométré : **temps au premier jeton**
  (premier fragment de texte reçu en streaming ; égal au total sinon) et **temps total**,
  écrits en une ligne `[latence]` dans la console et dans un journal local des 50 dernières
  mesures, par profil
- Au-delà d'un seuil, la barre d'état prévient : « 🐢 Le tuteur est lent (premier mot après
  7,3 s)… ». Seuils calés au-dessus de l'ordinaire mesuré, pour signaler un serveur
  anormalement lent et pas le quotidien : en conversation 6 s au premier jeton ou 35 s au
  total, 60 s pour le résumé, 35 s pour une explication. L'écran Progrès donne, par nature
  d'appel, la médiane, le 90ᵉ centile et le nombre d'appels lents (`app/core/latence.js`,
  pur, testé)
- `scripts/banc-latence.mjs` : banc **proposé, non activé**, qui rejoue quatre tours et un
  résumé tels que l'app les envoie, contre `gw` (`X-Atelier-Backend: vllm`,
  `X-Atelier-Projet: polyglotte`), et imprime une ligne JSON. Premier passage, ce matin
  après le redémarrage du DGX : premier jeton ~1,1 s, tours de 16 à 26 s (médiane 21 s),
  résumé 42 s — le premier mot arrive vite, mais un tour complet est plus lent que cette
  nuit. Le timer nocturne qui l'exécuterait est décrit en tête du script, rien n'est
  installé

## [2.0.0-beta.28] — 2026-10-12

### Added
- 💡 **« Explique-moi »** (#97). Une correction du tuteur tenait en une ligne
  (« accord du verbe ») : l'élève qui ne comprenait pas pourquoi n'avait d'autre recours
  qu'interrompre la conversation. Chaque correction porte désormais un bouton 💡
  Explique-moi : la règle en quelques mots, une explication de trois phrases au plus **au
  niveau CECRL de la séance** (A1–A2, B1–B2, C1), un exemple correct en langue cible avec sa
  traduction et un contre-exemple qui dit pourquoi la forme fautive ne convient pas — comme
  l'*Explain my answer* de Duolingo Max
- Le schéma `EXPLAIN_SCHEMA` dérive de `GRAMMAR_FICHE_SCHEMA` (même titre, même contenu,
  plus `exemple` et `contre_exemple`) et la requête reprend le système des fiches de
  grammaire : même professeur, même niveau. L'explication est consignée dans l'entrée du
  carnet d'erreurs, réaffichée en révision et dans l'écran Progrès, et n'est pas redemandée
  au modèle tant que le niveau ne change pas. Un modèle qui ne tient pas le schéma ne casse
  rien : message d'erreur, correction intacte, on peut réessayer (`app/core/explique.js`,
  pur, testé)

## [2.0.0-beta.27] — 2026-10-12

### Added
- 🗣️ **« Répète après moi »** (#95). Le retour sur la prononciation n'existait que dans
  l'écran Exercices ; en conversation, le cœur du produit, l'élève pouvait réécouter une
  réplique mais pas la répéter en sachant ce qui avait été compris. Chaque bulle du tuteur
  a désormais un bouton 🎤 Répéter : la reconnaissance vocale de la langue cible écoute,
  l'alignement mot à mot de `diff.js` colore les mots reconnus et manqués, affiche le
  score, l'appréciation et ce qui a été entendu, et l'on réessaie — comme la répétition des
  répliques chez Speak et le *pronunciation feedback* de Praktika
- Rien n'est envoyé au tuteur : le recognizer de répétition est distinct de celui de la
  conversation et jeté après l'essai. Les scores d'une séance sont agrégés dans son entrée
  d'historique (`prononciation {n, moyenne, meilleur}`) ; l'écran Progrès affiche la
  moyenne des cinq dernières séances mesurées et celle de chaque séance. Tout est local,
  sans appel au modèle (`app/core/prononciation.js`, pur, testé)

## [2.0.0-beta.26] — 2026-10-12

### Added
- 📋 **Résumé de séance structuré** (#93). Le bilan de fin de session était un texte libre,
  affiché une fois puis perdu : il ne se relisait pas et ce qu'il relevait n'allait nulle
  part — en immersion, où aucune correction ne s'affiche, le carnet d'erreurs restait vide.
  Le résumé arrive désormais structuré (`SUMMARY_SCHEMA`) : texte lisible inchangé, points
  forts, erreurs, vocabulaire, phrases à réviser, conseil pour la prochaine fois et **niveau
  CECRL observé** pendant la séance (pas le réglage). Comme le *lesson report* de Praktika
  et le *session summary* de Speak
- Ses erreurs et son vocabulaire sont versés aux carnets existants, avec leurs
  dédoublonnages (une erreur déjà relevée en conversation n'est pas doublée) ; le bilan et
  le niveau observé sont conservés dans l'entrée d'historique de la séance
- Écran Progrès : section « Dernières séances » (date, langue, scénario, tours, missions,
  niveau observé), chaque bilan dépliable, et la tendance du niveau observé sur les
  dernières séances évaluées (A2 → B1 : « ça monte »)
- Un modèle qui ne tiendrait pas le schéma rend au pire un texte : il est affiché tel
  quel, rien d'autre ne casse (`app/core/resume.js`, pur, testé)

## [2.0.0-beta.25] — 2026-10-12

### Added
- 🎭 **Missions de scénario** (#91). Un scénario donnait un décor au tuteur, pas de but à
  l'élève : il répondait aux questions jusqu'à décider d'arrêter, sans savoir ce qu'il
  devait réussir ni s'il y était arrivé. Le tuteur propose désormais **trois missions** au
  premier tour, en français, graduées au niveau (A1–A2 : saluer, commander, demander un
  prix ; B1–B2 : se renseigner, négocier, expliquer un problème ; C1 : convaincre, nuancer,
  plaisanter), affichées en bandeau sous l'en-tête et cochées au fil des tours. Toutes
  accomplies : le tuteur félicite et propose de conclure. Même mécanique que les objectifs
  des *Roleplays* de Speak, le but affiché du *Roleplay* de Duolingo Max et les *scenario
  goals* de Praktika
- `RESPONSE_SCHEMA` gagne `missions` et `missions_accomplies`, placés en fin de schéma pour
  que le streaming phrase par phrase continue de lire `reply` en tête. `app/core/mission.js`
  (pur) valide et cumule ce que le modèle déclare : identifiants hors bornes ignorés, une
  mission cochée ne se décoche jamais, aucune réussite jugée par l'app elle-même
- L'historique note le total et le nombre de missions accomplies par session ; l'écran
  Progrès compte les « missions accomplies »

## [2.0.0-beta.24] — 2026-10-12

### Added
- 🎯 **Objectif hebdomadaire** (#89). L'écran Progrès comptait les sessions et la série de
  jours d'affilée — une série se casse au premier jour manqué et ne dit rien de l'intention.
  L'élève choisit désormais dans ⚙️ un nombre de jours de pratique par semaine (3, 4, 5 ou
  7 ; défaut 4), et une carte « Cette semaine » ouvre l'écran Progrès : frise lundi →
  dimanche, « 2 / 4 jours », minutes de la semaine, semaines tenues d'affilée, et un message
  accordé (il reste n jours ; objectif atteint ; plus assez de jours, on repart lundi).
  Même mécanique que l'objectif en jours de Speak et la frise hebdomadaire de Duolingo
- Tout est calculé depuis l'historique des sessions (`app/core/objectif.js`, pur) : une
  session compte pour le jour où elle a commencé, la semaine en cours n'est jamais comptée
  contre l'élève tant qu'elle n'est pas finie, et les dates sont lues en heure locale —
  les tests construisent les leurs de même, pour ne pas dépendre du fuseau de la machine
- Le réglage est un nouveau champ de `DEFAULT_SETTINGS`, garni par la fusion existante :
  aucune migration

## [2.0.0-beta.23] — 2026-10-12

### Added
- 🩹 **Carnet d'erreurs** (#87). Une correction du tuteur ne vivait qu'un tour dans la bulle,
  puis disparaissait avec la session : l'élève refaisait la même faute à la séance suivante
  et le tuteur la corrigeait comme si c'était la première fois. Chaque correction reçue en
  conversation devient une carte FSRS (une par langue et par forme corrigée), révisable
  depuis l'écran Progrès : la phrase fautive est montrée, l'élève formule la correction, on
  révèle la forme correcte et l'explication, puis note ❌ 😅 ✅ 🚀 comme pour le vocabulaire
- Les erreurs les plus fragiles (dues, puis les plus souvent ratées, trois au plus) entrent
  dans le prompt de la séance suivante dans la même langue : le tuteur amène une situation
  où la forme correcte est utile, sans les annoncer ni les lister — ce que font Speak
  (*Review*), Praktika (*Mistakes*) et Loora. Une langue sans erreur garde un prompt
  strictement identique (testé)
- Le carnet d'erreurs est une clé de stockage par profil, purgée avec le profil

## [2.0.0-beta.22] — 2026-10-11

### Changed
- 🇹🇳 **Le tunisien du tuteur est ancré dans un corpus** (#85). « La voix est correcte mais
  a priori ce n'est pas du tunisien » : le défaut était dans le texte. La consigne se
  résumait à « parle tunisien, pas arabe standard », et le modèle écrivait un arabe
  maghrébin moyen dérivant vers l'ouest — relevé `أتاي` (le thé, forme marocaine) et `كيف`
  au lieu de `كيفاش`
- `app/core/derja.js` ajoute au prompt du seul tunisien les oppositions de formes
  (برشا/بزاف, قداش/شحال, توة/دابا, متاع/ديال, نحب/بغيت, هاذا/هاد), leurs équivalents
  arabizi, et trois phrases **citées** du corpus `fbougares/TUNIFRA` — 1 950 phrases de
  radio tunisienne alignées au français, celui dont vient déjà l'extrait de référence de la
  voix. Chaque opposition est comptée dans le corpus, pas devinée : برشا 158 contre بزاف 0,
  متاع 287 contre ديال 0, توة 77 contre دابا 0

## [2.0.0-beta.21] — 2026-10-11

### Fixed
- 💬 **Le message de l'élève disparaissait dès que le tuteur commençait à répondre** (#83).
  Le retrait du message provisoire du streaming dépendait d'un drapeau extérieur
  (`streamed`) lu **à l'intérieur** de la fonction de mise à jour : React l'exécute au
  rendu suivant quand une mise à jour est déjà en attente, donc après que le drapeau est
  passé à `true`. Le `slice(0, -1)` retirait alors la bulle de l'élève au lieu du provisoire
- Le message provisoire est désormais reconnu à son propre drapeau `streaming`, dans la
  liste (`retireProvisoire`) : l'opération ne dépend plus de l'ordre d'exécution ni du lot
  dans lequel React la range. Testée dans les deux ordres, avec l'ancien comportement
  documenté en régression
- Même ternaire dans le `catch` : une erreur survenant après l'affichage de la réponse
  définitive (enregistrement du tour, paquet de vocabulaire) effaçait cette réponse

## [2.0.0-beta.20] — 2026-10-11

### Fixed
- 🔉 **Voix tunisienne saccadée** (#81), deux causes mesurées et indépendantes
- F5-TTS rendait 0,5 à 1,25 s de silence avant la parole et ~0,3 s après. La lecture se
  faisant phrase par phrase, ces silences s'additionnaient : 1,33 s puis 1,43 s de vide au
  milieu d'une réplique de trois phrases. `derja.py` les rogne désormais à la source —
  mesuré à moins de 50 ms sur cinq tirages, l'attaque survivant au contrôle par Whisper
- Une phrase courte ne produisait **rien** : `أهلا بيك!` (9 caractères) rendait 0,74 s de
  silence numérique, crête à -90 dB. Le rendu muet est rejoué une fois, puis refusé en 503,
  et le serveur vocal retombe sur Piper (vérifié : 22 050 Hz au lieu de 24 000)
- L'app ne lui envoie plus de fragments : le tunisien déclare `voixMinCar: 60`, et
  `createSentenceStreamer` regroupe les phrases complètes jusqu'à cette taille avant de
  synthétiser. Les autres langues, dont la synthèse encaisse une phrase courte, gardent le
  comportement actuel (`minChars` à 0)

## [2.0.0-beta.19] — 2026-10-11

### Changed
- 🔊 **Le catalan est désormais lu par la voix du serveur vocal** (#79). iOS installe par
  défaut une voix catalane « compacte », au grain très audible ; la voix Piper
  `ca_ES-upc_ona-medium` du serveur (22 kHz) est nettement plus propre, et répond en 0,12 s
- Nouvel attribut de langue `voixServeur`, distinct de `support` : il ne gouverne que la
  synthèse. Déclarer le catalan `support: "partial"` aurait aussi routé le micro vers
  Whisper et affiché un avertissement, alors que sa reconnaissance vocale navigateur est
  excellente
- Repli inchangé sur la voix du navigateur quand le serveur est injoignable, mais signalé
  une fois à l'élève : la dégradation s'entend, autant la nommer

## [2.0.0-beta.18] — 2026-10-11

### Fixed
- 🔇 **L'audio du serveur vocal n'était jamais audible sur iPhone** (#77). Il arrivait
  pourtant : le serveur journalise les requêtes de l'appareil en 200 OK, avec le bon texte.
  `pumpRemote()` créait un `new Audio(url)` à chaque réplique ; Safari iOS n'autorise la
  lecture que sur un élément débloqué par un geste utilisateur, et rejetait donc chaque
  `play()`. L'échec partait dans le repli — voix du navigateur, ou silence si aucune voix
  n'était chargée
- Un élément audio unique est désormais amorcé dans le geste qui lance la conversation,
  puis réutilisé pour toutes les lectures : iOS retient le déblocage par élément, pas pour
  la page. Le bouton de relecture d'une réplique amorce aussi, étant lui-même un geste
- Ce défaut existait depuis l'arrivée du serveur vocal : il ne touchait que les langues au
  support partiel, jamais utilisées jusqu'ici

### Changed
- Cache du service worker v2 en `polyglotte-v2-shell-2.0.0-beta.18`

## [2.0.0-beta.17] — 2026-10-11

### Fixed
- 🔈 **Le repli de la synthèse était silencieux** (#75). Quand l'appel au serveur vocal
  échoue — appareil hors du réseau privé, serveur arrêté, erreur réseau — la réplique est
  lue par une voix du navigateur sans que rien ne le signale. Pour une langue au support
  partiel, cette voix est dans une tout autre variante : sur iPhone, le tunisien était lu
  par la voix arabe standard du système. Rien ne distinguait, à l'oreille, « le serveur a
  parlé » de « le serveur n'a jamais répondu ». L'app le dit maintenant, une fois, en
  nommant la langue dont la voix de secours s'écarte
- **🎙️ Tester le serveur vocal** indique si la voix tunisienne est active : un coup d'œil
  aux réglages répond désormais à la question

### Changed
- Le canal d'avis de la couche vocale s'appelle `onAvis` et non plus `onMuet` : il ne
  porte plus seulement le silence
- Cache du service worker v2 en `polyglotte-v2-shell-2.0.0-beta.17`

## [2.0.0-beta.16] — 2026-10-11

### Fixed
- 🇹🇳 **La voix tunisienne était masculine** (#73), alors que la tutrice annoncée est
  Selma. `telecharge-derja.sh` choisissait l'extrait de référence à la hauteur médiane la
  plus élevée ; sur de la parole de podcast, le suivi de hauteur verrouille souvent une
  harmonique au lieu du fondamental, et mesurait un homme à 220 Hz. Le critère retenait
  donc préférentiellement les voix masculines — l'inverse du but
- Le genre est désormais établi par un classifieur, **validé au préalable sur les voix
  Piper de genre connu** ; le script s'arrête s'il se trompe sur l'une d'elles. Mieux vaut
  pas d'extrait qu'un extrait choisi au hasard
- La recherche porte sur la partie entraînement du corpus : les parties de test et de
  validation ne contiennent qu'un épisode de podcast chacune, sans aucune voix féminine

## [2.0.0-beta.15] — 2026-10-11

### Added
- 🇹🇳 **Voix tunisienne pour le tuteur** (#71). La derja était lue par la seule voix arabe
  de Piper, jordanienne et masculine. `serveur-vocal/derja.py` synthétise désormais en
  tunisien avec `Ghazouaniwala/silma-tts-derja` (fine-tune F5-TTS), dans un service et un
  environnement Python séparés — la pile pèse plusieurs gigaoctets, que le serveur vocal
  n'a pas à porter. Mesuré sur le GPU : ~7 s à la première réplique, **~0,7 s** ensuite
- Repli automatique vérifié : service arrêté, la réplique repart par la voix arabe de
  Piper en 0,1 s. Une voix au mauvais accent vaut mieux que le silence
- `telecharge-derja.sh` : environnement, modèle et extrait de référence. F5-TTS calque sa
  prosodie sur un extrait ; celui livré avec le modèle est en anglais, ce que sa fiche
  donne pour sa faiblesse principale. Le script en choisit un tunisien, voix féminine —
  la tutrice annoncée est Selma

### Changed
- La fiche du tunisien dit la nouvelle situation : synthèse tunisienne par le serveur
  vocal, voix jordanienne en repli
- Cache du service worker v2 en `polyglotte-v2-shell-2.0.0-beta.15`

## [2.0.0-beta.14] — 2026-10-11

### Fixed
- 🗣️ **La fiche du tunisien disait faux** (#69). Elle annonçait une voix de synthèse « en
  arabe standard » ; c'est en réalité la seule voix arabe publiée par Piper, **jordanienne
  et masculine**, alors que la tutrice annoncée est Selma. Le texte lu est bien du
  tunisien — l'accent ne l'est pas, et l'app le dit désormais. Entendre un accent qu'on ne
  reconnaît pas est déjà désagréable ; le découvrir en contradiction avec ce que l'app
  affirme l'est davantage

### Changed
- Cache du service worker v2 en `polyglotte-v2-shell-2.0.0-beta.14`

## [2.0.0-beta.13] — 2026-10-11

Le tuteur répondait à l'écran mais restait muet, sans la moindre erreur.

### Fixed
- 🔊 **Le tuteur se taisait sans le dire** (#67). La synthèse cherchait une voix du
  navigateur au moment de parler et, n'en trouvant aucune, rendait la main en silence. Or
  `getVoices()` est asynchrone, et sur iOS la liste reste vide tant que la synthèse n'a pas
  servi une première fois : « pas encore de voix » était traité comme « cet appareil ne
  parle pas »
- L'amorce de la synthèse prononce un énoncé réellement prononçable, à volume nul, au lieu
  d'une chaîne vide que le moteur peut ignorer — auquel cas la liste des voix ne se
  remplissait jamais
- À défaut de voix du navigateur, la réplique est lue par le serveur vocal du projet
  (Piper), où une voix catalane est installée
- Si plus rien n'est possible, l'app **le dit** — une fois, pas à chaque phrase

### Added
- `app/core/voix.js` : le choix du moteur de synthèse est une fonction pure, couverte par
  6 tests (68 au total), y compris le drapeau qui interdit l'aller-retour entre les deux
  moteurs quand chacun retombe sur l'autre

### Changed
- Cache du service worker v2 en `polyglotte-v2-shell-2.0.0-beta.13`

## [2.0.0-beta.12] — 2026-10-11

L'app installée sur l'écran d'accueil n'entendait rien : conversation lancée, micro actif,
aucune transcription, aucune erreur.

### Fixed
- 🎤 **Micro dans une app installée sur iPhone** (#65). WebKit **expose** la reconnaissance
  vocale en mode autonome mais ne transcrit jamais rien : l'objet existe, `start()` réussit,
  aucun résultat n'arrive — la détection de fonctionnalité ne peut pas voir le problème
  ([WebKit 225298](https://bugs.webkit.org/show_bug.cgi?id=225298)). Dans ce mode, la
  reconnaissance passe désormais par le serveur vocal du projet (Whisper), quelle que soit
  la langue. L'interaction y est « appuyer, parler, retoucher le micro » et non l'écoute
  continue
- Replis symétriques : à défaut du moteur préféré, l'autre est pris plutôt que rien
- Quand aucun moteur n'est utilisable, le message dit la cause et la sortie — ouvrir le site
  dans Safari ou renseigner le serveur vocal — au lieu de constater l'absence

### Added
- `app/core/micro.js` : le choix du moteur est une fonction pure, couverte par 7 tests
  (62 au total)

### Changed
- Cache du service worker v2 en `polyglotte-v2-shell-2.0.0-beta.12`

## [2.0.0-beta.11] — 2026-10-11

Installée sur l'écran d'accueil, la v2 passait sous la barre d'état : le titre était masqué
par l'heure et les boutons de l'en-tête ne répondaient plus, iOS réservant les appuis de
cette bande au système. Ni les réglages ni la sortie de conversation n'étaient atteignables.

### Fixed
- 📱 **Marges de sécurité des bords de l'écran** (#63). L'en-tête, la barre de saisie du chat
  et la feuille de réglages tiennent compte de `env(safe-area-inset-*)` sur le web. Les règles
  vivent dans le gabarit HTML, où `env()` a un sens, et sont rattachées aux vues par des
  attributs `data-*` ; le natif garde ses propres marges
- Le message « serveur injoignable » nomme la cause la plus fréquente — l'appareil n'est pas
  connecté au réseau privé du serveur — au lieu de renvoyer d'abord à l'URL, qui est juste

### Added
- Contrôle de cohérence en CI : chaque marqueur `data-*` posé en JS doit avoir sa règle dans
  le gabarit. En renommer un sans l'autre ne casse pas la construction mais désactivait
  silencieusement la protection

### Changed
- Cache du service worker v2 en `polyglotte-v2-shell-2.0.0-beta.11`

## [2.0.0-beta.10] — 2026-10-11

Rendre diagnosticable, et réparable sans perte de données, une installation restée sur une
version périmée — vécu sur l'iPhone, où rouvrir la PWA ne suffisait pas et où la seule issue
semblait être de supprimer l'app, donc d'effacer le carnet.

### Added
- 🔢 **Version affichée dans ⚙️** (#61), en pied de réglages. La v2 ne l'affichait nulle
  part : impossible de savoir si le code exécuté était celui qui venait d'être publié. Elle
  est injectée par `app.json` (`extra.version`) et **vérifiée en CI** comme identique à celle
  du `package.json` — un numéro affiché qui mentirait serait pire que pas de numéro
- 🔄 **Bouton « Forcer la mise à jour »** (web) : désinscrit les service workers, vide les
  caches et recharge, **sans toucher au stockage local**. Carnet de vocabulaire, historique et
  profils sont conservés — contrairement à l'effacement des données du site ou à la
  suppression de l'app, les deux seules voies qui existaient jusqu'ici

### Changed
- Au démarrage, l'app demande explicitement au navigateur de revérifier le service worker
  (`registration.update()`) : en mode autonome sur iOS, rouvrir l'app ne déclenche pas
  toujours ce contrôle, et une version publiée pouvait rester invisible
- Cache du service worker v2 en `polyglotte-v2-shell-2.0.0-beta.10`

## [2.0.0-beta.9] — 2026-10-11

« Ça marche tout de suite » : les deux obstacles qui séparaient encore l'ouverture de l'app
d'une conversation effective.

### Fixed
- 🔁 **Une version publiée arrive dès le premier rechargement** (#58) : le service worker
  servait le **document** depuis le cache, or c'est lui qui désigne le bundle JS haché. La
  version publiée n'arrivait donc qu'au rechargement suivant — et entre les deux, l'app se
  comportait comme la version précédente, ouvrant la page de réglages au lieu de démarrer une
  conversation. Le document passe en **réseau d'abord**, cache en secours hors ligne ; les
  actifs hachés, immuables, restent en cache d'abord
- 🌐 **Conversation possible depuis le web sur le moteur local** (#59) : la passerelle
  compatible OpenAI ne renvoie aucun en-tête CORS (préflight vérifié : `405`, aucun
  `Access-Control-*`), si bien que le navigateur bloquait chaque requête, réglages remplis ou
  non. Le serveur du projet relaie désormais `/v1/*` vers elle — il appartient au projet, est
  déjà exposé en HTTPS sur le tailnet, et porte déjà la politique CORS. Le flux est relayé
  octet par octet : le streaming SSE phrase par phrase (#43) est préservé, vérifié par un
  appel de bout en bout
- Les réglages déjà migrés en beta.8 retenaient l'URL de passerelle inappelable : le marqueur
  `defautsDgx` devient un **numéro de version** et une migration v2 la remplace par celle du
  relais. Une URL saisie à la main n'est jamais réécrite

### Changed
- 🔒 CORS du serveur vocal resserré : origines énumérées (GitHub Pages + `localhost`) au lieu
  de `*`. Depuis que ce serveur relaie le LLM, un CORS ouvert laisserait n'importe quelle page
  du navigateur consommer le moteur local
- `VOCAL_LLM_BASE` configure le relais, **sans valeur par défaut** : non renseignée, `/v1/*`
  répond `503` et le serveur reste purement vocal. `/health` expose `llm.relais`
- 4 tests de migration supplémentaires (55 au total)

## [2.0.0-beta.8] — 2026-10-11

### Fixed
- ⚙️ **Le préremplissage des réglages s'applique enfin aux installations existantes** (#56) :
  la fusion laissait gagner une chaîne vide enregistrée sur le défaut, si bien que les URL
  livrées en beta.7 ne profitaient qu'aux installations neuves. Les champs moteur vides sont
  désormais garnis **une fois**, puis un marqueur (`defautsDgx`) est enregistré
- Ce marqueur préserve le geste inverse : effacer l'URL du serveur vocal pour le couper tient
  au rechargement suivant, l'URL par défaut ne réapparaît pas
- Un moteur `claude` sans clé API — qui n'avait jamais pu servir une conversation — bascule
  sur le moteur local désormais renseigné ; une clé saisie est respectée
- Les clés (`apiKey`, `localKey`) ne sont jamais garnies

### Changed
- `DEFAULT_SETTINGS` et la fusion vivent dans `app/core/settings.js` — fonctions pures,
  couvertes par 8 tests dédiés (`tests/settings.test.mjs`), dont la non-réapparition d'une
  URL effacée volontairement
- Cache du service worker v2 en `polyglotte-v2-shell-2.0.0-beta.8`

## [2.0.0-beta.7] — 2026-10-11

### Changed
- ⚙️ **Réglages préremplis** (#54) : une installation neuve arrive configurée sur le DGX —
  moteur `local` par défaut, URL de la passerelle compatible OpenAI et du serveur vocal
  renseignées (toutes deux en HTTPS sur le tailnet, vérifiées joignables), modèle
  `qwen3.8-nvfp4`. Plus d'URL à saisir au clavier tactile sur l'iPad. Les clés (`apiKey`,
  `localKey`) restent vides : aucun secret dans le dépôt, et la passerelle n'en demande pas
- Les réglages **déjà enregistrés gagnent** sur ces défauts : une installation existante ou
  un profil déjà créé garde ses valeurs (y compris vides) — seuls une installation fraîche
  et un nouveau profil héritent du préremplissage. Pour en profiter sur un profil existant,
  saisir les URL une fois, ou créer un nouveau profil
- Cache du service worker v2 en `polyglotte-v2-shell-2.0.0-beta.7`

## [2.0.0-beta.6] — 2026-09-13

Préparation du build iOS (#37) : l'app native gagne tout ce qui lui manquait pour tourner
hors du navigateur.

### Added
- 📱 **Chaîne de build EAS** : `app/eas.json` (profils `development`, `simulator`,
  `preview`, `production` ; `appVersionSource: remote` et `autoIncrement` en production)
  et profil de soumission App Store Connect. Dépendance `expo-dev-client` — la
  reconnaissance vocale native exige un build de développement, elle n'existe pas dans
  Expo Go (#37)
- 🎙️ **Reconnaissance vocale native** (iOS `SFSpeechRecognizer`, Android
  `SpeechRecognizer`) via `expo-speech-recognition` : le micro fonctionne enfin en natif,
  avec résultats intermédiaires et messages d'erreur alignés sur le web. Le module natif
  est chargé paresseusement — un binaire qui ne l'embarque pas bascule proprement sur la
  saisie clavier au lieu de planter (#37)
- 🔊 **Serveur vocal branché en natif** (#45, promis pour #37) : pour les langues au
  support vocal partiel (suisse allemand, tunisien), enregistrement AAC 16 kHz mono via
  `expo-audio` envoyé à Whisper, et lecture des voix Piper (WAV écrit dans le cache puis
  joué), avec repli sur les moteurs du système en cas d'échec. L'app native a désormais la
  même matrice vocale que le web
- 🔔 **Rappels de révision** (`expo-notifications`, réglage désactivé par défaut) :
  notification locale à 19 h le premier jour où des cartes sont à revoir — planifiée sur
  l'appareil, sans serveur ni compte. Replanifiée à chaque changement d'écran et à chaque
  retour sur l'app. `app/core/reminders.js` : calcul pur de l'échéance, couvert par
  9 tests (`tests/reminders.test.mjs`) (#37)
- Permissions iOS déclarées (micro, reconnaissance vocale) et
  `ITSAppUsesNonExemptEncryption: false` — évite le questionnaire de conformité à chaque
  téléversement TestFlight

### Changed
- Le réglage « Rappels de révision » n'apparaît que sur les plateformes qui savent les
  tenir : sur le web, une PWA ne peut pas programmer de notification locale à date fixe
  sans serveur de push, et le réglage est masqué plutôt qu'inopérant
- Cache du service worker v2 en `polyglotte-v2-shell-2.0.0-beta.6`
- `verifie-coherence.mjs` contrôle désormais que ce nom de cache suit la version de
  `app/package.json` — un nom oublié servait l'ancienne app aux visiteurs sans rien casser
  à la construction

### Fixed
- Serveur vocal : couper la parole (retour à l'accueil, nouveau tour) pendant que la voix
  Piper était encore en cours de téléchargement laissait la phrase se jouer quand même,
  par-dessus la suite. Les lectures en vol sont maintenant périmées par l'arrêt —
  corrigé des deux côtés, web et natif

## [2.0.0-beta.5] — 2026-08-31

### Fixed
- « Le modèle n'a pas produit de JSON » en pleine conversation (vu en arabe) : le
  streaming s'appuyait sur le seul prompt pour obtenir du JSON — dérives et réponses
  détournées possibles. Le décodage guidé (`response_format json_schema`) est désormais
  envoyé aussi en streaming (reproduit puis vérifié sur vLLM : JSON valide à chaque
  tirage) ; un serveur qui le refuse déclenche le repli existant vers l'appel classique
- Budget de réponse de la conversation doublé (2048 tokens) : l'écriture arabe avec
  translittération et suggestions pouvait approcher la limite

## [2.0.0-beta.4] — 2026-08-31

### Fixed
- « Réponse vide du modèle » intermittente avec les modèles à raisonnement (Qwen3…) :
  le « thinking » pouvait consommer tout le budget de tokens avant la réponse. Les
  appels au moteur compatible OpenAI envoient désormais
  `chat_template_kwargs: { enable_thinking: false }` (streaming et appel classique) —
  réponse directe, latence de conversation nettement meilleure. Les serveurs qui
  ignorent l'option ne changent pas ; ceux qui la refusent (400) sont retentés sans
  l'option, y compris pour les appels sans schéma (résumés) (#43)
- Si la réponse reste vide après un raisonnement ou une coupure de budget, le message
  d'erreur l'explique au lieu du générique « Réponse vide du modèle »

## [2.0.0-beta.3] — 2026-08-31

### Fixed
- Serveur vocal : uvicorn écoute désormais `127.0.0.1` (au lieu de `0.0.0.0`) — le bind
  large recevait en direct les octets TLS destinés au proxy `tailscale serve` (« wrong
  version number » côté client, « Invalid HTTP request » côté uvicorn). L'accès distant
  passe par `https://spark-4569.tail34da6b.ts.net:8664` (#45). Pas de changement côté
  app web (cache SW inchangé)

## [2.0.0-beta.2] — 2026-08-31

### Added
- 🎙️ **Serveur vocal local** (#45) : `serveur-vocal/` — FastAPI sur le DGX exposant
  `/stt` (faster-whisper, GPU si disponible sinon CPU int8) et `/tts` (7 voix Piper :
  ca, es, en-GB, de, pt-PT, pt-BR, ar). Vérifié en boucle : audio Piper catalan
  retranscrit à l'identique par Whisper. Script `download-voix.sh`, unité systemd,
  README (dont exposition HTTPS via `tailscale serve` pour la PWA)
- Côté app (web) : réglage « Serveur vocal » (URL + bouton de test `/health`). Quand il
  est configuré, les langues au support vocal **partiel** (suisse allemand, tunisien)
  passent par Whisper pour la reconnaissance — micro en appuyer-parler-retoucher — et
  par Piper pour la synthèse, avec repli automatique sur les moteurs du navigateur en
  cas d'échec ou d'absence de voix (#45)

### Changed
- Les appels `speak()`/`createRecognizer()` transmettent le code `stt` et le niveau de
  `support` de la langue (routage local/distant dans la couche vocale)
- Exercice de prononciation : retoucher le micro arrête l'enregistrement en cours
- Le moteur distant n'est pas encore branché en natif (viendra avec le build dev, #37)
- Cache du service worker v2 en `polyglotte-v2-shell-2.0.0-beta.2`

## [2.0.0-beta.1] — 2026-08-31

**La v2 prend la racine** (#42) : l'app universelle Expo est servie sur
`jacquesblr.github.io/polyglotte/`, la v1 gelée est archivée sous `/v1/`. Fin de la
parité fonctionnelle (#36).

### Changed
- `baseUrl` de la v2 : `/polyglotte` (racine) ; cache SW `polyglotte-v2-shell-2.0.0-beta.1`.
  Le service worker v2 remplace celui de la v1 au même chemin `sw.js` : chez les visiteurs
  existants, la mise à jour purge les caches v1 à l'activation
- `deploy-pages.yml` : build v2 copié à la racine du site, v1 (`index.html`, `css`, `js`,
  `icons`, `manifest`, `sw.js`) copiée sous `/v1/` — ses chemins étant tous relatifs, elle
  y fonctionne à l'identique
- Ancien emplacement `/v2/` : page de redirection vers la racine + service worker
  d'auto-destruction (`redirects/v2/`) qui purge les caches alpha, se désinscrit et
  recharge les onglets des testeurs
- `ci.yml` (chemins d'actifs `/polyglotte/_expo/`) et `verifie-coherence.mjs` (baseUrl
  racine, contrôle de la redirection) alignés sur la nouvelle disposition
- README et ROADMAP : URLs et état de la bascule mis à jour

## [2.0.0-alpha.7] — 2026-08-31

### Added
- 🧠 Répétition espacée **FSRS-4.5** à la place des boîtes de Leitner : planification par
  stabilité/difficulté visant 90 % de rétention, 4 réponses de révision (À revoir,
  Difficile, Bien, Facile), intervalle plafonné à un an. Migration en douceur des cartes
  Leitner : échéance conservée, et la boîte sème la stabilité initiale à la révision
  suivante — l'avancement acquis n'est pas perdu (#44)
- 🔁 **Cartes inversées** (réglage, désactivé par défaut) : une carte sur deux présentée
  français → langue cible, réponse lue à voix haute à la révélation (#44)
- 8 tests dédiés (`tests/fsrs.test.mjs`)

### Changed
- Le carnet affiche la stabilité (en jours) des cartes déjà révisées, au lieu de la boîte
- Cache du service worker v2 en `polyglotte-v2-shell-2.0.0-alpha.7`

## [2.0.0-alpha.6] — 2026-08-31

### Added
- ⚡ Streaming des réponses du moteur compatible OpenAI (SSE) avec lecture à voix haute
  **phrase par phrase** dès que chaque phrase est complète — latence perçue fortement
  réduite en conversation orale. Réponse affichée progressivement pendant le stream ;
  repli transparent sur l'appel classique si le serveur ne sait pas streamer. Hors mode
  évaluation ; le fournisseur Claude reste en appel classique (#43)
- `app/core/stream.js` : extraction incrémentale d'un champ chaîne d'un JSON en cours de
  réception, découpage en phrases (ponctuation pleine chasse japonaise gérée, points
  décimaux préservés), tampon SSE — fonctions pures couvertes par `tests/stream.test.mjs` (#43)
- Couches vocales : option `queue` de `speak()` pour enchaîner les phrases sans couper la
  précédente (file d'expo-speech en natif, file du speechSynthesis sur web) (#43)

### Changed
- Cache du service worker v2 en `polyglotte-v2-shell-2.0.0-alpha.6`

## [2.0.0-alpha.5] — 2026-08-31

Outillage avant la bascule v2 : tests unitaires du cœur, releases automatiques, gel de la
v1 (#41, #39).

### Added
- Tests unitaires (`node --test`, sans dépendance) du cœur partagé `app/core` — Leitner,
  notation LCS des dictées, registre des langues, prompts, extraction JSON, schémas —
  dans `tests/`, exécutés en CI avant la construction (#41)
- `release.yml` : à la fusion dans `main`, si la version en tête du CHANGELOG n'a pas
  encore de release GitHub, création automatique du tag `vX.Y.Z` et de la release
  (notes = section du CHANGELOG, pré-release si la version contient un tiret) (#39)

### Changed
- **v1 gelée** : la webapp statique (racine) ne reçoit plus que des correctifs ; toute
  nouveauté va dans la v2 (`app/`). La bascule `/v2/` → racine est suivie dans #42
  (ROADMAP, README)
- Décision #39 : l'hébergement reste sur GitHub Pages (site 100 % statique, rien à
  héberger côté serveur) ; pas de runner self-hosted — la partie release de la
  convention est automatisée sur `ubuntu-latest`
- Cache du service worker v2 en `polyglotte-v2-shell-2.0.0-alpha.5`

## [2.0.0-alpha.4] — 2026-08-25

Normalisation du dépôt après le renommage `hello-world` → `polyglotte` du 21/08/2026 (#38).

### Fixed
- **L'aperçu v2 publié était inutilisable** : le dépôt renommé, GitHub Pages sert désormais
  le site sous `/polyglotte/`, mais la v2 avait été construite avec
  `experiments.baseUrl = "/hello-world/v2"` — la page se chargeait (200) et son bundle
  JavaScript renvoyait 404, donc un écran blanc. `baseUrl` suit maintenant le nom du
  dépôt (#38)

### Added
- `ci.yml` (`on: pull_request`, `ubuntu-latest`) : cohérence du dépôt, syntaxe de l'app v1
  et du proxy local, construction de la v2 en web et vérification que les actifs produits
  pointent bien vers `/polyglotte/v2/` (#38)
- `scripts/verifie-coherence.mjs` : garde-fou contre le retour de ce bug — vérifie
  `baseUrl`, l'absence de référence à l'ancien nom du dépôt et la synchronisation du nom
  de cache du service worker v1 avec `APP_VERSION` (#38)

### Changed
- Branche par défaut `main`, contenant l'intégralité du projet (elle n'hébergeait jusqu'ici
  que le README « hello-world » d'origine) ; `deploy-pages.yml` publie désormais à la
  fusion dans `main` et non plus sur l'ancienne branche de travail (#38)
- Cache du service worker v2 en `polyglotte-v2-shell-2.0.0-alpha.4` ; portée documentée
  en `/polyglotte/v2/` (#38)
- `app/package.json` aligné sur la version de l'application (il était resté en `1.0.0`) (#38)
- README : URL publiée ; ROADMAP : méthode de travail `main` + PR + CI (#38)

## [2.0.0-alpha.3] — 2026-08-17

Fin de la parité fonctionnelle de la v2 côté web (#36). Vérifié en navigateur réel
(Chromium pilote l'export : rendu des écrans, création et persistance d'un profil,
aucune erreur console).

### Added
- Profils multiples : réglages, carnet et historique séparés par profil ; création,
  bascule et suppression (avec confirmation) depuis les réglages. Le profil « défaut »
  garde les clés de stockage historiques (#36)
- Bouton « 🔌 Tester la connexion » du moteur compatible OpenAI, porté de la v1 :
  joignabilité, présence du modèle au catalogue, puis validation clé + modèle (#36)
- Export du carnet au format Anki : téléchargement du fichier sur web, écriture puis
  feuille de partage en natif (`expo-file-system` API SDK 54+ et `expo-sharing`) (#36)
- PWA v2 installable : gabarit `public/index.html` (manifeste, thème, métadonnées
  Apple), `manifest.webmanifest`, icônes et service worker propres à la v2
  (cache `polyglotte-v2-shell-2.0.0-alpha.3`, portée `/v2/` — la portée la plus
  spécifique l'emporte sur le service worker de la v1) (#36)

## [2.0.0-alpha.2] — 2026-08-17

Deuxième jalon v2 : l'aperçu Expo rejoint les fonctionnalités principales de la v1 (#36, en cours).

### Added
- 🎓 Test de niveau CECRL dans l'écran de conversation (mode évaluation, schéma dédié),
  avec bouton « Adopter ce niveau » qui règle l'app sur le niveau estimé (#36)
- 🧠 Écran Grammaire : fiches pédagogiques et cartes mentales SVG (react-native-svg,
  même algorithme de disposition que la v1 ; les info-bulles deviennent des nœuds
  tapotables qui affichent leur détail sous la carte) (#36)
- ✍️ Écran Exercices : dictée et prononciation, 5 phrases par série, notation mot à
  mot LCS avec surlignage des jetons trouvés/manqués (japonais par caractère) (#36)
- 📊 Écran Progrès : statistiques (sessions, jours d'affilée, carnet, à réviser),
  pratique par langue, carnet de vocabulaire (écoute, suppression) et révision
  Leitner (boîtes 1-5) (#36)
- Historique des sessions persisté (AsyncStorage) pour les statistiques et la série
  de jours (#36)

### Changed
- App.js découpé : écrans dans `app/ui/` (common, SettingsModal, GrammarScreen,
  ExercisesScreen, ProgressScreen) + `app/storage.js` (persistance JSON)

## [2.0.0-alpha.1] — 2026-08-17

Premier jalon de la migration vers une application universelle **Expo / React Native**
(iOS, Android et web via react-native-web), publiée en aperçu à côté de l'app v1 sur
`https://jacquesblr.github.io/hello-world/v2/`. L'app v1 reste l'app de référence.

### Added
- Squelette Expo SDK 57 dans `app/` (template blank + react-native-web) (#33)
- Cœur métier partagé extrait de l'app v1 en modules purs sans dépendance UI,
  réutilisables sur les trois plateformes : `app/core/languages.js` (10 langues,
  scénarios, résolution tunisien), `schemas.js`, `prompts.js`, `api.js` (Claude +
  serveur OpenAI compatible), `leitner.js`, `diff.js` (#33)
- Abstraction vocale multi-plateforme `app/speech/` : `speech.web.js` (Web Speech API,
  portée de la v1) et `speech.native.js` (synthèse expo-speech ; reconnaissance
  indisponible en natif pour l'instant → dégradation propre vers la saisie clavier),
  résolue automatiquement par Metro selon la plateforme (#34)
- Écran de conversation MVP dans `App.js` : choix langue/niveau/scénario/immersion,
  bulles avec traduction et translittération, corrections, notes culturelles,
  suggestions, micro + coupe-micro, résumé de fin de session, capture du vocabulaire
  vers le carnet (AsyncStorage), réglages moteur IA (Claude / serveur local) (#34)
- Build web `expo export` intégré au workflow Pages et publié sous `/v2/`,
  `experiments.baseUrl` configuré pour le sous-chemin (#35)

## [1.3.0] — 2026-08-16

### Added
- Bouton 🔇 coupe-micro : arrêt immédiat de l'écoute et suspension de la réouverture
  automatique du mode mains libres ; toucher 🎤 réactive (conversation et exercices) (#32)

## [1.2.0] — 2026-08-16

### Added
- Bouton « 🔌 Tester la connexion » du moteur OpenAI compatible : joignabilité, présence du
  modèle au catalogue (`GET /models`), puis validation clé + modèle par un mini
  `chat/completions`, avec diagnostics distincts (injoignable / clé refusée / modèle
  inconnu) (#31)

### Changed
- Exemples d'identifiants alignés sur le catalogue réel de Nous Portal
  (`nousresearch/hermes-4-405b`, `anthropic/claude-sonnet-4.6`, `openai/gpt-oss-120b`) ;
  CORS vérifié : les appels navigateur directs sont autorisés par l'API Nous

## [1.1.0] — 2026-08-16

### Added
- Clé API optionnelle pour le moteur compatible OpenAI (`Authorization: Bearer`), permettant
  les API hébergées comme Nous Research / Hermes (`inference-api.nousresearch.com/v1`,
  modèles Hermes-4-405B/70B/4.3-36B) en plus des serveurs locaux (#30)

### Changed
- Libellés et exemples du moteur OpenAI-compatible (« local ou hébergé ») ; messages
  d'erreur 401/403 explicites

## [1.0.0] — 2026-08-16

### Added
- **PWA installable** : manifeste, icônes, service worker (coquille applicative en cache
  stale-while-revalidate, jamais les appels API) — installable sur l'écran d'accueil iPad
  via Partager → « Sur l'écran d'accueil » (#26)
- **Moteur local compatible OpenAI** : réglage « Moteur IA » avec URL de base et modèle
  (ex. gpt-oss-120b sur vLLM/Ollama), modèle optionnel distinct pour fiches et résumés,
  sorties structurées via `response_format` avec repli automatique (consigne JSON +
  extraction) si le serveur ne supporte pas les schémas (#27)
- **Profils multiples** : réglages, carnet, révisions et historique par profil ; le profil
  « défaut » conserve les données existantes (#28)
- Documentation 1.0 : installation PWA, configuration du serveur local, profils (#29)

## [0.5.0] — 2026-08-16

### Added
- Bibliothèque de scénarios culturels : 3 jeux de rôle ancrés par langue (calçotada et Sant
  Jordi, izakaya et onsen, Biergarten et Bürgeramt, souk et iftar, fado et tram 28…),
  ajoutés au sélecteur selon la langue choisie (#23)
- Notes culturelles 💡 : le tuteur glisse occasionnellement une brève note en français liée
  à l'échange, dans une bulle dédiée non vocalisée (#24)
- Mode 🌊 Immersion totale : langue cible uniquement, corrections par reformulation
  naturelle (aucune bulle de correction), traductions masquées, translittérations
  conservées (#25)

## [0.4.0] — 2026-08-16

### Added
- Test de positionnement CECRL conversationnel : 5 à 8 échanges, verdict A1–C1 justifié en
  français, niveau appliqué automatiquement (#17)
- Difficulté adaptative : le tuteur enrichit ou simplifie en continu selon l'aisance de
  l'élève, dans les limites du niveau choisi (#18)
- Écran « 🧠 Grammaire & conjugaison » : fiches à la demande (explications, tableaux de
  conjugaison, exemples traduits) et cartes mentales rendues en SVG avec info-bulles ;
  bouton « Approfondir » sur chaque correction (#19)
- Mode compréhension orale : texte des réponses flouté, révélation via 👁 (#20)
- Exercices de dictée : 5 phrases adaptées au niveau, correction mot à mot par alignement
  LCS (normalisation casse/ponctuation/diacritiques arabes, comparaison par caractère en
  japonais), score par phrase et bilan (#21)
- Exercice de prononciation : lecture à voix haute comparée à la phrase attendue via la
  reconnaissance vocale, avec réessais (#22)

## [0.3.0] — 2026-08-16

### Added
- Extraction automatique du vocabulaire : le tuteur identifie à chaque tour 0 à 2 mots
  importants (terme, traduction, translittération) via le champ `vocabulary` du schéma (#11)
- Carnet de vocabulaire persistant multi-langues avec dédoublonnage, consultation et
  suppression (#12)
- Révision par répétition espacée : boîtes de Leitner (intervalles 1/2/4/8/16 jours),
  flashcards avec audio dans la voix de la langue de la carte (#13)
- Export du carnet compatible Anki (fichier texte tabulé) (#14)
- Historique des sessions et statistiques : sessions totales, série de jours consécutifs,
  pratique par langue, taille du carnet, cartes dues (#15)
- Écran « 📚 Progrès » avec pastille du nombre de cartes à réviser (#16)

## [0.2.0] — 2026-08-16

Commit : `db178da`.

### Added
- Neuf nouvelles langues aux côtés du catalan : espagnol, anglais (GB), allemand, suisse
  allemand, portugais (Portugal), portugais (Brésil), japonais, arabe standard, tunisien
  (#4)
- Sélecteur de langue sur l'écran d'accueil, registre central des langues (locales
  vocales, personas, options) (#4)
- Un tuteur par langue avec persona et prompts adaptés (pièges typiques pour un
  francophone, scénarios ancrés dans la ville du tuteur) (#5)
- Paramétrage vocal par langue (reconnaissance et synthèse) avec choix automatique de la
  meilleure voix disponible et matrice de support vocal affichée honnêtement (#6)
- Support droite-à-gauche pour l'arabe et le tunisien en écriture arabe (#7)
- Translittérations : rōmaji pour le japonais, translittération latine pour l'arabe,
  double écriture arabe/arabizi pour le tunisien (champ `reading` du schéma de réponse)
  (#8)
- Version de l'application affichée dans les réglages ; `CHANGELOG.md` et `ROADMAP.md`
  (#9, #10)
- Bouton « Nouvelle session » pour changer de langue ou de scénario

### Changed
- Renommage de l'application : « Parla! » devient « Polyglotte » (#3)
- Réglages : migration transparente de l'ancienne clé de stockage local

## [0.1.0] — 2026-08-16

Commit : `2d8ccc1` (base) puis correctifs `f47f4f5` (iOS), `3f0a748` (déploiement).

### Added
- Tuteur de catalan « Parla! » : conversation orale via Web Speech API (reconnaissance
  `ca-ES`, synthèse avec voix catalane et repli espagnol)
- Réponses structurées de Claude : réplique, traduction française, correction expliquée en
  français, suggestions de réponses cliquables
- Trois niveaux (A1–C1), sept scénarios de jeu de rôle, mode mains libres, résumé de
  session pédagogique
- Gestion de la clé API : proxy local `server.py` (clé côté serveur, `.env`) avec repli
  « clé dans le navigateur » pour l'hébergement statique
- Déploiement GitHub Pages automatique (branche `gh-pages` synchronisée par workflow)
- Déblocage de la synthèse vocale sur Safari iOS
