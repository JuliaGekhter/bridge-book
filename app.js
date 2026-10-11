/* The Bridge Book — a private accounting in three parts.
   All data lives in localStorage on this device. No network calls, no analytics. */
(function () {
  'use strict';

  var KEY = 'bridgebook.v1';

  var BOOKS = [
    { id: 'past', n: 'Book one', title: 'Past', sub: 'What exists that didn\u2019t',
      framing: 'Not a life story. A ledger of what is now in the world because you did something. People routinely can\u2019t see this about themselves.',
      note: 'Write plainly. Fragments are fine \u2014 you\u2019re making raw material, not prose. Nothing here needs to be impressive.' },
    { id: 'present', n: 'Book two', title: 'Present', sub: 'Two columns, both true',
      framing: 'What\u2019s holding and what\u2019s under strain, side by side, plus the loops you keep carrying. Neither column alone is honest.',
      note: 'This is the section people soften. Don\u2019t. The two-column ledger only works if the right-hand column is true.' },
    { id: 'future', n: 'Book three', title: 'Future', sub: 'What would have to be true',
      framing: 'Not hopes. Checkable facts, each one either true or not yet, plus the one test to run every decision through.',
      note: 'Be concrete about the destination and honest about the cost. The last question is the one that does the work.' }
  ];

  var QS = [
    { id: 'p1', book: 'past', label: 'Built',
      q: 'What did you build or make that is still in the world?',
      hint: 'Work, objects, rooms, systems, documents, programs, a garden. If it exists because you made it, it counts. One per line.' },
    { id: 'p2', book: 'past', label: 'People',
      q: 'Who is better off because of something you did?',
      hint: 'Name the person and name the thing you did. A sentence each is enough.' },
    { id: 'p3', book: 'past', label: 'Can do now',
      q: 'What can you do now that you couldn\u2019t do before?',
      hint: 'Skills, licenses, languages, ways of handling things. Count the ones nobody gave you a certificate for.' },
    { id: 'p4', book: 'past', label: 'Came through',
      q: 'What hard things did you get through?',
      hint: 'You don\u2019t have to explain them. Name them and leave it there.' },
    { id: 'p5', book: 'past', label: 'Still running',
      q: 'What did you start that still runs?',
      hint: 'Habits, routines, groups, traditions, arrangements \u2014 things that keep going without you pushing them every day.' },

    { id: 'n1', book: 'present', label: 'Holding',
      q: 'What\u2019s holding?',
      hint: 'In work, health, relationships, home, money: what is actually solid right now? Only what\u2019s true, not what should be.' },
    { id: 'n2', book: 'present', label: 'Under strain',
      q: 'What\u2019s under strain?',
      hint: 'The same places. What is thin, frayed, or costing more than it should? Say it the way you\u2019d say it to yourself at 2 a.m.' },
    { id: 'n3', book: 'present', label: 'Open loop',
      q: 'What open loops do you keep carrying?',
      hint: 'Unfinished things that come back to mind when you\u2019re trying to rest. Calls, forms, promises, decisions.' },
    { id: 'n4', book: 'present', label: 'Tolerating',
      q: 'What are you tolerating?',
      hint: 'Things you decided to put up with without ever actually deciding.' },
    { id: 'n5', book: 'present', label: 'Postponed',
      q: 'What do you keep postponing?',
      hint: 'The thing you\u2019d move to next week again if you could.' },

    { id: 'f1', book: 'future', label: 'Would be true',
      q: 'Twelve months from now, what would have to be true?',
      hint: 'Write each one as a fact someone could check: a number, a date, a thing that exists or doesn\u2019t. One per line.' },
    { id: 'f2', book: 'future', label: 'The cost',
      q: 'What will it cost?',
      hint: 'What will you stop doing, give up, or say no to so these can be true? Time, money, comfort, a role, an identity.' },
    { id: 'f3', book: 'future', label: 'First step',
      q: 'What is the first checkable step, this month?',
      hint: 'One thing, with a date, that will be either done or not done.' },
    { id: 'f4', book: 'future', label: 'The test',
      q: 'What is the one test you will run every decision through?',
      hint: 'One sentence. If a choice fails it, the answer is no.' }
  ];

  var CLOSING = 'The three-part method comes from an old practice of cheshbon hanefesh \u2014 an accounting of the soul, traditionally taken once a year. You don\u2019t need the tradition to use the method.';
  var PRIVACY = 'Everything you write stays on this device. Nothing is sent anywhere.';

  /* ---------- utilities ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fromYmd(s) { var p = String(s).split('-'); return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1); }
  function longDate(d) {
    try { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (e) { return ymd(d); }
  }
  function hebDate(d) {
    try {
      var s = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
      return /\d{4}/.test(s) ? s.replace(/\s*AM$/, '').replace(/\bTishri\b/, 'Tishrei') : '';
    } catch (e) { return ''; }
  }
  function bookById(id) { for (var i = 0; i < BOOKS.length; i++) if (BOOKS[i].id === id) return BOOKS[i]; return null; }
  function qsFor(book) { return QS.filter(function (q) { return q.book === book; }); }
  function qIndex(id) { for (var i = 0; i < QS.length; i++) if (QS[i].id === id) return i; return -1; }

  /* Split an answer into ledger items: new lines or semicolons; strip bullets and numbering. */
  function items(text) {
    return String(text || '').split(/\r?\n|;/).map(function (s) {
      return s.replace(/^\s*(?:[-\u2013\u2014*\u2022\u00b7]+|\d+[.)]|\[\s?[xX ]?\s?\])\s*/, '').trim();
    }).filter(Boolean);
  }
  function plain(text) { return String(text || '').trim(); }

  /* ---------- state ---------- */
  function fresh() {
    return { v: 1, name: '', startedAt: ymd(), answers: {}, written: {}, pos: '', archives: [] };
  }
  function normalize(o) {
    var s = fresh();
    if (!o || typeof o !== 'object') return s;
    s.name = typeof o.name === 'string' ? o.name : '';
    s.startedAt = typeof o.startedAt === 'string' ? o.startedAt : s.startedAt;
    s.pos = typeof o.pos === 'string' ? o.pos : '';
    if (o.answers && typeof o.answers === 'object') {
      QS.forEach(function (q) { if (typeof o.answers[q.id] === 'string') s.answers[q.id] = o.answers[q.id]; });
    }
    if (o.written && typeof o.written === 'object') {
      BOOKS.forEach(function (b) { if (o.written[b.id] && o.written[b.id].data) s.written[b.id] = o.written[b.id]; });
    }
    if (Array.isArray(o.archives)) {
      s.archives = o.archives.filter(function (a) { return a && typeof a.date === 'string' && a.book; })
        .map(function (a) { return { date: a.date, book: normalize(a.book) }; });
      s.archives.forEach(function (a) { a.book.archives = []; });
    }
    return s;
  }
  function load() {
    try { var raw = localStorage.getItem(KEY); return raw ? normalize(JSON.parse(raw)) : fresh(); }
    catch (e) { return fresh(); }
  }
  var storageOk = true;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); storageOk = true; }
    catch (e) { storageOk = false; }
    return storageOk;
  }
  var S = load();

  function answeredCount(book, st) {
    st = st || S;
    return qsFor(book).filter(function (q) { return plain(st.answers[q.id]); }).length;
  }
  function sig(book, st) {
    st = st || S;
    return JSON.stringify(qsFor(book).map(function (q) { return plain(st.answers[q.id]); }));
  }
  function isStale(book) { var w = S.written[book]; return !!(w && w.sig !== sig(book)); }

  /* ---------- writing pages (deterministic assembly, nothing generated) ---------- */
  function build(book, st) {
    var a = st.answers;
    if (book === 'past') {
      return { groups: qsFor('past').map(function (q) { return { label: q.label, items: items(a[q.id]) }; })
        .filter(function (g) { return g.items.length; }) };
    }
    if (book === 'present') {
      var strain = items(a.n2).map(function (t) { return { t: t }; })
        .concat(items(a.n4).map(function (t) { return { t: t, tag: 'tolerating' }; }));
      var loops = items(a.n3).map(function (t) { return { t: t }; })
        .concat(items(a.n5).map(function (t) { return { t: t, tag: 'postponed' }; }));
      return { holding: items(a.n1).map(function (t) { return { t: t }; }), strain: strain, loops: loops };
    }
    if (book === 'future') {
      return { facts: items(a.f1).map(function (t) { return { t: t, done: false }; }),
        cost: items(a.f2), step: plain(a.f3), test: plain(a.f4) };
    }
  }
  function writeBook(book) {
    var data = build(book, S);
    var old = S.written[book];
    if (book === 'future' && old && old.data && old.data.facts) {
      var prev = {};
      old.data.facts.forEach(function (f) { prev[f.t] = f.done; });
      data.facts.forEach(function (f) { if (prev[f.t]) f.done = true; });
    }
    S.written[book] = { at: new Date().toISOString(), sig: sig(book), data: data };
    save();
  }
  function isEmpty(book, data) {
    if (!data) return true;
    if (book === 'past') return !data.groups.length;
    if (book === 'present') return !(data.holding.length || data.strain.length || data.loops.length);
    return !(data.facts.length || data.cost.length || data.step || data.test);
  }

  /* ---------- pagination: content is measured in a hidden page of the real size ---------- */
  var measurer = null;
  function measureBody(mode, width) {
    if (!measurer) {
      measurer = document.createElement('div');
      measurer.className = 'measurer';
      measurer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(measurer);
    }
    measurer.innerHTML = '';
    var page = document.createElement('article');
    page.className = 'page measuring' + (mode === 'print' ? ' print-metrics' : '');
    if (mode === 'print') { page.style.width = '105mm'; page.style.height = '148mm'; }
    else { page.style.width = width + 'px'; page.style.height = Math.round(width * 148 / 105) + 'px'; }
    page.innerHTML = '<div class="page-body"></div><footer class="folio"><span>Page</span><span>1</span></footer>';
    measurer.appendChild(page);
    return page.querySelector('.page-body');
  }
  function screenWidth() {
    var m = document.querySelector('main');
    if (!m) return 360;
    var cs = getComputedStyle(m);
    var w = m.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return Math.max(280, Math.min(400, Math.floor(w)));
  }
  /* spec: { head, headCont, open, close, units: [{ html, kwn (keep with next), cont (html to lead a continued page) }] } */
  function flow(spec, opts) {
    var body = measureBody(opts.mode, opts.width);
    var pages = [], cur = [], u = spec.units, i = 0;
    function html(list, first) {
      return (first ? spec.head : spec.headCont) + spec.open + list.map(function (x) { return x.html; }).join('') + spec.close;
    }
    function fits(list, first) { body.innerHTML = html(list, first); return body.scrollHeight <= body.clientHeight + 1; }
    while (i < u.length) {
      var add = [];
      var startsPage = !cur.length || cur.every(function (x) { return x.kwn; });
      if (!cur.length && pages.length && u[i].cont) add.push({ html: u[i].cont, kwn: true });
      add.push(u[i]);
      var trial = cur.concat(add);
      if (fits(trial, !pages.length) || (!cur.length)) { cur = trial; i++; }
      else if (startsPage && cur.length) { cur = trial; i++; } /* a lone heading must take its first item */
      else {
        var carry = [];
        while (cur.length > 1 && cur[cur.length - 1].kwn) carry.unshift(cur.pop());
        pages.push(cur); cur = carry;
      }
    }
    if (cur.length) pages.push(cur);
    measurer.innerHTML = '';
    return pages.map(function (list, k) { return html(list, k === 0); });
  }

  function tagHtml(it) { return esc(it.t) + (it.tag ? ' <span class="tag">' + esc(it.tag) + '</span>' : ''); }

  /* Returns an array of page objects {book, html} for one book. */
  function bookPages(book, w, opts) {
    opts = opts || {};
    if (!opts.mode) { opts.mode = 'screen'; }
    if (opts.mode === 'screen' && !opts.width) opts.width = screenWidth();
    var b = bookById(book), d = w.data, out = [];
    var kick = '<p class="kicker">' + esc(b.n) + ' \u00b7 ' + esc(b.title) + '</p>';
    var head = function (title) { return kick + '<h2 class="ph">' + esc(title) + '</h2>'; };
    var cont = '<p class="cont">continued</p>';
    function add(spec) { flow(spec, opts).forEach(function (h) { out.push(h); }); }
    function li(t) { return '<ul class="ledger"><li>' + t + '</li></ul>'; }

    if (book === 'past') {
      var units = [];
      d.groups.forEach(function (g) {
        units.push({ html: '<h3 class="gl">' + esc(g.label) + '</h3>', kwn: true });
        g.items.forEach(function (t) {
          units.push({ html: li(esc(t)), cont: '<h3 class="gl">' + esc(g.label) + ' <span class="cont">cont.</span></h3>' });
        });
      });
      add({ head: head('What exists that didn\u2019t') + '<p class="lede">A ledger of what is now in the world because you did something.</p>',
        headCont: head('What exists that didn\u2019t') + cont, open: '<div class="flow">', close: '</div>', units: units });
      var total = d.groups.reduce(function (n, g) { return n + g.items.length; }, 0);
      out.push(head('The count') + '<p class="big-number">' + total + '</p><p class="center">' + (total === 1 ? 'entry' : 'entries') + ' in the ledger.</p>' +
        '<p class="aside">An accounting replaces the feeling with a list \u2014 and the list is almost always better than the feeling.</p>');
    }
    if (book === 'present') {
      var n = Math.max(d.holding.length, d.strain.length), rows = [];
      for (var i = 0; i < n; i++) {
        var r = [d.holding[i], d.strain[i]];
        rows.push({ html: '<tr><td>' + (r[0] ? tagHtml(r[0]) : '') + '</td><td>' + (r[1] ? tagHtml(r[1]) : '') + '</td></tr>' });
      }
      var thead = '<table class="columns"><caption class="sr-only">Holding and under strain, side by side</caption>' +
        '<thead><tr><th scope="col">Holding</th><th scope="col">Under strain</th></tr></thead><tbody>';
      if (rows.length) add({ head: head('Two columns, both true'), headCont: head('Two columns, both true') + cont, open: thead, close: '</tbody></table>', units: rows });
      if (d.loops.length) add({ head: head('Loops I carry') + '<p class="lede">Written down, so they don\u2019t have to be carried in your head.</p>',
        headCont: head('Loops I carry') + cont, open: '<ul class="ledger loops">', close: '</ul>',
        units: d.loops.map(function (it) { return { html: '<li>' + tagHtml(it) + '</li>' }; }) });
    }
    if (book === 'future') {
      if (d.facts.length) {
        var trueCount = d.facts.filter(function (f) { return f.done; }).length;
        add({ head: head('What would have to be true') + '<p class="lede">In twelve months. Each one either true or not yet. <span class="tally" data-tally>' + trueCount + ' of ' + d.facts.length + ' true</span></p>',
          headCont: head('What would have to be true') + cont, open: '<ul class="facts">', close: '</ul>',
          units: d.facts.map(function (f, k) {
            var mark = '<span class="box' + (f.done ? ' on' : '') + '" aria-hidden="true"></span>';
            var ctl = opts.readonly
              ? '<span class="state' + (f.done ? ' on' : '') + '">' + (f.done ? 'true' : 'not yet') + '</span>'
              : '<button type="button" class="toggle" data-action="toggle" data-i="' + k + '" aria-pressed="' + (f.done ? 'true' : 'false') + '" aria-label="' + esc(f.t) + ': ' + (f.done ? 'true' : 'not yet') + '">' + (f.done ? 'true' : 'not yet') + '</button>';
            return { html: '<li class="' + (f.done ? 'done' : '') + '">' + mark + '<span class="fact">' + esc(f.t) + '</span>' + ctl + '</li>' };
          }) });
      }
      if (d.cost.length || d.step) {
        var cu = [];
        if (d.cost.length) {
          cu.push({ html: '<h3 class="gl">The cost</h3>', kwn: true });
          d.cost.forEach(function (t) { cu.push({ html: li(esc(t)), cont: '<h3 class="gl">The cost <span class="cont">cont.</span></h3>' }); });
        }
        if (d.step) {
          cu.push({ html: '<h3 class="gl">First step, this month</h3>', kwn: true });
          cu.push({ html: '<p class="step">' + esc(d.step).replace(/\n/g, '<br>') + '</p>' });
        }
        add({ head: head('What it costs, and where it starts'), headCont: head('What it costs, and where it starts') + cont, open: '<div class="flow">', close: '</div>', units: cu });
      }
      if (d.test) {
        var size = d.test.length > 220 ? ' xlong' : d.test.length > 110 ? ' long' : '';
        out.push(kick + '<div class="test-page"><p class="test-label">Run every decision through this</p>' +
          '<p class="test' + size + '">' + esc(d.test).replace(/\n/g, '<br>') + '</p><p class="test-foot">If a choice fails it, the answer is no.</p></div>');
      }
    }
    return out.map(function (html) { return { book: b, html: html }; });
  }
  function renderPages(list, startNum) {
    return list.map(function (p, i) {
      return '<article class="page" aria-label="' + esc(p.book ? p.book.title : '') + ' page ' + (startNum + i) + '">' +
        '<div class="page-body">' + p.html + '</div>' +
        '<footer class="folio"><span>' + esc(p.book ? p.book.title : 'The Bridge Book') + '</span><span>' + (startNum + i) + '</span></footer></article>';
    }).join('');
  }

  function wholeBook(st, opts) {
    opts = opts || {};
    var written = BOOKS.filter(function (b) { var w = st.written[b.id]; return w && !isEmpty(b.id, w.data); });
    var lastAt = written.reduce(function (m, b) { var t = st.written[b.id].at; return t > m ? t : m; }, '');
    var dateObj = opts.archiveDate ? fromYmd(opts.archiveDate) : (lastAt ? new Date(lastAt) : new Date());
    var heb = hebDate(dateObj);
    var cover = '<div class="cover"><p class="kicker">Your own accounting</p><h2 class="cover-title">The Bridge Book</h2>' +
      (st.name ? '<p class="cover-name">' + esc(st.name) + '</p>' : '') +
      '<p class="cover-sub">Past, present, and future \u2014 in one pocket.</p>' +
      '<p class="cover-date">' + esc(longDate(dateObj)) + (heb ? '<br>' + esc(heb) : '') + '</p></div>';
    var pages = [{ book: null, html: cover }];
    var contents = '<p class="kicker">Contents</p><h2 class="ph">Three books</h2><ol class="contents">';
    var body = [];
    var num = 3;
    BOOKS.forEach(function (b) {
      var w = st.written[b.id];
      if (w && !isEmpty(b.id, w.data)) {
        var bp = bookPages(b.id, w, { readonly: opts.readonly, mode: opts.mode, width: opts.width });
        contents += '<li><span><b>' + esc(b.n) + ' \u00b7 ' + esc(b.title) + '</b><br><span class="muted">' + esc(b.sub) + '</span></span><span class="pg">' + num + '</span></li>';
        body = body.concat(bp); num += bp.length;
      } else {
        contents += '<li class="muted"><span><b>' + esc(b.n) + ' \u00b7 ' + esc(b.title) + '</b><br>not written yet</span><span class="pg">\u2013</span></li>';
      }
    });
    contents += '</ol>';
    pages.push({ book: null, html: contents });
    pages = pages.concat(body);
    pages.push({ book: null, html: '<div class="closing"><p class="ornament" aria-hidden="true">\u2042</p><p>' + esc(CLOSING) + '</p><p class="muted small">' + esc(PRIVACY) + '</p></div>' });
    return { html: renderPages(pages, 1), count: pages.length, written: written.length };
  }

  /* ---------- views ---------- */
  var app = document.getElementById('app');

  function btn(label, attrs, cls) {
    return '<button type="button" class="btn ' + (cls || '') + '" ' + (attrs || '') + '>' + label + '</button>';
  }
  function link(label, href, cls) { return '<a class="btn ' + (cls || '') + '" href="' + href + '">' + label + '</a>'; }

  function nextUnanswered() {
    for (var i = 0; i < QS.length; i++) if (!plain(S.answers[QS[i].id])) return i;
    return -1;
  }

  function viewWelcome() {
    var lastQ = /^#\/q\/(\d+)/.exec(S.pos || '');
    var anyAnswer = QS.some(function (q) { return plain(S.answers[q.id]); });
    var cta;
    if (!anyAnswer) cta = link('Begin', '#/intro/past', 'primary wide');
    else {
      var target = lastQ ? '#/q/' + lastQ[1] : (nextUnanswered() >= 0 ? '#/q/' + (nextUnanswered() + 1) : '#/book');
      var lbl = lastQ ? 'Continue \u00b7 question ' + lastQ[1] + ' of 14' : (nextUnanswered() >= 0 ? 'Continue' : 'Open my book');
      cta = link(lbl, target, 'primary wide');
    }
    var books = BOOKS.map(function (b) {
      var c = answeredCount(b.id), w = S.written[b.id];
      var status = w ? (isStale(b.id) ? 'pages need rewriting' : 'pages written') : (c + ' of ' + qsFor(b.id).length + ' answered');
      return '<li><a class="book-row" href="#/intro/' + b.id + '"><span class="br-n">' + esc(b.n) + '</span>' +
        '<span class="br-t">' + esc(b.title) + ' <span class="br-s">\u2014 ' + esc(b.sub) + '</span></span>' +
        '<span class="br-status' + (w && !isStale(b.id) ? ' ok' : '') + '">' + status + '</span></a></li>';
    }).join('');
    return '<section class="screen welcome">' +
      '<p class="kicker">Your own accounting</p>' +
      '<h1 tabindex="-1">The Bridge Book</h1>' +
      '<h2 class="sub">An accounting, not a journal</h2>' +
      '<p>Most people carry a vague sense of being behind. An accounting replaces the feeling with a list \u2014 and the list is almost always better than the feeling.</p>' +
      '<p>This builds you a pocket notebook in three parts. You answer fourteen questions in your own words; your pages are set from exactly what you wrote, nothing added. It takes about twenty minutes, and you can stop and come back.</p>' +
      '<div class="actions">' + cta + '</div>' +
      '<h2 class="section-h">The method</h2>' +
      '<ol class="books">' + books + '</ol>' +
      '<p class="yours"><b>Yours alone.</b> ' + esc(PRIVACY) + (storageOk ? '' : ' <span class="warn">This browser is not allowing storage, so answers may not be kept.</span>') + '</p>' +
      '<p class="closing-note">' + esc(CLOSING) + '</p>' +
      '</section>';
  }

  function viewIntro(bookId) {
    var b = bookById(bookId); if (!b) return viewWelcome();
    var qs = qsFor(bookId), first = qIndex(qs[0].id) + 1, c = answeredCount(bookId), w = S.written[bookId];
    var list = qs.map(function (q) {
      var i = qIndex(q.id) + 1, done = !!plain(S.answers[q.id]);
      return '<li><a href="#/q/' + i + '"><span class="qn">' + i + '</span><span>' + esc(q.q) + '</span>' +
        '<span class="dot' + (done ? ' on' : '') + '" aria-hidden="true"></span><span class="sr-only">' + (done ? 'answered' : 'not answered') + '</span></a></li>';
    }).join('');
    return '<section class="screen intro">' +
      '<p class="kicker">' + esc(b.n) + '</p><h1 tabindex="-1">' + esc(b.title) + '</h1>' +
      '<h2 class="sub">' + esc(b.sub) + '</h2>' +
      '<p>' + esc(b.framing) + '</p><p class="note">' + esc(b.note) + '</p>' +
      '<div class="actions">' + link(c ? 'Continue' : 'Begin', '#/q/' + first, 'primary wide') +
      (c ? btn(w && !isStale(bookId) ? 'Read my pages' : 'Write my pages', 'data-action="write" data-book="' + bookId + '"', 'wide') : '') + '</div>' +
      '<ol class="qlist" aria-label="Questions in this book">' + list + '</ol></section>';
  }

  function viewQuestion(n) {
    var i = n - 1, q = QS[i]; if (!q) return viewWelcome();
    var b = bookById(q.book), qs = qsFor(q.book), posInBook = qs.indexOf(q) + 1, lastInBook = posInBook === qs.length;
    var backHref = posInBook === 1 ? '#/intro/' + q.book : '#/q/' + (n - 1);
    var next = lastInBook
      ? btn('Write my pages', 'data-action="write" data-book="' + q.book + '"', 'primary')
      : link('Next', '#/q/' + (n + 1), 'primary');
    return '<section class="screen question">' +
      '<div class="progress"><div class="progress-text"><span>' + esc(b.n) + ' \u00b7 ' + esc(b.title) + '</span><span>' + n + ' of ' + QS.length + '</span></div>' +
      '<div class="bar" role="progressbar" aria-label="Progress" aria-valuemin="1" aria-valuemax="' + QS.length + '" aria-valuenow="' + n + '" aria-valuetext="Question ' + n + ' of ' + QS.length + '"><i data-w="' + Math.round(n / QS.length * 100) + '"></i></div></div>' +
      (posInBook === 1 ? '<p class="note book-note">' + esc(b.note) + '</p>' : '') +
      '<p class="qnum">Question ' + n + '</p>' +
      '<h1 id="qh" tabindex="-1">' + esc(q.q) + '</h1>' +
      '<p id="qhint" class="hint">' + esc(q.hint) + '</p>' +
      '<textarea id="answer" data-q="' + q.id + '" aria-labelledby="qh" aria-describedby="qhint" rows="7" autocapitalize="sentences" spellcheck="true">' + esc(S.answers[q.id] || '') + '</textarea>' +
      '<p class="saved" id="saved" aria-live="polite">' + (S.answers[q.id] ? 'Saved on this device' : '\u00a0') + '</p>' +
      '<nav class="qnav" aria-label="Question navigation">' + link('Back', backHref) + next + '</nav>' +
      '</section>';
  }

  function viewPages(bookId) {
    var b = bookById(bookId); if (!b) return viewWelcome();
    var w = S.written[bookId], idx = BOOKS.indexOf(b), nb = BOOKS[idx + 1];
    var top = '<p class="kicker">' + esc(b.n) + '</p><h1 tabindex="-1">' + esc(b.title) + ' \u2014 my pages</h1>';
    if (!w || isEmpty(bookId, w.data)) {
      return '<section class="screen">' + top + '<p class="empty"><b>Nothing written yet.</b> Answer at least one question in this book, then press <i>Write my pages</i>.</p>' +
        '<div class="actions">' + link('Go to the questions', '#/intro/' + bookId, 'primary wide') + '</div></section>';
    }
    var stale = isStale(bookId)
      ? '<div class="notice" role="status"><p>You\u2019ve changed answers since these pages were written.</p>' + btn('Rewrite my pages', 'data-action="write" data-book="' + bookId + '"', 'primary') + '</div>' : '';
    var pages = bookPages(bookId, w);
    var nextBtn = nb ? link('Next: ' + esc(nb.n) + ' \u00b7 ' + esc(nb.title), '#/intro/' + nb.id, 'primary wide') : link('Open my book', '#/book', 'primary wide');
    return '<section class="screen pages-view">' + top +
      '<p class="muted small">Written ' + esc(longDate(new Date(w.at))) + ' from your answers, word for word.</p>' + stale +
      '<div class="notebook">' + renderPages(pages, 1) + '</div>' +
      '<div class="actions">' + nextBtn + link('Edit answers', '#/intro/' + bookId, 'wide') + '</div></section>';
  }

  function viewMyBook() {
    var wb = wholeBook(S);
    var archives = S.archives.length
      ? '<h2 class="section-h">Earlier accountings</h2><ul class="archives">' + S.archives.slice().reverse().map(function (a) {
          return '<li><a class="book-row" href="#/archive/' + encodeURIComponent(a.date) + '"><span class="br-t">' + esc(a.date) + '</span><span class="br-status">' + esc(longDate(fromYmd(a.date))) + '</span></a></li>';
        }).join('') + '</ul>' : '';
    var stales = BOOKS.filter(function (b) { return isStale(b.id); });
    var staleNote = stales.length ? '<div class="notice" role="status"><p>Answers changed in ' + stales.map(function (b) { return esc(b.title); }).join(', ') + ' since the pages were written.</p>' +
      stales.map(function (b) { return btn('Rewrite ' + esc(b.title), 'data-action="write" data-book="' + b.id + '" data-stay="1"', 'primary'); }).join(' ') + '</div>' : '';
    var writeBtns = BOOKS.filter(function (b) { return !S.written[b.id] && answeredCount(b.id); })
      .map(function (b) { return btn('Write ' + esc(b.title) + ' pages', 'data-action="write" data-book="' + b.id + '" data-stay="1"', ''); }).join('');
    if (!wb.written) {
      return '<section class="screen mybook"><p class="kicker">Your own accounting</p><h1 tabindex="-1">My book</h1>' +
        '<p class="empty"><b>Nothing written yet.</b> Answer a section and press its <i>Write my pages</i> button \u2014 your book fills in here, one part at a time.</p>' +
        '<div class="actions">' + (writeBtns || link('Begin', '#/intro/past', 'primary wide')) + '</div>' + archives + '</section>';
    }
    return '<section class="screen mybook"><p class="kicker">Your own accounting</p><h1 tabindex="-1">My book</h1>' +
      '<p class="muted small">' + wb.count + ' pages \u00b7 ' + wb.written + ' of 3 books written</p>' + staleNote +
      '<div class="actions">' + btn('Save as PDF', 'data-action="print"', 'primary wide') + writeBtns + '</div>' +
      '<div class="notebook">' + wb.html + '</div>' + archives + '</section>';
  }

  function viewArchive(date) {
    var a = S.archives.filter(function (x) { return x.date === date; })[0];
    if (!a) return '<section class="screen"><h1 tabindex="-1">Not found</h1><p>No accounting saved for that date.</p>' + link('My book', '#/book', 'primary') + '</section>';
    var wb = wholeBook(a.book, { readonly: true, archiveDate: a.date });
    return '<section class="screen mybook"><p class="kicker">Earlier accounting</p><h1 tabindex="-1">' + esc(a.date) + '</h1>' +
      '<p class="muted small">Archived ' + esc(longDate(fromYmd(a.date))) + '. Read only.</p>' +
      '<div class="actions">' + btn('Save as PDF', 'data-action="print" data-archive="' + esc(a.date) + '"', 'primary wide') + link('Back to my book', '#/book', 'wide') + '</div>' +
      '<div class="notebook">' + wb.html + '</div></section>';
  }

  function viewSettings() {
    return '<section class="screen settings"><p class="kicker">Keeping your book</p><h1 tabindex="-1">Settings</h1>' +
      '<p class="yours">' + esc(PRIVACY) + '</p>' +
      '<div class="field"><label for="name">Name on the cover <span class="muted">(optional)</span></label>' +
      '<input id="name" type="text" autocomplete="name" value="' + esc(S.name) + '"></div>' +
      '<h2 class="section-h">Save a copy</h2>' +
      '<p class="muted">A PDF of your written pages, laid out as small notebook pages. On iPhone choose Print, then Share, then Save to Files.</p>' +
      '<div class="actions">' + btn('Save as PDF', 'data-action="print"', 'wide') + '</div>' +
      '<p class="muted">A backup file holds everything \u2014 answers, pages, and earlier years. Keep it somewhere private.</p>' +
      '<div class="actions">' + btn('Export backup', 'data-action="export"', 'wide') +
      '<label class="btn wide file-btn">Import backup<input type="file" id="import" accept="application/json,.json" class="sr-only"></label></div>' +
      '<h2 class="section-h">A new year</h2>' +
      '<p class="muted">Traditionally taken once a year. This files the current book under today\u2019s date (' + esc(ymd()) + ') and gives you a clean one. Earlier books stay readable under My book.</p>' +
      '<div class="actions">' + btn('Start a new year\u2019s accounting', 'data-action="newyear"', 'wide') + '</div>' +
      '<h2 class="section-h">Erase</h2>' +
      '<p class="muted">Removes every answer, page, and earlier year from this device. It cannot be undone unless you have a backup.</p>' +
      '<div class="actions">' + btn('Erase everything', 'data-action="erase"', 'danger wide') + '</div>' +
      '<p class="muted small" id="settings-status" role="status" aria-live="polite"></p>' +
      '</section>';
  }

  /* ---------- router ---------- */
  function route() {
    var h = location.hash || '#/welcome';
    var m, html;
    if ((m = /^#\/q\/(\d+)$/.exec(h))) html = viewQuestion(+m[1]);
    else if ((m = /^#\/intro\/(\w+)$/.exec(h))) html = viewIntro(m[1]);
    else if ((m = /^#\/pages\/(\w+)$/.exec(h))) html = viewPages(m[1]);
    else if (h === '#/book') html = viewMyBook();
    else if ((m = /^#\/archive\/(.+)$/.exec(h))) html = viewArchive(decodeURIComponent(m[1]));
    else if (h === '#/settings') html = viewSettings();
    else { h = '#/welcome'; html = viewWelcome(); }
    app.innerHTML = html;
    if (h !== '#/settings' && !/^#\/archive/.test(h)) { S.pos = h; save(); }
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      var on = (a.dataset.nav === 'book' && (h === '#/book' || /^#\/archive/.test(h))) || (a.dataset.nav === 'settings' && h === '#/settings');
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var bar = app.querySelector('.bar i'); if (bar) bar.style.width = bar.getAttribute('data-w') + '%';
    var ta = document.getElementById('answer'); if (ta) grow(ta);
    var titles = { '#/book': 'My book', '#/settings': 'Settings' };
    var h1 = app.querySelector('h1');
    document.title = (h1 && h !== '#/welcome' ? h1.textContent + ' \u00b7 ' : '') + 'The Bridge Book';
    if (h1 && routed) h1.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    routed = true;
  }
  var routed = false;

  function grow(ta) { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight + 2, 168) + 'px'; }

  /* ---------- confirm dialog ---------- */
  function ask(title, body, okLabel, danger) {
    var d = document.getElementById('confirm');
    if (!d || typeof d.showModal !== 'function') return Promise.resolve(window.confirm(title + '\n\n' + body));
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-body').textContent = body;
    var ok = document.getElementById('confirm-ok');
    ok.textContent = okLabel || 'OK';
    ok.className = 'btn ' + (danger ? 'danger' : 'primary');
    d.returnValue = '';
    return new Promise(function (resolve) {
      d.addEventListener('close', function h() { d.removeEventListener('close', h); resolve(d.returnValue === 'ok'); });
      d.showModal();
    });
  }

  /* ---------- actions ---------- */
  function preparePrint(st, archiveDate) {
    var wb = wholeBook(st || S, { readonly: true, archiveDate: archiveDate, mode: 'print' });
    document.getElementById('print').innerHTML = wb.html;
    return wb;
  }
  function doPrint(archiveDate) {
    var st = S;
    if (archiveDate) { var a = S.archives.filter(function (x) { return x.date === archiveDate; })[0]; if (a) st = a.book; }
    var wb = preparePrint(st, archiveDate);
    if (!wb.written) { status('Write at least one book\u2019s pages first.'); }
    window.print();
  }
  window.addEventListener('beforeprint', function () {
    if (!document.getElementById('print').innerHTML) preparePrint(S);
  });
  window.addEventListener('afterprint', function () { document.getElementById('print').innerHTML = ''; });

  function status(msg) { var el = document.getElementById('settings-status'); if (el) el.textContent = msg; }

  function exportBackup() {
    var data = JSON.parse(JSON.stringify(S));
    data.exportedAt = new Date().toISOString();
    data.app = 'The Bridge Book';
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'bridge-book-backup-' + ymd() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    status('Backup file saved.');
  }
  function importBackup(file) {
    var r = new FileReader();
    r.onload = function () {
      var o;
      try { o = JSON.parse(r.result); } catch (e) { status('That file isn\u2019t a Bridge Book backup.'); return; }
      if (!o || typeof o !== 'object' || !o.answers) { status('That file isn\u2019t a Bridge Book backup.'); return; }
      ask('Replace what\u2019s on this device?', 'The backup will replace your current answers, pages, and earlier years.', 'Replace').then(function (yes) {
        if (!yes) { status('Import cancelled.'); return; }
        S = normalize(o); save();
        location.hash = '#/book'; route();
      });
    };
    r.readAsText(file);
  }
  function newYear() {
    ask('Start a new year\u2019s accounting?', 'Your current book will be filed under ' + ymd() + ' and kept, read-only, under My book. You start again with blank pages.', 'Start new year').then(function (yes) {
      if (!yes) return;
      var date = ymd(), base = date, k = 2;
      while (S.archives.some(function (a) { return a.date === date; })) date = base + '-' + (k++);
      var snap = JSON.parse(JSON.stringify(S)); snap.archives = []; snap.pos = '';
      var archives = S.archives.concat([{ date: date, book: snap }]);
      var name = S.name;
      S = fresh(); S.name = name; S.archives = archives; save();
      location.hash = '#/welcome'; route();
    });
  }
  function eraseAll() {
    ask('Erase everything?', 'Every answer, page, and earlier year on this device will be deleted. This cannot be undone.', 'Erase everything', true).then(function (yes) {
      if (!yes) return;
      try { localStorage.removeItem(KEY); } catch (e) {}
      S = fresh(); save();
      location.hash = '#/welcome'; route();
    });
  }

  app.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'answer') {
      S.answers[t.dataset.q] = t.value;
      var ok = save(); grow(t);
      var s = document.getElementById('saved');
      if (s) s.textContent = ok ? 'Saved on this device' : 'Could not save \u2014 storage is full or blocked';
    } else if (t.id === 'name') { S.name = t.value; save(); }
  });
  app.addEventListener('keydown', function (e) {
    if (e.target.id === 'answer' && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      var nxt = app.querySelector('.qnav .primary'); if (nxt) { e.preventDefault(); nxt.click(); }
    }
  });
  app.addEventListener('change', function (e) {
    if (e.target.id === 'import' && e.target.files && e.target.files[0]) { importBackup(e.target.files[0]); e.target.value = ''; }
  });
  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]'); if (!el) return;
    var act = el.dataset.action;
    if (act === 'write') {
      var book = el.dataset.book;
      if (!S.written[book] || isStale(book) || el.textContent.indexOf('Write') === 0) writeBook(book);
      if (el.dataset.stay) route(); else if (location.hash === '#/pages/' + book) route(); else location.hash = '#/pages/' + book;
    } else if (act === 'toggle') {
      var f = S.written.future.data.facts[+el.dataset.i]; f.done = !f.done; save();
      el.setAttribute('aria-pressed', f.done ? 'true' : 'false');
      el.textContent = f.done ? 'true' : 'not yet';
      el.setAttribute('aria-label', f.t + ': ' + (f.done ? 'true' : 'not yet'));
      var li = el.closest('li'); li.classList.toggle('done', f.done);
      var box = li.querySelector('.box'); if (box) box.classList.toggle('on', f.done);
      var facts = S.written.future.data.facts, n = facts.filter(function (x) { return x.done; }).length;
      app.querySelectorAll('[data-tally]').forEach(function (t) { t.textContent = n + ' of ' + facts.length + ' true'; });
    } else if (act === 'print') doPrint(el.dataset.archive);
    else if (act === 'export') exportBackup();
    else if (act === 'newyear') newYear();
    else if (act === 'erase') eraseAll();
  });

  window.addEventListener('hashchange', route);
  /* re-flow notebook pages if the screen width changes (rotation) */
  var lastW = window.innerWidth, rt = null;
  window.addEventListener('resize', function () {
    if (Math.abs(window.innerWidth - lastW) < 20) return;
    lastW = window.innerWidth; clearTimeout(rt);
    rt = setTimeout(function () { if (app.querySelector('.notebook')) { var y = window.scrollY; route(); window.scrollTo(0, y); } }, 200);
  });
  window.addEventListener('storage', function (e) { if (e.key === KEY) { S = load(); route(); } });

  /* resume where left off */
  if (!location.hash && S.pos && S.pos !== '#/welcome') history.replaceState(null, '', S.pos);
  route();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  /* small hook for testing and printing; exposes nothing beyond this device */
  window.BridgeBook = { questions: QS, books: BOOKS, preparePrint: function () { return preparePrint(S); } };
})();
