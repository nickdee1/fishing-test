"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { byId, questions, shuffle, topics, type Question } from "@/lib/data";
import { haptic } from "@/lib/haptics";
import { load, save, useProgress, type Progress } from "@/lib/store";

type Source = "topic" | "random" | "test" | "wrong" | "saved" | "retry";

type Session = {
  title: string;
  source: Source;
  queue: string[];
  idx: number;
  answers: Record<string, number>; // question id -> chosen original option index
  skipped: string[];
  order: Record<string, number[]>; // display order of options
  instant: boolean; // show right/wrong right after answering
  passMark?: number; // fraction needed to pass (tests only)
};

type Screen =
  | { kind: "home" }
  | { kind: "topics" }
  | { kind: "test" }
  | { kind: "session"; s: Session }
  | { kind: "results"; s: Session };

const SCREEN_KEY = "rz-screen-v1";
const LETTERS = ["a", "b", "c"];

function makeSession(
  title: string,
  source: Source,
  ids: string[],
  p: Progress,
  opts: { instant?: boolean; passMark?: number } = {},
): Session {
  const order: Record<string, number[]> = {};
  for (const id of ids) {
    const n = byId[id].options.length;
    const base = Array.from({ length: n }, (_, i) => i);
    order[id] = p.shuffleOptions ? shuffle(base) : base;
  }
  return {
    title,
    source,
    queue: ids,
    idx: 0,
    answers: {},
    skipped: [],
    order,
    instant: opts.instant ?? true,
    passMark: opts.passMark,
  };
}

function wrongIds(p: Progress) {
  return questions.filter((q) => p.stats[q.id]?.last === 0).map((q) => q.id);
}

export default function App() {
  const { p, ready, update, record, toggleSaved, reset } = useProgress();
  const [screen, setScreenRaw] = useState<Screen>({ kind: "home" });

  // restore an unfinished session after reload
  useEffect(() => {
    const s = load<{ screen: Screen | null }>(SCREEN_KEY, { screen: null }).screen;
    if (s && (s.kind === "session" || s.kind === "results") && s.s.queue.every((id) => byId[id])) setScreenRaw(s);
  }, []);

  const setScreen = useCallback((s: Screen) => {
    setScreenRaw(s);
    save(SCREEN_KEY, s.kind === "session" || s.kind === "results" ? { screen: s } : null);
    window.scrollTo({ top: 0 });
  }, []);

  const start = (title: string, source: Source, ids: string[], opts?: { instant?: boolean; passMark?: number }) => {
    if (!ids.length) return;
    haptic("tap");
    setScreen({ kind: "session", s: makeSession(title, source, ids, p, opts) });
  };

  if (!ready) return <main className="wrap" />;

  switch (screen.kind) {
    case "home":
      return (
        <Home
          p={p}
          onTopics={() => setScreen({ kind: "topics" })}
          onTest={() => setScreen({ kind: "test" })}
          onRandom={() => start("Случайные вопросы", "random", shuffle(questions.map((q) => q.id)))}
          onWrong={() => start("Ошибки", "wrong", shuffle(wrongIds(p)))}
          onSaved={() => start("Сохранённые", "saved", shuffle(p.saved.filter((id) => byId[id])))}
          onToggleShuffle={() => update((x) => ({ ...x, shuffleOptions: !x.shuffleOptions }))}
          onReset={reset}
        />
      );
    case "topics":
      return (
        <Topics
          p={p}
          onBack={() => setScreen({ kind: "home" })}
          onStart={(t, ordered) => {
            const ids = questions.filter((q) => q.topic === t).map((q) => q.id);
            start(topics[t - 1].short, "topic", ordered ? ids : shuffle(ids));
          }}
        />
      );
    case "test":
      return (
        <TestSetup
          onBack={() => setScreen({ kind: "home" })}
          onStart={(count, topicIds, instant) => {
            const pool = questions.filter((q) => topicIds.includes(q.topic)).map((q) => q.id);
            start(`Тест · ${Math.min(count, pool.length)} вопросов`, "test", shuffle(pool).slice(0, count), {
              instant,
              passMark: 13 / 25,
            });
          }}
        />
      );
    case "session":
      return (
        <Quiz
          key={screen.s.title + screen.s.queue.length}
          s={screen.s}
          saved={p.saved}
          onChange={(s) => setScreen({ kind: "session", s })}
          onAnswer={record}
          onToggleSaved={toggleSaved}
          onFinish={(s) => setScreen({ kind: "results", s })}
          onExit={() => setScreen({ kind: "home" })}
        />
      );
    case "results":
      return (
        <Results
          s={screen.s}
          onHome={() => setScreen({ kind: "home" })}
          onRetry={(ids) => start("Ошибки сессии", "retry", shuffle(ids))}
        />
      );
  }
}

