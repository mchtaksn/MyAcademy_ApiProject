/* =================================================================
   Doksan Artı — ana sayfa: maç günü merkezi (home.js)
   1  Durum ve yardımcılar
   2  Sahne: başlık, öne çıkan maç (canlı / sıradaki / son), sayaçlar
   3  Haftanın maçları: hafta gezintisi, maç kartları, hafta şeridi
   4  Tablonun iki ucu: mini puan durumu (canlı), zirve yarışı grafiği
   5  Sayılarla sezon: rakam kartları, hücum / savunma / form
   6  Sezonun anları, takvimde sırada, duraklar
   7  Canlı güncellemeler ve başlat
   ================================================================= */
(function () {
    'use strict';

    var DA = window.DA;
    var TM = window.TM;
    if (!DA || !TM || !TM.league || !TM.charts) return;

    var L = TM.league;
    var C = TM.charts;
    var $ = DA.$;
    var $$ = DA.$$;
    var esc = DA.esc;

    /* ---------------------------------------------------------
       1. Durum ve yardımcılar
       --------------------------------------------------------- */
    var data = DA.getData();
    var state = {
        week: L.activeWeek(data.matches),
        feature: { index: 0, id: null, mode: '', timer: null, countdown: null, boards: null, hover: false },
        firstRender: true,
        keys: { finished: '', planned: '', week: '' }
    };

    var els = {
        kicker: $('[data-hero-kicker]'),
        facts: $('[data-hero-facts]'),
        feature: $('[data-feature]'),
        pager: $('[data-feature-pager]'),
        weekKicker: $('[data-week-kicker]'),
        weekTitle: $('[data-week-title]'),
        weekSub: $('[data-week-sub]'),
        weekLed: $('[data-week-led]'),
        weekPrev: $('[data-week-prev]'),
        weekNext: $('[data-week-next]'),
        weekLink: $('[data-week-link]'),
        weekBar: $('[data-week-bar]'),
        weekMatches: $('[data-week-matches]'),
        table: $('[data-mini-table]'),
        tableSub: $('[data-table-sub]'),
        tableLive: $('[data-table-live]'),
        race: $('[data-race-chart]'),
        kpis: $('[data-kpis]'),
        attack: $('[data-board-attack]'),
        defense: $('[data-board-defense]'),
        form: $('[data-board-form]'),
        records: $('[data-records]'),
        upcoming: $('[data-upcoming]')
    };

    var weekLed = DA.led(els.weekLed, '  ', 'green', false);

    function now() { return Date.now(); }
    function t(m) { return DA.toDate(m.matchDate).getTime(); }
    function isLate(m) { return m.status === L.PLANNED && t(m) + 2 * 3600000 < now(); }
    function weeks() { return L.weeksOf(data.matches); }
    function pct(v) { return DA.fmt.pct.format(Math.round(v * 100)); }

    function teamLink(id, name, logo, size) {
        return '<a class="hm-teamlink" href="' + DA.clubUrl(id) + '">' + DA.crest(name, logo, size || 'sm') + '<span>' + esc(name) + '</span></a>';
    }

    // Maç öncesi / canlı kazanma ihtimali şeridi
    function probBar(m, p, compact) {
        var h = Math.round(p.home * 100), d = Math.round(p.draw * 100), a = Math.max(0, 100 - h - d);
        var ca = DA.clubColors(m.homeTeamName).a;
        var cb = DA.clubColors(m.awayTeamName).a;
        var title = (p.inPlay ? 'Canlı kazanma ihtimali' : 'Kazanma ihtimali') + ': ' + m.homeTeamName + ' %' + h + ', beraberlik %' + d + ', ' + m.awayTeamName + ' %' + a;
        return '<div class="hm-prob' + (compact ? ' hm-prob--compact' : '') + '" role="img" aria-label="' + esc(title) + '" title="' + esc(title) + '">' +
            '<div class="hm-prob__bar">' +
            '<span style="--w:' + h + '%;--c:' + ca + '"></span>' +
            '<span class="is-draw" style="--w:' + d + '%"></span>' +
            '<span style="--w:' + a + '%;--c:' + cb + '"></span>' +
            '</div>' +
            (compact ? '' :
                '<div class="hm-prob__labels"><span><b>%' + h + '</b>' + esc(m.homeTeamName) + '</span><span><b>%' + d + '</b>Beraberlik</span><span><b>%' + a + '</b>' + esc(m.awayTeamName) + '</span></div>') +
            '</div>';
    }

    /* ---------------------------------------------------------
       2. Sahne
       --------------------------------------------------------- */
    function featureSet() {
        var live = data.matches.filter(L.isLive).sort(L.byDate);
        if (live.length) return { mode: 'live', list: live };
        var next = L.nextMatch(data.matches);
        if (next) return { mode: 'next', list: [next] };
        var done = data.matches.filter(L.isFinished).sort(L.byDate);
        if (done.length) return { mode: 'last', list: [done[done.length - 1]] };
        return { mode: 'none', list: [] };
    }

    function ringSvg(minute) {
        var v = Math.max(0, Math.min(90, minute)) / 90 * 100;
        return '<svg class="hm-ring" viewBox="0 0 220 220" aria-hidden="true">' +
            '<circle class="hm-ring__track" cx="110" cy="110" r="100" pathLength="100"/>' +
            '<circle class="hm-ring__ticks" cx="110" cy="110" r="88" pathLength="90"/>' +
            '<circle class="hm-ring__half" cx="110" cy="110" r="100" pathLength="100" stroke-dasharray="0.6 99.4" stroke-dashoffset="-49.7"/>' +
            '<circle class="hm-ring__bar" data-ring-bar cx="110" cy="110" r="100" pathLength="100" stroke-dasharray="' + v.toFixed(2) + ' 100"/>' +
            '</svg>';
    }

    function renderFeature(animate) {
        var set = featureSet();
        var f = state.feature;
        if (f.index >= set.list.length) f.index = 0;
        var m = set.list[f.index];
        if (f.countdown) { f.countdown.stop(); f.countdown = null; }
        f.boards = null;

        if (!m) {
            f.id = null;
            f.mode = 'none';
            els.feature.innerHTML = '<div class="da-empty"><svg aria-hidden="true"><use href="#i-calendar"/></svg><strong>Fikstür henüz boş</strong><p>Maçlar eklenince sahne burada açılır.</p></div>';
            els.pager.innerHTML = '';
            return;
        }

        f.id = m.id;
        f.mode = set.mode;
        var ch = DA.clubColors(m.homeTeamName);
        var ca = DA.clubColors(m.awayTeamName);
        var p = DA.predict(m, { live: set.mode === 'live', before: set.mode === 'last' });
        var clock = DA.liveClock(m);
        var d = DA.toDate(m.matchDate);

        var top = set.mode === 'live'
            ? '<span class="da-state da-state--live"><i class="da-pulse" aria-hidden="true"></i>Şu an canlı</span>'
            : set.mode === 'next'
                ? '<span class="da-state da-state--plan">Sıradaki maç</span>'
                : '<span class="da-state da-state--done">Son maç</span>';

        var center;
        if (set.mode === 'next') {
            center =
                '<div class="hm-feature__count" data-countdown>' +
                '<div><span class="da-board da-board--plain"><span class="da-led da-led--md" data-cd="d"></span></span><small>gün</small></div>' +
                '<div><span class="da-board da-board--plain"><span class="da-led da-led--md" data-cd="h"></span></span><small>saat</small></div>' +
                '<div><span class="da-board da-board--plain"><span class="da-led da-led--md" data-cd="m"></span></span><small>dakika</small></div>' +
                '</div>' +
                '<p class="hm-feature__when">' + esc(DA.fmt.dayLong.format(d)) + ' · ' + esc(DA.fmt.time.format(d)) + '</p>';
        } else {
            var live = set.mode === 'live';
            center =
                '<div class="hm-feature__dial">' + (live ? ringSvg(clock.minute) : '') +
                '<div class="hm-feature__score" aria-label="Skor ' + (m.homeScore || 0) + ' - ' + (m.awayScore || 0) + '">' +
                '<span class="da-board da-board--plain"><span class="da-led da-led--lg" data-fs="home"></span></span>' +
                '<span class="hm-feature__colon" aria-hidden="true"><i></i><i></i></span>' +
                '<span class="da-board da-board--plain"><span class="da-led da-led--lg" data-fs="away"></span></span>' +
                '</div></div>' +
                (live
                    ? '<p class="hm-feature__clock"><b data-live-text="' + m.id + '">' + esc(clock.text) + '</b><span data-feature-phase>' + esc(clock.label) + '</span></p>'
                    : '<p class="hm-feature__clock is-final"><b>MS</b><span>' + esc(DA.fmt.dayLong.format(d)) + '</span></p>');
        }

        var probTitle = set.mode === 'live' ? 'Canlı kazanma ihtimali' : set.mode === 'next' ? 'Kazanma ihtimali' : 'Maç öncesi tahmin';
        els.feature.style.setProperty('--ha', ch.a);
        els.feature.style.setProperty('--aa', ca.a);
        els.feature.setAttribute('data-mode', set.mode);
        els.feature.innerHTML =
            '<span class="hm-feature__glow" aria-hidden="true"></span>' +
            '<header class="hm-feature__top">' + top + '<span class="hm-feature__meta">' + m.week + '. hafta · ' + esc(m.stadium || '') + '</span></header>' +
            '<div class="hm-feature__match">' +
            '<a class="hm-feature__team" href="' + DA.clubUrl(m.homeTeamId) + '">' + DA.crest(m.homeTeamName, m.homeTeamLogo, 'xl') + '<strong>' + esc(m.homeTeamName) + '</strong><small>Ev sahibi</small></a>' +
            '<div class="hm-feature__center">' + center + '</div>' +
            '<a class="hm-feature__team" href="' + DA.clubUrl(m.awayTeamId) + '">' + DA.crest(m.awayTeamName, m.awayTeamLogo, 'xl') + '<strong>' + esc(m.awayTeamName) + '</strong><small>Deplasman</small></a>' +
            '</div>' +
            '<div class="hm-feature__prob"><p class="hm-feature__label">' + probTitle + '</p>' + probBar(m, p) + '</div>' +
            '<footer class="hm-feature__foot">' +
            '<a class="da-btn ' + (set.mode === 'live' ? 'da-btn--live' : 'da-btn--primary') + ' da-btn--small" href="' + DA.matchUrl(m.id) + '">' +
            '<svg aria-hidden="true"><use href="#i-' + (set.mode === 'live' ? 'live' : 'ball') + '"/></svg>' + (set.mode === 'next' ? 'Maç önizlemesi' : 'Maç merkezi') + '</a>' +
            '<span class="hm-feature__note">' + (set.mode === 'live' ? 'Skor değişince tabela kendiliğinden döner' : set.mode === 'next' ? 'Başlama saatine geri sayım' : 'Bir sonraki maç eklenince burada görünür') + '</span>' +
            '</footer>' +
            '<span class="da-shine" aria-hidden="true"></span>';

        if (set.mode === 'next') {
            f.countdown = DA.countdown($('[data-countdown]', els.feature), m.matchDate, function () { DA.loadData(); });
        } else {
            var tone = set.mode === 'live' ? 'green' : 'white';
            f.boards = {
                home: DA.led($('[data-fs="home"]', els.feature), String(m.homeScore || 0), tone, animate),
                away: DA.led($('[data-fs="away"]', els.feature), String(m.awayScore || 0), tone, animate),
                h: m.homeScore || 0,
                a: m.awayScore || 0
            };
        }
        DA.tilt(els.feature, 6);

        // Birden fazla canlı maç varsa noktalarla gezilir, kendiliğinden döner
        if (set.list.length > 1) {
            els.pager.innerHTML = set.list.map(function (x, i) {
                return '<button type="button" class="hm-pager__dot' + (i === f.index ? ' is-on' : '') + '" data-dot="' + i + '" aria-label="' + esc(x.homeTeamName + ' - ' + x.awayTeamName) + '" aria-pressed="' + (i === f.index) + '">' +
                    '<span>' + esc(DA.teamCode(x.homeTeamName)) + ' ' + (x.homeScore || 0) + '-' + (x.awayScore || 0) + ' ' + esc(DA.teamCode(x.awayTeamName)) + '</span></button>';
            }).join('');
            scheduleRotate(set.list.length);
        } else {
            els.pager.innerHTML = '';
            window.clearTimeout(f.timer);
        }
    }

    function scheduleRotate(count) {
        var f = state.feature;
        window.clearTimeout(f.timer);
        if (DA.reduceMotion || count < 2) return;
        f.timer = window.setTimeout(function () {
            if (f.hover || document.hidden) { scheduleRotate(count); return; }
            f.index = (f.index + 1) % count;
            renderFeature(true);
        }, 9000);
    }

    els.pager.addEventListener('click', function (e) {
        var dot = e.target.closest('[data-dot]');
        if (!dot) return;
        state.feature.index = Number(dot.getAttribute('data-dot'));
        renderFeature(true);
    });
    els.feature.addEventListener('pointerenter', function () { state.feature.hover = true; });
    els.feature.addEventListener('pointerleave', function () { state.feature.hover = false; });

    // Canlı maçta skor değişti: sadece dönen rakam yeniden yanar
    function updateFeatureScore() {
        var f = state.feature;
        if (!f.boards || f.mode !== 'live') return false;
        var m = data.matches.filter(function (x) { return x.id === f.id; })[0];
        if (!m || !L.isLive(m)) return false;
        var changed = false;
        if ((m.homeScore || 0) !== f.boards.h) {
            f.boards.home = DA.led($('[data-fs="home"]', els.feature), String(m.homeScore || 0), 'green', 300);
            f.boards.h = m.homeScore || 0;
            changed = true;
        }
        if ((m.awayScore || 0) !== f.boards.a) {
            f.boards.away = DA.led($('[data-fs="away"]', els.feature), String(m.awayScore || 0), 'green', 300);
            f.boards.a = m.awayScore || 0;
            changed = true;
        }
        if (changed) {
            var dial = $('.hm-feature__score', els.feature);
            DA.pulse(dial, 'is-goal');
            var prob = $('.hm-feature__prob', els.feature);
            if (prob) prob.innerHTML = '<p class="hm-feature__label">Canlı kazanma ihtimali</p>' + probBar(m, DA.predict(m, { live: true }));
        }
        return true;
    }

    function tickFeature() {
        var f = state.feature;
        if (f.mode !== 'live') return;
        var m = data.matches.filter(function (x) { return x.id === f.id; })[0];
        if (!m) return;
        var c = DA.liveClock(m);
        var bar = $('[data-ring-bar]', els.feature);
        if (bar) bar.setAttribute('stroke-dasharray', (Math.min(90, c.minute) / 90 * 100).toFixed(2) + ' 100');
        var phase = $('[data-feature-phase]', els.feature);
        if (phase) phase.textContent = c.label;
    }

    function renderFacts() {
        var o = L.outcomes(data.matches);
        var live = data.matches.filter(L.isLive).length;
        var aw = L.activeWeek(data.matches);
        var next = L.nextMatch(data.matches);
        var items = [
            { label: 'Aktif hafta', value: aw, suffix: '' },
            { label: 'Oynanan maç', value: o.total, suffix: '' },
            { label: 'Atılan gol', value: o.goals, suffix: '' }
        ];
        var fourth = live
            ? '<div class="is-live"><dt>Şu an canlı</dt><dd><i class="da-pulse" aria-hidden="true"></i>' + live + ' maç</dd></div>'
            : next ? '<div><dt>Sıradaki maç</dt><dd class="is-text">' + esc(DA.until(next.matchDate)) + '</dd></div>' : '';
        els.facts.innerHTML = items.map(function (x) {
            return '<div><dt>' + x.label + '</dt><dd><span data-count="' + x.value + '">' + x.value + '</span></dd></div>';
        }).join('') + fourth;
        $$('[data-count]', els.facts).forEach(C.countUp);

        els.kicker.classList.toggle('is-live', live > 0);
        $('span', els.kicker).textContent = live ? 'Serie A · ' + live + ' maç canlı' : 'Serie A 2026/27 · ' + aw + '. hafta';
    }

    /* ---------------------------------------------------------
       3. Haftanın maçları
       --------------------------------------------------------- */
    function cardRow(m, side, hasScore, win, lose) {
        var id = side === 'home' ? m.homeTeamId : m.awayTeamId;
        var name = side === 'home' ? m.homeTeamName : m.awayTeamName;
        var logo = side === 'home' ? m.homeTeamLogo : m.awayTeamLogo;
        var goals = side === 'home' ? m.homeScore : m.awayScore;
        return '<span class="hm-mcard__row' + (win ? ' is-win' : lose ? ' is-lose' : '') + '">' +
            DA.crest(name, logo, 'sm') +
            '<span class="hm-mcard__name">' + esc(name) + '</span>' +
            '<b class="hm-mcard__goals" data-goals="' + side + '">' + (hasScore ? goals : '') + '</b>' +
            '</span>';
    }

    function matchCard(m, i) {
        var live = L.isLive(m);
        var done = L.isFinished(m);
        var post = m.status === L.POSTPONED;
        var late = isLate(m);
        var scored = (live || done) && DA.hasScore(m);
        var hw = scored && m.homeScore > m.awayScore;
        var aw = scored && m.awayScore > m.homeScore;
        var d = DA.toDate(m.matchDate);
        var cls = live ? 'is-live' : done ? 'is-done' : post ? 'is-post' : late ? 'is-late' : 'is-plan';
        var foot;
        if (live) {
            var c = DA.liveClock(m);
            foot = '<span class="hm-mcard__progress" aria-hidden="true"><span style="--p:' + (Math.min(90, c.minute) / 90 * 100).toFixed(1) + '%"></span></span><span class="hm-mcard__phase">' + esc(c.label) + '</span>';
        } else if (done) {
            foot = '<span class="hm-mcard__venue"><svg aria-hidden="true"><use href="#i-pin"/></svg>' + esc(m.stadium || '') + '</span>';
        } else if (post) {
            foot = '<span class="hm-mcard__venue">Yeni tarih bekleniyor</span>';
        } else if (late) {
            foot = '<span class="hm-mcard__venue">Saati geçti, sonuç girilmedi</span>';
        } else {
            foot = probBar(m, DA.predict(m), true) + '<span class="hm-mcard__venue"><svg aria-hidden="true"><use href="#i-clock"/></svg>' + esc(DA.until(m.matchDate)) + '</span>';
        }
        var derbyInfo = DA.derby(m.homeTeamName, m.awayTeamName);
        return '<a class="hm-mcard ' + cls + (derbyInfo ? ' is-derby' : '') + '" href="' + DA.matchUrl(m.id) + '" data-match="' + m.id + '" data-reveal style="--i:' + i + ';--ha:' + DA.clubColors(m.homeTeamName).a + ';--aa:' + DA.clubColors(m.awayTeamName).a + '">' +
            '<span class="hm-mcard__stripe" aria-hidden="true"></span>' +
            '<span class="hm-mcard__top">' + DA.stateChip(m) + (derbyInfo ? '<span class="hm-mcard__derby" title="' + esc(derbyInfo.label) + '"><svg aria-hidden="true"><use href="#i-fire"/></svg>' + esc(derbyInfo.short) + '</span>' : '') + '<span class="hm-mcard__date">' + esc(DA.fmt.day.format(d)) + '</span></span>' +
            cardRow(m, 'home', scored, hw, aw) +
            cardRow(m, 'away', scored, aw, hw) +
            '<span class="hm-mcard__foot">' + foot + '</span>' +
            '</a>';
    }

    function renderWeek() {
        var list = data.matches.filter(function (m) { return m.week === state.week; }).sort(L.byDate);
        var all = weeks();
        var idx = all.indexOf(state.week);
        var counts = { done: 0, live: 0, plan: 0, post: 0, late: 0 };
        list.forEach(function (m) {
            if (L.isLive(m)) counts.live++;
            else if (L.isFinished(m)) counts.done++;
            else if (m.status === L.POSTPONED) counts.post++;
            else if (isLate(m)) counts.late++;
            else counts.plan++;
        });
        var parts = [];
        if (counts.live) parts.push(counts.live + ' canlı');
        if (counts.done) parts.push(counts.done + ' bitti');
        if (counts.plan) parts.push(counts.plan + ' oynanacak');
        if (counts.late) parts.push(counts.late + ' sonuç bekliyor');
        if (counts.post) parts.push(counts.post + ' ertelendi');
        var range = DA.weekRange(state.week);

        els.weekTitle.textContent = state.week + '. haftanın maçları';
        els.weekSub.textContent = (range ? range + ' · ' : '') + (parts.length ? parts.join(', ') : 'Bu haftaya henüz maç eklenmedi');
        els.weekKicker.classList.toggle('is-live', counts.live > 0);
        $('span', els.weekKicker).textContent = state.week === L.activeWeek(data.matches) ? (counts.live ? 'Şu an oynanıyor' : 'Bu hafta') : 'Maç günü';
        if (weekLed) weekLed.setText(DA.pad(state.week), DA.reduceMotion ? null : { stagger: 200 });
        els.weekPrev.disabled = idx <= 0;
        els.weekNext.disabled = idx < 0 || idx >= all.length - 1;
        els.weekLink.href = DA.fixturesUrl(state.week);

        // Hafta şeridi: her maç bir parça
        els.weekBar.innerHTML = list.map(function (m) {
            var c = L.isLive(m) ? 'is-live' : L.isFinished(m) ? 'is-done' : m.status === L.POSTPONED ? 'is-post' : isLate(m) ? 'is-late' : 'is-plan';
            return '<span class="' + c + '" title="' + esc(m.homeTeamName + ' - ' + m.awayTeamName) + '"></span>';
        }).join('');

        var first = state.firstRender;
        els.weekMatches.innerHTML = list.length
            ? list.map(matchCard).join('')
            : '<div class="da-empty"><svg aria-hidden="true"><use href="#i-calendar"/></svg><strong>Bu hafta boş</strong><p>Maçlar eklendiğinde burada görünür.</p></div>';
        if (first) DA.reveal(els.weekMatches);
        else $$('[data-reveal]', els.weekMatches).forEach(function (el) { el.classList.add('is-in'); });
    }

    function stepWeek(dir) {
        var all = weeks();
        var idx = all.indexOf(state.week);
        var next = all[idx + dir];
        if (next === undefined) return;
        state.week = next;
        els.weekMatches.classList.remove('is-swap-l', 'is-swap-r');
        void els.weekMatches.offsetWidth;
        els.weekMatches.classList.add(dir > 0 ? 'is-swap-r' : 'is-swap-l');
        renderWeek();
    }

    els.weekPrev.addEventListener('click', function () { stepWeek(-1); });
    els.weekNext.addEventListener('click', function () { stepWeek(1); });

    /* ---------------------------------------------------------
       4. Tablonun iki ucu
       --------------------------------------------------------- */
    function renderTable() {
        var anyLive = data.matches.some(L.isLive);
        var rows = L.table(data.teams, data.matches, { includeLive: true });
        var base = anyLive ? L.table(data.teams, data.matches) : null;
        var baseRank = {};
        if (base) base.forEach(function (r) { baseRank[r.id] = r.rank; });
        var playing = {};
        data.matches.filter(L.isLive).forEach(function (m) {
            playing[m.homeTeamId] = m;
            playing[m.awayTeamId] = m;
        });
        var maxPts = Math.max.apply(null, rows.map(function (r) { return r.points; }).concat([1]));
        var n = rows.length;
        var shown = n > 10 ? rows.slice(0, 6).concat([null]).concat(rows.slice(n - 3)) : rows;

        els.tableLive.hidden = !anyLive;
        els.tableSub.textContent = n > 10 ? 'İlk altı ve son üç' + (anyLive ? ' · canlı skorlarla' : '') : 'Bütün takımlar';

        DA.flip(els.table, '[data-team]', 'data-team', function () {
            els.table.innerHTML = shown.map(function (r, i) {
                if (!r) return '<li class="hm-trow hm-trow--gap" aria-hidden="true"><span>···</span></li>';
                var z = L.zone(r.rank, n);
                var move = base && baseRank[r.id] ? baseRank[r.id] - r.rank : 0;
                var live = playing[r.id];
                var form = r.form.map(function (f) {
                    var m = f.match;
                    var isNow = live && m.id === live.id;
                    return '<i class="da-form__pill da-form__pill--' + (isNow ? 'live' : f.r) + '" title="' + esc((isNow ? 'Canlı: ' : '') + m.homeTeamName + ' ' + m.homeScore + '-' + m.awayScore + ' ' + m.awayTeamName) + '">' + f.r + '</i>';
                });
                while (form.length < 5) form.unshift('<i class="da-form__pill da-form__pill--none" aria-hidden="true"></i>');
                return '<li class="hm-trow' + (z ? ' zone-' + z : '') + (live ? ' is-live' : '') + '" data-team="' + r.id + '" style="--i:' + i + ';--pw:' + (r.points / maxPts * 100).toFixed(1) + '%">' +
                    '<span class="hm-trow__rank">' + r.rank + '</span>' +
                    (move > 0 ? '<span class="hm-trow__move is-up" title="Canlı skorla ' + move + ' sıra yukarı"><svg aria-hidden="true"><use href="#i-up"/></svg></span>'
                        : move < 0 ? '<span class="hm-trow__move is-down" title="Canlı skorla ' + (-move) + ' sıra aşağı"><svg aria-hidden="true"><use href="#i-down"/></svg></span>'
                            : '<span class="hm-trow__move"></span>') +
                    '<a class="hm-trow__team" href="' + DA.clubUrl(r.id) + '">' + DA.crest(r.name, r.logoUrl, 'sm') + '<span>' + esc(r.name) + '</span>' +
                    (live ? '<i class="da-pulse" title="Şu an sahada"></i>' : '') + '</a>' +
                    '<span class="hm-trow__form da-form">' + form.join('') + '</span>' +
                    '<span class="hm-trow__gd">' + (r.gd > 0 ? '+' : '') + r.gd + '</span>' +
                    '<strong class="hm-trow__pts">' + r.points + '</strong>' +
                    '</li>';
            }).join('');
        });
    }

    function renderRace() {
        var top = L.table(data.teams, data.matches).slice(0, 5);
        var race = L.race(data.teams, data.matches);
        var fresh = els.race.cloneNode(false);
        els.race.parentNode.replaceChild(fresh, els.race);
        els.race = fresh;
        if (race.weeks.length < 1 || !top.length) {
            els.race.innerHTML = '<p class="tm-chart__empty">İlk hafta tamamlanınca zirve yarışı burada çizilir.</p>';
            return;
        }
        C.line(els.race, {
            height: 320,
            labels: race.weeks,
            series: top.map(function (r, i) {
                return { id: r.id, name: r.name, color: C.palette[i], values: race.points[r.id] };
            }),
            area: true,
            labelWidth: 112,
            xLabel: function (w) { return w + '. hf'; },
            tooltipTitle: function (i) { return race.weeks[i] + '. hafta sonu'; },
            valueText: function (v) { return v + ' P'; }
        });
    }

    /* ---------------------------------------------------------
       5. Sayılarla sezon
       --------------------------------------------------------- */
    function renderKpis() {
        var wk = L.weekly(data.matches).filter(function (w) { return w.finished > 0; });
        var o = L.outcomes(data.matches);
        var last = wk[wk.length - 1];
        var both = wk.map(function (w) {
            var list = data.matches.filter(function (m) { return m.week === w.week && L.isFinished(m); });
            var n = list.filter(function (m) { return m.homeScore > 0 && m.awayScore > 0; }).length;
            return list.length ? n / list.length * 100 : 0;
        });
        var tiles = [
            {
                icon: 'i-ball', label: 'Toplam gol', value: o.goals, dec: 0, color: '#3987e5',
                spark: wk.map(function (w) { return w.goals; }),
                note: last ? '<b>+' + last.goals + '</b> son biten haftada (' + last.week + '. hafta)' : 'Henüz gol yok'
            },
            {
                icon: 'i-target', label: 'Maç başına gol', value: o.avg, dec: 2, color: '#199e70',
                spark: wk.map(function (w) { return w.avg; }),
                note: o.total ? '<b>' + o.over25 + '</b> maç 2,5 gol üstü bitti' : 'Biten maç yok'
            },
            {
                icon: 'i-home', label: 'Ev sahibi kazandı', value: o.total ? o.home / o.total * 100 : 0, dec: 0, suffix: '%', color: '#9085e9',
                spark: wk.map(function (w) { return w.finished ? w.homeWins / w.finished * 100 : 0; }),
                note: '<b>' + o.home + '</b> ev · <b>' + o.draw + '</b> beraberlik · <b>' + o.away + '</b> deplasman'
            },
            {
                icon: 'i-swap', label: 'Karşılıklı gol', value: o.total ? o.bothScored / o.total * 100 : 0, dec: 0, suffix: '%', color: '#c98500',
                spark: both,
                note: '<b>' + o.cleanSheets + '</b> kez bir takım gol yemedi'
            }
        ];
        els.kpis.innerHTML = tiles.map(function (x, i) {
            return '<article class="hm-kpi" data-reveal style="--i:' + i + ';--c:' + x.color + '">' +
                '<header><span class="hm-kpi__icon"><svg aria-hidden="true"><use href="#' + x.icon + '"/></svg></span>' + x.label + '</header>' +
                '<strong class="hm-kpi__value" data-count="' + (Math.round(x.value * 100) / 100) + '" data-count-decimals="' + x.dec + '"' + (x.suffix ? ' data-count-suffix="' + x.suffix + '"' : '') + '>' +
                C.fmt(x.value, x.dec) + (x.suffix || '') + '</strong>' +
                '<p class="hm-kpi__note">' + x.note + '</p>' +
                '<div class="hm-kpi__spark" data-spark="' + i + '"></div>' +
                '</article>';
        }).join('');
        tiles.forEach(function (x, i) {
            C.spark($('[data-spark="' + i + '"]', els.kpis), x.spark, { color: x.color });
        });
        $$('[data-count]', els.kpis).forEach(C.countUp);
        DA.reveal(els.kpis);
    }

    function renderLeaders() {
        var rows = L.table(data.teams, data.matches).filter(function (r) { return r.played > 0; });
        if (!rows.length) {
            [els.attack, els.defense, els.form].forEach(function (el) { el.innerHTML = '<p class="tm-chart__empty">İlk sonuçlar girilince dolacak.</p>'; });
            return;
        }
        function crestOf(r) { return DA.crest(r.name, r.logoUrl, 'sm'); }
        var attack = rows.slice().sort(function (a, b) { return b.gf / b.played - a.gf / a.played || b.gf - a.gf; }).slice(0, 5);
        C.hbars(els.attack, attack.map(function (r) {
            return { label: r.name, sub: r.gf + ' gol · ' + r.played + ' maç', value: r.gf / r.played, display: C.fmt(r.gf / r.played, 2), crest: crestOf(r), href: DA.clubUrl(r.id), color: '#3987e5' };
        }));
        var defense = rows.slice().sort(function (a, b) { return a.ga / a.played - b.ga / b.played || b.cleanSheets - a.cleanSheets; }).slice(0, 5);
        C.hbars(els.defense, defense.map(function (r) {
            return { label: r.name, sub: r.ga + ' gol yedi · ' + r.cleanSheets + ' kez kalesini kapattı', value: Math.max(0.05, r.ga / r.played), display: C.fmt(r.ga / r.played, 2), crest: crestOf(r), href: DA.clubUrl(r.id), color: '#199e70' };
        }));
        var form = rows.map(function (r) {
            var pts = r.form.reduce(function (s, f) { return s + (f.r === 'G' ? 3 : f.r === 'B' ? 1 : 0); }, 0);
            return { r: r, pts: pts, text: r.form.map(function (f) { return f.r; }).join(' ') };
        }).sort(function (a, b) { return b.pts - a.pts || b.r.points - a.r.points; }).slice(0, 5);
        C.hbars(els.form, form.map(function (x) {
            return { label: x.r.name, sub: x.text, value: x.pts, display: x.pts + ' P', crest: crestOf(x.r), href: DA.clubUrl(x.r.id), color: '#c98500' };
        }), { max: 15 });
    }

    /* ---------------------------------------------------------
       6. Sezonun anları, takvimde sırada, duraklar
       --------------------------------------------------------- */
    function scoreLine(m) {
        return '<span class="hm-mline">' + DA.crest(m.homeTeamName, m.homeTeamLogo, 'xs') + '<span>' + esc(m.homeTeamName) + '</span>' +
            '<b>' + m.homeScore + '-' + m.awayScore + '</b>' +
            '<span>' + esc(m.awayTeamName) + '</span>' + DA.crest(m.awayTeamName, m.awayTeamLogo, 'xs') + '</span>';
    }

    function renderRecords() {
        var r = L.records(data.teams, data.matches);
        var items = [];
        if (r.biggestWin) items.push({ icon: 'i-fire', tone: 'red', label: 'En farklı galibiyet', body: scoreLine(r.biggestWin.match), meta: r.biggestWin.match.week + '. hafta · ' + r.biggestWin.margin + ' gol fark', href: DA.matchUrl(r.biggestWin.match.id) });
        if (r.highestScoring && (!r.biggestWin || r.highestScoring.match.id !== r.biggestWin.match.id)) items.push({ icon: 'i-ball', tone: 'blue', label: 'En gollü maç', body: scoreLine(r.highestScoring.match), meta: r.highestScoring.total + ' gol · ' + r.highestScoring.match.week + '. hafta', href: DA.matchUrl(r.highestScoring.match.id) });
        if (r.biggestAwayWin) items.push({ icon: 'i-arrow', tone: 'violet', label: 'Deplasmanda en farklı', body: scoreLine(r.biggestAwayWin.match), meta: r.biggestAwayWin.match.week + '. hafta', href: DA.matchUrl(r.biggestAwayWin.match.id) });
        function teamItem(s, icon, tone, label, count) {
            var t = s.team;
            items.push({ icon: icon, tone: tone, label: label, body: '<span class="hm-mline">' + DA.crest(t.name, t.logoUrl, 'xs') + '<span>' + esc(t.name) + '</span></span>', meta: count + ' maçtır sürüyor', href: DA.clubUrl(t.id), big: count });
        }
        if (r.winning) teamItem(r.winning, 'i-trophy', 'gold', 'Galibiyet serisi', r.winning.wins);
        if (r.unbeaten && (!r.winning || r.unbeaten.team.id !== r.winning.team.id || r.unbeaten.unbeaten > r.winning.wins)) teamItem(r.unbeaten, 'i-shield', 'green', 'Yenilmezlik serisi', r.unbeaten.unbeaten);
        if (r.winless) teamItem(r.winless, 'i-down', 'grey', 'Kazanamama serisi', r.winless.winless);

        els.records.innerHTML = items.length ? items.map(function (x, i) {
            return '<li style="--i:' + i + '"><a class="hm-record hm-record--' + x.tone + '" href="' + x.href + '">' +
                '<span class="hm-record__icon"><svg aria-hidden="true"><use href="#' + x.icon + '"/></svg></span>' +
                '<span class="hm-record__text"><small>' + esc(x.label) + '</small>' + x.body + '<span class="hm-record__meta">' + esc(x.meta) + '</span></span>' +
                (x.big ? '<span class="hm-record__big">' + x.big + '</span>' : '') +
                '</a></li>';
        }).join('') : '<li class="da-empty"><strong>Henüz rekor yok</strong><p>İlk maçlar oynanınca burada belirir.</p></li>';
    }

    function renderUpcoming() {
        var list = data.matches.filter(function (m) { return m.status === L.PLANNED && t(m) >= now(); }).sort(L.byDate).slice(0, 6);
        els.upcoming.innerHTML = list.length ? list.map(function (m, i) {
            var d = DA.toDate(m.matchDate);
            return '<li style="--i:' + i + '"><a class="hm-next" href="' + DA.matchUrl(m.id) + '">' +
                '<span class="hm-next__date"><b>' + d.getDate() + '</b><small>' + esc(DA.fmt.short.format(d).replace(/^\d+\s*/, '')) + '</small></span>' +
                '<span class="hm-next__teams">' +
                '<span>' + DA.crest(m.homeTeamName, m.homeTeamLogo, 'xs') + esc(m.homeTeamName) + '</span>' +
                '<span>' + DA.crest(m.awayTeamName, m.awayTeamLogo, 'xs') + esc(m.awayTeamName) + '</span>' +
                '</span>' +
                '<span class="hm-next__time"><b>' + esc(DA.fmt.time.format(d)) + '</b><small>' + esc(DA.until(m.matchDate)) + '</small></span>' +
                '</a></li>';
        }).join('') : '<li class="da-empty"><strong>Takvim boş</strong><p>Yeni maçlar eklenince burada sıralanır.</p></li>';
    }

    function renderStops() {
        var live = data.matches.filter(L.isLive).sort(L.byDate);
        var aw = L.activeWeek(data.matches);
        var leader = L.table(data.teams, data.matches)[0];
        var cities = {};
        data.teams.forEach(function (x) { if (x.city) cities[x.city] = true; });
        var hint = function (key, html) { var el = $('[data-stop="' + key + '"]'); if (el) el.innerHTML = html; };
        hint('fixtures', aw + '. hafta' + (live.length ? ' · <b class="is-live">' + live.length + ' canlı</b>' : ''));
        var target = live[0] || L.nextMatch(data.matches);
        var link = $('[data-stop-link="match"]');
        if (target) {
            if (link) link.href = DA.matchUrl(target.id);
            hint('match', (L.isLive(target) ? '<b class="is-live">Canlı</b> ' : 'Sıradaki: ') + esc(target.homeTeamName) + (L.isLive(target) ? ' ' + target.homeScore + '-' + target.awayScore + ' ' : ' - ') + esc(target.awayTeamName));
        }
        if (leader && leader.played) hint('standings', 'Lider: <b>' + esc(leader.name) + '</b> · ' + leader.points + ' P');
        hint('clubs', data.teams.length + ' kulüp · ' + Object.keys(cities).length + ' şehir');
    }

    /* ---------------------------------------------------------
       7. Canlı güncellemeler ve başlat
       --------------------------------------------------------- */
    function plannedKey() {
        return data.matches.filter(function (m) { return m.status === L.PLANNED || m.status === L.POSTPONED; })
            .map(function (m) { return m.id + ':' + m.matchDate + ':' + m.status; }).join('|');
    }

    function renderAll(first) {
        renderFacts();
        renderFeature(first);
        renderWeek();
        renderTable();
        var fk = DA.finishedKey();
        if (fk !== state.keys.finished) {
            state.keys.finished = fk;
            renderRace();
            renderKpis();
            renderLeaders();
            renderRecords();
        }
        var pk = plannedKey();
        if (pk !== state.keys.planned) {
            state.keys.planned = pk;
            renderUpcoming();
        }
        renderStops();
        state.firstRender = false;
    }

    DA.on('data', function (d) {
        data = d;
        var set = featureSet();
        var sameFeature = set.list[state.feature.index] && set.list[state.feature.index].id === state.feature.id && set.mode === state.feature.mode;
        // Aynı canlı maç sahnedeyse sadece skor döner; değilse sahne yeniden kurulur
        if (!sameFeature) renderFeature(true);
        else if (state.feature.mode === 'live') updateFeatureScore();
        renderFacts();
        if (weeks().indexOf(state.week) < 0) state.week = L.activeWeek(data.matches);
        renderWeek();
        renderTable();
        var fk = DA.finishedKey();
        if (fk !== state.keys.finished) {
            state.keys.finished = fk;
            renderRace();
            renderKpis();
            renderLeaders();
            renderRecords();
        }
        var pk = plannedKey();
        if (pk !== state.keys.planned) {
            state.keys.planned = pk;
            renderUpcoming();
        }
        renderStops();
    });

    // Gol: haftanın kartında ve tabloda kısa parıltı
    DA.on('goal', function (evt) {
        window.setTimeout(function () {
            DA.pulse($('[data-match="' + evt.match.id + '"]', els.weekMatches), 'is-goal');
            [evt.match.homeTeamId, evt.match.awayTeamId].forEach(function (id) {
                DA.pulse($('[data-team="' + id + '"]', els.table), 'is-goal');
            });
        }, 300);
    });

    DA.on('tick', function () {
        tickFeature();
        $$('.hm-mcard.is-live', els.weekMatches).forEach(function (card) {
            var m = data.matches.filter(function (x) { return String(x.id) === card.getAttribute('data-match'); })[0];
            if (!m) return;
            var c = DA.liveClock(m);
            var bar = $('.hm-mcard__progress span', card);
            if (bar) bar.style.setProperty('--p', (Math.min(90, c.minute) / 90 * 100).toFixed(1) + '%');
            var ph = $('.hm-mcard__phase', card);
            if (ph) ph.textContent = c.label;
        });
    });

    renderAll(true);
})();
