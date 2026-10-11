/* =================================================================
   Doksan Artı — Teknik Masa puan durumu (admin-standings.js)
   1  Durum
   2  Tablo (genel / iç saha / deplasman), sıra değişimi animasyonu
   3  Hafta kaydırıcısı ve "sezonu oynat"
   4  Takım kartı
   5  Senaryo masası: olası skorlar, toplu kaydet
   6  Sezon yolculuğu grafiği (puan / sıra)
   ================================================================= */
(function () {
    'use strict';

    var TM = window.TM;
    if (!TM || !TM.league || !TM.charts) return;

    var L = TM.league;
    var C = TM.charts;
    var $ = TM.$;
    var $$ = TM.$$;

    /* ---------------------------------------------------------
       1. Durum
       --------------------------------------------------------- */
    var data = TM.getData() || { teams: [], matches: [] };
    var state = {
        venue: 'all',
        weekIndex: 0,          // race.weeks içindeki sıra
        includeLive: false,
        scenario: {},          // maçId -> { home, away }
        selected: null,        // takım kartındaki takım
        chartMode: 'points',
        chartTeams: [],        // [{ id, color }]
        playing: false
    };
    var race = L.race(data.teams, data.matches);

    var els = {
        body: $('[data-standings]'),
        caption: $('[data-table-caption]'),
        range: $('[data-week-range]'),
        weekText: $('[data-week-text]'),
        play: $('[data-week-play]'),
        liveSwitch: $('[data-live-switch]'),
        includeLive: $('[data-include-live]'),
        banner: $('[data-scenario-banner]'),
        card: $('[data-teamcard]'),
        scList: $('[data-scenario-list]'),
        scEmpty: $('[data-scenario-empty]'),
        scSub: $('[data-scenario-sub]'),
        scSave: $('[data-scenario-save]'),
        scSaveLabel: $('[data-scenario-save-label]'),
        scFoot: $('[data-scenario-foot]'),
        picker: $('[data-race-picker]'),
        chart: $('[data-race-chart]'),
        raceSub: $('[data-race-sub]')
    };

    var weekLed = TM.led($('[data-week-led]'), '  ', 'green', false);

    function lastIndex() { return Math.max(0, race.weeks.length - 1); }
    function atLatest() { return state.weekIndex >= lastIndex(); }
    function scenarioActive() { return Object.keys(state.scenario).length > 0; }
    function currentWeek() { return race.weeks[state.weekIndex]; }

    /* ---------------------------------------------------------
       2. Tablo
       --------------------------------------------------------- */
    function computeRows() {
        var opts = { venue: state.venue };
        if (!atLatest()) opts.upToWeek = currentWeek();
        if (atLatest() && state.includeLive) opts.includeLive = true;
        if (atLatest() && scenarioActive()) opts.overrides = state.scenario;
        return L.table(data.teams, data.matches, opts);
    }

    // Karşılaştırma tablosu: senaryoda gerçek tablo, yoksa bir önceki hafta
    function computeBase() {
        if (atLatest() && scenarioActive()) {
            return L.table(data.teams, data.matches, { venue: state.venue, includeLive: state.includeLive });
        }
        var prevIndex = atLatest() ? lastIndex() - 1 : state.weekIndex - 1;
        if (prevIndex < 0) return null;
        return L.table(data.teams, data.matches, { venue: state.venue, upToWeek: race.weeks[prevIndex] });
    }

    var formTitle = { G: 'Galibiyet', B: 'Beraberlik', M: 'Mağlubiyet' };

    function formHtml(row) {
        var pills = row.form.map(function (f) {
            var m = f.match;
            return '<i class="tm-form__pill tm-form__pill--' + f.r + '" title="' + TM.esc(formTitle[f.r] + ': ' + m.homeTeamName + ' ' + m.homeScore + '-' + m.awayScore + ' ' + m.awayTeamName) + '">' + f.r + '</i>';
        });
        while (pills.length < 5) pills.unshift('<i class="tm-form__pill tm-form__pill--none" aria-hidden="true"></i>');
        return '<span class="tm-form">' + pills.join('') + '</span>';
    }

    function renderTable(animate) {
        var rows = computeRows();
        var base = computeBase();
        var baseRank = {};
        if (base) base.forEach(function (r) { baseRank[r.id] = r.rank; });
        var maxPts = Math.max.apply(null, rows.map(function (r) { return r.points; }).concat([1]));

        // FLIP: eski konumları kaydet
        var before = {};
        if (animate && !TM.reduceMotion) {
            $$('tr[data-team]', els.body).forEach(function (tr) { before[tr.getAttribute('data-team')] = tr.getBoundingClientRect().top; });
        }

        els.body.innerHTML = rows.map(function (r) {
            var z = L.zone(r.rank, rows.length);
            var move = base && baseRank[r.id] ? baseRank[r.id] - r.rank : 0;
            var moveHtml = move > 0
                ? '<span class="tm-move tm-move--up" title="' + move + ' sıra yükseldi"><svg class="tm-icon" aria-hidden="true"><use href="#tm-i-up"/></svg>' + move + '</span>'
                : move < 0
                    ? '<span class="tm-move tm-move--down" title="' + (-move) + ' sıra düştü"><svg class="tm-icon" aria-hidden="true"><use href="#tm-i-down"/></svg>' + (-move) + '</span>'
                    : '<span class="tm-move tm-move--same" aria-hidden="true">–</span>';
            var gd = r.gd > 0 ? '+' + r.gd : String(r.gd);
            return '<tr data-team="' + r.id + '" class="' + (z ? 'zone-' + z : '') + (state.selected === r.id ? ' is-selected' : '') + '" ' +
                'style="--pw:' + ((r.points / maxPts) * 100).toFixed(1) + '%">' +
                '<td class="tm-standtable__rank"><span class="tm-rankbadge">' + r.rank + '</span>' + moveHtml + '</td>' +
                '<th scope="row"><button type="button" class="tm-standtable__team" data-pick="' + r.id + '">' + TM.crest(r.name, r.logoUrl, 'sm') +
                '<span>' + TM.esc(r.name) + '</span></button></th>' +
                '<td class="tm-col-num">' + r.played + '</td>' +
                '<td class="tm-col-num tm-col-hide-xs">' + r.won + '</td>' +
                '<td class="tm-col-num tm-col-hide-xs">' + r.drawn + '</td>' +
                '<td class="tm-col-num tm-col-hide-xs">' + r.lost + '</td>' +
                '<td class="tm-col-num tm-col-hide-sm">' + r.gf + '</td>' +
                '<td class="tm-col-num tm-col-hide-sm">' + r.ga + '</td>' +
                '<td class="tm-col-num tm-standtable__gd' + (r.gd > 0 ? ' is-pos' : r.gd < 0 ? ' is-neg' : '') + '">' + gd + '</td>' +
                '<td class="tm-standtable__pts"><strong>' + r.points + '</strong></td>' +
                '<td class="tm-col-hide-md">' + formHtml(r) + '</td>' +
                '</tr>';
        }).join('');

        // FLIP: yeni konumdan eskiye çek, sonra serbest bırak
        if (animate && !TM.reduceMotion) {
            $$('tr[data-team]', els.body).forEach(function (tr) {
                var old = before[tr.getAttribute('data-team')];
                if (old === undefined) return;
                var delta = old - tr.getBoundingClientRect().top;
                if (!delta) return;
                tr.style.transform = 'translateY(' + delta + 'px)';
                tr.style.transition = 'none';
                tr.classList.add('is-moving');
                window.requestAnimationFrame(function () {
                    window.requestAnimationFrame(function () {
                        tr.style.transition = 'transform .7s cubic-bezier(.2,.8,.2,1)';
                        tr.style.transform = '';
                    });
                });
                window.setTimeout(function () { tr.classList.remove('is-moving'); tr.style.transition = ''; }, 800);
            });
        } else if (!animate) {
            els.body.classList.add('is-entering');
            window.setTimeout(function () { els.body.classList.remove('is-entering'); }, 1200);
        }

        var venueText = { all: 'Genel', home: 'İç saha', away: 'Deplasman' }[state.venue];
        els.caption.textContent = venueText + ' puan durumu' + (atLatest() ? '' : ', ' + currentWeek() + '. hafta sonu');
        els.banner.hidden = !(atLatest() && scenarioActive());
        document.body.classList.toggle('tm-scenario-on', atLatest() && scenarioActive());

        if (!state.selected && rows.length) state.selected = rows[0].id;
        renderCard(rows);
        return rows;
    }

    els.body.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-pick]');
        if (!btn) return;
        state.selected = Number(btn.getAttribute('data-pick'));
        $$('tr[data-team]', els.body).forEach(function (tr) { tr.classList.toggle('is-selected', Number(tr.getAttribute('data-team')) === state.selected); });
        renderCard(computeRows());
        ensureInChart(state.selected);
        if (window.innerWidth < 1100) els.card.scrollIntoView({ block: 'start', behavior: TM.reduceMotion ? 'auto' : 'smooth' });
    });

    $$('[data-venue]').forEach(function (b) {
        b.addEventListener('click', function () {
            state.venue = b.getAttribute('data-venue');
            $$('[data-venue]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
            renderTable(true);
        });
    });

    if (data.matches.some(L.isLive)) {
        els.liveSwitch.hidden = false;
        els.includeLive.addEventListener('change', function () {
            state.includeLive = els.includeLive.checked;
            renderTable(true);
        });
    }

    /* ---------------------------------------------------------
       3. Hafta kaydırıcısı
       --------------------------------------------------------- */
    function setWeekUi() {
        var w = currentWeek();
        els.weekText.textContent = !race.weeks.length ? 'Henüz maç yok' : atLatest() ? 'Son durum · ' + w + '. hafta' : w + '. hafta sonu';
        if (weekLed && w) weekLed.setText(TM.pad(w), TM.reduceMotion ? null : { stagger: 180 });
        els.range.style.setProperty('--p', race.weeks.length > 1 ? (state.weekIndex / lastIndex()) * 100 + '%' : '100%');
        els.range.setAttribute('aria-valuetext', w ? w + '. hafta' : '');
        els.range.disabled = race.weeks.length < 2;
        els.play.disabled = race.weeks.length < 2;
        document.body.classList.toggle('tm-history', !atLatest());
    }

    els.range.min = 0;
    els.range.max = lastIndex();
    state.weekIndex = lastIndex();
    els.range.value = state.weekIndex;

    els.range.addEventListener('input', function () {
        state.weekIndex = Number(els.range.value);
        setWeekUi();
        renderTable(true);
    });

    els.play.addEventListener('click', function () {
        if (state.playing) { stopPlay(); return; }
        state.playing = true;
        els.play.classList.add('is-playing');
        els.play.innerHTML = '<svg class="tm-icon" aria-hidden="true"><use href="#tm-i-stop"/></svg>';
        state.weekIndex = 0;
        els.range.value = 0;
        setWeekUi();
        renderTable(true);
        var step = function () {
            if (!state.playing) return;
            if (state.weekIndex >= lastIndex()) { stopPlay(); return; }
            state.weekIndex++;
            els.range.value = state.weekIndex;
            setWeekUi();
            renderTable(true);
            state.timer = window.setTimeout(step, 1100);
        };
        state.timer = window.setTimeout(step, 1100);
    });

    function stopPlay() {
        state.playing = false;
        window.clearTimeout(state.timer);
        els.play.classList.remove('is-playing');
        els.play.innerHTML = '<svg class="tm-icon" aria-hidden="true"><use href="#tm-i-play"/></svg>';
    }

    /* ---------------------------------------------------------
       4. Takım kartı
       --------------------------------------------------------- */
    function renderCard(rows) {
        var r = rows.filter(function (x) { return x.id === state.selected; })[0];
        if (!r) { els.card.innerHTML = ''; return; }
        var team = L.teamIndex(data.teams)[r.id] || {};
        var z = L.zone(r.rank, rows.length);
        var mine = L.teamMatches(data.matches, r.id);
        var next = mine.filter(function (m) { return m.status === L.PLANNED && TM.toDate(m.matchDate) >= new Date(); })[0];
        var last = mine.filter(L.isFinished).slice(-5).reverse();
        var total = Math.max(1, r.won + r.drawn + r.lost);

        var html =
            '<div class="tm-teamcard2__head' + (z ? ' zone-' + z : '') + '">' +
            '<span class="tm-teamcard2__crest">' + TM.crest(r.name, r.logoUrl, 'lg') + '</span>' +
            '<span class="tm-teamcard2__name"><strong>' + TM.esc(r.name) + '</strong><small>' + TM.esc((team.city || '') + (team.stadium ? ' · ' + team.stadium : '')) + '</small></span>' +
            '<span class="tm-teamcard2__rank"><strong>' + r.rank + '</strong><small>' + (z ? L.ZONES[z] : 'sırada') + '</small></span>' +
            '</div>' +
            '<dl class="tm-teamcard2__stats">' +
            '<div><dt>Puan</dt><dd>' + r.points + '</dd></div>' +
            '<div><dt>Averaj</dt><dd>' + (r.gd > 0 ? '+' : '') + r.gd + '</dd></div>' +
            '<div><dt>Gol</dt><dd>' + r.gf + '<small>/' + r.ga + '</small></dd></div>' +
            '<div><dt>Gol yemedi</dt><dd>' + r.cleanSheets + '</dd></div>' +
            '</dl>' +
            '<div class="tm-wdl" role="img" aria-label="' + r.won + ' galibiyet, ' + r.drawn + ' beraberlik, ' + r.lost + ' mağlubiyet">' +
            '<span class="tm-wdl__g" style="--w:' + (r.won / total * 100) + '%"></span>' +
            '<span class="tm-wdl__b" style="--w:' + (r.drawn / total * 100) + '%"></span>' +
            '<span class="tm-wdl__m" style="--w:' + (r.lost / total * 100) + '%"></span>' +
            '</div>' +
            '<p class="tm-wdl__legend"><span><i class="tm-form__pill tm-form__pill--G">G</i>' + r.won + '</span><span><i class="tm-form__pill tm-form__pill--B">B</i>' + r.drawn + '</span><span><i class="tm-form__pill tm-form__pill--M">M</i>' + r.lost + '</span>' +
            '<span class="tm-wdl__ppg">' + C.fmt(r.ppg, 2) + ' puan/maç</span></p>' +
            '<div class="tm-teamcard2__chart"><p class="tm-teamcard2__label">Sıralama geçmişi</p><div data-card-chart style="min-height:120px"></div></div>';

        if (next) {
            var home = next.homeTeamId === r.id;
            var opp = home ? next.awayTeamName : next.homeTeamName;
            var oppLogo = home ? next.awayTeamLogo : next.homeTeamLogo;
            html += '<a class="tm-teamcard2__next" href="/Admin/Matches?edit=' + next.id + '"><span class="tm-teamcard2__label">Sıradaki maç</span>' +
                '<span class="tm-teamcard2__opp">' + TM.crest(opp, oppLogo, 'sm') + '<strong>' + (home ? '' : '@ ') + TM.esc(opp) + '</strong><small>' + (home ? 'İç saha' : 'Deplasman') + '</small></span>' +
                '<span class="tm-teamcard2__when">' + TM.esc(TM.fmtDay.format(TM.toDate(next.matchDate))) + ' ' + TM.fmtTime.format(TM.toDate(next.matchDate)) + '</span></a>';
        }
        if (last.length) {
            html += '<ul class="tm-teamcard2__last">' + last.map(function (m) {
                var res = L.outcomeFor(m, r.id);
                var home = m.homeTeamId === r.id;
                var opp = home ? m.awayTeamName : m.homeTeamName;
                return '<li><i class="tm-form__pill tm-form__pill--' + res + '">' + res + '</i>' +
                    '<span>' + (home ? 'vs ' : '@ ') + TM.esc(opp) + '</span><b>' + m.homeScore + '-' + m.awayScore + '</b><small>' + m.week + '. hf</small></li>';
            }).join('') + '</ul>';
        }
        els.card.innerHTML = html;

        var chartEl = $('[data-card-chart]', els.card);
        var ranks = race.ranks[r.id] || [];
        if (ranks.length > 1) {
            C.line(chartEl, {
                height: 120,
                labels: race.weeks,
                series: [{ name: r.name, color: '#5B9BFF', values: ranks }],
                invert: true,
                yMin: 1,
                yMax: Math.max(2, data.teams.length),
                yTicks: [1, Math.round(data.teams.length / 2), data.teams.length],
                labelWidth: 0,
                area: false,
                xLabel: function (w) { return w + '.'; },
                tooltipTitle: function (i) { return race.weeks[i] + '. hafta sonu'; },
                valueText: function (v) { return v + '. sıra'; }
            });
        } else {
            chartEl.innerHTML = '<p class="tm-chart__empty">En az iki hafta oynanınca görünür.</p>';
        }
    }

    /* ---------------------------------------------------------
       5. Senaryo masası
       --------------------------------------------------------- */
    var scenarioMatches = [];

    function buildScenarioList() {
        var week = L.activeWeek(data.matches);
        scenarioMatches = data.matches.filter(function (m) {
            return m.week === week && (m.status === L.PLANNED || m.status === L.LIVE);
        }).sort(L.byDate);

        els.scSub.textContent = scenarioMatches.length
            ? week + '. haftanın ' + scenarioMatches.length + ' maçına skor ver, tablo anında değişsin'
            : 'Oynanmamış maçlara skor ver, tablo nasıl değişir gör';
        els.scEmpty.hidden = scenarioMatches.length > 0;
        els.scFoot.hidden = scenarioMatches.length === 0;

        els.scList.innerHTML = scenarioMatches.map(function (m, i) {
            var live = L.isLive(m);
            return '<li class="tm-scrow' + (live ? ' is-live' : '') + '" data-sc="' + m.id + '" style="--i:' + i + '">' +
                '<span class="tm-scrow__team">' + TM.crest(m.homeTeamName, m.homeTeamLogo, 'xs') + '<span>' + TM.esc(m.homeTeamName) + '</span></span>' +
                stepper(m.id, 'home') +
                '<span class="tm-scrow__sep">' + (live ? '<i class="tm-pulse" title="Canlı"></i>' : '-') + '</span>' +
                stepper(m.id, 'away') +
                '<span class="tm-scrow__team tm-scrow__team--away"><span>' + TM.esc(m.awayTeamName) + '</span>' + TM.crest(m.awayTeamName, m.awayTeamLogo, 'xs') + '</span>' +
                '<span class="tm-scrow__quick" role="group" aria-label="Hızlı sonuç">' +
                '<button type="button" data-quick="1-0" title="Ev sahibi kazansın (1-0)">1</button>' +
                '<button type="button" data-quick="1-1" title="Berabere (1-1)">X</button>' +
                '<button type="button" data-quick="0-1" title="Deplasman kazansın (0-1)">2</button>' +
                '<button type="button" data-quick="clear" title="Temizle" aria-label="Temizle">×</button>' +
                '</span>' +
                '</li>';
        }).join('');
        syncScenarioUi();
    }

    function stepper(id, side) {
        return '<span class="tm-mini-step" data-side="' + side + '">' +
            '<button type="button" data-step="-1" aria-label="Azalt">−</button>' +
            '<output data-val>–</output>' +
            '<button type="button" data-step="1" aria-label="Artır">+</button>' +
            '</span>';
    }

    function syncScenarioUi() {
        scenarioMatches.forEach(function (m) {
            var row = els.scList.querySelector('[data-sc="' + m.id + '"]');
            if (!row) return;
            var s = state.scenario[m.id];
            var live = L.isLive(m);
            ['home', 'away'].forEach(function (side) {
                var out = $('.tm-mini-step[data-side="' + side + '"] [data-val]', row);
                var v = s ? s[side] : (live ? (side === 'home' ? m.homeScore : m.awayScore) : null);
                out.textContent = v == null ? '–' : v;
            });
            row.classList.toggle('is-set', !!s);
        });
        var n = Object.keys(state.scenario).length;
        els.scSave.disabled = n === 0;
        els.scSaveLabel.textContent = n ? n + ' sonucu kaydet' : 'Sonuç olarak kaydet';
    }

    els.scList.addEventListener('click', function (e) {
        var row = e.target.closest('[data-sc]');
        if (!row) return;
        var id = Number(row.getAttribute('data-sc'));
        var m = scenarioMatches.filter(function (x) { return x.id === id; })[0];
        var quick = e.target.closest('[data-quick]');
        var step = e.target.closest('[data-step]');
        if (!quick && !step) return;

        if (quick) {
            var q = quick.getAttribute('data-quick');
            if (q === 'clear') delete state.scenario[id];
            else {
                var p = q.split('-');
                state.scenario[id] = { home: Number(p[0]), away: Number(p[1]) };
            }
        } else {
            var side = step.closest('[data-side]').getAttribute('data-side');
            var cur = state.scenario[id] || (L.isLive(m) ? { home: m.homeScore || 0, away: m.awayScore || 0 } : null);
            var delta = Number(step.getAttribute('data-step'));
            if (!cur) cur = { home: 0, away: 0 };
            else cur = { home: cur.home, away: cur.away };
            cur[side] = Math.max(0, Math.min(20, cur[side] + (state.scenario[id] || L.isLive(m) ? delta : Math.max(0, delta))));
            state.scenario[id] = cur;
        }

        if (!atLatest()) {
            state.weekIndex = lastIndex();
            els.range.value = state.weekIndex;
            setWeekUi();
        }
        syncScenarioUi();
        renderTable(true);
        renderChart();
    });

    $$('[data-scenario-reset]').forEach(function (b) {
        b.addEventListener('click', function () {
            state.scenario = {};
            syncScenarioUi();
            renderTable(true);
            renderChart();
        });
    });

    els.scSave.addEventListener('click', function () {
        var ids = Object.keys(state.scenario).map(Number);
        if (!ids.length) return;
        var list = ids.map(function (id) {
            var m = scenarioMatches.filter(function (x) { return x.id === id; })[0];
            var s = state.scenario[id];
            return '<li>' + TM.esc(m.homeTeamName) + ' <b>' + s.home + '-' + s.away + '</b> ' + TM.esc(m.awayTeamName) + '</li>';
        }).join('');
        TM.confirm({
            title: ids.length + ' sonucu kaydet',
            html: 'Bu maçlar <strong>tamamlandı</strong> olarak kaydedilecek:<ul class="tm-confirm__list">' + list + '</ul>',
            confirmLabel: 'Sonuçları kaydet',
            tone: 'success',
            action: function () {
                var chain = Promise.resolve({ ok: true });
                var failed = null;
                ids.forEach(function (id) {
                    chain = chain.then(function (prev) {
                        if (!prev.ok) { failed = failed || prev; return prev; }
                        var m = scenarioMatches.filter(function (x) { return x.id === id; })[0];
                        var s = state.scenario[id];
                        return TM.saveMatch(m, { status: L.FINISHED, homeScore: s.home, awayScore: s.away });
                    });
                });
                return chain.then(function (r) { return failed || r; });
            }
        }).then(function (r) {
            if (!r) return;
            TM.toast(ids.length + ' maç sonucu kaydedildi. Tablo güncellendi.', 'success');
            state.scenario = {};
            TM.loadData(true).then(function (d) {
                data = d;
                race = L.race(data.teams, data.matches);
                els.range.max = lastIndex();
                state.weekIndex = lastIndex();
                els.range.value = state.weekIndex;
                setWeekUi();
                buildScenarioList();
                renderTable(true);
                renderPicker();
                renderChart();
            });
        });
    });

    /* ---------------------------------------------------------
       6. Sezon yolculuğu
       --------------------------------------------------------- */
    function freeColor() {
        var used = state.chartTeams.map(function (t) { return t.color; });
        return C.palette.filter(function (c) { return used.indexOf(c) < 0; })[0];
    }

    function ensureInChart(id) {
        if (state.chartTeams.some(function (t) { return t.id === id; })) return;
        if (state.chartTeams.length >= 6) state.chartTeams.pop();
        state.chartTeams.push({ id: id, color: freeColor() });
        renderPicker();
        renderChart();
    }

    function renderPicker() {
        var rows = L.table(data.teams, data.matches);
        els.picker.innerHTML = rows.map(function (r) {
            var sel = state.chartTeams.filter(function (t) { return t.id === r.id; })[0];
            return '<button type="button" class="tm-tchip' + (sel ? ' is-on' : '') + '" data-chip="' + r.id + '" aria-pressed="' + !!sel + '"' +
                (sel ? ' style="--c:' + sel.color + '"' : '') + '>' + TM.crest(r.name, r.logoUrl, 'xs') + '<span>' + TM.esc(r.name) + '</span></button>';
        }).join('');
    }

    els.picker.addEventListener('click', function (e) {
        var chip = e.target.closest('[data-chip]');
        if (!chip) return;
        var id = Number(chip.getAttribute('data-chip'));
        var idx = state.chartTeams.map(function (t) { return t.id; }).indexOf(id);
        if (idx >= 0) {
            if (state.chartTeams.length === 1) { TM.toast('Grafikte en az bir takım kalmalı.', 'info'); return; }
            state.chartTeams.splice(idx, 1);
        } else {
            if (state.chartTeams.length >= 6) { TM.toast('En fazla 6 takım karşılaştırılabilir. Önce birini çıkar.', 'info'); return; }
            state.chartTeams.push({ id: id, color: freeColor() });
        }
        renderPicker();
        renderChart();
    });

    $$('[data-race-mode]').forEach(function (b) {
        b.addEventListener('click', function () {
            state.chartMode = b.getAttribute('data-race-mode');
            $$('[data-race-mode]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
            renderChart();
        });
    });

    function renderChart() {
        if (!race.weeks.length) {
            els.chart.innerHTML = '<p class="tm-chart__empty">İlk hafta tamamlanınca sezon yolculuğu burada çizilir.</p>';
            return;
        }
        var idx = L.teamIndex(data.teams);
        var rank = state.chartMode === 'rank';
        els.raceSub.textContent = rank ? 'Seçili takımların hafta sonundaki sırası (1 en üstte)' : 'Seçili takımların hafta hafta topladığı puan';
        var series = state.chartTeams.map(function (t) {
            return { id: t.id, name: idx[t.id] ? idx[t.id].name : '?', color: t.color, values: (rank ? race.ranks : race.points)[t.id] || [] };
        });
        var n = data.teams.length;
        var opts = {
            height: 320,
            labels: race.weeks,
            series: series,
            labelWidth: 120,
            xLabel: function (w) { return w + '. hf'; },
            tooltipTitle: function (i) { return race.weeks[i] + '. hafta sonu'; },
            valueText: function (v) { return rank ? v + '.' : v + ' P'; }
        };
        if (rank) {
            opts.invert = true;
            opts.yMin = 1;
            opts.yMax = n;
            opts.yTicks = [1, 4, 6, Math.max(7, n - 3), n].filter(function (v, i, a) { return v <= n && a.indexOf(v) === i; });
        }
        // Grafik yeniden çizilsin diye kabı temizle (responsive önbelleği sıfırlanır)
        var fresh = els.chart.cloneNode(false);
        els.chart.parentNode.replaceChild(fresh, els.chart);
        els.chart = fresh;
        C.line(els.chart, opts);
    }

    // Kontrol panelinden "Sonuçları toplu gir" ile gelindiyse senaryo masasını göster
    function spotlightScenario() {
        if (!TM.params().get('scenario')) return;
        var panel = $('.tm-scenario');
        TM.setParams({ scenario: null });
        window.setTimeout(function () {
            panel.scrollIntoView({ block: 'center', behavior: TM.reduceMotion ? 'auto' : 'smooth' });
            panel.classList.add('is-spotlight');
            var first = $('[data-sc] [data-step="1"]', panel);
            if (first) first.focus({ preventScroll: true });
        }, 400);
    }

    /* Başlat */
    var initial = L.table(data.teams, data.matches).slice(0, 5);
    initial.forEach(function (r, i) { state.chartTeams.push({ id: r.id, color: C.palette[i] }); });
    setWeekUi();
    buildScenarioList();
    renderTable(false);
    renderPicker();
    renderChart();
    spotlightScenario();
})();
