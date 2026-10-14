/**
 * @fileoverview Diccionario Digital Interactivo de las Prendas
 *
 * LECCIÓN (4 prendas) → imágenes con TRANSICIÓN SUAVE (fundido cruzado + lento
 * movimiento de cámara) para que parezca un video de cambio de ropa. La imagen
 * nueva aparece encima de la anterior: nunca se ve la pantalla vacía.
 *
 *   (base)       la niña con todas las prendas: pantalla de inicio
 *   VESTIDO      →  ZAPATILLAS  →  PANTALÓN  →  POLO
 *
 * En cada prenda la voz dice PRIMERO la prenda y LUEGO su frase.
 * JUEGO → 4 fotos; se toca la prenda preguntada.
 *
 * VOZ: la lee la voz virtual del navegador (SpeechSynthesis, en español).
 * No se necesitan archivos de audio. El botón de sonido la silencia.
 *
 * ⚠ Las frases de abajo son un BORRADOR: cámbialas en el arreglo PRENDAS.
 *
 * @version 1.0.0
 */

'use strict';

/* ============================================================
   DATOS
   ============================================================ */

const IMG = './assets/images/';

/** Imagen base de la presentación (la niña vestida con todo). */
const BASE_IMAGE = IMG + 'nina.jpg';

/** Duración del fundido cruzado entre prendas (debe coincidir con el CSS: 1s). */
const TRANSITION_MS = 1000;

const PRENDAS = [
  {
    id: 'vestido', label: 'VESTIDO', icon: '👗', color: '#e8588d',
    phrase:   'Me pongo el vestido cuando quiero verme bonita.',
    question: '¿Cuál es el vestido?',
    answer:   'Este es el vestido.',
    image: IMG + 'vestido.jpg', card: IMG + 'card_vestido.jpg',
  },
  {
    id: 'zapatillas', label: 'ZAPATILLAS', icon: '👟', color: '#f29a00',
    phrase:   'Me pongo las zapatillas para correr y jugar.',
    question: '¿Cuáles son las zapatillas?',
    answer:   'Estas son las zapatillas.',
    image: IMG + 'zapatillas.jpg', card: IMG + 'card_zapatillas.jpg',
  },
  {
    id: 'pantalon', label: 'PANTALÓN', icon: '👖', color: '#2f80ed',
    phrase:   'Me pongo el pantalón para abrigar mis piernas.',
    question: '¿Cuál es el pantalón?',
    answer:   'Este es el pantalón.',
    image: IMG + 'pantalon.jpg', card: IMG + 'card_pantalon.jpg',
  },
  {
    id: 'polo', label: 'POLO', icon: '👕', color: '#7b3fd4',
    phrase:   'Me pongo el polo cuando hace calor.',
    question: '¿Cuál es el polo?',
    answer:   'Este es el polo.',
    image: IMG + 'polo.jpg', card: IMG + 'card_polo.jpg',
  },
];

const TOTAL = PRENDAS.length;

/* ============================================================
   UTILIDADES
   ============================================================ */

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ============================================================
   VOZ VIRTUAL (SpeechSynthesis del navegador, sin archivos de audio)
   ============================================================ */

class VoiceManager {
  constructor() {
    this._synth  = 'speechSynthesis' in window ? window.speechSynthesis : null;
    this._voice  = null;
    this._muted  = false;
    this._timer  = 0;
    this._resolve = null;
    if (this._synth) {
      this._pickVoice();
      this._synth.addEventListener?.('voiceschanged', () => this._pickVoice());
    }
  }

  get muted()    { return this._muted; }
  get hasVoice() { return !!this._voice; }

  /** Elige la mejor voz en español disponible (prefiere es-PE / es-419 / es-US / es-MX). */
  _pickVoice() {
    const all = this._synth.getVoices();
    const es  = all.filter((v) => /^es([-_]|$)/i.test(v.lang));
    if (!es.length) { this._voice = null; return; }
    const rank = (v) => {
      const lang = v.lang.replace('_', '-').toLowerCase();
      const order = ['es-pe', 'es-419', 'es-us', 'es-mx', 'es-co', 'es-ar', 'es-es'];
      let s = order.indexOf(lang); s = s < 0 ? order.length : s;
      if (/google|natural|online|neural|premium|paulina|monica|sabina|helena|laura/i.test(v.name)) s -= 0.5;
      return s;
    };
    this._voice = es.sort((a, b) => rank(a) - rank(b))[0];
  }

