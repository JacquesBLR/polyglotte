// Polyglotte v2 — application universelle (iOS / Android / web) sur Expo.
// Navigation simple entre écrans, consommant le cœur partagé (app/core),
// l'abstraction vocale (app/speech) et les écrans (app/ui).

import { useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { callModel, hasCredentials } from "./core/api";
import { streamOrCallLocal, partialStringField, createSentenceStreamer } from "./core/stream";
import { retireProvisoire } from "./core/messages";
import { BASE_SCENARIOS, LANGUAGES, langConfig } from "./core/languages";
import { ajouteErreur, erreursAMarquer, erreursAReactiver, marqueReactivees } from "./core/erreurs";
import { addVocabulary } from "./core/leitner";
import { fusionneAtteints, messageMission, missionsValides } from "./core/mission";
import {
  devine, entreeMystere, expurge, intitule, messageRevelation, QUESTIONS_MIN, SCENARIO_MYSTERE, tireMystere,
} from "./core/mystere";
import { appreciation, integreScore, scorePrononciation } from "./core/prononciation";
import { buildTutorPrompt, introEvaluation, summaryRequest } from "./core/prompts";
import {
  avancement, bilanNiveau, leconsValidees, niveauApp, niveauxValides, numero, prochainBilan, prochaineLecon,
} from "./core/parcours";
import { consigneExplication, expliqueRequete, expliqueValide, explicationConsignee } from "./core/explique";
import { ajouteMesure, creeChrono, ligneConsole, mesure, mesureEchec, messageLenteur } from "./core/latence";
import { LIBELLES, controleEcriture, ecritureConforme } from "./core/ecriture";
import { entreeResume, integreResume, resumeValide } from "./core/resume";
import { EXPLAIN_SCHEMA, MAX_TOKENS, schemaEvaluation, schemaResume, schemaTour } from "./core/schemas";
import { DEFAULT_SETTINGS, fusionneReglages } from "./core/settings";
import { cancelReminders, REMINDERS_SUPPORTED, scheduleReminder } from "./notify/notify";
import { registerServiceWorker } from "./pwa/pwa";
import * as speech from "./speech/speech";
import {
  DEFAULT_PROFILE, keysFor, loadJSON, loadProfiles, removeProfileData, saveJSON, saveProfiles,
} from "./storage";
import { C, Chip, MARGE_BAS, MARGE_HAUT, ui } from "./ui/common";
import ExercisesScreen from "./ui/ExercisesScreen";
import GrammarScreen from "./ui/GrammarScreen";
import ParcoursScreen from "./ui/ParcoursScreen";
import ProgressScreen from "./ui/ProgressScreen";
import SettingsModal from "./ui/SettingsModal";

const LEVELS = [
  ["debutant", "Débutant"],
  ["intermediaire", "Intermédiaire"],
  ["avance", "Avancé"],
];

// Niveau CECRL estimé par le test → niveau de l'app.
const CEFR_TO_LEVEL = { A1: "debutant", A2: "debutant", B1: "intermediaire", B2: "intermediaire", C1: "avance" };

const SCREEN_TITLES = { grammar: "🧠 Grammaire", exos: "✍️ Exercices", progress: "📊 Progrès", parcours: "📚 Parcours" };

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [profiles, setProfiles] = useState({ list: [DEFAULT_PROFILE], current: DEFAULT_PROFILE });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [screen, setScreen] = useState("home");

  const [langId, setLangId] = useState("catalan");
  const [tnScript, setTnScript] = useState("arabe");
  const [level, setLevel] = useState("debutant");
  const [scenarioId, setScenarioId] = useState("libre");
  const [immersion, setImmersion] = useState(false);

  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [missions, setMissions] = useState({ liste: [], atteintes: [] }); // missions de scénario (#91)
  const [mystere, setMystere] = useState(null); // personnage mystère (#105) : { secret, choix, revele }
  const [devinetteOuverte, setDevinetteOuverte] = useState(false);
  const [repeteEnCours, setRepeteEnCours] = useState(null); // index de la réplique en cours de répétition (#95)
  const [status, setStatus] = useState({ text: "", error: false });
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [input, setInput] = useState("");
  const [validees, setValidees] = useState(new Set()); // leçons du parcours validées (#111)
  const [niveauxOk, setNiveauxOk] = useState(new Set()); // niveaux CECRL validés par leur bilan (#114)

  // Références stables pour la session en cours (pas besoin de re-render).
  const session = useRef({ cfg: null, mode: "chat", system: "", history: [], recognizer: null, id: null, missions: { liste: [], atteintes: [] } });
  const scrollRef = useRef(null);

  const keys = keysFor(profiles.current);

  // Serveur vocal distant (#45) : la couche vocale suit le réglage. `onAvis` remonte ce que
  // la synthèse ne peut pas faire entendre : plus aucune voix disponible (#67), ou repli du
  // serveur vocal sur une voix du navigateur qui n'est pas dans la bonne variante (#75).
  // Sans ce canal, l'app se tairait — ou parlerait de travers — sans rien dire.
  useEffect(() => {
    speech.configure({
      voiceUrl: settings.voiceUrl,
      onAvis: (texte) => setStatus({ text: texte, error: true }),
    });
  }, [settings.voiceUrl]);

  // Rappels de révision (#37) : replanifiés à chaque changement d'écran et à
  // chaque retour sur l'app — le carnet a pu bouger entre-temps (mots ajoutés
  // en conversation, cartes notées dans l'écran Progrès).
  useEffect(() => {
    if (!REMINDERS_SUPPORTED) return undefined;
    let vivant = true;
    const replanifie = async () => {
      if (!settings.reminders) return cancelReminders();
      const deck = await loadJSON(keys.deck, []);
      if (vivant) await scheduleReminder(deck);
    };
    replanifie();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") replanifie();
    });
    return () => { vivant = false; sub.remove(); };
  }, [settings.reminders, keys.deck, screen]);

  // Parcours (#111) : leçons validées de la langue courante, relues depuis l'historique à
  // chaque retour à l'accueil ou au programme (une séance a pu en valider une).
  useEffect(() => {
    if (screen !== "home" && screen !== "parcours") return undefined;
    let vivant = true;
    loadJSON(keys.history, []).then(h => {
      if (!vivant) return;
      setValidees(leconsValidees(h, langId));
      setNiveauxOk(niveauxValides(h, langId));
    }).catch(() => {});
    return () => { vivant = false; };
  }, [screen, langId, keys.history]);

  useEffect(() => {
    registerServiceWorker();
    loadProfiles().then(async (p) => {
      setProfiles(p);
      const cle = keysFor(p.current).settings;
      appliqueReglages(await loadJSON(cle, null), cle);
    });
  }, []);

  // Applique les réglages enregistrés, garnis des défauts manquants (#56). Si le
  // garnissage a changé quelque chose, on réenregistre pour que le marqueur tienne.
  const appliqueReglages = (saved, cle) => {
    const { settings: next, modifie } = fusionneReglages(saved);
    setSettings(next);
    if (modifie) saveJSON(cle, next);
  };

  const saveSettings = (next) => {
    setSettings(next);
    saveJSON(keys.settings, next);
  };

  // Change de profil : recharge les réglages du profil visé (carnet et historique
  // sont relus par les écrans via `keys`).
  const switchProfile = async (name) => {
    const next = { ...profiles, current: name };
    setProfiles(next);
    saveProfiles(next);
    const saved = await loadJSON(keysFor(name).settings, null);
    appliqueReglages(saved, keysFor(name).settings);
    setSettingsOpen(false);
    setScreen("home");
    setStatus({ text: `Profil « ${name} » actif.`, error: false });
  };

  const addProfile = (name) => {
    const next = { list: [...profiles.list, name], current: name };
    setProfiles(next);
    saveProfiles(next);
    setSettings(DEFAULT_SETTINGS);
    setSettingsOpen(false);
    setScreen("home");
    setStatus({ text: `Profil « ${name} » créé — configure son moteur IA.`, error: false });
  };

  const deleteProfile = async (name) => {
    if (name === DEFAULT_PROFILE) return;
    await removeProfileData(name);
    const list = profiles.list.filter(n => n !== name);
    const next = { list, current: DEFAULT_PROFILE };
    setProfiles(next);
    saveProfiles(next);
    const saved = await loadJSON(keysFor(DEFAULT_PROFILE).settings, null);
    appliqueReglages(saved, keysFor(DEFAULT_PROFILE).settings);
    setSettingsOpen(false);
    setScreen("home");
    setStatus({ text: `Profil « ${name} » supprimé.`, error: false });
  };

  const cfg = langConfig(langId, tnScript);
  const scenarios = [
    ...BASE_SCENARIOS,
    ...(cfg.scenarios || []).map(s => [s.id, s.label]),
  ];

  // ---------- Session ----------

  // `lecon` (#111) : leçon du parcours — elle remplace le scénario, fixe les missions et
  // règle le tuteur sur son niveau CECRL.
  const startSession = async (mode, lecon = null) => {
    if (!hasCredentials(settings)) {
      setSettingsOpen(true);
      setStatus({ text: "Configure d'abord ton moteur IA dans les réglages.", error: true });
      return;
    }
    speech.primeSpeech(); // avant tout `await` : l'amorçage doit rester dans le geste (#77)
    const c = langConfig(langId, tnScript);
    // Carnet d'erreurs (#87) : les erreurs les plus fragiles de cette langue entrent dans le
    // prompt, pour que le tuteur crée l'occasion de les réemployer. Pas en test de niveau.
    let erreurs = [];
    if (mode === "chat") {
      const carnet = await loadJSON(keys.erreurs, []);
      erreurs = erreursAReactiver(carnet, langId);
      // Marquées « réactivées » seulement quand le premier tour a réussi (#101, E4) : un
      // [START] en échec les aurait écartées une journée sans qu'elles aient servi.
    }
    // Personnage mystère (#105) : le secret est tiré par l'app, jamais par le modèle.
    const lec = mode === "chat" ? lecon : null;
    const mys = mode === "chat" && !lec && scenarioId === SCENARIO_MYSTERE ? tireMystere() : null;
    const ctx = {
      cfg: c, level: lec ? niveauApp(lec.cecrl) : level, scenarioId: lec ? "lecon" : scenarioId,
      immersion, mode, erreurs, mystere: mys, lecon: lec,
    };
    // Les missions d'une leçon sont ses objectifs « je peux » : fixées avant le premier tour.
    const missionsInitiales = { liste: lec ? [...lec.missions] : [], atteintes: [] };
    session.current = {
      cfg: c,
      lang: langId, // langue de la séance, figée à son ouverture (#97)
      mode,
      ctx, // conservé pour reconstruire le prompt une fois les missions annoncées (#91)
      system: buildTutorPrompt({ ...ctx, missions: missionsInitiales.liste }),
      history: [],
      recognizer: null,
      id: mode === "chat" ? `${Date.now()}` : null,
      missions: missionsInitiales,
      lecon: lec,
      mystere: mys,
      questions: 0, // messages de l'élève avant la devinette
    };
    // Test de niveau : le principe est expliqué par l'app, en français (#110, D2).
    setMessages(mode === "eval" ? [{ role: "info", text: introEvaluation(c) }] : []);
    setMystere(mys);
    setDevinetteOuverte(false);
    setSuggestions([]);
    setMissions(missionsInitiales);
    setMicMuted(false);
    setScreen("chat");
    setStatus({ text: "", error: false });
    send("[START]");
  };

  const recordSessionTurn = async () => {
    const s = session.current;
    if (!s.id) return;
    const history = await loadJSON(keys.history, []);
    let entry = history.find(h => h.id === s.id);
    if (!entry) {
      entry = { id: s.id, date: Date.now(), lang: s.lang, level: s.ctx.level, scenario: s.ctx.scenarioId, turns: 0 };
      if (s.lecon) entry.lecon = s.lecon.id; // parcours (#111) : la validation se lit ici
      history.push(entry);
    }
    entry.turns++;
    entry.lastAt = Date.now();
    // Missions (#91) : total annoncé et nombre accompli, relus par l'écran Progrès.
    entry.missions = { total: s.missions.liste.length, atteintes: s.missions.atteintes.length };
    saveJSON(keys.history, history);
  };

  // Sonde de latence (#98) : journalise la mesure (console + journal local borné) et rend
  // le message d'alerte, vide si le tuteur a répondu dans les temps.
  const sonde = (nature, chrono, stream = false, relance = false) => {
    const m = mesure(nature, chrono.fin(), {
      stream,
      relance,
      modele: settings.provider === "local" ? settings.localModel : settings.model,
    });
    console.info(ligneConsole(m));
    loadJSON(keys.latence, []).then(journal => {
      const next = ajouteMesure(journal, m);
      if (next !== journal) saveJSON(keys.latence, next);
    }).catch(() => {});
    return messageLenteur(m);
  };

  // Appel en échec (#107) : journalisé aussi (type, durée jusqu'à l'échec), pour que le taux
  // d'échec apparaisse dans Progrès. Sans chrono (échec avant l'appel), rien n'est noté.
  const sondeEchec = (nature, chrono, err, stream = false) => {
    if (!chrono) return;
    const m = mesureEchec(nature, chrono.fin(), err, {
      stream,
      modele: settings.provider === "local" ? settings.localModel : settings.model,
    });
    console.info(ligneConsole(m));
    loadJSON(keys.latence, []).then(journal => {
      const next = ajouteMesure(journal, m);
      if (next !== journal) saveJSON(keys.latence, next);
    }).catch(() => {});
  };

  const endSession = async () => {
    speech.stopSpeaking();
    stopMic();
    const s = session.current;
    if (s.mode === "chat" && s.history.length >= 4 && !busy) {
      let texteComplet = null; // bilan lisible reçu en entier pendant le streaming (T3)
      setBusy(true);
      setStatus({ text: "Je prépare ton résumé de session…", error: false });
      let chrono = null;
      let recu = false;
      try {
        chrono = creeChrono();
        const opts = {
          messages: [...s.history, { role: "user", content: summaryRequest({ cfg: s.cfg }) }],
          system: s.system,
          schema: schemaResume({ lecture: !!s.cfg.reading }), // sans `reading` en alphabet latin (#107)
          maxTokens: MAX_TOKENS.resume,
        };
        // Résumé en streaming (#103) : le bilan lisible (« texte », en tête du schéma)
        // s'affiche au fil de l'eau au lieu de 40 s d'écran figé ; les champs structurés
        // (carnets, niveau observé) sont exploités une fois la réponse complète.
        let raw;
        if (settings.provider === "local") {
          opts.onDelta = (accumulated) => {
            chrono.premierJeton();
            recu = true;
            const partial = partialStringField(accumulated, "texte");
            if (!partial || !partial.text) return;
            if (partial.complete) { chrono.replique(); texteComplet = partial.text; }
            setMessages(m => [...retireProvisoire(m), { role: "summary", text: partial.text, streaming: true }]);
          };
          raw = await streamOrCallLocal(settings, opts);
        } else {
          raw = await callModel(settings, opts);
        }
        const alerte = sonde("resume", chrono, recu);
        chrono = null; // mesuré : une erreur après ce point n'est pas un échec d'appel
        // Résumé structuré (#93). Un modèle qui ne tiendrait pas le schéma rend au pire un
        // texte : on l'affiche tel quel, rien d'autre ne casse.
        let resume = null;
        try { resume = resumeValide(JSON.parse(raw)); } catch (_) { resume = null; }
        // Un JSON valide mais inexploitable (sans « texte ») n'est pas montré brut à l'élève.
        let lisible = raw;
        if (!resume) { try { JSON.parse(raw); lisible = "Le tuteur n'a pas su rédiger le résumé de cette séance."; } catch (_) { /* texte libre : affiché tel quel */ } }
        setMessages(m => [...retireProvisoire(m), { role: "summary", text: resume ? resume.texte : lisible, resume }]);
        if (resume) {
          // Les erreurs et le vocabulaire du bilan rejoignent les carnets ; le bilan et le
          // niveau observé, l'entrée d'historique de la séance.
          const [deck, carnet, history] = await Promise.all([
            loadJSON(keys.deck, []), loadJSON(keys.erreurs, []), loadJSON(keys.history, []),
          ]);
          const integre = integreResume(deck, carnet, resume, langId);
          if (integre.deck !== deck) saveJSON(keys.deck, integre.deck);
          if (integre.carnet !== carnet) saveJSON(keys.erreurs, integre.carnet);
          const entry = history.find(h => h.id === s.id);
          if (entry) {
            entry.resume = entreeResume(resume);
            entry.niveauObserve = resume.niveau_observe;
            saveJSON(keys.history, history);
          }
        }
        setStatus({ text: alerte || "Résumé de session — reviens à l'accueil quand tu veux.", error: false });
        setSuggestions([]);
        session.current.history = [];
      } catch (err) {
        // Relecture du 12/10, T3 : l'historique n'est vidé qu'en cas de succès — un résumé
        // en échec se redemande par ✅ au lieu d'être perdu. Coupé après un bilan lisible
        // complet, ce bilan reste affiché ; carnets et niveau observé ne sont pas versés
        // (champs structurés incomplets).
        sondeEchec("resume", chrono, err, recu);
        setMessages(retireProvisoire);
        if (err.tronque && texteComplet) {
          setMessages(m => [...m, { role: "summary", text: texteComplet, resume: null }]);
          setStatus({ text: "Résumé incomplet : le bilan est affiché, mais carnets et niveau observé n'ont pas été mis à jour.", error: true });
          setSuggestions([]);
          session.current.history = [];
        } else {
          setStatus({ text: `${err.message} Appuie de nouveau sur ✅ pour réessayer le résumé.`, error: true });
        }
      }
      setBusy(false);
    } else {
      setScreen("home");
    }
  };

  const send = async (rawText) => {
    const text = rawText.trim();
    if (!text || busy) return;
    const s = session.current;
    stopMic();
    setInput("");
    setBusy(true);
    if (text !== "[START]") {
      setMessages(m => [...m, { role: "user", text }]);
    }
    setSuggestions([]);
    setStatus({ text: `${s.cfg.tutor.name} réfléchit…`, error: false });
    s.history.push({ role: "user", content: text });
    // Streaming phrase par phrase (#43) : moteur compatible OpenAI, hors évaluation.
    const useStream = settings.provider === "local" && s.mode !== "eval";
    let streamed = false; // un message provisoire est affiché en cours de stream
    let statutMission = ""; // message d'étape des missions, affiché après le tour
    let chrono = null; // chronomètre de l'appel, remis à null une fois mesuré
    let recu = false; // au moins un fragment de texte reçu en streaming
    let relance = false; // réplique réécrite par le contrôle d'écriture (#107)
    try {
      const opts = {
        messages: s.history,
        system: s.system,
        // Schéma du tour réduit aux champs qui peuvent y servir, plafond de jetons par
        // nature d'appel (#103).
        schema: s.mode === "eval"
          ? schemaEvaluation({ lecture: !!s.cfg.reading })
          : schemaTour({
              lecture: !!s.cfg.reading,
              immersion: !!s.ctx?.immersion,
              nbMissions: s.missions.liste.length,
              missions: !s.mystere, // pas de missions au personnage mystère (#105)
            }),
        maxTokens: s.mode === "eval" ? MAX_TOKENS.evaluation : MAX_TOKENS.tour,
      };
      let raw;
      chrono = creeChrono();
      if (useStream) {
        const speaker = settings.autospeak
          ? createSentenceStreamer(sentence =>
              speech.speak(sentence, { ttsPrefixes: s.cfg.ttsPrefixes, stt: s.cfg.stt, support: s.cfg.support, voixServeur: s.cfg.voixServeur, langue: s.cfg.label, rate: settings.rate, queue: true }),
              { minChars: s.cfg.voixMinCar || 0 })
          : null;
        opts.onDelta = (accumulated) => {
          chrono.premierJeton();
          recu = true;
          const partial = partialStringField(accumulated, "reply");
          if (!partial || !partial.text) return;
          if (partial.complete) chrono.replique();
          if (speaker) {
            speaker.push(partial.text);
            if (partial.complete) speaker.flush(partial.text);
          }
          setMessages(m => [...retireProvisoire(m), { role: "tutor", text: partial.text, streaming: true }]);
          streamed = true;
          setStatus({ text: "", error: false });
        };
        raw = await streamOrCallLocal(settings, opts);
      } else {
        raw = await callModel(settings, opts);
      }
      let data;
      try { data = JSON.parse(raw); } catch (_) { throw new Error("Le modèle a produit un JSON invalide — réessaie."); }
      // Contrôle d'écriture (#107) : une réplique hors de l'écriture de la langue (tunisien
      // en arabizi alors que l'écriture arabe est choisie…) relance le tuteur une fois.
      if (!ecritureConforme(data.reply, s.cfg.ecriture)) {
        setStatus({ text: `${s.cfg.tutor.name} réécrit sa réplique dans ${LIBELLES[s.cfg.ecriture] || "la bonne écriture"}…`, error: false });
        if (streamed) speech.stopSpeaking();
        const ctl = await controleEcriture({
          data, ecriture: s.cfg.ecriture, historique: s.history,
          relance: (messages) => callModel(settings, { ...opts, messages, onDelta: undefined }),
        });
        console.info(`[écriture] relance ${ctl.conforme ? "réussie" : "sans effet"} (${s.cfg.ecriture})`);
        data = ctl.data;
        streamed = false; // voix coupée ci-dessus : la réplique retenue sera dite en entier
        relance = true;
      }
      // Mesuré après l'éventuelle relance d'écriture (#110, D3) : l'élève attend les deux
      // appels, la sonde chronométrait avant la relance et n'en voyait qu'un.
      const alerteLenteur = sonde(s.mode === "eval" ? "evaluation" : "tour", chrono, recu, relance);
      chrono = null;
      // Personnage mystère (#105) : un métier échappé dans les champs en français est masqué.
      if (s.mystere) {
        const ex = expurge(data, s.mystere);
        data = ex.data;
        if (ex.fuite) console.info("[mystère] fuite masquée");
        if (text !== "[START]" && !s.mystere.revele) s.questions++;
      }
      s.history.push({ role: "assistant", content: data.reply });
      if (s.mode === "eval") {
        setMessages(m => [...m, {
          role: "tutor",
          text: data.reply,
          reading: data.reading,
          translation: data.translation,
          assessed: data.done ? { level: data.level, explanation: data.explanation } : null,
        }]);
      } else {
        const correction = data.correction && data.correction.original !== data.correction.corrected
          ? data.correction : null;
        setMessages(m => [...retireProvisoire(m), {
          role: "tutor",
          text: data.reply,
          reading: data.reading,
          translation: data.translation,
          correction,
          culturalNote: data.cultural_note,
        }]);
        setSuggestions(data.suggestions || []);
        // Missions de scénario (#91) : annoncées au premier tour, cochées ensuite. L'état de
        // référence vit dans la session (synchrone) ; le state ne sert qu'au rendu.
        // Erreurs injectées : marquées « réactivées » au premier tour RÉUSSI de la séance, pas
        // seulement au [START] — un [START] en échec suivi d'un message de l'élève les
        // laissait non marquées (#107, E4).
        const aMarquer = erreursAMarquer(s);
        if (aMarquer.length) {
          s.erreursMarquees = true;
          loadJSON(keys.erreurs, []).then(carnet => {
            const next = marqueReactivees(carnet, aMarquer);
            if (next !== carnet) saveJSON(keys.erreurs, next);
          }).catch(err => console.warn("[carnet d'erreurs]", err));
        }
        // Missions de scénario : lues au [START], et au tour suivant si le modèle n'en avait
        // annoncé aucune (#101, M3) — le schéma du tour les redemande tant que la liste est vide.
        if (s.mystere) {
          // Pas de missions dans ce scénario.
        } else if (!s.missions.liste.length) {
          s.missions = { liste: missionsValides(data.missions), atteintes: [] };
          // L'historique ne porte que les répliques : sans réinjection, le modèle oublie sa
          // liste dès le tour suivant et en réinvente une autre.
          if (s.missions.liste.length) s.system = buildTutorPrompt({ ...s.ctx, missions: s.missions.liste });
          // Aucune mission au [START] : le tour suivant les exige explicitement (M5).
          else s.system = buildTutorPrompt({ ...s.ctx, missionsEnRetard: true });
        } else {
          const atteintes = fusionneAtteints(s.missions.atteintes, data.missions_accomplies, s.missions.liste.length);
          statutMission = messageMission(s.missions.liste, atteintes, atteintes.length - s.missions.atteintes.length) || "";
          if (s.lecon && statutMission && atteintes.length >= s.missions.liste.length) {
            statutMission = s.lecon.bilan
              ? `🏅 Bilan réussi : niveau ${s.lecon.cecrl} validé ! Appuie sur ✅ pour ton résumé.`
              : `🎉 Leçon « ${s.lecon.titre} » validée ! Appuie sur ✅ pour ton résumé, puis passe à la suivante.`;
          }
          s.missions = { ...s.missions, atteintes };
        }
        setMissions(s.missions);
        recordSessionTurn();
        if (correction) {
          loadJSON(keys.erreurs, []).then(carnet => {
            const next = ajouteErreur(carnet, langId, correction);
            if (next !== carnet) saveJSON(keys.erreurs, next);
          }).catch(err => console.warn("[carnet d'erreurs]", err));
        }
        if (Array.isArray(data.vocabulary) && data.vocabulary.length) {
          loadJSON(keys.deck, []).then(deck => {
            const next = addVocabulary(deck, langId, data.vocabulary);
            if (next !== deck) saveJSON(keys.deck, next);
          });
        }
      }
      setStatus({ text: [statutMission, alerteLenteur].filter(Boolean).join(" "), error: false });
      if (settings.autospeak && !streamed) {
        speech.speak(data.reply, {
          ttsPrefixes: s.cfg.ttsPrefixes,
          stt: s.cfg.stt,
          support: s.cfg.support,
          voixServeur: s.cfg.voixServeur,
          langue: s.cfg.label,
          rate: settings.rate,
        });
      }
    } catch (err) {
      sondeEchec(s.mode === "eval" ? "evaluation" : "tour", chrono, err, recu);
      s.history.pop();
      // Une réplique streamée a pu commencer à être dite avant l'échec (réponse coupée par
      // le plafond de jetons, flux interrompu) : la bulle disparaît, la voix aussi (T1).
      if (streamed) speech.stopSpeaking();
      setMessages(retireProvisoire);   // retire le provisoire s'il y en a un
      setStatus({ text: err.message, error: true });
    }
    setBusy(false);
  };

  // Devinette du personnage mystère (#105) : vérifiée localement, sans appel au modèle. Le
  // prompt est reconstruit pour que le tuteur sache que le jeu est fini.
  const deviner = (propose) => {
    const s = session.current;
    if (busy) return;
    const next = devine(s.mystere, propose);
    if (!next) return;
    s.mystere = next;
    s.ctx = { ...s.ctx, mystere: next };
    s.system = buildTutorPrompt({ ...s.ctx, missions: s.missions.liste });
    setMystere(next);
    setDevinetteOuverte(false);
    const feminin = !!s.cfg.tutor.f;
    setMessages(m => [...m, { role: "mystere", text: messageRevelation(next, s.questions, feminin), trouve: next.revele.trouve }]);
    setStatus({ text: "", error: false });
    if (s.id) {
      loadJSON(keys.history, []).then(history => {
        const entry = history.find(h => h.id === s.id);
        if (!entry) return;
        entry.mystere = entreeMystere(next, s.questions);
        saveJSON(keys.history, history);
      }).catch(() => {});
    }
  };

  const adoptLevel = (cefr) => {
    const lvl = CEFR_TO_LEVEL[cefr];
    if (lvl) {
      setLevel(lvl);
      setStatus({ text: `Niveau réglé sur « ${LEVELS.find(l => l[0] === lvl)[1]} ». Bonne pratique !`, error: false });
    }
    setScreen("home");
  };

  // ---------- Micro ----------

  const startMic = () => {
    // Pas pendant une répétition (#95) : la phrase répétée partirait au tuteur.
    if (busy || micMuted || listening || repeteEnCours !== null) return;
    const s = session.current;
    if (!s.recognizer) {
      s.recognizer = speech.createRecognizer({
        lang: s.cfg.stt,
        support: s.cfg.support,
        onStart: () => setListening(true),
        onInterim: (t) => setStatus({ text: `🎤 « ${t} »`, error: false }),
        onResult: (t) => send(t),
        onError: (msg) => setStatus({ text: msg, error: true }),
        onEnd: () => setListening(false),
      });
    }
    if (!s.recognizer) {
      setStatus({ text: speech.messageMicroIndisponible(), error: true });
      return;
    }
    setStatus({ text: `🎤 Je t'écoute… parle en ${s.cfg.label.toLowerCase()} !`, error: false });
    s.recognizer.start();
  };

  const stopMic = () => {
    if (session.current.recognizer && listening) session.current.recognizer.stop();
  };

  // « Répète après moi » (#95) : l'élève répète la réplique `i` du tuteur ; ce qui est entendu
  // est aligné mot à mot sur le texte, jamais envoyé au tuteur. Le recognizer est distinct de
  // celui de la conversation et jeté après l'essai.
  const repeter = (i, texte) => {
    if (busy || listening || repeteEnCours !== null) return;
    const s = session.current;
    speech.primeSpeech();
    speech.stopSpeaking();
    const poseResultat = (resultat) =>
      setMessages(m => m.map((x, j) => (j === i ? { ...x, repetition: resultat } : x)));
    const rec = speech.createRecognizer({
      lang: s.cfg.stt,
      support: s.cfg.support,
      onStart: () => setRepeteEnCours(i),
      onInterim: (t) => setStatus({ text: `🎤 « ${t} »`, error: false }),
      onResult: (t) => {
        const resultat = scorePrononciation(texte, t, langId);
        poseResultat(resultat);
        setStatus({ text: "", error: false });
        if (s.id) {
          loadJSON(keys.history, []).then(history => {
            const k = history.findIndex(h => h.id === s.id);
            if (k === -1) return;
            history[k] = integreScore(history[k], resultat.score);
            saveJSON(keys.history, history);
          });
        }
      },
      onError: (msg) => setStatus({ text: msg, error: true }),
      onEnd: () => setRepeteEnCours(null),
    });
    if (!rec) {
      setStatus({ text: speech.messageMicroIndisponible(), error: true });
      return;
    }
    setStatus({ text: "🎤 Répète la phrase…", error: false });
    rec.start();
  };

  // « Explique-moi » (#97) : explication de la correction de la réplique `i`, au niveau de
  // la séance, avec exemple et contre-exemple ; consignée au carnet d'erreurs. Une
  // explication déjà consignée au même niveau est relue sans appeler le modèle.
  const expliquer = async (i, correction) => {
    const s = session.current;
    const lvl = s.ctx?.level || level;
    const lang = s.lang || langId;
    const pose = (explique) => setMessages(m => m.map((x, j) => (j === i ? { ...x, explique } : x)));
    const carnet = await loadJSON(keys.erreurs, []);
    const deja = explicationConsignee(carnet, lang, correction, lvl);
    if (deja) { pose({ etat: "ok", ...deja }); return; }
    pose({ etat: "chargement" });
    let chrono = null;
    try {
      const { system, messages: msgs } = expliqueRequete({ cfg: s.cfg, level: lvl, correction });
      chrono = creeChrono();
      const raw = await callModel(settings, { system, messages: msgs, schema: EXPLAIN_SCHEMA, maxTokens: MAX_TOKENS.explique });
      const alerte = sonde("explique", chrono);
      chrono = null;
      if (alerte) setStatus({ text: alerte, error: false });
      const explication = expliqueValide(raw);
      if (!explication) throw new Error("Le tuteur n'a pas su expliquer cette correction — réessaie.");
      pose({ etat: "ok", ...explication });
      const frais = await loadJSON(keys.erreurs, []);
      const next = consigneExplication(frais, lang, correction, explication, lvl);
      if (next !== frais) saveJSON(keys.erreurs, next);
    } catch (err) {
      sondeEchec("explique", chrono, err);
      pose({ etat: "erreur", message: err.message });
    }
  };

  const toggleMute = () => {
    const muted = !micMuted;
    setMicMuted(muted);
    if (muted) stopMic();
    setStatus({
      text: muted ? "🔇 Micro coupé — réactive-le quand tu veux." : "Micro réactivé.",
      error: false,
    });
  };

  // ---------- Rendu ----------

  const targetStyle = cfg.rtl ? { writingDirection: "rtl", textAlign: "right" } : null;

  if (screen === "home") {
    return (
      <View style={st.root}>
        <StatusBar style="light" />
        <View style={st.header} {...MARGE_HAUT}>
          <Text style={st.headerTitle}>Polyglotte</Text>
          <Pressable onPress={() => setSettingsOpen(true)}><Text style={st.headerBtn}>⚙️</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={st.homeBody}>
          <Text style={ui.sectionTitle}>Langue</Text>
          <View style={ui.chipRow}>
            {Object.entries(LANGUAGES).map(([id, l]) => (
              <Chip key={id} label={l.label} active={langId === id} onPress={() => { setLangId(id); setScenarioId("libre"); }} />
            ))}
          </View>
          {langId === "tunisien" && (
            <View style={ui.chipRow}>
              <Chip label="Écriture arabe" active={tnScript === "arabe"} onPress={() => setTnScript("arabe")} />
              <Chip label="Arabizi (latin)" active={tnScript === "arabizi"} onPress={() => setTnScript("arabizi")} />
            </View>
          )}
          <Text style={ui.sectionTitle}>Niveau</Text>
          <View style={ui.chipRow}>
            {LEVELS.map(([id, label]) => (
              <Chip key={id} label={label} active={level === id} onPress={() => setLevel(id)} />
            ))}
            <Chip label="🎓 Test de niveau" active={false} onPress={() => startSession("eval")} />
          </View>
          {(() => {
            const suivante = prochaineLecon(level, validees);
            const av = avancement(level, validees);
            const bilan = prochainBilan(level, validees, niveauxOk);
            return (
              <View style={[ui.card, { marginTop: 12 }]}>
                <Text style={st.parcoursTitre}>
                  📚 Parcours {LEVELS.find(l => l[0] === level)[1].toLowerCase()} — {av.faites} / {av.total} leçon{av.total > 1 ? "s" : ""}
                </Text>
                {bilan && (
                  <>
                    <Text style={ui.label}>Les six leçons {bilan} sont validées : passe le bilan pour valider le niveau.</Text>
                    <Pressable onPress={() => startSession("chat", bilanNiveau(bilan))} style={ui.primaryBtn}>
                      <Text style={ui.primaryBtnText}>🏅 Passer le bilan {bilan}</Text>
                    </Pressable>
                  </>
                )}
                {suivante ? (
                  <>
                    <Text style={ui.label}>Prochaine leçon : {numero(suivante)} · {suivante.titre}</Text>
                    <Pressable onPress={() => startSession("chat", suivante)} style={bilan ? ui.secondaryBtn : ui.primaryBtn}>
                      <Text style={bilan ? ui.secondaryBtnText : ui.primaryBtnText}>▶ Commencer la leçon</Text>
                    </Pressable>
                  </>
                ) : !bilan && (
                  <Text style={ui.label}>Toutes les leçons de ce niveau sont validées 🎉 — passe au niveau suivant.</Text>
                )}
                <Pressable onPress={() => setScreen("parcours")}>
                  <Text style={[ui.status, { textAlign: "center" }]}>Voir le programme du niveau →</Text>
                </Pressable>
              </View>
            );
          })()}
          <Text style={ui.sectionTitle}>Ou conversation libre — scénario</Text>
          <View style={ui.chipRow}>
            {scenarios.map(([id, label]) => (
              <Chip key={id} label={label} active={scenarioId === id} onPress={() => setScenarioId(id)} />
            ))}
          </View>
          <View style={st.switchRow}>
            <Text style={ui.label}>Immersion totale (aucune correction affichée)</Text>
            <Switch value={immersion} onValueChange={setImmersion} trackColor={{ true: C.primary }} />
          </View>
          <Pressable onPress={() => startSession("chat")} style={[ui.primaryBtn, { marginTop: 20 }]}>
            <Text style={ui.primaryBtnText}>🎙️ Commencer la conversation</Text>
          </Pressable>
          <View style={[ui.chipRow, { marginTop: 12 }]}>
            <Pressable onPress={() => setScreen("grammar")} style={[ui.secondaryBtn, st.navBtn]}>
              <Text style={ui.secondaryBtnText}>🧠 Grammaire</Text>
            </Pressable>
            <Pressable onPress={() => setScreen("exos")} style={[ui.secondaryBtn, st.navBtn]}>
              <Text style={ui.secondaryBtnText}>✍️ Exercices</Text>
            </Pressable>
            <Pressable onPress={() => setScreen("progress")} style={[ui.secondaryBtn, st.navBtn]}>
              <Text style={ui.secondaryBtnText}>📊 Progrès</Text>
            </Pressable>
          </View>
          {!!status.text && <Text style={[ui.status, status.error && ui.statusError]}>{status.text}</Text>}
          <Text style={st.hint}>
            Version 2 (aperçu) — l'app complète reste disponible sur la page principale.
          </Text>
        </ScrollView>
        <SettingsModal
          visible={settingsOpen}
          settings={settings}
          profiles={profiles}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
          onSwitchProfile={switchProfile}
          onAddProfile={addProfile}
          onDeleteProfile={deleteProfile}
        />
      </View>
    );
  }

  if (screen !== "chat") {
    return (
      <View style={st.root}>
        <StatusBar style="light" />
        <View style={st.header} {...MARGE_HAUT}>
          <Pressable onPress={() => { speech.stopSpeaking(); setScreen("home"); }}>
            <Text style={st.headerBtn}>←</Text>
          </Pressable>
          <Text style={st.headerTitle}>{SCREEN_TITLES[screen]}</Text>
          <Pressable onPress={() => setSettingsOpen(true)}><Text style={st.headerBtn}>⚙️</Text></Pressable>
        </View>
        {screen === "grammar" && (
          <GrammarScreen settings={settings} cfg={cfg} level={level} onOpenSettings={() => setSettingsOpen(true)} />
        )}
        {screen === "exos" && (
          <ExercisesScreen settings={settings} cfg={cfg} langId={langId} level={level} onOpenSettings={() => setSettingsOpen(true)} />
        )}
        {screen === "progress" && <ProgressScreen settings={settings} keys={keys} />}
        {screen === "parcours" && (
          <ParcoursScreen cfg={cfg} level={level} validees={validees} niveauxOk={niveauxOk} onStart={(lecon) => startSession("chat", lecon)} />
        )}
        <SettingsModal
          visible={settingsOpen}
          settings={settings}
          profiles={profiles}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
          onSwitchProfile={switchProfile}
          onAddProfile={addProfile}
          onDeleteProfile={deleteProfile}
        />
      </View>
    );
  }

  return (
    <View style={st.root}>
      <StatusBar style="light" />
      <View style={st.header} {...MARGE_HAUT}>
        <Pressable onPress={() => { speech.stopSpeaking(); stopMic(); setScreen("home"); }}>
          <Text style={st.headerBtn}>←</Text>
        </Pressable>
        <Text style={st.headerTitle}>
          {session.current.mode === "eval" ? "🎓 Test de niveau"
            : session.current.lecon ? `📚 ${numero(session.current.lecon)} · ${session.current.lecon.titre}`
            : `${session.current.cfg?.tutor.name} · ${session.current.cfg?.tutor.city}`}
        </Text>
        <Pressable onPress={endSession}><Text style={st.headerBtn}>✅</Text></Pressable>
      </View>
      {session.current.mode === "chat" && missions.liste.length > 0 && (
        <View style={st.missions}>
          {missions.liste.map((m, i) => {
            const ok = missions.atteintes.includes(i + 1);
            return (
              <Text key={i} style={[st.missionLigne, ok && st.missionOk]}>{ok ? "☑" : "☐"} {m}</Text>
            );
          })}
        </View>
      )}
      {session.current.mode === "chat" && mystere && !mystere.revele && (
        <View style={st.missions}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={[st.missionLigne, { flex: 1 }]}>
              🕵️ Devine le métier de {session.current.cfg?.tutor.name} en lui posant des questions
              {session.current.questions < QUESTIONS_MIN ? ` (encore ${QUESTIONS_MIN - session.current.questions} avant de deviner)` : "."}
            </Text>
            <Chip
              label={devinetteOuverte ? "Fermer" : "Je devine"}
              active={devinetteOuverte}
              disabled={busy || session.current.questions < QUESTIONS_MIN}
              onPress={() => setDevinetteOuverte(o => !o)}
            />
          </View>
          {devinetteOuverte && (
            <View style={[ui.chipRow, { marginTop: 4 }]}>
              {mystere.choix.map(id => (
                <Chip key={id} label={intitule(id, !!session.current.cfg?.tutor.f)} active={false} onPress={() => deviner(id)} />
              ))}
            </View>
          )}
        </View>
      )}
      <ScrollView
        ref={scrollRef}
        style={st.chat}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m, i) => (
          <View key={i}>
            {m.role === "user" && (
              <View style={[st.bubble, st.bubbleUser]}>
                <Text style={st.bubbleUserText}>{m.text}</Text>
              </View>
            )}
            {m.role === "tutor" && (
              <View style={[st.bubble, st.bubbleTutor]}>
                <Pressable onPress={() => { speech.primeSpeech(); speech.speak(m.text, { ttsPrefixes: session.current.cfg.ttsPrefixes, stt: session.current.cfg.stt, support: session.current.cfg.support, voixServeur: session.current.cfg.voixServeur, langue: session.current.cfg.label, rate: settings.rate }); }}>
                  <Text style={[st.targetText, targetStyle]}>{m.text}</Text>
                </Pressable>
                {!!m.reading && <Text style={st.reading}>{m.reading}</Text>}
                {!!m.translation && <Text style={st.translation}>{m.translation}</Text>}
                {m.correction && (
                  <View style={st.correction}>
                    <Text style={st.correctionTitle}>✏️ Correction</Text>
                    <Text style={st.correctionLine}>✗ {m.correction.original}</Text>
                    <Text style={st.correctionLineOk}>✓ {m.correction.corrected}</Text>
                    <Text style={st.correctionExpl}>{m.correction.explanation}</Text>
                    {m.explique?.etat !== "ok" && (
                      <View style={st.expliqueRow}>
                        <Chip
                          label={m.explique?.etat === "chargement" ? "💡 J'explique…" : "💡 Explique-moi"}
                          active={false}
                          disabled={m.explique?.etat === "chargement"}
                          onPress={() => expliquer(i, m.correction)}
                        />
                        {m.explique?.etat === "erreur" && <Text style={st.expliqueErreur}>{m.explique.message}</Text>}
                      </View>
                    )}
                    {m.explique?.etat === "ok" && (
                      <View style={st.explique}>
                        {!!m.explique.title && <Text style={st.expliqueTitre}>💡 {m.explique.title}</Text>}
                        <Text style={st.expliqueTexte}>{m.explique.content}</Text>
                        {!!m.explique.exemple && <Text style={st.expliqueOk}>✓ {m.explique.exemple}</Text>}
                        {!!m.explique.contre_exemple && <Text style={st.expliqueKo}>✗ {m.explique.contre_exemple}</Text>}
                      </View>
                    )}
                  </View>
                )}
                {!!m.culturalNote && (
                  <View style={st.culture}>
                    <Text style={st.cultureText}>🌍 {m.culturalNote}</Text>
                  </View>
                )}
                {m.assessed && (
                  <View style={st.assessed}>
                    <Text style={st.assessedLevel}>Niveau estimé : {m.assessed.level}</Text>
                    <Text style={st.correctionExpl}>{m.assessed.explanation}</Text>
                    <Pressable onPress={() => adoptLevel(m.assessed.level)} style={[ui.primaryBtn, { marginTop: 8 }]}>
                      <Text style={ui.primaryBtnText}>Adopter ce niveau</Text>
                    </Pressable>
                  </View>
                )}
                {!m.streaming && session.current.cfg?.repetition !== false && (
                  <View style={st.repeterRow}>
                    <Chip
                      label={repeteEnCours === i ? "🎤 J'écoute…" : m.repetition ? "🎤 Réessayer" : "🎤 Répéter"}
                      active={repeteEnCours === i}
                      disabled={busy || listening || (repeteEnCours !== null && repeteEnCours !== i)}
                      onPress={() => repeter(i, m.text)}
                    />
                    {m.repetition && (
                      <Text style={st.repetitionScore}>{appreciation(m.repetition.score)} — {m.repetition.score} %</Text>
                    )}
                  </View>
                )}
                {m.repetition && (
                  <View style={st.repetition}>
                    <Text style={[st.repetitionMots, targetStyle]}>
                      {m.repetition.tokens.map((t, k) => (
                        <Text key={k} style={m.repetition.reconnus[k] ? st.motOk : st.motManque}>
                          {t}{m.repetition.isCharBased || k === m.repetition.tokens.length - 1 ? "" : " "}
                        </Text>
                      ))}
                    </Text>
                    <Text style={st.repetitionEntendu}>
                      {m.repetition.entendu ? `Entendu : « ${m.repetition.entendu} »` : "Je n'ai rien entendu."}
                    </Text>
                  </View>
                )}
              </View>
            )}
            {(m.role === "mystere" || m.role === "info") && (
              <View style={[st.bubble, st.bubbleSummary]}>
                <Text style={st.summaryText}>{m.text}</Text>
              </View>
            )}
            {m.role === "summary" && (
              <View style={[st.bubble, st.bubbleSummary]}>
                <Text style={st.summaryTitle}>📋 Résumé de session</Text>
                <Text style={st.summaryText}>{m.text}</Text>
                {m.resume?.points_forts?.length > 0 && (
                  <Text style={st.summaryExtra}>👍 {m.resume.points_forts.join(" · ")}</Text>
                )}
                {!!m.resume?.conseil && <Text style={st.summaryExtra}>💡 {m.resume.conseil}</Text>}
                {!!m.resume?.niveau_observe && (
                  <Text style={st.summaryExtra}>🎓 Niveau observé aujourd'hui : {m.resume.niveau_observe}</Text>
                )}
                {m.resume && (m.resume.erreurs.length > 0 || m.resume.vocabulaire.length > 0) && (
                  <Text style={st.summaryHint}>
                    {m.resume.vocabulaire.length > 0 ? `${m.resume.vocabulaire.length} mot${m.resume.vocabulaire.length > 1 ? "s" : ""} au carnet` : ""}
                    {m.resume.vocabulaire.length > 0 && m.resume.erreurs.length > 0 ? " · " : ""}
                    {m.resume.erreurs.length > 0 ? `${m.resume.erreurs.length} erreur${m.resume.erreurs.length > 1 ? "s" : ""} à revoir` : ""}
                    {" — retrouve-les dans 📊 Progrès."}
                  </Text>
                )}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
      {suggestions.length > 0 && (
        <ScrollView horizontal style={st.suggestions} contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
          {suggestions.map((sgt, i) => (
            <Chip key={i} label={sgt} active={false} onPress={() => send(sgt)} />
          ))}
        </ScrollView>
      )}
      {!!status.text && <Text style={[ui.status, { paddingHorizontal: 14 }, status.error && ui.statusError]}>{status.text}</Text>}
      <View style={st.inputRow} {...MARGE_BAS}>
        <Pressable onPress={toggleMute} style={[st.roundBtn, micMuted && st.roundBtnMuted]}>
          <Text style={st.roundBtnText}>{micMuted ? "🔇" : "🔈"}</Text>
        </Pressable>
        <TextInput
          style={st.input}
          value={input}
          onChangeText={setInput}
          placeholder={`Écris en ${cfg.label.toLowerCase()} ou en français…`}
          placeholderTextColor={C.faint}
          onSubmitEditing={() => send(input)}
          editable={!busy}
        />
        <Pressable onPress={() => send(input)} style={st.roundBtn} disabled={busy}>
          <Text style={st.roundBtnText}>➤</Text>
        </Pressable>
        <Pressable
          onPress={listening ? stopMic : startMic}
          style={[st.roundBtn, st.micBtn, listening && st.micBtnActive]}
          disabled={busy || micMuted || repeteEnCours !== null}
        >
          <Text style={st.roundBtnText}>🎤</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  parcoursTitre: { fontSize: 16, fontWeight: "700", color: C.text },
  root: { flex: 1, backgroundColor: C.bg, ...(Platform.OS === "web" ? { maxWidth: 780, width: "100%", marginHorizontal: "auto" } : null) },
  header: {
    backgroundColor: C.primary,
    paddingTop: Platform.OS === "web" ? 14 : 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { color: "#fff", fontSize: 19, fontWeight: "700" },
  headerBtn: { color: "#fff", fontSize: 22, paddingHorizontal: 4 },
  homeBody: { padding: 16, gap: 8 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, gap: 10 },
  navBtn: { flexGrow: 1, paddingHorizontal: 10 },
  hint: { color: C.faint, fontSize: 12, marginTop: 16, textAlign: "center" },
  chat: { flex: 1 },
  bubble: { borderRadius: 14, padding: 12, maxWidth: "88%" },
  bubbleUser: { backgroundColor: C.primary, alignSelf: "flex-end" },
  bubbleUserText: { color: "#fff", fontSize: 16 },
  bubbleTutor: { backgroundColor: C.card, alignSelf: "flex-start", borderWidth: 1, borderColor: C.border, gap: 4 },
  targetText: { fontSize: 17, color: C.text, fontWeight: "500" },
  reading: { fontSize: 14, color: C.muted, fontStyle: "italic" },
  translation: { fontSize: 13, color: C.faint },
  correction: { backgroundColor: "#fff7ed", borderRadius: 8, padding: 8, marginTop: 6, gap: 2 },
  correctionTitle: { fontSize: 12, fontWeight: "700", color: C.primary },
  correctionLine: { fontSize: 14, color: C.error },
  correctionLineOk: { fontSize: 14, color: C.ok, fontWeight: "600" },
  correctionExpl: { fontSize: 13, color: "#57534e" },
  expliqueRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 4 },
  expliqueErreur: { fontSize: 12, color: C.error, flexShrink: 1 },
  explique: { borderTopWidth: 1, borderTopColor: "#fed7aa", marginTop: 6, paddingTop: 6, gap: 3 },
  expliqueTitre: { fontSize: 13, fontWeight: "700", color: C.primary },
  expliqueTexte: { fontSize: 13, color: "#44403c", lineHeight: 19 },
  expliqueOk: { fontSize: 13, color: C.ok },
  expliqueKo: { fontSize: 13, color: C.error },
  culture: { backgroundColor: "#eff6ff", borderRadius: 8, padding: 8, marginTop: 6 },
  cultureText: { fontSize: 13, color: "#1e40af" },
  repeterRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" },
  repetitionScore: { fontSize: 13, color: C.muted, fontWeight: "600" },
  repetition: { backgroundColor: "#f5f5f4", borderRadius: 8, padding: 8, marginTop: 4, gap: 2 },
  repetitionMots: { fontSize: 15 },
  motOk: { color: C.ok },
  motManque: { color: C.error, fontWeight: "700", textDecorationLine: "underline" },
  repetitionEntendu: { fontSize: 12, color: C.muted, fontStyle: "italic" },
  assessed: { backgroundColor: "#f0fdf4", borderRadius: 8, padding: 10, marginTop: 6 },
  assessedLevel: { fontSize: 16, fontWeight: "800", color: C.ok },
  bubbleSummary: { backgroundColor: "#fffbeb", alignSelf: "stretch", maxWidth: "100%", borderWidth: 1, borderColor: "#fde68a" },
  summaryTitle: { fontWeight: "700", color: "#92400e", marginBottom: 6 },
  summaryText: { color: "#44403c", fontSize: 14, lineHeight: 21 },
  summaryExtra: { color: "#78350f", fontSize: 13, lineHeight: 19, marginTop: 6 },
  summaryHint: { color: C.muted, fontSize: 12, marginTop: 6 },
  suggestions: { maxHeight: 44, marginBottom: 4 },
  missions: { backgroundColor: "#fffbeb", borderBottomWidth: 1, borderBottomColor: "#fde68a", paddingHorizontal: 14, paddingVertical: 6, gap: 2 },
  missionLigne: { fontSize: 13, color: "#92400e" },
  missionOk: { color: C.ok, fontWeight: "600" },
  inputRow: { flexDirection: "row", gap: 8, padding: 10, alignItems: "center", backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border },
  input: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14, fontSize: 15, color: C.text, backgroundColor: C.bg },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#f5f5f4", alignItems: "center", justifyContent: "center" },
  roundBtnMuted: { backgroundColor: "#fecaca" },
  micBtn: { backgroundColor: C.primary },
  micBtnActive: { backgroundColor: "#16a34a" },
  roundBtnText: { fontSize: 18 },
});
