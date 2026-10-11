/* =================================================================
   Doksan Artı — kulüpler (clubs.js)
   Vitrin (/Clubs) ve kulüp sayfası (/Clubs/Detail/3) aynı dosyadadır.
   1  Ortak
   2  Vitrin: başlık rakamları, sıralama, arama, kartlar (FLIP)
   3  Kulüp sayfası: sahne, rakam kartları, sezon yolculuğu,
      sıradaki maç, iç saha / deplasman karnesi, bütün maçlar, diğer kulüpler
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
       1. Ortak
       --------------------------------------------------------- */
    var data = DA.getData();

    function formPoints(r) {
        return r.form.reduce(function (s, f) { return s + (f.r === 'G' ? 3 : f.r === 'B' ? 1 : 0); }, 0);
    }

    function pills(r, liveMatch) {
        var list = r.form.map(function (f) {
            var m = f.match;
            return '<i class="da-form__pill da-form__pill--' + f.r + '" title="' + esc(m.homeTeamName + ' ' + m.homeScore + '-' + m.awayScore + ' ' + m.awayTeamName) + '">' + f.r + '</i>';
        });
        while (list.length < 5) list.unshift('<i class="da-form__pill da-form__pill--none" aria-hidden="true"></i>');
        if (liveMatch) list.push('<i class="da-form__pill da-form__pill--live" title="Şu an sahada">C</i>');
        return '<span class="da-form">' + list.join('') + '</span>';
    }

    function liveFor(teamId) {
        return data.matches.filter(function (m) { return L.isLive(m) && (m.homeTeamId === teamId || m.awayTeamId === teamId); })[0] || null;
    }

    if (window.DA_CLUB) detailPage(window.DA_CLUB); else if ($('[data-grid]')) indexPage();

    /* ---------------------------------------------------------
       2. Vitrin
       --------------------------------------------------------- */
    function indexPage() {
        var els = { grid: $('[data-grid]'), search: $('[data-search]'), nomatch: $('[data-nomatch]'), stats: $('[data-headstats]') };
        var state = { sort: 'rank', query: '', first: true };

        function renderStats() {
            var cities = {}, stadiums = {};
            data.teams.forEach(function (t) { if (t.city) cities[t.city] = true; if (t.stadium) stadiums[t.stadium] = true; });
            var live = {};
            data.matches.filter(L.isLive).forEach(function (m) { live[m.homeTeamId] = true; live[m.awayTeamId] = true; });
            var items = [
                ['Kulüp', data.teams.length],
                ['Şehir', Object.keys(cities).length],
                ['Stadyum', Object.keys(stadiums).length],
                ['Şu an sahada', Object.keys(live).length]
            ];
            els.stats.innerHTML = items.map(function (x, i) {
                return '<div' + (i === 3 && x[1] ? ' class="is-live"' : '') + ' data-reveal style="--i:' + i + '"><dt>' + x[0] + '</dt><dd><span data-count="' + x[1] + '">' + x[1] + '</span></dd></div>';
            }).join('');
            $$('[data-count]', els.stats).forEach(C.countUp);
            DA.reveal(els.stats);
        }

        function sorted() {
            var rows = L.table(data.teams, data.matches, { includeLive: true });
            var base = L.table(data.teams, data.matches);
            var race = L.race(data.teams, data.matches);
            var teamIdx = L.teamIndex(data.teams);
            var list = rows.map(function (r) {
                return { r: r, team: teamIdx[r.id] || {}, form: formPoints(base.filter(function (b) { return b.id === r.id; })[0] || r), points: race.points[r.id] || [], live: liveFor(r.id) };
            });
            if (state.sort === 'form') list.sort(function (a, b) { return b.form - a.form || a.r.rank - b.r.rank; });
            else if (state.sort === 'goals') list.sort(function (a, b) { return b.r.gf - a.r.gf || a.r.rank - b.r.rank; });
            else if (state.sort === 'name') list.sort(function (a, b) { return a.r.name.localeCompare(b.r.name, 'tr-TR'); });
            return list;
        }

        function card(x, i, n) {
            var r = x.r;
            var z = L.zone(r.rank, n);
            var col = DA.clubColors(r.name);
            var live = x.live;
            var liveHtml = '';
            if (live) {
                var home = live.homeTeamId === r.id;
                liveHtml = '<span class="cl-card__live"><i class="da-pulse" aria-hidden="true"></i>' + esc((home ? 'vs ' : '@ ') + (home ? live.awayTeamName : live.homeTeamName)) +
                    ' <b>' + (home ? live.homeScore + '-' + live.awayScore : live.awayScore + '-' + live.homeScore) + '</b></span>';
            }
            var metric = state.sort === 'form' ? x.form + ' P · son 5' : state.sort === 'goals' ? r.gf + ' gol · ' + (r.played ? C.fmt(r.gf / r.played, 2) : '0') + '/maç' : '';
            return '<a class="cl-card da-tilt' + (z ? ' zone-' + z : '') + (live ? ' is-live' : '') + '" href="' + DA.clubUrl(r.id) + '" data-club="' + r.id + '" data-name="' + esc(DA.norm(r.name + ' ' + (x.team.city || '') + ' ' + (x.team.stadium || ''))) + '" ' +
                'style="--i:' + i + ';--tc:' + col.a + ';--tc2:' + col.b + '"' + (state.first ? ' data-reveal' : '') + '>' +
                '<span class="cl-card__glow" aria-hidden="true"></span>' +
                '<span class="cl-card__top"><span class="cl-card__rank">' + r.rank + '<small>.</small></span>' + (z ? '<span class="cl-card__zone">' + L.ZONES[z] + '</span>' : '') + '</span>' +
                '<span class="cl-card__crest">' + DA.crest(r.name, r.logoUrl, 'xl') + '</span>' +
                '<strong class="cl-card__name">' + esc(r.name) + '</strong>' +
                '<span class="cl-card__city">' + esc((x.team.city || '') + (x.team.stadium ? ' · ' + x.team.stadium : '')) + '</span>' +
                (liveHtml || (metric ? '<span class="cl-card__metric">' + esc(metric) + '</span>' : '')) +
                '<span class="cl-card__stats"><span><b>' + r.points + '</b><small>Puan</small></span><span><b>' + (r.gd > 0 ? '+' : '') + r.gd + '</b><small>Averaj</small></span><span><b>' + r.won + '-' + r.drawn + '-' + r.lost + '</b><small>G-B-M</small></span></span>' +
                '<span class="cl-card__foot">' + pills(r, live) + '<span class="cl-card__spark" data-spark="' + r.id + '"></span></span>' +
                '<span class="da-shine" aria-hidden="true"></span>' +
                '</a>';
        }

        function render() {
            var list = sorted();
            var n = list.length;
            var draw = function () {
                els.grid.innerHTML = list.map(function (x, i) { return card(x, i, n); }).join('');
                list.forEach(function (x) {
                    var el = $('[data-spark="' + x.r.id + '"]', els.grid);
                    if (el && x.points.length > 1) C.spark(el, x.points, { color: DA.clubColors(x.r.name).a });
                });
            };
            if (state.first) draw(); else DA.flip(els.grid, '[data-club]', 'data-club', draw);
            $$('.cl-card', els.grid).forEach(function (el) { DA.tilt(el, 8); });
            applySearch();
            if (state.first) DA.reveal(els.grid);
            state.first = false;
        }

        function applySearch() {
            var q = DA.norm(state.query);
            var visible = 0;
            $$('[data-club]', els.grid).forEach(function (el) {
                var ok = !q || el.getAttribute('data-name').indexOf(q) >= 0;
                el.hidden = !ok;
                if (ok) visible++;
            });
            els.nomatch.hidden = visible > 0;
        }

        $$('[data-sort]').forEach(function (b) {
            b.addEventListener('click', function () {
                state.sort = b.getAttribute('data-sort');
                $$('[data-sort]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
                render();
            });
        });
        els.search.addEventListener('input', function () { state.query = els.search.value; applySearch(); });

        DA.on('data', function (d) { data = d; renderStats(); render(); });
        renderStats();
        render();
    }

    /* ---------------------------------------------------------
       3. Kulüp sayfası
       --------------------------------------------------------- */
    function detailPage(teamId) {
        var els = {
            hero: $('[data-hero]'),
            mark: $('[data-mark]'),
            crest: $('[data-crest]'),
            kicker: $('[data-hero-kicker]'),
            chips: $('[data-chips]'),
            rank: $('[data-rank]'),
            kpis: $('[data-kpis]'),
            journey: $('[data-journey-chart]'),
            journeySub: $('[data-journey-sub]'),
            next: $('[data-next]'),
            split: $('[data-split-panel]'),
            results: $('[data-results]'),
            pager: $('[data-pager]')
        };
        var state = { journey: 'rank', finishedKey: '', countdown: null, first: true };

        function team() { return data.teams.filter(function (x) { return x.id === teamId; })[0] || null; }
        var t = team();
        if (!t) return;
        var col = DA.clubColors(t.name);
        els.hero.style.setProperty('--tc', col.a);
        els.hero.style.setProperty('--tc2', col.b);

        function rows() { return L.table(data.teams, data.matches); }
        function me(list) { return list.filter(function (r) { return r.id === teamId; })[0]; }

        function renderHero() {
            var list = rows();
            var r = me(list);
            var n = list.length;
            var z = L.zone(r.rank, n);
            var live = liveFor(teamId);
            els.mark.innerHTML = DA.crest(t.name, t.logoUrl, 'xxl');
            els.crest.innerHTML = '<span class="cl-hero__crestwrap">' + DA.crest(t.name, t.logoUrl, 'xxl') + '</span>';
            if (state.first) DA.tilt($('.cl-hero__crestwrap', els.crest), 16);
            els.kicker.classList.toggle('is-live', !!live);
            $('span', els.kicker).textContent = live ? 'Şu an sahada' : 'Serie A 2026/27';

            var chips = [
                '<span class="cl-chip">' + r.played + ' maç</span>',
                '<span class="cl-chip">' + r.won + 'G · ' + r.drawn + 'B · ' + r.lost + 'M</span>',
                '<span class="cl-chip">' + r.gf + '-' + r.ga + ' gol</span>',
                pills(r, live)
            ];
            if (live) {
                chips.unshift('<a class="cl-chip cl-chip--live" href="' + DA.matchUrl(live.id) + '"><i class="da-pulse" aria-hidden="true"></i>' +
                    esc(live.homeTeamName) + ' <b>' + live.homeScore + '-' + live.awayScore + '</b> ' + esc(live.awayTeamName) + ' · <span data-live-text="' + live.id + '">' + esc(DA.liveClock(live).text) + '</span></a>');
            }
            els.chips.innerHTML = chips.join('');

            els.rank.innerHTML =
                '<span class="cl-rank__label">Sıra</span>' +
                '<span class="da-board da-board--xl cl-rank__board"><span class="da-led da-led--xl" data-rank-led></span></span>' +
                '<span class="cl-rank__zone' + (z ? ' zone-' + z : '') + '">' + (z ? L.ZONES[z] : r.points + ' puan') + '</span>';
            var text = String(r.rank);
            var board = DA.led($('[data-rank-led]', els.rank), text.replace(/./g, ' '), r.rank === 1 ? 'amber' : 'green', false);
            window.setTimeout(function () { if (board) board.setText(text, DA.reduceMotion ? null : { stagger: 320 }); }, state.first ? 500 : 0);
        }

        function leagueRank(list, key, lowerBetter) {
            var played = list.filter(function (r) { return r.played > 0; });
            var sortedL = played.slice().sort(function (a, b) { return lowerBetter ? a[key] - b[key] : b[key] - a[key]; });
            var mine = me(list);
            var pos = 1;
            for (var i = 0; i < sortedL.length; i++) {
                if ((lowerBetter ? sortedL[i][key] < mine[key] : sortedL[i][key] > mine[key])) pos++;
            }
            return pos;
        }

        function renderKpis() {
            var list = rows();
            var r = me(list);
            var tiles = [
                { label: 'Puan', value: r.points, dec: 0, rank: leagueRank(list, 'points'), icon: 'i-trophy' },
                { label: 'Galibiyet', value: r.won, dec: 0, rank: leagueRank(list, 'won'), icon: 'i-fire' },
                { label: 'Attığı gol', value: r.gf, dec: 0, rank: leagueRank(list, 'gf'), icon: 'i-ball' },
                { label: 'Yediği gol', value: r.ga, dec: 0, rank: leagueRank(list, 'ga', true), icon: 'i-shield' },
                { label: 'Gol yemeden', value: r.cleanSheets, dec: 0, rank: leagueRank(list, 'cleanSheets'), icon: 'i-lock' },
                { label: 'Puan / maç', value: r.ppg, dec: 2, rank: leagueRank(list, 'ppg'), icon: 'i-chart' }
            ];
            els.kpis.innerHTML = tiles.map(function (x, i) {
                var top = x.rank <= 3 && r.played > 0;
                return '<article class="cl-kpi' + (top ? ' is-top' : '') + '" data-reveal style="--i:' + i + '">' +
                    '<span class="cl-kpi__icon"><svg aria-hidden="true"><use href="#' + x.icon + '"/></svg></span>' +
                    '<span class="cl-kpi__label">' + x.label + '</span>' +
                    '<strong class="cl-kpi__value" data-count="' + (Math.round(x.value * 100) / 100) + '" data-count-decimals="' + x.dec + '">' + C.fmt(x.value, x.dec) + '</strong>' +
                    '<span class="cl-kpi__rank">' + (r.played ? 'Ligde ' + x.rank + '.' : 'Henüz maç yok') + '</span>' +
                    '</article>';
            }).join('');
            $$('[data-count]', els.kpis).forEach(C.countUp);
            DA.reveal(els.kpis);
        }

        function renderJourney() {
            var race = L.race(data.teams, data.matches);
            var fresh = els.journey.cloneNode(false);
            els.journey.parentNode.replaceChild(fresh, els.journey);
            els.journey = fresh;
            var n = data.teams.length;
            if (state.journey === 'goals') {
                var done = L.teamMatches(data.matches, teamId).filter(L.isFinished);
                if (!done.length) { els.journey.innerHTML = '<p class="tm-chart__empty">İlk maç oynanınca çizilir.</p>'; return; }
                var gf = 0, ga = 0, f = [], a = [];
                done.forEach(function (m) {
                    var home = m.homeTeamId === teamId;
                    gf += home ? m.homeScore : m.awayScore;
                    ga += home ? m.awayScore : m.homeScore;
                    f.push(gf);
                    a.push(ga);
                });
                els.journeySub.textContent = 'Maç maç toplam attığı ve yediği gol';
                C.line(els.journey, {
                    height: 290,
                    labels: done.map(function (m) { return m.week; }),
                    series: [{ name: 'Attığı', color: '#3BD49A', values: f }, { name: 'Yediği', color: '#FF6B81', values: a }],
                    area: true,
                    labelWidth: 96,
                    xLabel: function (w) { return w + '. hf'; },
                    tooltipTitle: function (i) {
                        var m = done[i];
                        return m.week + '. hafta: ' + m.homeTeamName + ' ' + m.homeScore + '-' + m.awayScore + ' ' + m.awayTeamName;
                    },
                    valueText: function (v) { return v + ' gol'; }
                });
                return;
            }
            if (race.weeks.length < 1) { els.journey.innerHTML = '<p class="tm-chart__empty">İlk hafta tamamlanınca sezon yolculuğu çizilir.</p>'; return; }
            var rank = state.journey === 'rank';
            els.journeySub.textContent = rank ? 'Hafta sonundaki sıra (1 en üstte)' : 'Hafta sonundaki toplam puan, lider ile birlikte';
            var leaderId = rows()[0].id;
            var series = [{ id: teamId, name: t.name, color: '#5B9BFF', values: (rank ? race.ranks : race.points)[teamId] || [] }];
            if (!rank && leaderId !== teamId) {
                var leader = data.teams.filter(function (x) { return x.id === leaderId; })[0];
                series.push({ id: leaderId, name: (leader ? leader.name : 'Lider') + ' (lider)', short: 'Lider', color: '#c98500', values: race.points[leaderId] || [] });
            }
            var opts = {
                height: 290,
                labels: race.weeks,
                series: series,
                area: true,
                labelWidth: 100,
                xLabel: function (w) { return w + '. hf'; },
                tooltipTitle: function (i) { return race.weeks[i] + '. hafta sonu'; },
                valueText: function (v) { return rank ? v + '. sıra' : v + ' P'; }
            };
            if (rank) {
                opts.invert = true;
                opts.yMin = 1;
                opts.yMax = n;
                opts.yTicks = [1, 4, 7, Math.max(8, n - 3), n].filter(function (v, i, arr) { return v <= n && arr.indexOf(v) === i; });
                opts.area = false;
            }
            C.line(els.journey, opts);
        }

        $$('[data-journey]').forEach(function (b) {
            b.addEventListener('click', function () {
                state.journey = b.getAttribute('data-journey');
                $$('[data-journey]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
                renderJourney();
            });
        });

        function renderNext() {
            if (state.countdown) { state.countdown.stop(); state.countdown = null; }
            var mine = L.teamMatches(data.matches, teamId);
            var live = mine.filter(L.isLive)[0];
            var next = mine.filter(function (m) { return m.status === L.PLANNED && DA.toDate(m.matchDate).getTime() >= Date.now(); })[0];
            var m = live || next;
            if (!m) {
                els.next.innerHTML = '<header class="da-panel__head"><div><h2 class="da-panel__title">Sıradaki maç</h2></div></header><div class="da-empty"><svg aria-hidden="true"><use href="#i-calendar"/></svg><strong>Takvimde maç yok</strong><p>Yeni maçlar eklenince geri sayım burada başlar.</p></div>';
                return;
            }
            var home = m.homeTeamId === teamId;
            var opp = home ? m.awayTeamName : m.homeTeamName;
            var oppLogo = home ? m.awayTeamLogo : m.homeTeamLogo;
            var oppId = home ? m.awayTeamId : m.homeTeamId;
            var p = DA.predict(m, { live: !!live });
            var mineP = home ? p.home : p.away;
            var html = '<header class="da-panel__head"><div><h2 class="da-panel__title">' + (live ? 'Şu an sahada' : 'Sıradaki maç') + '</h2>' +
                '<p class="da-panel__sub">' + m.week + '. hafta · ' + (home ? 'İç saha' : 'Deplasman') + ' · ' + esc(m.stadium || '') + '</p></div>' +
                (live ? '<span class="da-state da-state--live"><i class="da-pulse" aria-hidden="true"></i><span data-live-text="' + m.id + '">' + esc(DA.liveClock(m).text) + '</span></span>' : '') + '</header>' +
                '<div class="cl-next__match">' +
                '<span class="cl-next__team">' + DA.crest(t.name, t.logoUrl, 'lg') + '<strong>' + esc(t.name) + '</strong></span>' +
                (live
                    ? '<span class="cl-next__score">' + (home ? m.homeScore + '-' + m.awayScore : m.awayScore + '-' + m.homeScore) + '</span>'
                    : '<span class="cl-next__vs">' + (home ? 'vs' : '@') + '</span>') +
                '<a class="cl-next__team" href="' + DA.clubUrl(oppId) + '">' + DA.crest(opp, oppLogo, 'lg') + '<strong>' + esc(opp) + '</strong></a>' +
                '</div>';
            if (!live) {
                html += '<div class="cl-next__count" data-countdown>' +
                    ['d', 'h', 'm'].map(function (k) {
                        return '<div><span class="da-board da-board--plain"><span class="da-led da-led--sm" data-cd="' + k + '"></span></span><small>' + { d: 'gün', h: 'saat', m: 'dakika' }[k] + '</small></div>';
                    }).join('') + '</div>' +
                    '<p class="cl-next__when">' + esc(DA.fmt.dayLong.format(DA.toDate(m.matchDate))) + ' · ' + esc(DA.fmt.time.format(DA.toDate(m.matchDate))) + '</p>';
            }
            html += '<div class="cl-next__prob"><span>' + (live ? 'Canlı kazanma ihtimali' : 'Kazanma ihtimali') + '</span><b>%' + Math.round(mineP * 100) + '</b>' +
                '<span class="cl-next__bar"><i style="--w:' + Math.round(mineP * 100) + '%"></i></span></div>' +
                '<a class="da-btn ' + (live ? 'da-btn--live' : 'da-btn--primary') + ' da-btn--small cl-next__go" href="' + DA.matchUrl(m.id) + '"><svg aria-hidden="true"><use href="#i-' + (live ? 'live' : 'ball') + '"/></svg>Maç merkezi</a>';
            els.next.innerHTML = html;
            if (!live) state.countdown = DA.countdown($('[data-countdown]', els.next), m.matchDate, function () { DA.loadData(); });
        }

        function renderSplit() {
            var home = me(L.table(data.teams, data.matches, { venue: 'home' }));
            var away = me(L.table(data.teams, data.matches, { venue: 'away' }));
            function col(label, r, icon) {
                var total = Math.max(1, r.won + r.drawn + r.lost);
                return '<div class="cl-venue">' +
                    '<p class="cl-venue__label"><svg aria-hidden="true"><use href="#' + icon + '"/></svg>' + label + '</p>' +
                    '<p class="cl-venue__pts"><b>' + r.points + '</b> puan · ' + r.played + ' maç</p>' +
                    '<div class="cl-venue__wdl"><span class="is-g" style="--w:' + (r.won / total * 100) + '%"></span><span class="is-b" style="--w:' + (r.drawn / total * 100) + '%"></span><span class="is-m" style="--w:' + (r.lost / total * 100) + '%"></span></div>' +
                    '<dl class="cl-venue__grid">' +
                    '<div><dt>G</dt><dd>' + r.won + '</dd></div><div><dt>B</dt><dd>' + r.drawn + '</dd></div><div><dt>M</dt><dd>' + r.lost + '</dd></div>' +
                    '<div><dt>Gol</dt><dd>' + r.gf + '-' + r.ga + '</dd></div><div><dt>Sıra</dt><dd>' + r.rank + '.</dd></div><div><dt>P/maç</dt><dd>' + C.fmt(r.ppg, 2) + '</dd></div>' +
                    '</dl></div>';
            }
            els.split.innerHTML = '<header class="da-panel__head"><div><h2 class="da-panel__title" id="clSplitTitle">İç saha, deplasman</h2>' +
                '<p class="da-panel__sub">Sıra, yalnızca o sahadaki maçlarla kurulan tabloya göre</p></div></header>' +
                '<div class="cl-venues">' + col('İç saha', home, 'i-home') + col('Deplasman', away, 'i-arrow') + '</div>';
        }

        function renderResults() {
            var list = L.teamMatches(data.matches, teamId);
            els.results.innerHTML = '<header class="da-panel__head"><div><h2 class="da-panel__title" id="clResultsTitle">Bütün maçlar</h2>' +
                '<p class="da-panel__sub">' + list.length + ' maç · sonuçlar ve sıradakiler</p></div>' +
                '<a class="da-link" href="/Fixtures?team=' + teamId + '">Fikstürde aç<svg aria-hidden="true"><use href="#i-arrow"/></svg></a></header>' +
                '<ol class="cl-results__list">' + list.map(function (m, i) {
                    var home = m.homeTeamId === teamId;
                    var opp = home ? m.awayTeamName : m.homeTeamName;
                    var oppLogo = home ? m.awayTeamLogo : m.homeTeamLogo;
                    var badge;
                    if (L.isFinished(m)) { var r = L.outcomeFor(m, teamId); badge = '<i class="da-form__pill da-form__pill--' + r + '">' + r + '</i>'; }
                    else if (L.isLive(m)) badge = '<i class="da-form__pill da-form__pill--live">C</i>';
                    else badge = '<i class="da-form__pill da-form__pill--none" aria-hidden="true"></i>';
                    var score = (L.isFinished(m) || L.isLive(m)) && DA.hasScore(m) ? '<b>' + m.homeScore + '-' + m.awayScore + '</b>' : '<span class="cl-results__time">' + esc(m.status === L.POSTPONED ? 'Ert.' : DA.fmt.short.format(DA.toDate(m.matchDate))) + '</span>';
                    return '<li style="--i:' + i + '"><a href="' + DA.matchUrl(m.id) + '" class="' + (L.isLive(m) ? 'is-live' : '') + '">' +
                        '<span class="cl-results__wk">' + m.week + '</span>' + badge +
                        '<span class="cl-results__opp">' + DA.crest(opp, oppLogo, 'xs') + '<span>' + (home ? 'vs ' : '@ ') + esc(opp) + '</span></span>' +
                        score + '</a></li>';
                }).join('') + '</ol>';
        }

        function renderPager() {
            var list = rows();
            var i = list.map(function (r) { return r.id; }).indexOf(teamId);
            var prev = list[i - 1], next = list[i + 1];
            function link(r, dir) {
                if (!r) return '<span></span>';
                return '<a class="cl-pager__link cl-pager__link--' + dir + '" href="' + DA.clubUrl(r.id) + '">' +
                    (dir === 'prev' ? '<svg aria-hidden="true"><use href="#i-chev-left"/></svg>' : '') +
                    '<span><small>' + (dir === 'prev' ? 'Üstündeki' : 'Altındaki') + ' · ' + r.rank + '.</small><strong>' + esc(r.name) + '</strong></span>' + DA.crest(r.name, r.logoUrl, 'md') +
                    (dir === 'next' ? '<svg aria-hidden="true"><use href="#i-chev-right"/></svg>' : '') + '</a>';
            }
            els.pager.innerHTML = link(prev, 'prev') + '<a class="da-btn da-btn--small" href="/Clubs"><svg aria-hidden="true"><use href="#i-shield"/></svg>Bütün kulüpler</a>' + link(next, 'next');
        }

        function renderAll() {
            renderHero();
            renderNext();
            var fk = DA.finishedKey();
            if (fk !== state.finishedKey) {
                state.finishedKey = fk;
                renderKpis();
                renderJourney();
                renderSplit();
                renderPager();
            }
            renderResults();
            state.first = false;
        }

        DA.on('data', function (d) {
            data = d;
            t = team() || t;
            renderAll();
        });

        renderAll();
    }
})();
