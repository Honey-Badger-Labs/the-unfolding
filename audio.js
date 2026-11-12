// The Unfolding: procedural soundtrack.
// One voice per stage, all generated live with the Web Audio API (no audio files).
// The timeline crossfades the voices, and zoom transitions add a rising or falling rush of air.
// Everything is tuned around D.
(function (global) {
  "use strict";

  var D2 = 73.42;
  function hz(semitones) { return D2 * Math.pow(2, semitones / 12); }

  function createSoundtrack(ctx, dest) {
    // ---------- building blocks
    // sources made while a voice is being built are collected here, so the voice can be switched off
    var building = null;
    function own(src) { if (building) building.push(src); return src; }
    function gain(v) { var g = ctx.createGain(); g.gain.value = v; return g; }
    function osc(type, f, detune) {
      var o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      if (detune) o.detune.value = detune;
      o.start(); return own(o);
    }
    function filt(type, f, q) {
      var b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f;
      if (q) b.Q.value = q; return b;
    }
    // a slow wobble on any parameter
    function lfo(rate, depth, param) {
      var o = osc("sine", rate); var g = gain(depth); o.connect(g); g.connect(param); return o;
    }
    var noiseBuf = (function () {
      var len = ctx.sampleRate * 4, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return b;
    })();
    function noise() {
      var n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
      n.start(0, Math.random() * 3); return own(n);
    }
    function impulse(seconds, decay) {
      // a single-channel tail: every voice is mono, so one convolution does the work of four
      var len = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(1, len, ctx.sampleRate);
      for (var c = 0; c < 1; c++) {
        var d = b.getChannelData(c);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return b;
    }
    // chain(a, b, c) connects a -> b -> c and returns c
    function chain() {
      for (var i = 0; i < arguments.length - 1; i++) arguments[i].connect(arguments[i + 1]);
      return arguments[arguments.length - 1];
    }
    // a single struck note that rings out
    function pluck(dest, f, when, decay, vol, type) {
      var o = ctx.createOscillator(); o.type = type || "sine"; o.frequency.value = f;
      var g = ctx.createGain(); g.gain.value = 0;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(vol, when + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
      o.connect(g); g.connect(dest);
      o.start(when); o.stop(when + decay + 0.05);
    }

    // ---------- master: remove sub-bass small speakers cannot play, glue, a short reverb, a limiter
    var master = gain(0);
    var hp = filt("highpass", 42, 0.7);
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = 0.05; comp.release.value = 0.4;
    var limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -3; limit.knee.value = 4; limit.ratio.value = 12; limit.attack.value = 0.006; limit.release.value = 0.25;
    var verb = ctx.createConvolver(); verb.buffer = impulse(2.8, 2.6);
    var mix = gain(1), wet = gain(0.4);
    chain(mix, hp, comp); chain(hp, verb, wet, comp); chain(comp, limit, master, dest);

    // per-voice trims, measured with tests/audio-levels.html so every stage sits near the same loudness
    // (the deepest voices sit a little higher, since the ear hears bass as quieter)
    var TRIM = { energy: 0.42, web: 1.06, cluster: 1.95, quasar: 0.69, galaxy: 1.3, heart: 0.77,
                 nursery: 2.24, collapse: 0.6, star: 1.33, worlds: 2.6, giant: 0.85, eye: 1.41 };
    var voices = [];
    function voice(name, build) {
      var trim = gain(TRIM[name] || 1); trim.connect(mix);
      var v = { name: name, build: build, trim: trim, out: null, sources: [], tick: null, next: 0, quietSince: 0 };
      voices.push(v); return v;
    }
    // start a voice's generators
    function wake(v) {
      if (v.out) return;
      v.out = gain(0); v.out.connect(v.trim);
      building = []; v.build(v.out, v); v.sources = building; building = null;
      v.next = 0;
    }
    // stop them once the voice has faded out
    function sleep(v, now) {
      if (!v.out) return;
      v.sources.forEach(function (src) { try { src.stop(now + 0.05); } catch (e) {} });
      var out = v.out; setTimeout(function () { try { out.disconnect(); } catch (e) {} }, 200);
      v.out = null; v.sources = []; v.tick = null;
    }

    // ---------- the twelve stage voices

    // 0 primordial energy: sub-bass, a growling filtered saw, grainy noise, a rising wall of harmonics
    voice("energy", function (o) {
      chain(osc("sine", hz(-12)), gain(0.45), o);
      var lp = filt("lowpass", 180, 6); lfo(0.07, 120, lp.frequency);
      chain(osc("sawtooth", hz(0)), lp, gain(0.2), o);
      var bp = filt("bandpass", 420, 2); lfo(0.13, 300, bp.frequency);
      chain(noise(), bp, gain(0.18), o);
      [2, 3, 4, 5, 6, 8].forEach(function (n) {
        var g = gain(0.03 / Math.sqrt(n)); lfo(0.05 * n, 0.02 / Math.sqrt(n), g.gain);
        chain(osc("sine", hz(0) * n), g, o);
      });
    });

    // 1 cosmic web: glassy open fifths that shimmer, a breath of high air
    voice("web", function (o) {
      [24, 31, 36, 38].forEach(function (s, i) {
        var g = gain(0.05); lfo(0.04 + i * 0.03, 0.035, g.gain);
        chain(osc("sine", hz(s), (i - 1.5) * 4), g, o);
      });
      chain(noise(), filt("highpass", 5500), gain(0.02), o);
    });

    // 2 protocluster: a quiet open pad and scattered bell-like notes, one per galaxy
    voice("cluster", function (o, v) {
      chain(osc("sine", hz(12)), gain(0.05), o);
      chain(osc("sine", hz(19)), gain(0.04), o);
      var scale = [0, 2, 5, 7, 9, 12, 14];
      v.tick = function (t, horizon) {
        while (v.next < t + horizon) {
          if (v.next < t) v.next = t;
          var s = scale[Math.floor(Math.random() * scale.length)];
          pluck(o, hz(36 + s), v.next, 2.6, 0.06, "triangle");
          v.next += 0.35 + Math.random() * 0.6;
        }
      };
    });

    // 3 young galaxy and quasar: a pulsing, bright chord driven hard, a deep throb, a hiss like the jets
    voice("quasar", function (o) {
      var lp = filt("lowpass", 900, 5); lfo(6.5, 500, lp.frequency);
      var g = gain(0.09);
      chain(osc("sawtooth", hz(12), -12), lp); chain(osc("sawtooth", hz(19), 12), lp);
      chain(lp, g, o);
      var sub = gain(0.22); lfo(3, 0.15, sub.gain);
      chain(osc("sine", hz(0)), sub, o);
      chain(noise(), filt("bandpass", 2600, 0.7), gain(0.06), o);
    });

    // 4 a galaxy like ours: a warm, slowly breathing D minor 9 pad
    voice("galaxy", function (o) {
      var lp = filt("lowpass", 1100, 1); lfo(0.05, 400, lp.frequency);
      [0, 3, 7, 10, 14].forEach(function (s, i) {
        chain(osc("sawtooth", hz(12 + s), (i % 2 ? 6 : -6)), lp);
      });
      chain(osc("sawtooth", hz(12), 9), lp);
      chain(lp, gain(0.04), o);
      chain(osc("sine", hz(0)), gain(0.14), o);
    });

    // 5 the dark heart: a slow heartbeat at the edge of hearing, deep rumble, one eerie high tone
    voice("heart", function (o) {
      var beat = gain(0.25); lfo(0.8, 0.25, beat.gain);
      chain(osc("sine", hz(-5)), beat, o);
      var beat2 = gain(0.08); lfo(0.8, 0.08, beat2.gain);
      chain(osc("sine", hz(7)), beat2, o);
      chain(noise(), filt("lowpass", 110, 1), gain(0.35), o);
      var high = osc("sine", hz(39)); lfo(0.3, 8, high.detune);
      chain(high, gain(0.018), o);
    });

    // 6 stellar nursery: breathy vowel-like noise, as if the cloud were singing, over a soft pad
    voice("nursery", function (o) {
      var f1 = filt("bandpass", 650, 8), f2 = filt("bandpass", 1150, 10);
      lfo(0.09, 80, f1.frequency); lfo(0.07, 120, f2.frequency);
      chain(noise(), f1, gain(0.3), o); chain(noise(), f2, gain(0.22), o);
      chain(osc("sine", hz(19)), gain(0.05), o);
      chain(osc("sine", hz(24)), gain(0.035), o);
    });

    // 7 a cloud collapses: a low saw straining against a closing filter, the hiss of infall
    voice("collapse", function (o) {
      var lp = filt("lowpass", 300, 8); lfo(0.25, 200, lp.frequency);
      chain(osc("sawtooth", hz(0)), lp, gain(0.12), o);
      chain(noise(), filt("bandpass", 300, 1.5), gain(0.12), o);
      chain(osc("sine", hz(-12)), gain(0.3), o);
    });

    // 8 a star ignites: the first major chord, bright and warm
    voice("star", function (o) {
      [24, 28, 31, 36].forEach(function (s, i) {
        var g = gain(0.045); lfo(0.11 + i * 0.02, 0.015, g.gain);
        chain(osc("triangle", hz(s)), g, o);
      });
      chain(osc("sine", hz(12)), gain(0.1), o);
    });

    // 9 worlds form: a slow music-box arpeggio over a soft pad, like orbits ticking round
    voice("worlds", function (o, v) {
      chain(osc("sine", hz(24)), gain(0.035), o);
      chain(osc("sine", hz(31)), gain(0.025), o);
      var steps = [0, 4, 7, 9, 12, 9, 7, 4], i = 0;
      v.tick = function (t, horizon) {
        while (v.next < t + horizon) {
          if (v.next < t) v.next = t;
          var f = hz(36 + steps[i % steps.length]);
          pluck(o, f, v.next, 1.8, 0.07, "sine");
          pluck(o, f * 2, v.next, 0.9, 0.02, "sine");
          i++; v.next += 0.48;
        }
      };
    });

    // 10 the star sheds its shell: low, slow, swelling, a minor third that sighs
    voice("giant", function (o) {
      var lp = filt("lowpass", 420, 2);
      var a = osc("sawtooth", hz(0)), b = osc("sawtooth", hz(3));
      lfo(0.03, 10, a.detune); lfo(0.04, 10, b.detune);
      chain(a, lp); chain(b, lp);
      var swell = gain(0.08); lfo(0.04, 0.05, swell.gain);
      chain(lp, swell, o);
      chain(osc("sine", hz(-12)), gain(0.22), o);
    });

    // 11 the universe looks back: resolution, a still D major 9 with high shimmer
    voice("eye", function (o) {
      [24, 31, 38, 40].forEach(function (s, i) {
        var g = gain(0.042); lfo(0.03 + i * 0.015, 0.012, g.gain);
        chain(osc("sine", hz(s)), g, o);
      });
      chain(noise(), filt("highpass", 7000), gain(0.012), o);
      chain(osc("sine", hz(0)), gain(0.1), o);
    });

    // ---------- the rush of a zoom: filtered noise that sweeps up (in) or down (out)
    var rushFilter = filt("bandpass", 400, 1.2), rush = gain(0);
    chain(noise(), rushFilter, rush, mix);

    var LEVEL = 0.8, lastUpdate = -1;
    function smooth(param, value, now, tc) { param.setTargetAtTime(value, now, tc || 0.12); }

    return {
      voices: voices,
      // turn the whole soundtrack up or down
      // seconds: roughly how long the fade takes
      setOn: function (on, seconds) { smooth(master.gain, on ? LEVEL : 0, ctx.currentTime, (seconds || 1.6) / 4); },
      // call every frame with the timeline position and how the current transition moves
      update: function (T, zoom) {
        var now = ctx.currentTime;
        if (now - lastUpdate < 0.05) return;
        lastUpdate = now;
        var nextUp = Math.floor(T) + 1;
        voices.forEach(function (v, k) {
          var w = Math.max(0, 1 - Math.abs(T - k));
          w = Math.sin(w * Math.PI / 2);            // equal-power crossfade
          // the next stage's voice starts early and silently, so it is not built in the busiest moment
          if (w > 0.001 || k === nextUp) { wake(v); v.quietSince = 0; }
          if (!v.out) return;
          smooth(v.out.gain, w, now);
          if (w <= 0.001) {
            if (!v.quietSince) v.quietSince = now;
            else if (now - v.quietSince > 1.5) sleep(v, now);
          }
          if (v.tick && w > 0.05) v.tick(now, 0.3);
        });
        var k = Math.floor(T), fr = T - k, swell = Math.pow(Math.sin(Math.PI * fr), 1.5);
        if (zoom > 0) { smooth(rush.gain, 0.22 * swell, now); smooth(rushFilter.frequency, 150 * Math.pow(30, fr), now, 0.05); }
        else if (zoom < 0) { smooth(rush.gain, 0.22 * swell, now); smooth(rushFilter.frequency, 4500 / Math.pow(30, fr), now, 0.05); }
        else { smooth(rush.gain, 0.05 * swell, now); smooth(rushFilter.frequency, 900, now); }
      },
      // for level checks: play one voice alone
      solo: function (i) {
        voices.forEach(function (v, k) { if (k === i) { wake(v); v.out.gain.value = 1; } });
        master.gain.value = LEVEL;
        if (voices[i].tick) voices[i].tick(0, 8);
      }
    };
  }

  global.createSoundtrack = createSoundtrack;
})(typeof window !== "undefined" ? window : this);