/* ---------------- Home ---------------- */

function Home(props: {
  p: Progress;
  onTopics: () => void;
  onTest: () => void;
  onRandom: () => void;
  onWrong: () => void;
  onSaved: () => void;
  onToggleShuffle: () => void;
  onReset: () => void;
}) {
  const { p } = props;
  const seen = Object.keys(p.stats).length;
  const mastered = Object.values(p.stats).filter((s) => s.last === 1).length;
  const wrong = wrongIds(p).length;
  const saved = p.saved.length;
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <main className="wrap">
      <header className="hero">
        <div className="eyebrow">ČRS · test rybářských znalostí</div>
        <h1>Тренажёр к рыбацкому экзамену</h1>
        <p className="muted">
          {questions.length} официальных вопросов в {topics.length} темах. На экзамене 25 вопросов, нужно минимум 13
          правильных.
        </p>
        <div className="meter" aria-label="Прогресс">
          <div className="meter-fill" style={{ width: `${(mastered / questions.length) * 100}%` }} />
        </div>
        <div className="meter-legend">
          <span>
            <b>{mastered}</b> из {questions.length} отвечены верно
          </span>
          <span className="muted">просмотрено {seen}</span>
        </div>
      </header>

      <div className="grid">
        <Tile title="По темам" sub="Пять разделов экзамена" icon="📚" onClick={props.onTopics} />
        <Tile title="Случайно" sub="Все вопросы вперемешку" icon="🎲" onClick={props.onRandom} />
        <Tile title="Пробный тест" sub="25 вопросов, как на экзамене" icon="📝" onClick={props.onTest} accent />
        <Tile
          title="Ошибки"
          sub={wrong ? `${wrong} вопросов на повтор` : "Ошибок пока нет"}
          icon="❌"
          onClick={props.onWrong}
          disabled={!wrong}
          badge={wrong || undefined}
        />
        <Tile
          title="Сохранённые"
          sub={saved ? `${saved} в закладках` : "Жми ☆ на вопросе"}
          icon="⭐"
          onClick={props.onSaved}
          disabled={!saved}
          badge={saved || undefined}
        />
      </div>

      <section className="settings">
        <label className="row">
          <span>
            Перемешивать варианты ответов
            <span className="muted small"> — чтобы не запоминать букву</span>
          </span>
          <input
            type="checkbox"
            className="switch"
            checked={p.shuffleOptions}
            onChange={() => {
              haptic("tap");
              props.onToggleShuffle();
            }}
          />
        </label>
        <div className="row">
          <span className="muted small">Прогресс хранится только в этом браузере.</span>
          {confirmReset ? (
            <span className="inline-actions">
              <button
                className="link danger"
                onClick={() => {
                  haptic("error");
                  props.onReset();
                  setConfirmReset(false);
                }}
              >
                Да, сбросить
              </button>
              <button className="link" onClick={() => setConfirmReset(false)}>
                Отмена
              </button>
            </span>
          ) : (
            <button className="link" onClick={() => setConfirmReset(true)} disabled={!seen}>
              Сбросить прогресс
            </button>
          )}
        </div>
      </section>

      <footer className="foot muted small">
        Вопросы:{" "}
        <a href="https://old.rybsvaz.cz/beta/index.php/legislativa/test-rybarskych-znalosti" target="_blank" rel="noreferrer">
          Český rybářský svaz
        </a>
      </footer>
    </main>
  );
}

function Tile(props: {
  title: string;
  sub: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  badge?: number;
}) {
  return (
    <button className={`tile${props.accent ? " accent" : ""}`} onClick={props.onClick} disabled={props.disabled}>
      <span className="tile-icon" aria-hidden>
        {props.icon}
      </span>
      <span className="tile-title">{props.title}</span>
      <span className="tile-sub">{props.sub}</span>
      {props.badge ? <span className="badge">{props.badge}</span> : null}
    </button>
  );
}

