/* =================================================================
   Doksan Artı — puan durumu (standings.js)
   1  Durum
   2  Başlık kartları: lider, en golcü, en sağlam savunma
   3  Tablo: genel / iç saha / deplasman, canlı tablo, sıra değişimi (FLIP)
   4  Süzgeçler: bölge, arama
   5  Hafta kaydırıcısı ve "sezonu oynat"
   6  Takım kartı
   7  Puan merdiveni
   8  Sezon yolculuğu grafiği
   9  Canlı güncellemeler ve başlat
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
       1. Durum
       --------------------------------------------------------- */
    var data = DA.getData();
    var race = L.race(data.teams, data.matches);
    var state = {
        venue: 'all',
        includeLive: true,
        weekIndex: Math.max(0, race.weeks.length - 1),
        zone: 'all',
        query: '',
        selected: null,
        chartMode: 'points',
        chartTeams: [],
        playing: false,
        timer: null,
        lastPoints: {},
        finishedKey: ''
    };

    var els = {
        kicker: $('[data-st-kicker]'),
        lead: $('[data-st-lead]'),
        leaders: $('[data-st-leaders]'),
        rows: $('[data-rows]'),
        caption: $('[data-caption]'),
        nomatch: $('[data-nomatch]'),
        liveSwitch: $('[data-live-switch]'),
        includeLive: $('[data-include-live]'),
        range: $('[data-week-range]'),
        weekText: $('[data-week-text]'),
        play: $('[data-week-play]'),
        search: $('[data-search]'),
        card: $('[data-card]'),
        ladder: $('[data-ladder]'),
        picker: $('[data-race-picker]'),
        chart: $('[data-race-chart]'),
        raceSub: $('[data-race-sub]')
    };
    var weekLed = DA.led($('[data-week-led]'), '  ', 'green', false);

    function lastIndex() { return Math.max(0, race.weeks.length - 1); }
    function atLatest() { return state.weekIndex >= lastIndex(); }
    function currentWeek() { return race.weeks[state.weekIndex]; }
    function anyLive() { return data.matches.some(L.isLive); }
    function liveOn() { return atLatest() && state.includeLive && anyLive(); }

    function computeRows() {
        var opts = { venue: state.venue };
        if (!atLatest() && currentWeek()) opts.upToWeek = currentWeek();
        if (liveOn()) opts.includeLive = true;
        return L.table(data.teams, data.matches, opts);
    }

    // Karşılaştırma: canlıyken canlısız tablo, geçmişte bir önceki hafta
    function computeBase() {
        if (liveOn()) return L.table(data.teams, data.matches, { venue: state.venue });
        var prev = atLatest() ? lastIndex() - 1 : state.weekIndex - 1;
        if (prev < 0 || !race.weeks[prev]) return null;
        return L.table(data.teams, data.matches, { venue: state.venue, upToWeek: race.weeks[prev] });
    }

    function playingMap() {
        var map = {};
        if (!liveOn()) return map;
        data.matches.filter(L.isLive).forEach(function (m) { map[m.homeTeamId] = m; map[m.awayTeamId] = m; });
        return map;
    }

    /* ---------------------------------------------------------
       2. Başlık kartları
       --------------------------------------------------------- */
    function renderLeaders() {
        var rows = L.table(data.teams, data.matches, { includeLive: anyLive() });
        var played = rows.filter(function (r) { return r.played > 0; });
        if (!played.length) { els.leaders.innerHTML = ''; return; }
        var leader = rows[0];
        var attack = played.slice().sort(function (a, b) { return b.gf - a.gf || b.gd - a.gd; })[0];
        var defense = played.slice().sort(function (a, b) { return a.ga / a.played - b.ga / b.played || b.cleanSheets - a.cleanSheets; })[0];
        var second = rows[1];
        var gap = second ? leader.points - second.points : 0;

        function card(cls, label, r, value, unit, note, i) {
            return '<a class="st-lead st-lead--' + cls + '" href="' + DA.clubUrl(r.id) + '" data-reveal style="--i:' + i + ';--tc:' + DA.clubColors(r.name).a + '">' +
                '<span class="st-lead__label">' + label + '</span>' +
                '<span class="st-lead__team">' + DA.crest(r.name, r.logoUrl, 'md') + '<strong>' + esc(r.name) + '</strong></span>' +
                '<span class="st-lead__value"><span class="da-board da-board--plain"><span class="da-led da-led--sm" data-lead-led="' + value + '" data-tone="' + (cls === 'leader' ? 'amber' : 'green') + '"></span></span><small>' + unit + '</small></span>' +
                '<span class="st-lead__note">' + note + '</span>' +
                '</a>';
        }
        els.leaders.innerHTML =
            card('leader', 'Lider', leader, leader.points, 'puan', gap > 0 ? second.name + ' ile ' + gap + ' puan fark' : 'Puanla eşit takip ediliyor', 0) +
            card('attack', 'En golcü', attack, attack.gf, 'gol', C.fmt(attack.gf / attack.played, 2) + ' gol / maç', 1) +
            card('defense', 'En sağlam savunma', defense, defense.ga, 'yedi', defense.cleanSheets + ' maçta gol yemedi', 2);
        $$('[data-lead-led]', els.leaders).forEach(function (el, i) {
            var text = String(el.getAttribute('data-lead-led'));
            var board = DA.led(el, text.replace(/./g, ' '), el.getAttribute('data-tone'), false);
            window.setTimeout(function () { if (board) board.setText(text, DA.reduceMotion ? null : { stagger: 300 }); }, 400 + i * 180);
        });
        DA.reveal(els.leaders);
    }

    function renderHead() {
        var o = L.outcomes(data.matches);
        var live = data.matches.filter(L.isLive).length;
        var aw = L.activeWeek(data.matches);
        els.kicker.classList.toggle('is-live', live > 0);
        $('span', els.kicker).textContent = live ? 'Serie A · ' + live + ' maç canlı' : 'Serie A 2026/27 · ' + aw + '. hafta';
        els.lead.textContent = o.total
            ? o.total + ' maç oynandı, ' + o.goals + ' gol atıldı. ' + (live ? 'Şu an ' + live + ' maç sürüyor: canlı tablo o anki skorla yeniden diziliyor.' : 'Bir sonraki sonuçla tablo kendiliğinden güncellenir.')
            : 'İlk maçlar oynanınca tablo burada şekillenecek.';
    }

    /* ---------------------------------------------------------
       3. Tablo
       --------------------------------------------------------- */
    var formTitle = { G: 'Galibiyet', B: 'Beraberlik', M: 'Mağlubiyet' };

    function zoneGroup(z) {
        if (z === 'ucl') return 'ucl';
        if (z === 'uel' || z === 'uecl') return 'eu';
        if (z === 'rel') return 'rel';
        return 'mid';
    }

    function nextFor(teamId) {
        var limit = atLatest() ? null : currentWeek();
        return data.matches.filter(function (m) {
            if (m.homeTeamId !== teamId && m.awayTeamId !== teamId) return false;
            if (limit) return m.week > limit;
            return m.status === L.PLANNED && DA.toDate(m.matchDate).getTime() >= Date.now();
        }).sort(L.byDate)[0] || null;
    }

    function formHtml(r, live) {
        var pills = r.form.map(function (f) {
            var m = f.match;
            var isNow = live && m.id === live.id;
            return '<i class="da-form__pill da-form__pill--' + (isNow ? 'live' : f.r) + '" title="' + esc((isNow ? 'Canlı ' : formTitle[f.r] + ': ') + m.homeTeamName + ' ' + m.homeScore + '-' + m.awayScore + ' ' + m.awayTeamName) + '">' + f.r + '</i>';
        });
        while (pills.length < 5) pills.unshift('<i class="da-form__pill da-form__pill--none" aria-hidden="true"></i>');
        return '<span class="da-form">' + pills.join('') + '</span>';
    }

    function rowHtml(r, n, baseRank, playing, maxPts) {
        var z = L.zone(r.rank, n);
        var move = baseRank && baseRank[r.id] ? baseRank[r.id] - r.rank : 0;
        var live = playing[r.id];
        var next = nextFor(r.id);
        var moveHtml = move > 0
            ? '<span class="st-move st-move--up" title="' + move + ' sıra yükseldi"><svg aria-hidden="true"><use href="#i-up"/></svg>' + move + '</span>'
            : move < 0
                ? '<span class="st-move st-move--down" title="' + (-move) + ' sıra düştü"><svg aria-hidden="true"><use href="#i-down"/></svg>' + (-move) + '</span>'
                : '<span class="st-move" aria-hidden="true"></span>';
        var liveChip = '';
        if (live) {
            var home = live.homeTeamId === r.id;
            var mine = home ? live.homeScore : live.awayScore;
            var theirs = home ? live.awayScore : live.homeScore;
            var res = mine > theirs ? 'is-win' : mine < theirs ? 'is-lose' : 'is-draw';
            liveChip = '<a class="st-livechip ' + res + '" href="' + DA.matchUrl(live.id) + '" title="' + esc('Canlı: ' + live.homeTeamName + ' ' + live.homeScore + '-' + live.awayScore + ' ' + live.awayTeamName) + '">' +
                '<i class="da-pulse" aria-hidden="true"></i><b>' + mine + '-' + theirs + '</b><span data-live-text="' + live.id + '">' + esc(DA.liveClock(live).text) + '</span></a>';
        }
        var nextHtml = '';
        if (next) {
            var nh = next.homeTeamId === r.id;
            var opp = nh ? next.awayTeamName : next.homeTeamName;
            var oppLogo = nh ? next.awayTeamLogo : next.homeTeamLogo;
            nextHtml = '<a class="st-next" href="' + DA.matchUrl(next.id) + '" title="' + esc((nh ? 'İç sahada ' : 'Deplasmanda ') + opp + ' · ' + DA.when(next.matchDate)) + '">' +
                DA.crest(opp, oppLogo, 'xs') + '<small>' + (nh ? 'E' : 'D') + '</small></a>';
        }
        var gd = r.gd > 0 ? '+' + r.gd : String(r.gd);
        return '<tr data-team="' + r.id + '" data-zone="' + zoneGroup(z) + '" class="st-row' + (z ? ' zone-' + z : '') + (live ? ' is-live' : '') + (state.selected === r.id ? ' is-selected' : '') + '" ' +
            'style="--pw:' + ((r.points / maxPts) * 100).toFixed(1) + '%;--d:' + (r.rank * 35) + ';--tc:' + DA.clubColors(r.name).a + '" tabindex="0" aria-label="' + esc(r.rank + '. ' + r.name + ', ' + r.points + ' puan') + '">' +
            '<td class="st-col-rank"><span class="st-rank">' + r.rank + '</span>' + moveHtml + '</td>' +
            '<th scope="row" class="st-col-team"><span class="st-team">' + DA.crest(r.name, r.logoUrl, 'sm') +
            '<a href="' + DA.clubUrl(r.id) + '" class="st-team__name">' + esc(r.name) + '</a>' + liveChip + '</span></th>' +
            '<td class="st-col-num">' + r.played + '</td>' +
            '<td class="st-col-num st-hide-s">' + r.won + '</td>' +
            '<td class="st-col-num st-hide-s">' + r.drawn + '</td>' +
            '<td class="st-col-num st-hide-s">' + r.lost + '</td>' +
            '<td class="st-col-num st-hide-m">' + r.gf + '</td>' +
            '<td class="st-col-num st-hide-m">' + r.ga + '</td>' +
            '<td class="st-col-num st-gd' + (r.gd > 0 ? ' is-pos' : r.gd < 0 ? ' is-neg' : '') + '">' + gd + '</td>' +
            '<td class="st-col-pts"><strong data-pts>' + r.points + '</strong></td>' +
            '<td class="st-col-form st-hide-l">' + formHtml(r, live) + '</td>' +
            '<td class="st-col-next st-hide-l">' + nextHtml + '</td>' +
            '</tr>';
    }

    function renderTable(animate) {
        var rows = computeRows();
        var base = computeBase();
        var baseRank = null;
        if (base) { baseRank = {}; base.forEach(function (r) { baseRank[r.id] = r.rank; }); }
        var playing = playingMap();
        var maxPts = Math.max.apply(null, rows.map(function (r) { return r.points; }).concat([1]));
        var n = rows.length;
        var prevPoints = state.lastPoints;
        var html = rows.map(function (r) { return rowHtml(r, n, baseRank, playing, maxPts); }).join('');

        if (animate) DA.flip(els.rows, 'tr[data-team]', 'data-team', function () { els.rows.innerHTML = html; });
        else {
            els.rows.innerHTML = html;
            if (!DA.reduceMotion) {
                els.rows.classList.add('is-entering');
                window.setTimeout(function () { els.rows.classList.remove('is-entering'); }, 1400);
            }
        }

        // Puanı değişen satır parlar
        var nextPoints = {};
        rows.forEach(function (r) {
            nextPoints[r.id] = r.points;
            if (animate && prevPoints[r.id] !== undefined && prevPoints[r.id] !== r.points) {
                DA.pulse($('tr[data-team="' + r.id + '"]', els.rows), 'is-changed');
            }
        });
        state.lastPoints = nextPoints;

        var venueText = { all: 'Genel', home: 'İç saha', away: 'Deplasman' }[state.venue];
        els.caption.textContent = venueText + ' puan durumu' + (atLatest() ? (liveOn() ? ', canlı skorlarla' : '') : ', ' + currentWeek() + '. hafta sonu');
        els.liveSwitch.hidden = !anyLive();
        els.liveSwitch.classList.toggle('is-off', !atLatest());
        document.body.classList.toggle('st-history', !atLatest());
        document.body.classList.toggle('st-live', liveOn());

        if (!state.selected && rows.length) state.selected = rows[0].id;
        applyFilters();
        renderCard(rows);
        renderLadder(rows);
        return rows;
    }

    els.rows.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;
        var tr = e.target.closest('tr[data-team]');
        if (tr) selectTeam(Number(tr.getAttribute('data-team')), true);
    });
    els.rows.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var tr = e.target.closest('tr[data-team]');
        if (!tr || e.target.closest('a')) return;
        e.preventDefault();
        selectTeam(Number(tr.getAttribute('data-team')), true);
    });

    function selectTeam(id, scroll) {
        state.selected = id;
        $$('tr[data-team]', els.rows).forEach(function (tr) { tr.classList.toggle('is-selected', Number(tr.getAttribute('data-team')) === id); });
        $$('[data-ladder-team]', els.ladder).forEach(function (m) { m.classList.toggle('is-selected', Number(m.getAttribute('data-ladder-team')) === id); });
        renderCard(computeRows());
        ensureInChart(id);
        if (scroll && window.innerWidth < 1100) els.card.scrollIntoView({ block: 'start', behavior: DA.reduceMotion ? 'auto' : 'smooth' });
    }

    $$('[data-venue]').forEach(function (b) {
        b.addEventListener('click', function () {
            state.venue = b.getAttribute('data-venue');
            $$('[data-venue]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
            renderTable(true);
        });
    });

    els.includeLive.addEventListener('change', function () {
        state.includeLive = els.includeLive.checked;
        renderTable(true);
    });

    /* ---------------------------------------------------------
       4. Süzgeçler
       --------------------------------------------------------- */
    function applyFilters() {
        var q = DA.norm(state.query);
        var visible = 0;
        $$('tr[data-team]', els.rows).forEach(function (tr) {
            var name = DA.norm($('.st-team__name', tr).textContent);
            var ok = (state.zone === 'all' || tr.getAttribute('data-zone') === state.zone) && (!q || name.indexOf(q) >= 0);
            tr.hidden = !ok;
            if (ok) visible++;
        });
        els.nomatch.hidden = visible > 0;
    }

    $$('[data-zone]').forEach(function (chip) {
        chip.addEventListener('click', function () {
            state.zone = chip.getAttribute('data-zone');
            $$('[data-zone]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === chip)); });
            applyFilters();
        });
    });

    els.search.addEventListener('input', function () {
        state.query = els.search.value;
        applyFilters();
    });

    /* ---------------------------------------------------------
       5. Hafta kaydırıcısı
       --------------------------------------------------------- */
    function setWeekUi() {
        var w = currentWeek();
        els.weekText.textContent = !race.weeks.length ? 'Henüz maç yok' : atLatest() ? 'Son durum · ' + w + '. hafta' : w + '. hafta sonu';
        if (weekLed && w) weekLed.setText(DA.pad(w), DA.reduceMotion ? null : { stagger: 180 });
        els.range.min = 0;
        els.range.max = lastIndex();
        els.range.value = state.weekIndex;
        els.range.style.setProperty('--p', race.weeks.length > 1 ? (state.weekIndex / lastIndex()) * 100 + '%' : '100%');
        els.range.setAttribute('aria-valuetext', w ? w + '. hafta' : '');
        els.range.disabled = race.weeks.length < 2;
        els.play.disabled = race.weeks.length < 2;
    }

    els.range.addEventListener('input', function () {
        state.weekIndex = Number(els.range.value);
        setWeekUi();
        renderTable(true);
    });

    els.play.addEventListener('click', function () {
        if (state.playing) { stopPlay(); return; }
        state.playing = true;
        els.play.classList.add('is-playing');
        els.play.innerHTML = '<svg aria-hidden="true"><use href="#i-stop"/></svg>';
        els.play.setAttribute('aria-label', 'Durdur');
        state.weekIndex = 0;
        setWeekUi();
        renderTable(true);
        var step = function () {
            if (!state.playing) return;
            if (state.weekIndex >= lastIndex()) { stopPlay(); return; }
            state.weekIndex++;
            setWeekUi();
            renderTable(true);
            state.timer = window.setTimeout(step, 1150);
        };
        state.timer = window.setTimeout(step, 1150);
    });

    function stopPlay() {
        state.playing = false;
        window.clearTimeout(state.timer);
        els.play.classList.remove('is-playing');
        els.play.innerHTML = '<svg aria-hidden="true"><use href="#i-play"/></svg>';
        els.play.setAttribute('aria-label', 'Sezonu baştan oynat');
    }

    /* ---------------------------------------------------------
       6. Takım kartı
       --------------------------------------------------------- */
    function renderCard(rows) {
        var r = rows.filter(function (x) { return x.id === state.selected; })[0];
        if (!r) { els.card.innerHTML = ''; return; }
        var team = L.teamIndex(data.teams)[r.id] || {};
        var z = L.zone(r.rank, rows.length);
        var mine = L.teamMatches(data.matches, r.id);
        var live = mine.filter(L.isLive)[0];
        var next = mine.filter(function (m) { return m.status === L.PLANNED && DA.toDate(m.matchDate) >= new Date(); })[0];
        var last = mine.filter(L.isFinished).slice(-5).reverse();
        var total = Math.max(1, r.won + r.drawn + r.lost);
        var colors = DA.clubColors(r.name);

        var html =
            '<div class="st-card__head' + (z ? ' zone-' + z : '') + '" style="--tc:' + colors.a + '">' +
            '<span class="st-card__crest">' + DA.crest(r.name, r.logoUrl, 'lg') + '</span>' +
            '<span class="st-card__name"><strong>' + esc(r.name) + '</strong><small>' + esc((team.city || '') + (team.stadium ? ' · ' + team.stadium : '')) + '</small></span>' +
            '<span class="st-card__rank"><strong>' + r.rank + '</strong><small>' + (z ? L.ZONES[z] : 'sırada') + '</small></span>' +
            '</div>' +
            '<dl class="st-card__stats">' +
            '<div><dt>Puan</dt><dd>' + r.points + '</dd></div>' +
            '<div><dt>Averaj</dt><dd>' + (r.gd > 0 ? '+' : '') + r.gd + '</dd></div>' +
            '<div><dt>Gol</dt><dd>' + r.gf + '<small>/' + r.ga + '</small></dd></div>' +
            '<div><dt>Puan / maç</dt><dd>' + C.fmt(r.ppg, 2) + '</dd></div>' +
            '</dl>' +
            '<div class="st-wdl" role="img" aria-label="' + r.won + ' galibiyet, ' + r.drawn + ' beraberlik, ' + r.lost + ' mağlubiyet">' +
            '<span class="st-wdl__g" style="--w:' + (r.won / total * 100) + '%"></span>' +
            '<span class="st-wdl__b" style="--w:' + (r.drawn / total * 100) + '%"></span>' +
            '<span class="st-wdl__m" style="--w:' + (r.lost / total * 100) + '%"></span>' +
            '</div>' +
            '<p class="st-wdl__legend"><span><i class="da-form__pill da-form__pill--G">G</i>' + r.won + '</span><span><i class="da-form__pill da-form__pill--B">B</i>' + r.drawn + '</span><span><i class="da-form__pill da-form__pill--M">M</i>' + r.lost + '</span>' +
            '<span class="st-wdl__clean">' + r.cleanSheets + ' maçta gol yemedi</span></p>' +
            '<div class="st-card__chart"><p class="st-card__label">Sıralama geçmişi</p><div data-card-chart style="min-height:120px"></div></div>';

        if (live) {
            html += '<a class="st-card__match is-live" href="' + DA.matchUrl(live.id) + '"><span class="st-card__label"><i class="da-pulse" aria-hidden="true"></i>Şu an sahada</span>' +
                '<span class="st-card__score">' + DA.crest(live.homeTeamName, live.homeTeamLogo, 'xs') + esc(live.homeTeamName) + ' <b>' + live.homeScore + '-' + live.awayScore + '</b> ' + esc(live.awayTeamName) + DA.crest(live.awayTeamName, live.awayTeamLogo, 'xs') + '</span>' +
                '<span class="st-card__when" data-live-text="' + live.id + '">' + esc(DA.liveClock(live).text) + '</span></a>';
        } else if (next) {
            var home = next.homeTeamId === r.id;
            var opp = home ? next.awayTeamName : next.homeTeamName;
            var oppLogo = home ? next.awayTeamLogo : next.homeTeamLogo;
            html += '<a class="st-card__match" href="' + DA.matchUrl(next.id) + '"><span class="st-card__label">Sıradaki maç</span>' +
                '<span class="st-card__score">' + DA.crest(opp, oppLogo, 'sm') + '<strong>' + (home ? '' : '@ ') + esc(opp) + '</strong><small>' + (home ? 'İç saha' : 'Deplasman') + '</small></span>' +
                '<span class="st-card__when">' + esc(DA.when(next.matchDate)) + '</span></a>';
        }
        if (last.length) {
            html += '<ul class="st-card__last">' + last.map(function (m) {
                var res = L.outcomeFor(m, r.id);
                var h = m.homeTeamId === r.id;
                var o = h ? m.awayTeamName : m.homeTeamName;
                return '<li><a href="' + DA.matchUrl(m.id) + '"><i class="da-form__pill da-form__pill--' + res + '">' + res + '</i>' +
                    '<span>' + (h ? 'vs ' : '@ ') + esc(o) + '</span><b>' + m.homeScore + '-' + m.awayScore + '</b><small>' + m.week + '. hf</small></a></li>';
            }).join('') + '</ul>';
        }
        html += '<a class="da-link st-card__more" href="' + DA.clubUrl(r.id) + '">Kulüp sayfası<svg aria-hidden="true"><use href="#i-arrow"/></svg></a>';
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
       7. Puan merdiveni: dikey ölçek, aynı puandakiler yan yana
       --------------------------------------------------------- */
    function renderLadder(rows) {
        if (!rows.length) { els.ladder.innerHTML = ''; return; }
        var max = Math.max.apply(null, rows.map(function (r) { return r.points; }).concat([3]));
        var min = Math.min.apply(null, rows.map(function (r) { return r.points; }));
        var span = Math.max(3, max - min);
        var groups = {};
        rows.forEach(function (r) { (groups[r.points] = groups[r.points] || []).push(r); });
        var n = rows.length;
        var ticks = C.niceScale(span, 4);
        var html = '<div class="st-ladder__axis" aria-hidden="true">';
        for (var t = min; t <= max + 0.01; t += ticks.step) {
            var y = (1 - (t - min) / span) * 100;
            html += '<span class="st-ladder__tick" style="--y:' + y.toFixed(2) + '%"><b>' + Math.round(t) + '</b></span>';
        }
        html += '</div><div class="st-ladder__track">';
        Object.keys(groups).forEach(function (pts) {
            var list = groups[pts];
            var y = (1 - (Number(pts) - min) / span) * 100;
            html += '<div class="st-ladder__step" style="--y:' + y.toFixed(2) + '%">' +
                '<span class="st-ladder__pts">' + pts + '</span>' +
                list.map(function (r, i) {
                    var z = L.zone(r.rank, n);
                    return '<button type="button" class="st-ladder__team' + (z ? ' zone-' + z : '') + (state.selected === r.id ? ' is-selected' : '') + '" data-ladder-team="' + r.id + '" style="--k:' + i + '" title="' + esc(r.rank + '. ' + r.name + ' · ' + r.points + ' P') + '" aria-label="' + esc(r.rank + '. ' + r.name + ', ' + r.points + ' puan') + '">' +
                        DA.crest(r.name, r.logoUrl, 'sm') + '</button>';
                }).join('') +
                '</div>';
        });
        html += '</div>';
        els.ladder.innerHTML = html;
    }

    els.ladder.addEventListener('click', function (e) {
        var b = e.target.closest('[data-ladder-team]');
        if (!b) return;
        var id = Number(b.getAttribute('data-ladder-team'));
        selectTeam(id, false);
        var tr = $('tr[data-team="' + id + '"]', els.rows);
        if (tr) {
            if (tr.hidden) {
                state.zone = 'all';
                state.query = '';
                els.search.value = '';
                $$('[data-zone]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-zone') === 'all')); });
                applyFilters();
            }
            tr.scrollIntoView({ block: 'center', behavior: DA.reduceMotion ? 'auto' : 'smooth' });
            DA.pulse(tr, 'is-changed');
        }
    });

    // Tablo satırı ile merdivendeki arma birlikte parlar
    function linkHover(id, on) {
        var tr = $('tr[data-team="' + id + '"]', els.rows);
        var m = $('[data-ladder-team="' + id + '"]', els.ladder);
        if (tr) tr.classList.toggle('is-hover', on);
        if (m) m.classList.toggle('is-hover', on);
    }
    els.rows.addEventListener('pointerover', function (e) {
        var tr = e.target.closest('tr[data-team]');
        if (tr) linkHover(tr.getAttribute('data-team'), true);
    });
    els.rows.addEventListener('pointerout', function (e) {
        var tr = e.target.closest('tr[data-team]');
        if (tr) linkHover(tr.getAttribute('data-team'), false);
    });
    els.ladder.addEventListener('pointerover', function (e) {
        var b = e.target.closest('[data-ladder-team]');
        if (b) linkHover(b.getAttribute('data-ladder-team'), true);
    });
    els.ladder.addEventListener('pointerout', function (e) {
        var b = e.target.closest('[data-ladder-team]');
        if (b) linkHover(b.getAttribute('data-ladder-team'), false);
    });

    /* ---------------------------------------------------------
       8. Sezon yolculuğu
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
            return '<button type="button" class="st-tchip' + (sel ? ' is-on' : '') + '" data-chip="' + r.id + '" aria-pressed="' + !!sel + '"' +
                (sel ? ' style="--c:' + sel.color + '"' : '') + '>' + DA.crest(r.name, r.logoUrl, 'xs') + '<span>' + esc(r.name) + '</span></button>';
        }).join('');
    }

    els.picker.addEventListener('click', function (e) {
        var chip = e.target.closest('[data-chip]');
        if (!chip) return;
        var id = Number(chip.getAttribute('data-chip'));
        var idx = state.chartTeams.map(function (t) { return t.id; }).indexOf(id);
        if (idx >= 0) {
            if (state.chartTeams.length === 1) { DA.toast('Grafikte en az bir takım kalmalı.', 'info', { duration: 3000 }); return; }
            state.chartTeams.splice(idx, 1);
        } else {
            if (state.chartTeams.length >= 6) { DA.toast('En fazla altı takım karşılaştırılabilir. Önce birini çıkar.', 'info', { duration: 3500 }); return; }
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
        var fresh = els.chart.cloneNode(false);
        els.chart.parentNode.replaceChild(fresh, els.chart);
        els.chart = fresh;
        if (!race.weeks.length) {
            els.chart.innerHTML = '<p class="tm-chart__empty">İlk hafta tamamlanınca sezon yolculuğu burada çizilir.</p>';
            return;
        }
        var idx = L.teamIndex(data.teams);
        var rank = state.chartMode === 'rank';
        els.raceSub.textContent = rank
            ? 'Seçili takımların hafta sonundaki sırası (1 en üstte). En fazla altı takım seçebilirsin.'
            : 'Seçili takımların hafta sonundaki puanı. En fazla altı takım seçebilirsin.';
        var series = state.chartTeams.map(function (t) {
            return { id: t.id, name: idx[t.id] ? idx[t.id].name : '?', color: t.color, values: (rank ? race.ranks : race.points)[t.id] || [] };
        });
        var n = data.teams.length;
        var opts = {
            height: 360,
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
        C.line(els.chart, opts);
    }

    /* ---------------------------------------------------------
       9. Canlı güncellemeler ve başlat
       --------------------------------------------------------- */
    DA.on('data', function (d) {
        data = d;
        var fk = DA.finishedKey();
        var wasLatest = atLatest();
        if (fk !== state.finishedKey) {
            state.finishedKey = fk;
            race = L.race(data.teams, data.matches);
            if (wasLatest || state.weekIndex > lastIndex()) state.weekIndex = lastIndex();
            setWeekUi();
            renderPicker();
            renderChart();
        }
        renderHead();
        renderLeaders();
        renderTable(true);
    });

    DA.on('goal', function (evt) {
        window.setTimeout(function () {
            var side = evt.side === 'home' ? evt.match.homeTeamId : evt.match.awayTeamId;
            DA.pulse($('tr[data-team="' + side + '"]', els.rows), 'is-goal');
        }, 900);
    });

    var initial = L.table(data.teams, data.matches).slice(0, 4);
    initial.forEach(function (r, i) { state.chartTeams.push({ id: r.id, color: C.palette[i] }); });
    state.finishedKey = DA.finishedKey();
    els.includeLive.checked = true;
    setWeekUi();
    renderHead();
    renderLeaders();
    renderTable(false);
    renderPicker();
    renderChart();

    // ?team=5 ile gelindiyse o takım seçili açılır
    var pre = Number(DA.params().get('team'));
    if (pre && data.teams.some(function (t) { return t.id === pre; })) selectTeam(pre, false);
})();