  /** Lee el texto. Devuelve una promesa que se cumple al terminar (o al cancelarse). */
  speak(text) {
    this.stop();
    if (!this._synth || this._muted) return Promise.resolve();
    return new Promise((resolve) => {
      this._resolve = resolve;
      const u = new SpeechSynthesisUtterance(text);
      u.lang   = this._voice ? this._voice.lang : 'es-PE';
      if (this._voice) u.voice = this._voice;
      u.rate   = 0.9;     // un poco más lento para niños
      u.pitch  = 1.1;
      const done = () => { clearTimeout(this._timer); if (this._resolve === resolve) this._resolve = null; resolve(); };
      u.onend = done; u.onerror = done;
      // Respaldo: si el navegador nunca avisa que terminó
      this._timer = setTimeout(done, 1500 + text.length * 110);
      // Pequeño retraso: evita que cancel() + speak() seguidos se pierdan en Chrome
      setTimeout(() => { if (this._resolve === resolve) this._synth.speak(u); }, 60);
    });
  }

  stop() {
    clearTimeout(this._timer);
    if (this._synth) this._synth.cancel();
    if (this._resolve) { const r = this._resolve; this._resolve = null; r(); }
  }

  toggleMute() {
    this._muted = !this._muted;
    if (this._muted) this.stop();
    return this._muted;
  }
}

/* ============================================================
   ESCENA (diapositivas con fundido cruzado / tarjetas del juego)
   ============================================================ */

class SceneController {
  constructor(slidesEl, gridEl, stageEl) {
    this._slides  = slidesEl;
    this._grid    = gridEl;
    this._stage   = stageEl;
    this._current = null;
  }

  _makeSlide(src) {
    const slide = document.createElement('div');
    slide.className = 'slide';
    const bg = document.createElement('div');
    bg.className = 'slide-bg';
    bg.style.backgroundImage = `url("${src}")`;
    const img = document.createElement('img');
    img.className = 'slide-img';
    img.alt = '';
    img.draggable = false;
    img.src = src;
    slide.append(bg, img);
    return slide;
  }

  /**
   * Muestra una imagen con fundido cruzado: la nueva aparece ENCIMA de la
   * anterior (que sigue visible debajo), así nunca hay un cuadro vacío.
   * @param {string}  src
   * @param {boolean} instant  sin transición (carga inicial)
   */
  async show(src, instant = false) {
    this._stage.classList.remove('is-game');
    this._grid.hidden   = true;
    this._slides.hidden = false;

    if (src === this._current) { this.replay(); return; }
    this._current = src;

    const slide = this._makeSlide(src);
    this._slides.appendChild(slide);
    try { await slide.querySelector('img').decode(); } catch (e) { /* imagen no disponible */ }

    if (instant) slide.classList.add('instant');
    void slide.offsetWidth;                  // reinicia el estado antes de animar
    slide.classList.add('in');

    // Al terminar el fundido, se quitan las diapositivas anteriores a esta
    const cleanup = () => {
      while (slide.parentNode === this._slides && this._slides.firstChild !== slide) {
        this._slides.removeChild(this._slides.firstChild);
      }
    };
    if (instant) cleanup(); else setTimeout(cleanup, TRANSITION_MS + 80);
  }

  /** Reinicia el movimiento de cámara de la imagen actual (al repetir). */
  replay() {
    const img = this._slides.lastElementChild?.querySelector('.slide-img');
    if (!img) return;
    img.style.animation = 'none';
    void img.offsetWidth;
    img.style.animation = '';
  }

  /** Pantalla de inicio: la niña con todas las prendas. */
  showHome(instant = false) { return this.show(BASE_IMAGE, instant); }

  /** Juego: oculta las diapositivas y muestra las tarjetas. */
  showGame() {
    this._slides.hidden = true;
    this._stage.classList.add('is-game');
    this._grid.hidden   = false;
  }
}

