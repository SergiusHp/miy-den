/* =================================================================
   «МІЙ ДЕНЬ» — логіка застосунку
   Розділи:
     1. Допоміжні функції (дати, збереження, підказки)
     2. Навігація між екранами
     3. Ілюстрації онбордингу
     4. Планувальник «Мій день»
     5. Шторка «Нова справа»
     6. Таймер «Фокус»
     7. Цілі (рік / місяць / день)
     8. Рамка телефону на ПК
   ================================================================= */
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------------------------------------------------------------
     1. ДОПОМІЖНІ ФУНКЦІЇ
     --------------------------------------------------------------- */

  // Назви днів і місяців українською
  const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  const DAYS_FULL = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота', 'Неділя'];
  const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
                      'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  const MONTHS_NOM = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
                      'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];

  // Дата → ключ «РРРР-ММ-ДД»
  const keyOf = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const weekdayIdx = (d) => (d.getDay() + 6) % 7;            // 0 = понеділок
  const startOfWeek = (d) => addDays(d, -weekdayIdx(d));
  const todayKey = () => keyOf(new Date());

  // Збереження в браузері (може бути недоступне — тоді просто працюємо без нього)
  const store = {
    get(name, fallback) {
      try { const v = localStorage.getItem('mydays.' + name); return v ? JSON.parse(v) : fallback; }
      catch (e) { return fallback; }
    },
    set(name, value) {
      try { localStorage.setItem('mydays.' + name, JSON.stringify(value)); } catch (e) { /* без збереження */ }
    }
  };

  // Коротке повідомлення вгорі екрана
  const toastEl = $('#toast');
  let toastTimer;
  // text — повідомлення; action — необовʼязкова кнопка { label, run } (напр. «Повернути»)
  function toast(text, action) {
    toastEl.textContent = text;
    toastEl.classList.toggle('has-action', !!action);
    if (action) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = action.label;
      btn.addEventListener('click', () => { toastEl.classList.remove('show'); action.run(); }, { once: true });
      toastEl.append(btn);
    }
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), action ? 4500 : 2400);
  }

  // --- Анімації (вимикаються, якщо в системі ввімкнено «менше руху») ---
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const screenEl = $('#app');
  // Масштаб «телефону» на ПК (щоб частинки й свайп рахувались у правильних пікселях)
  const screenScale = () => screenEl.getBoundingClientRect().width / screenEl.offsetWidth || 1;

  // FLIP: запамʼятовуємо позиції елементів [data-flip], оновлюємо список і плавно «доїжджаємо»
  function flip(container, update) {
    const before = new Map();
    container.querySelectorAll('[data-flip]').forEach((el) => before.set(el.dataset.flip, el.getBoundingClientRect()));
    update();
    if (reduceMotion) return;
    const k = screenScale();
    container.querySelectorAll('[data-flip]').forEach((el) => {
      const b = before.get(el.dataset.flip);
      if (!b) {
        el.animate([{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'ease-out' });
        return;
      }
      const a = el.getBoundingClientRect();
      const dx = (b.left - a.left) / k, dy = (b.top - a.top) / k;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
                   { duration: 420, easing: 'cubic-bezier(.2, .8, .2, 1)' });
      }
    });
  }

  // Частинки-конфеті з точки елемента. kind: 'joy' — святкові, 'dust' — сірий пил при видаленні
  const BURST_COLORS = { joy: ['#e2bd73', '#2f9b70', '#7cc1a0', '#f3d79a', '#5b8fc3', '#ecc1a3'],
                         dust: ['#c9c2b4', '#b5ae9f', '#ddd6c8', '#a59f92'] };
  function burst(fromEl, kind = 'joy') {
    if (reduceMotion) return;
    const k = screenScale();
    const sr = screenEl.getBoundingClientRect(), r = fromEl.getBoundingClientRect();
    const x = (r.left + r.width / 2 - sr.left) / k, y = (r.top + r.height / 2 - sr.top) / k;
    const colors = BURST_COLORS[kind];
    const count = kind === 'joy' ? 16 : 12;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('i');
      p.className = 'particle';
      const size = 4 + Math.random() * 4;
      p.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${kind === 'joy' && i % 3 === 0 ? size * 1.8 : size}px;background:${colors[i % colors.length]}`;
      screenEl.append(p);
      const angle = (kind === 'joy' ? Math.random() * 2 * Math.PI : Math.PI + (Math.random() - 0.5) * 1.6);
      const dist = (kind === 'joy' ? 28 : 40) + Math.random() * 38;
      const tx = Math.cos(angle) * dist, ty = Math.sin(angle) * dist + (kind === 'joy' ? 18 : 6);
      p.animate([
        { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(.6) rotate(${Math.random() * 360}deg)`, opacity: 0 }
      ], { duration: 650 + Math.random() * 250, easing: 'cubic-bezier(.15, .7, .3, 1)' }).onfinish = () => p.remove();
    }
  }
  const haptic = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* без вібрації */ } };

  // Відмінювання: 1 сесія, 2 сесії, 5 сесій
  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  /* ---------------------------------------------------------------
     2. НАВІГАЦІЯ МІЖ ЕКРАНАМИ
     Назви екранів: splash, onb1, onb2, onb3, day, focus, goals
     --------------------------------------------------------------- */
  const app = $('#app');
  const screens = $$('.scr');
  const SCREEN_NAMES = screens.map((s) => s.dataset.name);

  function go(name) {
    if (!SCREEN_NAMES.includes(name)) return;
    const current = $('.scr.active');
    const next = $(`.scr[data-name="${name}"]`);
    if (current === next) return;
    if (current) {
      current.classList.remove('active');
      current.classList.add('leaving');
      setTimeout(() => current.classList.remove('leaving'), 460);
    }
    next.classList.add('active');
    app.dataset.screen = name;
    $$('.sheet-wrap').forEach((w) => { w.hidden = true; });   // відкриті шторки не «переїжджають» на інший екран
    document.body.classList.toggle('bg-focus', name === 'focus');  // фон на ПК
    if (name === 'focus') syncFocusChip();
    if (name === 'goals') renderGoals();
    // Підсвічуємо активну вкладку в нижньому меню
    $$('#tabbar button[data-go]').forEach((b) => b.classList.toggle('on', b.dataset.go === name));
    try { history.replaceState(null, '', '#' + name); } catch (e) { /* ігноруємо */ }
  }

  // Кнопки з атрибутом data-go="назва екрана"
  document.addEventListener('click', (e) => {
    const goBtn = e.target.closest('[data-go]');
    if (goBtn) { go(goBtn.dataset.go); return; }
    const soonBtn = e.target.closest('[data-soon]');
    if (soonBtn) toast(`Розділ «${soonBtn.dataset.soon}» зʼявиться в наступній версії`);
  });

  /* ---------------------------------------------------------------
     3. ІЛЮСТРАЦІЇ ОНБОРДИНГУ (клітинки «Тиждень» і крапки «Місяць»)
     --------------------------------------------------------------- */
  (function buildIllustrations() {
    // Кольори клітинок тижня: s — шавлія, t — бірюза, g — золото, p — персик, '' — порожня
    const pattern = ['', 's', '', 't', '', '',
                     'g', '', 't', '', 'p', '',
                     '', 'p', '', '', 's', 'g',
                     's', '', 'g', '', '', 't',
                     '', 't', '', 's', '', ''];
    const colors = { s: '#a9c4b4', t: '#7ea6a0', g: '#e7c98f', p: '#ecc1a3' };
    $('#illuWeek').innerHTML = pattern
      .map((c) => `<i${c ? ` style="background:${colors[c]}"` : ''}></i>`).join('');

    // Крапки місяця: одна золота (сьогодні) й одна темна (важлива подія)
    let dots = '';
    for (let i = 0; i < 35; i++) dots += `<i${i === 11 ? ' class="gold"' : i === 24 ? ' class="dark"' : ''}></i>`;
    $('#illuMonth').innerHTML = dots;
  })();

  /* ---------------------------------------------------------------
     4. ПЛАНУВАЛЬНИК «МІЙ ДЕНЬ»
     Справи зберігаються так: { "2026-10-07": [ {id, start, end, title, sub, cat, done} ] }
     cat: spirit (духовне) | work (справи) | priority (пріоритет) | important (важливо)
     --------------------------------------------------------------- */

  // Приклад дня — як у макеті. Додається, коли справ ще немає взагалі.
  const SAMPLE_DAY = [
    { start: '06:30', end: '',      title: 'Ранкова молитва',     sub: '30 хв',                cat: 'spirit',    done: true },
    { start: '07:00', end: '08:00', title: 'Читання Біблії',      sub: '1 год',                cat: 'spirit',    done: true },
    { start: '09:00', end: '10:30', title: 'Робота над проєктом', sub: 'Головний пріоритет',   cat: 'priority',  done: false },
    { start: '12:00', end: '13:00', title: 'Обід',                sub: 'Перерва',              cat: 'work',      done: false },
    { start: '15:00', end: '16:00', title: 'Планування тижня',    sub: 'Організаційні справи', cat: 'work',      done: false },
    { start: '18:00', end: '19:00', title: 'Час з родиною',       sub: 'Важливо',              cat: 'important', done: false }
  ];

  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  let tasks = store.get('tasks', null);
  if (!tasks) {
    tasks = { [todayKey()]: SAMPLE_DAY.map((t) => ({ ...t, id: newId() })) };
    store.set('tasks', tasks);
  }
  const saveTasks = () => store.set('tasks', tasks);
  const tasksFor = (k) => (tasks[k] || []).slice().sort((a, b) => a.start.localeCompare(b.start));

  let selectedKey = todayKey();          // обраний день
  let monthCursor = new Date();          // місяць у виді «Місяць»
  let view = 'day';                      // day | week | month

  // --- Вірші дня (натискання на картку показує наступний) ---
  const VERSES = [
    ['Усе, що робите, робіть від серця, як для Господа, а не для людей.', 'Колосян 3:23'],
    ['Шукайте ж найперше Царства Божого й правди Його, а все це вам додасться.', 'Матвія 6:33'],
    ['Повір Господеві діла свої, і будуть міцні твої задуми.', 'Приповісті 16:3'],
    ['Навчи нас лічити наші дні, щоб ми набули серця мудрого!', 'Псалом 90:12'],
    ['Будьте спокійні й знайте, що Я — Бог.', 'Псалом 46:11']
  ];
  let verseIdx = 0;
  $('#verse').addEventListener('click', () => {
    verseIdx = (verseIdx + 1) % VERSES.length;
    $('#verseText').textContent = VERSES[verseIdx][0];
    $('#verseRef').textContent = VERSES[verseIdx][1];
  });

  // --- Перемикач День / Тиждень / Місяць ---
  $('#viewSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view]');
    if (b) setView(b.dataset.view);
  });
  function setView(v) {
    view = v;
    $$('#viewSeg button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
    $$('.view').forEach((el) => { el.hidden = el.dataset.view !== v; });
    renderPlanner();
  }

  function renderPlanner() {
    if (view === 'day') { renderDateRow(); renderWeekStrip(); renderTasks(); }
    if (view === 'week') renderWeekList();
    if (view === 'month') renderMonth();
  }

  // Підпис дати: «Сьогодні, 7 жовтня» або «Пʼятниця, 9 жовтня»
  function renderDateRow() {
    const d = fromKey(selectedKey);
    const prefix = selectedKey === todayKey() ? 'Сьогодні' : DAYS_FULL[weekdayIdx(d)];
    $('#dateLabel').textContent = `${prefix}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  }

  // Тижнева стрічка Пн–Нд
  function renderWeekStrip() {
    const start = startOfWeek(fromKey(selectedKey));
    const tk = todayKey();
    $('#weekStrip').innerHTML = DAYS_SHORT.map((name, i) => {
      const d = addDays(start, i), k = keyOf(d);
      const cls = [k === selectedKey ? 'sel' : '', k === tk ? 'today' : ''].join(' ').trim();
      return `<button data-key="${k}" class="${cls}" aria-label="${d.getDate()} ${MONTHS_GEN[d.getMonth()]}">
                <small>${name}</small><b>${d.getDate()}</b></button>`;
    }).join('');
  }
  $('#weekStrip').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-key]');
    if (b) { selectedKey = b.dataset.key; renderPlanner(); }
  });
  $('#prevWeek').addEventListener('click', () => { selectedKey = keyOf(addDays(fromKey(selectedKey), -7)); renderPlanner(); });
  $('#nextWeek').addEventListener('click', () => { selectedKey = keyOf(addDays(fromKey(selectedKey), 7)); renderPlanner(); });

  // Захист від HTML у назвах справ
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Список справ на обраний день
  // Картка справи. Справи без часу (start = '') і виконані — без колонки з годинами.
  // .swipe-bg — червона підкладка, яка відкривається під карткою під час свайпу ліворуч
  function taskItem(t) {
    const flagged = t.cat === 'priority' || t.cat === 'important';
    const compact = !t.start || t.done;
    // У «Виконано» час показуємо в підписі: «06:30 · 30 хв»
    const sub = t.done && t.start ? [t.start, t.sub].filter(Boolean).join(' · ') : t.sub;
    return `<li class="task${compact ? ' anytime' : ''}${t.done ? ' done' : ''}" data-id="${t.id}" data-flip="${t.id}">
      ${compact ? '' : `<div class="task-time">${t.start}${t.end ? '<br>' + t.end : ''}</div>`}
      <span class="swipe-bg" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>Видалити
      </span>
      <div class="task-card ${t.cat}" role="button" tabindex="0" data-edit>
        <div class="t"><b>${esc(t.title)}</b>${sub ? `<span class="${flagged && !t.done ? 'flag' : ''}">${esc(sub)}</span>` : ''}</div>
        <button class="check" data-toggle aria-label="${t.done ? 'Повернути в план' : 'Позначити виконаною'}">
          <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
        </button>
      </div>
    </li>`;
  }

  function renderTasks() {
    const all = tasksFor(selectedKey);
    const anytime = all.filter((t) => !t.start && !t.done);           // без часу, у порядку додавання
    const timed = all.filter((t) => t.start && !t.done);              // розклад за часом
    // Виконано: спершу старі (без мітки часу виконання), далі — у порядку виконання; нові — внизу
    const done = all.filter((t) => t.done).sort((a, b) => (a.doneAt || 0) - (b.doneAt || 0));
    const timedTotal = all.filter((t) => t.start).length;

    $('#anytimeCount').textContent = anytime.length ? String(anytime.length) : '';
    $('#anytimeList').innerHTML = anytime.map(taskItem).join('');

    $('#scheduleCount').textContent = timed.length ? String(timed.length) : '';
    $('#taskList').innerHTML = timed.length
      ? timed.map(taskItem).join('')
      : timedTotal
        ? '<li class="empty small" data-flip="empty-schedule">Усе з розкладу виконано</li>'
        : `<li class="empty" data-flip="empty-schedule">У розкладі на цей день порожньо.<br>
             <button type="button" data-add>Додати справу з часом</button></li>`;

    $('#doneHead').hidden = !done.length;
    $('#doneCount').textContent = done.length ? String(done.length) : '';
    $('#doneList').innerHTML = done.map(taskItem).join('');
    // Підказку про свайп показуємо, доки людина жодного разу не видалила справу свайпом
    $('#swipeHint').hidden = !all.length || store.get('swipeLearned', false);
  }

  const dayView = $('#dayView');
  const findTask = (id) => (tasks[selectedKey] || []).find((t) => t.id === id);
  let lastSwipeEnd = 0;

  // Натискання в списках справ: галочка, редагування, «додати»
  dayView.addEventListener('click', (e) => {
    if (Date.now() - lastSwipeEnd < 400) return;       // після свайпу клік не відкриває редагування
    if (e.target.closest('[data-add]')) { openSheet(); return; }
    const li = e.target.closest('.task');
    if (!li) return;
    const task = findTask(li.dataset.id);
    if (!task) return;
    const check = e.target.closest('[data-toggle]');
    if (check) {
      if (li.classList.contains('completing')) return;
      task.done = !task.done;
      task.doneAt = task.done ? Date.now() : null;
      saveTasks();
      if (task.done) {
        // Галочка й конфеті на місці, потім картка плавно їде в «Виконано»
        li.classList.add('done', 'completing');
        burst(check, 'joy');
        haptic(12);
        setTimeout(() => flip(dayView, renderTasks), reduceMotion ? 0 : 420);
      } else {
        flip(dayView, renderTasks);
      }
    } else if (e.target.closest('[data-edit]')) {
      openSheet(task);
    }
  });
  dayView.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-edit]')) { e.preventDefault(); e.target.click(); }
  });

  /* --- Свайп ліворуч = видалити ---
     Захист від випадкового видалення: жест вмикається лише коли рух явно горизонтальний,
     а видаляє тільки після протягування на ~45% ширини картки. Плюс кнопка «Повернути». */
  const SWIPE_DELETE_SHARE = 0.45;
  let swipe = null;

  dayView.addEventListener('pointerdown', (e) => {
    const card = e.target.closest('.task-card');
    // Свайп можна почати з будь-якого місця картки, навіть з галочки (якщо руху не було — спрацює звичайне натискання)
    if (!card || (e.pointerType === 'mouse' && e.button !== 0)) return;
    swipe = { card, li: card.closest('.task'), id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, active: false };
  });

  dayView.addEventListener('pointermove', (e) => {
    if (!swipe || e.pointerId !== swipe.id) return;
    const k = screenScale();
    const dx = (e.clientX - swipe.x0) / k, dy = (e.clientY - swipe.y0) / k;
    if (!swipe.active) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; }   // це прокрутка
      if (dx > -14 || Math.abs(dx) < Math.abs(dy) * 1.6) return;                       // ще не ясно
      swipe.active = true;
      swipe.card.setPointerCapture(e.pointerId);
      swipe.li.classList.add('swiping');
    }
    // Ліворуч — вільно; праворуч не пускаємо
    swipe.dx = Math.min(0, dx + 14);
    swipe.card.style.transform = `translateX(${swipe.dx}px)`;
    const ratio = Math.min(1, -swipe.dx / (swipe.card.offsetWidth * SWIPE_DELETE_SHARE));
    swipe.li.style.setProperty('--swipe', ratio.toFixed(3));
    const ready = ratio >= 1;
    if (ready !== swipe.li.classList.contains('will-delete')) {
      swipe.li.classList.toggle('will-delete', ready);
      if (ready) haptic(8);
    }
  });

  function endSwipe(e) {
    if (!swipe || (e && e.pointerId !== swipe.id)) return;
    const { li, card, active } = swipe;
    swipe = null;
    if (!active) return;
    lastSwipeEnd = Date.now();
    if (li.classList.contains('will-delete') && e.type === 'pointerup') {
      deleteTask(li);
    } else {
      // Не дотягнули — картка пружно повертається
      card.animate([{ transform: card.style.transform }, { transform: 'none' }],
                   { duration: 260, easing: 'cubic-bezier(.2, .9, .3, 1.2)' });
      card.style.transform = '';
      li.classList.remove('swiping', 'will-delete');
      li.style.removeProperty('--swipe');
    }
  }
  dayView.addEventListener('pointerup', endSwipe);
  dayView.addEventListener('pointercancel', endSwipe);

  // Видалення: картка розчиняється в пил, решта плавно займає її місце
  function deleteTask(li) {
    const list = tasks[selectedKey] || [];
    const index = list.findIndex((t) => t.id === li.dataset.id);
    if (index === -1) return;
    const [removed] = list.splice(index, 1);
    saveTasks();
    store.set('swipeLearned', true);
    const card = li.querySelector('.task-card');
    burst(card, 'dust');
    const done = () => flip(dayView, renderTasks);
    if (reduceMotion) { done(); }
    else {
      card.animate([
        { transform: card.style.transform || 'none', opacity: 1, filter: 'blur(0)' },
        { transform: 'translateX(-70%) scale(.94)', opacity: 0, filter: 'blur(6px)' }
      ], { duration: 260, easing: 'ease-in', fill: 'forwards' });
      li.querySelector('.swipe-bg').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' });
      setTimeout(done, 230);
    }
    toast('Справу видалено', {
      label: 'Повернути',
      run: () => {
        const target = tasks[selectedKey] || (tasks[selectedKey] = []);
        target.splice(Math.min(index, target.length), 0, removed);
        saveTasks();
        flip(dayView, renderTasks);
      }
    });
  }

  // Швидко «кинути» справу на день: пишеш назву → Enter
  $('#quickAdd').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#quickTitle');
    const title = input.value.trim();
    if (!title) { input.focus(); return; }
    (tasks[selectedKey] || (tasks[selectedKey] = [])).push(
      { id: newId(), start: '', end: '', title, sub: '', cat: 'work', done: false });
    saveTasks();
    flip(dayView, renderPlanner);
    input.value = '';
    input.focus();                                    // одразу можна писати наступну
  });

  // Вид «Тиждень»: кожен день з прогресом
  function renderWeekList() {
    const start = startOfWeek(fromKey(selectedKey));
    const tk = todayKey();
    $('#weekList').innerHTML = DAYS_FULL.map((name, i) => {
      const d = addDays(start, i), k = keyOf(d);
      const list = tasks[k] || [];
      const done = list.filter((t) => t.done).length;
      const pct = list.length ? Math.round((done / list.length) * 100) : 0;
      const count = list.length ? `${done} з ${list.length}` : 'вільний день';
      return `<li><button data-key="${k}" class="${k === tk ? 'is-today' : ''}">
                <b>${name}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}</b>
                <span class="wl-count">${count}</span>
                <span class="bar"><i style="width:${pct}%"></i></span>
              </button></li>`;
    }).join('');
  }
  $('#weekList').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-key]');
    if (b) { selectedKey = b.dataset.key; setView('day'); }
  });

  // Вид «Місяць»: календар із позначками днів, де є справи
  function renderMonth() {
    const y = monthCursor.getFullYear(), m = monthCursor.getMonth();
    $('#monthLabel').textContent = `${MONTHS_NOM[m]} ${y}`;
    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const tk = todayKey();
    let html = DAYS_SHORT.map((n) => `<small>${n}</small>`).join('');
    html += '<span></span>'.repeat(weekdayIdx(first));           // порожні клітинки до 1-го числа
    for (let day = 1; day <= daysInMonth; day++) {
      const k = keyOf(new Date(y, m, day));
      const cls = [k === tk ? 'today' : '', (tasks[k] || []).length ? 'has' : ''].join(' ').trim();
      html += `<button data-key="${k}" class="${cls}">${day}</button>`;
    }
    $('#monthCal').innerHTML = html;
  }
  $('#monthCal').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-key]');
    if (b) { selectedKey = b.dataset.key; setView('day'); }
  });
  $('#prevMonth').addEventListener('click', () => { monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1); renderMonth(); });
  $('#nextMonth').addEventListener('click', () => { monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1); renderMonth(); });

  $('#bellBtn').addEventListener('click', () => {
    const left = (tasks[todayKey()] || []).filter((t) => !t.done).length;
    toast(left ? `Сьогодні ще ${left} ${plural(left, 'справа', 'справи', 'справ')} до виконання` : 'Усі справи на сьогодні виконано');
  });

  /* ---------------------------------------------------------------
     5. ШТОРКА «НОВА СПРАВА» / РЕДАГУВАННЯ
     --------------------------------------------------------------- */
  const sheetWrap = $('#sheetWrap');
  const form = $('#taskForm');
  let editingId = null;

  function openSheet(task) {
    editingId = task ? task.id : null;
    $('#sheetTitle').textContent = task ? 'Редагувати справу' : 'Нова справа';
    $('#fTitle').value = task ? task.title : '';
    const noTime = !!task && !task.start;
    $('#fNoTime').checked = noTime;
    $('#fStart').value = task && task.start ? task.start : nextFreeHour();
    $('#fEnd').value = task ? task.end : '';
    syncTimeRow();
    $('#fSub').value = task ? task.sub : '';
    const cat = task ? task.cat : 'work';
    $$('input[name="cat"]').forEach((r) => { r.checked = r.value === cat; });
    $('#deleteBtn').hidden = !task;
    sheetWrap.hidden = false;
    setTimeout(() => $('#fTitle').focus(), 50);
  }
  function closeSheet() { sheetWrap.hidden = true; editingId = null; }

  // Поля часу ховаються, коли справа «без прив'язки до часу»
  function syncTimeRow() { $('#fTimeRow').hidden = $('#fNoTime').checked; }
  $('#fNoTime').addEventListener('change', syncTimeRow);

  // Пропонуємо годину після останньої справи з часом
  function nextFreeHour(dayKey = selectedKey) {
    const list = tasksFor(dayKey).filter((t) => t.start);
    if (!list.length) return '09:00';
    const last = list[list.length - 1];
    const h = Math.min(23, parseInt((last.end || last.start).slice(0, 2), 10) + 1);
    return String(h).padStart(2, '0') + ':00';
  }

  $('#addBtn').addEventListener('click', () => { if (view !== 'day') setView('day'); openSheet(); });
  $('#cancelBtn').addEventListener('click', closeSheet);
  sheetWrap.addEventListener('click', (e) => { if (e.target === sheetWrap) closeSheet(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheetWrap.hidden) closeSheet(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const noTime = $('#fNoTime').checked;
    const data = {
      title: $('#fTitle').value.trim(),
      start: noTime ? '' : $('#fStart').value,
      end: noTime ? '' : $('#fEnd').value,
      sub: $('#fSub').value.trim(),
      cat: ($('input[name="cat"]:checked') || {}).value || 'work'
    };
    if (!data.title) return;
    if (!noTime && !data.start) { toast('Вкажи час початку або познач «Без прив\'язки до часу»'); return; }
    if (data.end && data.end <= data.start) { toast('Час завершення має бути пізніше за початок'); return; }

    const list = tasks[selectedKey] || (tasks[selectedKey] = []);
    if (editingId) {
      Object.assign(list.find((t) => t.id === editingId), data);
      toast('Зміни збережено');
    } else {
      list.push({ ...data, id: newId(), done: false });
      toast('Справу додано');
    }
    saveTasks(); closeSheet(); renderPlanner();
  });

  $('#deleteBtn').addEventListener('click', () => {
    tasks[selectedKey] = (tasks[selectedKey] || []).filter((t) => t.id !== editingId);
    saveTasks(); closeSheet(); renderPlanner();
    toast('Справу видалено');
  });

  /* ---------------------------------------------------------------
     6. ТАЙМЕР «ФОКУС»
     --------------------------------------------------------------- */
  const MODES = {
    // adjustable: true — час налаштовується колом; storeKey — де запамʼятовується
    break:    { min: store.get('breakMin', 10),  cap: 'Час відпочити', focus: false, adjustable: true, storeKey: 'breakMin' },
    short:    { min: 5,  cap: 'Коротка перерва',    focus: false },
    long:     { min: 50, cap: 'Глибока робота',     focus: true },
    custom:   { min: store.get('customMin', 30), cap: 'Фокус на важливому', focus: true, adjustable: true, storeKey: 'customMin' }
  };
  const RING_LEN = 2 * Math.PI * 108;    // довжина кола (r = 108 у SVG)

  const timer = { mode: 'custom', total: 30 * 60, left: 30 * 60, endAt: 0, running: false, id: null };
  const screenFocus = $('.scr-focus');
  const ring = $('#ring');

  // «1 год 25 хв» / «40 хв»
  function durationText(min) {
    const h = Math.floor(min / 60), m = min % 60;
    return h ? `${h} год${m ? ' ' + m + ' хв' : ''}` : `${m} хв`;
  }

  function fmt(sec) {
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // Коло можна крутити в режимах «Перерва» і «Власний», поки таймер не йде
  const dialEditable = () => !!MODES[timer.mode].adjustable && !timer.running;

  function renderTimer() {
    $('#timeText').textContent = fmt(timer.left);
    const edit = dialEditable();
    // Частка кола: під час налаштування — хвилини в межах години (1 оберт = 60 хв),
    // під час відліку — скільки часу залишилось
    const min = MODES[timer.mode].min;
    const p = edit && timer.left === timer.total
      ? (min % 60 === 0 ? 1 : (min % 60) / 60)
      : (timer.total ? timer.left / timer.total : 0);
    $('#ringBar').style.strokeDashoffset = RING_LEN * (1 - p);
    const a = (-90 + 360 * p) * Math.PI / 180;                 // кут кінця дуги
    const x = (120 + 108 * Math.cos(a)).toFixed(2), y = (120 + 108 * Math.sin(a)).toFixed(2);
    $('#ringKnob').setAttribute('cx', x);   $('#ringKnob').setAttribute('cy', y);
    $('#dialHandle').setAttribute('cx', x); $('#dialHandle').setAttribute('cy', y);

    ring.classList.toggle('dial-edit', edit);
    ring.tabIndex = edit ? 0 : -1;
    ring.setAttribute('aria-valuenow', min);
    ring.setAttribute('aria-valuetext', durationText(min));
    $('#ringCap').textContent = edit
      ? (min >= 60 ? durationText(min) : 'Крути коло')
      : MODES[timer.mode].cap;

    screenFocus.classList.toggle('running', timer.running);
    $('#playBtn').setAttribute('aria-label', timer.running ? 'Пауза' : 'Старт');
    document.title = timer.running ? `${fmt(timer.left)} · Фокус` : 'Мій день';
  }

  function setMode(mode) {
    stop();
    timer.mode = mode;
    timer.total = timer.left = MODES[mode].min * 60;
    $('#ringCap').textContent = MODES[mode].cap;
    $$('#modes .mode').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    renderTimer();
  }

  function start() {
    if (timer.left <= 0) timer.left = timer.total;
    timer.running = true;
    timer.endAt = Date.now() + timer.left * 1000;   // рахуємо від часу, тож пауза вкладки не збиває
    timer.id = setInterval(tick, 250);
    renderTimer();
  }
  function stop() {
    timer.running = false;
    clearInterval(timer.id);
    renderTimer();
  }
  function tick() {
    const left = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
    if (left !== timer.left) { timer.left = left; renderTimer(); }
    if (left === 0) finish(true);
  }

  // Завершення сесії: зберігаємо хвилини фокусу й переходимо до наступного режиму
  function finish(natural) {
    const spentMin = Math.round((timer.total - timer.left) / 60);
    stop();
    if (MODES[timer.mode].focus && spentMin > 0) {
      const stats = store.get('stats', {});
      const s = stats[todayKey()] || { count: 0, minutes: 0 };
      s.count += 1; s.minutes += spentMin;
      stats[todayKey()] = s;
      store.set('stats', stats);
    }
    if (natural) { chime(); toast(MODES[timer.mode].focus ? 'Сесію завершено. Час для перерви' : 'Перерву завершено. Повертаймось до справ'); }
    // Після фокусу — перерва, після перерви — знову фокус
    setMode(MODES[timer.mode].focus ? 'break' : 'custom');
  }

  // Тихий дзвіночок наприкінці (звук можливий лише після дії користувача)
  let audioCtx;
  function chime() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      [660, 880].forEach((f, i) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        const t = audioCtx.currentTime + i * 0.28;
        o.frequency.value = f; o.type = 'sine';
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
        o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 1.2);
      });
    } catch (e) { /* без звуку */ }
  }

  $('#playBtn').addEventListener('click', () => {
    if (audioCtx === undefined) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; } }
    timer.running ? stop() : start();
  });
  $('#resetBtn').addEventListener('click', () => { stop(); timer.left = timer.total; renderTimer(); });
  $('#skipBtn').addEventListener('click', () => {
    const wasFocus = MODES[timer.mode].focus;
    finish(false);
    toast(wasFocus ? 'Сесію завершено достроково' : 'Перерву пропущено');
  });

  // Вибір режиму
  $('#modes').addEventListener('click', (e) => {
    const b = e.target.closest('.mode');
    if (b) setMode(b.dataset.mode);
  });

  /* --- Коло-регулятор для «Перерви» і «Власного часу» ---
     Крутиш пальцем (або мишею) по колу: за годинниковою — більше, проти — менше.
     6° = 1 хвилина, повний оберт = 60 хв; можна крутити кілька обертів (до 3 год). */
  const DIAL_MIN = 1, DIAL_MAX = 180;

  // Шкала: 60 рисок, кожна п'ята — довша
  $('#dialTicks').innerHTML = Array.from({ length: 60 }, (_, i) => {
    const a = (i * 6 - 90) * Math.PI / 180, major = i % 5 === 0;
    const r1 = 114, r2 = major ? 122 : 118;     // шкала зовні кола, як безель годинника
    return `<line${major ? ' class="major"' : ''} x1="${(120 + r1 * Math.cos(a)).toFixed(1)}" y1="${(120 + r1 * Math.sin(a)).toFixed(1)}"
                  x2="${(120 + r2 * Math.cos(a)).toFixed(1)}" y2="${(120 + r2 * Math.sin(a)).toFixed(1)}"/>`;
  }).join('');

  function setDialMin(min) {
    const mode = MODES[timer.mode];
    min = Math.min(DIAL_MAX, Math.max(DIAL_MIN, min));
    if (min === mode.min && timer.left === timer.total) return;
    mode.min = min;
    timer.total = timer.left = min * 60;
    if (min % 5 === 0) { try { navigator.vibrate && navigator.vibrate(8); } catch (e) { /* без вібрації */ } }
    syncDialLabels();
    renderTimer();
  }
  const saveDialMin = () => store.set(MODES[timer.mode].storeKey, MODES[timer.mode].min);

  // Кут точки дотику відносно центру кола: 0° — вгорі, далі за годинниковою стрілкою
  function angleAt(e) {
    const r = ring.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    return (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  }

  let drag = null;   // { last: останній кут, acc: накопичений поворот, start: хвилини на початку }
  ring.addEventListener('pointerdown', (e) => {
    if (!dialEditable()) return;
    drag = { last: angleAt(e), acc: 0, start: MODES[timer.mode].min };
    ring.setPointerCapture(e.pointerId);
    ring.classList.add('dragging');
    e.preventDefault();
  });
  ring.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const a = angleAt(e);
    let d = a - drag.last;
    if (d > 180) d -= 360;            // перехід через «12 годину»
    if (d < -180) d += 360;
    drag.last = a;
    drag.acc += d;
    let min = Math.round(drag.start + drag.acc / 6);
    if (min < DIAL_MIN || min > DIAL_MAX) {          // впираємось у межу — не накопичуємо зайвого
      min = Math.min(DIAL_MAX, Math.max(DIAL_MIN, min));
      drag.acc = (min - drag.start) * 6;
    }
    setDialMin(min);
  });
  function endDrag() {
    if (!drag) return;
    drag = null;
    ring.classList.remove('dragging');
    saveDialMin();
  }
  ring.addEventListener('pointerup', endDrag);
  ring.addEventListener('pointercancel', endDrag);

  // Клавіатура: стрілки ±1 хв, PageUp/PageDown ±5 хв
  ring.addEventListener('keydown', (e) => {
    if (!dialEditable()) return;
    const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 }[e.key];
    if (!step) return;
    e.preventDefault();
    setDialMin(MODES[timer.mode].min + step);
    saveDialMin();
  });

  // Підписи під плитками «Перерва» і «Власний»: «10 хв», «1 год 15 хв»
  const syncDialLabels = () => $$('[data-dial-label]').forEach((el) => { el.textContent = durationText(MODES[el.dataset.dialLabel].min); });

  // Справа, над якою працюємо: натискання перемикає на наступну невиконану
  let focusTitle = store.get('focusTitle', '');
  function focusCandidates() {
    const list = tasksFor(todayKey()).filter((t) => !t.done).map((t) => t.title);
    return list.length ? list : ['Робота над проєктом'];
  }
  function syncFocusChip() {
    const list = focusCandidates();
    if (!list.includes(focusTitle)) {
      // за замовчуванням — головний пріоритет дня
      const pr = tasksFor(todayKey()).find((t) => !t.done && t.cat === 'priority');
      focusTitle = pr ? pr.title : list[0];
    }
    $('#focusTask').textContent = focusTitle;
  }
  $('#focusChip').addEventListener('click', () => {
    const list = focusCandidates();
    focusTitle = list[(list.indexOf(focusTitle) + 1) % list.length];
    store.set('focusTitle', focusTitle);
    $('#focusTask').textContent = focusTitle;
  });

  // Статистика за сьогодні
  $('#statsBtn').addEventListener('click', () => {
    const s = store.get('stats', {})[todayKey()];
    toast(s ? `Сьогодні: ${s.count} ${plural(s.count, 'сесія', 'сесії', 'сесій')} · ${s.minutes} хв фокусу`
            : 'Сьогодні ще не було сесій фокусу');
  });

  /* ---------------------------------------------------------------
     7. ЦІЛІ — на рік, місяць і день, з прогресом виконання

     Принципи тайм-менеджменту, закладені тут:
       • Темп — прогрес порівнюємо з тим, скільки часу періоду вже минуло.
       • Фокус — одна «головна ціль» на період, вона завжди перша.
       • Каскад — ціль місяця є кроком до цілі року, ціль дня — до цілі місяця.
       • Дія — будь-яку ціль одним натиском додаємо кроком у план на сьогодні.
       • Перенесення — незавершене з минулого періоду переносимо залишком.

     Ціль: { id, period, key, title, target, current, unit, cat, main, parent, why, carried }
       period:  year | month | day
       key:     "2026" (рік) | "2026-10" (місяць) | "2026-10-07" (день)
       target:  скільки треба зробити (1 — проста ціль «зроблено / ні»)
       cat:     id сфери життя
       main:    true — головна ціль періоду (лише одна на період)
       parent:  id цілі вищого рівня, до якої веде ця ціль
       why:     навіщо мені ця ціль (мотивація)
       carried: true — незавершений залишок уже перенесено далі
     Сфера: { id, name, color } — користувач сам додає, перейменовує й фарбує
     --------------------------------------------------------------- */

  // --- Сфери життя ---
  // Сфери за замовчуванням (id збігаються з тими, що в прикладах цілей)
  const DEFAULT_SPHERES = [
    { id: 'spirit', name: 'Духовне',  color: '#2f9b70' },
    { id: 'family', name: 'Сімʼя',    color: '#e2533e' },
    { id: 'work',   name: 'Робота',   color: '#5b8fc3' },
    { id: 'health', name: 'Здоровʼя', color: '#ee9f37' }
  ];
  // Кольори на вибір у редакторі сфер (останній кружечок — будь-який власний колір)
  const SPHERE_PALETTE = ['#2f9b70', '#7ea6a0', '#5b8fc3', '#8a7cc4', '#e2533e',
                          '#e48aa0', '#ee9f37', '#d7ad67', '#9b7b56', '#6e716b'];

  let spheres = store.get('spheres', null) || DEFAULT_SPHERES.map((s) => ({ ...s }));
  const saveSpheres = () => store.set('spheres', spheres);
  // Сфера за id; якщо не знайдено — перша зі списку
  const sphereOf = (id) => spheres.find((s) => s.id === id) || spheres[0];

  // --- Періоди ---
  const PERIOD_WORD = { year: 'рік',  month: 'місяць',  day: 'день' };
  const PERIOD_GEN  = { year: 'року', month: 'місяця',  day: 'дня' };
  const PERIOD_PREV = { year: 'минулого року', month: 'минулого місяця', day: 'учора' };
  const PERIOD_UP   = { month: 'year', day: 'month' };          // рівень вище для каскаду
  const SUM_CAPTION = { year: 'Прогрес за рік', month: 'Прогрес за місяць', day: 'Прогрес за день' };

  const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const periodKey = (period, d) =>
    period === 'year' ? String(d.getFullYear()) : period === 'month' ? monthKeyOf(d) : keyOf(d);

  // Початок і кінець періоду, у який входить дата d
  function periodRange(period, d) {
    if (period === 'year')  return [new Date(d.getFullYear(), 0, 1), new Date(d.getFullYear() + 1, 0, 1)];
    if (period === 'month') return [new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 1)];
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return [start, addDays(start, 1)];
  }
  // Яка частка періоду вже минула: 0 — ще не почався, 1 — завершився
  function elapsedShare(period, d) {
    const [start, end] = periodRange(period, d);
    return Math.min(1, Math.max(0, (Date.now() - start) / (end - start)));
  }
  const daysLeft = (period, d) => Math.max(0, Math.ceil((periodRange(period, d)[1] - Date.now()) / 864e5));

  // Та сама дата, зсунута на dir періодів назад/вперед
  function shiftDate(period, d, dir) {
    const x = new Date(d);
    if (period === 'year') x.setFullYear(x.getFullYear() + dir);
    else if (period === 'month') { x.setDate(1); x.setMonth(x.getMonth() + dir); }
    else x.setDate(x.getDate() + dir);
    return x;
  }

  // --- Дані цілей ---
  // Приклади цілей — додаються, коли цілей ще немає взагалі
  function sampleGoals() {
    const now = new Date();
    const y = periodKey('year', now), m = periodKey('month', now), d = periodKey('day', now);
    return [
      { period: 'year',  key: y, title: 'Прочитати Біблію повністю',       target: 66, current: 41, unit: 'книг',     cat: 'spirit' },
      { period: 'year',  key: y, title: 'Прочитати 12 корисних книг',      target: 12, current: 9,  unit: 'книг',     cat: 'work' },
      { period: 'year',  key: y, title: 'Недільний обід з родиною',        target: 52, current: 38, unit: 'разів',    cat: 'family' },
      { period: 'year',  key: y, title: 'Пробігти півмарафон',             target: 1,  current: 0,  unit: '',         cat: 'health' },
      { period: 'month', key: m, title: 'Прочитати Послання до Римлян',    target: 16, current: 9,  unit: 'розділів', cat: 'spirit' },
      { period: 'month', key: m, title: 'Запустити застосунок «Мій день»', target: 1,  current: 0,  unit: '',         cat: 'work' },
      { period: 'month', key: m, title: 'Тренування',                      target: 12, current: 5,  unit: 'разів',    cat: 'health' },
      { period: 'month', key: m, title: 'Вечір настільних ігор з дітьми',  target: 2,  current: 2,  unit: 'рази',     cat: 'family' },
      { period: 'day',   key: d, title: 'Ранкова молитва',                 target: 1,  current: 1,  unit: '',         cat: 'spirit' },
      { period: 'day',   key: d, title: 'Прочитати 2 розділи Біблії',      target: 2,  current: 1,  unit: 'розділи',  cat: 'spirit' },
      { period: 'day',   key: d, title: 'Прогулянка 30 хвилин',            target: 1,  current: 0,  unit: '',         cat: 'health' },
      { period: 'day',   key: d, title: 'Подякувати трьом людям',          target: 3,  current: 1,  unit: '',         cat: 'family' }
    ].map((g) => ({ ...g, id: newId() }));
  }

  let goals = store.get('goals', null);
  if (!goals) { goals = sampleGoals(); store.set('goals', goals); }
  const saveGoals = () => store.set('goals', goals);

  // Оновлення прикладів до версії 2: головні цілі, мотивація, звʼязки між рівнями
  if (store.get('goalsVer', 1) < 2) {
    const find = (title, period) => goals.find((g) => g.title === title && g.period === period);
    const bible = find('Прочитати Біблію повністю', 'year');
    const romans = find('Прочитати Послання до Римлян', 'month');
    const chapters = find('Прочитати 2 розділи Біблії', 'day');
    const launch = find('Запустити застосунок «Мій день»', 'month');
    const hasMain = (g) => goals.some((x) => x.main && x.period === g.period && x.key === g.key);
    if (bible && !hasMain(bible)) { bible.main = true; bible.why = bible.why || 'Щоб глибше пізнати Бога і Його волю'; }
    if (launch && !hasMain(launch)) launch.main = true;
    if (romans && bible && !romans.parent) romans.parent = bible.id;
    if (chapters && romans && !chapters.parent) chapters.parent = romans.id;
    saveGoals();
    store.set('goalsVer', 2);
  }

  // --- Стан екрана ---
  let goalPeriod = 'day';                           // обраний період (День — перша вкладка)
  let goalCursor = new Date();                      // яка саме дата/місяць/рік показується
  let sphereFilter = null;                          // id сфери-фільтра або null (усі)
  let showDone = store.get('showDoneGoals', false); // чи розгорнута група «Досягнуті»
  let hiddenTips = store.get('hiddenTips', []);     // поради, які користувач закрив

  const isDone = (g) => g.current >= g.target;
  const goalPct = (g) => Math.min(100, Math.round((g.current / g.target) * 100));
  const goalsOf = (period, d) => goals.filter((g) => g.period === period && g.key === periodKey(period, d));
  const avgPct = (list) => (list.length ? Math.round(list.reduce((s, g) => s + goalPct(g), 0) / list.length) : 0);
  const fmtNum = (n) => String(n >= 10 ? Math.round(n) : Math.round(n * 10) / 10).replace('.', ',');

  // --- Темп: чи встигаю? ---
  const PACE = {
    done:    { label: 'Досягнуто',      cls: 'ok' },
    ahead:   { label: 'Випереджаєш',    cls: 'ok' },
    ontrack: { label: 'За планом',      cls: 'ok' },
    behind:  { label: 'Трохи відстаєш', cls: 'warn' },
    late:    { label: 'Відстаєш',       cls: 'bad' },
    missed:  { label: 'Не досягнуто',   cls: 'bad' }
  };
  // Статус за різницею між прогресом (%) і часом, що минув (частка 0…1)
  function paceByGap(pct, share) {
    const gap = pct - share * 100;
    if (gap >= 10) return 'ahead';
    if (gap >= -5) return 'ontrack';
    if (gap >= -15) return 'behind';
    return 'late';
  }
  function paceOf(g, share) {
    if (isDone(g)) return 'done';
    if (share >= 1) return 'missed';
    if (share === 0 || g.period === 'day') return null;   // для дня й майбутнього темп не рахуємо
    if (g.target === 1) return share > 0.8 ? 'behind' : null;
    return paceByGap(goalPct(g), share);
  }
  // Скільки треба робити, щоб встигнути до кінця періоду
  function paceHint(g, share) {
    if (isDone(g) || share === 0 || share >= 1 || g.period === 'day') return '';
    const left = daysLeft(g.period, goalCursor);
    if (g.target === 1) return `Залишилось ${left} ${plural(left, 'день', 'дні', 'днів')}`;
    const remain = g.target - g.current;
    const unit = g.unit ? ' ' + esc(g.unit) : '';
    return left > 14
      ? `Темп: ≈ ${fmtNum(remain / (left / 7))}${unit} на тиждень`
      : `Темп: ≈ ${fmtNum(remain / left)}${unit} на день`;
  }

  function goalPeriodLabel() {
    const d = goalCursor;
    if (goalPeriod === 'year') return `${d.getFullYear()} рік`;
    if (goalPeriod === 'month') return `${MONTHS_NOM[d.getMonth()]} ${d.getFullYear()}`;
    const prefix = keyOf(d) === todayKey() ? 'Сьогодні' : DAYS_FULL[weekdayIdx(d)];
    return `${prefix}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  }

  // --- Відмальовка ---
  const SUM_RING_LEN = 2 * Math.PI * 34;   // довжина кільця підсумку (r = 34)

  function renderGoals() {
    const all = goalsOf(goalPeriod, goalCursor);
    const share = elapsedShare(goalPeriod, goalCursor);
    const isCurrent = periodKey(goalPeriod, goalCursor) === periodKey(goalPeriod, new Date());

    $('#goalPeriodLabel').textContent = goalPeriodLabel();
    $('#todayPeriodBtn').hidden = isCurrent;

    renderSummary(all, share);
    renderSphereChips(all);
    renderTip(all);
    renderGoalList(all, share);
    renderCarry(share);
  }

  // Підсумок: середній прогрес + скільки часу минуло + загальний статус
  function renderSummary(list, share) {
    const avg = avgPct(list);
    $('#sumPct').textContent = avg + '%';
    $('#sumBar').style.strokeDashoffset = SUM_RING_LEN * (1 - avg / 100);
    $('#sumCaption').textContent = SUM_CAPTION[goalPeriod];
    $('#sumCount').textContent = list.length ? `Досягнуто ${list.filter(isDone).length} з ${list.length}` : 'Цілей ще немає';

    // Біла крапка на кільці — частка часу, що минула
    const a = (-90 + 360 * share) * Math.PI / 180;
    $('#sumTimeDot').setAttribute('cx', (40 + 34 * Math.cos(a)).toFixed(2));
    $('#sumTimeDot').setAttribute('cy', (40 + 34 * Math.sin(a)).toFixed(2));
    $('#sumTime').textContent = share === 0 ? `${PERIOD_WORD[goalPeriod][0].toUpperCase() + PERIOD_WORD[goalPeriod].slice(1)} ще попереду`
      : share >= 1 ? 'Період завершено'
      : `Минуло ${Math.round(share * 100)}% ${PERIOD_GEN[goalPeriod]}`;

    const pill = $('#sumPace');
    const status = !list.length ? null
      : list.every(isDone) ? 'done'
      : share >= 1 ? 'missed'
      : share === 0 || goalPeriod === 'day' ? null   // для дня темп за годинами не рахуємо — лише зайвий тиск
      : paceByGap(avg, share);
    pill.hidden = !status;
    if (status) { pill.className = 'pace ' + PACE[status].cls; pill.textContent = PACE[status].label; }
  }

  // Чипи сфер: прогрес кожної сфери; натискання — фільтр
  function renderSphereChips(list) {
    const chips = spheres
      .map((s) => ({ s, items: list.filter((g) => sphereOf(g.cat).id === s.id) }))
      .filter((x) => x.items.length || x.s.id === sphereFilter)
      .map((x) => `<button type="button" class="sphere-chip${x.s.id === sphereFilter ? ' on' : ''}" data-filter="${x.s.id}"
                    style="--dot:${x.s.color}" aria-pressed="${x.s.id === sphereFilter}">
                    ${esc(x.s.name)} <b>${avgPct(x.items)}%</b></button>`);
    $('#sphereChips').innerHTML = chips.join('') +
      '<button type="button" class="sphere-chip edit" data-edit-spheres>✎ Сфери життя</button>';
  }

  // Порада тренера — одна, найважливіша для ситуації; можна закрити
  function renderTip(list) {
    const active = list.filter((g) => !isDone(g));
    const up = PERIOD_UP[goalPeriod];
    const upGoals = up ? goalsOf(up, goalCursor) : [];
    const tips = [
      { id: 'too-many', when: active.length > 5,
        text: `Забагато цілей розпорошує сили. Зосередься на 3–5 головних, решту перенеси на інший ${PERIOD_WORD[goalPeriod]}.` },
      { id: 'no-main', when: list.length >= 2 && !list.some((g) => g.main),
        text: 'Познач одну головну ціль ★ (у редагуванні цілі). З неї варто починати, коли сил найбільше.' },
      { id: 'cascade-' + goalPeriod, when: up && list.length > 0 && upGoals.length > 0 && !list.some((g) => g.parent),
        text: `Повʼяжи цілі з цілями ${PERIOD_GEN[up]}: тоді кожен ${PERIOD_WORD[goalPeriod]} наближає до великої мети.` }
    ];
    const tip = tips.find((t) => t.when && !hiddenTips.includes(t.id));
    $('#goalTip').innerHTML = tip
      ? `<div class="goal-tip" data-tip="${tip.id}"><div><b>Порада тренера</b>${tip.text}</div>
           <button type="button" data-close-tip aria-label="Закрити пораду">×</button></div>`
      : '';
  }

  // Картка однієї цілі
  function goalCard(g, share) {
    const s = sphereOf(g.cat), pct = goalPct(g), done = isDone(g);
    const pace = paceOf(g, share), hint = paceHint(g, share);
    const parent = g.parent && goals.find((p) => p.id === g.parent);
    const steps = goals.filter((c) => c.parent === g.id).length;
    // Риска «де варто бути зараз» — лише для поточного року/місяця
    const mark = !done && g.period !== 'day' && share > 0 && share < 1
      ? `<span class="pace-mark" style="left:${(share * 100).toFixed(1)}%" title="Де варто бути зараз"></span>` : '';

    const control = g.target === 1
      ? `<button class="goal-check" data-toggle>
           <span class="check"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
           ${done ? 'Виконано' : 'Позначити виконаною'}
         </button>`
      : `<span class="goal-count">${g.current} / ${g.target}${g.unit ? ' ' + esc(g.unit) : ''}</span>
         <span class="goal-ctrl">
           <button data-dec aria-label="Мінус один">−</button>
           <button class="plus" data-inc aria-label="Плюс один">+</button>
         </span>`;

    const meta = [
      pace ? `<span class="pace ${PACE[pace].cls}">${PACE[pace].label}</span>` : '',
      hint ? `<span class="goal-hint">${hint}</span>` : '',
      !done ? '<button type="button" class="to-plan" data-plan aria-label="Додати крок у план на сьогодні">+ У план</button>' : ''
    ].join('');

    return `<li class="goal${done ? ' done' : ''}${g.main ? ' main' : ''}" data-id="${g.id}" style="--c:${s.color}">
      ${g.main ? `<span class="main-badge">★ Головна ціль ${PERIOD_GEN[g.period]}</span>` : ''}
      <div class="goal-top">
        <button class="goal-title" data-edit><b>${esc(g.title)}</b></button>
        <span class="goal-pct">${pct}%</span>
        <button class="goal-edit" data-edit aria-label="Редагувати ціль"><img src="assets/i-edit.png" alt=""></button>
      </div>
      ${g.why ? `<p class="goal-why">${esc(g.why)}</p>` : ''}
      ${parent ? `<p class="goal-link">↳ Крок до: <span>${esc(parent.title)}</span></p>` : ''}
      ${steps ? `<p class="goal-link">Повʼязано з цілями ${g.period === 'year' ? 'місяця' : 'дня'}: <span>${steps}</span></p>` : ''}
      <div class="goal-bar"><i style="width:${pct}%"></i>${mark}</div>
      <div class="goal-bottom">${control}</div>
      ${meta ? `<div class="goal-meta">${meta}</div>` : ''}
    </li>`;
  }

  // Список: головна ціль → ті, що відстають → решта; досягнуті — у згорнутій групі
  const PACE_ORDER = { late: 0, missed: 0, behind: 1, null: 2, ontrack: 3, ahead: 4 };
  function renderGoalList(all, share) {
    const el = $('#goalList');
    const list = sphereFilter ? all.filter((g) => sphereOf(g.cat).id === sphereFilter) : all;

    if (!list.length) {
      el.innerHTML = sphereFilter
        ? `<li class="empty">У сфері «${esc(sphereOf(sphereFilter).name)}» цілей на цей ${PERIOD_WORD[goalPeriod]} немає.<br>
             <button type="button" data-clear-filter>Показати всі цілі</button></li>`
        : `<li class="empty">На цей ${PERIOD_WORD[goalPeriod]} цілей ще немає.<br>
             <button type="button" data-add>Додати першу ціль</button></li>`;
      return;
    }

    const active = list.filter((g) => !isDone(g))
      .sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0) || PACE_ORDER[paceOf(a, share)] - PACE_ORDER[paceOf(b, share)]);
    const done = list.filter(isDone);

    let html = active.map((g) => goalCard(g, share)).join('');
    if (!active.length) html += '<li class="empty">Усі цілі цього періоду досягнуто. Так тримати!</li>';
    if (done.length) {
      html += `<li class="done-head"><button type="button" data-toggle-done aria-expanded="${showDone}">
                 ${showDone ? '▾' : '▸'} Досягнуті · ${done.length}</button></li>`;
      if (showDone) html += done.map((g) => goalCard(g, share)).join('');
    }
    el.innerHTML = html;
  }

  // Кнопка перенесення незавершених цілей з попереднього періоду
  const carryCandidates = () =>
    goalsOf(goalPeriod, shiftDate(goalPeriod, goalCursor, -1)).filter((g) => !isDone(g) && !g.carried);
  function renderCarry(share) {
    const btn = $('#carryBtn');
    const list = share < 1 ? carryCandidates() : [];
    btn.hidden = !list.length;
    if (list.length) btn.textContent = `↪ Перенести незавершені з ${PERIOD_PREV[goalPeriod] === 'учора' ? 'учорашнього дня' : PERIOD_PREV[goalPeriod]} (${list.length})`;
  }

  // --- Дії ---
  // Ціль → крок у плані на сьогодні
  function addGoalToPlan(g) {
    const k = todayKey();
    const list = tasks[k] || (tasks[k] = []);
    if (list.some((t) => t.goalId === g.id && !t.done)) { toast('Цей крок уже є в плані на сьогодні'); return; }
    list.push({ id: newId(), start: '', end: '', title: g.title, sub: 'Крок до цілі',
                cat: g.main ? 'priority' : 'work', done: false, goalId: g.id });
    saveTasks(); renderPlanner();
    toast('Додано в план на сьогодні (без часу)');
  }

  // Незавершене з минулого періоду переносимо залишком (скільки ще лишилось зробити)
  function carryOver() {
    const list = carryCandidates();
    const key = periodKey(goalPeriod, goalCursor);
    const hasMain = goalsOf(goalPeriod, goalCursor).some((g) => g.main);
    list.forEach((g) => {
      goals.push({ ...g, id: newId(), key, target: g.target - g.current, current: 0,
                   main: g.main && !hasMain, carried: false });
      g.carried = true;
    });
    saveGoals(); renderGoals();
    toast(`Перенесено: ${list.length}`);
  }

  // Натискання в списку цілей
  $('#goalList').addEventListener('click', (e) => {
    if (e.target.closest('[data-add]')) { openGoalSheet(); return; }
    if (e.target.closest('[data-clear-filter]')) { sphereFilter = null; renderGoals(); return; }
    if (e.target.closest('[data-toggle-done]')) { showDone = !showDone; store.set('showDoneGoals', showDone); renderGoals(); return; }

    const li = e.target.closest('.goal');
    if (!li) return;
    const g = goals.find((x) => x.id === li.dataset.id);
    if (!g) return;
    if (e.target.closest('[data-edit]')) { openGoalSheet(g); return; }
    if (e.target.closest('[data-plan]')) { addGoalToPlan(g); return; }

    const wasDone = isDone(g);
    if (e.target.closest('[data-inc]')) g.current = Math.min(g.target, g.current + 1);
    else if (e.target.closest('[data-dec]')) g.current = Math.max(0, g.current - 1);
    else if (e.target.closest('[data-toggle]')) g.current = wasDone ? 0 : g.target;
    else return;
    saveGoals(); renderGoals();
    if (!wasDone && isDone(g)) toast('Ціль досягнуто! Так тримати');
  });

  // Фільтр за сферою / налаштування сфер
  $('#sphereChips').addEventListener('click', (e) => {
    if (e.target.closest('[data-edit-spheres]')) { openSphereEditor(); return; }
    const chip = e.target.closest('[data-filter]');
    if (chip) { sphereFilter = sphereFilter === chip.dataset.filter ? null : chip.dataset.filter; renderGoals(); }
  });

  // Закрити пораду (запамʼятовуємо, щоб більше не показувати)
  $('#goalTip').addEventListener('click', (e) => {
    const tip = e.target.closest('[data-close-tip]') && e.target.closest('.goal-tip');
    if (!tip) return;
    hiddenTips.push(tip.dataset.tip);
    store.set('hiddenTips', hiddenTips);
    renderGoals();
  });

  $('#carryBtn').addEventListener('click', carryOver);

  // Перемикач Рік / Місяць / День
  $('#goalSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-period]');
    if (!b) return;
    goalPeriod = b.dataset.period;
    goalCursor = new Date();
    $$('#goalSeg button').forEach((x) => x.classList.toggle('on', x === b));
    renderGoals();
  });

  // Попередній / наступний період і повернення до поточного
  $('#prevPeriod').addEventListener('click', () => { goalCursor = shiftDate(goalPeriod, goalCursor, -1); renderGoals(); });
  $('#nextPeriod').addEventListener('click', () => { goalCursor = shiftDate(goalPeriod, goalCursor, 1); renderGoals(); });
  $('#todayPeriodBtn').addEventListener('click', () => { goalCursor = new Date(); renderGoals(); });

  // Короткий підсумок за всі три періоди
  $('#goalsInfoBtn').addEventListener('click', () => {
    const now = new Date();
    toast(`Рік: ${avgPct(goalsOf('year', now))}% · Місяць: ${avgPct(goalsOf('month', now))}% · День: ${avgPct(goalsOf('day', now))}%`);
  });

  // --- Шторка «Нова ціль» / редагування ---
  const goalSheetWrap = $('#goalSheetWrap');
  let editingGoalId = null;

  function openGoalSheet(g) {
    editingGoalId = g ? g.id : null;
    const period = g ? g.period : goalPeriod;
    $('#goalSheetTitle').textContent = g ? 'Редагувати ціль' : `Нова ціль на ${PERIOD_WORD[period]}`;
    $('#gTitle').value = g ? g.title : '';
    $('#gTarget').value = g ? g.target : 1;
    $('#gUnit').value = g ? g.unit : '';
    $('#gCurrent').value = g ? g.current : 0;
    $('#gCurrentRow').hidden = !g;              // «Вже виконано» — лише під час редагування
    $('#gWhy').value = g ? g.why || '' : '';
    $('#gMain').checked = g ? !!g.main : false;
    $('#gMainPeriod').textContent = PERIOD_GEN[period];
    renderParentOptions(period, g);
    renderSphereOptions(g ? sphereOf(g.cat).id : (sphereFilter || spheres[0].id));
    $('#goalDeleteBtn').hidden = !g;
    goalSheetWrap.hidden = false;
    setTimeout(() => $('#gTitle').focus(), 50);
  }
  function closeGoalSheet() { goalSheetWrap.hidden = true; editingGoalId = null; }

  // Список цілей вищого рівня, до яких може вести ця ціль
  function renderParentOptions(period, g) {
    const up = PERIOD_UP[period];
    $('#gParentRow').hidden = !up;
    if (!up) return;
    const date = g ? fromPeriodKey(period, g.key) : goalCursor;
    const options = goalsOf(up, date);
    $('#gParentLevel').textContent = PERIOD_GEN[up];
    $('#gParent').innerHTML = '<option value="">— без звʼязку —</option>' +
      options.map((p) => `<option value="${p.id}"${g && g.parent === p.id ? ' selected' : ''}>${esc(p.title)}</option>`).join('');
  }
  // Ключ періоду → дата всередині нього
  function fromPeriodKey(period, key) {
    if (period === 'year') return new Date(Number(key), 0, 1);
    if (period === 'month') { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1); }
    return fromKey(key);
  }

  // Перемикачі сфер у шторці цілі
  function renderSphereOptions(selectedId) {
    $('#gSpheres').innerHTML = spheres.map((s) => `
      <label><input type="radio" name="gcat" value="${s.id}"${s.id === selectedId ? ' checked' : ''}>
        <span style="--dot:${s.color}">${esc(s.name)}</span></label>`).join('');
  }

  $('#goalAddBtn').addEventListener('click', () => openGoalSheet());
  $('#goalCancelBtn').addEventListener('click', closeGoalSheet);
  goalSheetWrap.addEventListener('click', (e) => { if (e.target === goalSheetWrap) closeGoalSheet(); });
  document.addEventListener('keydown', (e) => {
    // Якщо поверх відкрито редактор сфер — Escape закриває спершу його
    if (e.key === 'Escape' && !goalSheetWrap.hidden && $('#sphereSheetWrap').hidden) closeGoalSheet();
  });

  $('#goalForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const target = Math.max(1, parseInt($('#gTarget').value, 10) || 1);
    const data = {
      title: $('#gTitle').value.trim(),
      target,
      current: Math.min(target, Math.max(0, parseInt($('#gCurrent').value, 10) || 0)),
      unit: $('#gUnit').value.trim(),
      why: $('#gWhy').value.trim(),
      parent: $('#gParentRow').hidden ? '' : $('#gParent').value,
      main: $('#gMain').checked,
      cat: ($('input[name="gcat"]:checked') || {}).value || spheres[0].id
    };
    if (!data.title) return;

    let goal;
    if (editingGoalId) {
      goal = goals.find((g) => g.id === editingGoalId);
      Object.assign(goal, data);
      toast('Зміни збережено');
    } else {
      goal = { ...data, id: newId(), period: goalPeriod, key: periodKey(goalPeriod, goalCursor) };
      goals.push(goal);
      toast('Ціль додано');
    }
    // Головна ціль — лише одна на період
    if (goal.main) goals.forEach((g) => { if (g !== goal && g.period === goal.period && g.key === goal.key) g.main = false; });
    saveGoals(); closeGoalSheet(); renderGoals();
  });

  $('#goalDeleteBtn').addEventListener('click', () => {
    goals = goals.filter((g) => g.id !== editingGoalId);
    goals.forEach((g) => { if (g.parent === editingGoalId) g.parent = ''; });   // розриваємо звʼязки
    saveGoals(); closeGoalSheet(); renderGoals();
    toast('Ціль видалено');
  });

  // --- Редактор сфер життя ---
  // Зміни робимо в чернетці (draft) і зберігаємо лише після «Готово»
  const sphereSheetWrap = $('#sphereSheetWrap');
  let draft = [];

  function openSphereEditor() {
    draft = spheres.map((s) => ({ ...s }));
    renderSphereEditor();
    sphereSheetWrap.hidden = false;
  }
  function closeSphereEditor() { sphereSheetWrap.hidden = true; }

  // Скільки цілей належить сфері
  const goalsInSphere = (id) => goals.filter((g) => sphereOf(g.cat).id === id).length;

  function renderSphereEditor() {
    $('#sphereList').innerHTML = draft.map((s) => {
      const isCustom = !SPHERE_PALETTE.includes(s.color);
      const swatches = SPHERE_PALETTE.map((c) =>
        `<button type="button" class="sw${c === s.color ? ' on' : ''}" style="--sw:${c}" data-color="${c}" aria-label="Колір ${c}"></button>`
      ).join('');
      const used = goalsInSphere(s.id);
      const other = draft.find((x) => x.id !== s.id);
      const warn = s.confirm && used
        ? `<span class="sphere-warn">Цілі цієї сфери (${used}) перейдуть у «${esc(other ? other.name || 'Без назви' : '')}». Натисни ще раз, щоб видалити.</span>`
        : '';
      return `<li class="sphere-row${s.confirm ? ' confirm' : ''}" data-id="${s.id}">
        <div class="sphere-head">
          <span class="sphere-dot" style="--dot:${s.color}"></span>
          <input class="sphere-name" value="${esc(s.name)}" maxlength="24" placeholder="Назва сфери" aria-label="Назва сфери">
          <button type="button" class="sphere-del">${s.confirm ? 'Видалити?' : 'Видалити'}</button>
        </div>
        <div class="swatches">${swatches}
          <label class="sw sw-custom${isCustom ? ' on' : ''}" title="Свій колір">
            <input type="color" value="${s.color}" aria-label="Свій колір">
          </label>
        </div>
        ${warn}
      </li>`;
    }).join('');
  }

  const draftOf = (el) => draft.find((s) => s.id === el.closest('.sphere-row').dataset.id);

  // Назва: оновлюємо чернетку без перемальовування (щоб не губився курсор)
  $('#sphereList').addEventListener('input', (e) => {
    if (e.target.matches('.sphere-name')) draftOf(e.target).name = e.target.value;
    if (e.target.matches('input[type="color"]')) {
      const s = draftOf(e.target);
      s.color = e.target.value;
      const row = e.target.closest('.sphere-row');
      row.querySelector('.sphere-dot').style.setProperty('--dot', s.color);
      row.querySelectorAll('.sw').forEach((b) => b.classList.toggle('on', b.classList.contains('sw-custom')));
    }
  });

  $('#sphereList').addEventListener('click', (e) => {
    const sw = e.target.closest('.sw[data-color]');
    if (sw) { draftOf(sw).color = sw.dataset.color; renderSphereEditor(); return; }

    const del = e.target.closest('.sphere-del');
    if (!del) return;
    const s = draftOf(del);
    if (draft.length === 1) { toast('Має залишитися хоча б одна сфера'); return; }
    // Якщо в сфері є цілі — спершу питаємо підтвердження
    if (goalsInSphere(s.id) && !s.confirm) {
      draft.forEach((x) => { x.confirm = false; });
      s.confirm = true;
    } else {
      draft = draft.filter((x) => x !== s);
    }
    renderSphereEditor();
  });

  $('#addSphereBtn').addEventListener('click', () => {
    // Новій сфері даємо перший колір, якого ще немає в списку
    const color = SPHERE_PALETTE.find((c) => !draft.some((s) => s.color === c)) || SPHERE_PALETTE[0];
    draft.push({ id: newId(), name: '', color });
    renderSphereEditor();
    const inputs = $$('#sphereList .sphere-name');
    inputs[inputs.length - 1].focus();
  });

  $('#sphereForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const empty = draft.findIndex((s) => !s.name.trim());
    if (empty !== -1) {
      toast('Дай назву кожній сфері');
      $$('#sphereList .sphere-name')[empty].focus();
      return;
    }
    spheres = draft.map(({ id, name, color }) => ({ id, name: name.trim(), color }));
    // Цілі з видалених сфер переходять у першу сферу
    goals.forEach((g) => { if (!spheres.some((s) => s.id === g.cat)) g.cat = spheres[0].id; });
    saveSpheres(); saveGoals();
    closeSphereEditor();
    renderGoals();
    // Якщо шторка цілі відкрита — оновлюємо в ній список сфер
    if (!goalSheetWrap.hidden) {
      const checked = ($('input[name="gcat"]:checked') || {}).value;
      renderSphereOptions(sphereOf(checked).id);
    }
    toast('Сфери збережено');
  });

  $('#editSpheresBtn').addEventListener('click', openSphereEditor);
  $('#sphereCancelBtn').addEventListener('click', closeSphereEditor);
  sphereSheetWrap.addEventListener('click', (e) => { if (e.target === sphereSheetWrap) closeSphereEditor(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sphereSheetWrap.hidden) closeSphereEditor(); });

  /* --- Скляні кнопки «+»: темніють під пальцем і знову прозорі після відпускання --- */
  $$('.fab').forEach((btn) => {
    const release = () => btn.classList.remove('pressed');
    btn.addEventListener('pointerdown', () => btn.classList.add('pressed'));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, release));
  });

  /* ---------------------------------------------------------------
     8. РАМКА ТЕЛЕФОНУ НА ПК: масштаб під висоту вікна + годинник
     --------------------------------------------------------------- */
  const device = $('#device');
  const desktopMq = window.matchMedia('(min-width: 700px) and (min-height: 560px)');
  function fitDevice() {
    if (!desktopMq.matches) { device.style.removeProperty('--scale'); return; }
    const s = Math.min(1, (window.innerHeight - 48) / 870, (window.innerWidth - 48) / 416);
    device.style.setProperty('--scale', s.toFixed(3));
  }
  window.addEventListener('resize', fitDevice);

  function clock() {
    const d = new Date();
    $('#sbTime').textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  setInterval(clock, 20000);

  /* ---------- Старт ---------- */
  fitDevice();
  clock();
  renderPlanner();
  renderGoals();
  setMode('custom');
  syncDialLabels();
  const startScreen = location.hash.slice(1);
  go(SCREEN_NAMES.includes(startScreen) ? startScreen : 'splash');
  // Перехід за посиланням на кшталт #focus
  window.addEventListener('hashchange', () => go(location.hash.slice(1)));
})();
