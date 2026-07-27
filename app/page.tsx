"use client";

import { useEffect, useMemo, useState } from "react";
import cardsData from "./data/cards.json";
import termsData from "./data/terms.json";

type View = "home" | "terms" | "cards" | "quiz" | "settings";
type Card = {
  id: number;
  unit: string;
  question: string;
  answer: string;
  note: string;
  importance: string;
  tag: string;
};
type Term = {
  id: number;
  unit: string;
  category: string;
  term: string;
  english: string;
  meaning: string;
  numeric: string;
  importance: string;
  note: string;
};
type Progress = {
  mastered: number[];
  review: number[];
  answered: number;
  correct: number;
  sessions: number;
  streak: number;
  lastStudyDate: string;
};
type QuizQuestion = Card & { choices: string[] };
type Settings = {
  autoAdvance: boolean;
  autoAdvanceDelay: number;
  quizCount: number;
  reviewFirst: boolean;
  importantByDefault: boolean;
};

const cards = cardsData as Card[];
const terms = termsData as Term[];
const units = ["すべて", ...Array.from(new Set(cards.map((card) => card.unit)))];
const unitMeta: Record<string, { short: string; tone: string; icon: string }> = {
  DNS: { short: "名前解決", tone: "violet", icon: "D" },
  NTP: { short: "時刻同期", tone: "cyan", icon: "N" },
  SMTP: { short: "メール送信", tone: "orange", icon: "S" },
  "POP3・メール安全": { short: "メール受信・安全", tone: "pink", icon: "P" },
  "TELNET・SSH": { short: "リモート接続", tone: "green", icon: "T" },
  FTP: { short: "ファイル転送", tone: "blue", icon: "F" },
  IPv6: { short: "次世代IP", tone: "indigo", icon: "6" },
};
const emptyProgress: Progress = {
  mastered: [],
  review: [],
  answered: 0,
  correct: 0,
  sessions: 0,
  streak: 0,
  lastStudyDate: "",
};
const progressStorageKey = "cn-master-progress-v2";
const settingsStorageKey = "cn-master-settings-v1";
const defaultSettings: Settings = {
  autoAdvance: true,
  autoAdvanceDelay: 1500,
  quizCount: 10,
  reviewFirst: true,
  importantByDefault: true,
};

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function createQuiz(unit: string, importantOnly: boolean, count = 10, reviewIds: number[] = []): QuizQuestion[] {
  let source = cards.filter((card) => unit === "すべて" || card.unit === unit);
  if (importantOnly) source = source.filter((card) => card.importance === "★★★");
  const reviewSet = new Set(reviewIds);
  const picked = [
    ...shuffle(source.filter((card) => reviewSet.has(card.id))),
    ...shuffle(source.filter((card) => !reviewSet.has(card.id))),
  ].slice(0, Math.min(count, source.length));
  return picked.map((card) => {
    const sameUnit = cards.filter((item) => item.id !== card.id && item.unit === card.unit);
    const pool = [...sameUnit, ...cards.filter((item) => item.id !== card.id && item.unit !== card.unit)];
    const seen = new Set([card.answer]);
    const distractors: string[] = [];

    for (const candidate of shuffle(pool)) {
      const answer = candidate.answer.trim();
      if (!answer || seen.has(answer)) continue;
      seen.add(answer);
      distractors.push(answer);
      if (distractors.length === 3) break;
    }

    return { ...card, choices: shuffle([card.answer, ...distractors]) };
  });
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [hydrated, setHydrated] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState("すべて");
  const [importantOnly, setImportantOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(progressStorageKey);
      if (saved) setProgress({ ...emptyProgress, ...JSON.parse(saved) });
      const savedSettings = window.localStorage.getItem(settingsStorageKey);
      if (savedSettings) {
        const nextSettings = { ...defaultSettings, ...JSON.parse(savedSettings) };
        setSettings(nextSettings);
        setImportantOnly(nextSettings.importantByDefault);
      } else {
        setImportantOnly(defaultSettings.importantByDefault);
      }
    } catch {
      // The app remains fully usable when browser storage is unavailable.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(progressStorageKey, JSON.stringify(progress));
  }, [progress, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
  }, [settings, hydrated]);

  const filteredCards = useMemo(() => {
    let result = cards.filter((card) => selectedUnit === "すべて" || card.unit === selectedUnit);
    if (importantOnly) result = result.filter((card) => card.importance === "★★★");
    return result;
  }, [selectedUnit, importantOnly]);

  const filteredTerms = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ja");
    return terms.filter((term) => {
      const unitMatch = selectedUnit === "すべて" || term.unit === selectedUnit;
      const text = `${term.term} ${term.english} ${term.meaning} ${term.numeric} ${term.note}`.toLocaleLowerCase("ja");
      return unitMatch && (!query || text.includes(query));
    });
  }, [selectedUnit, search]);

  const masteredCount = progress.mastered.length;
  const completion = Math.round((masteredCount / cards.length) * 100);
  const accuracy = progress.answered ? Math.round((progress.correct / progress.answered) * 100) : 0;
  const currentCard = filteredCards[cardIndex % Math.max(filteredCards.length, 1)];

  useEffect(() => {
    if (view !== "quiz" || !selectedAnswer || quizDone || !settings.autoAdvance) return;
    const timer = window.setTimeout(nextQuizQuestion, settings.autoAdvanceDelay);
    return () => window.clearTimeout(timer);
  }, [view, selectedAnswer, quizIndex, quizDone, settings.autoAdvance, settings.autoAdvanceDelay]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;

      if (view === "quiz" && quiz.length && !quizDone) {
        if (!selectedAnswer && ["1", "2", "3", "4"].includes(event.key)) {
          const choice = quiz[quizIndex]?.choices[Number(event.key) - 1];
          if (choice) answerQuiz(choice);
        } else if (selectedAnswer && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          nextQuizQuestion();
        }
      }

      if (view === "cards" && currentCard) {
        if (event.key === " ") {
          event.preventDefault();
          setFlipped((value) => !value);
        } else if (flipped && event.key === "ArrowLeft") {
          recordStudy(currentCard.id, false);
        } else if (flipped && event.key === "ArrowRight") {
          recordStudy(currentCard.id, true);
        }
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [view, quiz, quizIndex, selectedAnswer, quizDone, currentCard, flipped]);

  function changeView(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function changeUnit(unit: string) {
    setSelectedUnit(unit);
    setCardIndex(0);
    setFlipped(false);
  }

  function recordStudy(id: number, mastered: boolean) {
    setProgress((current) => {
      const today = localDateKey();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const nextStreak = current.lastStudyDate === today
        ? current.streak
        : current.lastStudyDate === localDateKey(yesterday)
          ? current.streak + 1
          : 1;
      return {
        ...current,
        mastered: mastered
          ? Array.from(new Set([...current.mastered, id]))
          : current.mastered.filter((item) => item !== id),
        review: mastered
          ? current.review.filter((item) => item !== id)
          : Array.from(new Set([...current.review, id])),
        streak: nextStreak,
        lastStudyDate: today,
      };
    });
    setFlipped(false);
    setCardIndex((index) => (index + 1) % Math.max(filteredCards.length, 1));
  }

  function startQuiz(unit = selectedUnit, important = importantOnly) {
    setSelectedUnit(unit);
    setImportantOnly(important);
    setQuiz(createQuiz(unit, important, settings.quizCount, settings.reviewFirst ? progress.review : []));
    setQuizIndex(0);
    setSelectedAnswer(null);
    setQuizScore(0);
    setQuizDone(false);
    setView("quiz");
  }

  function answerQuiz(answer: string) {
    if (selectedAnswer) return;
    setSelectedAnswer(answer);
    const isCorrect = answer === quiz[quizIndex].answer;
    if (isCorrect) setQuizScore((score) => score + 1);
    setProgress((current) => ({
      ...current,
      answered: current.answered + 1,
      correct: current.correct + (isCorrect ? 1 : 0),
      mastered: isCorrect
        ? Array.from(new Set([...current.mastered, quiz[quizIndex].id]))
        : current.mastered,
      review: isCorrect
        ? current.review.filter((id) => id !== quiz[quizIndex].id)
        : Array.from(new Set([...current.review, quiz[quizIndex].id])),
      lastStudyDate: localDateKey(),
      streak: current.lastStudyDate === localDateKey() ? current.streak : Math.max(1, current.streak),
    }));
  }

  function nextQuizQuestion() {
    if (quizIndex + 1 >= quiz.length) {
      setQuizDone(true);
      setProgress((current) => ({ ...current, sessions: current.sessions + 1 }));
    } else {
      setQuizIndex((index) => index + 1);
      setSelectedAnswer(null);
    }
  }

  function exitQuiz() {
    if (!window.confirm("クイズを途中で終了しますか？\n回答済みの結果は保存されます。")) return;
    setQuiz([]);
    setQuizIndex(0);
    setSelectedAnswer(null);
    setQuizScore(0);
    setQuizDone(false);
    changeView("home");
  }

  function applyRecommendedSettings() {
    setSettings({
      autoAdvance: true,
      autoAdvanceDelay: 1500,
      quizCount: 10,
      reviewFirst: true,
      importantByDefault: true,
    });
    setImportantOnly(true);
  }

  function resetProgress() {
    if (!window.confirm("学習記録をすべてリセットしますか？\nこの操作は取り消せません。")) return;
    setProgress(emptyProgress);
    window.localStorage.removeItem(progressStorageKey);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => changeView("home")} aria-label="CN MASTER ホーム">
          <span className="brand-mark"><span>CN</span></span>
          <span className="brand-copy"><b>CN MASTER</b><small>Computer Networks II</small></span>
        </button>
        <nav className="desktop-nav" aria-label="メインメニュー">
          <NavButton active={view === "home"} onClick={() => changeView("home")} icon="⌂" label="ホーム" />
          <NavButton active={view === "terms"} onClick={() => changeView("terms")} icon="Aa" label="用語帳" />
          <NavButton active={view === "cards"} onClick={() => changeView("cards")} icon="▣" label="暗記カード" />
          <NavButton active={view === "quiz"} onClick={() => changeView("quiz")} icon="?" label="クイズ" />
          <NavButton active={view === "settings"} onClick={() => changeView("settings")} icon="⚙" label="設定" />
        </nav>
        <div className="streak-pill" title="連続学習日数"><span>◆</span> {progress.streak}日</div>
      </header>

      <main>
        {view === "home" && (
          <div className="page home-page">
            <section className="hero-grid">
              <div className="hero-copy">
                <div className="eyebrow"><span className="pulse-dot" /> 期末試験対策モード</div>
                <h1>ネットワークを、<br /><em>得点源</em>に変える。</h1>
                <p>重要用語からポート番号、通信の流れまで。授業資料に沿った全194問で、迷う知識を「答えられる知識」へ。</p>
                <div className="hero-actions">
                  <button className="button primary" onClick={() => startQuiz("すべて", settings.importantByDefault)}>今日の{settings.quizCount}問を始める <span>→</span></button>
                  <button className="button secondary" onClick={() => changeView("cards")}>暗記カードで復習</button>
                </div>
              </div>
              <div className="progress-orbit" aria-label={`学習達成度 ${completion}%`}>
                <div className="orbit-glow" />
                <div className="progress-ring" style={{ "--progress": `${completion * 3.6}deg` } as React.CSSProperties}>
                  <div className="ring-inner"><small>マスター済み</small><strong>{completion}<span>%</span></strong><p>{masteredCount} / {cards.length} 問</p></div>
                </div>
                <span className="orbit-label label-one">DNS</span>
                <span className="orbit-label label-two">IPv6</span>
                <span className="orbit-label label-three">SSH</span>
              </div>
            </section>

            <section className="stats-row" aria-label="学習状況">
              <StatCard icon="◎" value={String(masteredCount)} label="覚えた問題" detail={`全${cards.length}問中`} tone="purple" />
              <StatCard icon="↗" value={`${accuracy}%`} label="クイズ正答率" detail={`${progress.answered}回答`} tone="cyan" />
              <StatCard icon="◇" value={String(progress.review.length)} label="要復習" detail="間違えた問題" tone="orange" />
              <StatCard icon="⚡" value={String(progress.streak)} label="連続学習" detail="日間ストリーク" tone="pink" />
            </section>

            <section className="section-block">
              <div className="section-heading">
                <div><span className="section-kicker">LEARNING MAP</span><h2>単元から学ぶ</h2></div>
                <button className="text-button" onClick={() => changeView("terms")}>用語一覧を見る <span>→</span></button>
              </div>
              <div className="unit-grid">
                {Object.entries(unitMeta).map(([unit, meta], index) => {
                  const total = cards.filter((card) => card.unit === unit).length;
                  const done = cards.filter((card) => card.unit === unit && progress.mastered.includes(card.id)).length;
                  const pct = Math.round((done / total) * 100);
                  return (
                    <button className={`unit-card ${meta.tone}`} key={unit} onClick={() => { changeUnit(unit); changeView("cards"); }}>
                      <span className="unit-number">0{index + 1}</span>
                      <span className="unit-icon">{meta.icon}</span>
                      <span className="unit-copy"><b>{unit}</b><small>{meta.short}</small></span>
                      <span className="unit-progress"><i><span style={{ width: `${pct}%` }} /></i><small>{done}/{total}</small></span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="focus-banner">
              <div className="focus-symbol">53</div>
              <div><span className="section-kicker">QUICK FOCUS</span><h3>数値問題を先に固めよう</h3><p>DNS 53、NTP 123、SSH 22。頻出ポート番号を短時間で総点検。</p></div>
              <button className="button light" onClick={() => { changeUnit("すべて"); setSearch("TCP"); changeView("terms"); }}>ポート番号を見る →</button>
            </section>
          </div>
        )}

        {view === "terms" && (
          <div className="page content-page">
            <PageTitle kicker="TERM LIBRARY" title="用語帳" description="183語を、意味・正式名称・数値とセットで確認。検索すれば欲しい知識にすぐ届きます。" />
            <div className="toolbar">
              <label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="用語・意味・ポート番号を検索" /></label>
              <UnitSelect value={selectedUnit} onChange={changeUnit} />
            </div>
            <div className="result-note"><b>{filteredTerms.length}</b> 件の用語</div>
            <div className="term-list">
              {filteredTerms.map((term) => (
                <article className="term-row" key={term.id}>
                  <div className="term-leading"><span className={`mini-unit ${unitMeta[term.unit]?.tone ?? "violet"}`}>{unitMeta[term.unit]?.icon ?? "C"}</span><div><span className="term-meta">{term.unit} ・ {term.category}</span><h3>{term.term}</h3>{term.english && <p className="english">{term.english}</p>}</div></div>
                  <div className="term-meaning"><p>{term.meaning}</p>{term.note && <small>{term.note}</small>}</div>
                  <div className="term-numeric">{term.numeric || "—"}</div>
                  <div className="importance" aria-label={`重要度 ${term.importance}`}>{term.importance}</div>
                </article>
              ))}
            </div>
          </div>
        )}

        {view === "cards" && (
          <div className="page content-page cards-page">
            <PageTitle kicker="ACTIVE RECALL" title="暗記カード" description="答えを見る前に、まず声に出す。覚えた問題と要復習は自動で記録されます。" />
            <div className="study-controls">
              <UnitSelect value={selectedUnit} onChange={changeUnit} />
              <label className="toggle"><input type="checkbox" checked={importantOnly} onChange={(event) => { setImportantOnly(event.target.checked); setCardIndex(0); }} /><span /> ★★★だけ</label>
              <span className="card-count">{filteredCards.length ? cardIndex + 1 : 0} / {filteredCards.length}</span>
            </div>
            {currentCard ? (
              <div className="flashcard-wrap">
                <button className={`flashcard ${flipped ? "is-flipped" : ""}`} onClick={() => setFlipped((value) => !value)} aria-label={flipped ? "問題に戻る" : "答えを見る"}>
                  <div className="flashcard-top"><span className={`unit-badge ${unitMeta[currentCard.unit]?.tone}`}>{currentCard.unit}</span><span>{currentCard.importance}</span></div>
                  {!flipped ? (
                    <div className="flashcard-main"><span className="card-side">QUESTION</span><h2>{currentCard.question}</h2><p>タップして答えを見る</p></div>
                  ) : (
                    <div className="flashcard-main answer"><span className="card-side">ANSWER</span><h2>{currentCard.answer}</h2>{currentCard.note && <p className="answer-note">POINT：{currentCard.note}</p>}</div>
                  )}
                  <div className="flashcard-bottom"><span>#{currentCard.tag}</span><span>{flipped ? "↶ 問題に戻る" : "答えを表示 →"}</span></div>
                </button>
                <div className="card-actions">
                  <button className="review-button" onClick={() => recordStudy(currentCard.id, false)}><span>△</span><b>もう一度</b><small>要復習に追加</small></button>
                  <button className="master-button" onClick={() => recordStudy(currentCard.id, true)}><span>✓</span><b>覚えた</b><small>次のカードへ</small></button>
                </div>
                <div className="shortcut-hint"><span><kbd>Space</kbd> 答えを見る</span><span><kbd>←</kbd> もう一度</span><span><kbd>→</kbd> 覚えた</span></div>
              </div>
            ) : <div className="empty-state">条件に合うカードがありません。</div>}
          </div>
        )}

        {view === "quiz" && (
          <div className="page content-page quiz-page">
            <PageTitle kicker="EXAM PRACTICE" title="4択クイズ" description={`本番を意識して、${settings.quizCount}問をテンポよく。間違えた問題は自動で復習リストへ入ります。`} />
            {quiz.length === 0 ? (
              <div className="quiz-setup">
                <div className="setup-copy"><span>{settings.quizCount} QUESTIONS</span><h2>出題範囲を選ぶ</h2><p>{settings.reviewFirst && progress.review.length ? `要復習の${progress.review.length}問から優先して出題します。` : "まずは重要度★★★から始めるのがおすすめです。"}</p></div>
                <div className="setup-options">
                  <UnitSelect value={selectedUnit} onChange={changeUnit} />
                  <label className="toggle"><input type="checkbox" checked={importantOnly} onChange={(event) => setImportantOnly(event.target.checked)} /><span /> ★★★だけ</label>
                  <div className="quiz-settings-summary"><span>{settings.autoAdvance ? `自動進行 ${settings.autoAdvanceDelay / 1000}秒` : "手動進行"}</span><span>{settings.reviewFirst ? "復習優先" : "ランダム"}</span><button onClick={() => changeView("settings")}>設定を変更</button></div>
                  <button className="button primary" onClick={() => startQuiz()}>クイズを開始 →</button>
                </div>
              </div>
            ) : quizDone ? (
              <div className="quiz-result">
                <div className="result-ring"><strong>{quizScore}</strong><span>/ {quiz.length}</span></div>
                <span className="section-kicker">SESSION COMPLETE</span>
                <h2>{quizScore === quiz.length ? "全問正解、完璧です！" : quizScore / quiz.length >= 0.8 ? "かなり仕上がっています！" : "間違いは、伸びしろです。"}</h2>
                <p>今回の正答率は {Math.round((quizScore / quiz.length) * 100)}%。要復習に入った問題を暗記カードで確認しましょう。</p>
                <div className="result-actions"><button className="button primary" onClick={() => startQuiz()}>もう一度挑戦</button><button className="button secondary" onClick={() => { setQuiz([]); changeView("cards"); }}>暗記カードへ</button></div>
              </div>
            ) : (
              <div className="quiz-stage">
                <div className="quiz-progress"><div><span>QUESTION {String(quizIndex + 1).padStart(2, "0")}</span><div className="quiz-progress-actions"><b>{quizIndex + 1} / {quiz.length}</b><button type="button" onClick={exitQuiz} aria-label="クイズを途中で終了">× 終了</button></div></div><i><span style={{ width: `${((quizIndex + 1) / quiz.length) * 100}%` }} /></i></div>
                <div className="question-panel">
                  <div className="question-meta"><span className={`unit-badge ${unitMeta[quiz[quizIndex].unit]?.tone}`}>{quiz[quizIndex].unit}</span><span>{quiz[quizIndex].importance}</span></div>
                  <h2>{quiz[quizIndex].question}</h2>
                  <div className="choice-grid">
                    {quiz[quizIndex].choices.map((choice, index) => {
                      const correct = selectedAnswer && choice === quiz[quizIndex].answer;
                      const wrong = selectedAnswer === choice && choice !== quiz[quizIndex].answer;
                      return <button key={choice} className={`choice ${correct ? "correct" : ""} ${wrong ? "wrong" : ""}`} onClick={() => answerQuiz(choice)} disabled={Boolean(selectedAnswer)} aria-keyshortcuts={String(index + 1)} title={`キー ${index + 1}`}><span>{String.fromCharCode(65 + index)}</span><b>{choice}</b>{correct && <i>✓</i>}{wrong && <i>×</i>}</button>;
                    })}
                  </div>
                  {selectedAnswer && (
                    <div className={`feedback ${selectedAnswer === quiz[quizIndex].answer ? "good" : "bad"} ${settings.autoAdvance ? "is-auto" : ""}`} style={{ "--auto-delay": `${settings.autoAdvanceDelay}ms` } as React.CSSProperties}>
                      <div><b>{selectedAnswer === quiz[quizIndex].answer ? "正解！" : "惜しい！正解を確認しよう"}</b>{quiz[quizIndex].note && <p>ポイント：{quiz[quizIndex].note}</p>}</div>
                      <div className="feedback-actions">{settings.autoAdvance && <span>{settings.autoAdvanceDelay / 1000}秒後に自動で進みます</span>}<button onClick={nextQuizQuestion}>{quizIndex + 1 === quiz.length ? "結果を見る" : "今すぐ次へ"} →</button></div>
                      {settings.autoAdvance && <i className="auto-advance-line" />}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {view === "settings" && (
          <div className="page content-page settings-page">
            <PageTitle kicker="LEARNING SETTINGS" title="学習設定" description="自分のテンポと目的に合わせて、出題方法や自動進行を調整できます。設定はこの端末に保存されます。" />

            <section className="recommended-settings">
              <div><span className="recommended-mark">◎</span><div><b>効率重視のおすすめ設定</b><p>10問・1.5秒で自動進行・要復習と重要問題を優先します。</p></div></div>
              <button className="button primary" onClick={applyRecommendedSettings}>おすすめ設定にする</button>
            </section>

            <div className="settings-grid">
              <section className="settings-card">
                <div className="settings-card-title"><span className="settings-icon purple">▶</span><div><h2>クイズの進み方</h2><p>回答後の操作とテンポ</p></div></div>
                <SettingToggle title="自動で次の問題へ" description="正誤を確認したあと、自動で次へ進みます。" checked={settings.autoAdvance} onChange={(checked) => setSettings((current) => ({ ...current, autoAdvance: checked }))} />
                <div className={`setting-row stacked ${!settings.autoAdvance ? "is-disabled" : ""}`}>
                  <div><b>確認時間</b><p>答えを表示してから次へ進むまで</p></div>
                  <div className="segmented-control" aria-label="自動進行までの時間">
                    {[1500, 2500, 4000].map((delay) => <button key={delay} disabled={!settings.autoAdvance} className={settings.autoAdvanceDelay === delay ? "active" : ""} onClick={() => setSettings((current) => ({ ...current, autoAdvanceDelay: delay }))}>{delay / 1000}秒</button>)}
                  </div>
                </div>
              </section>

              <section className="settings-card">
                <div className="settings-card-title"><span className="settings-icon cyan">#</span><div><h2>出題内容</h2><p>問題数と優先順位</p></div></div>
                <div className="setting-row stacked">
                  <div><b>1回の問題数</b><p>短時間なら5問、しっかり学ぶなら20問</p></div>
                  <div className="segmented-control" aria-label="1回の問題数">
                    {[5, 10, 20].map((count) => <button key={count} className={settings.quizCount === count ? "active" : ""} onClick={() => setSettings((current) => ({ ...current, quizCount: count }))}>{count}問</button>)}
                  </div>
                </div>
                <SettingToggle title="要復習を優先" description={`間違えた問題${progress.review.length ? `（現在${progress.review.length}問）` : ""}を先に出題します。`} checked={settings.reviewFirst} onChange={(checked) => setSettings((current) => ({ ...current, reviewFirst: checked }))} />
                <SettingToggle title="★★★を初期選択" description="新しいクイズを開いたとき重要問題だけを選びます。" checked={settings.importantByDefault} onChange={(checked) => { setSettings((current) => ({ ...current, importantByDefault: checked })); setImportantOnly(checked); }} />
              </section>

              <section className="settings-card shortcuts-card">
                <div className="settings-card-title"><span className="settings-icon orange">⌨</span><div><h2>ショートカット</h2><p>キーボードでさらに速く</p></div></div>
                <div className="shortcut-row"><span>クイズの選択肢</span><div><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd></div></div>
                <div className="shortcut-row"><span>すぐ次の問題へ</span><div><kbd>Enter</kbd></div></div>
                <div className="shortcut-row"><span>カードの答えを表示</span><div><kbd>Space</kbd></div></div>
                <div className="shortcut-row"><span>カードを判定</span><div><kbd>←</kbd><kbd>→</kbd></div></div>
              </section>

              <section className="settings-card data-settings">
                <div className="settings-card-title"><span className="settings-icon pink">◇</span><div><h2>学習データ</h2><p>この端末に保存された記録</p></div></div>
                <div className="data-summary"><span><b>{progress.mastered.length}</b>覚えた</span><span><b>{progress.review.length}</b>要復習</span><span><b>{progress.answered}</b>回答</span></div>
                <button className="danger-button" onClick={resetProgress}>学習記録をリセット</button>
              </section>
            </div>
          </div>
        )}
      </main>

      <nav className="mobile-nav" aria-label="モバイルメニュー">
        <NavButton active={view === "home"} onClick={() => changeView("home")} icon="⌂" label="ホーム" />
        <NavButton active={view === "terms"} onClick={() => changeView("terms")} icon="Aa" label="用語帳" />
        <NavButton active={view === "cards"} onClick={() => changeView("cards")} icon="▣" label="カード" />
        <NavButton active={view === "quiz"} onClick={() => changeView("quiz")} icon="?" label="クイズ" />
        <NavButton active={view === "settings"} onClick={() => changeView("settings")} icon="⚙" label="設定" />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return <button className={active ? "active" : ""} onClick={onClick}><span>{icon}</span>{label}</button>;
}

function StatCard({ icon, value, label, detail, tone }: { icon: string; value: string; label: string; detail: string; tone: string }) {
  return <article className="stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><div><strong>{value}</strong><b>{label}</b><small>{detail}</small></div></article>;
}

function PageTitle({ kicker, title, description }: { kicker: string; title: string; description: string }) {
  return <div className="page-title"><span className="section-kicker">{kicker}</span><h1>{title}</h1><p>{description}</p></div>;
}

function UnitSelect({ value, onChange }: { value: string; onChange: (unit: string) => void }) {
  return <label className="select-wrap"><span>単元</span><select value={value} onChange={(event) => onChange(event.target.value)}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>;
}

function SettingToggle({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="setting-row"><div><b>{title}</b><p>{description}</p></div><span className="settings-switch"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></span></label>;
}
