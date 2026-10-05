/* Dish Dash — background music.
   Drop your own files into assets/audio/ with these names and they play automatically.
   Any file that is missing is simply skipped, so you can add one, two or all three.
   Use music you have the right to use. */
const MUSIC = {
  enabled:  true,              /* false turns all background music off */
  hostOnly: true,              /* true = music plays on the teacher screen only, not on students' phones */
  volume:   0.35,              /* 0 to 1 — keep it under the sound effects */
  tracks: {
    lobby:    "assets/audio/lobby.mp3",     /* loops while students are joining */
    question: "assets/audio/question.mp3",  /* loops while they answer */
    results:  "assets/audio/results.mp3"    /* plays once on the final scoreboard */
  }
};

const Music = (() => {
  const made = {};
  let playing = null, fader = null;

  function track(name){
    const src = MUSIC.tracks[name];
    if(!src) return null;
    if(made[name] === undefined){
      const a = new Audio(src);
      a.loop = name !== "results";
      a.preload = "auto";
      a.volume = 0;
      a.addEventListener("error", () => { made[name] = null; });  /* file not there — stay quiet */
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
        if(to === 0){ try { a.pause(); a.currentTime = 0; } catch(e) {} }
      }
    }, 50);
  }
  function allowed(){
    return MUSIC.enabled && Sound.enabled && !(MUSIC.hostOnly && ROLE !== "host");
  }
  return {
    play(name, level){
      if(!allowed()) return this.stop();
      const a = track(name);
      if(!a) return;
      if(playing === a){ fade(a, (level || 1) * MUSIC.volume, 400); return; }
      this.stop();
      playing = a;
      a.volume = 0;
      const p = a.play();
      if(p && p.catch) p.catch(() => {});   /* browser wants a click first; the next phase retries */
      fade(a, (level || 1) * MUSIC.volume, 700);
    },
    stop(){
      if(playing){ fade(playing, 0, 350); playing = null; }
    },
    setPhase(phase){
      if(!allowed()) return this.stop();
      if(phase === "lobby") this.play("lobby", 1);
      else if(phase === "question") this.play("question", 1);
      else if(phase === "reveal") this.play("question", 0.45);
      else if(phase === "final") this.play("results", 1);
      else this.stop();
    }
  };
})();
