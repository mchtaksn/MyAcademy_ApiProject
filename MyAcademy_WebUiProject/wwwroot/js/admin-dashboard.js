/* =================================================================
   Doksan Artı — Teknik Masa kontrol paneli (admin-dashboard.js)
   1  Halkalar, kayan tabela
   2  Sıradaki maça geri sayım / canlı dakika
   3  Sezon rakamları: mini çizgiler ve haftalık değişim
   4  Grafikler: haftalık goller, zirve yarışı, sonuç dağılımı
   5  Mini puan durumu (form) ve öne çıkanlar
   6  Canlı skor değişince yenile uyarısı
   ================================================================= */
(function () {
    'use strict';

    var TM = window.TM;
    if (!TM || !TM.league || !TM.charts) return;

    var L = TM.league;
    var C = TM.charts;
    var data = TM.getData() || { teams: [], matches: [] };
    var teams = data.teams;
    var matches = data.matches;
    var byId = L.teamIndex(teams);

    /* ---------------------------------------------------------
       1. Halkalar ve kayan tabela
       --------------------------------------------------------- */
    TM.$$('[data-ring]').forEach(function (el) {
        C.ring(el, {
            value: parseFloat(el.getAttribute('data-ring')) || 0,
            size: parseInt(el.getAttribute('data-ring-size') || '120', 10),
            stroke: 9,
            tone: el.getAttribute('data-ring-tone') || 'blue'
        });
    });

    var track = TM.$('[data-ticker-track]');
    if (track) {
        // Kesintisiz akış için içerik bir kez daha eklenir; ikinci kopya ekran okuyucudan gizli
        var clone = track.innerHTML;
        track.insertAdjacentHTML('beforeend', clone.replace(/<li class="/g, '<li aria-hidden="true" class="'));
        var items = track.children.length / 2;
        track.style.setProperty('--dur', Math.max(24, items * 6) + 's');
    }

    /* ---------------------------------------------------------
       2. Geri sayım ve canlı dakika
       --------------------------------------------------------- */
    var box = TM.$('[data-countdown]');
    if (box) {
        var target = TM.toDate(box.getAttribute('data-countdown')).getTime();
        var parts = [0, 1, 2].map(function (i) { return box.querySelector('[data-countdown-part="' + i + '"]'); });
        var labels = [0, 1, 2].map(function (i) { return box.querySelector('[data-countdown-label="' + i + '"]'); });
        var boards = parts.map(function (el) { return TM.led(el, '  ', 'red', false); });
        var shown = ['', '', ''];
        var mode = '';
        var two = function (n) { return n > 99 ? '99' : (n < 10 ? '0' : '') + n; };

        var tick = function () {
            var left = Math.max(0, target - Date.now());
            var s = Math.floor(left / 1000);
            var d = Math.floor(s / 86400);
            var h = Math.floor((s % 86400) / 3600);
            var m = Math.floor((s % 3600) / 60);
            var nextMode = d > 0 ? 'days' : 'hours';
            var values = nextMode === 'days' ? [d, h, m] : [h, m, s % 60];
            if (nextMode !== mode) {
                mode = nextMode;
                var names = mode === 'days' ? ['gün', 'saat', 'dakika'] : ['saat', 'dakika', 'saniye'];
                labels.forEach(function (el, i) { if (el) el.textContent = names[i]; });
            }
            values.forEach(function (v, i) {
                var text = two(v);
                if (text === shown[i] || !boards[i]) return;
                for (var c = 0; c < 2; c++) {
                    if (text.charAt(c) !== shown[i].charAt(c)) boards[i].setChar(c, text.charAt(c), TM.reduceMotion ? null : { stagger: 160 });
                }
                shown[i] = text;
            });
            if (left > 0) window.setTimeout(tick, 1000 - (Date.now() % 1000) + 20);
        };
        window.setTimeout(tick, TM.reduceMotion ? 0 : 500);
    }

    var minuteBox = TM.$('[data-live-minute]');
    if (minuteBox) {
        var kickoff = { matchDate: minuteBox.getAttribute('data-live-minute') };
        var minuteBoard = TM.led(TM.$('[data-minute-led]', minuteBox), '   ', 'red', false);
        var minuteLabel = TM.$('[data-minute-label]', minuteBox);
        var lastText = '';
        var updateMinute = function () {
            var clock = L.liveClock(kickoff);
            var text = (clock.text + '   ').slice(0, 3);
            if (text !== lastText && minuteBoard) {
                minuteBoard.setText(text, TM.reduceMotion || lastText ? null : { stagger: 300 });
                lastText = text;
            }
            minuteLabel.textContent = clock.label;
            minuteBox.classList.toggle('is-break', clock.phase === 'break');
        };
        window.setTimeout(updateMinute, TM.reduceMotion ? 0 : 700);
        window.setInterval(updateMinute, 15000);
    }

    /* ---------------------------------------------------------
       3. Sezon rakamları
       --------------------------------------------------------- */
    var weekly = L.weekly(matches).filter(function (w) { return w.finished > 0; });
    var outcome = L.outcomes(matches);

    function sparkFor(key, values, color) {
        var el = TM.$('[data-kpi-spark="' + key + '"]');
        if (el) C.spark(el, values, { color: color });
    }

    function deltaFor(key, html, tone) {
        var el = TM.$('[data-kpi-delta="' + key + '"]');
        if (!el) return;
        el.innerHTML = html;
        if (tone) el.classList.add('is-' + tone);
    }

    var last = weekly[weekly.length - 1];
    var prev = weekly[weekly.length - 2];

    sparkFor('goals', weekly.map(function (w) { return w.goals; }), '#5B9BFF');
    sparkFor('avg', weekly.map(function (w) { return Math.round(w.avg * 100) / 100; }), '#3BFF8F');
    sparkFor('played', weekly.map(function (w) { return w.finished; }), '#FFC23D');
    sparkFor('home', weekly.map(function (w) { return w.finished ? Math.round((w.homeWins / w.finished) * 100) : 0; }), '#9085e9');

    if (last) {
        deltaFor('goals', '<b>+' + last.goals + '</b> ' + last.week + '. haftada', 'up');
        var diff = prev ? last.avg - prev.avg : 0;
        deltaFor('avg', prev
            ? '<b>' + (diff >= 0 ? '▲ ' : '▼ ') + C.fmt(Math.abs(diff), 2) + '</b> önceki haftaya göre'
            : '<b>' + C.fmt(last.avg, 2) + '</b> ' + last.week + '. haftada', prev ? (diff >= 0 ? 'up' : 'down') : '');
        deltaFor('played', '<b>' + last.finished + '</b> maç ' + last.week + '. haftada');
        deltaFor('home', '<b>' + outcome.home + '</b> ev, <b>' + outcome.draw + '</b> beraberlik, <b>' + outcome.away + '</b> deplasman');
    } else {
        ['goals', 'avg', 'played', 'home'].forEach(function (k) { deltaFor(k, 'Henüz biten maç yok'); });
    }

    var homeWin = TM.$('[data-kpi-homewin]');
    if (homeWin) {
        var pct = outcome.total ? Math.round((outcome.home / outcome.total) * 100) : 0;
        homeWin.setAttribute('data-count', pct);
        C.countUp(homeWin);
    }

    /* ---------------------------------------------------------
       4. Grafikler
       --------------------------------------------------------- */
    var activeWeek = L.activeWeek(matches);
    var allWeeks = L.weekly(matches);

    var goalsEl = TM.$('[data-chart-goals]');
    if (goalsEl) {
        var withGoals = allWeeks.filter(function (w) { return w.finished > 0 || w.week <= activeWeek; });
        if (!weekly.length) {
            goalsEl.hidden = true;
            TM.$('[data-chart-goals-empty]').hidden = false;
        } else {
            C.bars(goalsEl, {
                height: 240,
                labels: withGoals.map(function (w) { return w.week; }),
                series: [
                    { name: 'Ev sahibi', color: C.home, values: withGoals.map(function (w) { return w.homeGoals; }) },
                    { name: 'Deplasman', color: C.away, values: withGoals.map(function (w) { return w.awayGoals; }) }
                ],
                highlight: withGoals.map(function (w) { return w.week; }).indexOf(activeWeek),
                xLabel: function (l) { return l + '.'; },
                tooltip: function (i) {
                    var w = withGoals[i];
                    return '<strong class="tm-tip__title">' + w.week + '. hafta</strong>' +
                        '<span class="tm-tip__row"><i style="background:' + C.home + '"></i>Ev sahibi<b>' + w.homeGoals + '</b></span>' +
                        '<span class="tm-tip__row"><i style="background:' + C.away + '"></i>Deplasman<b>' + w.awayGoals + '</b></span>' +
                        '<span class="tm-tip__foot">' + w.finished + '/' + w.total + ' maç bitti · maç başına ' + C.fmt(w.avg, 2) + '</span>';
                },
                onClick: function (i) { TM.go('/Admin/Matches?week=' + withGoals[i].week); }
            });
        }
    }

    var table = L.table(teams, matches);
    var race = L.race(teams, matches);
    var raceEl = TM.$('[data-chart-race]');
    if (raceEl) {
        var top = table.slice(0, 5);
        if (!race.weeks.length || !top.length) {
            raceEl.innerHTML = '<p class="tm-chart__empty">Puan yarışı ilk hafta tamamlanınca görünür.</p>';
        } else {
            var series = top.map(function (r, i) {
                return { id: r.id, name: r.name, short: r.name, color: C.palette[i], values: race.points[r.id] };
            });
            C.line(raceEl, {
                height: 260,
                labels: race.weeks,
                series: series,
                labelWidth: 110,
                xLabel: function (w) { return w + '.'; },
                tooltipTitle: function (i) { return race.weeks[i] + '. hafta sonunda'; },
                valueText: function (v) { return v + ' P'; }
            });
            var legend = TM.$('[data-chart-race-legend]');
            legend.innerHTML = series.map(function (s) {
                return '<span><i style="background:' + s.color + '"></i>' + TM.esc(s.name) + '</span>';
            }).join('');
        }
    }

    var donutEl = TM.$('[data-chart-outcome]');
    if (donutEl) {
        var segments = [
            { label: 'Ev sahibi kazandı', short: 'Ev sahibi', value: outcome.home, color: C.home },
            { label: 'Berabere', short: 'Beraberlik', value: outcome.draw, color: '#7d8cab' },
            { label: 'Deplasman kazandı', short: 'Deplasman', value: outcome.away, color: C.away }
        ];
        C.donut(donutEl, {
            size: 172,
            thickness: 22,
            segments: segments,
            centerValue: String(outcome.total),
            centerLabel: 'maç'
        });
        TM.$('[data-outcome-total]').textContent = outcome.total ? C.fmt(outcome.avg, 2) + ' gol / maç' : '';
        TM.$('[data-outcome-legend]').innerHTML = segments.map(function (s, i) {
            var pct = outcome.total ? Math.round((s.value / outcome.total) * 100) : 0;
            return '<li style="--i:' + i + '"><i style="background:' + s.color + '"></i><span>' + s.short + '</span>' +
                '<strong>' + s.value + '</strong><span class="tm-outcome__pct">%' + pct + '</span>' +
                '<span class="tm-outcome__bar"><span style="--w:' + pct + '%;background:' + s.color + '"></span></span></li>';
        }).join('') +
            '<li class="tm-outcome__extra"><span>İki takım da gol attı</span><strong>' + outcome.bothScored + '</strong></li>' +
            '<li class="tm-outcome__extra"><span>2,5 üstü biten</span><strong>' + outcome.over25 + '</strong></li>';
    }

    /* ---------------------------------------------------------
       5. Mini puan durumu ve öne çıkanlar
       --------------------------------------------------------- */
    var formTitle = { G: 'Galibiyet', B: 'Beraberlik', M: 'Mağlubiyet' };

    function formPills(row) {
        var pills = row.form.map(function (f) {
            var m = f.match;
            var title = formTitle[f.r] + ': ' + m.homeTeamName + ' ' + m.homeScore + '-' + m.awayScore + ' ' + m.awayTeamName;
            return '<i class="tm-form__pill tm-form__pill--' + f.r + '" title="' + TM.esc(title) + '">' + f.r + '</i>';
        });
        while (pills.length < 5) pills.unshift('<i class="tm-form__pill tm-form__pill--none" aria-hidden="true"></i>');
        return '<span class="tm-form">' + pills.join('') + '</span>';
    }

    function miniRow(r, i) {
        var z = L.zone(r.rank, table.length);
        var gd = r.gd > 0 ? '+' + r.gd : String(r.gd);
        return '<tr class="' + (z ? 'zone-' + z : '') + '" style="--i:' + i + '">' +
            '<td class="tm-mini-table__rank">' + r.rank + '</td>' +
            '<th scope="row"><span class="tm-mini-table__team">' + TM.crest(r.name, r.logoUrl, 'xs') + '<span>' + TM.esc(r.name) + '</span></span></th>' +
            '<td>' + formPills(r) + '</td>' +
            '<td>' + gd + '</td><td class="tm-mini-table__pts">' + r.points + '</td></tr>';
    }

    var mini = TM.$('[data-mini-table]');
    if (mini) {
        var html = table.slice(0, 6).map(miniRow).join('');
        if (table.length > 9) {
            html += '<tr class="tm-mini-table__gap" aria-hidden="true"><td colspan="5"></td></tr>';
            html += table.slice(table.length - 3).map(function (r, i) { return miniRow(r, 6 + i); }).join('');
        }
        mini.innerHTML = html;
    }

    var hl = TM.$('[data-highlights]');
    if (hl) {
        var rec = L.records(teams, matches);
        var bestAttack = table.filter(function (r) { return r.played; }).sort(function (a, b) { return b.gf - a.gf || a.played - b.played; })[0];
        var bestDefense = table.filter(function (r) { return r.played; }).sort(function (a, b) { return a.ga - b.ga || b.played - a.played; })[0];
        var items = [];
        function score(m) { return m.homeTeamName + ' <b>' + m.homeScore + '-' + m.awayScore + '</b> ' + m.awayTeamName; }
        if (rec.biggestWin) items.push({ icon: 'tm-i-bolt', tone: 'blue', title: 'En farklı skor', text: score(rec.biggestWin.match), meta: rec.biggestWin.match.week + '. hafta', href: '/Admin/Matches?edit=' + rec.biggestWin.match.id });
        if (rec.highestScoring) items.push({ icon: 'tm-i-fire', tone: 'amber', title: 'En gollü maç', text: score(rec.highestScoring.match), meta: rec.highestScoring.total + ' gol', href: '/Admin/Matches?edit=' + rec.highestScoring.match.id });
        if (rec.unbeaten) items.push({ icon: 'tm-i-shieldcheck', tone: 'green', title: 'Yenilmezlik serisi', text: TM.esc(rec.unbeaten.team.name), meta: rec.unbeaten.unbeaten + ' maçtır yenilmiyor', crest: rec.unbeaten.team });
        if (bestAttack) items.push({ icon: 'tm-i-target', tone: 'violet', title: 'En golcü hücum', text: TM.esc(bestAttack.name), meta: bestAttack.gf + ' gol, ' + bestAttack.played + ' maç', crest: bestAttack });
        if (bestDefense) items.push({ icon: 'tm-i-shield', tone: 'teal', title: 'En az gol yiyen', text: TM.esc(bestDefense.name), meta: bestDefense.ga + ' gol yedi', crest: bestDefense });
        if (!items.length) {
            hl.innerHTML = '<li class="tm-empty">İlk maçlar bitince rekorlar burada görünür.</li>';
        } else {
            hl.innerHTML = items.map(function (it, i) {
                var tag = it.href ? 'a' : 'div';
                return '<li style="--i:' + i + '"><' + tag + ' class="tm-highlight tm-highlight--' + it.tone + '"' + (it.href ? ' href="' + it.href + '"' : '') + '>' +
                    '<span class="tm-highlight__icon"><svg class="tm-icon" aria-hidden="true"><use href="#' + it.icon + '"/></svg></span>' +
                    '<span class="tm-highlight__body"><small>' + it.title + '</small><strong>' + it.text + '</strong><span>' + it.meta + '</span></span>' +
                    (it.crest ? TM.crest(it.crest.name, it.crest.logoUrl, 'sm') : '') +
                    '</' + tag + '></li>';
            }).join('');
        }
    }

    /* ---------------------------------------------------------
       6. Canlı skorlar değişirse kullanıcıya haber ver
       --------------------------------------------------------- */
    function liveKey(list) {
        return list.filter(function (m) { return m.status === L.LIVE || m.status === L.FINISHED; })
            .map(function (m) { return m.id + ':' + m.status + ':' + m.homeScore + '-' + m.awayScore; }).join('|');
    }
    var baseline = liveKey(matches);
    var notice = null;
    TM.onData(function (d) {
        if (notice || liveKey(d.matches) === baseline) return;
        notice = document.createElement('button');
        notice.type = 'button';
        notice.className = 'tm-refresh';
        notice.innerHTML = '<svg class="tm-icon" aria-hidden="true"><use href="#tm-i-refresh"/></svg>Skorlar değişti, paneli yenile';
        notice.addEventListener('click', function () { window.location.reload(); });
        document.body.appendChild(notice);
    });
    if (matches.some(L.isLive)) TM.startPolling(30000);
})();
