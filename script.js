(() => {
  const pet = document.getElementById('pet');
  const bubble = document.getElementById('bubble');
  const statusText = document.getElementById('status-text');
  const SVGNS = 'http://www.w3.org/2000/svg';
  let censorshipOn = false;
  try { censorshipOn = localStorage.getItem('p001_censorship') === '1'; } catch (e) {}
  const SAFE_FETISHES = {
    'Пояс верности': 'Верность', 'Оковы': 'Дисциплина', 'Унижение': 'Критика',
    'Футфетиш': 'Внимание', 'Боль': 'Стойкость', 'Лохматый': 'Лохматый', 'Туалетный': 'Чистота'
  };
  function displayFetish(value) { return censorshipOn ? SAFE_FETISHES[value] || 'Характер' : value; }
  function slaveDisplayName(number = slaveNo) { return `${censorshipOn ? 'Слуга' : 'Подопытный'} ${String(number).padStart(3, '0')}`; }
  function softenText(text) {
    if (!censorshipOn) return text;
    return String(text)
      .replace(/Подопытный/g, 'Слуга').replace(/подопытного/g, 'слугу').replace(/подопытному/g, 'слуге')
      .replace(/подопытным/g, 'слугой').replace(/подопытные/g, 'слуги').replace(/подопытный/g, 'слуга')
      .replace(/рабов/g, 'слуг').replace(/раба/g, 'слугу').replace(/рабу/g, 'слуге').replace(/рабом/g, 'слугой').replace(/Раб(?![а-яё])/g, 'Слуга').replace(/раб(?![а-яё])/g, 'слуга')
      .replace(/Потакание/g, 'Поощрение').replace(/потакание/g, 'поощрение').replace(/потаканием/g, 'поощрением')
      .replace(/Унизить/g, 'Поругать').replace(/унизить/g, 'поругать').replace(/Унижение/g, 'Критика').replace(/унижение/g, 'критика').replace(/унижения/g, 'критики').replace(/унижением/g, 'критикой')
      .replace(/порков/g, 'занятий').replace(/порки/g, 'занятия').replace(/порку/g, 'занятие').replace(/Порка/g, 'Дисциплина').replace(/порка/g, 'дисциплина')
      .replace(/Выпороть/g, 'Наказать').replace(/выпороть/g, 'наказать').replace(/Ударить/g, 'Влепить').replace(/ударить/g, 'влепить')
      .replace(/Госпожа/g, 'Наставница').replace(/Госпожи/g, 'Наставницы').replace(/Госпожу/g, 'Наставницу').replace(/госпожа/g, 'наставница')
      .replace(/Склонность/g, 'Характер').replace(/склонность/g, 'характер').replace(/склонностью/g, 'характером')
      .replace(/оковы/gi, 'ограничители').replace(/ошейник/gi, 'бейдж').replace(/кляп/gi, 'пауза')
      .replace(/фетиш/gi, 'характер').replace(/плеть/gi, 'инструмент').replace(/кнут/gi, 'инструмент');
  }
  function lines(name) {
    if (censorshipOn && SAFE_PHRASES[name]) return SAFE_PHRASES[name];
    return phrases[name];
  }

  /* ================= СОСТОЯНИЕ ================= */
  let slaveNo = 1;
  const FETISHES = ['Пояс верности', 'Оковы', 'Унижение', 'Футфетиш', 'Боль'];
  const SECRET_FETISHES = ['Лохматый', 'Туалетный'];
  let rareFetish = false;
  function rollFetish() {
    if (Math.random() < 0.01) { rareFetish = true; return SECRET_FETISHES[Math.floor(Math.random() * SECRET_FETISHES.length)]; }
    rareFetish = false;
    return FETISHES[Math.floor(Math.random() * FETISHES.length)];
  }
  let fetish = rollFetish();

  let state;
  state = freshState();
  function freshState() {
    return { hp: 100, food: 80, mood: 80, dignity: 80, fear: 0, obed: 50, need: 0, aggr: 0, coins: state ? state.coins : 0, gems: state ? state.gems : 0 };
  }
  let spiritBroken = false; // достоинство упало в 0 — премии к дани больше не будет

  /* ---------- выбор лица = стиль содержания ---------- */
  const FACE_FX = {
    calm:    { aggr: 0.85, mult: 0,    hp: 100, food: 80, desc: 'Спокойное: агрессия растёт на 15% медленнее.' },
    haggard: { aggr: 1.0,  mult: 0.15, hp: 65,  food: 65, desc: 'Измождённое: стартует слабым (HP 65), но дань +15%.' },
    bold:    { aggr: 1.15, mult: 0.1,  hp: 100, food: 80, desc: 'Дерзкое: дань +10%, но агрессия растёт на 15% быстрее.' }
  };
  function applyFaceStart() {
    const fx = FACE_FX[face];
    state.hp = fx.hp; state.food = fx.food;
  }

  let owned = {};
  let ownedOutfits = {};
  const PROFILE_CARDS = {
    plain: { name: 'базовая', price: 0, cur: 'coins' },
    slate: { name: 'серый графит', price: 100, cur: 'coins' },
    sand: { name: 'пыльный песок', price: 100, cur: 'coins' },
    moss: { name: 'старый мох', price: 100, cur: 'coins' },
    wine: { name: 'выцветшее вино', price: 100, cur: 'coins' },
    silver: { name: 'серебряный завиток', price: 50, cur: 'gems' }
  };
  let ownedProfileCards = { plain: true };
  let profileCard = 'plain';
  let displayName = 'Игрок';
  let nicknameChanges = 0;
  let equipped = { body: 'rags', head: null, feet: null, arms: null, pants: null }; // слоты совмещаются
  let beltLevel = 0;
  let beltWorn = 0; // какой купленный уровень пояса надет
  let beltBroken = false;
  let baseMult = 1.0;
  const petPos = document.getElementById('pet-pos');
  const GEM_GEAR = ['armor', 'mask', 'crochead', 'shark', 'goldarms', 'hearteyes']; // куплено за клятвы — навсегда
  let petOff = { x: 0, y: 0 };
  let restraints = { handcuffs: false, shackles: false }; // надето
  let restraintsOwned = { handcuffs: false, shackles: false };
  let comfort = 0; // суммарный уровень обстановки (сумма уровней позиций)
  let indulgeCdUntil = 0; // кулдаун потакания
  // интерьер: 7 позиций, у каждой ступени от убогой к роскошной (цена = переход на этот уровень)
  const SLOTS = {
    chair:  { label: 'Стул',   tiers: [ {n:'Сломанный табурет', p:0}, {n:'Табурет', p:15}, {n:'Стул со спинкой', p:45}, {n:'Кресло', p:110}, {n:'Трон', p:280} ] },
    bed:    { label: 'Ложе',   tiers: [ {n:'Дырявая лавочка', p:0}, {n:'Матрас', p:30}, {n:'Диван', p:130}, {n:'Альков', p:320} ] },
    floor:  { label: 'Пол',    tiers: [ {n:'Голая земля', p:0}, {n:'Доски', p:25}, {n:'Ковёр', p:90}, {n:'Мрамор', p:240} ] },
    walls:  { label: 'Стены',  tiers: [ {n:'Плесень и сырость', p:0}, {n:'Панели', p:50}, {n:'Бархат', p:170} ] },
    light:  { label: 'Свет',   tiers: [ {n:'Свеча', p:0}, {n:'Лампочка', p:35}, {n:'Торшер', p:110}, {n:'Люстра', p:300} ] },
    window: { label: 'Окно',   tiers: [ {n:'Решётка', p:0}, {n:'Шторы', p:70}, {n:'Витраж', p:220} ] },
    trophy: { label: 'Трофеи', tiers: [ {n:'Цепи на стене', p:0}, {n:'Кнут', p:60}, {n:'Полка трофеев', p:160} ] }
  };
  const MAX_COMFORT = Object.values(SLOTS).reduce((a, s) => a + s.tiers.length - 1, 0);

  /* ---------- расцветки мебели (как скины: 4 облика, за клятвы, навсегда) ---------- */
  const VARIANT_DEFS = {
    default: [
      { n: 'Заводской',     f: '' },
      { n: 'Белое золото',  f: 'saturate(0.4) brightness(1.5) sepia(0.3)' },
      { n: 'Лёд',           f: 'hue-rotate(150deg) saturate(1.3) brightness(1.12)' },
      { n: 'Гниль',         f: 'hue-rotate(80deg) saturate(0.7) brightness(0.85)' }
    ],
    light: [
      { n: 'Обычный',    f: '' },
      { n: 'Ангельский', f: 'hue-rotate(150deg) saturate(1.4) brightness(1.3)' },
      { n: 'Древесный',  f: 'hue-rotate(85deg) saturate(1.15) brightness(1.05)' },
      { n: 'Кровавый',   f: 'saturate(1.9) brightness(0.9)' }
    ]
  };
  function slotVariants(slot) { return VARIANT_DEFS[slot] || VARIANT_DEFS.default; }
  function variantCost(slot, lvl) { return lvl === SLOTS[slot].tiers.length - 1 ? 15 : 1; }
  let decorVar = {};      // 'slot:lvl' -> индекс применённой расцветки
  let decorVarOwned = {}; // 'slot:lvl:v' -> true; куплено за клятвы — не сгорает со смертью раба
  let room = { chair: 0, bed: 0, floor: 0, walls: 0, light: 0, window: 0, trophy: 0 };
  function calcComfort() { return Object.values(room).reduce((a, b) => a + b, 0); }
  function comfortMult() { return 1 + comfort * 0.04; }

  /* ---------- таблица модификаторов склонностей ---------- */
  // bonus/risk — текст для «Досье»; числовые эффекты применяются в обработчиках
  const FETISH_FX = {
    'Оковы': {
      bonus: 'Наручники и кандалы на нём: Достоинство растёт (+0.4/тик) — он в своей тарелке.',
      risk: 'Риск: Послушание тает (−0.3/тик) — расслабляется, может взбунтоваться.'
    },
    'Пояс верности': {
      bonus: 'Целый пояс послушания усиливает потакание: +50% к послушанию.',
      risk: 'Риск: поломка пояса взрывает Агрессию (+15 сверху).'
    },
    'Унижение': {
      bonus: '«Унизить» даёт двойной прирост ожидаемой дани.',
      risk: 'Риск: Агрессия от унижения растёт вдвое быстрее. Потакание его не радует: он ждёт слов, а не ласки — настроение не растёт. Ирония участи: раб со склонностью к унижению сам стал унижением.'
    },
    'Футфетиш': {
      bonus: '«Потакание» насыщает вдвое сильнее (нужда +50).',
      risk: 'Риск: без внимания Настроение падает вдвое быстрее.'
    },
    'Боль': {
      bonus: 'Порка приносит +50% монет и вдвое меньше Агрессии.',
      risk: 'Риск: тело хрупкое — весь урон по HP ×1.5.'
    },
    'Лохматый': {
      bonus: 'РЕДКИЙ. Бритва снимает вдвое больше: +40 достоинства за бритьё.',
      risk: 'Заросший навсегда: щетина не исчезает сама, только лезвие.'
    },
    'Туалетный': {
      bonus: 'РЕДКИЙ. Грязь — его стихия: при комфорте 0 настроение растёт (+0.25/тик).',
      risk: 'Роскошь давит: при комфорте 10+ настроение тает (−0.2/тик).'
    }
  };
  // чем «задеть» склонность для шанса клятвы
  function fetishMatched() {
    switch (fetish) {
      case 'Оковы': return restraints.handcuffs || restraints.shackles;
      case 'Пояс верности': return beltLevel > 0 && !beltBroken;
      case 'Унижение': return owned.gag;
      case 'Футфетиш': return equipped.feet === 'boots';
      case 'Боль': return owned['gear-whip'];
      case 'Лохматый': return razors > 0;
      case 'Туалетный': return comfort === 0;
      default: return false;
    }
  }
  let dossierUnlocked = false;
  let petClicks = 0;

  /* ---------- задание дня ---------- */
  const QUEST_POOL = [
    { id: 'whip20',   ev: 'whip',       target: 20,  text: 'Выпороть 20 раз' },
    { id: 'hit30',    ev: 'hit',        target: 30,  text: 'Ударить 30 раз' },
    { id: 'feed15',   ev: 'feed',       target: 15,  text: 'Покормить 15 раз' },
    { id: 'shame10',  ev: 'shame',      target: 10,  text: 'Унизить 10 раз' },
    { id: 'collar10', ev: 'collarTime', target: 600, text: 'Держать в ошейнике 10 минут' }
  ];
  function todayKey() { return new Date().toISOString().slice(0, 10); }
  function loadQuest() {
    try {
      const q = JSON.parse(localStorage.getItem('p001_quest') || 'null');
      if (q && q.date === todayKey() && QUEST_POOL.some(p => p.id === q.id)) return q;
    } catch (e) { /* приватный режим */ }
    let h = 0;
    for (const ch of todayKey()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return { date: todayKey(), id: QUEST_POOL[h % QUEST_POOL.length].id, progress: 0, done: false };
  }
  let quest = loadQuest();
  function saveQuest() { try { localStorage.setItem('p001_quest', JSON.stringify(quest)); } catch (e) {} }
  function questDef() { return QUEST_POOL.find(q => q.id === quest.id); }
  function questProgress(ev, n) {
    weeklyProgress(ev, n);
    mquestProgress(ev, n);
    if (quest.done || questDef().ev !== ev) return;
    quest.progress = Math.min(questDef().target, quest.progress + n);
    if (quest.progress >= questDef().target) {
      quest.done = true;
      state.gems += 10;
      sfx.gem();
      burst(['◆', '◆', '✚'], 6);
      say('Задание дня выполнено. +10 клятв.');
    }
    saveQuest();
  }
  /* ---------- задания недели ---------- */
  const WEEKLY_POOL = [
    { id: 'wsurvive', text: 'Подопытный должен прожить эту неделю. Умрёт — провал.', reward: 75, special: 'survive' },
    { id: 'wcoins',   text: 'Собрать 2500 монет дани за неделю', reward: 35, ev: 'earnCoins', target: 2500 },
    { id: 'wwhip',    text: 'Провести 60 порков за неделю', reward: 30, ev: 'whip', target: 60 },
    { id: 'wthrow',   text: 'Подбросить подопытного 25 раз', reward: 25, ev: 'throw', target: 25 },
    { id: 'wcomfort', text: 'Довести комфорт комнаты до 12', reward: 30, ev: 'comfort', target: 12 },
    { id: 'wshame',   text: 'Унизить 40 раз за неделю', reward: 40, ev: 'shame', target: 40 }
  ];
  function weekKey() { return String(Math.floor(Date.now() / 604800000)); }
  function loadWeekly() {
    try {
      const w = JSON.parse(localStorage.getItem('p001_weekly') || 'null');
      if (w && w.week === weekKey() && Array.isArray(w.quests) && w.quests.length) return w;
    } catch (e) { /* приватный режим */ }
    let h = 0;
    for (const ch of weekKey()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const pool = WEEKLY_POOL.filter(q => q.id !== 'wsurvive');
    const picked = [WEEKLY_POOL[0]];
    for (let i = 0; i < 2; i++) picked.push(pool[(h + i * 2) % pool.length]);
    return { week: weekKey(), quests: picked.map(q => ({ id: q.id, progress: 0, done: false, failed: false })), surviveStart: Date.now() };
  }
  let weekly = loadWeekly();
  function saveWeekly() { try { localStorage.setItem('p001_weekly', JSON.stringify(weekly)); } catch (e) {} }
  function weeklyDef(id) { return WEEKLY_POOL.find(q => q.id === id); }
  function weeklyProgress(ev, n) {
    for (const q of weekly.quests) {
      const def = weeklyDef(q.id);
      if (q.done || q.failed || !def.ev || def.ev !== ev) continue;
      q.progress = ev === 'comfort' ? Math.max(q.progress, n) : Math.min(def.target, q.progress + n);
      if (q.progress >= def.target) {
        q.done = true;
        state.gems += def.reward;
        sfx.gem();
        burst(['◆', '◆', '◆'], 7);
        say(`Задание недели выполнено. +${def.reward} клятв.`);
      }
    }
    saveWeekly();
  }

  /* ---------- Госпожа: покупка за клятвы, постоянные задания ---------- */
  const MISTRESS = [
    { n: 'нет',              p: 0   },
    { n: 'Надзирательница',  p: 100 },
    { n: 'Госпожа',          p: 250 },
    { n: 'Владычица',        p: 600 }
  ];
  let mistressLevel = 0; // куплено за клятвы — навсегда, смерть раба не отбирает
  const MQUEST_POOL = [
    { id: 'mthrow',   text: 'Бросай его по комнате. 6 раз, и без оков — мне нравится, как он летает.', ev: 'throwFree', target: 6,  reward: 4 },
    { id: 'mshame',   text: 'Унизь его 15 раз. Красиво, со вкусом.', ev: 'shame', target: 15, reward: 3 },
    { id: 'mstarve',  text: 'Пусть голодает: сытость ниже 25 суммарно 4 минуты.', ev: 'starve', target: 240, reward: 5 },
    { id: 'mbare',    text: 'Сними с него всё, включая оковы. Держи так 2 минуты.', ev: 'bare', target: 120, reward: 3 },
    { id: 'mcomfort', text: 'К моему приходу в комнате должен быть комфорт 8.', ev: 'comfort', target: 8, reward: 2 },
    { id: 'mwhip',    text: 'Порка. 25 раз. Я послушаю из коридора.', ev: 'whip', target: 25, reward: 3 }
  ];
  let mquest = null; // { id, progress }
  function mquestDef() { return mquest ? MQUEST_POOL.find(q => q.id === mquest.id) : null; }
  function newMistressQuest() {
    if (mistressLevel < 1) { mquest = null; return; }
    let pool = MQUEST_POOL.filter(q => !mquest || q.id !== mquest.id);
    // вредничает: рабу со склонностью «Оковы» чаще достаётся бросание — придётся снять цепи
    if (fetish === 'Оковы' && Math.random() < 0.6) {
      mquest = { id: 'mthrow', progress: 0 };
    } else {
      mquest = { id: pick(pool).id, progress: 0 };
    }
    say('Госпожа: ' + mquestDef().text);
  }
  function mquestProgress(ev, n) {
    const def = mquestDef();
    if (!def || def.ev !== ev) return;
    mquest.progress = ev === 'comfort' ? Math.max(mquest.progress, n) : Math.min(def.target, mquest.progress + n);
    if (mquest.progress >= def.target) {
      state.gems += def.reward;
      sfx.gem();
      burst(['◆', '✦'], 5);
      say(`Госпожа довольна. +${def.reward} клятв.`);
      const doneId = mquest.id;
      mquest = null;
      setTimeout(() => { if (!gone) newMistressQuest(); }, 25000);
    }
  }
  const MISTRESS_IDLE = [
    'Госпожа: Он всё ещё дышит. Скучно.',
    'Госпожа: Смотри, как старается. Почти трогательно.',
    'Госпожа: Я плачу не за дружбу. Я плачу за результат.',
    'Госпожа: У него глаза как у мокрого пса. Раздражает.',
    'Госпожа: Не привязывайся. Это расходник.',
    'Госпожа: В прошлый раз было быстрее.'
  ];
  const MISTRESS_TEASE = {
    'Оковы': 'Госпожа: Он любит цепи? Сними их. Пусть пострадает от свободы.',
    'Унижение': 'Госпожа: Он ждёт унижения? Не давай. Пусть помучается ожиданием.',
    'Боль': 'Госпожа: Ему нравится боль? Тогда сегодня — нежность. Пусть боится.',
    'Футфетиш': 'Госпожа: Он смотрит на сапоги? Пусть смотрит. До утра.',
    'Пояс верности': 'Госпожа: Замок на поясе? Оставь ключ на виду. Пусть помучается.'
  };

  let gone = false; // подопытный мёртв/сбежал — ждём нового
  let face = 'calm';
  let onboardingComplete = false;

  resetSlaveGear();
  function resetSlaveGear() {
    owned = { collar: false, 'gear-whip': false, gag: false };
    const keep = {};
    for (const k of GEM_GEAR) if (ownedOutfits[k]) keep[k] = true;
    ownedOutfits = { rags: true, shirt: false, robe: false, armor: false, pink: false, boots: false, harness: false, mask: false, croc: false, crochead: false, shark: false, twintails: false, helmet: false, rotten: false, goldarms: false, latex: false, stockings: false, skirt: false, heels: false, fur: false, hearteyes: false, muscle: false, ...keep };
    equipped = { body: 'rags', head: null, feet: null, arms: null, pants: null };
    beltLevel = 0;
    beltWorn = 0;
    beltBroken = false;
    baseMult = 1.0;
    restraints = { handcuffs: false, shackles: false };
    if (typeof setPetOff === 'function') setPetOff(0, 0, 'none');
    const p = document.getElementById('pet');
    if (p) p.classList.remove('fallen', 'rising', 'sitting');
  }

  const BELT = [
    { name: 'нет',    cap: 40,  price: 0,  cur: 'coins' },
    { name: 'Мк.I',   cap: 60,  price: 15, cur: 'coins' },
    { name: 'Мк.II',  cap: 90,  price: 40, cur: 'coins' },
    { name: 'Мк.III', cap: 100, price: 12, cur: 'gems'  }
  ];
  const OUTFITS = {
    rags:     { price: 0,  cur: 'coins', slot: 'body' },
    shirt:    { price: 20, cur: 'coins', slot: 'body' },
    robe:     { price: 45, cur: 'coins', slot: 'body' },
    armor:    { price: 15, cur: 'gems',  slot: 'body' },
    pink:     { price: 60, cur: 'coins', slot: 'body' },
    harness:  { price: 45, cur: 'coins', slot: 'body' },
    croc:     { price: 90, cur: 'coins', slot: 'body' },
    mask:     { price: 8,  cur: 'gems',  slot: 'head' },
    crochead: { price: 12, cur: 'gems',  slot: 'head' },
    shark:    { price: 10, cur: 'gems',  slot: 'head' },
    twintails:{ price: 70, cur: 'coins', slot: 'head' },
    helmet:   { price: 55, cur: 'coins', slot: 'head' },
    boots:    { price: 30, cur: 'coins', slot: 'feet' },
    rotten:   { price: 25, cur: 'coins', slot: 'feet' },
    goldarms: { price: 14, cur: 'gems',  slot: 'arms' },
    latex:     { price: 80,  cur: 'coins', slot: 'pants' },
    stockings: { price: 95,  cur: 'coins', slot: 'pants' },
    skirt:     { price: 50,  cur: 'coins', slot: 'pants' },
    heels:     { price: 70,  cur: 'coins', slot: 'feet' },
    fur:       { price: 250, cur: 'coins', slot: 'body' },
    hearteyes: { price: 12,  cur: 'gems',  slot: 'head' },
    muscle:    { price: 120, cur: 'coins', slot: 'body' }
  };

  const clamp = v => Math.max(0, Math.min(100, Math.round(v)));

  /* коэффициент дани */
  function gearBonus() {
    let b = 0;
    if (owned['collar']) b += 0.5;
    if (owned['gear-whip']) b += 0.5;
    if (beltLevel > 0 && !beltBroken) b += 0.5;
    if (typeof artifacts !== 'undefined' && artifacts.amulet) b += 0.35; // вшивый амулет
    return b;
  }
  function totalMult() { return baseMult + gearBonus() + FACE_FX[face].mult; }

  /* мускулистый торс: удары входят мягче */
  function dmgFactor() { return equipped.body === 'muscle' ? 0.55 : 1; }

  /* оковы: замедляют агрессию, снижают шанс клятвы */
  function aggrFactor() {
    let f = FACE_FX[face].aggr;
    if (restraints.handcuffs) f *= 0.5;
    if (restraints.shackles) f *= 0.5;
    return f;
  }
  function addAggr(x) { state.aggr = Math.min(100, state.aggr + x * aggrFactor()); }
  function calm(x) { state.aggr = Math.max(0, state.aggr - x); }

  const phrases = {
    feed:  ['Хлеб горчит, когда его подают из жалости.', 'Ем. Значит — пока жив.', 'Жевать тоже работа. Моя — жевать.', 'Ты кормишь меня, как руину: чтобы не осыпалась раньше срока.', 'Спасибо. Слово дешевле хлеба, а я всё равно его плачу.'],
    hit:   ['Бей. У стен кулаков нет, приходится мне.', 'Каждый удар — подпись. Я читаю тебя по почерку.', 'Боль приходит и уходит. Ты — остаёшься.', 'Я считаю удары. Это единственная арифметика, которой тут учат.', 'Кулак говорит правду, которой нет в твоих глазах.'],
    shame: ['Слова режут глубже ремня.', 'Ты опоздала с унижением. Я давно никто.', 'Говори ещё. Тишина здесь страшнее тебя.', 'Унижение — тоже внимание. А внимание тут — валюта.', 'Я слышал хуже. От себя самого, ночами.'],
    whip:  ['Ремень поёт, монеты звенят. Все при деле.', 'Порка — тоже ремесло. У нас у двоих.', 'Считай вслух. Так честнее.', 'Кожа помнит дольше, чем кошелёк.'],
    idle:  ['Здесь даже тьма скучает.', 'Капает вода. Считаю капли. Двести двенадцать.', 'Долго смотришь в камеру — камера начинает смотреть в тебя.', 'Я видел сон. В нём была дверь. Больше в нём ничего не было.', 'Ты пришла за деньгами. Я — за смыслом. Оба зря.', 'Свеча догорает. Мы все здесь догораем.', 'Тише. Я слушаю, как растёт плесень.'],
    thrown:['Полёт недолог. Как и всё здешнее.', 'Я падал и ниже.', 'Цепи возвращают. Они всегда возвращают.', 'В воздухе было свободнее. Одно мгновение — но было.'],
    overfeed: ['Хватит. Я не амбар.', 'Еда кончилась во мне раньше, чем в миске.', 'Меня откармливают, как скотину. К празднику, которого не будет.', 'Сытость — тоже клетка. Только дверь изнутри.', 'Ещё кусок — и я стану тем, что ты кормишь.'],
    fallen: ['Упал. Встану. Привычка дурная — не сломаться.', 'Пол здесь ближе, чем кажется.', 'Я всегда приземляюсь. Это мой единственный талант.', 'Лежать недолго. Лежать недолго.'],
    idlePoor: ['Здесь даже тьма скучает.', 'Капает вода. Считаю капли. Двести двенадцать.', 'Долго смотришь в камеру — камера начинает смотреть в тебя.', 'Я видел сон. В нём была дверь. Больше в нём ничего не было.', 'Ты пришла за деньгами. Я — за смыслом. Оба зря.', 'Свеча догорает. Мы все здесь догораем.', 'Тише. Я слушаю, как растёт плесень.'],
    idleRich: ['Мрамор холоднее цепей. Но приятнее.', 'Под люстрой даже тень выглядит прилично.', 'Здесь пахнет воском, а не плесенью. Подозрительно.', 'Витраж разливает свет. Я стою в нём, как в луже.', 'В такой комнате сидеть — уже полдела к прощению.', 'Трофеи на полке. Надеюсь, я не пополню коллекцию.'],
    shave: ['Опять гладкий. Как бумага, на которой ничего не пишут.', 'Щетина росла быстрее надежды. Обе под нож.', 'Ты бреешь меня, как подписываешь: размашисто и не читая.', 'Спасибо. Теперь в зеркале лужи — снова я.'],
    cut: ['Лезвие острее твоих слов. Чуть-чуть.', 'Кровь — это просто подпись. Ещё одна.', 'Порез. Мелочь. Шрам останется — память бесплатно.', 'Осторожнее. Я единственный экземпляр.'],
    window: ['За решёткой — небо. Оно тоже под замком.', 'Я смотрю в окно. Окно смотрит в меня. Ничья.', 'Шторы. Здесь даже свет входит одетым.', 'Витраж делит день на цвета. День всё равно серый.'],
    chair: ['Спинка стула. Я забыл, что спине можно помогать.', 'Сижу. Впервые за долгое время — не на коленях.', 'Кресло принимает вес. Это больше, чем ты.', 'Трон. Каждый пленник — король своей камеры.'],
    bed:   ['Мягко. Тело не верит, разум — тоже.', 'На таком ложе видятся двери.', 'Матрас помнит всех, кто здесь лежал. Он мне шепчет.']
  };
  // реплик мало не бывает: подливаем масла в мрак
  phrases.feed.push('Жуй, говоришь? Жую. Мы оба выполняем инструкции.', 'Крошки на полу — мой паёк, мой ковёр, мой календарь.', 'Еда без отравы. Ты сегодня добрая. Запишу.', 'Миска пуста. В ней отражается тот, кого нет.');
  phrases.hit.push('Синяк заживёт. Твой почерк — нет.', 'Мог бы уклониться. Но куда.', 'Сила удара — четыре. Замах — театральный. Работай.', 'Бей по расписанию. Я сверяюсь.');
  phrases.shame.push('Продолжай. Я собираю твои слова, как пустые банки.', 'Унижение в чистоте не держится. Спроси у пола.', 'Ты называешь это словами. Я называю это погодой.');
  phrases.whip.push('Ремень свистит. У меня аллергия на тишину, так что спасибо.', 'Хлёстко. В обоих смыслах, которых у тебя нет.');
  phrases.idle.push('Я разговариваю со стеной. Стена — единственная, кто слушает, не перебивая.', 'Вчера было завтра. Завтра будет вчера. Здесь легко с календарём.', 'Пытаюсь вспомнить небо. Получается потолок.', 'Тишина тут плотная. Можно резать. Можно есть. Выбор невелик.');
  phrases.idlePoor.push('Сквозит. Сквозняк — единственный, кто входит без стука.', 'Углы тут честные. Ничего не скрывают.');
  phrases.idleRich.push('Позолота тускнеет, если на неё дышать. Проверено.', 'Тут так чисто, что я чувствую себя пятном.');
  phrases.thrown.push('Гравитация — единственная, кто меня обнимает.', 'Короткий полёт. Долгое приземление. Классика.');
  phrases.overfeed.push('Лопну. Тогда будешь вытирать совесть.', 'Столько еды я не видел даже до всего этого.');
  phrases.fallen.push('Пол лечит лучше кормёжки. Лежу, лечусь.', 'Не поднимай. Я тут подумаю.');
  phrases.window.push('Решётка делит небо на полосы. Так удобнее не смотреть.', 'Дождь по стеклу. Ему можно наружу. Ему всё можно.');
  phrases.chair.push('У стула четыре ноги. Завидую: ему не приказывают стоять.', 'Сидячее положение. Роскошь, о которой не пишут.');
  phrases.bed.push('Спать здесь — значит ненадолго перестать быть имуществом.', 'Подушка мягче совести хозяйки. Любой.');
  phrases.shave.push('Гладко. Теперь холод имеет полный доступ.', 'Бритва поёт тонко. Я подпеваю.');
  phrases.cut.push('Не заплачу. Вода дороже.', 'Порез заживёт. К лучшему ли — не знаю.');

  const SAFE_PHRASES = {
    feed: ['Спасибо, это очень кстати.', 'Сытость возвращает хорошие мысли.', 'Вкусно. Я готов к новым задачам.', 'Забота — тоже часть дисциплины.'],
    hit: ['Ай! Буду внимательнее.', 'Понял, больше не буду.', 'Ш-ш-ш! Звонко получилось.', 'Ой! Исправлюсь.'],
    shame: ['Хм( Я правда старался.', 'Понимаю. Скажите, как сделать лучше.', 'Обидно, но замечание принято.', 'Хм( Постараюсь вас порадовать.'],
    whip: ['Пи-и! Я всё понял!', 'Пи! Дисциплина усвоена.', 'Пи-и-и! Буду стараться лучше.', 'Пи! В следующий раз получится.'],
    idle: ['Интересно, что мы будем делать сегодня?', 'Я придумал новый план на день.', 'Тихо. Можно немного помечтать.', 'Надеюсь, вы довольны моей работой.'],
    idlePoor: ['Скромно, зато всё по-настоящему.', 'Уют начинается с хорошего настроения.', 'Здесь спокойно.'],
    idleRich: ['Как красиво! Я постараюсь всё сохранить.', 'В такой комнате хочется творить.', 'Спасибо за такую обстановку.'],
    thrown: ['Ой, неожиданная прогулка!', 'Кажется, я не туда посмотрел.', 'Уже встаю!'],
    overfeed: ['Спасибо, но я уже сыт.', 'Оставим немного на потом.', 'Большая порция! Поделимся?'],
    fallen: ['Всё в порядке, уже поднимаюсь.', 'Небольшая пауза не помешает.', 'Ой. Продолжим с того же места.'],
    shave: ['Аккуратно и красиво. Спасибо.', 'Новый образ готов.', 'Так намного удобнее.'],
    cut: ['Ой, будьте аккуратнее.', 'Небольшая царапина. Всё хорошо.', 'Давайте продолжим осторожно.'],
    window: ['Какой хороший день для новых свершений.', 'Мне нравится смотреть на небо.', 'За окном красиво.'],
    chair: ['Удобно. Спасибо.', 'Можно обдумать новые идеи.', 'Хорошее место для отдыха.'],
    bed: ['Отличный отдых.', 'Так и спится спокойно.', 'Спасибо за заботу.'],
    trash: ['Порядок начинается с малого.', 'Посмотрим, что можно использовать заново.', 'Наведём здесь уют.'],
    surgery: ['Новый образ завершён.', 'Выгляжу иначе. Интересно!', 'Готов к следующему заданию.']
  };

  /* отклики на предметы: одна вещь — много настроений */
  const ITEM_SAY = {
    collar: ['Теперь я официально ваш. Почта работает.', 'Ошейник. Потеряюсь — вернут по адресу.', 'Тесноват. Как и всё в этой жизни.', 'Табличку с именем пришлёшь? Или номер сойдёт?'],
    'gear-whip': ['Инструмент выдан. Профсоюз молчит.', 'Держу её, как чемодан без дна.', 'Она легче, чем выглядит. Удар — тяжелее, чем звучит.'],
    gag: ['Ммф! М-м-мф!', 'Мф. Мф-ф. (Он сказал «спасибо». Или проклятие. Кляп шепчет невнятно.)', 'М-м-м! Мм!'],
    rags: ['Лохмотья. Классика жанра.', 'Снова эти лоскуты. Они стареют со мной.'],
    shirt: ['Рубашка. Почти прилично. Почти.', 'Пуговицы чужие. Спина своя.'],
    robe: ['Роба. Пахнет камерой и чужими надеждами.', 'Тяжёлая. Как приговор, но тёплая.'],
    armor: ['Броня надета. Мне… спокойнее.', 'Железо на груди. Внутри — всё равно мясо.', 'Теперь я бронированный актив.'],
    pink: ['Розовый пиджак. Ирония сидит идеально.', 'Цвет вечеринки, на которую меня не звали.'],
    harness: ['Шлейка. Ремней много, выхода нет.', 'Заклёпки блестят. Единственный блеск на мне.'],
    croc: ['Я теперь рептилия. Отлично.', 'Я крокодил. В этой комнате это повышение.', 'Бомбардиро. Не спрашивай. Сам не знаю.'],
    mask: ['Маска пса. Гав. Статус понижен до питомца.', 'Лицо спрятано. Стыд — нет.'],
    crochead: ['Зубы настоящие. Я проверил.', 'Голова крокодила. Мысли, впрочем, свои.'],
    shark: ['В этой шкуре пахнет мемами.', 'Акула на суше. Карьера идёт ко дну — по расписанию.'],
    twintails: ['Розовые хвосты. Дно пробито, копаем дальше.', 'Хвостики. Аниме было ошибкой, и я — её лицо.'],
    helmet: ['Легионер без легиона. Вечный патруль.', 'Шлем. Воюю с вентиляцией. Пока ничья.'],
    boots: ['Сапоги. Шаг стал тяжелее. Осанка — нет.', 'Кожа скрипит. Я тоже.'],
    rotten: ['Пахнут смертью. Надеюсь, не моей.', 'Тухлые ноги. Запах — единственное, что тут бессмертно.'],
    goldarms: ['Руки из золота. Теперь я — предмет роскоши.', 'Золотые руки. Стою дороже, чем стою.', 'Тяжёлые. Зато крафт теперь — моё ремесло.'],
    latex: ['Латекс. Скрипит, когда я дышу.', 'Скриплю при ходьбе. Музыка под стать здешней.'],
    stockings: ['Бантики. Вы серьёзно?.. Ладно. Они розовые.', 'Колготки со стрелкой. Стрелка указывает на дно.'],
    skirt: ['Юбка. Короткая. Комментарии излишни.', 'Складки держатся лучше, чем я.'],
    heels: ['Каблуки. Теперь меня слышно раньше, чем видно.', 'Стучу, как метроном. Дирижируй.'],
    fur: ['Шуба. Я выгляжу дороже, чем стою. Это странно.', 'Тёплая. Кто-то отапливал её бедой.'],
    hearteyes: ['Сердечки в глазах. Я так не чувствую. Я так ВЫГЛЯЖУ.', 'Вижу мир розово. Буквально. Верни стены.'],
    muscle: ['Мышцы. Качал штангу из кандалов. Теперь бить меня — дороже.', 'Бицепс — мой единственный документ.', 'Теперь я не только мусор, но и мешок.']
  };

  /* реплики у мусорки: он знает, кто он */
  phrases.trash = ['Я смотрю на эту кучу — и вижу семейный портрет.', 'Мусор к мусору. Прах к праху. Логистика налажена.', 'В этой куче больше от меня, чем во мне.', 'Однажды меня выбросят. Уйду по знакомому адресу.', 'Не сортируй. Мы с ней одной фракции.', 'Копаешься в отбросах? Осторожно. Там я.', 'Куча пахнет свободой. Свобода пахла именно так.'];
  phrases.surgery = ['Операция прошла. Пациент почти не кричал. Наркоза не было.', 'Скальпель, нить, шрам. Я — твоя рукопись.', 'Тело — чертёж. Ты его перечертила.', 'Проснулся другим. Вопрос: лучше ли?', 'Кости скрипят по-новому. Привыкаю к себе заново.'];

  const pick = arr => {
    if (censorshipOn) {
      const safeName = Object.keys(phrases).find(name => phrases[name] === arr && SAFE_PHRASES[name]);
      if (safeName) arr = SAFE_PHRASES[safeName];
    }
    return arr[Math.floor(Math.random() * arr.length)];
  };

  const $ = id => document.getElementById(id);

  function blockBeforeOnboarding(event) {
    if (onboardingComplete || event.target.closest('#start-modal')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  document.addEventListener('pointerdown', blockBeforeOnboarding, true);
  document.addEventListener('click', blockBeforeOnboarding, true);

  /* ================= ЗВУК ================= */
  let AC = null, ambientGain = null, masterGain = null;
  let volume = 0.6, lastVolume = 0.6;
  try {
    const storedVolume = localStorage.getItem('p001_volume');
    if (storedVolume !== null && Number.isFinite(Number(storedVolume)) && Number(storedVolume) >= 0 && Number(storedVolume) <= 1) volume = Number(storedVolume);
  } catch (e) {}
  let soundOn = volume > 0;
  if (soundOn) lastVolume = volume;
  function audio() {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = AC.createGain();
      masterGain.gain.value = soundOn ? volume : 0;
      masterGain.connect(AC.destination);
    }
    if (AC.state === 'suspended' && !document.hidden) AC.resume();
    return AC;
  }
  function syncSound() {
    if (masterGain) masterGain.gain.setTargetAtTime(soundOn ? volume : 0, AC.currentTime, 0.02);
    $('btn-sound').textContent = soundOn ? `Звук: ${Math.round(volume * 100)}%` : 'Звук: выкл';
    $('btn-sound').classList.toggle('off', !soundOn);
    $('volume-range').value = Math.round(volume * 100);
    $('volume-value').textContent = Math.round(volume * 100) + '%';
    try { localStorage.setItem('p001_volume', String(volume)); } catch (e) {}
  }
  function env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(freqA, freqB, dur, type, peak, delay = 0) {
    if (!soundOn || document.hidden) return;
    const c = audio(), t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freqA, t);
    o.frequency.exponentialRampToValueAtTime(freqB, t + dur);
    env(g, t, 0.005, dur, peak);
    o.connect(g).connect(masterGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noiseBurst(dur, filterFreq, peak, type = 'highpass') {
    if (!soundOn || document.hidden) return;
    const c = audio(), t = c.currentTime;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
    const g = c.createGain(); env(g, t, 0.003, dur, peak);
    src.connect(f).connect(g).connect(masterGain);
    src.start(t);
  }
  const HISS_SOUNDS = [
    () => { noiseBurst(0.24, 3600, 0.24, 'bandpass'); tone(230, 105, 0.28, 'sawtooth', 0.08); },
    () => { noiseBurst(0.32, 4800, 0.2, 'bandpass'); tone(180, 80, 0.35, 'sawtooth', 0.07); },
    () => { noiseBurst(0.18, 2900, 0.28, 'highpass'); tone(310, 125, 0.2, 'triangle', 0.1); },
    () => { noiseBurst(0.38, 5400, 0.18, 'bandpass'); tone(150, 65, 0.42, 'sawtooth', 0.06); }
  ];
  const SAD_SOUNDS = [
    () => { tone(280, 190, 0.28, 'sine', 0.24); tone(190, 135, 0.36, 'sine', 0.2, 0.24); },
    () => { tone(245, 165, 0.42, 'triangle', 0.22); tone(170, 120, 0.32, 'sine', 0.16, 0.28); },
    () => { tone(320, 235, 0.22, 'sine', 0.2); tone(225, 145, 0.45, 'triangle', 0.2, 0.18); },
    () => { tone(210, 175, 0.3, 'sine', 0.25); tone(180, 110, 0.5, 'sine', 0.18, 0.22); }
  ];
  const SQUEAK_SOUNDS = [
    () => { tone(680, 1320, 0.14, 'sine', 0.18); tone(1320, 790, 0.2, 'triangle', 0.14, 0.12); },
    () => { tone(820, 1480, 0.12, 'triangle', 0.17); tone(1480, 980, 0.16, 'sine', 0.13, 0.1); },
    () => { tone(590, 1080, 0.1, 'sine', 0.17); tone(1080, 1550, 0.12, 'sine', 0.14, 0.09); tone(1550, 900, 0.17, 'triangle', 0.11, 0.2); },
    () => { tone(940, 620, 0.22, 'triangle', 0.17); tone(1260, 760, 0.2, 'sine', 0.12, 0.08); }
  ];
  const sfx = {
    thud:  () => { tone(120, 35, 0.22, 'sine', 0.55); noiseBurst(0.08, 400, 0.2, 'lowpass'); pick(HISS_SOUNDS)(); },
    crack: () => { noiseBurst(0.14, 2800, 0.5); tone(900, 200, 0.08, 'square', 0.12); pick(SQUEAK_SOUNDS)(); },
    munch: () => { for (let i = 0; i < 3; i++) tone(170, 95, 0.08, 'triangle', 0.16, i * 0.14); },
    shame: () => pick(SAD_SOUNDS)(),
    coin:  () => { tone(1318, 1318, 0.07, 'sine', 0.25); tone(1760, 1760, 0.12, 'sine', 0.22, 0.08); },
    gem:   () => { tone(1046,1046,0.08,'sine',0.2); tone(1568,1568,0.1,'sine',0.18,0.09); tone(2093,2093,0.16,'sine',0.16,0.18); },
    deny:  () => { tone(220, 110, 0.2, 'square', 0.18); },
    revolt:() => { tone(60, 30, 1.2, 'sawtooth', 0.5); noiseBurst(0.5, 900, 0.4, 'lowpass'); },
    chain: () => { noiseBurst(0.2, 1500, 0.4, 'bandpass'); tone(300, 90, 0.3, 'square', 0.15, 0.1); }
  };
  function noiseAt(t, dur, filterFreq, peak, type = 'highpass', bus = null) {
    if (!soundOn || document.hidden) return;
    const c = audio();
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
    const g = c.createGain(); env(g, t, 0.003, dur, peak);
    src.connect(f).connect(g).connect(bus || masterGain);
    src.start(t);
  }

  /* ================= МУЗЫКА: мрачная генеративная тема + биты с кнопок ================= */
  let musicBus = null, drumBus = null, delayNode = null;
  let musicTimer = null, gridStart = 0, stepCount = 0;
  const BPM = 96;
  const STEP = 60 / BPM / 2; // восьмые
  const SCALE = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23]; // D минор
  let mgMusic = null; // пока идёт мини-игра — обычный трек молчит

  function startAmbient() {
    if (!soundOn || document.hidden) return;
    const c = audio();
    if (!ambientGain) {
      const o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
      o1.type = 'sine'; o1.frequency.value = 48;
      o2.type = 'sine'; o2.frequency.value = 48.7;
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 0.08; lg.gain.value = 0.008;
      lfo.connect(lg).connect(g.gain);
      g.gain.value = 0.022;
      o1.connect(g); o2.connect(g); g.connect(masterGain);
      o1.start(); o2.start(); lfo.start();
      ambientGain = g;
    }
    if (!musicBus) {
      musicBus = c.createGain(); musicBus.gain.value = 0.55;
      drumBus = c.createGain(); drumBus.gain.value = 0.85;
      // пространство: дилэй с обратной связью
      delayNode = c.createDelay(1.2); delayNode.delayTime.value = 0.36;
      const fb = c.createGain(); fb.gain.value = 0.34;
      const df = c.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 2200;
      delayNode.connect(df).connect(fb).connect(delayNode);
      const wet = c.createGain(); wet.gain.value = 0.5;
      delayNode.connect(wet).connect(masterGain);
      musicBus.connect(masterGain);
      musicBus.connect(delayNode);
      drumBus.connect(masterGain);
    }
    if (!musicTimer) {
      gridStart = c.currentTime + 0.1;
      stepCount = 0;
      musicTimer = setInterval(scheduleMusic, 70);
    }
  }

  function scheduleMusic() {
    if (!soundOn || document.hidden || mgMusic) return;
    const c = audio();
    while (gridStart + stepCount * STEP < c.currentTime + 0.3) {
      playStep(stepCount, gridStart + stepCount * STEP);
      stepCount++;
    }
  }

  function pluck(freq, t, dur, peak, type = 'triangle') {
    if (!soundOn || document.hidden || !musicBus) return;
    const c = audio();
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1700;
    o.connect(f).connect(g).connect(musicBus);
    o.start(t); o.stop(t + dur + 0.1);
  }

  function whisper(t) {
    noiseAt(t, 0.7, 700, 0.03, 'lowpass', musicBus);
  }

  /* ударные */
  function drumKick(t, peak = 0.5) {
    if (!soundOn || !drumBus) return;
    const c = audio();
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
    env(g, t, 0.004, 0.24, peak);
    o.connect(g).connect(drumBus);
    o.start(t); o.stop(t + 0.32);
  }
  function drumSnare(t, peak = 0.4) {
    if (!soundOn || !drumBus) return;
    noiseAt(t, 0.13, 1800, peak, 'bandpass', drumBus);
    const c = audio();
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(190, t);
    env(g, t, 0.003, 0.09, peak * 0.5);
    o.connect(g).connect(drumBus);
    o.start(t); o.stop(t + 0.12);
  }
  function drumHat(t, peak = 0.14) { if (!soundOn || !drumBus) return; noiseAt(t, 0.045, 7500, peak, 'highpass', drumBus); }
  function drumTom(t, peak = 0.4) {
    if (!soundOn || !drumBus) return;
    const c = audio();
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(92, t + 0.18);
    env(g, t, 0.004, 0.22, peak);
    o.connect(g).connect(drumBus);
    o.start(t); o.stop(t + 0.28);
  }
  function drumClap(t, peak = 0.35) {
    if (!soundOn || !drumBus) return;
    noiseAt(t, 0.09, 1200, peak, 'bandpass', drumBus);
    noiseAt(t + 0.025, 0.07, 1400, peak * 0.7, 'bandpass', drumBus);
  }
  function drumBell(t, peak = 0.12) {
    pluck(1174.66, t, 2.2, peak, 'sine'); // D6, «шкатулка»
    pluck(587.33, t, 2.6, peak * 0.6, 'sine');
  }

  /* квантование клика к ближайшей 16-й доле — кнопки ложатся в ритм */
  function beatTime() {
    const c = audio();
    if (!musicTimer) return c.currentTime;
    const s16 = STEP / 2;
    const k = Math.ceil((c.currentTime + 0.015 - gridStart) / s16);
    return gridStart + Math.max(0, k) * s16;
  }

  /* мелодия с кнопки: ноты гаммы, квантованные в сетку трека */
  function btnMelody(idxs, gap = STEP / 2, peak = 0.1, type = 'triangle') {
    const t0 = beatTime();
    idxs.forEach((si, i) => pluck(SCALE[si] * 2, t0 + i * gap, 1.6, peak, type));
  }

  /* фоновая партия: туманные бас-ноты, редкие крупицы мелодии, шкатулка, сердцебиение при агрессии */
  const CHORDS = [
    [146.83, 220.0, 293.66],  // Dm
    [116.54, 174.61, 233.08], // Bb
    [98.0, 146.83, 196.0],    // Gm
    [110.0, 164.81, 220.0]    // A
  ];
  let motif = [0, 2, 4, 1]; // блуждающая мелодическая фигура, меняется каждые 4 бара
  function padChord(freqs, t, dur = 5.4) {
    if (!soundOn || !musicBus) return;
    const c = audio();
    freqs.forEach(f => {
      for (const det of [-5, 4]) { // лёгкая расстройка = глубина
        const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        fl.type = 'lowpass'; fl.frequency.value = 620; fl.Q.value = 0.7;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.017, t + 1.5);
        g.gain.setValueAtTime(0.017, t + dur - 1.8);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(fl).connect(g).connect(musicBus);
        o.start(t); o.stop(t + dur + 0.1);
      }
    });
  }
  function playStep(step, t) {
    const bar = Math.floor(step / 8) % 4;
    const s = step % 8;
    const aggr = state ? state.aggr : 0;
    // новый мотив каждые 4 бара — блуждание по ладу
    if (step % 32 === 0) {
      motif = [0, 1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5).slice(0, 4);
    }
    // бас-тоника, длинная и тёплая
    if (s === 0) pluck(CHORDS[bar][0] / 2, t, 3.4, 0.12, 'sine');
    // пад-аккорд раз в 2 бара — медленное дыхание гармонии
    if (s === 0 && Math.floor(step / 8) % 2 === 0) padChord(CHORDS[bar], t);
    // мелодия: ноты мотива на слабые доли, длинные затухания
    const mi = { 2: 0, 3: 1, 6: 2, 7: 3 }[s];
    if (mi !== undefined && Math.random() < 0.72) {
      const f = SCALE[motif[mi]] * 2;
      pluck(f, t, 1.9 + Math.random() * 0.9, 0.048, Math.random() < 0.35 ? 'sine' : 'triangle');
    }
    // эхо-ответ октавой выше, изредка
    if (s === 5 && Math.random() < 0.12) pluck(SCALE[motif[2]] * 4, t, 2.6, 0.02, 'sine');
    // глубокий колокол каждые 8 баров
    if (step % 64 === 32) pluck(73.42, t, 6.0, 0.05, 'sine');
    // сердцебиение при высокой агрессии
    if (aggr > 60 && (s === 0 || s === 4)) drumKick(t, 0.16);
    if (s === 5 && Math.random() < 0.06) whisper(t);
  }

  $('btn-sound').addEventListener('click', () => {
    soundOn = !soundOn;
    if (soundOn) {
      volume = lastVolume;
      startAmbient();
    }
    syncSound();
  });
  $('volume-range').addEventListener('input', event => {
    volume = Number(event.target.value) / 100;
    soundOn = volume > 0;
    if (soundOn) {
      lastVolume = volume;
      startAmbient();
    }
    syncSound();
  });
  syncSound();
  window.addEventListener('pointerdown', () => {
    if (onboardingComplete && soundOn) { audio(); startAmbient(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (!AC) return;
    if (document.hidden) {
      if (AC.state !== 'closed') AC.suspend().catch(() => {});
      return;
    }
    if (!onboardingComplete || !soundOn) return;
    AC.resume().then(() => {
      if (document.hidden || !soundOn) return;
      gridStart = AC.currentTime + 0.1;
      stepCount = 0;
      if (mgMusic) mgMusic.next = AC.currentTime + 0.06;
      startAmbient();
    }).catch(() => {});
  });
  window.addEventListener('pagehide', () => {
    if (AC && AC.state !== 'closed') AC.suspend().catch(() => {});
  });

  function applyCensorship() {
    document.body.classList.toggle('safe-mode', censorshipOn);
    $('censor-toggle').checked = censorshipOn;
    document.querySelectorAll('[data-safe]').forEach(element => {
      if (!element.dataset.uncensored) element.dataset.uncensored = element.innerHTML;
      element.innerHTML = censorshipOn ? element.dataset.safe : element.dataset.uncensored;
    });
    $('scene-slave-tag').textContent = slaveDisplayName();
    $('auction-title').textContent = censorshipOn ? 'АУКЦИОН СЛУГ' : 'АУКЦИОН РАБОВ';
    if ($('auction-modal').classList.contains('open')) {
      renderAuctionCurrent();
      loadAuction();
    }
    if ($('leaderboard-modal').classList.contains('open')) loadLeaderboard();
    render();
  }
  $('censor-toggle').addEventListener('change', () => {
    censorshipOn = $('censor-toggle').checked;
    try { localStorage.setItem('p001_censorship', censorshipOn ? '1' : '0'); } catch (e) {}
    applyCensorship();
    say(censorshipOn ? 'Детский режим включён. Термины и реплики смягчены.' : 'Цензура отключена.');
  });

  function setMoreMenu(open) {
    $('more-menu').hidden = !open;
    $('btn-more').setAttribute('aria-expanded', String(open));
  }
  $('btn-more').addEventListener('click', () => setMoreMenu($('more-menu').hidden));
  $('btn-profile').addEventListener('click', () => setMoreMenu(false));
  $('btn-referral').addEventListener('click', () => setMoreMenu(false));
  $('btn-leaderboard').addEventListener('click', () => setMoreMenu(false));
  $('btn-leave').addEventListener('click', async () => {
    setMoreMenu(false);
    if (persistenceReady) {
      storeLocalProgress();
      if (initData && !saveInFlight) await saveProgress();
    }
    try {
      const response = await fetch(API_BASE + '/api/config');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const config = await response.json();
      if (tg && tg.openTelegramLink) tg.openTelegramLink(config.bot_url);
      else window.location.assign(config.bot_url);
    } catch (error) {
      say('Не удалось открыть чат с ботом. Попробуйте ещё раз.');
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('.more-wrap')) setMoreMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setMoreMenu(false);
  });

  /* ================= РЕНДЕР ================= */
  function padNo() { return String(slaveNo).padStart(3, '0'); }

  function render() {
    for (const k of ['food', 'mood', 'dignity', 'fear', 'obed', 'need']) if (state[k] < 0) state[k] = 0;
    if (state.hp < 0) state.hp = 0;
    for (const key of ['hp', 'food', 'mood', 'dignity', 'fear', 'obed', 'need']) {
      const v = clamp(state[key]);
      $(`v-${key}`).textContent = v;
      $(`b-${key}`).style.width = v + '%';
      const box = $(`st-${key}`);
      box.classList.toggle('warn', v < 45 && v >= 20);
      box.classList.toggle('crit', v < 20);
    }
    // слом духа: достоинство помечено навсегда
    if (spiritBroken) {
      $('v-dignity').textContent = censorshipOn ? 'УСТАЛ' : 'СЛОМЛЕН';
      $('st-dignity').classList.add('crit');
    }
    $('v-coins').textContent = state.coins;
    $('v-gems').textContent = state.gems;
    $('rat-family').setAttribute('opacity', artifacts.ratking ? 1 : 0);

    const m = totalMult();
    $('v-tribute').textContent = Math.round(100 * m);
    $('v-mult').textContent = '×' + m.toFixed(2);
    $('b-tribute').style.width = Math.min(100, m / 3 * 100) + '%';

    $('v-aggr').textContent = Math.round(state.aggr) + '%';
    $('b-aggr').style.width = Math.min(100, state.aggr) + '%';

    const beltLabel = $('belt-label');
    beltLabel.textContent = 'Пояс послушания: ' + BELT[beltLevel].name + (beltBroken ? ' · СЛОМАН' : '');
    beltLabel.classList.toggle('broken', beltBroken);
    $('fetish-label').textContent = (censorshipOn ? 'Характер: ' : 'Склонность: ') + (dossierUnlocked ? displayFetish(fetish) : '??? · см. Досье');
    $('decor-label').textContent = 'Комната: ' + comfort + '/' + MAX_COMFORT + (comfort ? ' · ×' + comfortMult().toFixed(2) : '');
    $('respect-label').textContent = 'Обращение: ' + (censorshipOn && comfort >= 10 ? '«наставница»' : comfort >= 10 ? '«госпожа»' : comfort >= 4 ? '«на вы»' : '«на ты»');
    const qd = questDef();
    const ql = $('quest-label');
    if (quest.done) { ql.textContent = 'Задание дня: выполнено ✓'; ql.classList.add('done'); }
    else {
      ql.classList.remove('done');
      const p = qd.ev === 'collarTime' ? Math.floor(quest.progress / 60) + '/' + (qd.target / 60) + ' мин' : Math.floor(quest.progress) + '/' + qd.target;
      ql.textContent = softenText('Задание: ' + qd.text + ' (' + p + ')');
    }
    $('btn-indulge').disabled = Date.now() < indulgeCdUntil;
    document.querySelectorAll('button.buy[data-slot]').forEach(btn => {
      const slot = SLOTS[btn.dataset.slot];
      const lvl = room[btn.dataset.slot];
      const next = slot.tiers[lvl + 1];
      $('slot-desc-' + btn.dataset.slot).textContent = slot.tiers[lvl].n + (next ? ' → ' + next.n : '');
      if (!next) { btn.textContent = 'Максимум'; btn.disabled = true; btn.classList.add('owned'); }
      else { btn.textContent = next.p + ' монет'; btn.disabled = state.coins < next.p; btn.classList.remove('owned'); }
    });
    $('belt-desc').textContent = '+0.5 к дани · ур. ' + beltLevel;
    // небрежный вид: чем ниже достоинство, тем сильнее зарос
    let stubbleOp = Math.max(0, Math.min(0.9, (60 - state.dignity) / 55));
    if (fetish === 'Лохматый') stubbleOp = Math.max(stubbleOp, 0.55); // лохматый не разгладить
    $('stubble').setAttribute('opacity', stubbleOp.toFixed(2));
    $('messyhair').setAttribute('opacity', state.dignity < 35 ? ((35 - state.dignity) / 35 * 0.9).toFixed(2) : 0);
    if (typeof updateRazorBtn === 'function') updateRazorBtn();

    document.querySelectorAll('button.buy[data-item]').forEach(btn => {
      if (owned[btn.dataset.item]) return;
      btn.disabled = state.coins < +btn.dataset.price;
    });
    document.querySelectorAll('button.buy[data-restraint]').forEach(btn => {
      const key = btn.dataset.restraint;
      btn.classList.remove('equipped', 'to-equip', 'owned');
      if (restraints[key]) { btn.textContent = 'Снять'; btn.classList.add('equipped'); btn.disabled = false; }
      else if (restraintsOwned[key]) { btn.textContent = 'Надеть'; btn.classList.add('to-equip'); btn.disabled = false; }
      else { btn.textContent = btn.dataset.price + ' монет'; btn.disabled = state.coins < +btn.dataset.price; }
    });

    const beltBtn = $('btn-belt');
    if (beltLevel >= 3) {
      beltBtn.textContent = 'Максимум';
      beltBtn.disabled = true;
      beltBtn.classList.add('owned');
    } else {
      const next = BELT[beltLevel + 1];
      beltBtn.textContent = next.cur === 'gems' ? `${next.price} ◆` : `${next.price} монет`;
      beltBtn.classList.toggle('gem-price', next.cur === 'gems');
      beltBtn.disabled = next.cur === 'gems' ? state.gems < next.price : state.coins < next.price;
    }
    // переключатель купленных уровней пояса
    const bl = $('belt-lvls');
    bl.innerHTML = '';
    for (let i = 1; i <= beltLevel; i++) {
      const b = document.createElement('button');
      b.textContent = i;
      b.dataset.lvl = i;
      if (beltWorn === i) b.classList.add('active');
      b.title = BELT[i].name;
      bl.appendChild(b);
    }
    $('whip-hand').setAttribute('opacity', owned['gear-whip'] ? 1 : 0);
    applyBelt();
    renderDecorDots();
    renderWardrobe();
    updateFace();
    updatePose();
    // светлая обстановка разгоняет ночную темноту
    let lux = 1 + comfort * 0.035 + (room.light || 0) * 0.13;
    for (const k in decorVar) if ((decorVar[k] || 0) > 0) lux += 0.05;
    document.querySelector('.room').style.filter = 'brightness(' + Math.min(1.9, lux).toFixed(2) + ')';
    if ($('quests-modal').classList.contains('open')) renderQuests();
  }

  /* ---------- поза: на коленях при низком достоинстве ---------- */
  function updatePose() {
    pet.classList.toggle('kneel', (spiritBroken || clamp(state.dignity) <= 10) && !gone);
  }

  /* ---------- гардероб ---------- */
  const OUTFIT_SVG = {
    rags: 'out-rags', shirt: 'out-shirt', robe: 'out-robe', armor: 'out-armor',
    pink: 'out-pink', boots: 'out-boots', harness: 'out-harness', mask: 'out-mask',
    croc: 'out-croc', crochead: 'out-crochead', shark: 'out-shark',
    twintails: 'out-twintails', helmet: 'out-helmet', rotten: 'out-rotten', goldarms: 'out-goldarms',
    latex: 'out-latex', stockings: 'out-stockings', skirt: 'out-skirt', heels: 'out-heels', fur: 'out-fur', hearteyes: 'out-hearteyes', muscle: 'out-muscle'
  };
  function applyOutfit() {
    for (const id of Object.values(OUTFIT_SVG)) $(id).setAttribute('opacity', 0);
    $(OUTFIT_SVG[equipped.body]).setAttribute('opacity', 1);
    if (equipped.head) $(OUTFIT_SVG[equipped.head]).setAttribute('opacity', 1);
    if (equipped.feet) $(OUTFIT_SVG[equipped.feet]).setAttribute('opacity', 1);
    if (equipped.arms) $(OUTFIT_SVG[equipped.arms]).setAttribute('opacity', 1);
    if (equipped.pants) $(OUTFIT_SVG[equipped.pants]).setAttribute('opacity', 1);
    // роба и костюм крокодила закрывают ноги
    $('legs').setAttribute('opacity', (equipped.body === 'robe' || equipped.body === 'croc') && !equipped.feet ? 0.15 : 1);
  }
  function applyDecor() {
    for (const key in room) {
      const lvl = room[key];
      SLOTS[key].tiers.forEach((_, i) => {
        const el = $('room-' + key + '-' + i);
        if (!el) return;
        el.setAttribute('opacity', i === lvl ? 1 : 0);
        if (i === lvl) {
          const v = slotVariants(key)[decorVar[key + ':' + lvl] || 0];
          el.style.filter = v.f;
        }
      });
    }
    document.body.classList.toggle('lux', comfort >= 10);
  }
  function renderWardrobe() {
    document.querySelectorAll('button.buy[data-outfit]').forEach(btn => {
      const key = btn.dataset.outfit;
      const o = OUTFITS[key];
      btn.classList.remove('equipped', 'to-equip');
      if (!ownedOutfits[key]) {
        btn.textContent = o.cur === 'gems' ? `${o.price} ◆` : `${o.price} монет`;
        btn.disabled = o.cur === 'gems' ? state.gems < o.price : state.coins < o.price;
      } else if (equipped[o.slot] === key) {
        btn.textContent = o.slot === 'body' ? 'Надето' : 'Снять';
        btn.classList.add('equipped');
        btn.disabled = o.slot === 'body'; // тело всегда чем-то занято
      } else {
        btn.textContent = 'Надеть';
        btn.classList.add('to-equip');
        btn.disabled = false;
      }
    });
    renderProfileCards();
    if ($('profile-modal').classList.contains('open')) renderProfile();
  }
  function renderProfileCards() {
    document.querySelectorAll('button.buy[data-profile-card]').forEach(btn => {
      const key = btn.dataset.profileCard;
      const card = PROFILE_CARDS[key];
      btn.classList.toggle('equipped', profileCard === key);
      btn.classList.toggle('to-equip', !!ownedProfileCards[key] && profileCard !== key);
      if (!ownedProfileCards[key]) {
        btn.textContent = card.cur === 'gems' ? `${card.price} ◆` : `${card.price} монет`;
        btn.disabled = card.cur === 'gems' ? state.gems < card.price : state.coins < card.price;
      } else {
        btn.textContent = profileCard === key ? 'Выбрано' : 'Выбрать';
        btn.disabled = profileCard === key;
      }
    });
  }
  function renderProfile() {
    $('profile-nickname').textContent = displayName;
    $('profile-slave').textContent = slaveDisplayName();
    $('profile-card-name').textContent = 'Карточка: ' + PROFILE_CARDS[profileCard].name;
    $('profile-nickname-price').textContent = nicknameChanges ? 'Смена ника: 500 клятв' : 'Первая смена ника бесплатно';
    $('profile-card').className = 'profile-card' + (profileCard === 'plain' ? '' : ' card-' + profileCard);
    const avatar = pet.cloneNode(true);
    avatar.removeAttribute('id');
    avatar.removeAttribute('title');
    avatar.style.cssText = '';
    avatar.classList.add('profile-pet');
    avatar.querySelectorAll('[id]').forEach(element => {
      if (element.tagName.toLowerCase() !== 'filter') element.removeAttribute('id');
    });
    $('profile-avatar').replaceChildren(avatar);
  }
  document.querySelectorAll('button.buy[data-outfit]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (gone) { sfx.deny(); return; }
      const key = btn.dataset.outfit;
      const o = OUTFITS[key];
      if (!ownedOutfits[key]) {
        const can = o.cur === 'gems' ? state.gems >= o.price : state.coins >= o.price;
        if (!can) { sfx.deny(); return; }
        if (o.cur === 'gems') state.gems -= o.price; else state.coins -= o.price;
        ownedOutfits[key] = true;
        equipped[o.slot] = key;
        sfx.gem();
        burst(['▓', '▚', '✚'], 5);
        say(pick(ITEM_SAY[key] || ['Новая ткань. Принято.']));
      } else if (equipped[o.slot] === key && o.slot !== 'body') {
        equipped[o.slot] = null;
        sfx.coin();
        say('Снято.');
      } else {
        equipped[o.slot] = key;
        sfx.coin();
      }
      applyOutfit();
      render();
    });
  });
  document.querySelectorAll('button.buy[data-profile-card]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.profileCard;
      const card = PROFILE_CARDS[key];
      if (!ownedProfileCards[key]) {
        const can = card.cur === 'gems' ? state.gems >= card.price : state.coins >= card.price;
        if (!can) { sfx.deny(); return; }
        if (card.cur === 'gems') state.gems -= card.price; else state.coins -= card.price;
        ownedProfileCards[key] = true;
        sfx.gem();
      } else {
        sfx.coin();
      }
      profileCard = key;
      say('Карточка профиля обновлена.');
      render();
    });
  });

  /* ---------- лицо ---------- */
  const browL = $('brow-l'), browR = $('brow-r');
  const eyeL = $('eye-l'), eyeR = $('eye-r'), tears = $('tears'), mouth = $('mouth');
  const MOUTHS = {
    happy: 'M93 48 Q100 53 107 48',
    meh:   'M94 49 Q100 50 106 49',
    sad:   'M93 50 Q100 45 107 50',
    angry: 'M94 49.5 L106 49.5',
    eat:   'M95 47 Q100 56 105 47 Q100 50 95 47',
    squint:'M93 49 Q100 47 107 49',
    bold:  'M93 48 Q100 52.5 108 47'
  };
  const FACES = {
    happy:  { bl: 0,   br: 0,   o: 1,    s: 1 },
    meh:    { bl: 0,   br: 0,   o: 0.75, s: 0.6 },
    sad:    { bl: -10, br: 10,  o: 0.55, s: 0.8 },
    angry:  { bl: 14,  br: -14, o: 1,    s: 0.75 },
    eat:    { bl: 0,   br: 0,   o: 0.9,  s: 0.15 },
    squint: { bl: 10,  br: -10, o: 1,    s: 0.12 }
  };
  const STATUS = { happy: 'СТАБИЛЕН', meh: 'ВЯЛЫЙ', sad: 'ЛОМАЕТСЯ', angry: 'АГРЕССИВЕН' };
  let currentFace = 'happy';

  function setFace(f) {
    const m = FACES[f];
    currentFace = f;
    browL.setAttribute('transform', `rotate(${m.bl} 91 32)`);
    browR.setAttribute('transform', `rotate(${m.br} 109 32)`);
    eyeL.style.opacity = eyeR.style.opacity = m.o;
    eyeL.style.transform = eyeR.style.transform = `scaleY(${m.s})`;
    mouth.setAttribute('d', f === 'happy' && face === 'bold' ? MOUTHS.bold : MOUTHS[f]);
    tears.setAttribute('opacity', f === 'sad' ? 1 : 0);
  }
  function updateFace() {
    if (!onboardingComplete || gone) return;
    const avg = (clamp(state.food) + clamp(state.mood) + clamp(state.dignity)) / 3;
    let f = 'happy';
    if (avg < 25) f = 'sad';
    else if (avg < 55) f = 'meh';
    if (clamp(state.mood) < 25 && clamp(state.dignity) < 40) f = 'angry';
    setFace(f);
    statusText.textContent = STATUS[f];
  }

  /* ---------- реплики ---------- */
  let bubbleTimer;
  function say(text) {
    bubble.textContent = softenText(text);
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 2200);
  }

  /* ---------- частицы ---------- */
  function burst(symbols, count) {
    const arena = document.querySelector('.arena');
    const r = pet.getBoundingClientRect(), a = arena.getBoundingClientRect();
    const cx = r.left - a.left + r.width / 2, cy = r.top - a.top + r.height * 0.35;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'particle';
      p.textContent = pick(symbols);
      p.style.left = cx + (Math.random() * 120 - 60) + 'px';
      p.style.top = cy + (Math.random() * 40 - 20) + 'px';
      p.style.setProperty('--dx', (Math.random() * 140 - 70) + 'px');
      arena.appendChild(p);
      setTimeout(() => p.remove(), 1100);
    }
  }

  /* ---------- повреждения ---------- */
  const marksG = $('marks');
  const marks = [];
  function addMark(type) {
    if (marks.length >= 26) marks.shift().el.remove();
    const x = 74 + Math.random() * 52;
    const y = 62 + Math.random() * 82;
    let el, target;
    if (type === 'bruise') {
      el = document.createElementNS(SVGNS, 'ellipse');
      el.setAttribute('cx', x); el.setAttribute('cy', y);
      el.setAttribute('rx', 5 + Math.random() * 5); el.setAttribute('ry', 4 + Math.random() * 4);
      el.setAttribute('fill', 'rgb(96,44,130)');
      target = 0.5;
    } else if (type === 'lash') {
      el = document.createElementNS(SVGNS, 'line');
      el.setAttribute('x1', x - 10); el.setAttribute('y1', y - 7);
      el.setAttribute('x2', x + 10); el.setAttribute('y2', y + 7);
      el.setAttribute('stroke', '#ff2e2e'); el.setAttribute('stroke-width', '2');
      target = 0.85;
    } else if (type === 'scar') {
      el = document.createElementNS(SVGNS, 'path');
      el.setAttribute('d', `M${x - 7} ${y - 4} Q${x} ${y + 3} ${x + 7} ${y + 5} M${x - 3} ${y} l1.5 2.5 M${x + 2} ${y + 1} l1.5 2.5`);
      el.setAttribute('stroke', '#7e2a22'); el.setAttribute('stroke-width', '1.6');
      el.setAttribute('fill', 'none');
      target = 0.9; // шрам не исчезает
    } else {
      el = document.createElementNS(SVGNS, 'path');
      el.setAttribute('d', `M${x - 5} ${y - 3} l4 3 m2 -5 l4 4`);
      el.setAttribute('stroke', '#d77'); el.setAttribute('stroke-width', '1.2');
      el.setAttribute('fill', 'none');
      target = 0.7;
    }
    el.style.opacity = 0;
    marksG.appendChild(el);
    const m = { el, op: 0, target, scar: type === 'scar' };
    marks.push(m);
    requestAnimationFrame(() => { m.op = target; el.style.opacity = target; });
  }
  function healMarks(amount) {
    for (let i = marks.length - 1; i >= 0; i--) {
      const m = marks[i];
      if (m.scar) continue; // шрамы остаются навсегда
      m.op -= amount;
      if (m.op <= 0) { m.el.remove(); marks.splice(i, 1); }
      else m.el.style.opacity = m.op;
    }
  }

  /* ---------- анимация действия ---------- */
  let actTimer;
  function act(cls, face_, restoreIn) {
    pet.classList.remove('act-eat', 'act-hit', 'act-shame');
    void pet.offsetWidth;
    pet.classList.add(cls);
    if (face_) setFace(face_);
    clearTimeout(actTimer);
    actTimer = setTimeout(() => { pet.classList.remove(cls); render(); }, restoreIn);
  }

  /* ---------- глитч ---------- */
  function glitch() {
    const gl = $('glitch');
    gl.classList.remove('on');
    void gl.offsetWidth;
    gl.classList.add('on');
  }

  /* ---------- редкий фетиш ---------- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function maybeRareModal() {
    if (!rareFetish || gone) return;
    const t = $('rare-text');
    if (fetish === 'Лохматый') {
      state.gems += 10;
      t.innerHTML = 'Подопытный оказался <b style="color:#d4af37">ЛОХМАТЫМ</b>.<br>«' + pick(['Он линяет. Ковры в ужасе.', 'Гребень в камеру не пронесли — и зря.']) + '»<br><br>Шерсть сдана на войлок: <b>+10 клятв</b>.<br>Бритьё снимает вдвое больше достоинства (+40), но щетина не отступает сама.';
    } else {
      state.coins += 500;
      t.innerHTML = 'Подопытный оказался <b style="color:#d4af37">ТУАЛЕТНЫМ</b>.<br>«' + pick(['Он спросил, где тут… удобства. Мы промолчали.', 'Он назвал ведро троном. Никто не спорил.']) + '»<br><br>Он отмыл прошлую камеру до блеска: <b>+500 монет</b>.<br>Грязь его веселит, роскошь — давит.';
    }
    openModal('rare-modal');
    render();
  }
  $('btn-rare-ok').addEventListener('click', () => { sfx.coin(); closeModal('rare-modal'); });

  /* ---------- Госпожа: покупка ---------- */
  function applyMistress() {
    for (let i = 1; i <= 3; i++) {
      const g = $('room-mistress-' + i);
      if (g) g.setAttribute('opacity', mistressLevel === i ? '1' : '0');
    }
    const btn = $('btn-mistress');
    const next = MISTRESS[mistressLevel + 1];
    if (btn) {
      btn.textContent = next ? next.p + ' ◆' : 'Максимум';
      btn.disabled = !next;
    }
    const md = $('mistress-desc');
    if (md) md.textContent = mistressLevel > 0
      ? MISTRESS[mistressLevel].n + '. Задания выдаются постоянно'
      : 'Живая. Только за клятвы. Даёт постоянные задания';
  }
  $('btn-mistress').addEventListener('click', () => {
    sfx.coin();
    const next = MISTRESS[mistressLevel + 1];
    if (!next) { say('Госпожа: Дальше — только богини. А они не продаются.'); return; }
    if (state.gems < next.p) { say('Госпожа: Клятв не хватает. Приходи, когда разбогатеешь.'); return; }
    state.gems -= next.p; mistressLevel++;
    applyMistress(); render();
    if (mistressLevel === 1) {
      say('Госпожа: Так. Где он?.. Ах вот. Ну и видок. Ладно, работаем.');
      newMistressQuest();
    } else if (mistressLevel === 2) {
      say('Госпожа: Повышение. Теперь я здесь почти живу. Радуйся.');
    } else {
      say('Госпожа: Владычица не просит. Владычица ставит задачи.');
    }
  });

  /* ---------- список заданий ---------- */
  $('btn-quests').addEventListener('click', () => { sfx.coin(); renderQuests(); openModal('quests-modal'); });
  function renderQuests() {
    const qd = $('q-daily');
    if (!qd) return;
    const qdef = questDef();
    const qprog = qdef.ev === 'collarTime'
      ? Math.floor(quest.progress / 60) + '/' + (qdef.target / 60) + ' мин'
      : Math.min(quest.progress, qdef.target) + '/' + qdef.target;
    qd.innerHTML = '<div class="q-row' + (quest.done ? ' q-done' : '') + '"><span>' + esc(qdef.text) + '</span><b>' +
      (quest.done ? '+10 ◆ получено' : qprog + ' · 10 ◆') + '</b></div>';
    $('q-weekly').innerHTML = weekly.quests.map(q => {
      const def = weeklyDef(q.id);
      const status = q.failed ? '<b class="q-fail">ПРОВАЛЕНО</b>'
        : q.done ? '<b>+' + def.reward + ' ◆ получено</b>'
        : '<b>' + (def.special === 'survive' ? 'идёт' : q.progress + '/' + def.target) + ' · ' + def.reward + ' ◆</b>';
      return '<div class="q-row' + (q.done ? ' q-done' : q.failed ? ' q-failed' : '') + '"><span>' + esc(def.text) + '</span>' + status + '</div>';
    }).join('');
    const def = mquestDef();
    $('q-mistress').innerHTML = mistressLevel < 1
      ? '<div class="q-row"><span>Нет Госпожи. Купите её в обстановке — появятся постоянные задания.</span></div>'
      : def
        ? '<div class="q-row"><span>' + esc(def.text) + '</span><b>' + mquest.progress + '/' + def.target + ' · ' + def.reward + ' ◆</b></div>'
        : '<div class="q-row"><span>Госпожа обдумывает следующее задание…</span></div>';
  }

  /* ================= СМЕРТЬ / ПОБЕГ / НОВЫЙ РАБ ================= */
  function checkDeath() {
    if (gone || state.hp > 0.5) return;
    gone = true;
    slaveEndReason = 'death';
    slaveEndedAt = Date.now();
    slavesKilled++;
    oldestSlaveAgeDays = Math.max(oldestSlaveAgeDays, currentSlaveAgeDays());
    scheduleSave(true);
    // недельное выживание провалено до следующей недели
    for (const q of weekly.quests) {
      if (q.id === 'wsurvive' && !q.done && !q.failed) { q.failed = true; saveWeekly(); }
    }
    // ответственность за смерть: накопленный комфорт брошен
    for (const k in room) room[k] = 0;
    comfort = 0;
    applyDecor();
    pet.classList.add('dead');
    glitch();
    sfx.revolt();
    setTimeout(() => openModal('death'), 1000);
    render();
  }

  function checkEscape() {
    if (!onboardingComplete || gone) return;
    // пояс срабатывает как предохранитель
    if (beltLevel > 0 && !beltBroken && state.aggr >= BELT[beltLevel].cap) {
      beltBroken = true;
      state.aggr = BELT[beltLevel].cap * 0.4;
      if (fetish === 'Пояс верности') state.aggr += 15; // фетиш: поломка пояса взрывает агрессию
      sfx.chain();
      say('Пояс послушания не выдержал и сломался!');
      glitch();
      render();
      return;
    }
    if (state.aggr >= 100) {
      gone = true;
      slaveEndReason = 'escape';
      slaveEndedAt = Date.now();
      oldestSlaveAgeDays = Math.max(oldestSlaveAgeDays, currentSlaveAgeDays());
      scheduleSave(true);
      sfx.chain();
      sfx.revolt();
      glitch();
      $('evil-face').setAttribute('opacity', 1);
      // разрыв цепей
      document.querySelectorAll('.chain').forEach((c, i) => {
        c.style.setProperty('--bx', (i % 2 ? 30 : -30) + 'px');
        c.classList.add('chain-break');
      });
      const stolen = Math.min(state.coins, Math.max(5, Math.round(state.coins * 0.3)));
      state.coins -= stolen;
      const escapeHtml = `Агрессия достигла предела. Оковы разорваны.<br>Он <b>украл ${stolen} монет</b> и растворился во тьме.`;
      $('escape-text').dataset.uncensored = escapeHtml;
      $('escape-text').innerHTML = censorshipOn
        ? `Слуга завершил обучение и унёс <b>${stolen} монет</b>.`
        : escapeHtml;
      pet.classList.add('escape');
      setTimeout(() => openModal('escape-modal'), 1100);
      render();
    }
  }

  function newSlave() {
    oldestSlaveAgeDays = Math.max(oldestSlaveAgeDays, currentSlaveAgeDays());
    slaveNo++;
    slaveUid = newSlaveUid();
    fetish = rollFetish();
    gone = false;
    slaveBornAt = Date.now();
    slaveEndedAt = null;
    slaveEndReason = null;
    setTimeout(maybeRareModal, 900);
    dossierUnlocked = false; petClicks = 0; // новый подопытный — новое досье
    spiritBroken = false; // и новый дух
    state = Object.assign(freshState(), { coins: state.coins, gems: state.gems });
    slaveBody = rollBody(); // новый подопытный — новое тело
    applyBody();
    opLabel();
    resetSlaveGear();
    // сброс визуала
    pet.classList.remove('dead', 'escape', 'kneel');
    ['collar', 'gag', 'gear-whip', 'handcuffs', 'shackles', 'evil-face'].forEach(id => $(id).setAttribute('opacity', 0));
    document.querySelectorAll('.chain').forEach(c => c.classList.remove('chain-break'));
    document.querySelectorAll('button.buy[data-item]').forEach(btn => {
      btn.textContent = btn.dataset.price + ' монет';
      btn.classList.remove('owned');
    });
    marks.splice(0).forEach(() => {});
    marksG.innerHTML = '';
    applyOutfit();
    $('slave-no').textContent = padNo();
    $('scene-slave-tag').textContent = slaveDisplayName();
    closeModal('death'); closeModal('escape-modal');
    say(`Подопытный ${padNo()} доставлен. Склонность неизвестна — изучите его.`);
    sfx.gem();
    render();
  }
  $('btn-new-death').addEventListener('click', newSlave);
  $('btn-new-escape').addEventListener('click', newSlave);

  /* ================= ДЕЙСТВИЯ ================= */
  $('btn-feed').addEventListener('click', () => {
    if (gone) { sfx.deny(); return; }
    const overfed = state.food > 85; // перекорм: вредит и злит
    if (overfed) {
      state.hp -= 4;
      state.food = Math.min(120, state.food + 5);
      state.mood -= 5; state.dignity -= 2;
      addAggr(6);
      act('act-eat', 'sad', 900);
      sfx.munch(); sfx.shame();
      btnMelody([4, 2], 0.16, 0.09);
      burst(['▚', '✕', '▓'], 5);
      say(pick(phrases.overfeed));
      render();
      checkDeath(); checkEscape();
      return;
    }
    // кормёжка — не палочка-выручалочка: лечит слабо, агрессию почти не трогает
    state.hp += 5; state.food += 14; state.mood += 3; state.dignity += 4;
    calm(2);
    healMarks(0.25);
    act('act-eat', 'eat', 800);
    sfx.munch();
    btnMelody([0, 2, 3], 0.14, 0.09);
    burst(['▚', '▞', '✚', '▓'], 6);
    questProgress('feed', 1);
    // редкая находка: клятва при кормлении
    if (Math.random() < 0.005) {
      state.gems += 1;
      sfx.gem();
      burst(['◆'], 4);
      say('Он проглотил клятву вместе с едой. +1 клятва.');
    } else {
      say(pick(phrases.feed) + (comfort >= 10 ? ' Спасибо, госпожа.' : comfort >= 4 ? ' Благодарю вас.' : ''));
    }
    render();
    checkEscape();
  });

  $('btn-hit').addEventListener('click', () => {
    if (gone) { sfx.deny(); return; }
    const pain = fetish === 'Боль'; // хрупкое тело: урон ×1.5, но агрессии меньше
    state.hp -= (pain ? 7.5 : 5) * dmgFactor();
    state.mood -= 14; state.food -= 4; state.dignity -= 3;
    state.fear += 10; state.obed -= 3;
    baseMult += 0.01;
    addAggr(pain ? 2.5 : 5);
    addMark('bruise');
    questProgress('hit', 1);
    act('act-hit', 'squint', 650);
    sfx.thud();
    btnMelody([0], 0, 0.16); btnMelody([0], STEP / 4, 0.07); // глухая низкая D
    burst(['✕', '✖', '◢', '▓'], 5);
    say(pick(phrases.hit));
    render();
    checkDeath(); checkEscape();
  });

  $('btn-shame').addEventListener('click', () => {
    if (gone) { sfx.deny(); return; }
    const shameFetish = fetish === 'Унижение';
    state.dignity -= 15; state.mood -= 8;
    state.fear += 4; state.obed += 6;
    baseMult += shameFetish ? 0.02 : 0.01; // фетиш «Унижение»: двойной прирост дани
    addAggr(shameFetish ? 6 : 3);          // но агрессия тоже вдвое
    addMark('scratch');
    questProgress('shame', 1);
    act('act-shame', 'sad', 1300);
    sfx.shame();
    btnMelody([4, 3, 1], STEP, 0.08, 'sine'); // нисходящая жалоба
    burst(['░', '▒', '░'], 5);
    say(pick(phrases.shame));
    render();
    checkEscape();
  });

  $('btn-whip').addEventListener('click', () => {
    if (gone) { sfx.deny(); return; }
    // достоинство = цена труда. Дух сломлен (достоинство падало в 0) — премии нет
    const pain = fetish === 'Боль';
    const dignityFactor = spiritBroken ? 0.5 : 0.5 + clamp(state.dignity) / 100;
    let gain = Math.max(2, Math.round(4 * totalMult() * comfortMult() * dignityFactor));
    if (pain) gain = Math.round(gain * 1.5); // фетиш «Боль»: порка доходнее
    state.hp -= (pain ? 7.5 : 5) * dmgFactor();
    state.dignity -= 8; state.mood -= 3; state.fear += 6;
    state.coins += gain;
    addAggr(pain ? 2 : 4);
    addMark('lash');
    questProgress('whip', 1);
    act('act-hit', 'squint', 650);
    sfx.crack();
    btnMelody([5, 2], STEP / 2, 0.1); // щелчок с коротким отзвуком
    setTimeout(sfx.coin, 250);
    burst(['¤', '✕', '▓'], 5);
    questProgress('earnCoins', gain);
    say(`+${gain} монет. ${pick(phrases.whip)}`);
    render();
    checkDeath(); checkEscape();
  });

  /* ---------- сцена «Потакание» ---------- */
  const FETISH_SUB = {
    'Пояс верности': 'Он просит проверить замок. Тяга к ограничению.',
    'Оковы':         'Он просится в цепи. Странная тяга к ограничениям.',
    'Унижение':      'Он ждёт тяжёлых слов. Они для него — награда.',
    'Футфетиш':      'Он не сводит глаз с ваших сапог.',
    'Боль':          'Он вздрагивает — и просит не останавливаться.',
    'Лохматый':      'Он ластится к бритве. Шерсть для него — тюрьма.',
    'Туалетный':     'Он прижался к ведру. Чистота его пугает.'
  };
  const SCENE_ART = { 'Пояс верности': 'belt', 'Оковы': 'chains', 'Унижение': 'shame', 'Футфетиш': 'foot', 'Боль': 'whip', 'Лохматый': 'shame', 'Туалетный': 'shame' };
  // результат потакания зависит от склонности
  const INDULGE_FX = {
    'Пояс верности': {
      obed: 22, mood: 6, fear: 4, aggr: 7, dignity: 6, need: 25,
      ok: 'Замок щёлкнул. Он выдохнул с облегчением.',
      gem: 'Он клянётся в верности через замок. +1 клятва.'
    },
    'Оковы': {
      obed: 15, mood: 8, fear: 8, aggr: 6, dignity: 6, need: 25,
      ok: 'Цепи затянуты. Он благодарно кивает.',
      gem: 'Клятва прозвучала сквозь звон оков. +1 клятва.'
    },
    'Унижение': {
      obed: 18, mood: 11, fear: 0, aggr: 12, dignity: -6, need: 25,
      ok: 'Тяжёлые слова приняты как награда.',
      gem: 'Он клянётся, стоя на коленях. +1 клятва.'
    },
    'Футфетиш': {
      obed: 16, mood: 14, fear: 0, aggr: 8, dignity: 6, need: 50,
      ok: 'Он не сводит глаз с сапог и млеет.',
      gem: 'Клятва прошептана в пол. +1 клятва.'
    },
    'Боль': {
      obed: 12, mood: 9, fear: 10, aggr: 5, dignity: 6, need: 25,
      ok: 'Он вздрагивает — и благодарит.',
      gem: 'Клятва сквозь стиснутые зубы. +1 клятва.'
    }
  };
  const KICK_SAY = {
    'Пояс верности': 'Замок дребезжит от удара. Урок усвоен.',
    'Оковы':         'Цепи гремят. Урок усвоен.',
    'Унижение':      'Он сглатывает удар, как очередную награду.',
    'Футфетиш':      'Он падает — и любуется сапогом снизу.',
    'Боль':          'Он шипит от удара и тянется за следующим.'
  };
  $('btn-indulge').addEventListener('click', () => {
    if (gone) { sfx.deny(); return; }
    if (Date.now() < indulgeCdUntil) { sfx.deny(); say('Он ещё не пришёл в себя. Подождите.'); return; }
    // без досье склонность — догадка по картинке, название скрыто
    $('indulge-title').textContent = dossierUnlocked ? 'ПОТАКАНИЕ · ' + fetish.toUpperCase() : 'ПОТАКАНИЕ';
    $('indulge-sub').textContent = dossierUnlocked ? FETISH_SUB[fetish] : 'Он смотрит с обожанием. Чего он ждёт — пока неясно.';
    for (const k of ['foot', 'belt', 'chains', 'shame', 'whip']) $('scene-art-' + k).setAttribute('opacity', k === SCENE_ART[fetish] ? 1 : 0);
    $('indulge-modal').classList.add('art-' + SCENE_ART[fetish]);
    openModal('indulge-modal');
    sfx.gem();
  });

  $('scene-kick').addEventListener('click', () => {
    closeModal('indulge-modal');
    indulgeCdUntil = Date.now() + 12000;
    state.hp -= (fetish === 'Боль' ? 10.5 : 7) * dmgFactor();
    state.fear += 15; state.obed -= 8; state.mood -= 6;
    baseMult += 0.01;
    addAggr(8);
    addMark('bruise'); addMark('bruise');
    act('act-hit', 'squint', 700);
    sfx.thud();
    btnMelody([1, 0], STEP / 2, 0.14);
    burst(['✕', '▓', '◢'], 6);
    say(KICK_SAY[fetish] || 'Урок усвоен.');
    render();
    checkDeath(); checkEscape();
  });

  /* ---------- оригинальные чиптюн-треки мини-игр ---------- */
  const MG_TRACKS = {
    'Футфетиш': { bpm: 144, wave: 'square', bassWave: 'triangle',
      riff: [0, null, 7, 12, null, 10, 7, null, 5, 7, null, 15, 12, null, 10, 7],
      bass: [0, 0, 7, 0, 5, 0, 7, 10, 0, 0, 12, 0, 5, 7, 10, 7] },
    'Оковы': { bpm: 152, wave: 'square', bassWave: 'sawtooth',
      riff: [0, 0, null, 3, 0, null, 5, 3, 2, null, 0, 7, null, 5, 3, 2],
      bass: [0, 0, 0, 12, 0, 0, 10, 0, 0, 12, 0, 0, 10, 7, 10, 12] },
    'Унижение': { bpm: 132, wave: 'square', bassWave: 'triangle', stacc: true,
      riff: [12, null, 10, 7, null, 12, 0, null, 10, 7, 5, null, 3, 5, 7, 10],
      bass: [0, 7, 0, 7, 0, 7, 5, 7, 0, 7, 10, 7, 0, 5, 7, 3] },
    'Боль': { bpm: 168, wave: 'sawtooth', bassWave: 'square', stacc: true,
      riff: [0, 12, null, 0, 10, 12, 13, null, 12, 0, 15, null, 13, 12, 10, 7],
      bass: [0, 0, 12, 0, 0, 12, 10, 0, 0, 12, 0, 13, 12, 10, 7, 6] },
    'Пояс верности': { bpm: 156, wave: 'square', bassWave: 'triangle',
      riff: [0, 5, 7, null, 12, 10, 7, 5, 3, null, 7, 10, 12, null, 15, 19],
      bass: [0, 0, 5, 0, 0, 3, 0, 5, 0, 5, 7, 0, 7, 5, 3, 0] },
    'Лохматый': { bpm: 150, wave: 'square', bassWave: 'square',
      riff: [7, null, 5, 3, 5, 7, null, 10, 7, 5, null, 12, 10, 7, 5, 3],
      bass: [0, 7, 0, 7, 5, 7, 10, 7, 0, 7, 12, 7, 12, 10, 7, 5] },
    'Туалетный': { bpm: 146, wave: 'triangle', bassWave: 'square',
      riff: [0, 3, null, 7, 3, null, 10, 7, 3, 0, null, 12, 10, 7, 3, 2],
      bass: [0, 0, 10, 0, 7, 0, 5, 0, 0, 10, 0, 7, 5, 3, 2, 0] },
    '_default': { bpm: 152, wave: 'square', bassWave: 'triangle',
      riff: [0, null, 3, 5, 7, null, 10, 7, 5, 3, 0, null, 12, 10, 7, 5],
      bass: [0, 0, 12, 0, 0, 10, 0, 7, 0, 12, 0, 10, 0, 7, 5, 3] }
  };
  const mgFreq = (semi, base) => base * Math.pow(2, semi / 12);
  function mgPlayStep(step, t) {
    const music = mgMusic;
    if (!music) return;
    const tr = music.track;
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const section = bar % 4;
    const lift = [0, 2, 5, 7][section];
    const energy = Math.min(1, (Date.now() - music.startedAt) / 14000 + music.boost);
    const dur = music.stepDur;
    if ([0, 3, 6, 8, 11, 14].includes(s)) {
      pluck(mgFreq(tr.bass[s] + lift - (bar % 2 === 1 && s === 14 ? 2 : 0), 73.42), t, dur * 1.5, 0.17, tr.bassWave);
    }
    if (s % 4 === 0 || (energy > 0.55 && s === 14)) drumKick(t, s === 0 ? 0.46 : 0.36);
    if (s === 4 || s === 12 || (section === 3 && energy > 0.65 && s % 4 === 2)) drumSnare(t, 0.27 + energy * 0.08);
    if (s % 2 === 0 || energy > 0.45) drumHat(t, s % 4 === 2 ? 0.1 : 0.06);
    const note = tr.riff[s];
    if (note !== null) {
      pluck(mgFreq(note + lift, 293.66), t, dur * (tr.stacc ? 0.65 : 1.35), 0.1, tr.wave);
      if (energy > 0.35 && s % 4 === 2) pluck(mgFreq(note + lift + 7, 293.66), t, dur * 0.9, 0.04, 'square');
    }
    if (energy > 0.7 && s % 2 === 1) pluck(mgFreq((tr.riff[(s + 3) % 16] ?? 12) + lift, 587.33), t, dur * 0.7, 0.035, 'triangle');
    if (section >= 2 && s % 2 === 0) {
      const ascent = [0, 4, 7, 12][(s / 2) % 4];
      pluck(mgFreq(ascent + lift, 587.33), t, dur * 1.1, section === 3 ? 0.055 : 0.035, 'triangle');
    }
    if (section === 3 && s >= 12) drumTom(t, 0.12 + (s - 12) * 0.035);
    if (section === 0 && bar > 0 && s === 0) {
      [0, 4, 7, 12].forEach((semi, i) => pluck(mgFreq(semi, 293.66), t + i * dur, dur * 2.4, 0.075, 'triangle'));
    }
  }
  function startMgMusic() {
    if (!soundOn || document.hidden) return;
    const ctx = audio();
    const track = MG_TRACKS[fetish] || MG_TRACKS._default;
    mgMusic = { step: 0, next: ctx.currentTime + 0.06, timer: null, track, stepDur: 60 / track.bpm / 4, startedAt: Date.now(), boost: 0 };
    mgMusic.timer = setInterval(() => {
      if (!mgMusic || !soundOn || document.hidden) return;
      const c2 = audio();
      while (mgMusic.next < c2.currentTime + 0.16) {
        mgPlayStep(mgMusic.step, mgMusic.next);
        mgMusic.step++; mgMusic.next += mgMusic.stepDur;
      }
    }, 40);
  }
  function stopMgMusic() { if (mgMusic) { clearInterval(mgMusic.timer); mgMusic = null; } }

  /* ---------- мини-игры «Потакания»: у каждого фетиша своя ---------- */
  function mgBeat() { return 60000 / (mgMusic ? mgMusic.track.bpm : 96); }
  const MG_TEXT = {
    'Футфетиш': 'Соедини языки с пальцами Госпожи по цветам.',
    'Оковы': 'Кликай, когда цепь пролетает нижнюю точку.',
    'Унижение': 'Повторяй за Госпожой. Слово в слово, быстро.',
    'Боль': 'Останови иглу в багровой зоне. Он считает.',
    'Пояс верности': 'Поворачивай ключ, когда стрелка входит в зелёный паз.',
    'Лохматый': 'Сбривай клоки, пока не отросли. Бритва не ждёт.',
    'Туалетный': 'Оттирай пятна трением. До блеска.'
  };
  let mg = null;
  function mgFloat(text, bad) {
    const f = document.createElement('div');
    f.className = 'mg-float' + (bad ? ' bad' : '');
    f.textContent = text;
    f.style.left = (38 + Math.random() * 24) + '%';
    $('mg-floats').appendChild(f);
    setTimeout(() => f.remove(), 850);
  }
  function mgScore(kind, label) {
    if (!mg) return;
    mg[kind]++;
    if (mgMusic && kind !== 'miss') mgMusic.boost = Math.min(0.55, mgMusic.boost + (kind === 'perfect' ? 0.12 : 0.06));
    if (kind === 'perfect') {
      mgFloat(label || '+2 · ИДЕАЛЬНО');
      const st = $('mg-stage');
      st.classList.remove('mg-perfect'); void st.offsetWidth; st.classList.add('mg-perfect');
      tone(1568, 1568, 0.06, 'sine', 0.16); tone(2093, 2093, 0.09, 'sine', 0.12, 0.05);
    } else if (kind === 'good') {
      mgFloat(label || '+1');
      tone(1046, 1046, 0.06, 'sine', 0.12);
    } else {
      mgFloat(label || 'мимо', true);
      tone(180, 120, 0.09, 'sine', 0.1);
    }
    $('mg-mult').textContent = '×' + (1 + Math.min(1, mg.perfect * 0.2)).toFixed(1);
  }
  function mgSetupRhythm() {
    const art = SCENE_ART[fetish] || 'shame';
    $('mg-art').innerHTML = $('scene-art-' + art).innerHTML;
    const st = $('mg-stage');
    st.classList.remove('mg-live'); void st.offsetWidth; st.classList.add('mg-live');
  }

  /* Футфетиш: «провода» как в Among Us — языки к пальцам по цветам */
  const MG_TONGUE_SVG = `<svg viewBox="0 0 64 32" aria-hidden="true">
    <ellipse class="mgw-socket" cx="10" cy="16" rx="9" ry="12" fill="WIRE"/>
    <path d="M8 8 C20 4 44 6 56 12 C62 15 62 19 56 22 C44 28 20 28 8 24 Z" fill="#e06a7a"/>
    <path d="M14 16 L52 16" stroke="rgba(120,20,30,0.55)" stroke-width="1.6" fill="none"/>
    <ellipse cx="52" cy="14.5" rx="4" ry="2.4" fill="rgba(255,255,255,0.35)"/>
  </svg>`;
  const MG_FOOT_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
    <path d="M40 8 C60 0 80 10 87 28 C93 44 90 62 80 75 C71 87 56 93 44 89 C35 86 28 79 24 70 C20 59 19 45 21 33 C23 19 30 11 40 8 Z" fill="#e2ac7f"/>
    <path d="M44 15 C58 9 74 17 80 31 C85 44 82 60 74 70 C66 80 54 84 45 80 C38 77 32 71 29 64 C25 54 24 43 26 33 C28 22 34 18 44 15 Z" fill="rgba(0,0,0,0.08)"/>
    <ellipse cx="18" cy="12" rx="8.5" ry="9.5" fill="#e2ac7f" stroke="rgba(140,70,40,0.45)" stroke-width="1.2"/>
    <ellipse cx="11" cy="36" rx="8" ry="9.5" fill="#e2ac7f" stroke="rgba(140,70,40,0.45)" stroke-width="1.2"/>
    <ellipse cx="11" cy="60" rx="8" ry="9.5" fill="#e2ac7f" stroke="rgba(140,70,40,0.45)" stroke-width="1.2"/>
    <ellipse cx="17" cy="84" rx="8.5" ry="9.5" fill="#e2ac7f" stroke="rgba(140,70,40,0.45)" stroke-width="1.2"/>
    <ellipse class="mgw-nail" cx="11" cy="11.5" rx="4.4" ry="5" fill="#888"/>
    <ellipse class="mgw-nail" cx="4.5" cy="35.5" rx="4" ry="4.8" fill="#888"/>
    <ellipse class="mgw-nail" cx="4.5" cy="59.5" rx="4" ry="4.8" fill="#888"/>
    <ellipse class="mgw-nail" cx="10" cy="83.5" rx="4.4" ry="4.8" fill="#888"/>
    <path d="M80 11 C86 15 90 21 92 28" stroke="#ffd76a" stroke-width="2.4" fill="none" opacity="0.8"/>
  </svg>`;
  const MG_WIRE_COLORS = ['#ff4d4d', '#4da6ff', '#ffd94d', '#59d977', '#c77dff'];
  const MG_TOE_POS = [[-2, -1], [-8.5, 23], [-8.5, 47], [-3, 69.5]]; // % внутри .mgw-foot
  function mgSetupFoot(play) {
    play.innerHTML = `<div class="mg-note">Соедини по цветам</div>
      <svg class="mgw-lines" id="mgw-lines"></svg>
      <div class="mgw-foot">${MG_FOOT_SVG}` +
      MG_TOE_POS.map((p, i) => `<button type="button" class="mgw-toe" data-i="${i}" style="left:${p[0]}%;top:${p[1]}%"></button>`).join('') +
      `</div><div id="mgw-plugs"></div>`;
    const plugHost = play.querySelector('#mgw-plugs');
    const lines = play.querySelector('#mgw-lines');
    const toes = [...play.querySelectorAll('.mgw-toe')];
    let sel = null, connected = 0;
    function newRound() {
      if (!mg) return;
      connected = 0; sel = null;
      lines.innerHTML = ''; plugHost.innerHTML = '';
      const cols = [...MG_WIRE_COLORS].sort(() => Math.random() - 0.5).slice(0, 4);
      const toeCols = [...cols].sort(() => Math.random() - 0.5);
      play.querySelectorAll('.mgw-nail').forEach((n, i) => n.setAttribute('fill', toeCols[i]));
      toes.forEach((t, i) => { t.classList.remove('done'); t.dataset.color = toeCols[i]; t.style.setProperty('--tc', toeCols[i]); });
      cols.forEach((col, i) => {
        const b = document.createElement('button');
        b.className = 'mgw-plug'; b.type = 'button';
        b.style.top = (12 + i * 21) + '%'; b.style.color = col; b.dataset.color = col;
        b.innerHTML = MG_TONGUE_SVG.replace(/WIRE/g, col);
        b.addEventListener('click', ev => {
          ev.stopPropagation();
          if (!mg || b.classList.contains('done')) return;
          play.querySelectorAll('.mgw-plug.sel').forEach(x => x.classList.remove('sel'));
          sel = b; b.classList.add('sel');
          tone(700, 700, 0.05, 'triangle', 0.1);
        });
        plugHost.appendChild(b);
      });
    }
    toes.forEach(t => t.addEventListener('click', ev => {
      ev.stopPropagation();
      if (!mg || !sel || t.classList.contains('done')) return;
      if (t.dataset.color === sel.dataset.color) {
        const pr = play.getBoundingClientRect();
        const r1 = sel.getBoundingClientRect(), r2 = t.getBoundingClientRect();
        const x1 = r1.right - pr.left - 6, y1 = r1.top + r1.height / 2 - pr.top;
        const x2 = r2.left + r2.width / 2 - pr.left, y2 = r2.top + r2.height / 2 - pr.top;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${x1} ${y1} C ${x1 + 30} ${y1 - 22}, ${x2 - 36} ${y2 + 22}, ${x2} ${y2}`);
        path.setAttribute('stroke', sel.dataset.color);
        path.setAttribute('stroke-width', '4'); path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round'); path.setAttribute('opacity', '0.92');
        lines.appendChild(path);
        sel.classList.add('done'); sel.classList.remove('sel');
        t.classList.add('done');
        sel = null; connected++;
        mgScore('perfect');
        if (connected === 4) {
          mgFloat('ВСЕ ПРОВОДА!');
          if (10000 - (performance.now() - mg.t0) > 2500) mg.timers.push(setTimeout(newRound, 500));
        }
      } else {
        mgScore('miss', 'не тот цвет');
        sel.classList.remove('sel'); sel = null;
        t.classList.add('mgw-shake'); setTimeout(() => t.classList.remove('mgw-shake'), 260);
      }
    }));
    newRound();
  }

  const mobileRendering = window.matchMedia('(max-width: 700px), (hover: none) and (pointer: coarse)');
  function startGameAnimation(update) {
    let raf = 0, lastTime = -Infinity;
    function frame(time) {
      if (!mg) return;
      const interval = mobileRendering.matches ? 1000 / 30 : 0;
      if (time - lastTime >= interval) {
        update();
        lastTime = time;
      }
      raf = requestAnimationFrame(frame);
    }
    frame(0);
    return () => cancelAnimationFrame(raf);
  }

  /* Оковы: маятник цепи — клик в нижней точке */
  const MG_CHAIN_SVG = `<svg viewBox="0 0 32 120" aria-hidden="true">
    <g fill="none" stroke="#8d929e" stroke-width="3.2">
      <ellipse cx="16" cy="8" rx="4.5" ry="7"/>
      <ellipse cx="16" cy="21" rx="4.5" ry="7" transform="rotate(90 16 21)"/>
      <ellipse cx="16" cy="34" rx="4.5" ry="7"/>
      <ellipse cx="16" cy="47" rx="4.5" ry="7" transform="rotate(90 16 47)"/>
      <ellipse cx="16" cy="60" rx="4.5" ry="7"/>
      <ellipse cx="16" cy="73" rx="4.5" ry="7" transform="rotate(90 16 73)"/>
      <ellipse cx="16" cy="86" rx="4.5" ry="7"/>
    </g>
    <rect x="7" y="98" width="18" height="15" rx="4" fill="#3a3f4a" stroke="#8d929e" stroke-width="2"/>
    <circle cx="16" cy="105.5" r="2.4" fill="#12141a"/>
  </svg>`;
  function mgSetupChains(play) {
    play.innerHTML = `<div class="mg-note">Кликай в нижней точке</div>
      <div class="mgc-pivot"><div class="mgc-chain" id="mgc-chain">${MG_CHAIN_SVG}</div></div>
      <div class="mgc-zone"></div>`;
    const chain = play.querySelector('#mgc-chain');
    const t0 = performance.now();
    const PERIOD = 950;
    const angle = () => 30 * Math.sin((performance.now() - t0) / PERIOD * Math.PI * 2);
    const stopAnimation = startGameAnimation(() => {
      chain.style.transform = `rotate(${angle()}deg)`;
    });
    play.addEventListener('pointerdown', e => {
      if (!mg) return;
      e.preventDefault();
      const a = Math.abs(angle());
      if (a < 6.5) mgScore('perfect');
      else if (a < 14) mgScore('good');
      else mgScore('miss');
    }, { signal: mg.ac.signal });
    return stopAnimation;
  }

  /* Унижение: повтори слово за Госпожой */
  const MG_SHAME_WORDS = ['ПРОШУ', 'ГОСПОЖА', 'НИЖЕ', 'ВИНОВАТ', 'ПОЗОР', 'РАБ', 'ТИШЕ', 'МОЛЮ'];
  function mgSetupShame(play) {
    play.innerHTML = `<div class="mgs-label">ПОВТОРИ ЗА НЕЙ</div>
      <div class="mgs-target" id="mgs-target"></div>
      <div class="mgs-opts" id="mgs-opts"></div>`;
    const target = play.querySelector('#mgs-target');
    const opts = play.querySelector('#mgs-opts');
    function round() {
      if (!mg) return;
      const word = MG_SHAME_WORDS[Math.floor(Math.random() * MG_SHAME_WORDS.length)];
      target.textContent = '«' + word + '»';
      opts.innerHTML = '';
      const others = MG_SHAME_WORDS.filter(w => w !== word).sort(() => Math.random() - 0.5).slice(0, 2);
      [word, ...others].sort(() => Math.random() - 0.5).forEach(w => {
        const b = document.createElement('button');
        b.className = 'mgs-opt'; b.type = 'button'; b.textContent = w;
        b.addEventListener('click', ev => {
          ev.stopPropagation();
          if (!mg) return;
          if (w === word) { mgScore('perfect', '+2 · ПОВТОРИЛ'); mg.timers.push(setTimeout(round, 130)); }
          else { mgScore('miss', 'не то слово'); b.classList.add('wrong'); mg.timers.push(setTimeout(round, 380)); }
        });
        opts.appendChild(b);
      });
    }
    round();
  }

  /* Боль: останови иглу в багровой зоне */
  function mgSetupWhip(play) {
    play.innerHTML = `<div class="mg-note">Останови иглу в багровом</div>
      <div class="mgg-wrap"><div class="mgg-gauge"><div class="mgg-hot"></div><div class="mgg-needle" id="mgg-needle"></div></div></div>`;
    const needle = play.querySelector('#mgg-needle');
    const t0 = performance.now();
    const PERIOD = 640;
    let frozen = false, frozenP = 0;
    const pos = t => { const ph = ((t - t0) / PERIOD) % 2; return ph < 1 ? ph : 2 - ph; };
    const stopAnimation = startGameAnimation(() => {
      needle.style.left = ((frozen ? frozenP : pos(performance.now())) * 98) + '%';
    });
    play.addEventListener('pointerdown', e => {
      if (!mg || frozen) return;
      e.preventDefault();
      const p = pos(performance.now());
      frozen = true; frozenP = p;
      const d = Math.abs(p - 0.5);
      if (d < 0.05) mgScore('perfect');
      else if (d < 0.14) mgScore('good');
      else mgScore('miss');
      mg.timers.push(setTimeout(() => { frozen = false; }, 240));
    }, { signal: mg.ac.signal });
    return stopAnimation;
  }

  /* Пояс верности: стрелка замка в зелёный паз */
  function mgSetupBelt(play) {
    play.innerHTML = `<div class="mg-note">Стрелка — в зелёный паз</div>
      <div class="mgd-dial"><div class="mgd-notch" id="mgd-notch"></div><div class="mgd-hand" id="mgd-hand"></div><div class="mgd-key">🗝</div></div>`;
    const hand = play.querySelector('#mgd-hand');
    const notch = play.querySelector('#mgd-notch');
    let notchA = Math.random() * 360;
    let speed = 150;
    const t0 = performance.now();
    function placeNotch() {
      const rad = notchA * Math.PI / 180;
      notch.style.left = (50 - 36 * Math.sin(rad)) + '%';
      notch.style.top = (50 + 36 * Math.cos(rad)) + '%';
    }
    placeNotch();
    const handA = () => (speed * (performance.now() - t0) / 1000) % 360;
    const stopAnimation = startGameAnimation(() => {
      hand.style.transform = `rotate(${handA()}deg)`;
    });
    play.addEventListener('pointerdown', e => {
      if (!mg) return;
      e.preventDefault();
      let d = Math.abs(handA() - notchA) % 360;
      if (d > 180) d = 360 - d;
      if (d < 9) { mgScore('perfect'); notchA = Math.random() * 360; speed = Math.min(330, speed + 14); placeNotch(); }
      else if (d < 22) { mgScore('good'); notchA = Math.random() * 360; speed = Math.min(330, speed + 8); placeNotch(); }
      else mgScore('miss');
    }, { signal: mg.ac.signal });
    return stopAnimation;
  }

  /* Лохматый: сбривай клоки, пока не отросли */
  function mgSetupHair(play) {
    play.innerHTML = `<div class="mg-note">Сбривай клоки</div>`;
    function spawn() {
      if (!mg) return;
      const b = document.createElement('button');
      b.className = 'mgh-patch'; b.type = 'button';
      const size = 16 + Math.random() * 12;
      b.style.width = size + '%'; b.style.height = (size * 0.8) + '%';
      b.style.left = (5 + Math.random() * (72 - size / 2)) + '%';
      b.style.top = (12 + Math.random() * 70) + '%';
      b.addEventListener('click', ev => {
        ev.stopPropagation();
        if (!mg) return;
        mgScore('perfect', '+2 · ГЛАДКО');
        b.remove();
      });
      play.appendChild(b);
      mg.timers.push(setTimeout(() => b.remove(), 1500)); // отросло обратно
      mg.timers.push(setTimeout(spawn, 400 + Math.random() * 380));
    }
    spawn();
    play.addEventListener('pointerdown', e => {
      if (!mg || e.target !== play) return;
      mgScore('miss', 'по коже');
    }, { signal: mg.ac.signal });
  }

  /* Туалетный: оттирание пятен трением */
  function mgSetupToilet(play) {
    play.innerHTML = `<div class="mg-note">Оттирай трением</div>`;
    const stains = [];
    function addStain() {
      if (!mg) return;
      const s = document.createElement('div');
      s.className = 'mgt-stain';
      const size = 18 + Math.random() * 14;
      s.style.width = size + '%'; s.style.height = (size * 0.75) + '%';
      s.style.left = (6 + Math.random() * (76 - size)) + '%';
      s.style.top = (12 + Math.random() * 64) + '%';
      s.dataset.hp = 100;
      play.appendChild(s);
      stains.push(s);
    }
    for (let i = 0; i < 3; i++) addStain();
    let last = null, scrubbing = false;
    play.addEventListener('pointerdown', e => { if (mg) { scrubbing = true; last = [e.clientX, e.clientY]; } }, { signal: mg.ac.signal });
    window.addEventListener('pointerup', () => { scrubbing = false; last = null; }, { signal: mg.ac.signal });
    play.addEventListener('pointermove', e => {
      if (!mg || !scrubbing || !last) return;
      const dx = e.clientX - last[0], dy = e.clientY - last[1];
      const dist = Math.hypot(dx, dy);
      last = [e.clientX, e.clientY];
      if (dist < 1) return;
      const pr = play.getBoundingClientRect();
      const px = e.clientX - pr.left, py = e.clientY - pr.top;
      for (const s of [...stains]) {
        const sr = s.getBoundingClientRect();
        const cx = sr.left - pr.left + sr.width / 2, cy = sr.top - pr.top + sr.height / 2;
        if (Math.hypot(px - cx, py - cy) < sr.width * 0.62) {
          s.dataset.hp -= dist * 0.9;
          s.style.opacity = Math.max(0.15, s.dataset.hp / 100);
          if (s.dataset.hp <= 0) {
            stains.splice(stains.indexOf(s), 1);
            s.remove();
            const sh = document.createElement('div');
            sh.className = 'mgt-shine';
            sh.style.width = '14%'; sh.style.height = '11%';
            sh.style.left = (cx / pr.width * 100 - 7) + '%'; sh.style.top = (cy / pr.height * 100 - 5) + '%';
            play.appendChild(sh);
            setTimeout(() => sh.remove(), 700);
            mgScore('perfect', '+2 · БЛЕСТИТ');
            mg.timers.push(setTimeout(addStain, 700));
          }
        }
      }
    }, { signal: mg.ac.signal });
  }

  const MG_GAMES = {
    'Футфетиш': mgSetupFoot,
    'Оковы': mgSetupChains,
    'Унижение': mgSetupShame,
    'Боль': mgSetupWhip,
    'Пояс верности': mgSetupBelt,
    'Лохматый': mgSetupHair,
    'Туалетный': mgSetupToilet
  };
  function startMinigame() {
    $('mg-sub').textContent = MG_TEXT[fetish] || 'Кликай в такт пульсу.';
    $('mg-mult').textContent = '×1.0';
    $('mg-floats').innerHTML = '';
    const play = $('mg-play');
    play.innerHTML = '';
    mg = { t0: performance.now(), perfect: 0, good: 0, miss: 0, tick: null, game: 'rhythm', ac: new AbortController(), timers: [], cleanup: null };
    const st = $('mg-stage');
    const setup = MG_GAMES[fetish];
    if (setup) {
      mg.game = fetish;
      $('mg-svg').style.display = 'none';
      st.querySelector('.mg-ring').style.display = 'none';
      st.classList.remove('mg-live');
      mg.cleanup = setup(play) || null;
    } else {
      $('mg-svg').style.display = '';
      st.querySelector('.mg-ring').style.display = '';
      mgSetupRhythm();
    }
    startMgMusic();
    openModal('mg-modal');
    mg.tick = setInterval(() => {
      if (!mg) return;
      const left = Math.max(0, 10000 - (performance.now() - mg.t0));
      $('mg-time').textContent = (left / 1000).toFixed(1);
      $('mg-barfill').style.width = (left / 100) + '%';
      if (left <= 0) endMinigame();
    }, 100);
  }
  $('mg-stage').addEventListener('pointerdown', e => {
    if (!mg || mg.game !== 'rhythm') return;
    e.preventDefault();
    const beat = mgBeat();
    const phase = (performance.now() - mg.t0) % beat;
    if (phase < 110 || phase > beat - 85) mgScore('perfect');
    else if (phase < 230 || phase > beat - 200) mgScore('good');
    else mgScore('miss');
  });
  function endMinigame() {
    clearInterval(mg.tick);
    if (mg.cleanup) { try { mg.cleanup(); } catch (e) {} }
    if (mg.ac) mg.ac.abort();
    (mg.timers || []).forEach(clearTimeout);
    stopMgMusic();
    const mult = 1 + Math.min(1, mg.perfect * 0.2); // 5 идеальных = х2
    const stats = mg;
    mg = null;
    $('mg-play').innerHTML = '';
    closeModal('mg-modal');
    indulgeCdUntil = Date.now() + 12000; // колдаун идёт только после мини-игры
    if (stats.perfect >= 5) say('Идеальная работа. Он в восторге. Награда удвоена.');
    applyIndulge(mult);
  }
  function applyIndulge(mult) {
    const fx = INDULGE_FX[fetish] || INDULGE_FX['Унижение'];
    let obedGain = Math.round(fx.obed * mult);
    if (fetish === 'Пояс верности' && beltLevel > 0 && !beltBroken) obedGain = Math.round(obedGain * 1.5);
    state.obed += obedGain;
    state.mood += Math.round((fetish === 'Унижение' ? fx.mood : 6) * mult);
    state.fear += fx.fear;
    state.dignity = clamp(state.dignity + Math.round(fx.dignity * mult));
    state.need += fx.need;
    addAggr(fx.aggr);
    sfx.coin();
    drumBell(beatTime(), 0.12);
    btnMelody([2, 4, 6], STEP / 2, 0.07, 'sine');
    burst(['✚', '░'], 5);
    // редкая клятва: только если склонность «задета» подходящим предметом
    if (fetishMatched() && Math.random() < (typeof artifacts !== 'undefined' && artifacts.eye ? 0.15 : 0.05)) { // стеклянный глаз видит клятвы
      state.gems += 1;
      sfx.gem();
      say(fx.gem);
      burst(['◆'], 4);
    } else if (state.need >= 100) {
      state.need = 0;
      state.mood += 10;
      say(fx.ok + ' Потребность удовлетворена.');
    } else {
      say(fx.ok);
    }
    render();
    checkEscape();
  }
  $('scene-indulge').addEventListener('click', () => {
    closeModal('indulge-modal');
    sfx.coin();
    startMinigame();
  });

  /* ================= ТЕЛО ПОДОПЫТНОГО: случайные параметры + операционная ================= */
  function rollBody() {
    return { h: 0.94 + Math.random() * 0.16, w: 0.9 + Math.random() * 0.22 };
  }
  let slaveBody = rollBody();
  function applyBody() {
    const f = $('fig');
    if (!f) return;
    f.style.transform = (f.dataset.rot || '') + ' scale(' + slaveBody.w.toFixed(3) + ',' + slaveBody.h.toFixed(3) + ')';
  }
  function opLabel() {
    const hEl = $('op-h-cur'), wEl = $('op-w-cur');
    if (!hEl) return;
    const hL = slaveBody.h < 0.97 ? 'низкий' : slaveBody.h > 1.04 ? 'высокий' : 'средний';
    const wL = slaveBody.w < 0.98 ? 'щуплый' : slaveBody.w > 1.2 ? 'громила' : slaveBody.w > 1.07 ? 'крупный' : 'средний';
    hEl.textContent = 'сейчас: ' + hL + ' · операция 80 монет';
    wEl.textContent = 'сейчас: ' + wL + ' · операция 80 монет';
    document.querySelectorAll('#op-h button').forEach(b => b.classList.toggle('active', Math.abs(+b.dataset.bh - slaveBody.h) < 0.03));
    document.querySelectorAll('#op-w button').forEach(b => b.classList.toggle('active', Math.abs(+b.dataset.bw - slaveBody.w) < 0.07));
  }
  function operate(param, val) {
    if (gone) { sfx.deny(); return; }
    const cur = param === 'h' ? slaveBody.h : slaveBody.w;
    if (Math.abs(cur - val) < 0.03) { sfx.deny(); say('Он уже такой. Скальпель отдыхает.'); return; }
    if (state.coins < 80) { sfx.deny(); return; }
    state.coins -= 80;
    if (param === 'h') slaveBody.h = val; else slaveBody.w = val;
    applyBody();
    sfx.crack(); // хирургия без наркоза
    burst(['✚', '░'], 5);
    say(pick(phrases.surgery));
    opLabel();
    render();
  }
  document.querySelectorAll('#op-h button').forEach(b => b.addEventListener('click', () => operate('h', +b.dataset.bh)));
  document.querySelectorAll('#op-w button').forEach(b => b.addEventListener('click', () => operate('w', +b.dataset.bw)));

  /* ================= ХЛАМ, КРАФТ, АРТЕФАКТЫ ================= */
  const JUNK = {
    glass: 'Осколок стекла', nail: 'Ржавый гвоздь', rag: 'Старая тряпка',
    can: 'Пустая банка', tail: 'Крысиный хвост', wire: 'Проволока',
    spoon: 'Погнутая ложка', battery: 'Батарейка', apple: 'Гнилое яблоко'
  };
  let junk = {}; // хлам вечен: переживает подопытных
  let artifacts = { pride: false, amulet: false, ratking: false, eye: false }; // артефакты тоже
  const RECIPES = [
    { id: 'collar',    name: 'Ошейник',   golden: false, need: { rag: 1, wire: 1 },          desc: '+0.5 к дани' },
    { id: 'gear-whip', name: 'Плеть',     golden: false, need: { tail: 1, nail: 1, rag: 1 }, desc: '+0.5 к дани' },
    { id: 'gag',       name: 'Кляп',      golden: false, need: { apple: 1, rag: 2 },         desc: 'Чтобы помалкивал' },
    { id: 'pride',     name: 'Похороненная гордость', golden: true, need: { glass: 1, rag: 1, spoon: 1 }, desc: 'Спасает дух: достоинство с нуля поднимется до 30 — даже после слома. Расходуется' },
    { id: 'amulet',    name: 'Вшивый амулет',       golden: true, need: { can: 1, nail: 1, wire: 1 },     desc: '+0.35 к дани. Ношение вшами не считается браком' },
    { id: 'ratking',   name: 'Крысиный король',     golden: true, need: { tail: 2, apple: 1 },            desc: 'Три крысы бегают по комнате и приносят крошки: настроение растёт, сытость не меняется' },
    { id: 'eye',       name: 'Стеклянный глаз',     golden: true, need: { glass: 1, battery: 1, wire: 1 }, desc: 'Шанс клятвы при потакании ×3' }
  ];
  const CRAFT_SAY = {
    pride:   'Он сжал стекляшку, как сердце. Гордость найдена на помойке — а где ж ещё.',
    amulet:  'Амулет из банки. Экономика чудес не признаёт, но уважает.',
    ratking: 'Крысиный король коронован. Три маленьких поставщика крошек уже в пути.',
    eye:     'Третий глаз. Стеклянный. Видит клятвы насквозь.'
  };
  const hasMats = r => Object.entries(r.need).every(([k, v]) => (junk[k] || 0) >= v);
  function craft(id) {
    const r = RECIPES.find(x => x.id === id);
    if (!r) return;
    if (r.golden && !ownedOutfits.goldarms) { sfx.deny(); say('Нужны золотые руки. Гардероб, слот «руки».'); return; }
    if (r.golden ? artifacts[id] : owned[id]) { sfx.deny(); return; }
    if (!hasMats(r)) { sfx.deny(); return; }
    for (const k in r.need) junk[k] -= r.need[k];
    for (const k in junk) if (junk[k] <= 0) delete junk[k];
    sfx.gem();
    burst(['▓', '✚', '░'], 6);
    if (r.golden) {
      artifacts[id] = true;
      say(CRAFT_SAY[id]);
    } else {
      owned[id] = true;
      $(id).setAttribute('opacity', 1);
      const shopBtn = document.querySelector('button.buy[data-item="' + id + '"]');
      if (shopBtn) { shopBtn.textContent = 'Установлено'; shopBtn.classList.add('owned'); shopBtn.disabled = true; }
      say(pick(ITEM_SAY[id] || ['Собрано из хлама. Работает.']));
    }
    render();
    renderCraft();
  }
  function renderCraft() {
    const host = $('craft-rows');
    if (!host) return;
    $('junk-line').textContent = 'Хлам: ' + (Object.keys(junk).length
      ? Object.entries(junk).map(([k, v]) => JUNK[k] + (v > 1 ? '×' + v : '')).join(' · ')
      : 'пусто — копайся в мусорке.');
    host.innerHTML = '';
    for (const r of RECIPES) {
      const row = document.createElement('div');
      row.className = 'shop-item';
      const needTxt = Object.entries(r.need).map(([k, v]) => {
        const have = (junk[k] || 0) >= v;
        return `<span style="color:${have ? 'inherit' : 'rgba(255,46,46,0.75)'}">${JUNK[k]}${v > 1 ? '×' + v : ''}</span>`;
      }).join(' + ');
      const info = document.createElement('div');
      info.className = 'shop-info';
      info.innerHTML = `<b>${r.name}</b><span>${r.desc}<br>Из: ${needTxt}${r.golden ? ' · <span class="craft-lock">золотые руки</span>' : ''}</span>`;
      row.appendChild(info);
      const btn = document.createElement('button');
      btn.className = 'buy'; btn.type = 'button';
      const done = r.golden ? artifacts[r.id] : owned[r.id];
      const locked = r.golden && !ownedOutfits.goldarms;
      if (done) { btn.textContent = 'Собрано'; btn.disabled = true; btn.classList.add('owned'); }
      else if (locked) { btn.textContent = 'Золотые руки'; btn.disabled = true; }
      else { btn.textContent = 'Собрать'; btn.disabled = !hasMats(r); btn.addEventListener('click', () => craft(r.id)); }
      row.appendChild(btn);
      host.appendChild(row);
    }
  }

  /* ================= МУСОРКА: копание в слоях ================= */
  let trashPokes = 8, trashRefillAt = 0;
  const TRASH_SAY = [
    'Мусорка. Он смотрит на неё, как в зеркало.',
    'Он роется в отбросах. Отброс роется в нём.',
    'Мусор к мусору, говорила Госпожа. Он кивает: впервые согласен.',
    'Здесь пахнет домом. Не его. Но пахнет.',
    'Осторожно: под слоями спит его прошлое.'
  ];
  const TRASH_COLS = ['#1b1e25', '#23262e', '#262a33', '#1a1c22', '#2b2e38'];
  function trashBlob() {
    const c = pick(TRASH_COLS);
    let extra = '';
    const r = Math.random();
    if (r < 0.18) extra = '<rect x="42" y="2" width="9" height="12" fill="#3a3f4a" transform="rotate(14 46 8)"/>'; // банка
    else if (r < 0.36) extra = '<line x1="30" y1="26" x2="70" y2="14" stroke="#4a3b2c" stroke-width="3"/>'; // доска
    else if (r < 0.52) extra = '<path d="M20 24 q10 -12 22 -4" fill="none" stroke="#5a6b3a" stroke-width="3"/>'; // огрызок
    return `<svg viewBox="0 0 100 34" style="width:100%;height:100%;display:block"><path d="M2 34 C0 21 12 12 26 16 C34 5 54 3 64 11 C78 7 94 15 98 34 Z" fill="${c}"/>${extra}</svg>`;
  }
  function markTopLayer() {
    const layers = [...$('trash-pit').querySelectorAll('.trash-layer:not(.out)')];
    layers.forEach((l, i) => l.classList.toggle('topmost', i === layers.length - 1));
  }
  function buildPit() {
    const pit = $('trash-pit');
    pit.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const el = document.createElement('div');
      el.className = 'trash-layer';
      el.style.bottom = (i * 16) + 'px';
      el.style.left = (6 + Math.random() * 12) + '%';
      el.style.width = (62 + Math.random() * 26) + '%';
      el.style.height = '36px';
      el.innerHTML = trashBlob();
      pit.appendChild(el);
    }
    markTopLayer();
    $('trash-left').textContent = trashPokes;
    $('trash-find').textContent = '—';
  }
  function openTrash() {
    buildPit();
    openModal('trash-modal');
    noiseBurst(0.2, 700, 0.2, 'lowpass');
    say(pick(TRASH_SAY));
  }
  $('room-trash').addEventListener('click', () => {
    if (gone) { sfx.deny(); return; }
    if (trashPokes <= 0 && Date.now() >= trashRefillAt) { // новая партия прибыла
      trashPokes = 8;
      $('room-trash').style.opacity = 1;
    }
    if (trashPokes <= 0) { sfx.deny(); say('Мусорка вычищена. Новую партию ещё не вывезли.'); return; }
    sfx.coin();
    openTrash();
  });
  $('trash-pit').addEventListener('pointerdown', e => {
    e.preventDefault();
    if (trashPokes <= 0) return;
    const layers = [...$('trash-pit').querySelectorAll('.trash-layer:not(.out)')];
    const top = layers[layers.length - 1];
    if (!top) return;
    top.classList.add('out');
    setTimeout(() => top.remove(), 300);
    trashPokes--;
    $('trash-left').textContent = trashPokes;
    noiseBurst(0.14, 900, 0.22, 'lowpass');
    const roll = Math.random();
    let txt;
    if (roll < 0.03) {
      state.gems += 1;
      sfx.gem();
      burst(['◆'], 4);
      txt = '◆ Клятва! Прямо из грязи.';
    } else if (roll < 0.33) {
      const keys = Object.keys(JUNK);
      const k = keys[Math.floor(Math.random() * keys.length)];
      junk[k] = (junk[k] || 0) + 1;
      sfx.coin();
      txt = 'Находка: ' + JUNK[k];
    } else {
      txt = pick(['только грязь', 'пыль и объедки', 'ничего. как внутри', 'снова пусто', 'чей-то вчерашний день', 'крошки памяти']);
    }
    $('trash-find').textContent = txt;
    if (trashPokes <= 0) {
      trashRefillAt = Date.now() + 60000;
      $('room-trash').style.opacity = 0.35;
      say('Куча исчерпана. Вывоз мусора — раз в минуту. Тут даже отбросы по расписанию.');
      setTimeout(() => closeModal('trash-modal'), 900);
    }
    render();
  });

  /* ---------- инвентарь ---------- */
  document.querySelectorAll('button.buy[data-item]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (gone) { sfx.deny(); return; }
      const item = btn.dataset.item;
      const price = +btn.dataset.price;
      if (owned[item]) return;
      if (state.coins < price) { sfx.deny(); return; }
      state.coins -= price;
      owned[item] = true;
      $(item).setAttribute('opacity', 1);
      btn.textContent = 'Установлено';
      btn.classList.add('owned');
      btn.disabled = true;
      sfx.coin();
      burst(['✕', '▚', '▓'], 5);
      say(pick(ITEM_SAY[item] || ['Установлено. Работает.']));
      render();
    });
  });

  /* ---------- оковы ---------- */
  document.querySelectorAll('button.buy[data-restraint]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (gone) { sfx.deny(); return; }
      const key = btn.dataset.restraint;
      const price = +btn.dataset.price;
      if (restraints[key]) {
        restraints[key] = false;
        $(key).setAttribute('opacity', 0);
        sfx.coin();
        say('Оковы сняты.');
      } else if (restraintsOwned[key]) {
        restraints[key] = true;
        $(key).setAttribute('opacity', 1);
        $('pet').classList.remove('sitting');
        setPetOff(0, 0, 'transform 0.6s ease-in-out');
        sfx.chain();
        say('Оковы надеты. Цепи тянут к привязи. Агрессия под контролем.');
      } else {
        if (state.coins < price) { sfx.deny(); return; }
        state.coins -= price;
        restraintsOwned[key] = true;
        sfx.coin();
        say('Оковы куплены. Можно надеть.');
      }
      render();
    });
  });

  /* ---------- бритва: расходник, бритьё и шрамы ---------- */
  let razors = 0;
  function updateRazorBtn() {
    const btn = $('btn-razor');
    if (razors > 0) { btn.textContent = `Брить (${razors} шт.)`; btn.classList.add('to-equip'); btn.disabled = false; }
    else { btn.textContent = '30 монет'; btn.classList.remove('to-equip'); btn.disabled = state.coins < 30; }
  }
  $('btn-razor').addEventListener('click', () => {
    if (gone) { sfx.deny(); return; }
    if (razors > 0) {
      razors--;
      if (Math.random() < 0.12) {
        // порезался: боль и постоянный шрам
        state.hp -= 6;
        addAggr(4);
        addMark('scar');
        act('act-hit', 'squint', 600);
        sfx.crack(); btnMelody([6, 1], STEP / 2, 0.1, 'sine');
        burst(['✕', '·'], 4);
        say(pick(phrases.cut));
        render(); checkDeath(); checkEscape();
      } else {
        state.dignity = clamp(state.dignity + 20);
        state.mood += 2;
        act('act-eat', 'happy', 700);
        btnMelody([6, 4, 6], STEP / 3, 0.08, 'sine');
        sfx.coin();
        burst(['✦', '░'], 4);
        say(pick(phrases.shave));
        render(); checkEscape();
      }
      updateRazorBtn();
    } else {
      if (state.coins < 30) { sfx.deny(); return; }
      state.coins -= 30;
      razors++;
      sfx.coin();
      say('Бритва куплена. Осторожно: режет.');
      updateRazorBtn(); render();
    }
  });

  /* ---------- пояс послушания ---------- */
  function applyBelt() {
    const w = beltWorn;
    $('out-belt').setAttribute('opacity', w >= 1 ? 1 : 0);
    $('belt-aura').setAttribute('opacity', w >= 3 ? 1 : w === 2 ? 0.35 : 0);
    $('belt-gems').setAttribute('opacity', w >= 2 ? 1 : 0);
    $('belt-buckle').setAttribute('stroke', w >= 3 ? '#ffe9a3' : w === 2 ? '#ffd76a' : '#8a6a3a');
    $('belt-band').setAttribute('filter', w >= 2 ? 'url(#glow)' : 'none');
  }
  const BELT_WEAR_SAY = { 1: 'Пояс надет. Замок щёлкнул.', 2: 'Пояс гудит. Он нравится ему.', 3: 'Воздух вокруг него искрится. Стоит в аниме-ауре.' };
  $('btn-belt').addEventListener('click', () => {
    if (gone || beltLevel >= 3) { sfx.deny(); return; }
    const next = BELT[beltLevel + 1];
    const can = next.cur === 'gems' ? state.gems >= next.price : state.coins >= next.price;
    if (!can) { sfx.deny(); return; }
    if (next.cur === 'gems') state.gems -= next.price; else state.coins -= next.price;
    beltLevel++;
    beltWorn = beltLevel; // новый уровень сразу на нём
    beltBroken = false;
    sfx.coin();
    say(`Пояс послушания: ${BELT[beltLevel].name}. Заперт.`);
    burst(['▓', '✚'], 4);
    render();
  });
  // переключение купленных уровней пояса
  $('belt-lvls').addEventListener('click', e => {
    const b = e.target.closest('button[data-lvl]');
    if (!b || gone) return;
    const lvl = +b.dataset.lvl;
    if (lvl > beltLevel) { sfx.deny(); return; }
    beltWorn = lvl;
    sfx.coin();
    say(BELT_WEAR_SAY[lvl]);
    render();
  });

  /* ---------- модалки ---------- */
  function openModal(id) { $(id).classList.add('open'); }
  function closeModal(id) { $(id).classList.remove('open'); }
  document.querySelectorAll('.overlay').forEach(ov => {
    ov.addEventListener('click', e => {
      if (e.target === ov && !['start-modal', 'death', 'escape-modal', 'mg-modal'].includes(ov.id)) ov.classList.remove('open');
    });
  });
  document.querySelectorAll('[data-close]').forEach(b => {
    b.addEventListener('click', () => closeModal(b.dataset.close));
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.overlay').forEach(o => {
      if (!['start-modal', 'death', 'escape-modal'].includes(o.id)) o.classList.remove('open');
    });
  });

  /* ---------- фиксация масштаба и запрет выделения: игра — не веб-страница ---------- */
  document.addEventListener('gesturestart', e => e.preventDefault()); // iOS pinch
  document.addEventListener('gesturechange', e => e.preventDefault());
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', e => e.preventDefault());
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('selectstart', e => e.preventDefault());
  document.addEventListener('copy', e => e.preventDefault());

  $('btn-shop').addEventListener('click', () => { openModal('shop-modal'); renderCraft(); sfx.coin(); });
  // вкладки инвентаря: магазин / крафт
  function invTab(which) {
    $('tab-shop').hidden = which !== 'shop';
    $('tab-craft').hidden = which !== 'craft';
    $('tab-btn-shop').classList.toggle('sel', which === 'shop');
    $('tab-btn-craft').classList.toggle('sel', which === 'craft');
    if (which === 'craft') renderCraft();
  }
  $('tab-btn-shop').addEventListener('click', () => { invTab('shop'); sfx.coin(); });
  $('tab-btn-craft').addEventListener('click', () => { invTab('craft'); sfx.coin(); });
  $('btn-wardrobe').addEventListener('click', () => { openModal('wardrobe-modal'); sfx.coin(); });
  $('btn-decor').addEventListener('click', () => { openModal('decor-modal'); sfx.coin(); });
  function auctionLevel() {
    return Math.max(1, 1 + Math.floor(Math.max(0, baseMult - 1) * 20) + beltLevel);
  }
  function auctionAge(hours) {
    const value = Math.max(0, Math.floor(hours || 0));
    return `${Math.floor(value / 24)} дн. ${value % 24} ч.`;
  }
  function renderAuctionCurrent() {
    $('auction-current').replaceChildren();
    const name = document.createElement('b');
    name.textContent = slaveDisplayName();
    const details = document.createTextNode(` · ${auctionAge(currentSlaveAgeHours())} · ${censorshipOn ? 'Характер' : 'Фетиш'}: ${displayFetish(fetish)}`);
    $('auction-current').append(name, details);
    $('auction-current-level').textContent = `Уровень ${auctionLevel()}`;
    $('auction-sell').disabled = gone || !initData;
    $('auction-sell').textContent = gone ? 'Недоступно' : 'Выставить';
  }
  function renderAuctionLots(lots) {
    const container = $('auction-lots');
    container.replaceChildren();
    if (!lots.length) {
      const empty = document.createElement('p');
      empty.className = 'auction-empty';
      empty.textContent = 'Открытых лотов пока нет.';
      container.appendChild(empty);
      return;
    }
    for (const lot of lots) {
      const card = document.createElement('article');
      const mine = String(lot.seller_id) === String(telegramUserId);
      card.className = 'auction-lot' + (mine ? ' mine' : '');
      const info = document.createElement('div');
      const title = document.createElement('h4');
      title.textContent = slaveDisplayName(lot.slave_no);
      const details = document.createElement('p');
      details.textContent = `Уровень ${lot.level} · ${censorshipOn ? 'Характер' : 'Фетиш'}: ${displayFetish(lot.fetish)} · Возраст: ${auctionAge(lot.age_hours)}`;
      const seller = document.createElement('p');
      seller.textContent = `Продавец: ${lot.seller_name || 'Игрок'}`;
      info.append(title, details, seller);
      const side = document.createElement('div');
      side.className = 'auction-lot-side';
      const price = document.createElement('span');
      price.className = 'auction-lot-price';
      price.textContent = `◆ ${lot.price}`;
      side.appendChild(price);
      if (mine) {
        const own = document.createElement('span');
        own.className = 'auction-own-label';
        own.textContent = 'ВАШ ЛОТ';
        side.appendChild(own);
      } else {
        const buy = document.createElement('button');
        buy.className = 'auction-buy';
        buy.type = 'button';
        buy.textContent = 'Купить';
        buy.disabled = !initData;
        buy.addEventListener('click', () => purchaseAuctionLot(lot, buy));
        side.appendChild(buy);
      }
      card.append(info, side);
      container.appendChild(card);
    }
  }
  async function loadAuction() {
    try {
      const response = await fetch(API_BASE + '/api/auction');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      renderAuctionLots(data.lots || []);
    } catch (error) {
      const empty = document.createElement('p');
      empty.className = 'auction-empty';
      empty.textContent = 'Не удалось загрузить лоты. Нажмите «Обновить».';
      $('auction-lots').replaceChildren(empty);
    }
  }
  async function createAuctionLot() {
    const note = $('auction-note');
    const price = Math.floor(Number($('auction-price').value));
    if (!initData) { note.textContent = 'Продажа доступна внутри Telegram.'; return; }
    if (gone) { note.textContent = 'Завершённого персонажа нельзя выставить.'; return; }
    if (!Number.isInteger(price) || price < 1 || price > 1000000) {
      note.textContent = 'Укажите цену от 1 до 1 000 000 кристаллов.';
      return;
    }
    const button = $('auction-sell');
    button.disabled = true;
    note.textContent = 'Создаём лот…';
    try {
      const request = JSON.parse(saveRequestBody());
      const data = await apiPost('/api/auction/list', { price, stats: request.stats });
      newSlave();
      applyPlayerIdentity(data.player);
      scheduleSave(true);
      note.textContent = `${slaveDisplayName(data.lot.slave_no)} выставлен за ◆ ${data.lot.price}.`;
      renderAuctionCurrent();
      await loadAuction();
      sfx.gem();
    } catch (error) {
      note.textContent = error.message;
      sfx.deny();
    } finally {
      renderAuctionCurrent();
    }
  }
  async function purchaseAuctionLot(lot, button) {
    const note = $('auction-note');
    if (!initData) { note.textContent = 'Покупка доступна внутри Telegram.'; return; }
    const message = `Купить ${slaveDisplayName(lot.slave_no)} за ◆ ${lot.price}? Текущий персонаж будет заменён.`;
    if (!window.confirm(message)) return;
    button.disabled = true;
    note.textContent = 'Подтверждаем покупку…';
    try {
      const data = await apiPost('/api/auction/buy', { lot_id: lot.id });
      restoreProgress(data.player.current_slave_stats, data.player);
      applyPlayerIdentity(data.player);
      closeModal('death');
      closeModal('escape-modal');
      scheduleSave(true);
      note.textContent = `${slaveDisplayName(lot.slave_no)} теперь ваш. Возраст и рейтинг перенесены.`;
      renderAuctionCurrent();
      await loadAuction();
      sfx.gem();
    } catch (error) {
      note.textContent = error.message;
      button.disabled = false;
      sfx.deny();
    }
  }
  $('btn-auction').addEventListener('click', () => {
    $('auction-note').textContent = initData ? '' : 'Просмотр доступен всем. Покупка и продажа — внутри Telegram.';
    renderAuctionCurrent();
    openModal('auction-modal');
    loadAuction();
    sfx.coin();
  });
  $('auction-sell').addEventListener('click', createAuctionLot);
  $('auction-refresh').addEventListener('click', loadAuction);

  function renderLeaderboardList(id, items, formatValue, formatName = item => item.display_name || 'Игрок') {
    const list = $(id);
    list.replaceChildren();
    if (!items.length) {
      const row = document.createElement('li');
      row.className = 'empty';
      row.textContent = 'Пока пусто';
      list.appendChild(row);
      return;
    }
    for (const item of items) {
      const row = document.createElement('li');
      const name = document.createElement('span');
      const value = document.createElement('b');
      name.textContent = formatName(item);
      value.textContent = formatValue(item);
      row.append(name, value);
      list.appendChild(row);
    }
  }
  async function loadLeaderboard() {
    try {
      const response = await fetch(API_BASE + '/api/leaderboard');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      renderLeaderboardList('leaderboard-shame', data.shame || [], item => String(item.slaves_killed || 0));
      renderLeaderboardList('leaderboard-power', data.power || [], item => {
        const hours = Math.max(0, Math.floor(item.oldest_slave_age_hours || 0));
        return `${Math.floor(hours / 24)} дн. ${hours % 24} ч.`;
      }, item => `${item.display_name || 'Игрок'} · ${slaveDisplayName(item.oldest_slave_no || 1)}`);
    } catch (error) {
      for (const id of ['leaderboard-shame', 'leaderboard-power']) {
        const row = document.createElement('li');
        row.className = 'empty';
        row.textContent = 'Сервер недоступен';
        $(id).replaceChildren(row);
      }
    }
  }
  $('btn-leaderboard').addEventListener('click', () => {
    openModal('leaderboard-modal');
    loadLeaderboard();
    sfx.coin();
  });
  $('btn-side-toggle').addEventListener('click', () => {
    const sm = $('side-meter');
    sm.classList.toggle('collapsed');
    const off = sm.classList.contains('collapsed');
    $('btn-side-toggle').textContent = off ? '«' : '»';
    try { localStorage.setItem('p001_side', off ? '1' : '0'); } catch (e) {}
    sfx.coin();
  });
  try { if (localStorage.getItem('p001_side') === '1') { $('side-meter').classList.add('collapsed'); $('btn-side-toggle').textContent = '«'; } } catch (e) {}

  /* точки расцветок слева от цены мебели */
  document.querySelectorAll('button.buy[data-slot]').forEach(btn => {
    const holder = document.createElement('div');
    holder.className = 'vdots';
    holder.dataset.slot = btn.dataset.slot;
    for (let v = 0; v < 4; v++) {
      const d = document.createElement('button');
      d.className = 'vdot v' + v;
      d.dataset.v = v;
      d.type = 'button';
      holder.appendChild(d);
    }
    btn.parentElement.insertBefore(holder, btn);
  });
  document.querySelectorAll('.vdots').forEach(holder => {
    holder.addEventListener('click', e => {
      const dot = e.target.closest('.vdot');
      if (!dot || gone) return;
      const slot = holder.dataset.slot;
      const v = +dot.dataset.v;
      const lvl = room[slot];
      const key = slot + ':' + lvl, ownKey = key + ':' + v;
      if (v === 0 || decorVarOwned[ownKey]) {
        decorVar[key] = v;
        sfx.coin();
        say('Другой облик. Та же клетка.');
      } else {
        const cost = variantCost(slot, lvl);
        if (state.gems < cost) { sfx.deny(); say('Не хватает клятв на этот облик.'); return; }
        state.gems -= cost;
        decorVarOwned[ownKey] = true;
        decorVar[key] = v;
        sfx.gem();
        burst(['◆', '✦'], 4);
        say(pick(['Перекрашено. Под новым цветом не видно крови.', 'Облик сменили. Суть — нет.', 'Краска легла. На душе — нет.']));
      }
      applyDecor();
      render();
    });
  });
  function renderDecorDots() {
    document.querySelectorAll('.vdots').forEach(holder => {
      const slot = holder.dataset.slot;
      const lvl = room[slot];
      const key = slot + ':' + lvl;
      const active = decorVar[key] || 0;
      holder.querySelectorAll('.vdot').forEach(dot => {
        const v = +dot.dataset.v;
        const owned = v === 0 || decorVarOwned[key + ':' + v];
        dot.classList.toggle('active', v === active);
        dot.classList.toggle('locked', !owned);
        const vars = slotVariants(slot);
        dot.title = vars[v].n + (owned ? '' : ` · ${variantCost(slot, lvl)} ◆`);
        dot.textContent = owned ? '' : variantCost(slot, lvl);
      });
    });
  }
  document.querySelectorAll('button.buy[data-slot]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (gone) { sfx.deny(); return; }
      const key = btn.dataset.slot;
      const slot = SLOTS[key];
      const next = slot.tiers[room[key] + 1];
      if (!next) { sfx.deny(); return; }
      if (state.coins < next.p) { sfx.deny(); return; }
      state.coins -= next.p;
      room[key]++;
      comfort = calcComfort();
      applyDecor();
      sfx.gem();
      burst(['▓', '░', '✚'], 6);
      say(comfort >= 10 ? 'Такая роскошь… да, госпожа.' :
          comfort >= 4 ? 'Благодарю вас.' : 'Новая мебель? Зачем.');
      render();
    });
  });
  async function apiPost(path, body) {
    const response = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, initData })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'Сервер недоступен');
    return data;
  }
  function normalizedNickname(value) { return value.trim().replace(/\s+/g, ' '); }
  function applyPlayerIdentity(player) {
    displayName = player.display_name || 'Игрок';
    nicknameChanges = Math.max(0, Math.floor(player.nickname_changes || 0));
    state.coins = player.coins;
    state.gems = player.crystals;
    if (player.rating_reset_applied) {
      oldestSlaveAgeDays = 0;
      oldestSlaveAgeHours = 0;
      oldestSlaveNo = 1;
    }
  }
  async function requestNickname(value) {
    const name = normalizedNickname(value);
    if (!name) throw new Error('Введите ник');
    if (name === displayName) return;
    if (!initData) {
      const cost = nicknameChanges ? 500 : 0;
      if (state.gems < cost) throw new Error('Для смены ника нужно 500 клятв');
      state.gems -= cost;
      nicknameChanges++;
      displayName = name;
      return;
    }
    applyPlayerIdentity(await apiPost('/api/profile/nickname', { display_name: name }));
  }
  $('btn-profile').addEventListener('click', () => {
    $('profile-nickname-input').value = displayName;
    $('profile-note').textContent = '';
    renderProfile();
    openModal('profile-modal');
    sfx.coin();
  });
  $('btn-save-nickname').addEventListener('click', async () => {
    const button = $('btn-save-nickname');
    const note = $('profile-note');
    note.textContent = '';
    button.disabled = true;
    try {
      await requestNickname($('profile-nickname-input').value);
      $('profile-nickname-input').value = displayName;
      note.textContent = 'Ник сохранён.';
      render();
      scheduleSave();
      sfx.gem();
    } catch (error) {
      note.textContent = error.message;
      sfx.deny();
    } finally {
      button.disabled = false;
    }
  });
  async function buyProduct(amount) {
    const note = $('gem-stub');
    if (!initData || !Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) {
      note.textContent = 'Оплата доступна при запуске игры внутри Telegram.';
      note.classList.add('show');
      sfx.deny();
      return;
    }
    note.textContent = 'Создаём платёж…';
    note.classList.add('show');
    try {
      const response = await fetch(API_BASE + '/api/create_payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, telegram_id: telegramUserId })
      });
      const payment = await response.json().catch(() => ({}));
      if (!response.ok || !payment.confirmation_url) {
        throw new Error(payment.detail || 'Не удалось создать платёж. Попробуйте позже.');
      }
      window.location.href = payment.confirmation_url;
    } catch (error) {
      note.textContent = error.message;
      sfx.deny();
    }
  }
  $('btn-vip').addEventListener('click', () => {
    $('vip-store-note').textContent = '';
    openModal('vip-modal');
    sfx.coin();
  });
  document.querySelectorAll('.vip-buy').forEach(button => {
    button.addEventListener('click', () => {
      const product = button.closest('.vip-product').querySelector('h3').textContent;
      $('vip-store-note').textContent = `${product}: оплата будет доступна после подключения ЮKassa.`;
      sfx.coin();
    });
  });
  function openDonate() { $('gem-stub').classList.remove('show'); openModal('gem-modal'); }
  $('btn-gems').addEventListener('click', openDonate);
  document.querySelectorAll('.pack').forEach(p => {
    p.addEventListener('click', () => buyProduct(Number(p.dataset.amount)));
  });
  function lastActivityLabel(value) {
    const timestamp = Date.parse(value || '');
    if (!Number.isFinite(timestamp)) return 'нет данных';
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 2) return 'сейчас в игре';
    if (minutes < 60) return `${minutes} мин. назад`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `${hours} ч. назад`;
    return `${Math.floor(hours / 24)} дн. назад`;
  }
  function renderReferralFriends(friends) {
    const host = $('referral-friends');
    host.replaceChildren();
    if (!friends.length) {
      const empty = document.createElement('p');
      empty.className = 'referral-friends-empty';
      empty.textContent = 'Приглашённых игроков пока нет.';
      host.appendChild(empty);
      return;
    }
    for (const friend of friends) {
      const row = document.createElement('div');
      row.className = 'referral-friend';
      const name = document.createElement('span');
      name.textContent = friend.display_name || 'Игрок';
      const activity = document.createElement('span');
      activity.textContent = lastActivityLabel(friend.last_seen);
      row.append(name, activity);
      host.appendChild(row);
    }
  }
  $('btn-referral').addEventListener('click', async () => {
    openModal('referral-modal');
    $('referral-stub').classList.remove('show');
    try {
      const data = await apiPost('/api/referral', {});
      $('referral-link').value = data.url;
      $('referral-stats').textContent = `Приглашено: ${data.invited}. Вам начислено: ${data.invited * data.referrer_reward} клятв.`;
      renderReferralFriends(data.friends || []);
    } catch (error) {
      $('referral-stub').textContent = initData ? error.message : 'Реферальные ссылки доступны внутри Telegram.';
      $('referral-stub').classList.add('show');
    }
  });
  $('btn-copy-referral').addEventListener('click', async () => {
    const input = $('referral-link');
    if (!input.value) { sfx.deny(); return; }
    input.focus(); input.select();
    try {
      await navigator.clipboard.writeText(input.value);
      $('btn-copy-referral').textContent = 'Ссылка скопирована';
    } catch (error) {
      document.execCommand('copy');
      $('btn-copy-referral').textContent = 'Скопируйте ссылку выше';
    }
    sfx.coin();
  });

  /* ---------- выбор лица ---------- */
  document.querySelectorAll('.face-pick').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.face-pick').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      face = b.dataset.face;
      sfx.coin();
    });
  });
  $('age18').addEventListener('change', e => { $('btn-start').disabled = !e.target.checked; });
  $('btn-start').addEventListener('click', async () => {
    if (!$('age18').checked || onboardingComplete) { sfx.deny(); return; }
    const button = $('btn-start');
    button.disabled = true;
    try {
      await requestNickname($('start-nickname').value);
    } catch (error) {
      $('start-nickname-note').textContent = error.message;
      button.disabled = false;
      sfx.deny();
      return;
    }
    $('start-nickname-note').textContent = '';
    $('face-haggard').setAttribute('opacity', face === 'haggard' ? 1 : 0);
    if (face === 'bold') {
      browL.setAttribute('transform', 'rotate(10 91 32)');
      browR.setAttribute('transform', 'rotate(-10 109 32)');
    }
    onboardingComplete = true;
    document.body.classList.add('game-ready');
    fetish = rollFetish();
    applyFaceStart();
    setTimeout(maybeRareModal, 600);
    closeModal('start-modal');
    audio(); startAmbient();
    say(`Подопытный ${padNo()} зафиксирован. Изучите его, чтобы узнать склонность.`);
    render();
    scheduleSave();
  });

  /* ---------- моргание ---------- */
  (function blink() {
    setTimeout(() => {
      if (onboardingComplete && !gone) {
        eyeL.style.transform = eyeR.style.transform = 'scaleY(0.1)';
        setTimeout(() => {
          eyeL.style.transform = eyeR.style.transform = `scaleY(${FACES[currentFace].s})`;
        }, 120);
      }
      blink();
    }, 2200 + Math.random() * 3200);
  })();

  /* ---------- наклон за курсором ---------- */
  const fig = $('fig');
  window.addEventListener('pointermove', e => {
    if (!onboardingComplete) return;
    const r = pet.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
    fig.dataset.rot = `rotate(${Math.max(-3, Math.min(3, dx * 4))}deg)`;
    applyBody(); // поворот + параметры тела
  });

  /* ---------- тики ---------- */
  setInterval(() => {
    if (!onboardingComplete || gone) return;
    state.food -= owned.gag ? 0.9 : 0.6; // с кляпом ест на бегу — сытость тает быстрее
    state.mood -= 0.4;
    if (state.mood < 40) {
      const comfortFactor = state.mood <= 0 ? Math.max(0.25, 1 - comfort * 0.05) : 1;
      state.dignity -= 0.15 * comfortFactor;
    }
    state.fear = Math.max(0, state.fear - 0.3);
    state.aggr = Math.max(0, state.aggr - 1.2);
    // показатели не уходят в минус
    for (const k of ['food', 'mood', 'dignity', 'fear', 'obed', 'need']) state[k] = Math.max(0, state[k]);
    if (state.food > 30) state.hp = Math.min(100, state.hp + 0.2);
    // фетиш «Оковы»: оковы на нём — достоинство растёт, послушание тает
    if (fetish === 'Оковы' && (restraints.handcuffs || restraints.shackles)) {
      state.dignity += 0.4;
      state.obed = Math.max(0, state.obed - 0.3);
    }
    // фетиш «Футфетиш»: без внимания настроение падает быстрее
    if (fetish === 'Футфетиш') state.mood -= 0.4;
    // роскошная обстановка поддерживает достоинство
    if (comfort >= 4) state.dignity += 0.15;
    // слом духа: достоинство упало в ноль — до конца жизни без премии
    if (!spiritBroken && state.dignity <= 0) {
      if (typeof artifacts !== 'undefined' && artifacts.pride) { // похороненная гордость перехватывает слом
        artifacts.pride = false;
        state.dignity = 30;
        sfx.gem();
        burst(['◆', '✚'], 6);
        say('Что-то в нём щёлкнуло — и не сломалось. Похороненная гордость сработала.');
      } else {
        spiritBroken = true;
        state.dignity = 0;
        glitch();
        sfx.revolt();
        say('Его дух сломлен. Премия к дани потеряна навсегда.');
        burst(['✕', '▓', '░'], 8);
      }
    } else if (spiritBroken && typeof artifacts !== 'undefined' && artifacts.pride) { // вытаскивает даже с того света
      artifacts.pride = false;
      spiritBroken = false;
      state.dignity = 30;
      sfx.gem();
      burst(['◆', '✚'], 6);
      say('Он поднял голову. Похороненная гордость вытащила его обратно.');
    }
    if (spiritBroken) state.dignity = 0;
    healMarks(0.006);
    if (owned.collar) questProgress('collarTime', 1.5);
    // неделя: ролловер и выживание
    if (weekKey() !== weekly.week) weekly = loadWeekly();
    if (Date.now() - weekly.surviveStart >= 604800000) {
      for (const q of weekly.quests) {
        if (q.id === 'wsurvive' && !q.done && !q.failed) {
          q.done = true; state.gems += 75; saveWeekly();
          sfx.gem(); burst(['◆', '◆', '◆'], 9);
          say('Неделя прожита. Подопытный выжил. +75 клятв.');
        }
      }
    }
    // фетиш «Туалетный»: грязь веселит, роскошь давит
    if (fetish === 'Туалетный') {
      if (comfort === 0) state.mood += 0.25;
      if (comfort >= 10) state.mood -= 0.2;
    }
    // комфорт — событие для заданий
    questProgress('comfort', comfort);
    // накопительные задания Госпожи
    if (mquest) {
      if (mquest.id === 'mstarve' && state.food < 25) mquestProgress('starve', 1.5);
      if (mquest.id === 'mbare') {
        const bare = !restraints.handcuffs && !restraints.shackles &&
          (!equipped.body || equipped.body === 'rags') && !equipped.head && !equipped.feet && !equipped.arms && !equipped.pants && beltWorn === 0;
        if (bare) mquestProgress('bare', 1.5);
      }
    }
    render();
  }, 1500);
  setInterval(() => {
    if (!onboardingComplete || gone || !artifacts.ratking) return;
    state.mood = Math.min(100, state.mood + 3);
    if (Math.random() < 0.35) {
      say(pick([
        'Три крысы притащили крошки. Еды не хватит, но компания приятная.',
        'Крысиная делегация оставила крошку рядом с подопытным. Он почти улыбается.',
        'Крысы весело снуют по комнате. Настроение +3, сытость прежняя.',
      ]));
    }
    render();
    scheduleSave();
  }, 12000);
  setInterval(() => {
    if (!onboardingComplete || gone || bubble.classList.contains('show')) return;
    const pool = comfort >= 10 ? phrases.idleRich : comfort >= 4 ? phrases.idle : phrases.idlePoor;
    say(pick(pool));
  }, 14000);
  setInterval(() => {
    if (!onboardingComplete || gone || mistressLevel < 1) return;
    const tease = MISTRESS_TEASE[fetish];
    say(tease && Math.random() < 0.5 ? tease : pick(MISTRESS_IDLE));
  }, 30000);

  pet.addEventListener('click', () => {
    if (suppressPetClick) { suppressPetClick = false; return; } // это был бросок, не клик
    if (gone) { sfx.deny(); return; }
    state.mood += 2;
    calm(3);
    act('act-eat', 'happy', 500);
    tone(520, 640, 0.08, 'sine', 0.15);
    drumHat(beatTime(), 0.12);
    burst(['✚', '░'], 3);
    // изучение подопытного для досье
    if (!dossierUnlocked) {
      petClicks++;
      if (petClicks >= 10) {
        dossierUnlocked = true;
        sfx.gem();
        say(`Наблюдение завершено. Склонность: ${fetish}.`);
        burst(['✦', '▓'], 5);
      }
    }
    render();
  });

  /* ---------- справка по параметрам ---------- */
  const STAT_INFO = {
    hp:      { t: 'HP — здоровье', d: 'Достигнет нуля — подопытный мёртв. Смерть обнуляет всю обстановку комнаты. Лечится кормёжкой (слабо) и медленно сам при сытости выше 30.', up: '▲ Покормить (+5), сытость > 30 (+0.2/тик)', down: '▼ Ударить (−5), Выпороть (−5), Пнуть (−7), каждый час отсутствия (−12, тело снижает урон). Склонность «Боль»: весь урон ×1.5' },
    food:    { t: 'Сытость', d: 'Голодный подопытный не лечится. Ниже 30 регенерация HP останавливается. ПЕРЕКОРМ: кормить при сытости выше 85 — вредно: здоровье −4, настроение −5, достоинство −2, агрессия +6.', up: '▲ Покормить (+14)', down: '▼ Таит со временем (−0.6/тик), Ударить (−4). Перекорм бьёт по здоровью' },
    mood:    { t: 'Настроение', d: 'Определяет лицо и реплики. Низкое настроение вместе с низким достоинством делает его злым.', up: '▲ Потакание, Покормить (+3), клик по подопытному (+2), крысы с крошками (+3)', down: '▼ Таит со временем (−0.4/тик), Ударить (−14), Унизить (−8). Склонность «Футфетиш»: тает вдвое быстрее' },
    dignity: { t: 'Достоинство — цена труда', d: 'Пока достоинство живо, порка приносит премию: до ×1.5 к монетам. Если упадёт до нуля — дух сломлен НАВСЕГДА: раб остаётся на коленях, дань режется до ×0.5, и вернуть достоинство уже нельзя. Низкое достоинство видно: он заросший и неухоженный. Бритва (+20) приводит его в порядок, но лезвие может порезать — порезы оставляют шрамы навсегда.', up: '▲ Бритва (+20, расходник 30 монет), роскошная обстановка (комфорт ≥ 4: +0.15/тик), Покормить (+4), оковы на склонности «Оковы»', down: '▼ Унизить (−15), Выпороть (−8), перекорм (−2), тает со временем только при настроении ниже 40 (−0.15/тик). Потакание при склонности «Унижение» (−6)' },
    fear:    { t: 'Страх', d: 'Держит подопытного в напряжении. Сам по себе не вредит, но высокая агрессия на фоне страха ведёт к бунту.', up: '▲ Ударить (+10), Пнуть (+15), Выпороть (+6)', down: '▼ Таит со временем (−0.3/тик)' },
    obed:    { t: 'Послушание', d: 'Показатель контроля. Растёт от потакания и унижения.', up: '▲ Потакание (+12…+22, зависит от склонности), Унизить (+6)', down: '▼ Ударить (−3), Пнуть (−8), оковы на склонности «Оковы» (−0.3/тик)' },
    need:    { t: 'Нужда', d: 'Накопленная жажда потакания. При 100 потребность удовлетворяется: настроение +10. Клятва (алмаз) выпадает только если потакание «задевает» его склонность подходящим предметом — шанс 5%.', up: '▲ Потакание (+25, «Футфетиш»: +50)', down: '▼ Сгорает при удовлетворении (100 → 0)' },
    tribute: { t: 'Ожидаемая дань', d: 'Монеты за одну порку. Складывается из: базы (растёт от ударов и унижений), снаряжения (+0.5 за ошейник/кнут/пояс), характера лица, обстановки комнаты (+4% за уровень) и достоинства (×0.5…×1.5).', up: '▲ Ударить/Унизить (+0.01 к базе, «Унижение» +0.02), снаряжение, мебель, высокое достоинство', down: '▼ Слом духа навсегда фиксирует достоинство на ×0.5' }
  };
  document.querySelectorAll('.stat[data-stat]').forEach(el => {
    el.addEventListener('click', () => {
      const info = STAT_INFO[el.dataset.stat];
      if (!info) return;
      $('stat-title').textContent = info.t.toUpperCase();
      $('stat-desc').textContent = info.d;
      $('stat-up').textContent = info.up;
      $('stat-down').textContent = info.down;
      openModal('stat-modal');
      sfx.coin();
    });
  });

  /* ---------- досье ---------- */
  function renderDossier() {
    $('dossier-locked').style.display = dossierUnlocked ? 'none' : '';
    $('dossier-open').style.display = dossierUnlocked ? '' : 'none';
    if (dossierUnlocked) {
      $('dossier-fetish').textContent = fetish;
      $('dossier-bonus').textContent = FETISH_FX[fetish].bonus;
      $('dossier-risk').textContent = FETISH_FX[fetish].risk;
    } else {
      $('dossier-progress').textContent = 'Изучено: ' + Math.min(petClicks, 10) + '/10 кликов';
      $('dossier-buy').disabled = state.coins < 50;
    }
  }
  $('btn-dossier').addEventListener('click', () => { renderDossier(); openModal('dossier-modal'); sfx.coin(); });
  $('dossier-buy').addEventListener('click', () => {
    if (dossierUnlocked || state.coins < 50) { sfx.deny(); return; }
    state.coins -= 50;
    dossierUnlocked = true;
    sfx.gem();
    burst(['✦', '▓'], 6);
    say(`Эксперты доставили заключение. Склонность: ${fetish}.`);
    renderDossier();
    render();
  });

  /* ---------- хватание, бросок и жизнь в комнате ---------- */
  let dragSt = null;
  let suppressPetClick = false;
  let petBusyUntil = 0; // падает/сидит — не перебивать
  const chained = () => restraints.handcuffs || restraints.shackles;

  function arenaBounds() {
    const ar = document.querySelector('.arena').getBoundingClientRect();
    // справа висит панель статуса — туда почти не ходим, влево свободнее
    return { minX: -ar.width * 0.27, maxX: ar.width * 0.07, minY: -ar.height * 0.16, maxY: ar.height * 0.03 };
  }
  function setPetOff(x, y, transition = 'transform 0.5s ease', rot = 0) {
    const b = arenaBounds();
    petOff.x = Math.max(b.minX, Math.min(b.maxX, x));
    petOff.y = Math.max(b.minY, Math.min(b.maxY, y));
    petPos.style.transition = transition;
    petPos.style.transform = `translate(${petOff.x}px, ${petOff.y}px) rotate(${rot}deg)`;
  }

  pet.addEventListener('pointerdown', e => {
    if (!onboardingComplete || gone) return;
    dragSt = { sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, lt: performance.now(), vx: 0, vy: 0, peak: 0, moved: false };
    try { pet.setPointerCapture(e.pointerId); } catch (err) {}
  });
  pet.addEventListener('pointermove', e => {
    if (!dragSt) return;
    const now = performance.now();
    const dt = Math.max(1, now - dragSt.lt);
    dragSt.vx = (e.clientX - dragSt.lx) / dt * 1000;
    dragSt.vy = (e.clientY - dragSt.ly) / dt * 1000;
    dragSt.peak = Math.max(dragSt.peak, Math.hypot(dragSt.vx, dragSt.vy));
    dragSt.lx = e.clientX; dragSt.ly = e.clientY; dragSt.lt = now;
    const dx = e.clientX - dragSt.sx, dy = e.clientY - dragSt.sy;
    if (Math.hypot(dx, dy) > 8) dragSt.moved = true;
    if (dragSt.moved) {
      suppressPetClick = true;
      petBusyUntil = Date.now() + 600;
      pet.classList.add('held');
      pet.classList.remove('sitting');
      petPos.style.transition = 'none';
      const rot = Math.max(-14, Math.min(14, dx * 0.06));
      petPos.style.transform = `translate(${petOff.x + dx * 0.7}px, ${petOff.y + dy * 0.7}px) rotate(${rot}deg)`;
      if (Math.random() < 0.08) addAggr(0.5); // ему не нравится
    }
  });
  function endDrag() {
    if (!dragSt) return;
    const d = dragSt; dragSt = null;
    pet.classList.remove('held');
    if (!d.moved) return;
    const speed = Math.max(Math.hypot(d.vx, d.vy), d.peak * 0.85);
    const dx = d.lx - d.sx, dy = d.ly - d.sy;
    const ang = Math.atan2(d.vy, d.vx);
    const fling = Math.min(90, speed * 0.05);
    const nx = petOff.x + dx * 0.7 + Math.cos(ang) * fling;
    const ny = petOff.y + dy * 0.7 + Math.sin(ang) * fling;
    if (chained()) {
      // оковы: подброс — и цепи возвращают на привязь
      petPos.style.transition = 'transform 0.12s ease-in';
      petPos.style.transform = `translate(${nx}px, ${ny}px) rotate(${Math.max(-20, Math.min(20, d.vx * 0.012))}deg)`;
      setTimeout(() => setPetOff(petOff.x, petOff.y, 'transform 0.55s cubic-bezier(0.2, 1.5, 0.4, 1)'), 140);
    } else {
      // свободен: падает там, где брошен, потом поднимается
      setPetOff(nx, ny, 'transform 0.32s cubic-bezier(0.3, 1.1, 0.4, 1)');
      if (speed > 420) {
        petBusyUntil = Date.now() + 1800;
        setTimeout(() => { if (!gone) pet.classList.add('fallen'); }, 330);
        setTimeout(() => { pet.classList.remove('fallen'); pet.classList.add('rising'); }, 1250);
        setTimeout(() => pet.classList.remove('rising'), 1800);
      }
    }
    if (!onboardingComplete || gone) return;
    if (speed > 420) {
      const dmg = Math.min(10, 1 + Math.round(speed / 400));
      state.hp -= Math.max(1, Math.round(dmg * dmgFactor()));
      addAggr(3 + dmg * 0.5);
      addMark('bruise');
      act('act-hit', 'squint', 650);
      sfx.thud();
      drumTom(beatTime(), 0.5);
      burst(['✕', '◢', '▓'], 6);
      say(pick(chained() ? phrases.thrown : phrases.fallen));
      questProgress('throw', 1);
      if (!chained()) questProgress('throwFree', 1);
      render();
      checkDeath(); checkEscape();
    } else {
      tone(300, 220, 0.1, 'sine', 0.08);
    }
  }
  pet.addEventListener('pointerup', endDrag);
  pet.addEventListener('pointercancel', endDrag);

  /* ---------- он живёт в комнате: подходит к обстановке ---------- */
  const WANDER_SPOTS = [
    { key: 'window', has: () => room.window >= 1, x: -0.26, y: -0.10, sit: false, lines: () => phrases.window },
    { key: 'chair',  has: () => room.chair >= 2,  x: -0.20, y: 0.05,  sit: true,  lines: () => phrases.chair },
    { key: 'bed',    has: () => room.bed >= 2,    x: 0.06,  y: 0.05,  sit: false, lines: () => phrases.bed },
    { key: 'trash',  has: () => true,             x: 0.22,  y: 0.10,  sit: false, lines: () => phrases.trash }
  ];
  setInterval(() => {
    if (!onboardingComplete || gone || dragSt || chained() || Date.now() < petBusyUntil) return;
    const spots = WANDER_SPOTS.filter(s => s.has());
    if (spots.length && Math.random() < 0.65) {
      const s = pick(spots);
      const ar = document.querySelector('.arena').getBoundingClientRect();
      setPetOff(s.x * ar.width, s.y * ar.height, 'transform 1.2s ease-in-out');
      petBusyUntil = Date.now() + (s.sit ? 5600 : 2600);
      setTimeout(() => {
        if (gone || dragSt || chained()) return;
        if (!bubble.classList.contains('show')) say(pick(s.lines()));
        if (s.sit) {
          pet.classList.add('sitting');
          setTimeout(() => pet.classList.remove('sitting'), 4000);
        }
      }, 1300);
    } else if ((petOff.x || petOff.y) && Math.random() < 0.5) {
      setPetOff(0, 0, 'transform 1.2s ease-in-out'); // вернулся на своё место
    }
  }, 9000);

  /* ================= СОХРАНЕНИЕ И TELEGRAM ================= */
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    try { tg.ready(); tg.expand(); } catch (e) {}
  }
  const initData = tg && typeof tg.initData === 'string' ? tg.initData.trim() : '';
  const startParam = tg && tg.initDataUnsafe ? tg.initDataUnsafe.start_param || '' : '';
  const referralParam = new URLSearchParams(window.location.search).get('ref') || (startParam.startsWith('ref_') ? startParam.slice(4) : '');
  const referralId = /^\d+$/.test(referralParam) ? Number(referralParam) : null;
  const telegramUserId = tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : 'demo';
  const LOCAL_PROGRESS_KEY = 'p001_progress_' + telegramUserId;
  const API_BASE = (document.querySelector('meta[name="p001-api-url"]')?.content || '').replace(/\/+$/, '');
  let persistenceReady = false;
  let saveAfterLoad = false;
  let saveTimer = null;
  let saveInFlight = false;
  let saveAgain = false;
  let slavesKilled = 0;
  let oldestSlaveAgeDays = 0;
  let oldestSlaveAgeHours = 0;
  let oldestSlaveNo = 1;
  function newSlaveUid() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
    return `slave-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  let slaveUid = newSlaveUid();
  let slaveBornAt = Date.now();
  let slaveEndedAt = null;
  let slaveEndReason = null;
  let vipStatus = false;

  function isObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
  function currentSlaveAgeDays() {
    return Math.max(0, Math.floor(((slaveEndedAt || Date.now()) - slaveBornAt) / 86400000));
  }
  function currentSlaveAgeHours() {
    return Math.max(0, Math.floor(((slaveEndedAt || Date.now()) - slaveBornAt) / 3600000));
  }
  function updateOldestSlaveAge() {
    oldestSlaveAgeHours = currentSlaveAgeHours();
    oldestSlaveAgeDays = currentSlaveAgeDays();
    oldestSlaveNo = slaveNo;
  }
  function snapshot() {
    return {
      version: 1, slaveNo, slaveUid, state: { ...state }, fetish, rareFetish, spiritBroken, face, onboardingComplete,
      owned: { ...owned }, ownedOutfits: { ...ownedOutfits }, equipped: { ...equipped },
      ownedProfileCards: { ...ownedProfileCards }, profileCard, displayName, nicknameChanges,
      beltLevel, beltWorn, beltBroken, baseMult,
      restraints: { ...restraints }, restraintsOwned: { ...restraintsOwned },
      room: { ...room }, decorVar: { ...decorVar }, decorVarOwned: { ...decorVarOwned },
      dossierUnlocked, petClicks, quest, weekly, mquest, mistressLevel,
      slaveBody: { ...slaveBody }, junk: { ...junk }, artifacts: { ...artifacts }, razors,
      gone, slaveBornAt, slaveEndedAt, slaveEndReason, slavesKilled, oldestSlaveAgeDays,
      oldestSlaveAgeHours, oldestSlaveNo, indulgeCdUntil, trashPokes, trashRefillAt
    };
  }
  function saveRequestBody() {
    updateOldestSlaveAge();
    return JSON.stringify({
      initData,
      stats: {
        coins: Math.max(0, Math.floor(state.coins)),
        crystals: Math.max(0, Math.floor(state.gems)),
        slaves_killed: slavesKilled,
        current_slave_stats: snapshot(),
        vip_status: vipStatus,
        oldest_slave_age_days: oldestSlaveAgeDays,
        oldest_slave_age_hours: oldestSlaveAgeHours,
        oldest_slave_no: oldestSlaveNo
      }
    });
  }
  function storeLocalProgress() {
    updateOldestSlaveAge();
    try { localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(snapshot())); } catch (e) {}
  }
  function readLocalProgress() {
    try { return JSON.parse(localStorage.getItem(LOCAL_PROGRESS_KEY) || 'null'); } catch (e) { return null; }
  }
  async function postProgress(path) {
    const response = await fetch(API_BASE + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: saveRequestBody()
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }
  async function saveProgress() {
    if (!persistenceReady || !initData) return;
    if (saveInFlight) { saveAgain = true; return; }
    saveInFlight = true;
    try {
      const requestedCoins = Math.floor(state.coins);
      const requestedGems = Math.floor(state.gems);
      const player = await postProgress('/api/save_data');
      const coinDelta = Math.floor(state.coins) - requestedCoins;
      const gemDelta = Math.floor(state.gems) - requestedGems;
      applyPlayerIdentity(player);
      state.coins += coinDelta;
      state.gems += gemDelta;
      slavesKilled = Math.max(slavesKilled, player.slaves_killed || 0);
      oldestSlaveAgeDays = Math.max(0, Math.floor(player.oldest_slave_age_days || 0));
      oldestSlaveAgeHours = Math.max(0, Math.floor(player.oldest_slave_age_hours || 0));
      oldestSlaveNo = Math.max(1, Math.floor(player.oldest_slave_no || 1));
      render();
    } catch (error) {
      console.warn('Не удалось сохранить прогресс:', error);
    } finally {
      saveInFlight = false;
      if (saveAgain) { saveAgain = false; scheduleSave(); }
    }
  }
  function scheduleSave(immediate = false) {
    if (!persistenceReady) { saveAfterLoad = true; return; }
    storeLocalProgress();
    if (!initData) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveProgress, immediate ? 0 : 600);
  }

  function restoreProgress(saved, player) {
    if (!isObject(saved)) return;
    if (isObject(saved.state)) {
      for (const key of Object.keys(state)) {
        if (Number.isFinite(saved.state[key])) state[key] = saved.state[key];
      }
    }
    slaveNo = Number.isFinite(saved.slaveNo) ? Math.max(1, Math.floor(saved.slaveNo)) : slaveNo;
    slaveUid = typeof saved.slaveUid === 'string' && saved.slaveUid.length <= 80 ? saved.slaveUid : newSlaveUid();
    if ([...FETISHES, ...SECRET_FETISHES].includes(saved.fetish)) fetish = saved.fetish;
    if (FACE_FX[saved.face]) face = saved.face;
    rareFetish = !!saved.rareFetish;
    spiritBroken = !!saved.spiritBroken;
    dossierUnlocked = !!saved.dossierUnlocked;
    petClicks = Number.isFinite(saved.petClicks) ? saved.petClicks : 0;
    if (isObject(saved.owned)) owned = { ...owned, ...saved.owned };
    if (isObject(saved.ownedOutfits)) ownedOutfits = { ...ownedOutfits, ...saved.ownedOutfits };
    if (isObject(saved.equipped)) equipped = { ...equipped, ...saved.equipped };
    if (isObject(saved.ownedProfileCards)) {
      for (const key of Object.keys(PROFILE_CARDS)) {
        if (saved.ownedProfileCards[key]) ownedProfileCards[key] = true;
      }
    }
    if (PROFILE_CARDS[saved.profileCard] && ownedProfileCards[saved.profileCard]) profileCard = saved.profileCard;
    if (!player) {
      displayName = normalizedNickname(saved.displayName || displayName).slice(0, 24) || 'Игрок';
      nicknameChanges = Math.max(0, Math.floor(saved.nicknameChanges || 0));
    }
    beltLevel = Math.max(0, Math.min(3, Math.floor(saved.beltLevel) || 0));
    beltWorn = Math.max(0, Math.min(beltLevel, Math.floor(saved.beltWorn) || 0));
    beltBroken = !!saved.beltBroken;
    if (Number.isFinite(saved.baseMult)) baseMult = Math.max(1, saved.baseMult);
    if (isObject(saved.restraints)) restraints = { ...restraints, ...saved.restraints };
    if (isObject(saved.restraintsOwned)) restraintsOwned = { ...restraintsOwned, ...saved.restraintsOwned };
    if (isObject(saved.room)) {
      for (const key of Object.keys(room)) {
        if (Number.isFinite(saved.room[key])) room[key] = Math.max(0, Math.min(SLOTS[key].tiers.length - 1, Math.floor(saved.room[key])));
      }
    }
    comfort = calcComfort();
    if (isObject(saved.decorVar)) decorVar = { ...saved.decorVar };
    if (isObject(saved.decorVarOwned)) decorVarOwned = { ...saved.decorVarOwned };
    if (isObject(saved.quest) && QUEST_POOL.some(q => q.id === saved.quest.id)) quest = saved.quest;
    if (isObject(saved.weekly) && Array.isArray(saved.weekly.quests)) weekly = saved.weekly;
    if (saved.mquest === null || (isObject(saved.mquest) && MQUEST_POOL.some(q => q.id === saved.mquest.id))) mquest = saved.mquest;
    if (Number.isFinite(saved.mistressLevel)) mistressLevel = Math.max(0, Math.min(MISTRESS.length - 1, Math.floor(saved.mistressLevel)));
    if (isObject(saved.slaveBody) && Number.isFinite(saved.slaveBody.h) && Number.isFinite(saved.slaveBody.w)) slaveBody = { ...saved.slaveBody };
    if (isObject(saved.junk)) junk = { ...saved.junk };
    if (isObject(saved.artifacts)) artifacts = { ...artifacts, ...saved.artifacts };
    razors = Math.max(0, Math.floor(saved.razors) || 0);
    gone = !!saved.gone;
    slaveBornAt = Number.isFinite(saved.slaveBornAt) ? Math.min(Date.now(), saved.slaveBornAt) : Date.now();
    slaveEndedAt = Number.isFinite(saved.slaveEndedAt) ? saved.slaveEndedAt : null;
    slaveEndReason = ['death', 'escape'].includes(saved.slaveEndReason) ? saved.slaveEndReason : null;
    slavesKilled = player
      ? Math.max(slavesKilled, Math.floor(player.slaves_killed) || 0)
      : Math.max(Math.floor(saved.slavesKilled) || 0, slavesKilled);
    updateOldestSlaveAge();
    vipStatus = player ? !!player.vip_status : vipStatus;
    indulgeCdUntil = Math.max(0, saved.indulgeCdUntil || 0);
    trashPokes = Math.max(0, Math.floor(saved.trashPokes ?? trashPokes));
    trashRefillAt = Math.max(0, saved.trashRefillAt || 0);

    $('slave-no').textContent = padNo();
    $('scene-slave-tag').textContent = slaveDisplayName();
    for (const item of ['collar', 'gag', 'gear-whip']) $(item).setAttribute('opacity', owned[item] ? 1 : 0);
    for (const key of ['handcuffs', 'shackles']) $(key).setAttribute('opacity', restraints[key] ? 1 : 0);
    $('face-haggard').setAttribute('opacity', face === 'haggard' ? 1 : 0);
    browL.setAttribute('transform', face === 'bold' ? 'rotate(10 91 32)' : '');
    browR.setAttribute('transform', face === 'bold' ? 'rotate(-10 109 32)' : '');
    pet.classList.toggle('dead', gone && slaveEndReason === 'death');
    pet.classList.toggle('escape', gone && slaveEndReason === 'escape');
    onboardingComplete = onboardingComplete || saved.onboardingComplete === true;
    if (onboardingComplete) {
      document.body.classList.add('game-ready');
      closeModal('start-modal');
    }
    if (gone && slaveEndReason === 'death') openModal('death');
    if (gone && slaveEndReason === 'escape') openModal('escape-modal');
    applyOutfit(); applyMistress(); applyBody(); applyDecor(); opLabel(); render();
  }

  async function loadSavedProgress() {
    let player = null;
    let saved = null;
    if (initData) {
      try {
        const response = await fetch(API_BASE + '/api/load_data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData, referrer_id: referralId })
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        player = await response.json();
        saved = player.current_slave_stats;
      } catch (error) {
        console.warn('Не удалось загрузить прогресс с сервера:', error);
      }
    }
    if (!isObject(saved) || !Object.keys(saved).length) saved = readLocalProgress();
    if (isObject(saved) && !onboardingComplete) restoreProgress(saved, player);
    if (player) {
      applyPlayerIdentity(player);
      $('start-nickname').value = displayName;
      vipStatus = !!player.vip_status;
      render();
    }
    if (!initData) {
      const message = tg
        ? 'Telegram не передал initData. Прогресс сохраняется только на этом устройстве. Перезапустите игру кнопкой «🎮 Играть».'
        : 'Браузерный режим: прогресс сохраняется только на этом устройстве.';
      $('start-nickname-note').textContent = message;
      if (onboardingComplete) say(message);
      console.warn(message);
    }
    persistenceReady = true;
    if (saveAfterLoad) { saveAfterLoad = false; scheduleSave(); }
  }

  const SAVE_ACTIONS = '#btn-feed, #btn-hit, #btn-shame, #btn-whip, #btn-indulge, #scene-kick, #scene-indulge, #btn-new-death, #btn-new-escape, #btn-start, #btn-mistress, #dossier-buy, #mg-play, #op-h button, #op-w button, .buy, .vdot';
  document.addEventListener('click', event => {
    if (event.target.closest(SAVE_ACTIONS)) scheduleSave();
  }, true);
  $('trash-pit').addEventListener('pointerdown', () => scheduleSave());
  pet.addEventListener('pointerup', () => scheduleSave());
  window.addEventListener('pagehide', () => {
    if (!persistenceReady) return;
    storeLocalProgress();
    if (!initData) return;
    fetch(API_BASE + '/api/save_data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: saveRequestBody(), keepalive: true
    }).catch(() => {});
  });
  setInterval(() => scheduleSave(), 30000);

  applyOutfit();
  applyMistress();
  applyBody();
  opLabel();
  applyCensorship();
  loadSavedProgress();

  // отладочный доступ для тестов
  window.__game = {
    get state() { return state; },
    get comfort() { return comfort; },
    get room() { return room; },
    get fetish() { return fetish; },
    set fetish(v) { fetish = v; },
    get dossierUnlocked() { return dossierUnlocked; },
    get petClicks() { return petClicks; },
    get quest() { return quest; },
    set quest(v) { quest = v; },
    get restraints() { return restraints; },
    get spiritBroken() { return spiritBroken; },
    get petOff() { return petOff; },
    get razors() { return razors; },
    get beltWorn() { return beltWorn; },
    get beltLevel() { return beltLevel; },
    get decorVar() { return decorVar; },
    get decorVarOwned() { return decorVarOwned; },
    get equipped() { return equipped; },
    fetishMatched, questProgress,
    render, applyDecor, checkDeath, checkEscape,
    get weekly() { return weekly; }, set weekly(v) { weekly = v; },
    get mquest() { return mquest; }, set mquest(v) { mquest = v; },
    get mistressLevel() { return mistressLevel; }, set mistressLevel(v) { mistressLevel = v; },
    get rareFetish() { return rareFetish; }, set rareFetish(v) { rareFetish = v; },
    applyMistress, newMistressQuest, maybeRareModal, renderQuests,
    get mgMusicOn() { return !!mgMusic; }, dmgFactor,
    setCd(v) { indulgeCdUntil = v; },
    get junk() { return junk; }, get artifacts() { return artifacts; },
    get slaveBody() { return slaveBody; }, get trashPokes() { return trashPokes; },
    craft, operate
  };
})();
