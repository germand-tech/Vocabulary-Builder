// URL oficial de tu base de datos JSON en GitHub Pages
const GITHUB_JSON_URL = "https://germand-tech.github.io/Vocabulary-Builder/vocabulary.json";

// Cargar librerías necesarias dinámicamente si no están presentes
function loadExternalScripts() {
  if (typeof QRCode === 'undefined') {
    const scriptQR = document.createElement('script');
    scriptQR.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    document.head.appendChild(scriptQR);
  }
  if (typeof html2canvas === 'undefined') {
    const scriptCanvas = document.createElement('script');
    scriptCanvas.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    document.head.appendChild(scriptCanvas);
  }
}
loadExternalScripts();

// 1. Detectar Level y Unit desde la URL de Moodle
function getLevelAndUnitFromURL() {
  const currentURL = window.location.href;
  
  const match = currentURL.match(/Level%20(\d+)%20Unit%20(\d+)/i) || 
                currentURL.match(/Level\s*(\d+)\s*Unit\s*(\d+)/i);

  if (match) {
    return { level: match[1], unit: match[2], key: `${match[1]}-${match[2]}` };
  }
  
  console.warn("No se detectó Level/Unit en la URL. Usando 1-1 por defecto.");
  return { level: "1", unit: "1", key: "1-1" };
}

let fullVocabulary = [];
let currentVocab = [];
let currentMode = 'flashcards';
let currentCardIdx = 0;
let targetInfo = { level: "1", unit: "1" };

// 2. Inyectar la interfaz HTML completa en el shell
function injectHTMLStructure() {
  const root = document.getElementById('app-root');
  if (!root) return;

  root.innerHTML = `
    <canvas id="confettiCanvas"></canvas>

    <header>
      <h1>Vocabulary Builder</h1>
      <p>Interactive Online Learning Platform</p>
      <div class="header-level-badge">📌 Loading...</div>
    </header>

    <div class="control-bar">
      <div class="control-group">
        <label for="categorySelect">📁 Category:</label>
        <select id="categorySelect" onchange="changeCategory()"></select>
      </div>

      <div class="control-group">
        <label for="voiceSelect">🗣️ Voice Engine:</label>
        <select id="voiceSelect" onchange="changeVoice()"></select>
      </div>

      <div class="control-group">
        <label>🔤 Text Size:</label>
        <button class="btn btn-outline" style="padding: 0.25rem 0.6rem; font-weight: bold;" onclick="changeFontSize(-1)">A-</button>
        <button class="btn btn-outline" style="padding: 0.25rem 0.6rem; font-weight: bold;" onclick="changeFontSize(1)">A+</button>
      </div>

      <div class="control-group">
        <button class="btn btn-outline" id="themeToggleBtn" onclick="toggleDarkMode()">🌙 Dark Mode</button>
      </div>
    </div>

    <nav>
      <button class="nav-btn active" onclick="switchMode('flashcards')">🎴 Flashcards</button>
      <button class="nav-btn" onclick="switchMode('learn')">🧠 Learn</button>
      <button class="nav-btn" onclick="switchMode('spelling')">✍️ Spelling</button>
      <button class="nav-btn" onclick="switchMode('match')">🧩 Match</button>
      <button class="nav-btn" onclick="switchMode('test')">📝 Practice Tests</button>
    </nav>

    <main>
      <section id="flashcards" class="mode-container active">
        <div class="stat-bar">
          <span id="cardCounter">Card 1 of 10</span>
          <span id="speechStatus">🎙️ Click the microphone button to practice speaking</span>
        </div>
        <div class="flashcard-wrapper">
          <div class="card-3d" id="mainCard" onclick="flipCard()">
            <div class="card-inner">
              <div class="card-front">
                <div class="card-tag" id="cardCategory">Category</div>
                <div class="card-word" id="cardEnglish">English</div>
                <div class="card-hint">Click to flip card</div>
              </div>
              <div class="card-back">
                <div class="card-tag">Spanish Meaning</div>
                <div class="card-word" id="cardSpanish">Español</div>
              </div>
            </div>
          </div>

          <div class="card-controls">
            <button class="btn btn-outline" onclick="prevCard()">◀ Previous</button>
            <button class="btn btn-outline btn-icon" onclick="event.stopPropagation(); speakCurrentCard()" title="Listen (Audio)">🔊</button>
            <button class="btn btn-outline btn-icon" id="flashcardMicBtn" onclick="event.stopPropagation(); startSpeechRecognition()" title="Speak (Pronunciation)">🎙️</button>
            <button class="btn btn-primary" onclick="nextCard()">Next ▶</button>
          </div>
        </div>
      </section>

      <section id="learn" class="mode-container">
        <div class="quiz-card" id="learnBox">
          <div class="stat-bar">
            <span>Overall Mastery: <span id="learnMasteryText">0%</span></span>
            <span>Goal: 3 correct hits per word</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-fill" id="learnProgressBar"></div>
          </div>
          <p class="card-hint" style="margin-top: 1rem;">Listen carefully to the audio and select the matching Spanish translation.</p>
          <button class="btn btn-primary btn-audio-lg" onclick="speakLearnQuestion()">🔊</button>
          <div class="quiz-options" id="learnOptions"></div>
        </div>
      </section>

      <section id="spelling" class="mode-container">
        <div class="spelling-box">
          <h3>Dictation & Spelling Practice</h3>
          <p class="card-hint" style="margin-bottom: 1.5rem;">Listen to the English word and type it correctly below.</p>
          <button class="btn btn-primary btn-icon" style="width: 70px; height: 70px; font-size: 1.8rem;" onclick="speakSpellingWord()">🔊</button>
          <br>
          <input type="text" id="spellingInput" class="spelling-input" placeholder="Type in English..." autocomplete="off">
          <div id="spellingBigDisplay" class="spelling-big-display" style="display: none;"></div>
          <br>
          <button id="spellingCheckBtn" class="btn btn-primary" onclick="checkSpelling()">Check Answer</button>
          <p id="spellingFeedback" style="margin-top: 1rem; font-weight: 600;"></p>
        </div>
      </section>

      <section id="match" class="mode-container">
        <div class="stat-bar">
          <span>Attempts: <span id="matchMoves">0</span></span>
          <span>Matched: <span id="matchScore">0</span> / <span id="matchTotal">6</span></span>
          <button class="btn btn-outline" onclick="initMatchGame()">Reset Game 🔄</button>
        </div>
        <div class="match-grid" id="matchGrid"></div>
      </section>

      <section id="test" class="mode-container">
        <div class="test-nav" id="testNav"></div>
        <div class="quiz-card" id="testBox"></div>
      </section>
    </main>
  `;
}

