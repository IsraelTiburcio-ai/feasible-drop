/* ============================================================
   FEASIBLE DROP · game engine
   Vanilla JS, SVG and Web Audio only.
   ============================================================ */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const SVG_NS = "http://www.w3.org/2000/svg";
  const screenIds = ["screen-cover", "screen-game", "screen-results"];
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const state = {
    roundIndex: 0,
    score: 0,
    correct: 0,
    gameStartedAt: 0,
    roundEndsAt: 0,
    timerFrame: 0,
    nextRoundTimer: 0,
    answerLocked: false,
    soundOn: true,
    audioContext: null
  };

  const elements = {
    cover: $("screen-cover"),
    game: $("screen-game"),
    results: $("screen-results"),
    play: $("btn-play"),
    again: $("btn-again"),
    coverMute: $("btn-mute-cover"),
    mute: $("btn-mute"),
    dots: $("hud-dots"),
    score: $("hud-score"),
    timer: $("timer-fill"),
    model: $("model-chip"),
    stage: $("stage"),
    prompt: $("prompt"),
    answers: $("answers"),
    feedback: $("feedback"),
    fbIcon: $("fb-ico"),
    fbVerdict: $("fb-verdict"),
    fbPoints: $("fb-points"),
    fbChecks: $("fb-checks"),
    fbNote: $("fb-note"),
    stars: $("stars"),
    resultsTitle: $("results-title"),
    resultScore: $("res-score"),
    resultAccuracy: $("res-acc"),
    resultTime: $("res-time")
  };

  function showScreen(screen) {
    screenIds.forEach((id) => $(id).classList.toggle("active", id === screen));
  }

  function svgElement(tag, attributes, text) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) node.setAttribute(key, String(value));
    });
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function addSvgText(parent, x, y, text, className, extra = {}) {
    const textNode = svgElement("text", { x, y, class: className, ...extra }, text);
    parent.appendChild(textNode);
    return textNode;
  }

  function setText(node, value) {
    node.textContent = value;
  }

  function updateSoundControls() {
    const icon = state.soundOn ? "🔊" : "🔇";
    const label = state.soundOn ? "Silenciar sonido" : "Activar sonido";
    elements.mute.textContent = icon;
    elements.mute.setAttribute("aria-label", label);
    elements.mute.setAttribute("aria-pressed", String(!state.soundOn));
    elements.coverMute.textContent = `${icon} Sonido`;
    elements.coverMute.setAttribute("aria-label", label);
    elements.coverMute.setAttribute("aria-pressed", String(!state.soundOn));
  }

  function ensureAudio() {
    if (!state.soundOn) return null;
    if (!state.audioContext) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      state.audioContext = new AudioCtor();
    }
    if (state.audioContext.state === "suspended") state.audioContext.resume();
    return state.audioContext;
  }

  function tone(frequency, duration, type = "sine", volume = 0.035, delay = 0) {
    const context = ensureAudio();
    if (!context) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  const sounds = {
    tap() {
      tone(460, 0.08, "sine", 0.025);
    },
    correct() {
      tone(523.25, 0.14, "sine", 0.035);
      tone(783.99, 0.22, "sine", 0.04, 0.1);
    },
    wrong() {
      tone(180, 0.18, "triangle", 0.04);
      tone(125, 0.22, "triangle", 0.03, 0.09);
    },
    finish() {
      tone(523.25, 0.14, "sine", 0.03);
      tone(659.25, 0.14, "sine", 0.035, 0.11);
      tone(783.99, 0.3, "sine", 0.045, 0.22);
    }
  };

  function formatTime(milliseconds) {
    const seconds = Math.max(0, Math.round(milliseconds / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function updateScore() {
    setText(elements.score, state.score);
  }

  function renderDots() {
    elements.dots.replaceChildren();
    ROUNDS.forEach((_, index) => {
      const dot = document.createElement("span");
      dot.className = "round-dot";
      if (index < state.roundIndex) dot.classList.add("done");
      if (index === state.roundIndex) dot.classList.add("current");
      dot.setAttribute("aria-label", `Ronda ${index + 1}${index < state.roundIndex ? ": completada" : index === state.roundIndex ? ": actual" : ""}`);
      elements.dots.appendChild(dot);
    });
  }

  function makeMapper(model) {
    const W = 420;
    const H = 382;
    const pad = { left: 43, right: 18, top: 18, bottom: 35 };
    const plotWidth = W - pad.left - pad.right;
    const plotHeight = H - pad.top - pad.bottom;
    const x0 = pad.left;
    const y0 = H - pad.bottom;
    const x1 = W - pad.right;
    const y1 = pad.top;

    return {
      W,
      H,
      pad,
      x0,
      y0,
      x1,
      y1,
      x(value) {
        return x0 + (value / model.view.xMax) * plotWidth;
      },
      y(value) {
        return y0 - (value / model.view.yMax) * plotHeight;
      }
    };
  }

  function addDrone(parent, className = "") {
    const drone = svgElement("g", { class: `drone-group ${className}`.trim() });
    drone.appendChild(svgElement("line", { x1: -8, y1: -18, x2: -15, y2: -21, class: "drone-leg" }));
    drone.appendChild(svgElement("line", { x1: 8, y1: -18, x2: 15, y2: -21, class: "drone-leg" }));
    drone.appendChild(svgElement("circle", { cx: -15, cy: -21, r: 2.5, class: "drone-prop" }));
    drone.appendChild(svgElement("circle", { cx: 15, cy: -21, r: 2.5, class: "drone-prop" }));
    drone.appendChild(svgElement("rect", { x: -9, y: -18, width: 18, height: 9, rx: 4.5, class: "drone-shell" }));
    drone.appendChild(svgElement("circle", { cx: 0, cy: -13.5, r: 2.35, class: "drone-window" }));
    drone.appendChild(svgElement("line", { x1: -6, y1: -9, x2: -8, y2: -3, class: "drone-leg" }));
    drone.appendChild(svgElement("line", { x1: 6, y1: -9, x2: 8, y2: -3, class: "drone-leg" }));
    parent.appendChild(drone);
    return drone;
  }

  function pointLabelPosition(point, mapper, model) {
    const px = mapper.x(point.xy[0]);
    const py = mapper.y(point.xy[1]);
    const nearRight = px > mapper.x1 - 65;
    const nearTop = py < mapper.y1 + 38;
    return {
      x: nearRight ? -8 : 8,
      anchor: nearRight ? "end" : "start",
      nameY: nearTop ? 14 : -8,
      coordY: nearTop ? 23 : 1
    };
  }

  function appendCandidatePoint(parent, point, mapper, model, onSelect, index) {
    const px = mapper.x(point.xy[0]);
    const py = mapper.y(point.xy[1]);
    const group = svgElement("g", {
      class: "point-hit",
      transform: `translate(${px} ${py})`,
      role: "button",
      tabindex: "0",
      "aria-label": `Punto ${point.name}, coordenadas ${point.xy[0]}, ${point.xy[1]}. Seleccionar punto.`
    });

    group.dataset.pointName = point.name;
    group.dataset.pointIndex = index;
    group.appendChild(svgElement("circle", { r: 25, class: "hit-ring" }));
    group.appendChild(svgElement("circle", { r: 7, class: "point-marker" }));
    group.appendChild(svgElement("circle", { r: 2.5, class: "point-marker-core" }));

    const label = pointLabelPosition(point, mapper, model);
    addSvgText(group, label.x, label.nameY, point.name, "point-text point-name", { "text-anchor": label.anchor });
    addSvgText(group, label.x, label.coordY, `(${point.xy[0]}, ${point.xy[1]})`, "point-text", { "text-anchor": label.anchor });

    addDrone(group, "landing");

    const select = () => {
      if (state.answerLocked) return;
      sounds.tap();
      onSelect(point.name);
    };
    group.addEventListener("click", select);
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
      }
    });
    parent.appendChild(group);
    return group;
  }

  function appendSinglePoint(parent, point, mapper, model) {
    const px = mapper.x(point.xy[0]);
    const py = mapper.y(point.xy[1]);
    const group = svgElement("g", {
      class: "point-hit disabled single-point",
      transform: `translate(${px} ${py})`,
      "aria-label": `Punto ${point.name}, coordenadas ${point.xy[0]}, ${point.xy[1]}`
    });
    group.dataset.pointName = point.name;
    group.appendChild(svgElement("circle", { r: 7, class: "point-marker" }));
    group.appendChild(svgElement("circle", { r: 2.5, class: "point-marker-core" }));
    const label = pointLabelPosition(point, mapper, model);
    addSvgText(group, label.x, label.nameY, point.name, "point-text point-name", { "text-anchor": label.anchor });
    addSvgText(group, label.x, label.coordY, `(${point.xy[0]}, ${point.xy[1]})`, "point-text", { "text-anchor": label.anchor });
    addDrone(group, "landing");
    parent.appendChild(group);
    return group;
  }

  function renderGrid(svg, model, mapper) {
    const grid = svgElement("g", { class: "grid" });
    const xStep = model.view.tickX;
    const yStep = model.view.tickY;
    const xCount = Math.floor(model.view.xMax / xStep + 0.0001);
    const yCount = Math.floor(model.view.yMax / yStep + 0.0001);
    const everyX = model.view.tickEveryX || 1;
    const everyY = model.view.tickEveryY || 1;

    for (let i = 0; i <= xCount; i += 1) {
      const value = i * xStep;
      const x = mapper.x(value);
      const major = i % everyX === 0;
      grid.appendChild(svgElement("line", { x1: x, y1: mapper.y(0), x2: x, y2: mapper.y(model.view.yMax), class: `grid-line${major ? " major" : ""}` }));
      if (major && value > 0) addSvgText(grid, x, mapper.y(0) + 15, value, "tick-label", { "text-anchor": "middle" });
    }

    for (let i = 0; i <= yCount; i += 1) {
      const value = i * yStep;
      const y = mapper.y(value);
      const major = i % everyY === 0;
      grid.appendChild(svgElement("line", { x1: mapper.x(0), y1: y, x2: mapper.x(model.view.xMax), y2: y, class: `grid-line${major ? " major" : ""}` }));
      if (major && value > 0) addSvgText(grid, mapper.x(0) - 8, y + 3, value, "tick-label", { "text-anchor": "end" });
    }
    svg.appendChild(grid);
  }

  function renderAxes(svg, mapper) {
    const axes = svgElement("g", { class: "axes" });
    axes.appendChild(svgElement("line", { x1: mapper.x(0), y1: mapper.y(0), x2: mapper.x1 + 5, y2: mapper.y(0), class: "axis-line" }));
    axes.appendChild(svgElement("line", { x1: mapper.x(0), y1: mapper.y(0), x2: mapper.x(0), y2: mapper.y1 - 5, class: "axis-line" }));
    addSvgText(axes, mapper.x1 + 7, mapper.y(0) + 3, "x", "axis-label");
    addSvgText(axes, mapper.x(0) - 2, mapper.y1 - 7, "y", "axis-label", { "text-anchor": "end" });
    svg.appendChild(axes);
  }

  function renderRegion(svg, model, mapper) {
    const points = model.region.map(([x, y]) => `${mapper.x(x)},${mapper.y(y)}`).join(" ");
    svg.appendChild(svgElement("polygon", { points, class: "region-fill" }));

    const labelPosition = model.id === "m1" ? [12, 27] : [0.65, 4.75];
    const label = svgElement("text", {
      x: mapper.x(labelPosition[0]),
      y: mapper.y(labelPosition[1]),
      class: "region-label",
      "text-anchor": "middle"
    });
    label.appendChild(svgElement("tspan", { x: mapper.x(labelPosition[0]), dy: 0 }, "REGIÓN"));
    label.appendChild(svgElement("tspan", { x: mapper.x(labelPosition[0]), dy: 10 }, "FACTIBLE"));
    svg.appendChild(label);
  }

  function renderConstraintLines(svg, model, mapper, clipId) {
    const lineGroup = svgElement("g", {
      class: "constraints",
      ...(clipId ? { "clip-path": `url(#${clipId})` } : {})
    });
    model.lines.forEach((line) => {
      lineGroup.appendChild(svgElement("line", {
        x1: mapper.x(line.from[0]),
        y1: mapper.y(line.from[1]),
        x2: mapper.x(line.to[0]),
        y2: mapper.y(line.to[1]),
        class: "constraint-line",
        stroke: line.color
      }));
    });
    svg.appendChild(lineGroup);

    const labels = svgElement("g", { class: "constraint-labels" });
    model.lines.forEach((line) => {
      const x = mapper.x(line.labelAt[0]);
      const y = mapper.y(line.labelAt[1]);
      const label = svgElement("text", { x, y, class: "constraint-label", "text-anchor": "middle" });
      label.appendChild(svgElement("tspan", { class: "constraint-key", fill: line.color }, line.id));
      label.appendChild(svgElement("tspan", {}, `  ${line.label}`));
      labels.appendChild(label);
    });
    svg.appendChild(labels);
  }

  function renderVertices(svg, model, mapper) {
    if (!model.vertices.length) return;
    const vertices = svgElement("g", { class: "vertices" });
    const offsets = {
      D: [-10, 13],
      B: [5, 13],
      A: [6, -7],
      C: [6, -6]
    };
    model.vertices.forEach((vertex) => {
      const x = mapper.x(vertex.p[0]);
      const y = mapper.y(vertex.p[1]);
      vertices.appendChild(svgElement("circle", { cx: x, cy: y, r: 3, class: "vertex-dot" }));
      const [dx, dy] = offsets[vertex.label] || [5, -5];
      addSvgText(vertices, x + dx, y + dy, vertex.label, "vertex-label");
    });
    svg.appendChild(vertices);
  }

  function buildPlot(round) {
    const model = MODELS[round.model];
    const mapper = makeMapper(model);
    const svg = svgElement("svg", {
      class: "plot-svg",
      viewBox: `0 0 ${mapper.W} ${mapper.H}`,
      role: round.type === "toca" ? "group" : "img",
      "aria-label": `Plano cartesiano con región factible del modelo ${model.title}`
    });

    const defs = svgElement("defs");
    const clipId = `plot-clip-${state.roundIndex}`;
    const clip = svgElement("clipPath", { id: clipId });
    clip.appendChild(svgElement("rect", { x: mapper.x(0), y: mapper.y(model.view.yMax), width: mapper.x(model.view.xMax) - mapper.x(0), height: mapper.y(0) - mapper.y(model.view.yMax) }));
    defs.appendChild(clip);
    svg.appendChild(defs);
    svg.appendChild(svgElement("rect", { x: 0, y: 0, width: mapper.W, height: mapper.H, class: "plot-bg" }));

    const plotContent = svgElement("g");
    renderGrid(plotContent, model, mapper);
    renderRegion(plotContent, model, mapper);
    renderConstraintLines(plotContent, model, mapper, clipId);
    renderAxes(plotContent, mapper);
    renderVertices(plotContent, model, mapper);
    svg.appendChild(plotContent);

    const pointLayer = svgElement("g", { class: "point-layer" });
    if (round.type === "sino") {
      appendSinglePoint(pointLayer, round.point, mapper, model);
    } else {
      round.points.forEach((point, index) => appendCandidatePoint(pointLayer, point, mapper, model, handleTocaAnswer, index));
    }
    svg.appendChild(pointLayer);
    return svg;
  }

  function renderModelChip(model) {
    elements.model.replaceChildren();
    const objective = document.createElement("span");
    objective.className = "model-objective";
    const max = document.createElement("span");
    max.className = "max";
    max.textContent = "max";
    objective.append(max, document.createTextNode(model.title.slice(3)));

    const restrictions = document.createElement("span");
    restrictions.className = "model-restrictions";
    restrictions.textContent = model.restrictions;
    elements.model.append(objective, restrictions);
  }

  function renderPrompt(round) {
    elements.prompt.replaceChildren();
    const prompt = document.createElement("span");
    if (round.type === "sino") {
      prompt.append("¿Este punto ");
      const accent = document.createElement("span");
      accent.className = "prompt-accent";
      accent.textContent = `(${round.point.xy[0]}, ${round.point.xy[1]})`;
      prompt.append(accent, " pertenece a la región factible?");
    } else {
      prompt.textContent = round.find === "member"
        ? "TOCA el punto que SÍ pertenece"
        : "TOCA el intruso: el que NO pertenece";
      prompt.classList.add("prompt-accent");
    }
    elements.prompt.appendChild(prompt);
  }

  function renderAnswers(round) {
    elements.answers.replaceChildren();
    if (round.type === "sino") {
      elements.answers.className = "answers sino-answers";
      const yes = document.createElement("button");
      yes.className = "answer-btn";
      yes.type = "button";
      yes.textContent = "✓  SÍ PERTENECE";
      yes.setAttribute("aria-label", "Sí pertenece a la región factible");
      yes.addEventListener("click", () => {
        sounds.tap();
        handleSinoAnswer(true);
      });

      const no = document.createElement("button");
      no.className = "answer-btn";
      no.type = "button";
      no.textContent = "✕  NO PERTENECE";
      no.setAttribute("aria-label", "No pertenece a la región factible");
      no.addEventListener("click", () => {
        sounds.tap();
        handleSinoAnswer(false);
      });
      elements.answers.append(yes, no);
    } else {
      elements.answers.className = "answers toca-answers";
      const hint = document.createElement("div");
      hint.className = "tap-hint";
      hint.textContent = "También puedes usar Tab + Enter";
      elements.answers.appendChild(hint);
    }
  }

  function renderRound() {
    const round = ROUNDS[state.roundIndex];
    state.answerLocked = false;
    elements.feedback.hidden = true;
    elements.feedback.classList.remove("is-visible", "is-wrong");
    elements.timer.classList.remove("warning", "danger");
    renderDots();
    renderModelChip(MODELS[round.model]);
    renderPrompt(round);
    renderAnswers(round);
    elements.stage.replaceChildren(buildPlot(round));
    startTimer();
  }

  function startTimer() {
    cancelAnimationFrame(state.timerFrame);
    state.roundEndsAt = performance.now() + ROUND_TIME * 1000;
    const duration = ROUND_TIME * 1000;

    function tick(now) {
      if (state.answerLocked) return;
      const remaining = Math.max(0, state.roundEndsAt - now);
      const ratio = remaining / duration;
      elements.timer.style.transform = `scaleX(${ratio})`;
      elements.timer.classList.toggle("warning", ratio < 0.5 && ratio >= 0.25);
      elements.timer.classList.toggle("danger", ratio < 0.25);
      if (remaining <= 0) {
        answerRound(null, true);
        return;
      }
      state.timerFrame = requestAnimationFrame(tick);
    }

    elements.timer.style.transform = "scaleX(1)";
    state.timerFrame = requestAnimationFrame(tick);
  }

  function getRemainingSeconds() {
    return Math.max(0, (state.roundEndsAt - performance.now()) / 1000);
  }

  function handleSinoAnswer(answer) {
    answerRound(answer, false);
  }

  function handleTocaAnswer(name) {
    const round = ROUNDS[state.roundIndex];
    const target = round.points.find((point) => point.name === name);
    if (!target) return;
    answerRound(name, false);
  }

  function disableAnswerControls() {
    elements.answers.querySelectorAll("button").forEach((button) => {
      button.disabled = true;
    });
    elements.stage.querySelectorAll(".point-hit").forEach((point) => {
      point.classList.add("disabled");
      point.setAttribute("aria-disabled", "true");
    });
  }

  function revealPointClasses(round, selection) {
    if (round.type === "sino") {
      const pointGroup = elements.stage.querySelector(".single-point");
      if (!pointGroup) return;
      const drone = pointGroup.querySelector(".drone-group");
      const actualClass = round.belongs ? "actual-belongs" : "actual-outside";
      pointGroup.classList.add(actualClass);
      drone.classList.add(actualClass);
      if (!prefersReducedMotion.matches) drone.classList.add("landing");
      if (selection !== null && selection !== round.belongs) drone.classList.add("user-wrong");
      return;
    }

    elements.stage.querySelectorAll(".point-hit").forEach((group) => {
      const point = round.points.find((candidate) => candidate.name === group.dataset.pointName);
      const drone = group.querySelector(".drone-group");
      if (!point || !drone) return;
      const actualClass = point.belongs ? "actual-belongs" : "actual-outside";
      group.classList.add(actualClass);
      drone.classList.add(actualClass);
      if (point.name === round.correctName) {
        group.classList.add("requested-target");
        drone.classList.add("requested-target");
      }
      if (selection === point.name && selection === round.correctName) group.classList.add("user-hit");
      if (selection === point.name && selection !== round.correctName) drone.classList.add("user-wrong");
    });
  }

  function buildVerdict(round, selection, isCorrect, timedOut) {
    if (timedOut) return "Tiempo fuera · esta era la respuesta";
    if (round.type === "sino") {
      if (isCorrect) return round.belongs ? "¡SÍ pertenece!" : "¡NO pertenece!";
      return round.belongs ? "La respuesta era SÍ pertenece" : "La respuesta era NO pertenece";
    }
    if (isCorrect) return round.find === "member" ? "¡Aterrizaje exitoso!" : "¡Intruso detectado!";
    return round.find === "member" ? `Era ${round.correctName}: SÍ pertenece` : `Era ${round.correctName}: NO pertenece`;
  }

  function renderChecks(checks) {
    elements.fbChecks.replaceChildren();
    checks.forEach((check) => {
      const line = document.createElement("div");
      line.className = `fb-check ${check.ok ? "ok" : "bad"}`;
      const symbol = check.ok ? "✓" : "✗";
      const cleaned = check.txt.replace(/\s*[✓✗]\s*$/, "");
      line.textContent = `${symbol} ${cleaned}`;
      elements.fbChecks.appendChild(line);
    });
  }

  function showFeedback(round, selection, isCorrect, pointsEarned, timedOut) {
    elements.feedback.hidden = false;
    elements.feedback.classList.remove("is-visible", "is-wrong");
    // Force a fresh entrance animation when consecutive rounds reuse the panel.
    void elements.feedback.offsetWidth;
    elements.feedback.classList.add("is-visible");
    if (!isCorrect) elements.feedback.classList.add("is-wrong");
    elements.fbIcon.textContent = isCorrect ? "✓" : "✕";
    elements.fbVerdict.textContent = buildVerdict(round, selection, isCorrect, timedOut);
    elements.fbPoints.textContent = pointsEarned > 0 ? `+${pointsEarned}` : "sin puntos";
    renderChecks(round.checks);
    elements.fbNote.textContent = round.note;
  }

  function answerRound(selection, timedOut) {
    if (state.answerLocked) return;
    const round = ROUNDS[state.roundIndex];
    state.answerLocked = true;
    cancelAnimationFrame(state.timerFrame);
    disableAnswerControls();

    const isCorrect = round.type === "sino"
      ? selection !== null && selection === round.belongs
      : selection !== null && selection === round.correctName;
    const remaining = getRemainingSeconds();
    const pointsEarned = isCorrect ? BASE_POINTS + Math.round((remaining / ROUND_TIME) * MAX_BONUS) : 0;
    if (isCorrect) {
      state.correct += 1;
      state.score += pointsEarned;
      sounds.correct();
    } else {
      sounds.wrong();
    }
    updateScore();
    revealPointClasses(round, selection);
    showFeedback(round, selection, isCorrect, pointsEarned, timedOut);

    const wait = isCorrect ? 2100 : 3000;
    state.nextRoundTimer = window.setTimeout(() => {
      elements.feedback.hidden = true;
      elements.feedback.classList.remove("is-visible", "is-wrong");
      if (state.roundIndex < ROUNDS.length - 1) {
        state.roundIndex += 1;
        renderRound();
      } else {
        finishGame();
      }
    }, wait);
  }

  function finishGame() {
    window.clearTimeout(state.nextRoundTimer);
    cancelAnimationFrame(state.timerFrame);
    elements.feedback.hidden = true;
    const elapsed = performance.now() - state.gameStartedAt;
    const accuracy = Math.round((state.correct / ROUNDS.length) * 100);
    const starCount = state.correct >= 6 ? 3 : state.correct >= 5 ? 2 : state.correct >= 4 ? 1 : 0;
    elements.stars.replaceChildren();
    for (let i = 0; i < 3; i += 1) {
      const star = document.createElement("span");
      star.textContent = "★";
      if (i >= starCount) star.className = "star-muted";
      elements.stars.appendChild(star);
    }
    elements.stars.setAttribute("aria-label", `${starCount} de 3 estrellas`);
    setText(elements.resultsTitle, accuracy === 100 ? "¡Aterrizaje perfecto!" : accuracy >= 66 ? "¡Buen trabajo, piloto!" : "¡Misión completada!");
    setText(elements.resultScore, state.score);
    setText(elements.resultAccuracy, `${accuracy}%`);
    setText(elements.resultTime, formatTime(elapsed));
    showScreen("screen-results");
    sounds.finish();
  }

  function startGame() {
    window.clearTimeout(state.nextRoundTimer);
    state.roundIndex = 0;
    state.score = 0;
    state.correct = 0;
    state.gameStartedAt = performance.now();
    updateScore();
    ensureAudio();
    showScreen("screen-game");
    renderRound();
  }

  function toggleSound() {
    state.soundOn = !state.soundOn;
    if (state.soundOn) ensureAudio();
    updateSoundControls();
  }

  elements.play.addEventListener("click", () => {
    sounds.tap();
    startGame();
  });
  elements.again.addEventListener("click", () => {
    sounds.tap();
    startGame();
  });
  elements.mute.addEventListener("click", toggleSound);
  elements.coverMute.addEventListener("click", toggleSound);

  updateSoundControls();
  updateScore();
})();
