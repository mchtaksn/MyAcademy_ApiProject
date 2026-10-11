/* =================================================================
   Doksan Artı — Teknik Masa fikstür takvimi (admin-calendar.js)
   1  Durum ve tarih yardımcıları
   2  Ay görünümü (günler, maç rozetleri, klavye ile gezinme)
   3  Gün paneli
   4  Ajanda görünümü
   5  Ay özeti, kontroller, adres parametreleri (?month=2026-10&team=7)
   ================================================================= */
(function () {
    'use strict';

    var TM = window.TM;
    if (!TM || !TM.league) return;

    var L = TM.league;
    var $ = TM.$;
    var $$ = TM.$$;

    /* ---------------------------------------------------------
       1. Durum
       --------------------------------------------------------- */
    var data = TM.getData() || { teams: [], matches: [] };
    var MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    var fmtDayLong = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
    var fmtWeekday = new Intl.DateTimeFormat('tr-TR', { weekday: 'long' });

    var els = {
        days: $('[data-cal-days]'),
        month: $('[data-cal-month]'),
        year: $('[data-cal-year]'),
        side: $('[data-cal-day]'),
        team: $('[data-cal-team]'),
        monthView: $('[data-cal-month-view]'),
        agendaView: $('[data-cal-agenda-view]'),
        agenda: $('[data-cal-agenda]'),
        summary: $('[data-cal-summary]'),
        newBtn: $('[data-cal-new]')
    };

    function key(d) { return d.getFullYear() + '-' + TM.pad(d.getMonth() + 1) + '-' + TM.pad(d.getDate()); }
    function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
    function sameMonth(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); }

    function pickStartMonth() {
        var now = today();
        var list = data.matches;
        if (list.some(function (m) { return sameMonth(TM.toDate(m.matchDate), now); })) return new Date(now.getFullYear(), now.getMonth(), 1);
        var next = L.nextMatch(list);
        var d = next ? TM.toDate(next.matchDate) : (list.length ? TM.toDate(list[list.length - 1].matchDate) : now);
        return new Date(d.getFullYear(), d.getMonth(), 1);
    }

    var state = {
        month: pickStartMonth(),
        selected: null,       // seçili gün anahtarı
        team: '',
        view: 'month',
        direction: 0
    };

    function visibleMatches() {
        var t = Number(state.team);
        return data.matches.filter(function (m) { return !t || m.homeTeamId === t || m.awayTeamId === t; });
    }

    function byDay(list) {
        var map = {};
        list.forEach(function (m) {
            var k = key(TM.toDate(m.matchDate));
            (map[k] = map[k] || []).push(m);
        });
        Object.keys(map).forEach(function (k) { map[k].sort(L.byDate); });
        return map;
    }

    function statusClass(m) {
        return TM.isOverdue(m) ? 'late' : m.status;
    }

    function chip(m) {
        var d = TM.toDate(m.matchDate);
        var right = TM.hasScore(m.status)
            ? '<b>' + (m.homeScore == null ? 0 : m.homeScore) + '-' + (m.awayScore == null ? 0 : m.awayScore) + '</b>'
            : m.status === L.POSTPONED ? '<b>ERT</b>' : '<b class="is-time">' + TM.fmtTime.format(d) + '</b>';
        return '<a class="tm-chip2 tm-chip2--' + statusClass(m) + '" href="/Admin/Matches?edit=' + m.id + '" data-match="' + m.id + '" ' +
            'title="' + TM.esc(m.homeTeamName + ' - ' + m.awayTeamName + ', ' + TM.statusLabel(m.status)) + '">' +
            '<span class="tm-chip2__teams">' + TM.esc(TM.teamCode(m.homeTeamName)) + '<i>·</i>' + TM.esc(TM.teamCode(m.awayTeamName)) + '</span>' + right + '</a>';
    }

    /* ---------------------------------------------------------
       2. Ay görünümü
       --------------------------------------------------------- */
    function renderMonth() {
        var first = state.month;
        var startOffset = (first.getDay() + 6) % 7;     // Pazartesi başlangıç
        var start = new Date(first.getFullYear(), first.getMonth(), 1 - startOffset);
        var daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
        var cells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
        var map = byDay(visibleMatches());
        var todayKey = key(today());
        var max = 1;
        Object.keys(map).forEach(function (k) { if (map[k].length > max) max = map[k].length; });

        var html = '';
        for (var i = 0; i < cells; i++) {
            var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
            var k = key(d);
            var list = map[k] || [];
            var inMonth = d.getMonth() === first.getMonth();
            var weeks = list.map(function (m) { return m.week; }).filter(function (w, j, a) { return a.indexOf(w) === j; });
            var live = list.some(L.isLive);
            var late = list.some(function (m) { return TM.isOverdue(m); });
            var cls = 'tm-day' + (inMonth ? '' : ' is-out') + (k === todayKey ? ' is-today' : '') + (k === state.selected ? ' is-selected' : '') +
                (list.length ? ' has-matches' : '') + (live ? ' has-live' : '') + (late ? ' has-late' : '') + (d.getDay() === 0 || d.getDay() === 6 ? ' is-weekend' : '');
            html += '<div class="' + cls + '" role="gridcell" tabindex="' + (k === (state.selected || todayKey) ? '0' : '-1') + '" data-day="' + k + '" ' +
                'style="--i:' + i + ';--load:' + (list.length / max).toFixed(2) + '" aria-label="' + TM.esc(fmtDayLong.format(d)) + ', ' + (list.length ? list.length + ' maç' : 'maç yok') + '">' +
                '<span class="tm-day__top"><span class="tm-day__num">' + d.getDate() + '</span>' +
                (weeks.length ? '<span class="tm-day__week">' + weeks.join('/') + '. hf</span>' : '') + '</span>';
            if (list.length) {
                html += '<span class="tm-day__chips">' + list.slice(0, 3).map(chip).join('') +
                    (list.length > 3 ? '<span class="tm-day__more">+' + (list.length - 3) + ' maç</span>' : '') + '</span>';
            }
            html += '</div>';
        }

        els.days.classList.remove('is-in', 'is-from-left', 'is-from-right');
        els.days.innerHTML = html;
        void els.days.offsetWidth;
        els.days.classList.add('is-in', state.direction < 0 ? 'is-from-left' : state.direction > 0 ? 'is-from-right' : 'is-fade');
        els.month.textContent = MONTHS[first.getMonth()];
        els.year.textContent = first.getFullYear();
    }

    els.days.addEventListener('click', function (e) {
        if (e.target.closest('[data-match]')) return;   // rozet kendi linkine gider
        var cell = e.target.closest('[data-day]');
        if (!cell) return;
        selectDay(cell.getAttribute('data-day'), true);
    });

    els.days.addEventListener('keydown', function (e) {
        var cell = e.target.closest('[data-day]');
        if (!cell) return;
        var moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectDay(cell.getAttribute('data-day'), true); return; }
        if (!(e.key in moves)) return;
        e.preventDefault();
        var p = cell.getAttribute('data-day').split('-');
        var d = new Date(+p[0], +p[1] - 1, +p[2] + moves[e.key]);
        if (!sameMonth(d, state.month)) {
            state.direction = d > state.month ? 1 : -1;
            state.month = new Date(d.getFullYear(), d.getMonth(), 1);
            state.selected = key(d);
            render();
        } else {
            selectDay(key(d), false);
        }
        var target = els.days.querySelector('[data-day="' + key(d) + '"]');
        if (target) target.focus();
    });

    function selectDay(k, fromClick) {
        state.selected = k;
        $$('[data-day]', els.days).forEach(function (c) {
            var on = c.getAttribute('data-day') === k;
            c.classList.toggle('is-selected', on);
            c.tabIndex = on ? 0 : -1;
        });
        renderDay();
        TM.setParams({ day: k });
        if (fromClick && window.innerWidth < 1100) els.side.scrollIntoView({ block: 'start', behavior: TM.reduceMotion ? 'auto' : 'smooth' });
    }

    /* ---------------------------------------------------------
       3. Gün paneli
       --------------------------------------------------------- */
    function renderDay() {
        var k = state.selected || key(today());
        var p = k.split('-');
        var d = new Date(+p[0], +p[1] - 1, +p[2]);
        var list = byDay(visibleMatches())[k] || [];
        var isPast = d < today();

        var html = '<header class="tm-dayside__head">' +
            '<span class="tm-dayside__date"><strong>' + d.getDate() + '</strong><span>' + TM.esc(MONTHS[d.getMonth()]) + '</span></span>' +
            '<span class="tm-dayside__title"><strong>' + TM.esc(fmtWeekday.format(d)) + '</strong>' +
            '<small>' + (list.length ? list.length + ' maç' : 'Maç yok') + (k === key(today()) ? ' · bugün' : '') + '</small></span>' +
            '</header>';

        if (!list.length) {
            html += '<div class="tm-dayside__empty"><svg class="tm-icon" aria-hidden="true"><use href="#tm-i-calendar"/></svg>' +
                '<p>' + (isPast ? 'Bu tarihte oynanmış maç yok.' : 'Bu güne henüz maç planlanmadı.') + '</p>' +
                (isPast ? '' : '<a class="tm-btn tm-btn--primary tm-btn--small" href="/Admin/Matches?new=1&date=' + k + '"><svg class="tm-icon" aria-hidden="true"><use href="#tm-i-plus"/></svg>Bu güne maç ekle</a>') +
                '</div>';
        } else {
            html += '<ul class="tm-daylist">' + list.map(function (m, i) {
                var dt = TM.toDate(m.matchDate);
                var scored = TM.hasScore(m.status);
                var late = TM.isOverdue(m);
                return '<li style="--i:' + i + '"><a class="tm-dayitem tm-dayitem--' + statusClass(m) + '" href="/Admin/Matches?edit=' + m.id + '">' +
                    '<span class="tm-dayitem__time">' + TM.fmtTime.format(dt) + '</span>' +
                    '<span class="tm-dayitem__teams">' +
                    '<span>' + TM.crest(m.homeTeamName, m.homeTeamLogo, 'xs') + TM.esc(m.homeTeamName) + (scored ? '<b>' + (m.homeScore == null ? 0 : m.homeScore) + '</b>' : '') + '</span>' +
                    '<span>' + TM.crest(m.awayTeamName, m.awayTeamLogo, 'xs') + TM.esc(m.awayTeamName) + (scored ? '<b>' + (m.awayScore == null ? 0 : m.awayScore) + '</b>' : '') + '</span>' +
                    '</span>' +
                    '<span class="tm-dayitem__meta"><span class="tm-dayitem__status">' + (late ? 'Sonuç bekliyor' : TM.statusLabel(m.status)) + '</span>' + m.week + '. hafta · ' + TM.esc(m.stadium || '') + '</span>' +
                    '</a></li>';
            }).join('') + '</ul>';
            if (!isPast) {
                html += '<a class="tm-dayside__add" href="/Admin/Matches?new=1&date=' + k + '"><svg class="tm-icon" aria-hidden="true"><use href="#tm-i-plus"/></svg>Bu güne maç ekle</a>';
            }
        }
        els.side.innerHTML = html;
        els.side.classList.remove('is-in');
        void els.side.offsetWidth;
        els.side.classList.add('is-in');
        els.newBtn.href = isPast ? '/Admin/Matches?new=1' : '/Admin/Matches?new=1&date=' + k;
    }

    /* ---------------------------------------------------------
       4. Ajanda
       --------------------------------------------------------- */
    function renderAgenda() {
        var month = state.month;
        var list = visibleMatches().filter(function (m) { return sameMonth(TM.toDate(m.matchDate), month); }).sort(L.byDate);
        if (!list.length) {
            els.agenda.innerHTML = '<p class="tm-chart__empty">' + MONTHS[month.getMonth()] + ' ayında maç yok.</p>';
            return;
        }
        var map = byDay(list);
        var todayKey = key(today());
        els.agenda.innerHTML = Object.keys(map).sort().map(function (k, gi) {
            var p = k.split('-');
            var d = new Date(+p[0], +p[1] - 1, +p[2]);
            return '<section class="tm-agday' + (k === todayKey ? ' is-today' : '') + '" style="--i:' + gi + '">' +
                '<h3 class="tm-agday__head"><span>' + d.getDate() + '</span>' + TM.esc(MONTHS[d.getMonth()] + ', ' + fmtWeekday.format(d)) + '<small>' + map[k].length + ' maç</small></h3>' +
                '<ul class="tm-daylist">' + map[k].map(function (m) {
                    var scored = TM.hasScore(m.status);
                    return '<li><a class="tm-dayitem tm-dayitem--' + statusClass(m) + '" href="/Admin/Matches?edit=' + m.id + '">' +
                        '<span class="tm-dayitem__time">' + TM.fmtTime.format(TM.toDate(m.matchDate)) + '</span>' +
                        '<span class="tm-dayitem__teams tm-dayitem__teams--row">' +
                        '<span>' + TM.crest(m.homeTeamName, m.homeTeamLogo, 'xs') + TM.esc(m.homeTeamName) + '</span>' +
                        '<b class="tm-dayitem__score">' + (scored ? (m.homeScore == null ? 0 : m.homeScore) + ' - ' + (m.awayScore == null ? 0 : m.awayScore) : 'vs') + '</b>' +
                        '<span>' + TM.crest(m.awayTeamName, m.awayTeamLogo, 'xs') + TM.esc(m.awayTeamName) + '</span>' +
                        '</span>' +
                        '<span class="tm-dayitem__meta"><span class="tm-dayitem__status">' + (TM.isOverdue(m) ? 'Sonuç bekliyor' : TM.statusLabel(m.status)) + '</span>' + m.week + '. hafta</span>' +
                        '</a></li>';
                }).join('') + '</ul></section>';
        }).join('');
    }

    /* ---------------------------------------------------------
       5. Ay özeti ve kontroller
       --------------------------------------------------------- */
    function renderSummary() {
        var list = visibleMatches().filter(function (m) { return sameMonth(TM.toDate(m.matchDate), state.month); });
        var done = list.filter(L.isFinished);
        var goals = done.reduce(function (s, m) { return s + m.homeScore + m.awayScore; }, 0);
        var weeks = list.map(function (m) { return m.week; }).filter(function (w, i, a) { return a.indexOf(w) === i; }).sort(function (a, b) { return a - b; });
        var items = [
            { label: 'Maç', value: list.length },
            { label: 'Oynanan', value: done.length },
            { label: 'Kalan', value: list.filter(function (m) { return m.status === L.PLANNED; }).length },
            { label: 'Gol', value: goals },
            { label: 'Haftalar', value: weeks.length ? (weeks.length > 1 ? weeks[0] + '-' + weeks[weeks.length - 1] : weeks[0]) : '–' }
        ];
        els.summary.innerHTML = items.map(function (it, i) {
            return '<div style="--i:' + i + '"><span>' + it.label + '</span><strong>' + it.value + '</strong></div>';
        }).join('');
    }

    function render() {
        els.month.textContent = MONTHS[state.month.getMonth()];
        els.year.textContent = state.month.getFullYear();
        renderSummary();
        if (state.view === 'month') renderMonth(); else renderAgenda();
        renderDay();
        TM.setParams({ month: state.month.getFullYear() + '-' + TM.pad(state.month.getMonth() + 1) });
    }

    function shift(n) {
        state.direction = n;
        state.month = new Date(state.month.getFullYear(), state.month.getMonth() + n, 1);
        render();
    }

    $('[data-cal-prev]').addEventListener('click', function () { shift(-1); });
    $('[data-cal-next]').addEventListener('click', function () { shift(1); });
    $('[data-cal-today]').addEventListener('click', function () {
        var t = today();
        state.direction = t > state.month ? 1 : t < state.month ? -1 : 0;
        state.month = new Date(t.getFullYear(), t.getMonth(), 1);
        state.selected = key(t);
        render();
    });

    els.team.addEventListener('change', function () {
        state.team = els.team.value;
        state.direction = 0;
        TM.setParams({ team: state.team || null });
        render();
    });

    $$('[data-cal-view]').forEach(function (b) {
        b.addEventListener('click', function () {
            state.view = b.getAttribute('data-cal-view');
            $$('[data-cal-view]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
            els.monthView.hidden = state.view !== 'month';
            els.agendaView.hidden = state.view !== 'agenda';
            state.direction = 0;
            render();
        });
    });

    // Sol/sağ ok tuşu ile ay değiştirme (takvim dışında)
    document.addEventListener('keydown', function (e) {
        if (document.querySelector('dialog[open]')) return;
        var t = e.target;
        if (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || (t.closest && t.closest('[data-cal-days]'))) return;
        if (e.key === 'PageUp') { e.preventDefault(); shift(-1); }
        if (e.key === 'PageDown') { e.preventDefault(); shift(1); }
    });

    /* Adres parametreleri */
    var p = TM.params();
    var m = /^(\d{4})-(\d{2})$/.exec(p.get('month') || '');
    if (m) state.month = new Date(+m[1], +m[2] - 1, 1);
    if (/^\d{4}-\d{2}-\d{2}$/.test(p.get('day') || '')) state.selected = p.get('day');
    if (p.get('team')) { state.team = p.get('team'); els.team.value = state.team; }
    // Dar ekranda ay tablosu sıkışır; ajanda ile açılır
    if (window.innerWidth < 640) {
        state.view = 'agenda';
        $$('[data-cal-view]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-cal-view') === 'agenda')); });
        els.monthView.hidden = true;
        els.agendaView.hidden = false;
    }
    if (!state.selected) {
        var t = today();
        if (sameMonth(t, state.month)) state.selected = key(t);
        else {
            var firstWith = visibleMatches().filter(function (x) { return sameMonth(TM.toDate(x.matchDate), state.month); }).sort(L.byDate)[0];
            state.selected = firstWith ? key(TM.toDate(firstWith.matchDate)) : key(state.month);
        }
    }
    render();
})();
