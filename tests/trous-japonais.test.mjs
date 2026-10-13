// Texte à trous japonais (#125) : séries illisibles écartées, trous sur la forme en て.
// Phrases tirées de séries réelles du résident via gw (13/10) ; sur 2.0.0-beta.43, toutes
// les phrases « coupées » ci-dessous étaient gardées.
import { test } from "node:test";
import assert from "node:assert/strict";

import { TROU, bilanTrous, defautJaponais, demandeTrous, formeTeFausse, formesTe, trousValides } from "../app/core/trous.js";
import { langConfig } from "../app/core/languages.js";

const JA = { charBased: true, ecriture: "japonais" };
const TE = "La forme en て (demander, enchaîner, -ている)";
const p = (phrase, reponse, indice = "indice") => ({ phrase, reponse, indice, traduction: "t", reading: "r" });

test("defautJaponais : formes coupées par le trou (sorties réelles)", () => {
  const coupees = [
    ["図書館で本を___て、コーヒーを飲みました。", "読ん", "coupee"],          // 読んて
    ["今、公園で猫がご飯を___ています。", "食べて", "doublon"],               // 食べてています
    ["明日、先生に日本語の質問を___ていいですか。", "して", "doublon"],        // しててい
    ["昨日、新宿で友達に___ましたか？", "会って", "coupee"],                  // 会ってましたか
    ["しばらく ___ ました。", "待ちました", "doublon"],                       // 待ちましたました
    ["今、電車の中でスマホを___している。", "見る", "coupee"],                 // 見るしている
    ["カフェでコーヒーを飲みながら、レポートを___した。", "書い", "coupee"],     // 書いした
    ["隣の住人の騒音が、毎晩 ___ されている。", "聞こえ", "coupee"],           // 聞こえされている
    ["駅で___を待った。", "電車を待って", "coupee"],                           // 待ってを待った
    ["来週の金曜日までに、レポートを___ください。", "お出しください", "doublon"],
    ["明日は友達と浅草に___行きます。", "食べに行", "doublon"],               // 行行きます
    ["明日、渋谷のカフェで先生と日本語を___予定です。", "話します", "coupee"],  // 話します予定
    ["駅近くは騒がしいので、静かに___のが難しいです。", "話せ", "coupee"],      // 話せのが
    ["私は ___ 東京に住みます。", "に", "particules"],                        // 私はに
    ["私は毎日___ご飯を食べます。", "を", "particules"],                       // 毎日をご飯を
    ["わたし は がっこう に ___ 。", "いきます", "espaces"],
    ["それは ___ です。", "本", "vocabulaire"],
    ["あそこ ___ です。", "公園", "vocabulaire"],
    ["___を買いました。", "パン", "vocabulaire"],
  ];
  for (const [phrase, reponse, motif] of coupees) assert.equal(defautJaponais(phrase, reponse), motif, `${phrase} / ${reponse}`);
});

test("defautJaponais : phrases justes gardées (sorties réelles)", () => {
  const justes = [
    ["昼ご飯を___、それから映画を見ました。", "食べて"],
    ["今、学校に___います。", "は"],                 // には : cumul juste
    ["これは___ですか。", "いくら"],
    ["明日は雨が___だね。", "降りそう"],
    ["あの映画は___たけど、時間が合わなくて", "見たかっ"], // 見たかったけど
    ["電車が___たので、仕事に遅刻しそうなんで", "遅れてい"],
    ["これは本___。", "です"],
    ["地下鉄の改札を通る___、切符を買ってください。", "前に"],
    ["今、新宿の公園で犬を___いる。", "散歩させて"],
    ["この店では、クレジットカードで___。", "払えます"],
    ["この店は、日本語が___ので、外国人にも人気です。", "話せます"],
    ["先生、この漢字の読み方を___。", "教えてください"],
    ["あなたは日本語が___か。", "話します"],
    ["今日は雨です。だから傘___。", "を使います"],
  ];
  for (const [phrase, reponse] of justes) assert.equal(defautJaponais(phrase, reponse), null, `${phrase} / ${reponse}`);
});

test("formesTe : conjugaison de la forme en て", () => {
  assert.deepEqual(formesTe("待つ"), ["待って"]);
  assert.deepEqual(formesTe("買う"), ["買って"]);
  assert.deepEqual(formesTe("読む"), ["読んで"]);
  assert.deepEqual(formesTe("遊ぶ"), ["遊んで"]);
  assert.deepEqual(formesTe("歩く"), ["歩いて"]);
  assert.deepEqual(formesTe("行く"), ["行って"]);
  assert.deepEqual(formesTe("泳ぐ"), ["泳いで"]);
  assert.deepEqual(formesTe("話す"), ["話して"]);
  assert.deepEqual(formesTe("する"), ["して"]);
  assert.deepEqual(formesTe("勉強する"), ["勉強して"]);
  assert.deepEqual(formesTe("来る"), ["来て"]);
  assert.deepEqual(formesTe("曲がる"), ["曲がって"]);
  assert.ok(formesTe("起きる").includes("起きて"));
  assert.ok(formesTe("帰る").includes("帰って"), "kanji + る : les deux groupes admis");
  assert.deepEqual(formesTe("本"), []);
});