/* ---------------- Topics ---------------- */

function Topics(props: { p: Progress; onBack: () => void; onStart: (topic: number, ordered: boolean) => void }) {
  const [ordered, setOrdered] = useState(false);
  return (
    <main className="wrap">
      <TopBar title="Темы" onBack={props.onBack} />
      <div className="segmented" role="tablist">
        <button className={!ordered ? "on" : ""} onClick={() => (haptic("tap"), setOrdered(false))}>
          Вперемешку
        </button>
        <button className={ordered ? "on" : ""} onClick={() => (haptic("tap"), setOrdered(true))}>
          По порядку
        </button>
      </div>
      <ul className="list">
        {topics.map((t) => {
          const qs = questions.filter((q) => q.topic === t.id);
          const ok = qs.filter((q) => props.p.stats[q.id]?.last === 1).length;
          const bad = qs.filter((q) => props.p.stats[q.id]?.last === 0).length;
          return (
            <li key={t.id}>
              <button className="topic" onClick={() => props.onStart(t.id, ordered)}>
                <span className="topic-num">{t.id}</span>
                <span className="topic-body">
                  <span className="topic-title">{t.ru}</span>
                  <span className="topic-sub">{t.name}</span>
                  <span className="mini-meter">
                    <span className="ok" style={{ width: `${(ok / qs.length) * 100}%` }} />
                    <span className="bad" style={{ width: `${(bad / qs.length) * 100}%` }} />
                  </span>
                  <span className="topic-stats">
                    {qs.length} вопр. · <span className="c-ok">{ok} верно</span>
                    {bad ? (
                      <>
                        {" "}
                        · <span className="c-bad">{bad} ошибок</span>
                      </>
                    ) : null}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

/* ---------------- Test setup ---------------- */

function TestSetup(props: { onBack: () => void; onStart: (count: number, topics: number[], instant: boolean) => void }) {
  const [count, setCount] = useState(25);
  const [sel, setSel] = useState<number[]>(topics.map((t) => t.id));
  const [instant, setInstant] = useState(false);
  const pool = questions.filter((q) => sel.includes(q.topic)).length;

  return (
    <main className="wrap">
      <TopBar title="Пробный тест" onBack={props.onBack} />

      <section className="card">
        <h3>Количество вопросов</h3>
        <div className="segmented">
          {[10, 25, 50, 100].map((n) => (
            <button key={n} className={count === n ? "on" : ""} onClick={() => (haptic("tap"), setCount(n))}>
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Темы</h3>
        <div className="chips">
          {topics.map((t) => {
            const on = sel.includes(t.id);
            return (
              <button
                key={t.id}
                className={`chip${on ? " on" : ""}`}
                onClick={() => {
                  haptic("tap");
                  setSel(on ? sel.filter((x) => x !== t.id) : [...sel, t.id].sort());
                }}
              >
                {t.id}. {t.ru}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <label className="row">
          <span>
            Показывать правильный ответ сразу
            <span className="muted small block">Выключено — как на экзамене, результат в конце</span>
          </span>
          <input
            type="checkbox"
            className="switch"
            checked={instant}
            onChange={() => (haptic("tap"), setInstant(!instant))}
          />
        </label>
      </section>

      <button className="primary big" disabled={!pool} onClick={() => props.onStart(count, sel, instant)}>
        Начать · {Math.min(count, pool)} вопросов
      </button>
      <p className="muted small center">Чтобы сдать, нужно ответить верно хотя бы на 52 % (13 из 25).</p>
    </main>
  );
}

/* ---------------- Quiz ---------------- */

function Quiz(props: {
  s: Session;
  saved: string[];
  onChange: (s: Session) => void;
  onAnswer: (id: string, ok: boolean) => void;
  onToggleSaved: (id: string) => void;
  onFinish: (s: Session) => void;
  onExit: () => void;
}) {
  const { s } = props;
  const id = s.queue[s.idx];
  const q: Question | undefined = byId[id];
  const chosen = id !== undefined ? s.answers[id] : undefined;
  const answered = chosen !== undefined;
  const revealed = answered && s.instant;
  const isSaved = props.saved.includes(id);
  const answeredCount = Object.keys(s.answers).length;
  const correctCount = Object.entries(s.answers).filter(([qid, a]) => byId[qid].correct === a).length;
  const isLast = s.idx >= s.queue.length - 1;
  const [confirmExit, setConfirmExit] = useState(false);

  const next = useCallback(
    (cur: Session) => {
      if (cur.idx >= cur.queue.length - 1) props.onFinish(cur);
      else props.onChange({ ...cur, idx: cur.idx + 1 });
    },
    [props],
  );

  const answer = useCallback(
    (orig: number) => {
      if (!q || answered) return;
      const ok = orig === q.correct;
      const ns = { ...s, answers: { ...s.answers, [id]: orig } };
      props.onAnswer(id, ok);
      if (s.instant) {
        haptic(ok ? "success" : "error");
        props.onChange(ns);
      } else {
        haptic("tap");
        props.onChange(ns);
        setTimeout(() => next(ns), 220);
      }
    },
    [q, answered, s, id, props, next],
  );

  const skip = useCallback(() => {
    if (!q || answered) return;
    haptic("tap");
    const firstSkip = !s.skipped.includes(id);
    const ns: Session = { ...s, skipped: firstSkip ? [...s.skipped, id] : s.skipped };
    if (firstSkip && !isLast) {
      // move to the end of the queue — it will come back once
      const queue = s.queue.filter((_, i) => i !== s.idx).concat(id);
      props.onChange({ ...ns, queue });
    } else {
      next(ns);
    }
  }, [q, answered, s, id, isLast, props, next]);

  const goNext = useCallback(() => {
    haptic("tap");
    next(s);
  }, [next, s]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const i = ["1", "2", "3"].indexOf(k) >= 0 ? ["1", "2", "3"].indexOf(k) : LETTERS.indexOf(k);
      if (i >= 0 && !answered && s.order[id]?.[i] !== undefined) answer(s.order[id][i]);
      else if ((k === "enter" || k === " " || k === "arrowright") && answered) {
        e.preventDefault();
        goNext();
      } else if (k === "s" || (k === "arrowright" && !answered)) skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, answered, goNext, skip, s.order, id]);

  if (!q) return null;
  const order = s.order[id] ?? q.options.map((_, i) => i);
  const progress = ((s.idx + (answered ? 1 : 0)) / s.queue.length) * 100;

  return (
    <main className="wrap quiz">
      <div className="quiz-top">
        <button className="icon-btn" aria-label="Выйти" onClick={() => (answeredCount ? setConfirmExit(true) : props.onExit())}>
          ✕
        </button>
        <div className="quiz-title">
          <div className="small muted">{s.title}</div>
          <div className="counter">
            {s.idx + 1} / {s.queue.length}
            {s.instant && answeredCount ? (
              <span className="muted small">
                {" "}
                · ✓ {correctCount} ✗ {answeredCount - correctCount}
              </span>
            ) : null}
          </div>
        </div>
        <button
          className={`icon-btn star${isSaved ? " on" : ""}`}
          aria-label={isSaved ? "Убрать из сохранённых" : "Сохранить"}
          onClick={() => {
            haptic("tap");
            props.onToggleSaved(id);
          }}
        >
          {isSaved ? "★" : "☆"}
        </button>
      </div>
      <div className="meter thin">
        <div className="meter-fill" style={{ width: `${progress}%` }} />
      </div>

      {confirmExit && (
        <div className="confirm">
          <span>Закончить сессию?</span>
          <span className="inline-actions">
            <button className="link" onClick={() => props.onFinish(s)}>
              Показать итог
            </button>
            <button className="link danger" onClick={props.onExit}>
              Выйти
            </button>
            <button className="link" onClick={() => setConfirmExit(false)}>
              Отмена
            </button>
          </span>
        </div>
      )}

      <article className="qcard" key={id}>
        <div className="qmeta small muted">
          Тема {q.topic} · вопрос №{q.n}
          {s.skipped.includes(id) && !answered ? " · пропущен ранее" : ""}
        </div>
        <h2 className="qtext">{q.q}</h2>
        {q.img && (
          <div className="qimg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={q.img} alt="" />
          </div>
        )}
        <div className="options">
          {order.map((orig, i) => {
            let cls = "opt";
            if (revealed) {
              if (orig === q.correct) cls += " correct";
              else if (orig === chosen) cls += " wrong";
              else cls += " dim";
            } else if (answered && orig === chosen) cls += " picked";
            return (
              <button key={orig} className={cls} onClick={() => answer(orig)} disabled={answered}>
                <span className="opt-letter">{LETTERS[i]}</span>
                <span className="opt-text">{q.options[orig]}</span>
                {revealed && orig === q.correct && <span className="opt-mark">✓</span>}
                {revealed && orig === chosen && orig !== q.correct && <span className="opt-mark">✗</span>}
              </button>
            );
          })}
        </div>
      </article>

      <div className="actions">
        {revealed ? (
          <button className="primary big" onClick={goNext}>
            {isLast ? "Итог" : "Дальше →"}
          </button>
        ) : (
          <>
            <button className="ghost big" onClick={skip} disabled={answered}>
              Пропустить
            </button>
            {s.source === "test" && !s.instant && answeredCount > 0 && (
              <button className="ghost big" onClick={() => props.onFinish(s)}>
                Завершить
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}

/* ---------------- Results ---------------- */

function Results(props: { s: Session; onHome: () => void; onRetry: (ids: string[]) => void }) {
  const { s } = props;
  const total = s.queue.length;
  const answeredIds = s.queue.filter((id) => s.answers[id] !== undefined);
  const wrong = answeredIds.filter((id) => s.answers[id] !== byId[id].correct);
  const correct = answeredIds.length - wrong.length;
  const unanswered = s.queue.filter((id) => s.answers[id] === undefined);
  const passed = s.passMark !== undefined ? correct / total >= s.passMark : undefined;
  const need = s.passMark !== undefined ? Math.ceil(total * s.passMark) : 0;
  const review = useMemo(() => [...wrong, ...unanswered], [wrong, unanswered]);

  useEffect(() => {
    if (passed !== undefined) haptic(passed ? "success" : "error");
  }, [passed]);

  return (
    <main className="wrap">
      <TopBar title="Итог" onBack={props.onHome} />
      <section className={`score${passed === true ? " pass" : passed === false ? " fail" : ""}`}>
        {passed !== undefined && <div className="verdict">{passed ? "Сдал 🎉" : "Не сдал"}</div>}
        <div className="score-big">
          {correct}
          <span className="muted"> / {total}</span>
        </div>
        <div className="muted">
          {Math.round((correct / Math.max(total, 1)) * 100)} % верно
          {passed !== undefined ? ` · нужно ${need}` : ""}
        </div>
        <div className="score-row">
          <span className="c-ok">✓ {correct}</span>
          <span className="c-bad">✗ {wrong.length}</span>
          {unanswered.length > 0 && <span className="muted">⤼ {unanswered.length} пропущено</span>}
        </div>
      </section>

      <div className="actions stack">
        {review.length > 0 && (
          <button className="primary big" onClick={() => props.onRetry(review)}>
            Прорешать ошибки и пропущенные ({review.length})
          </button>
        )}
        <button className="ghost big" onClick={props.onHome}>
          На главную
        </button>
      </div>

      {review.length > 0 && (
        <section>
          <h3 className="section-title">Разбор</h3>
          <ul className="review">
            {review.map((id) => {
              const q = byId[id];
              const a = s.answers[id];
              return (
                <li key={id} className="rcard">
                  <div className="small muted">
                    Тема {q.topic} · №{q.n}
                  </div>
                  <div className="rq">{q.q}</div>
                  {q.img && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="rimg" src={q.img} alt="" />
                  )}
                  {a !== undefined && <div className="ra wrong">✗ {q.options[a]}</div>}
                  {a === undefined && <div className="ra muted">— пропущен</div>}
                  <div className="ra correct">✓ {q.options[q.correct]}</div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

function TopBar(props: { title: string; onBack: () => void }) {
  return (
    <div className="topbar">
      <button className="icon-btn" aria-label="Назад" onClick={props.onBack}>
        ←
      </button>
      <h2>{props.title}</h2>
      <span className="icon-btn placeholder" />
    </div>
  );
}