// 3. Inicialización
async function initApp() {
  injectHTMLStructure();
  targetInfo = getLevelAndUnitFromURL();
  
  const badge = document.querySelector('.header-level-badge');
  if (badge) badge.innerText = `📌 Level ${targetInfo.level} — Unit ${targetInfo.unit}`;

  try {
    const response = await fetch(GITHUB_JSON_URL);
    const data = await response.json();
    
    if (data[targetInfo.key]) {
      fullVocabulary = data[targetInfo.key];
      currentVocab = [...fullVocabulary];
      populateCategories();
      renderFlashcard();
    } else {
      alert(`⚠️ No vocabulary found for Level ${targetInfo.level} Unit ${targetInfo.unit} in vocabulary.json.`);
    }
  } catch (error) {
    console.error("Error loading vocabulary:", error);
  }
}

function normalizeText(text) {
  if (!text) return "";
  let str = text.toLowerCase().trim();
  const replacements = {
    "0": "zero", "oh": "zero", "1": "one", "won": "one", "2": "two", "to": "two", "too": "two",
    "3": "three", "tree": "three", "4": "four", "for": "four", "fore": "four", "5": "five",
    "6": "six", "sixx": "six", "sex": "six", "7": "seven", "8": "eight", "ate": "eight",
    "9": "nine", "10": "ten", "ok": "okay", "im": "i am", "i'm": "i am", "mister": "mr",
    "missus": "mrs", "goodbye": "bye", "good-bye": "bye", "bye-bye": "bye", "u": "you",
    "r": "are", "mornin": "morning"
  };
  str = str.replace(/[^a-z0-9\s]/g, ' ');
  let words = str.split(/\s+/).filter(Boolean).map(w => replacements[w] || w);
  return words.join(' ');
}

function getSimilarity(s1, s2) {
  const str1 = normalizeText(s1);
  const str2 = normalizeText(s2);
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0;
  const track = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  for (let i = 0; i <= str1.length; i++) track[0][i] = i;
  for (let j = 0; j <= str2.length; j++) track[j][0] = j;
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(track[j][i - 1] + 1, track[j - 1][i] + 1, track[j - 1][i - 1] + indicator);
    }
  }
  return 1 - (track[str2.length][str1.length] / Math.max(str1.length, str2.length));
}

function isSpeechMatch(spoken, target) {
  const sNorm = normalizeText(spoken);
  const tNorm = normalizeText(target);
  if (!sNorm || !tNorm) return false;
  if (sNorm === tNorm) return true;
  if (getSimilarity(sNorm, tNorm) >= 0.82) return true;
  const sWords = sNorm.split(' ').filter(Boolean);
  const tWords = tNorm.split(' ').filter(Boolean);
  if (Math.abs(sWords.length - tWords.length) > 1) return false;
  let matchedPositionCount = 0;
  for (let i = 0; i < tWords.length; i++) {
    const tw = tWords[i];
    const sw = sWords[i];
    if (sw && (sw === tw || getSimilarity(sw, tw) >= 0.82)) matchedPositionCount++;
  }
  return (matchedPositionCount / tWords.length) >= 0.8;
}

let activeSpeechInstance = null;
function stopActiveRecognition() {
  if (activeSpeechInstance) {
    try {
      activeSpeechInstance.onresult = null;
      activeSpeechInstance.onerror = null;
      activeSpeechInstance.onend = null;
      activeSpeechInstance.abort();
    } catch(e) {}
    activeSpeechInstance = null;
  }
}

let availableVoices = [];
let selectedVoice = null;

