/* Dish Dash — all sound is generated in the browser with the Web Audio API.
   No audio files, nothing to download, nothing to license. */
const Sound = (() => {
  let ctx = null, on = true;
  try { on = localStorage.getItem("dishdash.sound") !== "off"; } catch(e) {}

  function audio(){
    if(!on) return null;
    try {
      if(!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if(ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch(e){ return null; }
  }
  /* one note: a short shaped tone, so nothing clicks or clips */
  function note(freq, start, length, peak, type){
    const a = audio();
    if(!a) return;
    const t = a.currentTime + start;
    const osc = a.createOscillator(), gain = a.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(gain); gain.connect(a.destination);
    osc.start(t); osc.stop(t + length + 0.02);
  }
  function chord(freqs, length, peak){ freqs.forEach((f, i) => note(f, i * 0.06, length, peak, "triangle")); }

  return {
    get enabled(){ return on; },
    toggle(){
      on = !on;
      try { localStorage.setItem("dishdash.sound", on ? "on" : "off"); } catch(e) {}
      if(on) this.pick();
      return on;
    },
    unlock(){ audio(); },                                  /* call on any click */
    pick(){ note(660, 0, 0.06, 0.07, "square"); },         /* ticking an option */
    tick(urgent){                                          /* one per second */
      if(urgent) note(1200, 0, 0.07, 0.10, "square");
      else note(520, 0, 0.045, 0.045, "sine");
    },
    lock(){ note(560, 0, 0.1, 0.1); note(840, 0.08, 0.14, 0.09); },
    join(){ note(700, 0, 0.08, 0.07); note(1050, 0.07, 0.12, 0.06); },
    start(){ chord([392, 523, 659], 0.5, 0.09); },
    timeUp(){ note(300, 0, 0.18, 0.11, "sawtooth"); note(200, 0.16, 0.3, 0.09, "sawtooth"); },
    good(big){ chord(big ? [523, 659, 784, 1047] : [523, 659, 784], 0.55, 0.1); },
    bad(){ note(220, 0, 0.22, 0.11, "sawtooth"); note(165, 0.18, 0.4, 0.1, "sawtooth"); },
    fanfare(){
      [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.13, 0.4, 0.11, "triangle"));
      note(1319, 0.56, 0.9, 0.12, "triangle");
    }
  };
})();
