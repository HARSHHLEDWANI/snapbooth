'use client';

/**
 * QuizActivity — "how well do you know me".
 * Each question has an ANSWERER (answers as the truth) and a GUESSER
 * (predicts the answer); roles alternate every question. Both lock privately;
 * the reveal happens simultaneously and matches score + confetti.
 * Works over the room channel, or pass-and-play on one device.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useActivityChannel } from '@/lib/room/useActivityChannel';
import { play } from '@/lib/sound/sound';
import type { ActivityProps } from '../ActivityHost';
import { QUIZ_PACKS, type QuizPack } from './packs';

type Msg =
  | { k: 'pack'; id: string }
  | { k: 'pick'; q: number; choice: number }
  | { k: 'again' };

type Stage = 'pack' | 'play' | 'reveal' | 'done';

const REVEAL_MS = 2800;

function Confetti() {
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: 18 }).map((_, i) => (
        <span key={i} style={{
          left: `${(i * 37) % 100}%`,
          background: ['#ff8fab', '#ffe8a3', '#bde0fe', '#7ed0a8', '#b79ced'][i % 5],
          animationDelay: `${(i % 6) * 0.06}s`,
          transform: `rotate(${i * 40}deg)`,
        }} />
      ))}
      <style jsx>{`
        .confetti { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
        .confetti span { position: absolute; top: -12px; width: 10px; height: 14px; border-radius: 3px; animation: conf-fall 1.6s ease-in forwards; }
        @keyframes conf-fall { to { transform: translateY(76vh) rotate(340deg); opacity: 0.2; } }
      `}</style>
    </div>
  );
}

export function QuizActivity({ solo, role, onBoothPic }: ActivityProps) {
  const [stage, setStage] = useState<Stage>('pack');
  const [pack, setPack] = useState<QuizPack | null>(null);
  const [q, setQ] = useState(0);
  const [score, setScore] = useState(0);
  const [myPick, setMyPick] = useState<number | null>(null);
  // duo: partner picks keyed by question; pass-and-play: the truth pick
  const theirPicks = useRef<Map<number, number>>(new Map());
  const [passStep, setPassStep] = useState<'truth' | 'pass' | 'guess'>('truth');
  const [matched, setMatched] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // who answers as the truth this question (duo): alternate every question
  const answerer: 'host' | 'guest' = q % 2 === 0 ? 'host' : 'guest';
  const iAnswer = role === answerer;

  const send = useActivityChannel<Msg>('quiz', (m) => {
    if (m.k === 'pack') {
      const p = QUIZ_PACKS.find((x) => x.id === m.id);
      if (p && stageRef.current === 'pack') startPack(p, false);
    } else if (m.k === 'pick') {
      theirPicks.current.set(m.q, m.choice);
      maybeReveal(m.q);
    } else if (m.k === 'again') {
      resetAll();
    }
  });

  const stageRef = useRef(stage);
  stageRef.current = stage;
  const myPickRef = useRef(myPick);
  myPickRef.current = myPick;
  const qRef = useRef(q);
  qRef.current = q;

  const startPack = (p: QuizPack, broadcast: boolean) => {
    if (broadcast) send({ k: 'pack', id: p.id });
    setPack(p);
    setQ(0);
    setScore(0);
    setMyPick(null);
    theirPicks.current.clear();
    setPassStep('truth');
    setStage('play');
    play('pop');
  };

  const resetAll = () => {
    setStage('pack');
    setPack(null);
    setQ(0);
    setScore(0);
    setMyPick(null);
    theirPicks.current.clear();
  };

  const maybeReveal = useCallback((forQ: number) => {
    // reveal when BOTH picks for the current question exist
    if (forQ !== qRef.current) return;
    if (myPickRef.current === null) return;
    if (!theirPicks.current.has(forQ)) return;
    doReveal(myPickRef.current, theirPicks.current.get(forQ)!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doReveal = (a: number, b: number) => {
    const hit = a === b;
    setMatched(hit);
    setStage('reveal');
    play(hit ? 'success' : 'pop');
    if (hit) setScore((s) => s + 1);
    advanceTimer.current = setTimeout(() => {
      const next = qRef.current + 1;
      if (!packRef.current || next >= packRef.current.questions.length) {
        setStage('done');
        play('success');
      } else {
        setQ(next);
        setMyPick(null);
        setPassStep('truth');
        setStage('play');
      }
    }, REVEAL_MS);
  };

  const packRef = useRef(pack);
  packRef.current = pack;

  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); }, []);

  const pickDuo = (i: number) => {
    if (myPick !== null || stage !== 'play') return;
    setMyPick(i);
    play('pop');
    send({ k: 'pick', q, choice: i });
    // partner may have picked already
    setTimeout(() => maybeReveal(qRef.current), 0);
  };

  const pickPass = (i: number) => {
    if (stage !== 'play') return;
    play('pop');
    if (passStep === 'truth') {
      theirPicks.current.set(q, i);
      setPassStep('pass');
    } else if (passStep === 'guess') {
      setMyPick(i);
      doReveal(i, theirPicks.current.get(q)!);
    }
  };

  if (stage === 'pack') {
    return (
      <div className="quiz-wrap">
        <span className="label-spaced">p i c k&nbsp;&nbsp;a&nbsp;&nbsp;p a c k</span>
        <div className="packs">
          {QUIZ_PACKS.map((p) => (
            <button key={p.id} className="pack card grain" onClick={() => startPack(p, !solo)}>
              <span className="p-emoji">{p.emoji}</span>
              <strong>{p.name}</strong>
              <small>{p.blurb}</small>
              <em>{p.questions.length} questions</em>
            </button>
          ))}
        </div>
        {solo && <p className="hint">pass-and-play: one of you answers honestly, then hand the device over 🤝</p>}
        <QuizStyles />
      </div>
    );
  }

  if (!pack) return null;

  if (stage === 'done') {
    const pct = Math.round((score / pack.questions.length) * 100);
    return (
      <div className="quiz-wrap">
        {pct >= 60 && <Confetti />}
        <div className="result card grain">
          <span className="label-spaced">c o m p a t i b i l i t y</span>
          <div className="pct">{pct}%</div>
          <p>{score} of {pack.questions.length} matched — {pct >= 80 ? 'soulmate behaviour 💍' : pct >= 60 ? 'you two really pay attention ♡' : pct >= 40 ? 'room for more late-night talks 🌙' : 'time for a very long phone call 📞'}</p>
          <div className="res-row">
            <button className="btn btn-primary" onClick={() => { if (!solo) send({ k: 'again' }); resetAll(); }}>another pack</button>
            {!solo && <button className="btn btn-ghost" onClick={onBoothPic}>📸 booth pic to remember this</button>}
          </div>
        </div>
        <QuizStyles />
      </div>
    );
  }

  const question = pack.questions[q];
  const truthPick = theirPicks.current.get(q);

  // pass-and-play interstitial
  if (solo && passStep === 'pass') {
    return (
      <div className="quiz-wrap">
        <div className="pass card grain">
          <div className="p-emoji">🤝</div>
          <h3>pass the device!</h3>
          <p>now the other one of you guesses what they picked.</p>
          <button className="btn btn-primary" onClick={() => { setPassStep('guess'); play('pop'); }}>i’m ready to guess</button>
        </div>
        <QuizStyles />
      </div>
    );
  }

  const locked = solo ? false : myPick !== null;
  const roleLine = solo
    ? passStep === 'truth' ? 'answer honestly — as YOU' : 'guess what they picked!'
    : iAnswer ? 'answer honestly — as YOU' : 'guess what they’ll say!';

  return (
    <div className="quiz-wrap">
      {stage === 'reveal' && matched && <Confetti />}
      <div className="progress">
        <span>{q + 1} / {pack.questions.length}</span>
        <span className="score">♡ {score} matched</span>
      </div>
      <div className="q-card card grain">
        <span className={`role-chip ${(solo ? passStep === 'truth' : iAnswer) ? 'truth' : 'guess'}`}>{roleLine}</span>
        <h3>{question.q}</h3>
        <div className="opts">
          {question.options.map((o, i) => {
            const revealMine = stage === 'reveal' && myPick === i;
            const revealTruth = stage === 'reveal' && (solo ? truthPick === i : theirPicks.current.get(q) === i);
            return (
              <button
                key={i}
                className={`opt ${myPick === i && stage === 'play' ? 'sel' : ''} ${revealTruth ? 'truth-hit' : ''} ${revealMine && !revealTruth ? 'miss' : ''}`}
                disabled={stage !== 'play' || locked}
                onClick={() => (solo ? pickPass(i) : pickDuo(i))}
              >
                {o}
                {revealTruth && <i>♡</i>}
              </button>
            );
          })}
        </div>
        {stage === 'play' && locked && <div className="waiting"><span className="pulse-dot" /> locked in — waiting for them…</div>}
        {stage === 'reveal' && (
          <div className={`verdict ${matched ? 'yay' : 'aw'}`}>{matched ? 'MATCHED! ✨' : 'not this time 🥺'}</div>
        )}
      </div>
      <QuizStyles />
    </div>
  );
}

function QuizStyles() {
  return (
    <style jsx global>{`
      .quiz-wrap { position: relative; width: min(560px, 100%); display: flex; flex-direction: column; align-items: center; gap: 14px; padding-top: 8px; }
      .quiz-wrap .packs { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
      .quiz-wrap .pack { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; width: 150px; padding: 22px 12px 16px; }
      .quiz-wrap .pack:hover { transform: translateY(-4px); }
      .quiz-wrap .pack .p-emoji { font-size: 2.2rem; }
      .quiz-wrap .pack strong { font-family: var(--font-display); font-size: 1.15rem; color: var(--pink-deep); }
      .quiz-wrap .pack small { font-size: 0.72rem; color: var(--brown-soft); font-weight: 700; }
      .quiz-wrap .pack em { font-size: 0.66rem; color: var(--brown-soft); font-style: normal; margin-top: 4px; border-top: 2px dashed var(--blush); padding-top: 4px; }
      .quiz-wrap .hint { font-size: 0.8rem; color: var(--brown-soft); font-weight: 700; text-align: center; max-width: 320px; }
      .quiz-wrap .progress { display: flex; justify-content: space-between; width: 100%; font-weight: 800; color: var(--brown); font-size: 0.85rem; }
      .quiz-wrap .progress .score { color: var(--pink-deep); }
      .quiz-wrap .q-card { position: relative; width: 100%; padding: 22px 20px; display: flex; flex-direction: column; gap: 12px; align-items: center; }
      .quiz-wrap .role-chip { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.1em; border-radius: 999px; padding: 4px 12px; border: 2px dashed var(--pink); color: var(--pink-deep); background: #fff; }
      .quiz-wrap .role-chip.guess { border-color: var(--sky); color: #4a7fb5; }
      .quiz-wrap .q-card h3 { font-size: 1.3rem; text-align: center; color: var(--brown); }
      .quiz-wrap .opts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; }
      @media (max-width: 480px) { .quiz-wrap .opts { grid-template-columns: 1fr; } }
      .quiz-wrap .opt { position: relative; border: 2.5px solid var(--brown); background: var(--cream); border-radius: 14px; padding: 12px 12px; font-weight: 700; font-size: 0.88rem; color: var(--brown); box-shadow: var(--shadow-sm); transition: transform 0.1s ease; text-align: center; }
      .quiz-wrap .opt:hover:not(:disabled) { transform: translateY(-2px); }
      .quiz-wrap .opt.sel { background: var(--butter); border-style: dashed; }
      .quiz-wrap .opt.truth-hit { background: #d8f5e3; border-color: #3f9d68; }
      .quiz-wrap .opt.miss { background: var(--blush); opacity: 0.9; }
      .quiz-wrap .opt i { position: absolute; top: -10px; right: -6px; font-style: normal; background: #3f9d68; color: #fff; border-radius: 50%; width: 22px; height: 22px; display: grid; place-items: center; font-size: 0.8rem; }
      .quiz-wrap .waiting { display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--brown-soft); font-size: 0.85rem; }
      .quiz-wrap .pulse-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--pink); animation: twinkle 1.2s ease-in-out infinite; }
      .quiz-wrap .verdict { font-family: var(--font-display); font-size: 1.3rem; font-weight: 800; }
      .quiz-wrap .verdict.yay { color: #3f9d68; }
      .quiz-wrap .verdict.aw { color: var(--pink-deep); }
      .quiz-wrap .pass, .quiz-wrap .result { position: relative; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 30px 26px; text-align: center; margin-top: 8vh; }
      .quiz-wrap .pass .p-emoji { font-size: 2.6rem; }
      .quiz-wrap .result .pct { font-family: var(--font-display); font-size: 4rem; font-weight: 800; color: var(--pink); text-shadow: 3px 4px 0 var(--blush); }
      .quiz-wrap .result p { max-width: 300px; font-size: 0.95rem; color: var(--brown); }
      .quiz-wrap .res-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
    `}</style>
  );
}