function populateVoices() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  availableVoices = voices.filter(v => v.lang.includes('en-US') || v.lang.includes('en_US') || v.lang.startsWith('en'));
  const select = document.getElementById('voiceSelect');
  if (!select) return;
  select.innerHTML = '';
  if (availableVoices.length === 0) availableVoices = voices;
  availableVoices.forEach((voice, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = `${voice.name} (${voice.lang})`;
    if ((voice.name.includes('Natural') || voice.name.includes('Google') || voice.name.includes('Samantha') || voice.name.includes('US')) && !selectedVoice) {
      opt.selected = true;
      selectedVoice = voice;
    }
    select.appendChild(opt);
  });
  if (!selectedVoice && availableVoices.length > 0) selectedVoice = availableVoices[0];
}

function changeVoice() {
  const idx = document.getElementById('voiceSelect').value;
  selectedVoice = availableVoices[idx];
}

if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = populateVoices;
  populateVoices();
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const cleanText = text.replace(/\(.*\)/g, '').replace(/[^a-zA-Z0-9\s'?.-]/g, '').trim();
  const utterance = new SpeechSynthesisUtterance(cleanText);
  if (selectedVoice) utterance.voice = selectedVoice;
  utterance.lang = 'en-US';
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if (type === 'correct') {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.start(); osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'wrong') {
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(180, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.start(); osc.stop(ctx.currentTime + 0.25);
    }
  } catch(e) {}
}

function triggerConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const pieces = [];
  const colors = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
  for (let i = 0; i < 150; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      size: Math.random() * 10 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      speed: Math.random() * 5 + 2,
      angle: Math.random() * 360
    });
  }
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.y += p.speed;
      p.angle += 2;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.angle * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });
    if (pieces.some(p => p.y < canvas.height)) requestAnimationFrame(render);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  render();
}

function populateCategories() {
  const select = document.getElementById('categorySelect');
  if (!select) return;
  const categories = ["ALL", ...new Set(fullVocabulary.map(item => item.category))];
  select.innerHTML = '';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat === 'ALL' ? 'All Categories' : cat;
    select.appendChild(opt);
  });
}

function changeCategory() {
  const cat = document.getElementById('categorySelect').value;
  currentVocab = cat === 'ALL' ? [...fullVocabulary] : fullVocabulary.filter(item => item.category === cat);
  currentCardIdx = 0;
  refreshCurrentMode();
}

function switchMode(mode) {
  stopActiveRecognition();
  currentMode = mode;
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.mode-container').forEach(sec => sec.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
  const sec = document.getElementById(mode);
  if (sec) sec.classList.add('active');
  refreshCurrentMode();
}

function refreshCurrentMode() {
  if (currentMode === 'flashcards') renderFlashcard();
  else if (currentMode === 'learn') initLearnMode();
  else if (currentMode === 'spelling') initSpellingMode();
  else if (currentMode === 'match') initMatchGame();
  else if (currentMode === 'test') initTestMode();
}

function renderFlashcard() {
  if (currentVocab.length === 0) return;
  const card = currentVocab[currentCardIdx];
  document.getElementById('mainCard')?.classList.remove('flipped');
  document.getElementById('cardCategory').innerText = card.category;
  document.getElementById('cardEnglish').innerText = card.en;
  document.getElementById('cardSpanish').innerText = card.es;
  document.getElementById('cardCounter').innerText = `Card ${currentCardIdx + 1} of ${currentVocab.length}`;
}

function flipCard() {
  document.getElementById('mainCard')?.classList.toggle('flipped');
}

function prevCard() {
  stopActiveRecognition();
  currentCardIdx = (currentCardIdx - 1 + currentVocab.length) % currentVocab.length;
  renderFlashcard();
}

function nextCard() {
  stopActiveRecognition();
  currentCardIdx = (currentCardIdx + 1) % currentVocab.length;
  renderFlashcard();
}

function speakCurrentCard() {
  speak(currentVocab[currentCardIdx].audio || currentVocab[currentCardIdx].en);
}

async function startSpeechRecognition() {
  stopActiveRecognition();
  const status = document.getElementById('speechStatus');
  const micBtn = document.getElementById('flashcardMicBtn');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    status.innerText = "❌ Speech Recognition not supported in this browser.";
    return;
  }

  const recognition = new SpeechRecognition();
  activeSpeechInstance = recognition;
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = false;

  micBtn.classList.add('mic-recording-pulse');
  status.innerText = "🎙️ Listening...";

  try { recognition.start(); } catch(e) {
    micBtn.classList.remove('mic-recording-pulse');
    return;
  }

  recognition.onresult = (e) => {
    micBtn.classList.remove('mic-recording-pulse');
    const rawSpoken = e.results[0][0].transcript;
    const targetWord = currentVocab[currentCardIdx].en;
    if (isSpeechMatch(rawSpoken, targetWord)) {
      status.innerText = `✅ Recognized: "${rawSpoken}"`;
      playSound('correct');
    } else {
      status.innerText = `⚠️ Heard: "${rawSpoken}". Target: "${targetWord}"`;
      playSound('wrong');
    }
  };

  recognition.onerror = () => micBtn.classList.remove('mic-recording-pulse');
  recognition.onend = () => {
    micBtn.classList.remove('mic-recording-pulse');
    activeSpeechInstance = null;
  };
}

let learnMastery = {};
let currentLearnTarget = null;