test("formeTeFausse : contrôlée sur le verbe que donne l'indice", () => {
  assert.equal(formeTeFausse("起いて", "verbe 起きる, enchaîner"), true, "sortie réelle : 起いて pour 起きる");
  assert.equal(formeTeFausse("起きて", "verbe 起きる, enchaîner"), false);
  assert.equal(formeTeFausse("読んで", "lire (読む), enchaîner"), false);
  assert.equal(formeTeFausse("電車を待って", "verbe 待つ"), false);
  assert.equal(formeTeFausse("電話して", "téléphoner, action en cours"), false, "pas de verbe dans l'indice : pas de verdict");
});

test("bilanTrous : série « forme en て » réelle illisible (beta.43 : 5 phrases gardées) → écartée", () => {
  const serie = { phrases: [
    p("昨日、新宿で友達に___ましたか？", "会って"),
    p("今、公園で猫がご飯を___ています。", "食べて"),
    p("駅で傘を___、雨が強く降りました。", "忘れて"),
    p("明日、先生に日本語の質問を___ていいですか。", "して"),
    p("図書館で本を___て、コーヒーを飲みました。", "読ん"),
  ] };
  const b = bilanTrous(serie, { ...JA, point: TE });
  assert.equal(b.phrases, null);
  assert.equal(b.illisible, true);
  assert.equal(b.ecartees.length, 4);
});

test("bilanTrous : la forme en て visée exige une forme en て juste", () => {
  // Sortie réelle : aucun des trous n'était une forme en て (relecture de la nuit du 13/10).
  const horsPoint = { phrases: [
    p("昨日、友達と新宿駅で___。", "会いました"), p("今、カフェでコーヒーを___。", "飲んでいる"),
    p("電車の中で本を読んで___。", "います"), p("映画を___、その後、食事をしました。", "見ました"),
    p("明日、空港まで車で___。", "行きます"),
  ] };
  assert.equal(bilanTrous(horsPoint, { ...JA, point: TE }).phrases, null);
  assert.equal(bilanTrous(horsPoint, JA).phrases.length, 5, "sans point visé, ces formes sont exploitables");
  const bonne = { phrases: [
    p("昼ご飯を___、それから映画を見ました。", "食べて", "manger (食べる), enchaîner"),
    p("窓を___、空気を換えましょう。", "開けて", "ouvrir (開ける)"),
    p("電車を___、駅に着きました。", "降りて", "descendre (降りる)"),
    p("この道を___、交差点が左手に見えますか？", "曲がって", "tourner (曲がる)"),
    p("朝は___から始まる。", "起いて", "verbe 起きる, enchaîner"),
  ] };
  const b = bilanTrous(bonne, { ...JA, point: TE });
  assert.equal(b.phrases.length, 4);
  assert.deepEqual(b.ecartees.map(e => e.motif), ["hors-point"]);
});

test("bilanTrous : trou oublié → la réponse, présente une fois, devient le trou", () => {
  const sansTrou = { phrases: [
    p("この本を読んでから、映画館に行きましょう。", "読んで"),
    p("今、友達と電話しています。", "電話して"),
    p("少し待っていてください。", "待っていて"),
    p("待って、待って。", "待って"),
  ] };
  const b = bilanTrous(sansTrou, { ...JA, point: TE });
  assert.deepEqual(b.phrases.map(x => x.phrase), ["この本を___から、映画館に行きましょう。", "今、友達と___います。", "少し___ください。"]);
  assert.deepEqual(b.ecartees.map(e => e.motif), ["trou"], "deux occurrences : on ne devine pas");
  const es = trousValides({ phrases: [p("¿Dónde está la estación?", "está")] });
  assert.equal(es[0].phrase, `¿Dónde ${TROU} la estación?`, "mot entier hors japonais (pas « estación »)");
});

test("bilanTrous : moins de trois phrases japonaises → série écartée ; autres langues inchangées", () => {
  const deux = { phrases: [p("私は毎日コーヒーを___。", "飲みます"), p("明日、東京へ___。", "行きます")] };
  assert.equal(bilanTrous(deux, JA).illisible, true);
  assert.equal(trousValides({ phrases: [p("Yo ___ en casa.", "estoy")] }).length, 1);
});

test("demandeTrous : consignes japonaises (mot entier, forme en て)", () => {
  const ja = langConfig("japonais");
  assert.match(demandeTrous({ cfg: ja, point: "" }), /mot ENTIER/);
  assert.doesNotMatch(demandeTrous({ cfg: ja, point: "" }), /Forme en て :/);
  assert.match(demandeTrous({ cfg: ja, point: TE }), /Forme en て : CHAQUE réponse est un verbe à la forme en て/);
  assert.doesNotMatch(demandeTrous({ cfg: langConfig("espagnol"), point: "ser y estar" }), /japonais/);
});
