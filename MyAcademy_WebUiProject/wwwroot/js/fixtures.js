/* =================================================================
   Doksan Artı — fikstür (fixtures.js)
   1  Durum
   2  Hafta tabelası ve 38 haftalık şerit
   3  Özet ve ilerleme şeridi
   4  Maç satırı
   5  Hafta görünümü: günlere göre
   6  Takım görünümü: bir takımın bütün sezonu
   7  Olaylar, canlı güncellemeler ve başlat
   ================================================================= */
(function () {
    'use strict';

    var DA = window.DA;
    var TM = window.TM;
    if (!DA || !TM || !TM.league) return;

    var L = TM.league;
    var $ = DA.$;
    var $$ = DA.$$;
    var esc = DA.esc;
    var SEASON_WEEKS = 38;

    /* ---------------------------------------------------------
       1. Durum
       --------------------------------------------------------- */
    var boot = window.DA_FX || {};
    var data = DA.getData();
    var state = {
        week: null,
        team: boot.team || null,
        liveOnly: false,
        first: true
    };

    var els = {
        kicker: $('[data-fx-kicker]'),
        lead: $('[data-fx-lead]'),
        weekLed: $('[data-week-led]'),
        weekTitle: $('[data-week-title]'),
        weekRange: $('[data-week-range]'),
        prev: $('[data-week-prev]'),
        next: $('[data-week-next]'),
        board: $('[data-weekboard]'),
        rail: $('[data-rail]'),
        railView: $('[data-rail-viewport]'),
        railLeft: $('[data-rail-left]'),
        railRight: $('[data-rail-right]'),
        summary: $('[data-summary]'),
        progress: $('[data-progress-bar]'),
        liveOnlyWrap: $('[data-liveonly-wrap]'),
        liveOnly: $('[data-liveonly]'),
        team: $('[data-team]'),
        days: $('[data-days]'),
        teamView: $('[data-teamview]')
    };

    var weekBoard = DA.led(els.weekLed, '  ', 'green', false);

    function weeks() { return L.weeksOf(data.matches); }
    function t(m) { return DA.toDate(m.matchDate).getTime(); }
    function isLate(m) { return m.status === L.PLANNED && t(m) + 2 * 3600000 < Date.now(); }
    function weekMatches(w) { return data.matches.filter(function (m) { return m.week === w; }).sort(L.byDate); }
    function teamName(id) { var x = data.teams.filter(function (tm) { return tm.id === id; })[0]; return x ? x.name : ''; }

    var initialWeek = boot.week && weeks().indexOf(boot.week) >= 0 ? boot.week : L.activeWeek(data.matches);
    state.week = initialWeek;

    /* ---------------------------------------------------------
       2. Hafta tabelası ve şerit
       --------------------------------------------------------- */
    function weekState(w) {
        var list = weekMatches(w);
        if (!list.length) return 'empty';
        if (list.some(L.isLive)) return 'live';
        if (list.every(function (m) { return L.isFinished(m) || m.status === L.POSTPONED; })) return 'done';
        if (list.some(L.isFinished)) return 'partial';
        return 'plan';
    }

    function renderRail() {
        var active = L.activeWeek(data.matches);
        var max = Math.max(SEASON_WEEKS, weeks().length ? weeks()[weeks().length - 1] : 0);
        var html = '';
        for (var w = 1; w <= max; w++) {
            var st = weekState(w);
            var list = weekMatches(w);
            var done = list.filter(L.isFinished).length;
            var ratio = list.length ? done / list.length : 0;
            var cls = 'fx-pill is-' + st + (w === state.week && !state.team ? ' is-selected' : '') + (w === active ? ' is-current' : '');
            html += '<button type="button" class="' + cls + '" data-week="' + w + '"' + (st === 'empty' ? ' disabled' : '') +
                ' aria-pressed="' + (w === state.week && !state.team) + '" title="' + w + '. hafta' + (list.length ? ' · ' + done + '/' + list.length + ' maç bitti' : ' · henüz maç yok') + '">' +
                '<b>' + w + '</b><span class="fx-pill__bar" style="--p:' + (ratio * 100).toFixed(0) + '%"></span>' +
                (st === 'live' ? '<i class="da-pulse" aria-hidden="true"></i>' : '') +
                '</button>';
        }
        els.rail.innerHTML = html;
        scrollRailTo(state.week, state.first);
    }

    function scrollRailTo(w, instant) {
        var pill = $('[data-week="' + w + '"]', els.rail);
        if (!pill) return;
        var target = pill.offsetLeft - els.railView.clientWidth / 2 + pill.offsetWidth / 2;
        els.railView.scrollTo({ left: Math.max(0, target), behavior: instant || DA.reduceMotion ? 'auto' : 'smooth' });
    }

    els.rail.addEventListener('click', function (e) {
        var pill = e.target.closest('[data-week]');
        if (!pill || pill.disabled) return;
        goWeek(Number(pill.getAttribute('data-week')), 0);
    });
    els.railLeft.addEventListener('click', function () { els.railView.scrollBy({ left: -360, behavior: DA.reduceMotion ? 'auto' : 'smooth' }); });
    els.railRight.addEventListener('click', function () { els.railView.scrollBy({ left: 360, behavior: DA.reduceMotion ? 'auto' : 'smooth' }); });

    function renderBoard() {
        var all = weeks();
        if (state.team) {
            var name = teamName(state.team);
            els.weekTitle.textContent = name + ' sezonu';
            els.weekRange.textContent = 'Bütün haftalar';
            weekBoard = DA.led(els.weekLed, DA.teamCode(name), 'white', true);
            els.weekLed.setAttribute('data-mode', 'team');
            els.prev.disabled = true;
            els.next.disabled = true;
            els.board.classList.add('is-team');
            return;
        }
        els.board.classList.remove('is-team');
        if (els.weekLed.getAttribute('data-mode') === 'team') {
            weekBoard = DA.led(els.weekLed, '  ', 'green', false);
            els.weekLed.removeAttribute('data-mode');
        }
        var idx = all.indexOf(state.week);
        var st = weekState(state.week);
        if (weekBoard) weekBoard.setText(DA.pad(state.week), DA.reduceMotion ? null : { stagger: 220 });
        els.weekLed.closest('.da-board').classList.toggle('is-live', st === 'live');
        els.weekTitle.textContent = state.week + '. hafta';
        var range = DA.weekRange(state.week);
        var label = { live: 'Şu an oynanıyor', done: 'Tamamlandı', partial: 'Devam ediyor', plan: 'Oynanacak', empty: 'Maç yok' }[st];
        els.weekRange.innerHTML = (range ? esc(range) + ' · ' : '') + '<span class="fx-weekboard__state is-' + st + '">' + label + '</span>';
        els.prev.disabled = idx <= 0;
        els.next.disabled = idx < 0 || idx >= all.length - 1;
    }

    function goWeek(w, dir) {
        if (weeks().indexOf(w) < 0) return;
        if (!dir) dir = w > state.week ? 1 : -1;
        state.week = w;
        state.team = null;
        els.team.value = '';
        DA.setParams({ week: w, team: null });
        document.title = w + '. hafta fikstürü – Doksan Artı';
        els.days.classList.remove('is-swap-l', 'is-swap-r');
        void els.days.offsetWidth;
        els.days.classList.add(dir > 0 ? 'is-swap-r' : 'is-swap-l');
        render();
        scrollRailTo(w, false);
    }

    els.prev.addEventListener('click', function () {
        var all = weeks();
        var i = all.indexOf(state.week);
        if (i > 0) goWeek(all[i - 1], -1);
    });
    els.next.addEventListener('click', function () {
        var all = weeks();
        var i = all.indexOf(state.week);
        if (i >= 0 && i < all.length - 1) goWeek(all[i + 1], 1);
    });

    // Klavye: sol / sağ ok ile hafta değişir (bir alana yazı yazılmıyorsa)
    document.addEventListener('keydown', function (e) {
        if (state.team || e.altKey || e.ctrlKey || e.metaKey) return;
        var tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
        if (e.key === 'ArrowLeft') els.prev.click();
        if (e.key === 'ArrowRight') els.next.click();
    });

    /* ---------------------------------------------------------
       3. Özet ve ilerleme şeridi
       --------------------------------------------------------- */
    function renderSummary(list) {
        var c = { done: 0, live: 0, plan: 0, late: 0, post: 0, goals: 0 };
        list.forEach(function (m) {
            if (L.isLive(m)) { c.live++; c.goals += (m.homeScore || 0) + (m.awayScore || 0); }
            else if (L.isFinished(m)) { c.done++; c.goals += m.homeScore + m.awayScore; }
            else if (m.status === L.POSTPONED) c.post++;
            else if (isLate(m)) c.late++;
            else c.plan++;
        });
        var chips = [];
        if (c.live) chips.push('<span class="fx-sum fx-sum--live"><i class="da-pulse" aria-hidden="true"></i><b>' + c.live + '</b> canlı</span>');
        chips.push('<span class="fx-sum fx-sum--done"><b>' + c.done + '</b> bitti</span>');
        if (c.plan) chips.push('<span class="fx-sum fx-sum--plan"><b>' + c.plan + '</b> oynanacak</span>');
        if (c.late) chips.push('<span class="fx-sum fx-sum--late"><b>' + c.late + '</b> sonuç bekliyor</span>');
        if (c.post) chips.push('<span class="fx-sum fx-sum--post"><b>' + c.post + '</b> ertelendi</span>');
        chips.push('<span class="fx-sum fx-sum--goals"><svg aria-hidden="true"><use href="#i-ball"/></svg><b>' + c.goals + '</b> gol</span>');
        els.summary.innerHTML = chips.join('');

        els.progress.innerHTML = list.map(function (m) {
            var cl = L.isLive(m) ? 'is-live' : L.isFinished(m) ? 'is-done' : m.status === L.POSTPONED ? 'is-post' : isLate(m) ? 'is-late' : 'is-plan';
            return '<span class="' + cl + '"></span>';
        }).join('');

        els.liveOnlyWrap.hidden = c.live === 0;
        if (!c.live && state.liveOnly) { state.liveOnly = false; els.liveOnly.checked = false; }

        els.kicker.classList.toggle('is-live', data.matches.some(L.isLive));
        var liveAll = data.matches.filter(L.isLive).length;
        $('span', els.kicker).textContent = liveAll ? 'Serie A · ' + liveAll + ' maç canlı' : 'Serie A 2026/27';
    }

    /* ---------------------------------------------------------
       4. Maç satırı
       --------------------------------------------------------- */
    function timeCell(m, res) {
        res = res || '';
        if (L.isLive(m)) {
            var c = DA.liveClock(m);
            var p = Math.min(90, c.minute) / 90 * 100;
            return '<span class="fx-row__time is-live"><span class="fx-mini-ring" style="--p:' + p.toFixed(1) + '%"></span>' +
                '<b data-live-text="' + m.id + '">' + esc(c.text) + '</b><small>' + esc(c.label) + '</small>' + res + '</span>';
        }
        if (L.isFinished(m)) return '<span class="fx-row__time is-done"><b>MS</b><small>' + esc(DA.fmt.time.format(DA.toDate(m.matchDate))) + '</small>' + res + '</span>';
        if (m.status === L.POSTPONED) return '<span class="fx-row__time is-post"><b>ERT</b><small>Ertelendi</small></span>';
        return '<span class="fx-row__time' + (isLate(m) ? ' is-late' : '') + '"><b>' + esc(DA.fmt.time.format(DA.toDate(m.matchDate))) + '</b><small>' + (isLate(m) ? 'Sonuç yok' : 'Roma ' + esc(DA.romeTime ? DA.romeTime.format(DA.toDate(m.matchDate)) : '')) + '</small></span>';
    }

    function rowHtml(m, i, focusTeam) {
        var live = L.isLive(m);
        var done = L.isFinished(m);
        var scored = (live || done) && DA.hasScore(m);
        var hw = scored && m.homeScore > m.awayScore;
        var aw = scored && m.awayScore > m.homeScore;
        var cls = live ? 'is-live' : done ? 'is-done' : m.status === L.POSTPONED ? 'is-post' : isLate(m) ? 'is-late' : 'is-plan';
        var res = '';
        if (focusTeam && done) {
            var r = L.outcomeFor(m, focusTeam);
            res = '<i class="da-form__pill da-form__pill--' + r + ' fx-row__res" title="' + { G: 'Galibiyet', B: 'Beraberlik', M: 'Mağlubiyet' }[r] + '">' + r + '</i>';
        } else if (focusTeam && live) {
            res = '<i class="da-form__pill da-form__pill--live fx-row__res" title="Canlı">C</i>';
        }
        var score = scored
            ? '<span class="fx-row__score"><b data-side="home">' + m.homeScore + '</b><i>-</i><b data-side="away">' + m.awayScore + '</b></span>'
            : '<span class="fx-row__score is-empty"><i>vs</i></span>';
        var meta;
        if (live || done) meta = '<span class="fx-row__meta"><span class="fx-row__venue"><svg aria-hidden="true"><use href="#i-pin"/></svg>' + esc(m.stadium || '') + '</span></span>';
        else if (m.status === L.POSTPONED) meta = '<span class="fx-row__meta">Yeni tarih bekleniyor</span>';
        else if (isLate(m)) meta = '<span class="fx-row__meta is-late">Saati geçti, sonuç girilmedi</span>';
        else {
            var p = DA.predict(m);
            meta = '<span class="fx-row__meta"><span class="fx-row__until">' + esc(DA.until(m.matchDate)) + '</span>' +
                '<span class="fx-row__prob" title="' + esc('Kazanma ihtimali: ' + m.homeTeamName + ' %' + Math.round(p.home * 100) + ', beraberlik %' + Math.round(p.draw * 100) + ', ' + m.awayTeamName + ' %' + Math.round(p.away * 100)) + '">' +
                '<span style="--w:' + (p.home * 100).toFixed(0) + '%;--c:' + DA.clubColors(m.homeTeamName).a + '"></span>' +
                '<span class="is-draw" style="--w:' + (p.draw * 100).toFixed(0) + '%"></span>' +
                '<span style="--w:' + (p.away * 100).toFixed(0) + '%;--c:' + DA.clubColors(m.awayTeamName).a + '"></span></span></span>';
        }
        var derbyInfo = DA.derby(m.homeTeamName, m.awayTeamName);
        return '<a class="fx-row ' + cls + (derbyInfo ? ' is-derby' : '') + '" href="' + DA.matchUrl(m.id) + '" data-match="' + m.id + '" style="--i:' + i + ';--ha:' + DA.clubColors(m.homeTeamName).a + ';--aa:' + DA.clubColors(m.awayTeamName).a + '">' +
            (derbyInfo ? '<span class="fx-row__derby" title="' + esc(derbyInfo.label) + '"><svg aria-hidden="true"><use href="#i-fire"/></svg>' + esc(derbyInfo.short) + '</span>' : '') +
            timeCell(m, res) +
            '<span class="fx-row__team fx-row__team--home' + (hw ? ' is-win' : aw ? ' is-lose' : '') + (focusTeam === m.homeTeamId ? ' is-focus' : '') + '"><span class="fx-row__name">' + esc(m.homeTeamName) + '</span>' + DA.crest(m.homeTeamName, m.homeTeamLogo, 'md') + '</span>' +
            score +
            '<span class="fx-row__team fx-row__team--away' + (aw ? ' is-win' : hw ? ' is-lose' : '') + (focusTeam === m.awayTeamId ? ' is-focus' : '') + '">' + DA.crest(m.awayTeamName, m.awayTeamLogo, 'md') + '<span class="fx-row__name">' + esc(m.awayTeamName) + '</span></span>' +
            meta +
            '<span class="fx-row__go" aria-hidden="true"><svg><use href="#i-chev-right"/></svg></span>' +
            '</a>';
    }

    /* ---------------------------------------------------------
       5. Hafta görünümü
       --------------------------------------------------------- */
    function dayKey(m) {
        var d = DA.toDate(m.matchDate);
        return d.getFullYear() + '-' + DA.pad(d.getMonth() + 1) + '-' + DA.pad(d.getDate());
    }

    function renderWeek() {
        var list = weekMatches(state.week);
        renderSummary(list);
        if (state.liveOnly) list = list.filter(L.isLive);
        if (!list.length) {
            els.days.innerHTML = '<div class="da-empty da-panel"><svg aria-hidden="true"><use href="#i-calendar"/></svg><strong>' +
                (state.liveOnly ? 'Şu an canlı maç yok' : 'Bu haftaya henüz maç eklenmedi') + '</strong></div>';
            return;
        }
        var groups = [];
        var map = {};
        list.forEach(function (m) {
            var k = dayKey(m);
            if (!map[k]) { map[k] = { key: k, date: DA.toDate(m.matchDate), list: [] }; groups.push(map[k]); }
            map[k].list.push(m);
        });
        var today = new Date();
        var idx = 0;
        els.days.innerHTML = groups.map(function (g) {
            var isToday = DA.sameDay(g.date, today);
            var liveN = g.list.filter(L.isLive).length;
            return '<section class="fx-day' + (isToday ? ' is-today' : '') + '">' +
                '<header class="fx-day__head">' +
                '<span class="fx-day__date"><b>' + g.date.getDate() + '</b><small>' + esc(DA.fmt.month.format(g.date).replace(/^\d+\s*/, '')) + '</small></span>' +
                '<h2 class="fx-day__title">' + esc(DA.fmt.weekday.format(g.date)) + (isToday ? ' <em>Bugün</em>' : '') + '</h2>' +
                '<span class="fx-day__count">' + g.list.length + ' maç' + (liveN ? ' · <b>' + liveN + ' canlı</b>' : '') + '</span>' +
                '</header>' +
                '<div class="fx-day__list">' + g.list.map(function (m) { return rowHtml(m, idx++, null); }).join('') + '</div>' +
                '</section>';
        }).join('');
        if (state.first) {
            els.days.classList.add('is-entering');
            window.setTimeout(function () { els.days.classList.remove('is-entering'); }, 1600);
        }
    }

    /* ---------------------------------------------------------
       6. Takım görünümü
       --------------------------------------------------------- */
    function renderTeam() {
        var id = state.team;
        var team = data.teams.filter(function (x) { return x.id === id; })[0];
        if (!team) { state.team = null; render(); return; }
        var list = L.teamMatches(data.matches, id);
        var row = L.table(data.teams, data.matches).filter(function (r) { return r.id === id; })[0];
        var colors = DA.clubColors(team.name);
        renderSummary(list);
        var played = list.filter(L.isFinished);
        var next = list.filter(function (m) { return m.status === L.PLANNED && t(m) >= Date.now(); })[0];

        var head = '<header class="fx-teamhead da-panel" style="--tc:' + colors.a + '">' +
            '<span class="fx-teamhead__crest">' + DA.crest(team.name, team.logoUrl, 'xl') + '</span>' +
            '<div class="fx-teamhead__text"><p class="da-kicker"><i></i><span>Takım fikstürü</span></p>' +
            '<h2>' + esc(team.name) + '</h2><p>' + esc((team.city || '') + (team.stadium ? ' · ' + team.stadium : '')) + '</p></div>' +
            '<dl class="fx-teamhead__stats">' +
            '<div><dt>Sıra</dt><dd>' + (row ? row.rank : '-') + '</dd></div>' +
            '<div><dt>Puan</dt><dd>' + (row ? row.points : 0) + '</dd></div>' +
            '<div><dt>G-B-M</dt><dd>' + (row ? row.won + '-' + row.drawn + '-' + row.lost : '0-0-0') + '</dd></div>' +
            '<div><dt>Kalan</dt><dd>' + list.filter(function (m) { return !L.isFinished(m); }).length + '</dd></div>' +
            '</dl>' +
            '<div class="fx-teamhead__actions"><a class="da-btn da-btn--small" href="' + DA.clubUrl(id) + '"><svg aria-hidden="true"><use href="#i-shield"/></svg>Kulüp sayfası</a>' +
            (next ? '<a class="da-btn da-btn--primary da-btn--small" href="' + DA.matchUrl(next.id) + '"><svg aria-hidden="true"><use href="#i-ball"/></svg>Sıradaki maç</a>' : '') +
            '<button type="button" class="da-btn da-btn--small" data-clear-team><svg aria-hidden="true"><use href="#i-x"/></svg>Haftaya dön</button></div>' +
            '</header>';

        var strip = played.length
            ? '<div class="fx-teamstrip" aria-label="Sonuç dizisi">' + played.map(function (m) {
                var r = L.outcomeFor(m, id);
                return '<a class="da-form__pill da-form__pill--' + r + '" href="' + DA.matchUrl(m.id) + '" title="' + esc(m.week + '. hafta: ' + m.homeTeamName + ' ' + m.homeScore + '-' + m.awayScore + ' ' + m.awayTeamName) + '">' + r + '</a>';
            }).join('') + '</div>'
            : '';

        var visible = state.liveOnly ? list.filter(L.isLive) : list;
        var idx = 0;
        var rows = visible.map(function (m) {
            return '<div class="fx-teamweek"><span class="fx-teamweek__no"><b>' + m.week + '</b><small>hafta</small></span>' +
                '<div class="fx-teamweek__row"><span class="fx-teamweek__date">' + esc(DA.fmt.day.format(DA.toDate(m.matchDate))) + '</span>' + rowHtml(m, idx++, id) + '</div></div>';
        }).join('');

        els.teamView.innerHTML = head + strip + '<div class="fx-teamlist">' + (rows || '<div class="da-empty"><strong>Maç yok</strong></div>') + '</div>';
        $('[data-clear-team]', els.teamView).addEventListener('click', function () {
            state.team = null;
            els.team.value = '';
            DA.setParams({ team: null, week: state.week });
            render();
        });
    }

    /* ---------------------------------------------------------
       7. Olaylar, canlı güncellemeler ve başlat
       --------------------------------------------------------- */
    function render() {
        renderBoard();
        renderRail();
        var teamMode = !!state.team;
        els.days.hidden = teamMode;
        els.teamView.hidden = !teamMode;
        if (teamMode) renderTeam(); else renderWeek();
        var all = data.matches.length;
        var weeksN = weeks().length;
        els.lead.textContent = teamMode
            ? 'Takımın bütün maçları hafta hafta. Sonuç dizisine tıklayınca o maçın merkezine gidersin.'
            : weeksN ? weeksN + ' haftada ' + all + ' maç planlandı. Haftalar arasında oklarla ya da klavyenin sol / sağ tuşlarıyla gezebilirsin.' : 'Fikstür henüz boş.';
        state.first = false;
    }

    els.team.addEventListener('change', function () {
        state.team = els.team.value ? Number(els.team.value) : null;
        DA.setParams({ team: state.team, week: state.team ? null : state.week });
        document.title = (state.team ? teamName(state.team) + ' fikstürü' : state.week + '. hafta fikstürü') + ' – Doksan Artı';
        render();
    });

    els.liveOnly.addEventListener('change', function () {
        state.liveOnly = els.liveOnly.checked;
        render();
    });

    DA.on('data', function (d) {
        var before = {};
        data.matches.forEach(function (m) { before[m.id] = m.status + ':' + m.homeScore + '-' + m.awayScore; });
        data = d;
        if (weeks().indexOf(state.week) < 0) state.week = L.activeWeek(data.matches);
        render();
        // Değişen satırlar kısa parlar
        data.matches.forEach(function (m) {
            if (before[m.id] !== undefined && before[m.id] !== m.status + ':' + m.homeScore + '-' + m.awayScore) {
                $$('[data-match="' + m.id + '"]').forEach(function (row) { DA.pulse(row, 'is-changed'); });
            }
        });
    });

    DA.on('goal', function (evt) {
        window.setTimeout(function () {
            $$('[data-match="' + evt.match.id + '"]').forEach(function (row) {
                DA.pulse(row, 'is-goal');
                var b = $('[data-side="' + evt.side + '"]', row);
                if (b) DA.pulse(b, 'is-turn');
            });
        }, 400);
    });

    DA.on('tick', function () {
        $$('.fx-row.is-live').forEach(function (row) {
            var m = data.matches.filter(function (x) { return String(x.id) === row.getAttribute('data-match'); })[0];
            if (!m) return;
            var c = DA.liveClock(m);
            var ring = $('.fx-mini-ring', row);
            if (ring) ring.style.setProperty('--p', (Math.min(90, c.minute) / 90 * 100).toFixed(1) + '%');
            var small = $('.fx-row__time small', row);
            if (small) small.textContent = c.label;
        });
    });

    if (state.team) DA.setParams({ team: state.team, week: null });
    render();
})();