/* ============================================================
   ESTADO
   ============================================================ */

class StateManager {
  constructor() {
    this._mode  = 'welcome';
    this._epoch = 0;
  }
  get mode()  { return this._mode; }
  get epoch() { return this._epoch; }
  newEpoch()  { return ++this._epoch; }

  show(name) {
    this._mode = name;
    ['welcome', 'lesson', 'game', 'finish'].forEach((id) => { $(id).hidden = id !== name; });
    $('controls').hidden = name === 'welcome' || name === 'finish';
    $('prev').hidden     = name === 'game';
    $('next').hidden     = name === 'game';
  }

  updateProgress(current, total) {
    $('dots').innerHTML = Array.from({ length: total }, (_, n) => {
      const cls = n === current ? 'current' : n < current ? 'done' : '';
      return `<span class="dot ${cls}"></span>`;
    }).join('');
  }
}

/* ============================================================
   LECCIÓN
   ============================================================ */

class LessonMode {
  constructor(scene, state, voice) {
    this._scene = scene;
    this._state = state;
    this._voice = voice;
    this._index = 0;
  }

  async goTo(i) {
    const token = this._reset();
    this._index = i;
    this._state.show('lesson');

    $('prev').disabled     = i === 0;
    $('next').textContent  = i === TOTAL - 1 ? 'JUGAR →' : 'SIGUIENTE →';
    $('count').textContent = `${i + 1} DE ${TOTAL}`;
    this._state.updateProgress(i, TOTAL);

    await this._play(i, token);
  }

  /** Muestra el texto, hace la transición y la voz dice la prenda y luego su frase. */
  async _play(i, token) {
    const p = PRENDAS[i];
    $('word').textContent       = p.label;
    $('word').style.setProperty('--w', p.color);
    $('word').className         = p.label.length >= 11 ? 'xlong' : p.label.length >= 8 ? 'long' : '';
    $('phrase').textContent     = p.phrase;
    $('lessonIcon').textContent = p.icon;
    $('lessonIcon').hidden      = false;

    // "Vestido... Me pongo el vestido cuando..."
    const name = p.label.charAt(0) + p.label.slice(1).toLowerCase();
    this._voice.speak(`${name}... ${p.phrase}`);
    await this._scene.show(p.image);
  }

  /** Vuelve a decir la prenda y su frase. */
  async repeat() {
    const token = this._reset();
    this._state.show('lesson');
    await this._play(this._index, token);
  }

  prev() { if (this._index > 0) this.goTo(this._index - 1); }

  next() {
    if (this._index < TOTAL - 1) { this.goTo(this._index + 1); return false; }
    return true; // → iniciar juego
  }

  _reset() {
    const token = this._state.newEpoch();
    this._voice.stop();
    $('celebration').hidden = true;
    $('stage').classList.remove('encourage');
    return token;
  }
}

/* ============================================================
   JUEGO
   ============================================================ */

class GameMode {
  constructor(scene, state, voice) {
    this._scene  = scene;
    this._state  = state;
    this._voice  = voice;
    this._queue  = [];
    this._turn   = 0;
    this._ready  = false;
    this._locked = false;
  }

  start() {
    this._scene.showGame();
    this._queue = shuffle(PRENDAS);
    this._turn  = 0;
    this._ask();
  }