function initLearnMode() {
  learnMastery = {};
  currentVocab.forEach(item => { learnMastery[item.en] = 0; });
  renderLearnQuestion();
}

function renderLearnQuestion() {
  const totalRequired = currentVocab.length * 3;
  let totalCurrent = 0;
  const unmastered = [];

  currentVocab.forEach(item => {
    const score = learnMastery[item.en] || 0;
    totalCurrent += Math.min(score, 3);
    if (score < 3) unmastered.push(item);
  });

  const percentage = Math.round((totalCurrent / totalRequired) * 100);
  document.getElementById('learnMasteryText').innerText = `${percentage}%`;
  document.getElementById('learnProgressBar').style.width = `${percentage}%`;

  if (unmastered.length === 0) {
    triggerConfetti();
    document.getElementById('learnBox').innerHTML = `
      <div style="padding: 2rem;">
        <h2>🎉 Mastery Complete! 🎉</h2>
        <button class="btn btn-primary" onclick="initLearnMode()">Restart Learning 🔄</button>
      </div>
    `;
    return;
  }

  currentLearnTarget = unmastered[Math.floor(Math.random() * unmastered.length)];

  const options = [currentLearnTarget.es];
  while (options.length < 4 && options.length < currentVocab.length) {
    const rand = currentVocab[Math.floor(Math.random() * currentVocab.length)].es;
    if (!options.includes(rand)) options.push(rand);
  }
  options.sort(() => 0.5 - Math.random());

  const container = document.getElementById('learnOptions');
  container.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerText = opt;
    btn.onclick = () => checkLearnAnswer(btn, opt === currentLearnTarget.es);
    container.appendChild(btn);
  });

  speakLearnQuestion();
}

function speakLearnQuestion() {
  if (currentLearnTarget) speak(currentLearnTarget.audio || currentLearnTarget.en);
}

function checkLearnAnswer(btn, isCorrect) {
  const container = document.getElementById('learnOptions');
  Array.from(container.children).forEach(b => b.onclick = null);

  if (isCorrect) {
    btn.classList.add('correct');
    playSound('correct');
    learnMastery[currentLearnTarget.en] = (learnMastery[currentLearnTarget.en] || 0) + 1;
  } else {
    btn.classList.add('wrong');
    playSound('wrong');
    learnMastery[currentLearnTarget.en] = Math.max(0, (learnMastery[currentLearnTarget.en] || 0) - 1);
  }

  setTimeout(() => { renderLearnQuestion(); }, 1200);
}

let spellingWord = null;

function initSpellingMode() {
  spellingWord = currentVocab[Math.floor(Math.random() * currentVocab.length)];
  const input = document.getElementById('spellingInput');
  const display = document.getElementById('spellingBigDisplay');
  const btn = document.getElementById('spellingCheckBtn');

  if (input) {
    input.value = '';
    input.style.display = 'inline-block';
    input.disabled = false;
    input.focus();
    input.onkeydown = function(e) {
      if (e.key === 'Enter') { e.preventDefault(); checkSpelling(); }
    };
  }
  if (display) { display.style.display = 'none'; display.innerHTML = ''; }
  if (btn) btn.disabled = false;

  document.getElementById('spellingFeedback').innerText = '';
  speakSpellingWord();
}

function speakSpellingWord() {
  if (spellingWord) speak(spellingWord.audio || spellingWord.en);
}

function checkSpelling() {
  const inputEl = document.getElementById('spellingInput');
  const displayEl = document.getElementById('spellingBigDisplay');
  const btnEl = document.getElementById('spellingCheckBtn');
  const fb = document.getElementById('spellingFeedback');

  const userRaw = inputEl.value.trim();
  if (!userRaw) return;

  const targetWord = spellingWord.en;
  const userNorm = normalizeText(userRaw);
  const targetNorm = normalizeText(targetWord);

  inputEl.style.display = 'none';
  displayEl.style.display = 'flex';
  btnEl.disabled = true;

  if (userNorm === targetNorm) {
    displayEl.innerHTML = `<span class="char-box correct-char">${targetWord}</span>`;
    fb.style.color = 'var(--success)';
    fb.innerText = `✅ Correct! (${targetWord})`;
    playSound('correct');
    setTimeout(initSpellingMode, 1800);
    return;
  }

  playSound('wrong');
  fb.style.color = 'var(--danger)';
  fb.innerText = `❌ Incorrect. Correcting spelling...`;

  displayEl.innerHTML = '';
  const maxLength = Math.max(userRaw.length, targetWord.length);

  for (let i = 0; i < maxLength; i++) {
    const userChar = userRaw[i] || '';
    const targetChar = targetWord[i] || '';
    const span = document.createElement('span');
    span.className = 'char-box';

    if (userChar.toLowerCase() === targetChar.toLowerCase() && userChar !== '') {
      span.classList.add('correct-char');
      span.innerText = userChar;
    } else {
      span.classList.add('wrong-char');
      span.innerText = userChar || '_';
      setTimeout(() => { span.innerText = targetChar; }, 750);
    }
    displayEl.appendChild(span);
  }

  setTimeout(() => { initSpellingMode(); }, 4200);
}

let matchSelected = [];
let matchMoves = 0;
let matchScore = 0;
let matchPairsCount = 6;

