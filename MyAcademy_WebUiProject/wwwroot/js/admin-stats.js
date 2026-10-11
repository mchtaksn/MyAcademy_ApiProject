/* =================================================================
   Doksan Artı — Teknik Masa istatistikler (admin-stats.js)
   1  Sezon özeti kutuları
   2  Haftalara göre sonuçlar + maç başına gol
   3  Skor haritası, rekorlar ve seriler
   4  Takım sıralamaları (sekmeli)
   5  Kafa kafaya karşılaştırma
   ================================================================= */
(function () {
    'use strict';

    var TM = window.TM;
    if (!TM || !TM.league || !TM.charts) return;

    var L = TM.league;
    var C = TM.charts;
    var $ = TM.$;
    var $$ = TM.$$;

    var data = TM.getData() || { teams: [], matches: [] };
    var teams = data.teams;
    var matches = data.matches;
    var out = L.outcomes(matches);
    var table = L.table(teams, matches);
    var weekly = L.weekly(matches).filter(function (w) { return w.finished > 0; });

    function pct(n, total) { return total ? Math.round((n / total) * 100) : 0; }

    /* ---------------------------------------------------------
       1. Sezon özeti
       --------------------------------------------------------- */
    var kpis = [
        { icon: 'tm-i-ball', tone: 'blue', label: 'Toplam gol', value: out.goals, sub: out.total + ' maçta' },
        { icon: 'tm-i-target', tone: 'green', label: 'Maç başına gol', value: out.avg, decimals: 2, sub: 'Ev ' + C.fmt(out.total ? out.homeGoals / out.total : 0, 2) + ' · Dep ' + C.fmt(out.total ? out.awayGoals / out.total : 0, 2) },
        { icon: 'tm-i-home', tone: 'violet', label: 'Ev sahibi kazandı', value: pct(out.home, out.total), suffix: '%', sub: out.home + ' maç' },
        { icon: 'tm-i-swap', tone: 'grey', label: 'Berabere bitti', value: pct(out.draw, out.total), suffix: '%', sub: out.draw + ' maç' },
        { icon: 'tm-i-fire', tone: 'amber', label: 'Karşılıklı gol', value: pct(out.bothScored, out.total), suffix: '%', sub: out.bothScored + ' maçta iki takım da attı' },
        { icon: 'tm-i-shieldcheck', tone: 'teal', label: 'Gol yemeden', value: out.cleanSheets, sub: 'kez kalesini gole kapattı' }
    ];
    $('[data-stat-kpis]').innerHTML = kpis.map(function (k, i) {
        return '<article class="tm-statkpi tm-statkpi--' + k.tone + '" style="--i:' + i + '">' +
            '<span class="tm-statkpi__icon"><svg class="tm-icon" aria-hidden="true"><use href="#' + k.icon + '"/></svg></span>' +
            '<span class="tm-statkpi__label">' + k.label + '</span>' +
            '<strong class="tm-statkpi__value"><span data-count="' + k.value + '"' + (k.decimals ? ' data-count-decimals="' + k.decimals + '"' : '') + '>' + C.fmt(k.value, k.decimals) + '</span>' + (k.suffix ? '<small>' + k.suffix + '</small>' : '') + '</strong>' +
            '<span class="tm-statkpi__sub">' + TM.esc(k.sub) + '</span>' +
            '</article>';
    }).join('');
    C.initCounters($('[data-stat-kpis]'));

    /* ---------------------------------------------------------
       2. Grafikler
       --------------------------------------------------------- */
    var resultsEl = $('[data-chart-results]');
    var avgEl = $('[data-chart-avg]');
    if (!weekly.length) {
        resultsEl.innerHTML = avgEl.innerHTML = '<p class="tm-chart__empty">Henüz biten maç yok.</p>';
    } else {
        C.bars(resultsEl, {
            height: 240,
            labels: weekly.map(function (w) { return w.week; }),
            series: [
                { name: 'Ev sahibi', color: C.home, values: weekly.map(function (w) { return w.homeWins; }) },
                { name: 'Beraberlik', color: '#7d8cab', values: weekly.map(function (w) { return w.draws; }) },
                { name: 'Deplasman', color: C.away, values: weekly.map(function (w) { return w.awayWins; }) }
            ],
            xLabel: function (l) { return l + '.'; },
            tooltip: function (i) {
                var w = weekly[i];
                return '<strong class="tm-tip__title">' + w.week + '. hafta</strong>' +
                    '<span class="tm-tip__row"><i style="background:' + C.home + '"></i>Ev sahibi kazandı<b>' + w.homeWins + '</b></span>' +
                    '<span class="tm-tip__row"><i style="background:#7d8cab"></i>Berabere<b>' + w.draws + '</b></span>' +
                    '<span class="tm-tip__row"><i style="background:' + C.away + '"></i>Deplasman kazandı<b>' + w.awayWins + '</b></span>';
            },
            onClick: function (i) { TM.go('/Admin/Matches?week=' + weekly[i].week); }
        });

        C.line(avgEl, {
            height: 240,
            labels: weekly.map(function (w) { return w.week; }),
            series: [{ name: 'Maç başına gol', short: 'Ortalama', color: '#3BFF8F', values: weekly.map(function (w) { return Math.round(w.avg * 100) / 100; }) }],
            area: true,
            labelWidth: 86,
            xLabel: function (w) { return w + '.'; },
            tooltipTitle: function (i) { return weekly[i].week + '. hafta'; },
            valueText: function (v) { return C.fmt(v, 2); }
        });
    }

    /* ---------------------------------------------------------
       3. Skor haritası ve rekorlar
       --------------------------------------------------------- */
    var heatEl = $('[data-chart-heat]');
    if (out.total) C.heat(heatEl, L.scorelines(matches, 4));
    else heatEl.innerHTML = '<p class="tm-chart__empty">Henüz biten maç yok.</p>';

    var rec = L.records(teams, matches);
    var recCards = [];
    function scoreLine(m) {
        return '<span class="tm-rec__match">' + TM.crest(m.homeTeamName, m.homeTeamLogo, 'xs') + TM.esc(m.homeTeamName) +
            '<b>' + m.homeScore + '-' + m.awayScore + '</b>' + TM.esc(m.awayTeamName) + TM.crest(m.awayTeamName, m.awayTeamLogo, 'xs') + '</span>';
    }
    if (rec.biggestWin) recCards.push({ tone: 'blue', icon: 'tm-i-bolt', title: 'En farklı skor', big: rec.biggestWin.margin + ' fark', body: scoreLine(rec.biggestWin.match), href: '/Admin/Matches?edit=' + rec.biggestWin.match.id });
    if (rec.highestScoring) recCards.push({ tone: 'amber', icon: 'tm-i-fire', title: 'En gollü maç', big: rec.highestScoring.total + ' gol', body: scoreLine(rec.highestScoring.match), href: '/Admin/Matches?edit=' + rec.highestScoring.match.id });
    if (rec.biggestAwayWin) recCards.push({ tone: 'orange', icon: 'tm-i-flag', title: 'En farklı deplasman galibiyeti', big: rec.biggestAwayWin.margin + ' fark', body: scoreLine(rec.biggestAwayWin.match), href: '/Admin/Matches?edit=' + rec.biggestAwayWin.match.id });
    if (rec.winning) recCards.push({ tone: 'green', icon: 'tm-i-trophy', title: 'Galibiyet serisi', big: rec.winning.wins + ' maç', body: teamLine(rec.winning.team, 'üst üste kazanıyor') });
    if (rec.unbeaten) recCards.push({ tone: 'teal', icon: 'tm-i-shieldcheck', title: 'Yenilmezlik serisi', big: rec.unbeaten.unbeaten + ' maç', body: teamLine(rec.unbeaten.team, 'yenilmiyor') });
    if (rec.winless) recCards.push({ tone: 'red', icon: 'tm-i-alert', title: 'Galibiyet hasreti', big: rec.winless.winless + ' maç', body: teamLine(rec.winless.team, 'kazanamıyor') });

    function teamLine(t, text) {
        return '<span class="tm-rec__team">' + TM.crest(t.name, t.logoUrl, 'sm') + '<strong>' + TM.esc(t.name) + '</strong><small>' + text + '</small></span>';
    }

    $('[data-records]').innerHTML = recCards.length
        ? recCards.map(function (r, i) {
            var tag = r.href ? 'a' : 'div';
            return '<' + tag + ' class="tm-rec tm-rec--' + r.tone + '" style="--i:' + i + '"' + (r.href ? ' href="' + r.href + '"' : '') + '>' +
                '<span class="tm-rec__icon"><svg class="tm-icon" aria-hidden="true"><use href="#' + r.icon + '"/></svg></span>' +
                '<span class="tm-rec__title">' + r.title + '</span>' +
                '<strong class="tm-rec__big">' + r.big + '</strong>' + r.body + '</' + tag + '>';
        }).join('')
        : '<p class="tm-chart__empty">İlk maçlar bitince rekorlar burada.</p>';

    /* ---------------------------------------------------------
       4. Takım sıralamaları
       --------------------------------------------------------- */
    var homeTable = L.table(teams, matches, { venue: 'home' });
    var awayTable = L.table(teams, matches, { venue: 'away' });
    var played = function (r) { return r.played > 0; };

    var BOARDS = {
        attack: {
            sub: 'En çok gol atan takımlar',
            rows: function () {
                return table.filter(played).sort(function (a, b) { return b.gf - a.gf || a.played - b.played; }).slice(0, 10).map(function (r) {
                    return { r: r, value: r.gf, display: r.gf, sub: C.fmt(r.gf / r.played, 2) + ' gol/maç', color: '#3987e5' };
                });
            }
        },
        defense: {
            sub: 'En az gol yiyen takımlar (çubuk, maç başına yenen golün tersi)',
            rows: function () {
                var list = table.filter(played).sort(function (a, b) { return a.ga / a.played - b.ga / b.played || a.ga - b.ga; }).slice(0, 10);
                var worst = Math.max.apply(null, table.filter(played).map(function (r) { return r.ga / r.played; }).concat([1]));
                return list.map(function (r) {
                    return { r: r, value: worst - r.ga / r.played + 0.15, display: r.ga, sub: C.fmt(r.ga / r.played, 2) + ' yenen/maç', color: '#199e70' };
                });
            }
        },
        home: {
            sub: 'İç sahada maç başına puan',
            rows: function () {
                return homeTable.filter(played).sort(function (a, b) { return b.ppg - a.ppg || b.points - a.points; }).slice(0, 10).map(function (r) {
                    return { r: r, value: r.ppg, display: C.fmt(r.ppg, 2), sub: r.won + 'G ' + r.drawn + 'B ' + r.lost + 'M · ' + r.points + ' P', color: '#9085e9' };
                });
            },
            max: 3
        },
        away: {
            sub: 'Deplasmanda maç başına puan',
            rows: function () {
                return awayTable.filter(played).sort(function (a, b) { return b.ppg - a.ppg || b.points - a.points; }).slice(0, 10).map(function (r) {
                    return { r: r, value: r.ppg, display: C.fmt(r.ppg, 2), sub: r.won + 'G ' + r.drawn + 'B ' + r.lost + 'M · ' + r.points + ' P', color: '#d95926' };
                });
            },
            max: 3
        },
        gd: {
            sub: 'Bütün takımların gol farkı',
            rows: function () {
                return table.filter(played).sort(function (a, b) { return b.gd - a.gd; }).map(function (r) {
                    return { r: r, value: r.gd, display: (r.gd > 0 ? '+' : '') + r.gd, sub: r.gf + ' attı · ' + r.ga + ' yedi', color: r.gd >= 0 ? '#3987e5' : '#d95926' };
                });
            },
            diverging: true
        },
        clean: {
            sub: 'Kalesini gole kapattığı maç sayısı',
            rows: function () {
                return table.filter(played).sort(function (a, b) { return b.cleanSheets - a.cleanSheets || a.ga - b.ga; }).slice(0, 10).map(function (r) {
                    return { r: r, value: r.cleanSheets, display: r.cleanSheets, sub: r.played + ' maçta', color: '#2FD3C3' };
                });
            }
        }
    };

    var boardList = $('[data-board-list]');
    function renderBoard(name) {
        var b = BOARDS[name];
        $('[data-board-sub]').textContent = b.sub;
        var rows = b.rows();
        if (!rows.length) { boardList.innerHTML = '<p class="tm-chart__empty">Henüz biten maç yok.</p>'; return; }
        if (b.diverging) { renderDiverging(rows); return; }
        C.hbars(boardList, rows.map(function (x) {
            return { label: x.r.name, sub: x.sub, value: x.value, display: x.display, crest: TM.crest(x.r.name, x.r.logoUrl, 'sm'), color: x.color };
        }), { max: b.max });
    }

    // Averaj: sıfır çizgisinin iki yanına uzanan çubuklar
    function renderDiverging(rows) {
        var max = Math.max.apply(null, rows.map(function (x) { return Math.abs(x.value); }).concat([1]));
        boardList.innerHTML = '<ol class="tm-div">' + rows.map(function (x, i) {
            var w = (Math.abs(x.value) / max) * 50;
            return '<li class="tm-div__row' + (x.value < 0 ? ' is-neg' : '') + '" style="--i:' + i + '">' +
                '<span class="tm-div__team">' + TM.crest(x.r.name, x.r.logoUrl, 'xs') + '<span>' + TM.esc(x.r.name) + '</span></span>' +
                '<span class="tm-div__track"><span class="tm-div__bar" style="--w:' + w.toFixed(1) + '%;--c:' + x.color + '"></span></span>' +
                '<span class="tm-div__val">' + x.display + '</span></li>';
        }).join('') + '</ol>';
        var list = boardList.querySelector('.tm-div');
        C.whenVisible(list, function () { window.requestAnimationFrame(function () { list.classList.add('is-in'); }); });
    }

    $$('[data-board]').forEach(function (b) {
        b.addEventListener('click', function () {
            $$('[data-board]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
            renderBoard(b.getAttribute('data-board'));
        });
    });
    renderBoard('attack');

    /* ---------------------------------------------------------
       5. Kafa kafaya
       --------------------------------------------------------- */
    var selA = $('[data-vs="a"]');
    var selB = $('[data-vs="b"]');
    if (table.length > 1) {
        selA.value = table[0].id;
        selB.value = table[1].id;
    }
    var vsBody = $('[data-vs-body]');

    function renderVersus() {
        var a = Number(selA.value), b = Number(selB.value);
        if (!a || !b) return;
        if (a === b) {
            vsBody.innerHTML = '<p class="tm-chart__empty">İki farklı takım seç.</p>';
            return;
        }
        var c = L.compare(teams, matches, a, b);
        var A = c.a, B = c.b;
        var rows = [
            ['Puan', A.points, B.points],
            ['Sıra', A.rank, B.rank, true, false, true],
            ['Galibiyet', A.won, B.won],
            ['Beraberlik', A.drawn, B.drawn, null, true],
            ['Mağlubiyet', A.lost, B.lost, true],
            ['Attığı gol', A.gf, B.gf],
            ['Yediği gol', A.ga, B.ga, true],
            ['Gol yemediği maç', A.cleanSheets, B.cleanSheets],
            ['İç saha puanı', c.aHome.points, c.bHome.points],
            ['Deplasman puanı', c.aAway.points, c.bAway.points],
            ['Maç başına puan', +A.ppg.toFixed(2), +B.ppg.toFixed(2)]
        ];

        var head = '<div class="tm-vs__head">' +
            vsTeam(A, 'a') +
            '<span class="tm-vs__badge">VS</span>' +
            vsTeam(B, 'b') +
            '</div>';

        var bars = '<ul class="tm-vs__rows">' + rows.map(function (r, i) {
            var lowerBetter = r[3] === true;
            var neutral = r[4] === true;
            var av = r[1], bv = r[2];
            var noBar = r[5] === true;   // sıra gibi değerlerde çubuk yanıltıcı olur
            var max = Math.max(Math.abs(av), Math.abs(bv), 1);
            var aWin = !neutral && (lowerBetter ? av < bv : av > bv);
            var bWin = !neutral && (lowerBetter ? bv < av : bv > av);
            var fmtv = function (v) { return typeof v === 'number' && v % 1 ? C.fmt(v, 2) : v; };
            return '<li style="--i:' + i + '">' +
                '<span class="tm-vs__val' + (aWin ? ' is-win' : '') + '">' + fmtv(av) + '</span>' +
                '<span class="tm-vs__bar tm-vs__bar--a"><span style="--w:' + (noBar ? 0 : Math.abs(av) / max * 100).toFixed(1) + '%"></span></span>' +
                '<span class="tm-vs__label">' + r[0] + '</span>' +
                '<span class="tm-vs__bar tm-vs__bar--b"><span style="--w:' + (noBar ? 0 : Math.abs(bv) / max * 100).toFixed(1) + '%"></span></span>' +
                '<span class="tm-vs__val' + (bWin ? ' is-win' : '') + '">' + fmtv(bv) + '</span>' +
                '</li>';
        }).join('') + '</ul>';

        var meet = '<div class="tm-vs__meet"><h3>Aralarındaki maçlar</h3>' + (c.meetings.length
            ? '<ul>' + c.meetings.map(function (m) {
                var scored = TM.hasScore(m.status);
                return '<li><a href="/Admin/Matches?edit=' + m.id + '"><span>' + m.week + '. hafta</span><strong>' + TM.esc(m.homeTeamName) + ' <b>' +
                    (scored ? m.homeScore + '-' + m.awayScore : TM.fmtTime.format(TM.toDate(m.matchDate))) + '</b> ' + TM.esc(m.awayTeamName) + '</strong>' +
                    '<small>' + TM.esc(TM.statusLabel(m.status)) + ' · ' + TM.esc(TM.fmtShort.format(TM.toDate(m.matchDate))) + '</small></a></li>';
            }).join('') + '</ul>'
            : '<p>Bu sezon henüz karşılaşmadılar.</p>') + '</div>';

        vsBody.innerHTML = head + bars + meet;
        var list = vsBody.querySelector('.tm-vs__rows');
        C.whenVisible(list, function () { window.requestAnimationFrame(function () { list.classList.add('is-in'); }); });
    }

    function vsTeam(r, side) {
        var z = L.zone(r.rank, table.length);
        return '<span class="tm-vs__team tm-vs__team--' + side + '">' + TM.crest(r.name, r.logoUrl, 'lg') +
            '<strong>' + TM.esc(r.name) + '</strong><small>' + r.rank + '. sırada' + (z ? ' · ' + L.ZONES[z] : '') + '</small>' +
            '<span class="tm-form">' + r.form.map(function (f) { return '<i class="tm-form__pill tm-form__pill--' + f.r + '">' + f.r + '</i>'; }).join('') + '</span></span>';
    }

    selA.addEventListener('change', renderVersus);
    selB.addEventListener('change', renderVersus);
    $('[data-vs-swap]').addEventListener('click', function () {
        var t = selA.value;
        selA.value = selB.value;
        selB.value = t;
        renderVersus();
    });
    renderVersus();
})();
