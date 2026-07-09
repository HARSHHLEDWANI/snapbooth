'use client';

/**
 * DebateActivity — peer-voted debate club. A topic card is drawn, sides are
 * assigned at random, each partner gets 60 seconds on camera, then both
 * SECRETLY rate the opponent's argument on three sliders (funny / convincing /
 * dramatic). Ratings reveal simultaneously; higher total takes the round;
 * best-of-3 takes the crown. No AI judge — your person IS the judge.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useActivityChannel } from '@/lib/room/useActivityChannel';
import { getActiveRoom } from '@/lib/room/room';
import { play } from '@/lib/sound/sound';
import type { ActivityProps } from '../ActivityHost';

const TOPICS = [
  'pineapple belongs on pizza',
  'texting back instantly is a green flag',
  'cats are better partners than dogs',
  'breakfast food is the best dinner',
  'the beach is overrated; mountains win',
  'money can, in fact, buy happiness',
  'romcoms are superior to action movies',
  'cereal is a soup',
  'it’s okay to double-text. always.',
  'winter is the most romantic season',
  'video calls beat phone calls',
  'surprise parties should be illegal',
  'the middle seat armrest belongs to the middle',
  'social media breaks make you more interesting',
  'a hot dog is a sandwich',
];

const PREP_SECONDS = 10;
const SPEAK_SECONDS = 60;
const WINS_NEEDED = 2;

type Msg =
  | { k: 'topic'; i: number; hostFor: boolean }
  | { k: 'vote'; f: number; c: number; d: number }
  | { k: 'rematch' };

type Stage = 'lobby' | 'prep' | 'speak-host' | 'speak-guest' | 'vote' | 'reveal' | 'crown';

interface Vote { f: number; c: number; d: number }
const total = (v: Vote) => v.f + v.c + v.d;

export function DebateActivity({ role, onBoothPic }: ActivityProps) {
  const isHost = role === 'host';
  const [stage, setStage] = useState<Stage>('lobby');
  const [topicIdx, setTopicIdx] = useState(0);
  const [hostFor, setHostFor] = useState(true);
  const [timer, setTimer] = useState(0);
  const [round, setRound] = useState(1);
  const [wins, setWins] = useState({ host: 0, guest: 0 });
  const [mySliders, setMySliders] = useState<Vote>({ f: 5, c: 5, d: 5 });
  const [myVote, setMyVote] = useState<Vote | null>(null);      // what I gave THEM
  const [theirVote, setTheirVote] = useState<Vote | null>(null); // what they gave ME
  const [camOn, setCamOn] = useState(false);

  const localVid = useRef<HTMLVideoElement | null>(null);
  const remoteVid = useRef<HTMLVideoElement | null>(null);
  const myStream = useRef<MediaStream | null>(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  // ── camera (best effort — the debate still works without it) ──
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640 }, audio: false });
        if (dead) { stream.getTracks().forEach((t) => t.stop()); return; }
        myStream.current = stream;
        if (localVid.current) {
          localVid.current.srcObject = stream;
          localVid.current.play().catch(() => {});
        }
        setCamOn(true);
        const room = getActiveRoom();
        room?.attachStream(stream);
        room?.onRemoteStream((s) => {
          if (remoteVid.current && remoteVid.current.srcObject !== s) {
            remoteVid.current.srcObject = s;
            remoteVid.current.play().catch(() => {});
          }
        });
      } catch { /* no camera — timers still run */ }
    })();
    return () => {
      dead = true;
      myStream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const send = useActivityChannel<Msg>('debate', (m) => {
    if (m.k === 'topic') {
      setTopicIdx(m.i);
      setHostFor(m.hostFor);
      enterPrep();
    } else if (m.k === 'vote') {
      setTheirVote({ f: m.f, c: m.c, d: m.d });
    } else if (m.k === 'rematch') {
      setWins({ host: 0, guest: 0 });
      setRound(1);
      setStage('lobby');
    }
  });

  const enterPrep = () => {
    setMyVote(null);
    setTheirVote(null);
    setMySliders({ f: 5, c: 5, d: 5 });
    setStage('prep');
    setTimer(PREP_SECONDS);
    play('pop');
  };

  const drawTopic = () => {
    const i = Math.floor(Math.random() * TOPICS.length);
    const hf = Math.random() < 0.5;
    send({ k: 'topic', i, hostFor: hf });
    setTopicIdx(i);
    setHostFor(hf);
    enterPrep();
  };

  // stage timers: prep → speak-host → speak-guest → vote
  useEffect(() => {
    if (stage !== 'prep' && stage !== 'speak-host' && stage !== 'speak-guest') return;
    const iv = setInterval(() => {
      setTimer((t) => {
        if (t > 1) return t - 1;
        clearInterval(iv);
        if (stageRef.current === 'prep') { setStage('speak-host'); setTimer(SPEAK_SECONDS); play('countdown'); }
        else if (stageRef.current === 'speak-host') { setStage('speak-guest'); setTimer(SPEAK_SECONDS); play('countdown'); }
        else { setStage('vote'); play('printer'); }
        return 0;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [stage]);

  // both votes in → simultaneous reveal
  useEffect(() => {
    if (stage === 'vote' && myVote && theirVote) {
      setStage('reveal');
      play('success');
    }
  }, [stage, myVote, theirVote]);

  const roundScores = useCallback(() => {
    // my score = what THEY gave me; theirs = what I gave them
    const me = theirVote ? total(theirVote) : 0;
    const them = myVote ? total(myVote) : 0;
    return { me, them };
  }, [myVote, theirVote]);

  const finishRound = () => {
    const { me, them } = roundScores();
    const iWon = me > them;
    const tie = me === them;
    const w = { ...wins };
    if (!tie) {
      const winnerKey = (iWon ? role : role === 'host' ? 'guest' : 'host') as 'host' | 'guest';
      w[winnerKey] += 1;
      setWins(w);
    }
    if (w.host >= WINS_NEEDED || w.guest >= WINS_NEEDED) {
      setStage('crown');
      play('success');
    } else {
      setRound((r) => r + 1);
      setStage('lobby');
    }
  };

  const speakingMe = (stage === 'speak-host' && isHost) || (stage === 'speak-guest' && !isHost);
  const speakerLabel = stage === 'speak-host' ? (isHost ? 'you' : 'them') : stage === 'speak-guest' ? (isHost ? 'them' : 'you') : null;
  const mySideFor = isHost ? hostFor : !hostFor;
  const myWins = isHost ? wins.host : wins.guest;
  const theirWins = isHost ? wins.guest : wins.host;
  const iAmCrowned = myWins >= WINS_NEEDED;

  return (
    <div className="deb-wrap">
      {/* score strip */}
      <div className="score-strip">
        <span className="pill">round {round}</span>
        <span className="pill">you {myWins} — {theirWins} them</span>
      </div>

      {/* cameras */}
      <div className={`cams ${stage === 'lobby' || stage === 'crown' ? 'dim' : ''}`}>
        <div className={`cam ${speakingMe ? 'live' : ''}`}>
          <video ref={localVid} playsInline autoPlay muted />
          {!camOn && <span className="nocam">📷 camera off</span>}
          <span className="cam-tag">you</span>
        </div>
        <div className={`cam ${speakerLabel === 'them' ? 'live' : ''}`}>
          <video ref={remoteVid} playsInline autoPlay muted />
          <span className="cam-tag">them</span>
        </div>
      </div>

      {stage === 'lobby' && (
        <div className="panel card grain">
          <h3>{round === 1 ? 'ready to argue about nothing?' : 'next round!'}</h3>
          <p>a topic appears, sides are dealt at random, 60 seconds each — then you rate each other. first to {WINS_NEEDED} wins the crown 👑</p>
          <button className="btn btn-primary" onClick={drawTopic}>🎴 draw a topic</button>
        </div>
      )}

      {(stage === 'prep' || stage === 'speak-host' || stage === 'speak-guest') && (
        <div className="panel card grain">
          <div className="topic">“{TOPICS[topicIdx]}”</div>
          <div className="sides">
            <span className={`side ${mySideFor ? 'for' : 'against'}`}>you argue {mySideFor ? 'FOR ✓' : 'AGAINST ✗'}</span>
          </div>
          {stage === 'prep' ? (
            <p className="stage-line">think fast — you start in <b>{timer}s</b></p>
          ) : (
            <p className="stage-line">
              {speakingMe ? '🎙️ your turn — convince them!' : '👂 listen… judge silently'} <b className={timer <= 10 ? 'low' : ''}>{timer}s</b>
            </p>
          )}
        </div>
      )}

      {stage === 'vote' && (
        <div className="panel card grain">
          {!myVote ? (
            <>
              <h3>rate their argument (secretly)</h3>
              {([['f', 'funny 😂'], ['c', 'convincing 🧠'], ['d', 'dramatic 🎭']] as const).map(([key, label]) => (
                <label key={key} className="slider-row">
                  <span>{label}</span>
                  <input
                    type="range" min={0} max={10} value={mySliders[key]}
                    onChange={(e) => setMySliders((s) => ({ ...s, [key]: Number(e.target.value) }))}
                  />
                  <b>{mySliders[key]}</b>
                </label>
              ))}
              <button className="btn btn-primary" onClick={() => { setMyVote(mySliders); send({ k: 'vote', ...mySliders }); play('pop'); }}>
                seal my verdict 🔒
              </button>
            </>
          ) : (
            <div className="waiting"><span className="pulse-dot" /> verdict sealed — waiting for theirs…</div>
          )}
        </div>
      )}

      {stage === 'reveal' && myVote && theirVote && (
        <div className="panel card grain">
          <h3>{roundScores().me > roundScores().them ? 'you took the round! 🎉' : roundScores().me < roundScores().them ? 'round goes to them 💅' : 'a perfect tie?!'}</h3>
          <div className="reveal-grid">
            <div>
              <small>your argument scored</small>
              <strong>{roundScores().me}/30</strong>
              <em>😂 {theirVote.f} · 🧠 {theirVote.c} · 🎭 {theirVote.d}</em>
            </div>
            <div>
              <small>their argument scored</small>
              <strong>{roundScores().them}/30</strong>
              <em>😂 {myVote.f} · 🧠 {myVote.c} · 🎭 {myVote.d}</em>
            </div>
          </div>
          <button className="btn btn-primary" onClick={finishRound}>continue →</button>
        </div>
      )}

      {stage === 'crown' && (
        <div className="panel card grain">
          <div className="crown">{iAmCrowned ? '👑' : '🥈'}</div>
          <h3>{iAmCrowned ? 'debate champion — it’s you!' : 'they take the crown… this time'}</h3>
          <p>final score {myWins} — {theirWins}</p>
          <div className="row">
            <button className="btn btn-primary" onClick={() => { send({ k: 'rematch' }); setWins({ host: 0, guest: 0 }); setRound(1); setStage('lobby'); }}>rematch!</button>
            <button className="btn btn-ghost" onClick={onBoothPic}>📸 booth pic</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .deb-wrap { position: relative; width: min(680px, 100%); display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .score-strip { display: flex; gap: 8px; }
        .pill { background: #fff; border: 2.5px solid var(--brown); border-radius: 999px; padding: 3px 14px; font-weight: 800; font-size: 0.8rem; color: var(--brown); box-shadow: var(--shadow-sm); }
        .cams { display: flex; gap: 10px; width: 100%; justify-content: center; }
        .cams.dim { opacity: 0.55; }
        .cam { position: relative; width: min(300px, 44vw); aspect-ratio: 4/3; background: #2b2320; border: 3px solid var(--brown); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow-sm); }
        .cam.live { border-color: var(--pink-deep); box-shadow: 0 0 0 3px var(--blush), var(--shadow-md); }
        .cam video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
        .cam-tag { position: absolute; bottom: 6px; left: 8px; background: rgba(255,255,255,0.85); border-radius: 999px; padding: 1px 10px; font-size: 0.7rem; font-weight: 800; color: var(--brown); }
        .nocam { position: absolute; inset: 0; display: grid; place-items: center; color: var(--blush); font-weight: 700; font-size: 0.85rem; }
        .panel { position: relative; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 18px 22px; text-align: center; }
        .panel h3 { font-size: 1.25rem; color: var(--pink-deep); }
        .panel p { font-size: 0.9rem; color: var(--brown); max-width: 420px; }
        .topic { font-family: var(--font-hand); font-size: 1.4rem; color: var(--brown); }
        .side { font-weight: 800; border-radius: 999px; padding: 4px 14px; font-size: 0.85rem; }
        .side.for { background: #d8f5e3; color: #2e7d4f; border: 2px solid #3f9d68; }
        .side.against { background: var(--blush); color: #b23a5c; border: 2px solid var(--pink-deep); }
        .stage-line { font-weight: 700; }
        .stage-line b { font-family: var(--font-display); font-size: 1.25rem; color: var(--pink-deep); }
        .stage-line b.low { animation: twinkle 0.8s ease-in-out infinite; }
        .slider-row { display: flex; align-items: center; gap: 10px; width: min(360px, 92%); font-weight: 700; color: var(--brown); font-size: 0.88rem; }
        .slider-row span { width: 118px; text-align: right; }
        .slider-row input { flex: 1; accent-color: var(--pink); }
        .slider-row b { min-width: 22px; }
        .waiting { display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--brown-soft); }
        .pulse-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--pink); animation: twinkle 1.2s ease-in-out infinite; }
        .reveal-grid { display: flex; gap: 26px; }
        .reveal-grid > div { display: flex; flex-direction: column; gap: 2px; align-items: center; }
        .reveal-grid small { font-size: 0.7rem; font-weight: 700; color: var(--brown-soft); }
        .reveal-grid strong { font-family: var(--font-display); font-size: 1.9rem; color: var(--pink-deep); }
        .reveal-grid em { font-style: normal; font-size: 0.8rem; font-weight: 700; }
        .crown { font-size: 3rem; animation: float-y 2.4s ease-in-out infinite; }
        .row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
        @media (max-width: 560px) { .cams { flex-direction: row; } .cam { width: 46%; } }
      `}</style>
    </div>
  );
}