function initMatchGame() {
  const grid = document.getElementById('matchGrid');
  grid.innerHTML = '';
  matchMoves = 0; matchScore = 0; matchSelected = [];
  document.getElementById('matchMoves').innerText = 0;

  const shuffled = [...currentVocab].sort(() => 0.5 - Math.random()).slice(0, Math.min(6, currentVocab.length));
  matchPairsCount = shuffled.length;
  document.getElementById('matchTotal').innerText = matchPairsCount;
  document.getElementById('matchScore').innerText = 0;

  let cards = [];
  shuffled.forEach((item, index) => {
    cards.push({ id: index, text: item.en, type: 'en' });
    cards.push({ id: index, text: item.es, type: 'es' });
  });

  cards.sort(() => 0.5 - Math.random());

  cards.forEach((c) => {
    const cardElem = document.createElement('div');
    cardElem.className = 'match-card';
    cardElem.innerText = c.text;
    cardElem.dataset.id = c.id;
    cardElem.onclick = () => selectMatchCard(cardElem);
    grid.appendChild(cardElem);
  });
}

function selectMatchCard(elem) {
  if (elem.classList.contains('matched') || matchSelected.includes(elem)) return;
  elem.classList.add('selected');
  matchSelected.push(elem);

  if (matchSelected.length === 2) {
    matchMoves++;
    document.getElementById('matchMoves').innerText = matchMoves;
    const [c1, c2] = matchSelected;
    if (c1.dataset.id === c2.dataset.id) {
      c1.classList.add('matched');
      c2.classList.add('matched');
      matchScore++;
      document.getElementById('matchScore').innerText = matchScore;
      playSound('correct');
      if (matchScore === matchPairsCount) triggerConfetti();
    } else {
      playSound('wrong');
      setTimeout(() => {
        c1.classList.remove('selected');
        c2.classList.remove('selected');
      }, 800);
    }
    matchSelected = [];
  }
}

let studentInfo = null;
let testsData = {
  1: { type: 'oral', title: 'Oral Practice Test 1', unlocked: true, completed: false, attempts: 0, manualPasses: 0, score: 0, wrongAnswers: [] },
  2: { type: 'oral', title: 'Oral Practice Test 2', unlocked: false, completed: false, attempts: 0, manualPasses: 0, score: 0, wrongAnswers: [] },
  3: { type: 'oral', title: 'Oral Practice Test 3', unlocked: false, completed: false, attempts: 0, manualPasses: 0, score: 0, wrongAnswers: [] },
  4: { type: 'spelling', title: 'Listening/Spelling Test 1', unlocked: false, completed: false, attempts: 0, manualPasses: 0, score: 0, wrongAnswers: [] },
  5: { type: 'spelling', title: 'Listening/Spelling Test 2', unlocked: false, completed: false, attempts: 0, manualPasses: 0, score: 0, wrongAnswers: [] },
  6: { type: 'spelling', title: 'Listening/Spelling Test 3', unlocked: false, completed: false, attempts: 0, manualPasses: 0, score: 0, wrongAnswers: [] }
};

let activeTestId = 1;
let currentTestCards = [];
let currentTestItemIdx = 0;
let currentTestScore = 0;

function initTestMode() {
  if (!studentInfo) {
    document.getElementById('testNav').innerHTML = '';
    renderStudentRegistrationForm();
  } else {
    renderTestNav();
    loadTest(activeTestId);
  }
}

function renderStudentRegistrationForm() {
  const box = document.getElementById('testBox');
  box.innerHTML = `
    <div style="padding: 1.5rem; text-align: center;">
      <h2 style="color: var(--primary); margin-bottom: 0.2rem;">📋 Student Registration</h2>
      <p style="font-weight:600; color:var(--secondary); font-size:0.9rem; margin-bottom: 1rem;">Level ${targetInfo.level} — Unit ${targetInfo.unit} Evaluation</p>
      <p style="margin-bottom: 1.5rem; color: var(--text-muted); font-size:0.95rem;">
        Please fill in your details before taking the practice tests.
      </p>
      <div style="max-width: 400px; margin: 0 auto;">
        <div class="form-group-row">
          <label class="form-label-custom">Full Student Name:</label>
          <input type="text" id="regStudentName" class="form-input-custom" placeholder="e.g. Maria Perez">
        </div>
        <div class="form-group-row">
          <label class="form-label-custom">ID Number / Passport / Student Code:</label>
          <input type="text" id="regStudentId" class="form-input-custom" placeholder="e.g. V-12345678">
        </div>
        <button class="btn btn-primary" style="width:100%; justify-content:center; margin-top:0.5rem;" onclick="saveStudentAndStartTest()">Start Evaluation ▶</button>
      </div>
    </div>
  `;
}

function saveStudentAndStartTest() {
  const nameInput = document.getElementById('regStudentName').value.trim();
  const idInput = document.getElementById('regStudentId').value.trim();
  if (!nameInput || !idInput) { alert("⚠️ Please enter your details."); return; }

  studentInfo = {
    name: nameInput,
    id: idInput,
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    level: `Level ${targetInfo.level} — Unit ${targetInfo.unit}`
  };
  initTestMode();
}

