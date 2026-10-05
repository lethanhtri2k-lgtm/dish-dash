/* Dish Dash — background music.
   Drop your own files into assets/audio/ with these names and they play automatically.
   Any file that is missing is simply skipped, so you can add one, two or all three.
   Use music you have the right to use. */
const MUSIC = {
  enabled:    true,   /* false turns all background music off */
  continuous: true,   /* true = one track plays right through the game without stopping
                         false = a different track per phase, using all three names below */
  hostOnly:   true,   /* true = music plays on the teacher screen only, not on students' phones */
  volume:     0.35,   /* 0 to 1 — keep it under the sound effects */
  tracks: {
    lobby:    "assets/audio/lobby.mp3",     /* the track, and in phase mode the lobby one */
    question: "assets/audio/question.mp3",  /* phase mode only: while they answer */
    results:  "assets/audio/results.mp3"    /* phase mode only: the final scoreboard */
  }
};

const Music = (() => {
  const made = {};
  let playing = null, fader = null;
  let want = null;            /* {name, level} we are meant to be playing */
  let blocked = false;        /* the browser refused until the viewer interacts */

  function track(name){
    const src = MUSIC.tracks[name];
    if(!src) return null;
    if(made[name] === undefined){
      const a = new Audio(src);
      a.loop = MUSIC.continuous || name !== "results";
      a.preload = "auto";
      a.volume = 0;
      a.addEventListener("error", () => { made[name] = null; });   /* no such file — stay quiet */
      made[name] = a;
    }
    return made[name];
  }
  function fade(a, to, ms){
    if(!a) return;
    if(fader) clearInterval(fader);
    const from = a.volume, steps = Math.max(1, Math.round(ms / 50));
    let i = 0;
    fader = setInterval(() => {
      i++;
      const v = from + (to - from) * (i / steps);
      try { a.volume = Math.min(1, Math.max(0, v)); } catch(e) {}
      if(i >= steps){
        clearInterval(fader); fader = null;
        if(to === 0){ try { a.pause(); } catch(e) {} }
      }
    }, 50);
  }
  function allowed(){
    return MUSIC.enabled && Sound.enabled && !(MUSIC.hostOnly && ROLE !== "host");
  }
  function startOrRetry(){
    if(!want || !allowed()) return;
    const a = track(want.name);
    if(!a) return;
    const target = want.level * MUSIC.volume;
    if(playing === a && !a.paused){ fade(a, target, 400); return; }
    playing = a;
    if(a.paused) a.volume = 0;
    const p = a.play();
    if(p && p.then){
      p.then(() => { blocked = false; fade(a, target, 700); })
       .catch(() => { blocked = true; });   /* needs a gesture — the listener below retries */
    } else {
      fade(a, target, 700);
    }
  }

  /* Browsers only allow sound after the viewer has interacted with the page.
     Any click or key anywhere retries whatever we are supposed to be playing. */
  ["click", "keydown", "touchstart"].forEach(ev =>
    document.addEventListener(ev, () => { if(blocked || (want && playing && playing.paused)) startOrRetry(); }, true));

  return {
    get blocked(){ return blocked; },
    play(name, level){
      if(!allowed()) return this.stop();
      want = { name, level: level || 1 };
      startOrRetry();
    },
    stop(){
      want = null;
      if(playing){ fade(playing, 0, 350); playing = null; }
    },
    setPhase(phase){
      if(!allowed()) return this.stop();
      if(MUSIC.continuous){
        /* one unbroken track from the lobby to the final scoreboard — never restarted,
           only eased down while the answers are on screen */
        this.play("lobby", phase === "reveal" ? 0.6 : 1);
        return;
      }
      if(phase === "lobby") this.play("lobby", 1);
      else if(phase === "question") this.play("question", 1);
      else if(phase === "reveal") this.play("question", 0.45);
      else if(phase === "final") this.play("results", 1);
      else this.stop();
    }
  };
})();