  _ask() {
    const token = this._state.newEpoch();
    $('celebration').hidden = true;
    this._state.show('game');
    const cur = this._queue[this._turn];
    $('question').textContent  = cur.question;
    $('feedback').textContent  = '👆 TOCA LA PRENDA';
    $('gameCount').textContent = `${this._turn + 1} DE ${this._queue.length}`;

    // Las prendas cambian de lugar en cada pregunta
    const grid = $('gameGrid');
    grid.innerHTML = '';
    shuffle(PRENDAS).forEach((p, n) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'emo-card';
      b.dataset.id = p.id;
      b.setAttribute('aria-label', `Prenda ${n + 1}`);
      b.innerHTML = `<img src="${p.card}" alt="" draggable="false">`;
      b.addEventListener('click', () => this.pick(b, token));
      grid.appendChild(b);
    });
    this._ready  = true;
    this._locked = false;
    this._voice.speak(cur.question);
  }

  repeatQuestion() {
    if (!this._locked && this._queue[this._turn]) this._voice.speak(this._queue[this._turn].question);
  }

  async pick(card, token) {
    if (!this._ready || this._locked || token !== this._state.epoch) return;
    this._locked = true;
    const cur = this._queue[this._turn];

    if (card.dataset.id === cur.id) {
      card.classList.add('correct');
      document.querySelectorAll('.emo-card').forEach((c) => { c.disabled = true; if (c !== card) c.classList.add('dim'); });
      $('feedback').textContent = `¡MUY BIEN! ${cur.answer}`;
      $('celebration').hidden   = false;
      await Promise.all([sleep(2200), this._voice.speak(`¡Muy bien! ${cur.answer}`)]);
      if (token !== this._state.epoch) return;
      this._turn++;
      if (this._turn < this._queue.length) this._ask();
      else this._finish();
    } else {
      card.classList.add('wrong', 'dim');
      card.disabled = true;
      $('feedback').textContent = '¡INTÉNTALO OTRA VEZ!';
      this._voice.speak('Inténtalo otra vez');
      await sleep(700);
      if (token !== this._state.epoch) return;
      card.classList.remove('wrong');
      $('feedback').textContent = '👆 TOCA LA PRENDA';
      this._locked = false;
    }
  }

  _finish() {
    this._state.newEpoch();
    $('celebration').hidden = true;
    this._state.show('finish');
    this._voice.speak('¡Excelente trabajo! ¡Ya conoces las prendas!');
  }
}

/* ============================================================
   APP
   ============================================================ */

class App {
  constructor() {
    this.scene  = new SceneController($('slides'), $('gameGrid'), $('stage'));
    this.voice  = new VoiceManager();
    this.state  = new StateManager();
    this.lesson = new LessonMode(this.scene, this.state, this.voice);
    this.game   = new GameMode(this.scene, this.state, this.voice);

    this.state.show('welcome');
    this.scene.showHome(true);
    this._bind();
    this._voiceStatus();
  }

  /** Aviso si el dispositivo no tiene voz en español. */
  _voiceStatus() {
    const show = () => {
      $('status').textContent = ('speechSynthesis' in window && !this.voice.hasVoice)
        ? 'SI NO ESCUCHAS LA VOZ, INSTALA UNA VOZ EN ESPAÑOL EN TU DISPOSITIVO.' : '';
    };
    setTimeout(show, 1500);
    window.speechSynthesis?.addEventListener?.('voiceschanged', show);
  }

  _bind() {
    $('start').onclick      = () => this.lesson.goTo(0);
    $('prev').onclick       = () => { if (this.state.mode === 'lesson') this.lesson.prev(); };
    $('next').onclick       = () => {
      if (this.state.mode === 'lesson' && this.lesson.next()) this.game.start();
    };
    $('listen').onclick     = () => { if (this.state.mode === 'lesson') this.lesson.repeat(); };
    $('repeat').onclick     = () => {
      if (this.state.mode === 'lesson') this.lesson.repeat();
      else if (this.state.mode === 'game') this.game.repeatQuestion();
    };
    $('home').onclick       = () => {
      this.state.newEpoch();
      this.voice.stop();
      $('celebration').hidden = true;
      this.scene.showHome();
      this.state.show('welcome');
    };
    $('again').onclick      = () => this.game.start();
    $('dictionary').onclick = () => this.lesson.goTo(0);

    $('sound').onclick = () => {
      const muted = this.voice.toggleMute();
      $('sound').setAttribute('aria-label', muted ? 'Activar voz' : 'Desactivar voz');
      $('sound').setAttribute('aria-pressed', String(!muted));
      if (!muted) {
        if (this.state.mode === 'lesson') this.lesson.repeat();
        else if (this.state.mode === 'game') this.game.repeatQuestion();
      }
    };

    document.addEventListener('visibilitychange', () => { if (document.hidden) this.voice.stop(); });
  }
}

const app = new App();