function renderTestNav() {
  const nav = document.getElementById('testNav');
  nav.innerHTML = '';
  for (let id = 1; id <= 6; id++) {
    const t = testsData[id];
    const btn = document.createElement('button');
    let statusIcon = t.completed ? '✅' : (t.unlocked ? '📝' : '🔒');
    btn.className = `test-tab-btn ${id === activeTestId ? 'active' : ''} ${!t.unlocked ? 'locked' : ''}`;
    btn.innerHTML = `${statusIcon} Test ${id} (${t.type === 'oral' ? 'Oral' : 'Spelling'})`;
    btn.onclick = () => {
      if (t.unlocked) { activeTestId = id; renderTestNav(); loadTest(id); }
      else { alert('🔒 Complete the previous test first.'); }
    };
    nav.appendChild(btn);
  }
}

function loadTest(testId) {
  stopActiveRecognition();
  testsData[testId].attempts++;
  testsData[testId].manualPasses = 0;
  testsData[testId].wrongAnswers = [];
  currentTestItemIdx = 0;
  currentTestScore = 0;
  currentTestCards = [...fullVocabulary].sort(() => 0.5 - Math.random()).slice(0, 10);
  renderTestQuestion();
}

let currentFontScale = 1.0;
function changeFontSize(delta) {
  currentFontScale = Math.max(0.8, Math.min(1.5, currentFontScale + (delta * 0.1)));
  document.body.style.zoom = currentFontScale;
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) themeBtn.innerText = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
}

function renderTestQuestion() {
  const box = document.getElementById('testBox');
  const test = testsData[activeTestId];
  const item = currentTestCards[currentTestItemIdx];

  if (currentTestItemIdx >= currentTestCards.length) { finishTest(); return; }

  let contentHTML = `
    <div class="stat-bar">
      <span>${test.title} (Attempt #${test.attempts})</span>
      <span>Question ${currentTestItemIdx + 1} of ${currentTestCards.length} — Score: ${currentTestScore} pts</span>
    </div>
  `;

  if (test.type === 'oral') {
    contentHTML += `
      <h3 style="font-size: 1.2rem; margin: 1rem 0;">Read in Spanish and pronounce in English:</h3>
      <p style="font-size: 2rem; font-weight: 700; color: var(--primary); margin-bottom: 1.5rem;">"${item.es}"</p>
      <button id="oralTestMicBtn" class="btn btn-primary btn-icon" style="width: 75px; height: 75px; font-size: 2.2rem; margin: 0 auto;" onclick="testRecordOral('${item.en.replace(/'/g, "\\'")}')">🎙️</button>
      <div id="testOralStatus" style="margin-top: 1.2rem; font-weight: 600; color: var(--text-muted); min-height: 48px;">
        Click microphone to record your voice.
      </div>
      <div style="margin-top: 1.5rem; border-top: 1px dashed #e2e8f0; padding-top: 1rem;">
        <button class="btn btn-outline" style="font-size: 0.85rem; padding: 0.4rem 0.8rem;" onclick="forceOralPass('${item.en.replace(/'/g, "\\'")}')">
          ⚠️ Manual Pass / Skip (0 pts)
        </button>
      </div>
    `;
  } else {
    contentHTML += `
      <h3 style="font-size: 1.2rem; margin: 1rem 0;">Listen to the English word and type it correctly:</h3>
      <button class="btn btn-primary btn-icon" style="width: 75px; height: 75px; font-size: 2.2rem;" onclick="speak('${item.audio || item.en}')">🔊</button>
      <br>
      <input type="text" id="testSpellingInput" class="spelling-input" placeholder="Type here in English..." autocomplete="off">
      <br>
      <button id="testSpellingSubmitBtn" class="btn btn-primary" onclick="testCheckSpelling('${item.en.replace(/'/g, "\\'")}')">Submit Answer</button>
      <div id="testSpellingFeedback" style="margin-top: 1.2rem; font-weight: 600; min-height: 48px; font-size: 1rem;"></div>
    `;
  }

  box.innerHTML = contentHTML;

  if (test.type === 'spelling') {
    setTimeout(() => speak(item.audio || item.en), 300);
    document.getElementById('testSpellingInput')?.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') testCheckSpelling(item.en);
    });
  }
}

async function testRecordOral(targetEnglish) {
  stopActiveRecognition();
  const status = document.getElementById('testOralStatus');
  const micBtn = document.getElementById('oralTestMicBtn');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const item = currentTestCards[currentTestItemIdx];

  if (!SpeechRecognition) { status.innerHTML = "❌ Browser not supported."; return; }

  const recognition = new SpeechRecognition();
  activeSpeechInstance = recognition;
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = false;

  micBtn.classList.add('mic-recording-pulse');
  status.innerText = "🎙️ Listening...";

  try { recognition.start(); } catch(e) {
    micBtn.classList.remove('mic-recording-pulse');
    return;
  }

  recognition.onresult = (e) => {
    micBtn.classList.remove('mic-recording-pulse');
    const rawSpoken = e.results[0][0].transcript;
    if (isSpeechMatch(rawSpoken, targetEnglish)) {
      status.style.color = "var(--success)";
      status.innerText = `✅ Recognized: "${rawSpoken}" (+10 pts)`;
      playSound('correct');
      currentTestScore += 10;
      setTimeout(() => { currentTestItemIdx++; renderTestQuestion(); }, 1200);
    } else {
      status.style.color = "var(--danger)";
      status.innerText = `❌ Heard: "${rawSpoken}". Expected: "${targetEnglish}"`;
      playSound('wrong');

      testsData[activeTestId].wrongAnswers.push({
        question: item.es,
        expected: targetEnglish,
        userVal: rawSpoken || '(Inaudible)'
      });
    }
  };

  recognition.onerror = () => micBtn.classList.remove('mic-recording-pulse');
  recognition.onend = () => {
    micBtn.classList.remove('mic-recording-pulse');
    activeSpeechInstance = null;
  };
}

function forceOralPass(targetEnglish) {
  stopActiveRecognition();
  testsData[activeTestId].manualPasses++;
  const item = currentTestCards[currentTestItemIdx];
  
  testsData[activeTestId].wrongAnswers.push({
    question: item.es,
    expected: targetEnglish,
    userVal: '[Manual Override / Skipped]'
  });

  currentTestItemIdx++;
  renderTestQuestion();
}

function testCheckSpelling(targetEnglish) {
  const inputEl = document.getElementById('testSpellingInput');
  const feedbackEl = document.getElementById('testSpellingFeedback');
  if (!inputEl) return;

  const inputRaw = inputEl.value;
  const input = normalizeText(inputRaw);
  const target = normalizeText(targetEnglish);
  const item = currentTestCards[currentTestItemIdx];

  inputEl.disabled = true;

  if (input === target) {
    feedbackEl.style.color = "var(--success)";
    feedbackEl.innerText = `✅ Correct! (${targetEnglish})`;
    playSound('correct');
    currentTestScore += 10;
    setTimeout(() => { currentTestItemIdx++; renderTestQuestion(); }, 1000);
  } else {
    playSound('wrong');
    feedbackEl.style.color = "var(--danger)";
    feedbackEl.innerHTML = `❌ Incorrect! You wrote: "<b>${inputRaw.trim() || '(Empty)'}</b>" | Correct: "<b>${targetEnglish}</b>"`;

    testsData[activeTestId].wrongAnswers.push({
      question: item.audio || item.en,
      expected: targetEnglish,
      userVal: inputRaw.trim() || '(Empty)'
    });

    setTimeout(() => { currentTestItemIdx++; renderTestQuestion(); }, 2500);
  }
}

function finishTest() {
  stopActiveRecognition();
  const box = document.getElementById('testBox');
  const test = testsData[activeTestId];
  test.score = currentTestScore;
  test.completed = true;

  if (activeTestId < 6) testsData[activeTestId + 1].unlocked = true;
  renderTestNav();

  if (activeTestId === 6) {
    generateCertificate();
    return;
  }

  box.innerHTML = `
    <div style="padding: 2rem; text-align: center;">
      <h2>Test Completed: ${test.title}</h2>
      <p style="font-size: 3rem; font-weight: 700; color: ${currentTestScore >= 70 ? 'var(--success)' : 'var(--warning)'}; margin: 1rem 0;">${currentTestScore} / 100 pts</p>
      <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem;">
        <button class="btn btn-outline" onclick="loadTest(${activeTestId})">Retake Test 🔄</button>
        <button class="btn btn-primary" onclick="loadNextUnlockedTest()">Continue ▶</button>
      </div>
    </div>
  `;
}

function loadNextUnlockedTest() {
  if (activeTestId < 6) {
    activeTestId++;
    renderTestNav();
    loadTest(activeTestId);
  } else {
    generateCertificate();
  }
}

function generateCertificate() {
  let attemptsSummaryHTML = "";
  let totalManualPasses = 0;
  let totalPointsAccumulated = 0;
  let allWrongAnswers = [];

  for (let i = 1; i <= 6; i++) {
    const test = testsData[i];
    const att = test.attempts || 1;
    const man = test.manualPasses || 0;
    const score = test.score || 0;
    totalPointsAccumulated += score;
    totalManualPasses += man;
    const typeLabel = test.type === 'oral' ? 'Oral' : 'Spelling';
    
    const manBadgeHTML = man > 0 ? ` <span style="color:var(--warning); font-size:0.85rem; font-weight:600;">(⚠️ ${man} manual pass/skipped)</span>` : '';

    attemptsSummaryHTML += `<li>Test ${i} (${typeLabel}): <b>${score}/100 pts</b> (${att} ${att === 1 ? 'attempt' : 'attempts'})${manBadgeHTML}</li>`;

    if (test.wrongAnswers && test.wrongAnswers.length > 0) {
      test.wrongAnswers.forEach(w => {
        allWrongAnswers.push({ testId: i, type: typeLabel, ...w });
      });
    }
  }

  const finalAverageGrade = Math.round(totalPointsAccumulated / 6);

  const methodText = totalManualPasses > 0 
    ? `Speech AI + Manual Pass (${totalManualPasses} items skipped)`
    : `100% Automated Speech AI & Spelling`;

  const methodHTML = totalManualPasses > 0 
    ? `<span style="color: var(--warning); font-weight:600;">Speech AI + Manual Pass (${totalManualPasses} item${totalManualPasses > 1 ? 's' : ''} skipped)</span>`
    : `<span style="color: var(--success); font-weight:600;">100% Automated Speech AI & Spelling</span>`;

  let incorrectSectionHTML = "";

  if (allWrongAnswers.length > 0) {
    let tableRowsHTML = "";
    allWrongAnswers.forEach((w) => {
      tableRowsHTML += `
        <tr>
          <td>Test ${w.testId} (${w.type})</td>
          <td><b>${w.question}</b></td>
          <td style="color: var(--danger); font-weight: 500;">${w.userVal}</td>
          <td style="color: var(--success); font-weight: 600;">${w.expected}</td>
        </tr>
      `;
    });

    incorrectSectionHTML = `
      <div class="incorrect-box">
        <h4>⚠️ Incorrect Answers & Manual Passes Logged (${allWrongAnswers.length}):</h4>
        <table class="incorrect-table">
          <thead>
            <tr>
              <th>Evaluation</th>
              <th>Prompt/Word</th>
              <th>Given Answer</th>
              <th>Correct Answer</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHTML}
          </tbody>
        </table>
      </div>
    `;
  } else {
    incorrectSectionHTML = `
      <div class="incorrect-box" style="background: #f0fdf4; border-color: #bbf7d0;">
        <h4 style="color: #166534;">🌟 Perfect Record: Zero incorrect answers registered in final runs!</h4>
      </div>
    `;
  }

  const box = document.getElementById('testBox');
  
  box.innerHTML = `
    <div class="cert-card" id="certCardElem">
      <h2>CERTIFICATE OF ACHIEVEMENT</h2>
      <div class="cert-subtitle">${studentInfo ? studentInfo.level : 'Level Practice'}</div>
      
      <div class="cert-info">
        <p><b>Course / Unit:</b> ${studentInfo ? studentInfo.level : 'Level Practice'}</p>
        <p><b>Student Name:</b> ${studentInfo ? studentInfo.name : 'Student'}</p>
        <p><b>Student ID Code:</b> ${studentInfo ? studentInfo.id : 'N/A'}</p>
        <p><b>Issue Date:</b> ${studentInfo ? studentInfo.date : new Date().toLocaleDateString()}</p>
        <p><b>Final Average Grade:</b> <span style="color: ${finalAverageGrade >= 70 ? 'var(--success)' : 'var(--warning)'}; font-weight:700;">${finalAverageGrade} / 100 pts</span></p>
        <p><b>Evaluation Method:</b> ${methodHTML}</p>
        <p><b>Evaluations Completed:</b> 6 Practice Tests (3 Oral, 3 Spelling)</p>
        <br>
        <p><b>Score & Attempt Breakdown per Evaluation:</b></p>
        <ul style="padding-left: 1.2rem; margin-top: 0.3rem;">
          ${attemptsSummaryHTML}
        </ul>
      </div>

      <div class="cert-qr" id="qrcodeContainer"></div>
      <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.8rem;">Scan this QR code to verify official certification details.</p>

      <div id="certActionBtns" style="margin-top: 1.8rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
        <button class="btn btn-primary" style="background: var(--success);" onclick="downloadCertificatePNG()">📥 Download Certificate (PNG)</button>
        <button class="btn btn-outline" onclick="window.print()">🖨️ Print / Save as PDF</button>
      </div>
    </div>

    <div class="screen-only-errors">
      ${incorrectSectionHTML}
    </div>
  `;

  const qrPayload = 
`CERTIFICATE OF ACHIEVEMENT
Student: ${studentInfo ? studentInfo.name : 'Student'}
ID Code: ${studentInfo ? studentInfo.id : 'N/A'}
Course: ${studentInfo ? studentInfo.level : 'Level Practice'}
Date: ${studentInfo ? studentInfo.date : new Date().toLocaleDateString()}
Grade: ${finalAverageGrade}/100 pts
Method: ${methodText}
Status: VERIFIED`;

  const qrContainer = document.getElementById("qrcodeContainer");
  qrContainer.innerHTML = "";

  let qrRendered = false;

  if (typeof QRCode !== "undefined") {
    try {
      new QRCode(qrContainer, {
        text: qrPayload,
        width: 180,
        height: 180,
        colorDark: "#3730a3",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
      qrRendered = true;
    } catch(e) {}
  }

  if (!qrRendered || qrContainer.children.length === 0) {
    qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrPayload)}" alt="Verification QR Code" style="width:180px; height:180px; border-radius:8px; border:2px solid #3730a3;" />`;
  }

  if (finalAverageGrade === 100 && totalManualPasses === 0) {
    triggerConfetti();
  }
}

function downloadCertificatePNG() {
  const certNode = document.getElementById('certCardElem');
  const actionBtns = document.getElementById('certActionBtns');
  if (actionBtns) actionBtns.style.display = 'none';

  if (typeof html2canvas !== "undefined") {
    html2canvas(certNode, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = `Certificate_${studentInfo ? studentInfo.name.replace(/\s+/g, '_') : 'Student'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      if (actionBtns) actionBtns.style.display = 'flex';
    }).catch(() => {
      if (actionBtns) actionBtns.style.display = 'flex';
      window.print();
    });
  } else {
    window.print();
  }
}

window.addEventListener('DOMContentLoaded', initApp);
