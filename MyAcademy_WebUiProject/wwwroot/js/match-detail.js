/* =================================================================
   Doksan Artı — maç merkezi (match-detail.js)
   1  Durum ve yardımcılar
   2  Skor sahnesi: takımlar, LED skor, dakika ve zaman çizgisi, geri sayım
   3  Kazanma ihtimali: Poisson modeli, beklenen gol, olası skorlar
   4  Canlı akış: bu sayfa açıkken yaşanan anlar
   5  Form: iki takımın son beş maçı
   6  Karşılaştırma: sezon rakamları yan yana
   7  Tabloya etkisi: önce / sonra, senaryolar
   8  Aradaki maçlar ve haftanın diğer maçları
   9  Sekmeler, canlı güncellemeler ve başlat
   10 Paylaşılabilir maç kartı
   11 Sinematik maç özeti (scroll hikaye)
   12 Maç tüneli: sahaya çıkış
   13 Maç özeti videosu (canvas + Web Audio + MediaRecorder)
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
    var id = window.DA_MATCH;
    var data = DA.getData();

    function find() { return data.matches.filter(function (x) { return x.id === id; })[0] || null; }

    var m = find();
    if (!m) return;

    var dInfo = DA.derby(m.homeTeamName, m.awayTeamName);

    var els = {
        hero: $('[data-hero]'),
        board: $('[data-board]'),
        facts: $('[data-facts]'),
        marks: $('[data-marks]'),
        tabs: $('[data-tabs]'),
        prob: $('[data-prob]'),
        feed: $('[data-feed]'),
        feedTab: $('[data-feed-tab]'),
        form: $('[data-form]'),
        compare: $('[data-compare]'),
        impact: $('[data-impact]'),
        h2h: $('[data-h2h]'),
        week: $('[data-week]')
    };

    var state = { mode: '', countdown: null, boards: null, finishedKey: '', title: document.title };

    function mode() {
        if (L.isLive(m)) return 'live';
        if (L.isFinished(m)) return 'done';
        if (m.status === L.POSTPONED) return 'post';
        if (m.status === L.PLANNED && DA.toDate(m.matchDate).getTime() + 2 * 3600000 < Date.now()) return 'late';
        return 'plan';
    }

    function colors() {
        return { h: DA.clubColors(m.homeTeamName), a: DA.clubColors(m.awayTeamName) };
    }

    function rowOf(rows, teamId) { return rows.filter(function (r) { return r.id === teamId; })[0] || null; }

    function pctText(v) { return Math.round(v * 100); }

    function panelHead(title, sub, extra) {
        return '<header class="da-panel__head"><div><h2 class="da-panel__title">' + title + '</h2>' +
            (sub ? '<p class="da-panel__sub">' + sub + '</p>' : '') + '</div>' + (extra || '') + '</header>';
    }

    /* ---------------------------------------------------------
       2. Skor sahnesi
       --------------------------------------------------------- */
    function formPills(teamId) {
        var list = L.teamMatches(data.matches, teamId).filter(L.isFinished);
        if (mode() === 'done') {
            var kick = DA.toDate(m.matchDate).getTime();
            list = list.filter(function (x) { return x.id === m.id || DA.toDate(x.matchDate).getTime() <= kick; });
        }
        var pills = list.slice(-5).map(function (x) {
            var r = L.outcomeFor(x, teamId);
            return '<i class="da-form__pill da-form__pill--' + r + '" title="' + esc(x.homeTeamName + ' ' + x.homeScore + '-' + x.awayScore + ' ' + x.awayTeamName) + '">' + r + '</i>';
        });
        while (pills.length < 5) pills.unshift('<i class="da-form__pill da-form__pill--none" aria-hidden="true"></i>');
        return '<span class="da-form">' + pills.join('') + '</span>';
    }

    function teamBlock(side) {
        var tid = side === 'home' ? m.homeTeamId : m.awayTeamId;
        var name = side === 'home' ? m.homeTeamName : m.awayTeamName;
        var logo = side === 'home' ? m.homeTeamLogo : m.awayTeamLogo;
        var row = rowOf(L.table(data.teams, data.matches), tid);
        var md = mode();
        var won = md === 'done' && ((side === 'home' && m.homeScore > m.awayScore) || (side === 'away' && m.awayScore > m.homeScore));
        return '<div class="md-team md-team--' + side + (won ? ' is-winner' : '') + '">' +
            '<a class="md-team__crest" href="' + DA.clubUrl(tid) + '">' + DA.crest(name, logo, 'xxl') + '</a>' +
            '<a class="md-team__name" href="' + DA.clubUrl(tid) + '">' + esc(name) + '</a>' +
            '<span class="md-team__meta">' + (side === 'home' ? 'Ev sahibi' : 'Deplasman') + (row && row.played ? ' · ' + row.rank + '. sıra · ' + row.points + ' P' : '') + '</span>' +
            formPills(tid) +
            '</div>';
    }

    function centerBlock() {
        var md = mode();
        var d = DA.toDate(m.matchDate);
        if (md === 'live' || md === 'done') {
            var c = DA.liveClock(m);
            var result = '';
            if (md === 'done') {
                result = m.homeScore > m.awayScore ? esc(m.homeTeamName) + ' kazandı' : m.homeScore < m.awayScore ? esc(m.awayTeamName) + ' kazandı' : 'Berabere bitti';
            }
            return '<div class="md-center is-' + md + '">' +
                (md === 'live'
                    ? '<span class="da-state da-state--live"><i class="da-pulse" aria-hidden="true"></i>Canlı</span>'
                    : '<span class="da-state da-state--done">Maç sonu</span>') +
                '<div class="md-score" aria-label="Skor ' + (m.homeScore || 0) + ' - ' + (m.awayScore || 0) + '">' +
                '<span class="da-board md-score__board"><span class="da-led da-led--xl" data-score="home"></span></span>' +
                '<span class="md-score__sep" aria-hidden="true"><i></i><i></i></span>' +
                '<span class="da-board md-score__board"><span class="da-led da-led--xl" data-score="away"></span></span>' +
                '</div>' +
                (md === 'live'
                    ? '<div class="md-clock"><span class="da-board da-board--plain md-clock__board"><span class="da-led da-led--sm" data-minute-led></span></span><span class="md-clock__phase" data-phase>' + esc(c.label) + '</span></div>' +
                    '<div class="md-timeline" aria-hidden="true"><span class="md-timeline__fill" data-tl style="--p:' + (Math.min(90, c.minute) / 90 * 100).toFixed(1) + '%"></span><i class="md-timeline__ht"></i>' +
                    '<span class="md-timeline__labels"><b>0\'</b><b>45\'</b><b>90\'</b></span></div>'
                    : '<p class="md-center__result">' + result + '</p>') +
                '</div>';
        }
        if (md === 'plan') {
            return '<div class="md-center is-plan">' +
                '<span class="da-state da-state--plan">Başlama saatine</span>' +
                '<div class="md-count" data-countdown>' +
                ['d', 'h', 'm', 's'].map(function (k) {
                    var label = { d: 'gün', h: 'saat', m: 'dakika', s: 'saniye' }[k];
                    return '<div><span class="da-board da-board--plain"><span class="da-led da-led--md" data-cd="' + k + '"></span></span><small>' + label + '</small></div>';
                }).join('') +
                '</div>' +
                '<p class="md-center__result">' + esc(DA.fmt.dayLong.format(d)) + ' · ' + esc(DA.fmt.time.format(d)) + '</p>' +
                '</div>';
        }
        if (md === 'post') {
            return '<div class="md-center is-post"><span class="da-state da-state--post">Ertelendi</span>' +
                '<span class="da-board md-score__board"><span class="da-led da-led--xl" data-post-led></span></span>' +
                '<p class="md-center__result">Yeni tarih açıklanınca geri sayım burada başlar.</p></div>';
        }
        return '<div class="md-center is-late"><span class="da-state da-state--late">Sonuç bekleniyor</span>' +
            '<span class="md-center__vs">VS</span>' +
            '<p class="md-center__result">Maç saati geçti, skor henüz girilmedi. Girildiği an burada belirir.</p></div>';
    }

    function renderHero(animate) {
        var md = mode();
        var col = colors();
        state.mode = md;
        if (state.countdown) { state.countdown.stop(); state.countdown = null; }
        els.hero.style.setProperty('--ha', col.h.a);
        els.hero.style.setProperty('--aa', col.a.a);
        els.hero.setAttribute('data-mode', md);
        els.hero.classList.toggle('is-derby', !!dInfo);
        var dEl = $('[data-derby]', els.hero);
        if (dEl) {
            dEl.hidden = !dInfo;
            if (dInfo) { var dt = $('[data-derby-text]', dEl); if (dt) dt.textContent = dInfo.label; }
        }

        els.marks.innerHTML =
            '<span class="md-mark md-mark--home">' + DA.crest(m.homeTeamName, m.homeTeamLogo, 'xxl') + '</span>' +
            '<span class="md-mark md-mark--away">' + DA.crest(m.awayTeamName, m.awayTeamLogo, 'xxl') + '</span>';

        els.board.innerHTML = teamBlock('home') + centerBlock() + teamBlock('away');

        if (md === 'live' || md === 'done') {
            var tone = md === 'live' ? 'green' : 'white';
            state.boards = {
                h: m.homeScore || 0,
                a: m.awayScore || 0,
                home: DA.led($('[data-score="home"]', els.board), String(m.homeScore || 0), tone, animate ? 420 : false),
                away: DA.led($('[data-score="away"]', els.board), String(m.awayScore || 0), tone, animate ? 420 : false)
            };
            if (md === 'live') tickMinute(true);
        } else if (md === 'plan') {
            state.countdown = DA.countdown($('[data-countdown]', els.board), m.matchDate, function () { DA.loadData(); });
        } else if (md === 'post') {
            DA.led($('[data-post-led]', els.board), 'ERT', 'amber', animate);
        }
        $$('.md-team__crest', els.board).forEach(function (el) { DA.tilt(el, 14); });

        var d = DA.toDate(m.matchDate);
        var facts = [
            '<li><svg aria-hidden="true"><use href="#i-pin"/></svg>' + esc(m.stadium || '-') + '</li>',
            '<li><svg aria-hidden="true"><use href="#i-calendar"/></svg>' + esc(DA.fmt.dayLong.format(d)) + '</li>',
            '<li><svg aria-hidden="true"><use href="#i-clock"/></svg>' + esc(DA.fmt.time.format(d)) + (DA.romeTime ? ' <small>(Roma ' + esc(DA.romeTime.format(d)) + ')</small>' : '') + '</li>',
            '<li><svg aria-hidden="true"><use href="#i-trophy"/></svg>Serie A · ' + m.week + '. hafta</li>'
        ];
        els.facts.innerHTML = facts.join('');
        updateTitle();
    }

    function tickMinute(first) {
        if (mode() !== 'live') return;
        var c = DA.liveClock(m);
        var ledEl = $('[data-minute-led]', els.board);
        if (ledEl && ledEl.getAttribute('data-text') !== c.text) {
            ledEl.setAttribute('data-text', c.text);
            DA.led(ledEl, c.text, 'red', !first);
        }
        var ph = $('[data-phase]', els.board);
        if (ph) ph.textContent = c.label;
        var tl = $('[data-tl]', els.board);
        if (tl) tl.style.setProperty('--p', (Math.min(90, c.minute) / 90 * 100).toFixed(1) + '%');
    }

    // Skor değişti ama durum aynı: sadece dönen rakam yanar
    function updateScore() {
        if (!state.boards) return;
        var changed = false;
        if ((m.homeScore || 0) !== state.boards.h) {
            state.boards.h = m.homeScore || 0;
            DA.led($('[data-score="home"]', els.board), String(state.boards.h), 'green', 360);
            DA.pulse($('[data-score="home"]', els.board).closest('.da-board'), 'is-goal');
            changed = true;
        }
        if ((m.awayScore || 0) !== state.boards.a) {
            state.boards.a = m.awayScore || 0;
            DA.led($('[data-score="away"]', els.board), String(state.boards.a), 'green', 360);
            DA.pulse($('[data-score="away"]', els.board).closest('.da-board'), 'is-goal');
            changed = true;
        }
        if (changed) {
            $('.md-score', els.board).setAttribute('aria-label', 'Skor ' + state.boards.h + ' - ' + state.boards.a);
            updateTitle();
        }
    }

    function updateTitle() {
        var scored = (L.isLive(m) || L.isFinished(m)) && DA.hasScore(m);
        document.title = (L.isLive(m) ? '● ' : '') + m.homeTeamName + (scored ? ' ' + m.homeScore + '-' + m.awayScore + ' ' : ' - ') + m.awayTeamName + ' – Doksan Artı';
    }

    /* ---------------------------------------------------------
       3. Kazanma ihtimali
       --------------------------------------------------------- */
    function momentumValue() {
        var mn = (DA.liveClock(m).minute || 0);
        var seed = (m.id || 1) * 97 + mn * 13;
        var wave = Math.sin(seed * 0.21) * 0.22 + Math.sin(seed * 0.07 + 1.7) * 0.12;
        var diff = (m.homeScore || 0) - (m.awayScore || 0);
        var tilt = diff === 0 ? 0 : (diff > 0 ? -1 : 1) * Math.min(0.18, Math.abs(diff) * 0.07);
        var boost = 0;
        if (lastGoal) {
            var age = Date.now() - lastGoal.at;
            var win = 95000;
            if (age < win) boost = (lastGoal.side === 'home' ? 1 : -1) * 0.55 * (1 - age / win);
        }
        return Math.max(-1, Math.min(1, wave + tilt + boost));
    }

    function momentumHtml() {
        var v = momentumValue();
        var side = v > 0.04 ? 'home' : v < -0.04 ? 'away' : 'mid';
        var col = colors();
        var mc = side === 'home' ? col.h.a : side === 'away' ? col.a.a : '#8E9BB5';
        var left = v >= 0 ? 50 : 50 + v * 50;
        var width = Math.abs(v) * 50;
        var pulse = lastGoal && (Date.now() - lastGoal.at) < 6000 ? ' is-pulse' : '';
        var lbl = side === 'home' ? m.homeTeamName : side === 'away' ? m.awayTeamName : 'Dengeli';
        return '<div class="md-momentum' + pulse + '" role="img" aria-label="' + esc('Momentum: ' + lbl) + '">' +
            '<div class="md-momentum__label"><span>' + esc(m.homeTeamName) + '</span><span>Momentum</span><span>' + esc(m.awayTeamName) + '</span></div>' +
            '<div class="md-momentum__track"><span class="md-momentum__mid"></span><span class="md-momentum__fill" style="left:' + left.toFixed(1) + '%;width:' + width.toFixed(1) + '%;--mc:' + mc + '"></span></div>' +
            '</div>';
    }

    function renderProb() {
        var md = mode();
        if (md === 'post') {
            els.prob.innerHTML = panelHead('Kazanma ihtimali', 'Maç ertelendi; yeni tarih belli olunca tahmin yeniden hesaplanır.');
            return;
        }
        var p = DA.predict(m, { live: md === 'live', before: md === 'done' });
        var col = colors();
        var h = pctText(p.home), d = pctText(p.draw), a = Math.max(0, 100 - h - d);
        var title = md === 'live' ? 'Canlı kazanma ihtimali' : md === 'done' ? 'Maç öncesi tahmin' : 'Kazanma ihtimali';
        var sub = md === 'live'
            ? 'Şu anki skor ve kalan süreye göre, her golde yeniden hesaplanır.'
            : md === 'done'
                ? 'Maçtan önceki sonuçlara göre modelin beklentisi ve gerçekleşen sonuç.'
                : 'İki takımın bu sezon attığı ve yediği gollere göre hesaplanır.';

        var verdict = '';
        if (md === 'done') {
            var actual = m.homeScore > m.awayScore ? 'home' : m.homeScore < m.awayScore ? 'away' : 'draw';
            var chance = p[actual];
            var fav = p.home >= p.away && p.home >= p.draw ? 'home' : p.away >= p.draw ? 'away' : 'draw';
            var label;
            if (actual === fav) label = 'Beklenen sonuç';
            else if (chance < 0.25) label = actual === 'draw' ? 'Sürpriz beraberlik' : 'Sürpriz sonuç';
            else if (actual === 'draw') label = 'Puanlar paylaşıldı';
            else if (p[fav] > 0.45) label = 'Favori kaybetti';
            else label = 'Dengeli maçta ince fark';
            verdict = '<p class="md-verdict' + (chance < 0.25 ? ' is-surprise' : '') + '"><svg aria-hidden="true"><use href="#i-' + (chance < 0.25 ? 'fire' : 'target') + '"/></svg>' +
                '<strong>' + label + '</strong> Model bu sonuca maçtan önce %' + pctText(chance) + ' ihtimal veriyordu.</p>';
        }

        var actualKey = (md === 'done' || md === 'live') ? (m.homeScore || 0) + '-' + (m.awayScore || 0) : null;
        var lines = p.top.map(function (x, i) {
            var key = x.h + '-' + x.a;
            var cls = x.h > x.a ? 'is-home' : x.h < x.a ? 'is-away' : 'is-draw';
            return '<li class="md-line ' + cls + (key === actualKey ? ' is-actual' : '') + '" style="--i:' + i + ';--w:' + (x.p / p.top[0].p * 100).toFixed(0) + '%">' +
                '<b>' + key + '</b><span class="md-line__bar"><i></i></span><small>%' + (x.p * 100).toFixed(x.p < 0.1 ? 1 : 0).replace('.', ',') + '</small>' +
                (key === actualKey ? '<em>' + (md === 'live' ? 'şu an' : 'sonuç') + '</em>' : '') + '</li>';
        }).join('');

        els.prob.innerHTML = panelHead(title, sub, md === 'live' ? '<span class="da-state da-state--live"><i class="da-pulse" aria-hidden="true"></i>Canlı</span>' : '') +
            '<div class="da-panel__body">' +
            '<div class="md-probbar" role="img" aria-label="' + esc(m.homeTeamName + ' %' + h + ', beraberlik %' + d + ', ' + m.awayTeamName + ' %' + a) + '">' +
            '<span class="md-probbar__seg" style="--w:' + h + ';--c:' + col.h.a + '"><b>%' + h + '</b><small>' + esc(m.homeTeamName) + '</small></span>' +
            '<span class="md-probbar__seg is-draw" style="--w:' + d + '"><b>%' + d + '</b><small>Beraberlik</small></span>' +
            '<span class="md-probbar__seg is-away" style="--w:' + a + ';--c:' + col.a.a + '"><b>%' + a + '</b><small>' + esc(m.awayTeamName) + '</small></span>' +
            '</div>' + (md === 'live' ? momentumHtml() : '') + verdict +
            '<div class="md-probgrid">' +
            '<div class="md-xg"><p class="md-sublabel">' + (md === 'live' ? 'Kalan sürede beklenen gol' : 'Beklenen gol') + '</p>' +
            '<div class="md-xg__row"><span>' + DA.crest(m.homeTeamName, m.homeTeamLogo, 'sm') + '<b>' + C.fmt(p.lh * (md === 'live' ? Math.max(0.03, (93 - p.minute) / 93) : 1), 2) + '</b></span>' +
            '<i>—</i><span><b>' + C.fmt(p.la * (md === 'live' ? Math.max(0.03, (93 - p.minute) / 93) : 1), 2) + '</b>' + DA.crest(m.awayTeamName, m.awayTeamLogo, 'sm') + '</span></div>' +
            '<p class="md-note">Hücum ve savunma gücü, lig ortalamasına göre; az maç oynamış takımlar ortalamaya doğru çekilir.</p></div>' +
            '<div class="md-lines"><p class="md-sublabel">En olası skorlar</p><ol>' + lines + '</ol></div>' +
            '</div></div>';
    }

    /* ---------------------------------------------------------
       4. Canlı akış (oturum boyunca saklanır)
       --------------------------------------------------------- */
    var FEED_KEY = 'da-feed-' + id;
    var lastGoal = null;

    function loadFeed() {
        try { return JSON.parse(window.sessionStorage.getItem(FEED_KEY) || '[]'); } catch (e) { return []; }
    }

    function saveFeed(list) {
        try { window.sessionStorage.setItem(FEED_KEY, JSON.stringify(list.slice(0, 40))); } catch (e) { /* depolama kapalı olabilir */ }
    }

    var feed = loadFeed();

    function addFeed(item) {
        item.at = Date.now();
        feed.unshift(item);
        saveFeed(feed);
        renderFeed(true);
    }

    function renderFeed(fresh) {
        var md = mode();
        var show = feed.length > 0 || md === 'live';
        els.feed.hidden = !show;
        els.feedTab.hidden = !show;
        if (!show) return;
        var icons = { goal: 'i-ball', kickoff: 'i-whistle', fulltime: 'i-whistle', correction: 'i-x', watch: 'i-live' };
        var list = feed.length ? feed.map(function (f, i) {
            return '<li class="md-ev md-ev--' + f.type + (fresh && i === 0 ? ' is-new' : '') + '"' + (f.color ? ' style="--tc:' + f.color + '"' : '') + '>' +
                '<span class="md-ev__min">' + esc(f.minute || '') + '</span>' +
                '<span class="md-ev__icon"><svg aria-hidden="true"><use href="#' + (icons[f.type] || 'i-live') + '"/></svg></span>' +
                '<span class="md-ev__text"><strong>' + esc(f.title) + '</strong>' + (f.text ? '<small>' + esc(f.text) + '</small>' : '') + '</span>' +
                (f.score ? '<b class="md-ev__score">' + esc(f.score) + '</b>' : '') +
                '</li>';
        }).join('') : '<li class="md-ev md-ev--empty"><span class="md-ev__icon"><svg aria-hidden="true"><use href="#i-live"/></svg></span><span class="md-ev__text"><strong>Maç canlı</strong><small>Bu sayfa açıkken atılan goller dakikasıyla burada sıralanır.</small></span></li>';
        els.feed.innerHTML = panelHead('Canlı akış', 'Bu sayfa açıkken yaşanan anlar, en yenisi üstte.', md === 'live' ? '<span class="da-state da-state--live"><i class="da-pulse" aria-hidden="true"></i><span data-live-text="' + m.id + '">' + esc(DA.liveClock(m).text) + '</span></span>' : '') +
            '<ol class="md-feed__list">' + list + '</ol>';
    }

    DA.on('goal', function (evt) {
        if (evt.match.id !== id) return;
        var team = evt.side === 'home' ? evt.match.homeTeamName : evt.match.awayTeamName;
        lastGoal = { side: evt.side, at: Date.now() };
        addFeed({
            type: 'goal', minute: DA.liveClock(evt.match).text, title: 'GOL! ' + team,
            text: evt.side === 'home' ? 'Ev sahibi skoru buldu' : 'Konuk takım skoru buldu',
            score: evt.match.homeScore + '-' + evt.match.awayScore, color: DA.clubColors(team).a, side: evt.side
        });
    });
    DA.on('kickoff', function (evt) {
        if (evt.match.id !== id) return;
        addFeed({ type: 'kickoff', minute: "1'", title: 'Maç başladı', text: evt.match.stadium || '' });
    });
    DA.on('fulltime', function (evt) {
        if (evt.match.id !== id) return;
        addFeed({ type: 'fulltime', minute: 'MS', title: 'Maç sona erdi', text: evt.match.homeTeamName + ' ' + evt.match.homeScore + '-' + evt.match.awayScore + ' ' + evt.match.awayTeamName, score: evt.match.homeScore + '-' + evt.match.awayScore });
    });
    DA.on('correction', function (evt) {
        if (evt.match.id !== id) return;
        addFeed({ type: 'correction', minute: DA.liveClock(evt.match).text, title: 'Skor düzeltildi', text: 'Gol iptal edildi ya da skor yeniden girildi', score: (evt.match.homeScore || 0) + '-' + (evt.match.awayScore || 0) });
    });

    /* ---------------------------------------------------------
       5. Form
       --------------------------------------------------------- */
    function lastFive(teamId) {
        var list = L.teamMatches(data.matches, teamId).filter(function (x) { return L.isFinished(x) && x.id !== id; });
        if (mode() === 'done' || mode() === 'live') {
            var kick = DA.toDate(m.matchDate).getTime();
            list = list.filter(function (x) { return DA.toDate(x.matchDate).getTime() < kick; });
        }
        return list.slice(-5).reverse();
    }

    function formColumn(side) {
        var tid = side === 'home' ? m.homeTeamId : m.awayTeamId;
        var name = side === 'home' ? m.homeTeamName : m.awayTeamName;
        var logo = side === 'home' ? m.homeTeamLogo : m.awayTeamLogo;
        var list = lastFive(tid);
        var pts = list.reduce(function (s, x) { var r = L.outcomeFor(x, tid); return s + (r === 'G' ? 3 : r === 'B' ? 1 : 0); }, 0);
        var gf = 0, ga = 0;
        list.forEach(function (x) {
            var home = x.homeTeamId === tid;
            gf += home ? x.homeScore : x.awayScore;
            ga += home ? x.awayScore : x.homeScore;
        });
        return '<div class="md-formcol md-formcol--' + side + '" style="--tc:' + DA.clubColors(name).a + '">' +
            '<header class="md-formcol__head">' + DA.crest(name, logo, 'md') + '<div><strong>' + esc(name) + '</strong><small>Son ' + list.length + ' maç: ' + pts + ' puan · ' + gf + '-' + ga + ' gol</small></div>' +
            '<span class="md-formcol__pts" style="--p:' + (list.length ? pts / (list.length * 3) * 100 : 0).toFixed(0) + '%"><b>' + pts + '</b></span></header>' +
            (list.length ? '<ul class="md-formcol__list">' + list.map(function (x, i) {
                var r = L.outcomeFor(x, tid);
                var home = x.homeTeamId === tid;
                var opp = home ? x.awayTeamName : x.homeTeamName;
                var oppLogo = home ? x.awayTeamLogo : x.homeTeamLogo;
                return '<li style="--i:' + i + '"><a href="' + DA.matchUrl(x.id) + '">' +
                    '<i class="da-form__pill da-form__pill--' + r + '">' + r + '</i>' +
                    '<span class="md-formcol__opp">' + DA.crest(opp, oppLogo, 'xs') + '<span>' + (home ? 'vs ' : '@ ') + esc(opp) + '</span></span>' +
                    '<b>' + x.homeScore + '-' + x.awayScore + '</b><small>' + x.week + '. hf</small></a></li>';
            }).join('') + '</ul>' : '<p class="md-note md-note--pad">Henüz bitmiş maçı yok.</p>') +
            '</div>';
    }

    function renderForm() {
        els.form.innerHTML = panelHead('Form', 'İki takımın bu maçtan önceki son beş sonucu') +
            '<div class="md-formgrid">' + formColumn('home') + formColumn('away') + '</div>';
    }

    /* ---------------------------------------------------------
       6. Karşılaştırma
       --------------------------------------------------------- */
    function renderCompare() {
        var c = L.compare(data.teams, data.matches, m.homeTeamId, m.awayTeamId);
        var a = c.a, b = c.b;
        if (!a || !b || (!a.played && !b.played)) {
            els.compare.innerHTML = panelHead('Karşılaştırma', 'Takımlar maç oynadıkça sezon rakamları burada yan yana gelir.');
            return;
        }
        var col = colors();
        var rows = [
            ['Sıra', a.rank, b.rank, true, true, 0],
            ['Puan', a.points, b.points, false, false, 0],
            ['Galibiyet', a.won, b.won, false, false, 0],
            ['Attığı gol', a.gf, b.gf, false, false, 0],
            ['Yediği gol', a.ga, b.ga, true, false, 0],
            ['Averaj', a.gd, b.gd, false, false, 0],
            ['Gol yemeden', a.cleanSheets, b.cleanSheets, false, false, 0],
            ['Puan / maç', a.ppg, b.ppg, false, false, 2],
            ['Saha puanı', c.aHome ? c.aHome.points : 0, c.bAway ? c.bAway.points : 0, false, false, 0, 'Ev sahibinin iç sahada, konuğun deplasmanda topladığı puan']
        ];
        var html = rows.map(function (r, i) {
            var va = r[1], vb = r[2], lower = r[3], noBar = r[4], dec = r[5];
            var max = Math.max(Math.abs(va), Math.abs(vb), 0.0001);
            var aw = lower ? va < vb : va > vb;
            var bw = lower ? vb < va : vb > va;
            var fa = (r[0] === 'Averaj' && va > 0 ? '+' : '') + C.fmt(va, dec);
            var fb = (r[0] === 'Averaj' && vb > 0 ? '+' : '') + C.fmt(vb, dec);
            return '<div class="md-cmp" style="--i:' + i + '">' +
                '<span class="md-cmp__v' + (aw ? ' is-win' : '') + '">' + fa + '</span>' +
                '<span class="md-cmp__bar md-cmp__bar--a"><i style="--w:' + (noBar ? 0 : Math.abs(va) / max * 100).toFixed(0) + '%;--c:' + col.h.a + '"></i></span>' +
                '<span class="md-cmp__label"' + (r[6] ? ' title="' + esc(r[6]) + '"' : '') + '>' + esc(r[0]) + (r[6] ? '<sup>?</sup>' : '') + '</span>' +
                '<span class="md-cmp__bar md-cmp__bar--b"><i style="--w:' + (noBar ? 0 : Math.abs(vb) / max * 100).toFixed(0) + '%;--c:' + col.a.a + '"></i></span>' +
                '<span class="md-cmp__v' + (bw ? ' is-win' : '') + '">' + fb + '</span>' +
                '</div>';
        }).join('');
        els.compare.innerHTML = panelHead('Karşılaştırma', 'Sezon rakamları yan yana; öndeki taraf parlar.') +
            '<div class="da-panel__body"><div class="md-cmphead">' +
            '<span>' + DA.crest(m.homeTeamName, m.homeTeamLogo, 'sm') + esc(m.homeTeamName) + '</span>' +
            '<span>' + esc(m.awayTeamName) + DA.crest(m.awayTeamName, m.awayTeamLogo, 'sm') + '</span></div>' +
            '<div class="md-cmplist" data-cmplist>' + html + '</div></div>';
        var list = $('[data-cmplist]', els.compare);
        if (DA.reduceMotion) list.classList.add('is-in');
        else C.whenVisible(list, function () { window.requestAnimationFrame(function () { list.classList.add('is-in'); }); });
    }

    /* ---------------------------------------------------------
       7. Tabloya etkisi
       --------------------------------------------------------- */
    function rankLine(teamId, name, logo, before, after, gain) {
        var diff = before.rank - after.rank;
        var arrow = diff > 0 ? '<span class="md-rk__move is-up"><svg aria-hidden="true"><use href="#i-up"/></svg>' + diff + '</span>'
            : diff < 0 ? '<span class="md-rk__move is-down"><svg aria-hidden="true"><use href="#i-down"/></svg>' + (-diff) + '</span>'
                : '<span class="md-rk__move">=</span>';
        return '<li class="md-rk"><a href="' + DA.clubUrl(teamId) + '">' + DA.crest(name, logo, 'md') + '<strong>' + esc(name) + '</strong></a>' +
            '<span class="md-rk__flow"><b>' + before.rank + '.</b><svg aria-hidden="true"><use href="#i-arrow"/></svg><b class="is-after">' + after.rank + '.</b></span>' +
            arrow + '<span class="md-rk__gain' + (gain > 0 ? ' is-pos' : '') + '">+' + gain + ' P</span></li>';
    }

    function renderImpact() {
        var md = mode();
        var head;
        if (md === 'post') {
            els.impact.innerHTML = panelHead('Tabloya etkisi', 'Maç ertelendiği için şimdilik tabloyu değiştirmiyor.');
            return;
        }
        if (md === 'done' || md === 'live') {
            var without = data.matches.filter(function (x) { return x.id !== id; });
            var before = L.table(data.teams, without);
            var after = md === 'done'
                ? L.table(data.teams, data.matches)
                : L.table(data.teams, data.matches, { overrides: (function () { var o = {}; o[id] = { home: m.homeScore || 0, away: m.awayScore || 0 }; return o; })() });
            var hb = rowOf(before, m.homeTeamId), ha = rowOf(after, m.homeTeamId);
            var ab = rowOf(before, m.awayTeamId), aa = rowOf(after, m.awayTeamId);
            head = panelHead('Tabloya etkisi', md === 'live' ? 'Maç bu skorla biterse sıralama böyle değişir.' : 'Bu sonuçtan önce ve sonra sıralama.');
            els.impact.innerHTML = head + '<ul class="md-rklist">' +
                rankLine(m.homeTeamId, m.homeTeamName, m.homeTeamLogo, hb, ha, ha.points - hb.points) +
                rankLine(m.awayTeamId, m.awayTeamName, m.awayTeamLogo, ab, aa, aa.points - ab.points) +
                '</ul><a class="da-link md-impact__more" href="/Standings">Puan durumu<svg aria-hidden="true"><use href="#i-arrow"/></svg></a>';
            return;
        }
        // Oynanmamış maç: üç senaryo
        var now = L.table(data.teams, data.matches);
        var sc = [['1', 1, 0], ['X', 1, 1], ['2', 0, 1]].map(function (s) {
            var o = {};
            o[id] = { home: s[1], away: s[2] };
            return { label: s[0], rows: L.table(data.teams, data.matches, { overrides: o }) };
        });
        function cells(teamId) {
            return sc.map(function (s) {
                var r = rowOf(s.rows, teamId);
                var cur = rowOf(now, teamId);
                var diff = cur.rank - r.rank;
                return '<td class="' + (diff > 0 ? 'is-up' : diff < 0 ? 'is-down' : '') + '"><b>' + r.rank + '.</b><small>' + r.points + ' P</small></td>';
            }).join('');
        }
        var hn = rowOf(now, m.homeTeamId), an = rowOf(now, m.awayTeamId);
        els.impact.innerHTML = panelHead('Tabloya etkisi', 'Üç olası sonuçta iki takımın yeni sırası (1: ev sahibi kazanır, X: berabere, 2: konuk kazanır).') +
            '<div class="md-scen"><table><thead><tr><th scope="col">Takım</th><th scope="col">Şimdi</th><th scope="col">1</th><th scope="col">X</th><th scope="col">2</th></tr></thead><tbody>' +
            '<tr><th scope="row">' + DA.crest(m.homeTeamName, m.homeTeamLogo, 'xs') + esc(m.homeTeamName) + '</th><td><b>' + hn.rank + '.</b><small>' + hn.points + ' P</small></td>' + cells(m.homeTeamId) + '</tr>' +
            '<tr><th scope="row">' + DA.crest(m.awayTeamName, m.awayTeamLogo, 'xs') + esc(m.awayTeamName) + '</th><td><b>' + an.rank + '.</b><small>' + an.points + ' P</small></td>' + cells(m.awayTeamId) + '</tr>' +
            '</tbody></table></div><a class="da-link md-impact__more" href="/Standings">Puan durumu<svg aria-hidden="true"><use href="#i-arrow"/></svg></a>';
    }

    /* ---------------------------------------------------------
       8. Aradaki maçlar, haftanın diğer maçları
       --------------------------------------------------------- */
    function miniRow(x, mark) {
        var scored = (L.isLive(x) || L.isFinished(x)) && DA.hasScore(x);
        return '<li><a class="md-mini' + (L.isLive(x) ? ' is-live' : '') + (mark ? ' is-this' : '') + '" href="' + DA.matchUrl(x.id) + '" data-mini="' + x.id + '">' +
            '<span class="md-mini__state">' + DA.stateChip(x) + '</span>' +
            '<span class="md-mini__team">' + DA.crest(x.homeTeamName, x.homeTeamLogo, 'xs') + '<span>' + esc(x.homeTeamName) + '</span></span>' +
            '<b class="md-mini__score">' + (scored ? x.homeScore + '-' + x.awayScore : '-') + '</b>' +
            '<span class="md-mini__team md-mini__team--away"><span>' + esc(x.awayTeamName) + '</span>' + DA.crest(x.awayTeamName, x.awayTeamLogo, 'xs') + '</span>' +
            '</a></li>';
    }

    function renderH2H() {
        var meetings = data.matches.filter(function (x) {
            return x.id !== id && ((x.homeTeamId === m.homeTeamId && x.awayTeamId === m.awayTeamId) || (x.homeTeamId === m.awayTeamId && x.awayTeamId === m.homeTeamId));
        }).sort(L.byDate);
        els.h2h.innerHTML = panelHead('Aradaki maçlar', 'Bu sezon iki takımın diğer karşılaşmaları') +
            (meetings.length
                ? '<ul class="md-minilist">' + meetings.map(function (x) { return miniRow(x, false); }).join('') + '</ul>'
                : '<p class="md-note md-note--pad">Bu sezon ilk karşılaşmaları. Rövanş fikstüre eklenince burada görünür.</p>');
    }

    function renderWeek() {
        var list = data.matches.filter(function (x) { return x.week === m.week; }).sort(L.byDate);
        els.week.innerHTML = panelHead(m.week + '. haftanın maçları', DA.weekRange(m.week) || '', '<a class="da-link" href="' + DA.fixturesUrl(m.week) + '">Fikstür<svg aria-hidden="true"><use href="#i-arrow"/></svg></a>') +
            '<ul class="md-minilist">' + list.map(function (x) { return miniRow(x, x.id === id); }).join('') + '</ul>';
    }

    /* ---------------------------------------------------------
       9. Sekmeler, canlı güncellemeler ve başlat
       --------------------------------------------------------- */
    function initTabs() {
        if (!('IntersectionObserver' in window)) return;
        var links = $$('[data-tab]', els.tabs);
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                var key = e.target.id;
                links.forEach(function (a) {
                    var on = a.getAttribute('data-tab') === key;
                    a.classList.toggle('is-active', on);
                    if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
                });
            });
        }, { rootMargin: '-35% 0px -55% 0px' });
        links.forEach(function (a) {
            var sec = document.getElementById(a.getAttribute('data-tab'));
            if (sec) io.observe(sec);
        });
    }

    function renderAll(animate) {
        renderHero(animate);
        renderProb();
        renderFeed(false);
        renderForm();
        renderCompare();
        renderImpact();
        renderH2H();
        renderWeek();
        state.finishedKey = DA.finishedKey();
    }

    DA.on('data', function (d) {
        data = d;
        var next = find();
        if (!next) {
            DA.toast('Bu maç fikstürden kaldırıldı.', 'warn');
            return;
        }
        m = next;
        if (mode() !== state.mode) {
            renderHero(true);
        } else {
            updateScore();
            tickMinute(false);
        }
        renderProb();
        renderFeed(false);
        renderImpact();
        renderWeek();
        var fk = DA.finishedKey();
        if (fk !== state.finishedKey) {
            state.finishedKey = fk;
            renderForm();
            renderCompare();
            renderH2H();
        }
    });

    DA.on('tick', function () {
        tickMinute(false);
        if (mode() === 'live') renderProb();
    });

    playTunnelIntro();
    renderAll(true);
    initTabs();

    // Canlı maça girildiğinde akışa bir "takip başladı" satırı (oturumda bir kez)
    if (mode() === 'live' && !feed.some(function (f) { return f.type === 'watch'; })) {
        feed.push({ type: 'watch', minute: DA.liveClock(m).text, title: 'Takip başladı', text: 'Skor o an ' + (m.homeScore || 0) + '-' + (m.awayScore || 0), at: Date.now() });
        saveFeed(feed);
        renderFeed(false);
    }

    /* ---------------------------------------------------------
       10. Paylaşılabilir maç kartı
       Logolar canvas'ı kirletebileceği (CORS) için harf rozeti çizilir —
       sitenin kendi "arma kırılırsa" düşme stiliyle aynı görünüm.
       --------------------------------------------------------- */
    function wrapCenterText(ctx, text, cx, y, maxWidth) {
        if (ctx.measureText(text).width <= maxWidth) { ctx.fillText(text, cx, y); return; }
        var words = text.split(' '), line1 = '', line2 = '';
        for (var i = 0; i < words.length; i++) {
            var test = (line1 ? line1 + ' ' : '') + words[i];
            if (ctx.measureText(test).width > maxWidth && line1) { line2 = words.slice(i).join(' '); break; }
            line1 = test;
        }
        if (line2) {
            ctx.fillText(line1, cx, y - 20);
            ctx.fillText(line2, cx, y + 20);
        } else {
            ctx.fillText(line1, cx, y);
        }
    }

    function badge(ctx, x, y, r, name, col) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        var grad = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
        grad.addColorStop(0, col.a);
        grad.addColorStop(1, col.b);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(255,255,255,.3)';
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = '800 ' + Math.round(r * 0.72) + 'px Barlow, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(DA.teamCode(name), x, y + 2);
        ctx.restore();
    }

    function buildShareCanvas() {
        var md = mode();
        var W = 1200, H = 630;
        var canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        var ctx = canvas.getContext('2d');
        var col = colors();

        ctx.fillStyle = '#060B18';
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.globalAlpha = .4;
        var gh = ctx.createRadialGradient(W * .16, H * .18, 10, W * .16, H * .18, 520);
        gh.addColorStop(0, col.h.a); gh.addColorStop(1, 'transparent');
        ctx.fillStyle = gh; ctx.fillRect(0, 0, W, H);
        var ga = ctx.createRadialGradient(W * .84, H * .85, 10, W * .84, H * .85, 520);
        ga.addColorStop(0, col.a.a); ga.addColorStop(1, 'transparent');
        ctx.fillStyle = ga; ctx.fillRect(0, 0, W, H);
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = .08;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(W / 2, H / 2 + 10, 150, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W / 2, 70); ctx.lineTo(W / 2, H - 70); ctx.stroke();
        ctx.restore();

        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.font = '600 24px "Barlow Condensed", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SERIE A · ' + m.week + '. HAFTA', W / 2, 62);

        badge(ctx, 290, 230, 76, m.homeTeamName, col.h);
        badge(ctx, 910, 230, 76, m.awayTeamName, col.a);

        ctx.fillStyle = '#F4F7FF';
        ctx.font = '700 32px Barlow, sans-serif';
        wrapCenterText(ctx, m.homeTeamName, 290, 345, 300);
        wrapCenterText(ctx, m.awayTeamName, 910, 345, 300);

        ctx.textBaseline = 'middle';
        if (md === 'live' || md === 'done') {
            ctx.font = '800 150px "Barlow Condensed", sans-serif';
            ctx.fillStyle = md === 'live' ? '#3BFF8F' : '#FFFFFF';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 26;
            ctx.fillText((m.homeScore || 0) + '  –  ' + (m.awayScore || 0), W / 2, 235);
            ctx.shadowBlur = 0;
            ctx.font = '700 22px "Barlow Condensed", sans-serif';
            ctx.fillStyle = md === 'live' ? '#FF4D6D' : 'rgba(255,255,255,.6)';
            ctx.fillText(md === 'live' ? (DA.liveClock(m).text + " · CANLI") : 'MAÇ SONU', W / 2, 300);
        } else {
            ctx.font = '800 86px "Barlow Condensed", sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,.85)';
            ctx.fillText('VS', W / 2, 230);
            ctx.font = '600 22px "Barlow Condensed", sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,.6)';
            var d = DA.toDate(m.matchDate);
            ctx.fillText(DA.fmt.dayLong.format(d) + ' · ' + DA.fmt.time.format(d), W / 2, 300);
        }

        ctx.textBaseline = 'alphabetic';
        ctx.font = '500 21px Barlow, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.fillText(m.stadium || '', W / 2, 560);

        ctx.textAlign = 'left';
        ctx.font = '800 25px "Barlow Condensed", sans-serif';
        ctx.fillStyle = '#F4F7FF';
        ctx.fillText('DOKSAN ARTI', 48, H - 38);
        ctx.textAlign = 'right';
        ctx.font = '500 17px Barlow, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,.4)';
        ctx.fillText('Serie A, son düdüğe kadar', W - 48, H - 38);

        return canvas;
    }

    function shareCard() {
        var btn = $('[data-share-match]');
        var run = function () {
            var canvas;
            try { canvas = buildShareCanvas(); }
            catch (e) { if (btn) { btn.disabled = false; btn.classList.remove('is-busy'); } DA.toast('Kart oluşturulamadı.', 'warn'); return; }
            canvas.toBlob(function (blob) {
                if (btn) { btn.disabled = false; btn.classList.remove('is-busy'); }
                if (!blob) { DA.toast('Kart oluşturulamadı.', 'warn'); return; }
                var fileName = 'doksan-arti-' + DA.teamCode(m.homeTeamName).toLowerCase() + '-' + DA.teamCode(m.awayTeamName).toLowerCase() + '.png';
                if (navigator.share && navigator.canShare) {
                    var file;
                    try { file = new File([blob], fileName, { type: 'image/png' }); } catch (e) { file = null; }
                    if (file && navigator.canShare({ files: [file] })) {
                        navigator.share({ files: [file], title: m.homeTeamName + ' - ' + m.awayTeamName, text: 'Doksan Artı' }).catch(function () { });
                        return;
                    }
                }
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url; a.download = fileName;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
                DA.toast('Maç kartı indirildi.', 'success');
            }, 'image/png');
        };
        if (btn) { btn.disabled = true; btn.classList.add('is-busy'); }
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(run, run);
        else run();
    }

    var shareBtn = $('[data-share-match]');
    if (shareBtn) shareBtn.addEventListener('click', shareCard);

    /* ---------------------------------------------------------
       11. Sinematik maç özeti (scroll hikaye)
       --------------------------------------------------------- */
    var storyEl = null, storyBuilt = false, storyLastFocus = null;

    function storyScenes() {
        var col = colors();
        var p = DA.predict(m, { before: true });
        var h = pctText(p.home), d = pctText(p.draw), a = Math.max(0, 100 - h - d);
        var fav = h >= a && h >= d ? 'home' : a >= d ? 'away' : 'draw';
        var favTxt = fav === 'home' ? m.homeTeamName : fav === 'away' ? m.awayTeamName : 'Beraberlik';
        var actual = m.homeScore > m.awayScore ? 'home' : m.homeScore < m.awayScore ? 'away' : 'draw';
        var chance = p[actual];
        var surprised = chance < 0.25;
        var winnerName = actual === 'home' ? m.homeTeamName : actual === 'away' ? m.awayTeamName : null;
        var dt = DA.toDate(m.matchDate);
        var meetings = data.matches.filter(function (x) {
            return x.id !== id && ((x.homeTeamId === m.homeTeamId && x.awayTeamId === m.awayTeamId) || (x.homeTeamId === m.awayTeamId && x.awayTeamId === m.homeTeamId));
        });

        return [
            {
                key: 'intro', cls: 'is-intro',
                html: '<p class="md-story__kicker">Serie A · ' + m.week + '. hafta</p>' +
                    '<div class="md-story__vs">' +
                    '<div class="md-story__crest">' + DA.crest(m.homeTeamName, m.homeTeamLogo, 'xxl') + '<b>' + esc(m.homeTeamName) + '</b></div>' +
                    '<span class="md-story__vstext">VS</span>' +
                    '<div class="md-story__crest">' + DA.crest(m.awayTeamName, m.awayTeamLogo, 'xxl') + '<b>' + esc(m.awayTeamName) + '</b></div>' +
                    '</div>' +
                    '<p class="md-story__sub">' + esc(DA.fmt.dayLong.format(dt)) + ' · ' + esc(DA.fmt.time.format(dt)) + (m.stadium ? ' · ' + esc(m.stadium) : '') + '</p>'
            },
            {
                key: 'predict', cls: 'is-predict',
                html: '<p class="md-story__kicker">Maçtan önce</p>' +
                    '<h2 class="md-story__h">Model ' + esc(favTxt) + (fav === 'draw' ? '’i bekliyordu' : '’i favori görüyordu') + '</h2>' +
                    '<div class="md-story__bar" style="--ch:' + col.h.a + ';--ca:' + col.a.a + '">' +
                    '<span class="is-h" style="--w:' + h + '">%' + h + '</span><span class="is-d" style="--w:' + d + '">%' + d + '</span><span class="is-a" style="--w:' + a + '">%' + a + '</span>' +
                    '</div>' +
                    '<p class="md-story__sub">' + esc(m.homeTeamName) + ' %' + h + ' · Beraberlik %' + d + ' · ' + esc(m.awayTeamName) + ' %' + a + '</p>'
            },
            {
                key: 'form', cls: 'is-form',
                html: '<p class="md-story__kicker">Form rüzgarı</p>' +
                    '<h2 class="md-story__h">Maça girerken son 5 maç</h2>' +
                    '<div class="md-story__formrow"><div><b>' + esc(m.homeTeamName) + '</b>' + formPills(m.homeTeamId) + '</div>' +
                    '<div><b>' + esc(m.awayTeamName) + '</b>' + formPills(m.awayTeamId) + '</div></div>' +
                    '<p class="md-story__sub">' + (meetings.length ? 'Bu sezon aradaki ' + (meetings.length + 1) + '. karşılaşma.' : 'Bu sezon ilk karşılaşmaları.') + '</p>'
            },
            {
                key: 'result', cls: 'is-result' + (surprised ? ' is-surprise' : ''), score: true,
                html: '<p class="md-story__kicker">Düdük çaldı</p>' +
                    '<div class="md-story__score" data-story-score data-hs="' + (m.homeScore || 0) + '" data-as="' + (m.awayScore || 0) + '">' +
                    '<span data-sc="h">0</span><span class="md-story__sep">-</span><span data-sc="a">0</span>' +
                    '</div>' +
                    '<p class="md-story__sub md-story__teams">' + esc(m.homeTeamName) + '<span>vs</span>' + esc(m.awayTeamName) + '</p>' +
                    '<p class="md-story__verdict">' + (surprised ? 'Sürpriz sonuç — model buna maçtan önce sadece %' + pctText(chance) + ' ihtimal veriyordu.' : (winnerName ? esc(winnerName) + ' beklenen galibiyeti aldı.' : 'Beklenen gibi puanlar paylaşıldı.')) + '</p>'
            },
            {
                key: 'recap', cls: 'is-recap',
                html: '<p class="md-story__kicker">Doksan Artı</p>' +
                    '<h2 class="md-story__h">Hikaye burada bitiyor</h2>' +
                    '<p class="md-story__sub">Maç kartını arkadaşlarınla paylaşabilir ya da maç merkezine dönebilirsin.</p>' +
                    '<div class="md-story__cta"><button type="button" class="da-btn da-btn--primary" data-story-share><svg aria-hidden="true"><use href="#i-share"/></svg>Kartı paylaş</button>' +
                    '<button type="button" class="da-btn" data-story-close-cta>Maç merkezine dön</button></div>'
            }
        ];
    }

    function buildStoryLayer() {
        if (storyEl) return storyEl;
        var el = document.createElement('div');
        el.className = 'md-story';
        el.hidden = true;
        el.innerHTML =
            '<div class="md-story__veil" aria-hidden="true"></div>' +
            '<button type="button" class="md-story__close" data-story-close aria-label="Kapat"><svg aria-hidden="true"><use href="#i-x"/></svg></button>' +
            '<div class="md-story__dots" data-story-dots></div>' +
            '<div class="md-story__scroll" data-story-scroll tabindex="-1"></div>' +
            '<button type="button" class="md-story__hint" data-story-hint aria-hidden="true"><svg aria-hidden="true"><use href="#i-chevd"/></svg>Kaydır</button>';
        document.body.appendChild(el);
        $('[data-story-close]', el).addEventListener('click', closeStory);
        storyEl = el;
        return el;
    }

    function animateStoryScore(scene) {
        if (!scene) return;
        var hs = +scene.getAttribute('data-hs'), as = +scene.getAttribute('data-as');
        var hEl = scene.querySelector('[data-sc="h"]'), aEl = scene.querySelector('[data-sc="a"]');
        if (DA.reduceMotion) { hEl.textContent = hs; aEl.textContent = as; return; }
        var start = null, dur = 900;
        function frame(t) {
            if (!start) start = t;
            var k = Math.min(1, (t - start) / dur);
            var ek = 1 - Math.pow(1 - k, 3);
            hEl.textContent = Math.round(hs * ek);
            aEl.textContent = Math.round(as * ek);
            if (k < 1) window.requestAnimationFrame(frame);
        }
        window.requestAnimationFrame(frame);
    }

    function stepStory(dir) {
        var scroll = $('[data-story-scroll]', storyEl);
        if (!scroll) return;
        var scenes = $$('[data-story-scene]', scroll);
        var h = scroll.clientHeight || 1;
        var cur = Math.round(scroll.scrollTop / h);
        var next = Math.max(0, Math.min(scenes.length - 1, cur + dir));
        scenes[next].scrollIntoView({ behavior: DA.reduceMotion ? 'auto' : 'smooth' });
    }

    function storyKeydown(e) {
        if (e.key === 'Escape') { closeStory(); return; }
        if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); stepStory(1); }
        else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); stepStory(-1); }
    }

    function openStory() {
        if (mode() !== 'done') return;
        var el = buildStoryLayer();
        if (!storyBuilt) {
            var scenes = storyScenes();
            var col = colors();
            el.style.setProperty('--ch', col.h.a);
            el.style.setProperty('--ca', col.a.a);
            var scroll = $('[data-story-scroll]', el);
            scroll.innerHTML = scenes.map(function (s, i) {
                return '<section class="md-story__scene ' + s.cls + '" data-story-scene="' + i + '" id="storyScene' + i + '">' +
                    '<div class="md-story__inner">' + s.html + '</div></section>';
            }).join('');
            var dots = $('[data-story-dots]', el);
            dots.innerHTML = scenes.map(function (s, i) { return '<button type="button" data-story-dot="' + i + '" aria-label="' + (i + 1) + '. sahne"></button>'; }).join('');
            $$('[data-story-dot]', dots).forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var sec = document.getElementById('storyScene' + btn.getAttribute('data-story-dot'));
                    if (sec) sec.scrollIntoView({ behavior: DA.reduceMotion ? 'auto' : 'smooth' });
                });
            });
            var shareBtn2 = $('[data-story-share]', el);
            if (shareBtn2) shareBtn2.addEventListener('click', shareCard);
            var closeCta = $('[data-story-close-cta]', el);
            if (closeCta) closeCta.addEventListener('click', closeStory);

            var played = false;
            var sceneNodes = $$('[data-story-scene]', scroll);
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (en) {
                    var idx = +en.target.getAttribute('data-story-scene');
                    var active = en.isIntersecting && en.intersectionRatio > .55;
                    en.target.classList.toggle('is-active', active);
                    if (active) {
                        $$('[data-story-dot]', dots).forEach(function (b, i) { b.classList.toggle('is-on', i === idx); });
                        var hint = $('[data-story-hint]', el);
                        if (hint) hint.classList.toggle('is-hidden', idx > 0);
                        if (scenes[idx].score && !played) { played = true; animateStoryScore($('[data-story-score]', en.target)); }
                    }
                });
            }, { root: scroll, threshold: [0, .55, 1] });
            sceneNodes.forEach(function (sec) { io.observe(sec); });

            storyBuilt = true;
        }
        el.hidden = false;
        document.documentElement.classList.add('da-story-open');
        storyLastFocus = document.activeElement;
        $('[data-story-scroll]', el).scrollTop = 0;
        window.setTimeout(function () { $('[data-story-scroll]', el).focus(); }, 30);
        document.addEventListener('keydown', storyKeydown);
    }

    function closeStory() {
        if (!storyEl || storyEl.hidden) return;
        storyEl.hidden = true;
        document.documentElement.classList.remove('da-story-open');
        document.removeEventListener('keydown', storyKeydown);
        if (storyLastFocus && storyLastFocus.focus) storyLastFocus.focus();
    }

    var storyOpenBtn = $('[data-story-open]');
    if (storyOpenBtn) storyOpenBtn.addEventListener('click', openStory);

    /* ---------------------------------------------------------
       12. Maç tüneli: sahaya çıkış
       Oyuncu tünelinden sahaya yürüyüş, canvas üzerinde gerçek
       perspektifle çizilir: beton nervürler, tavan lambaları,
       kulüp renginde LED şeritler, toz, sonda projektörlerle
       aydınlanmış tribün ağzı. Üstte sinematik yazı katmanı,
       sonda ışık patlaması ve sayfa "sahaya iner".
       Bu oturumda bu maça ilk girişte bir kez oynar; tıklama veya
       herhangi bir tuş ile geçilebilir; hareket azaltmada hiç kurulmaz.
       --------------------------------------------------------- */
    function tunRgb(c) {
        var probe = document.createElement('span');
        probe.style.color = c;
        probe.style.display = 'none';
        document.body.appendChild(probe);
        var v = window.getComputedStyle(probe).color.match(/[\d.]+/g) || [120, 140, 170];
        probe.parentNode.removeChild(probe);
        return [+v[0], +v[1], +v[2]];
    }

    function tunCol(rgb, a, lift) {
        var k = lift || 0;
        return 'rgba(' + Math.round(rgb[0] + (255 - rgb[0]) * k) + ',' + Math.round(rgb[1] + (255 - rgb[1]) * k) + ',' +
            Math.round(rgb[2] + (255 - rgb[2]) * k) + ',' + a + ')';
    }

    // Tekrarlanabilir rastgele sayı (her karede aynı toz/tribün)
    function tunRand(seed) {
        var s = seed % 2147483647; if (s <= 0) s += 2147483646;
        return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
    }

    function playTunnelIntro() {
        if (DA.reduceMotion) return;
        var TUN = { pass: 1.85, flash: 2.02, exit: 2.3, end: 3.05, reach: 2.25, len: 26, rib: 1.7 };
        var key = 'da-tunnel-' + id;
        try { if (window.sessionStorage.getItem(key) === '1') return; } catch (e) { return; }
        try { window.sessionStorage.setItem(key, '1'); } catch (e) { }

        var col = colors();
        var dby = DA.derby ? DA.derby(m.homeTeamName, m.awayTeamName) : null;
        var kick = DA.toDate(m.matchDate);
        var when = kick && !isNaN(kick.getTime())
            ? kick.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }) + ' · ' +
            kick.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
            : '';

        var el = document.createElement('div');
        el.className = 'md-tunnel' + (dby ? ' is-derby' : '');
        el.setAttribute('aria-hidden', 'true');
        el.style.setProperty('--th', col.h.a);
        el.style.setProperty('--th2', col.h.b);
        el.style.setProperty('--ta', col.a.a);
        el.style.setProperty('--ta2', col.a.b);

        function side(cls, name, logo, label) {
            return '<div class="md-tunnel__side md-tunnel__side--' + cls + '">' +
                '<span class="md-tunnel__crest"><i class="md-tunnel__halo"></i>' + DA.crest(name, logo, 'xl') + '</span>' +
                '<span class="md-tunnel__name"><small>' + label + '</small><b>' + esc(name) + '</b><i class="md-tunnel__line"></i></span>' +
                '</div>';
        }

        el.innerHTML =
            '<canvas class="md-tunnel__cv"></canvas>' +
            '<div class="md-tunnel__hud">' +
            '<p class="md-tunnel__kicker"><i></i><span>' +
            (dby ? esc(dby.label) : 'Serie A · ' + esc(String(m.week)) + '. hafta') +
            '</span><i></i></p>' +
            '<div class="md-tunnel__duel">' +
            side('h', m.homeTeamName, m.homeTeamLogo, 'Ev sahibi') +
            '<div class="md-tunnel__vs"><span class="md-tunnel__bolt"></span><b>VS</b></div>' +
            side('a', m.awayTeamName, m.awayTeamLogo, 'Deplasman') +
            '</div>' +
            '<p class="md-tunnel__venue">' +
            '<span>' + esc(m.stadium || 'Stadyum') + '</span>' +
            (when ? '<em></em><span>' + esc(when) + '</span>' : '') +
            '</p>' +
            '</div>' +
            '<div class="md-tunnel__streak"></div>' +
            '<div class="md-tunnel__flash"></div>' +
            '<div class="md-tunnel__bar md-tunnel__bar--t"></div>' +
            '<div class="md-tunnel__bar md-tunnel__bar--b"></div>' +
            '<button type="button" class="md-tunnel__skip" tabindex="-1">Geç<svg aria-hidden="true"><use href="#i-chev-right"/></svg></button>';
        document.body.appendChild(el);
        document.documentElement.classList.add('da-story-open');

        var cv = el.querySelector('.md-tunnel__cv');
        var ctx = cv.getContext('2d');
        var HC = tunRgb(col.h.a), AC = tunRgb(col.a.a);
        var W = 0, H = 0, F = 0, HW = 2, HH = 1.4;

        function size() {
            var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
            W = window.innerWidth; H = window.innerHeight;
            cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            HH = 1.4;
            HW = Math.max(1.05, Math.min(2.2, HH * (W / H) * 1.08));
            F = Math.max(0.92 * W / (2 * HW), 0.92 * H / (2 * HH));
        }
        size();
        window.addEventListener('resize', size);

        // Sahneye ait sabit parçacıklar
        var rnd = tunRand(id * 7919 + 13);
        var dust = [], crowd = [];
        for (var i = 0; i < 110; i++) {
            dust.push({ x: (rnd() * 2 - 1) * 1.9, y: (rnd() * 2 - 1) * 1.3, z: rnd() * TUN.len, r: .4 + rnd() * .9, ph: rnd() * 6.28 });
        }
        for (var j = 0; j < 160; j++) {
            crowd.push({ x: rnd() * 2 - 1, y: rnd(), ph: rnd() * 3, sp: 2 + rnd() * 5 });
        }

        // Yürüyüş: önce sakin adımlar, sonda sahaya koşu
        function camZ(t) {
            var p = Math.min(1, t / TUN.reach);
            return (TUN.len - .3) * (.5 * p + .5 * Math.pow(p, 4));
        }

        function poly(pts) {
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
            ctx.closePath();
        }

        function draw(t) {
            var cz = camZ(t);
            var walk = Math.max(0, 1 - t / TUN.reach);
            var cx = W / 2 + Math.sin(t * 4.1) * 5 * walk;
            var cy = H * .5 + Math.abs(Math.sin(t * 8.2)) * -7 * walk + 3 * walk;
            var near = .22;
            var zEnd = Math.max(near + .02, TUN.len - cz);
            function P(x, y, z) { var s = F / z; return [cx + x * s, cy + y * s]; }

            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#02040a';
            ctx.fillRect(0, 0, W, H);

            // --- Tünel ağzı: projektörle aydınlanmış stadyum
            var o1 = P(-HW, -HH, zEnd), o2 = P(HW, HH, zEnd);
            var ow = o2[0] - o1[0], oh = o2[1] - o1[1];
            var prox = Math.min(1, Math.pow(1 - zEnd / TUN.len, 2.2));
            ctx.save();
            ctx.beginPath();
            var arch = Math.min(ow * .5, oh * .34);
            ctx.moveTo(o1[0], o2[1]);
            ctx.lineTo(o1[0], o1[1] + arch);
            ctx.quadraticCurveTo(o1[0], o1[1], o1[0] + arch, o1[1]);
            ctx.lineTo(o2[0] - arch, o1[1]);
            ctx.quadraticCurveTo(o2[0], o1[1], o2[0], o1[1] + arch);
            ctx.lineTo(o2[0], o2[1]);
            ctx.closePath();
            ctx.clip();
            var sky = ctx.createLinearGradient(0, o1[1], 0, o2[1]);
            sky.addColorStop(0, '#0b1a3a');
            sky.addColorStop(.18, '#3d6fb8');
            sky.addColorStop(.42, '#b9d6ff');
            sky.addColorStop(.62, '#e9f4ff');
            sky.addColorStop(.63, '#4fb36a');
            sky.addColorStop(1, '#1f7a3e');
            ctx.fillStyle = sky;
            ctx.fillRect(o1[0], o1[1], ow, oh);
            // Tribün bandı ve flaşlar
            var ty = o1[1] + oh * .3, th = oh * .3;
            var tg = ctx.createLinearGradient(0, ty, 0, ty + th);
            tg.addColorStop(0, 'rgba(10,18,40,.0)');
            tg.addColorStop(.25, 'rgba(14,24,52,.88)');
            tg.addColorStop(1, 'rgba(26,40,80,.75)');
            ctx.fillStyle = tg;
            ctx.fillRect(o1[0], ty, ow, th);
            for (var c = 0; c < crowd.length; c++) {
                var cr = crowd[c];
                var tw = Math.sin(t * cr.sp + cr.ph);
                if (tw < .82) continue;
                ctx.fillStyle = 'rgba(255,255,255,' + ((tw - .82) * 5.5).toFixed(3) + ')';
                var dr = Math.max(.6, ow * .004);
                ctx.beginPath();
                ctx.arc(o1[0] + (cr.x * .5 + .5) * ow, ty + th * .25 + cr.y * th * .7, dr, 0, 6.283);
                ctx.fill();
            }
            // Çim şeritleri
            var gy = o1[1] + oh * .63;
            for (var gs = 0; gs < 7; gs++) {
                if (gs % 2) continue;
                ctx.fillStyle = 'rgba(255,255,255,.07)';
                ctx.fillRect(o1[0] + ow * gs / 7, gy, ow / 7, o2[1] - gy);
            }
            ctx.restore();

            // --- Duvarlar, tavan, zemin
            var nTL = P(-HW, -HH, near), nTR = P(HW, -HH, near), nBL = P(-HW, HH, near), nBR = P(HW, HH, near);
            var fTL = P(-HW, -HH, zEnd), fTR = P(HW, -HH, zEnd), fBL = P(-HW, HH, zEnd), fBR = P(HW, HH, zEnd);
            var R = Math.max(W, H) * .9;
            function lit(base, glow) {
                var g = ctx.createRadialGradient(cx, cy, Math.max(4, ow * .5), cx, cy, R);
                g.addColorStop(0, glow);
                g.addColorStop(.35, base);
                g.addColorStop(1, '#020409');
                return g;
            }
            var warm = .25 + prox * .5;
            poly([nTL, fTL, fBL, nBL]); ctx.fillStyle = lit(tunCol(HC, 1), 'rgba(150,170,205,' + warm + ')'); ctx.fill();
            ctx.fillStyle = 'rgba(8,12,22,.78)'; ctx.fill();
            poly([nTR, fTR, fBR, nBR]); ctx.fillStyle = lit(tunCol(AC, 1), 'rgba(150,170,205,' + warm + ')'); ctx.fill();
            ctx.fillStyle = 'rgba(8,12,22,.78)'; ctx.fill();
            poly([nTL, nTR, fTR, fTL]); ctx.fillStyle = lit('#0b111d', 'rgba(120,140,175,' + warm + ')'); ctx.fill();
            poly([nBL, nBR, fBR, fBL]); ctx.fillStyle = lit('#0d1422', 'rgba(170,190,220,' + (warm + .1) + ')'); ctx.fill();

            // Zeminde ağzın yansıması
            var rf = ctx.createLinearGradient(0, fBL[1], 0, H);
            rf.addColorStop(0, 'rgba(220,235,255,' + (.28 + prox * .3) + ')');
            rf.addColorStop(1, 'rgba(220,235,255,0)');
            ctx.fillStyle = rf;
            poly([fBL, fBR, [cx + ow * 1.6, H], [cx - ow * 1.6, H]]);
            ctx.fill();

            // --- Beton nervürler ve tavan lambaları (uzaktan yakına)
            var first = Math.floor(cz / TUN.rib) + 1;
            var ribs = [];
            for (var k = first; k * TUN.rib < TUN.len; k++) ribs.push(k * TUN.rib - cz);
            for (var r = ribs.length - 1; r >= 0; r--) {
                var z = ribs[r];
                if (z < near || z > zEnd) continue;
                var s = F / z;
                var fog = Math.min(1, Math.max(0, 1 - z / (TUN.len * .95)));
                var a = P(-HW, -HH, z), b = P(HW, HH, z);
                // nervür çerçevesi
                ctx.lineWidth = Math.max(1, s * .09);
                ctx.strokeStyle = 'rgba(3,5,10,' + (.55 + fog * .35) + ')';
                ctx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
                ctx.lineWidth = Math.max(.6, s * .012);
                ctx.strokeStyle = 'rgba(190,210,240,' + (.05 + fog * .12) + ')';
                ctx.strokeRect(a[0] + s * .05, a[1] + s * .05, b[0] - a[0] - s * .1, b[1] - a[1] - s * .1);

                // tavan lambası (iki nervür arasında)
                var lz = z + TUN.rib * .5;
                if (lz < zEnd && lz > near) {
                    var q1 = P(-.75, -HH + .01, lz - .28), q2 = P(.75, -HH + .01, lz - .28), q3 = P(.75, -HH + .01, lz + .28), q4 = P(-.75, -HH + .01, lz + .28);
                    var lf = Math.min(1, Math.max(0, 1 - lz / TUN.len)) * .9 + .1;
                    ctx.globalCompositeOperation = 'lighter';
                    var ls = F / lz;
                    var glow = ctx.createRadialGradient(cx, cy - HH * ls, 0, cx, cy - HH * ls, ls * 1.5);
                    glow.addColorStop(0, 'rgba(170,200,255,' + (.35 * lf) + ')');
                    glow.addColorStop(1, 'rgba(170,200,255,0)');
                    ctx.fillStyle = glow;
                    ctx.fillRect(cx - ls * 1.5, cy - HH * ls - ls * 1.5, ls * 3, ls * 3);
                    // zemine düşen ışık havuzu
                    var pool = ctx.createRadialGradient(cx, cy + HH * ls, 0, cx, cy + HH * ls, ls * 1.1);
                    pool.addColorStop(0, 'rgba(170,200,255,' + (.16 * lf) + ')');
                    pool.addColorStop(1, 'rgba(170,200,255,0)');
                    ctx.fillStyle = pool;
                    ctx.fillRect(cx - ls * 1.1, cy + HH * ls - ls * .5, ls * 2.2, ls);
                    ctx.globalCompositeOperation = 'source-over';
                    poly([q1, q2, q3, q4]);
                    ctx.fillStyle = 'rgba(235,244,255,' + (.55 + lf * .45) + ')';
                    ctx.fill();
                }
            }

            // --- Kulüp renginde LED şeritler (sol ev sahibi, sağ deplasman)
            ctx.globalCompositeOperation = 'lighter';
            function strip(x, rgb, dir) {
                var y0 = HH - .42, y1 = HH - .34;
                var A1 = P(x, y0, near), A2 = P(x, y0, zEnd), A3 = P(x, y1, zEnd), A4 = P(x, y1, near);
                poly([A1, A2, A3, A4]);
                ctx.fillStyle = tunCol(rgb, .85, .15);
                ctx.fill();
                var G1 = P(x, y0 - .14, near), G2 = P(x, y0 - .14, zEnd), G3 = P(x, y1 + .14, zEnd), G4 = P(x, y1 + .14, near);
                poly([G1, G2, G3, G4]);
                ctx.fillStyle = tunCol(rgb, .16);
                ctx.fill();
                // ileri akan ışık atımları
                for (var pk = 0; pk < 5; pk++) {
                    var pz = ((t * 15 + pk * 5.3) % TUN.len) - cz;
                    if (pz < near + .1 || pz > zEnd) continue;
                    var e1 = P(x, y0 - .04, pz), e2 = P(x, y0 - .04, Math.min(zEnd, pz + 1.3)), e3 = P(x, y1 + .04, Math.min(zEnd, pz + 1.3)), e4 = P(x, y1 + .04, pz);
                    poly([e1, e2, e3, e4]);
                    ctx.fillStyle = tunCol(rgb, .9, .6);
                    ctx.fill();
                }
                // zemindeki yansıma
                var R1 = P(x * .96, HH - .01, near), R2 = P(x * .96, HH - .01, zEnd), R3 = P(x * .78, HH - .01, zEnd), R4 = P(x * .78, HH - .01, near);
                poly([R1, R2, R3, R4]);
                ctx.fillStyle = tunCol(rgb, .1);
                ctx.fill();
            }
            strip(-HW + .01, HC, -1);
            strip(HW - .01, AC, 1);

            // --- Ağzın taşan ışığı
            var bloomR = Math.max(ow, oh) * (1.4 + prox * 1.6);
            var bl = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomR);
            bl.addColorStop(0, 'rgba(210,228,255,' + (.35 + prox * .45) + ')');
            bl.addColorStop(.4, 'rgba(140,175,235,' + (.12 + prox * .2) + ')');
            bl.addColorStop(1, 'rgba(120,150,220,0)');
            ctx.fillStyle = bl;
            ctx.fillRect(cx - bloomR, cy - bloomR, bloomR * 2, bloomR * 2);

            // Işık hüzmeleri (ağızdan içeri sızan)
            ctx.save();
            ctx.translate(cx, cy);
            for (var g = 0; g < 7; g++) {
                var ang = -1.25 + g * .42 + Math.sin(t * .8 + g) * .03;
                ctx.rotate(0);
                ctx.save();
                ctx.rotate(ang);
                var bw = Math.max(ow, 30) * (.25 + (g % 3) * .1);
                var len = Math.max(W, H) * 1.1;
                var bg = ctx.createLinearGradient(0, 0, len, 0);
                bg.addColorStop(0, 'rgba(200,220,255,' + (.07 + prox * .08) + ')');
                bg.addColorStop(1, 'rgba(200,220,255,0)');
                ctx.fillStyle = bg;
                ctx.beginPath();
                ctx.moveTo(0, -bw * .2);
                ctx.lineTo(len, -bw * 1.6);
                ctx.lineTo(len, bw * 1.6);
                ctx.lineTo(0, bw * .2);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
            ctx.restore();

            // --- Havada asılı toz
            for (var d = 0; d < dust.length; d++) {
                var pt = dust[d];
                var dz = pt.z - cz;
                if (dz < near + .1) dz += TUN.len;
                if (dz > zEnd) continue;
                var dp = P(pt.x + Math.sin(t + pt.ph) * .05, pt.y + Math.cos(t * .7 + pt.ph) * .04, dz);
                var dr2 = Math.max(.5, (F / dz) * .006 * pt.r);
                var da = Math.min(.55, .9 / dz) * (.5 + .5 * Math.sin(t * 2 + pt.ph));
                ctx.fillStyle = 'rgba(220,232,255,' + da.toFixed(3) + ')';
                ctx.beginPath();
                ctx.arc(dp[0], dp[1], dr2, 0, 6.283);
                ctx.fill();
            }

            // --- Koşu anında hız çizgileri
            var sprint = Math.max(0, (t - 1.45) / (TUN.reach - 1.45));
            if (sprint > 0) {
                var sr = tunRand(Math.floor(t * 30) + 7);
                ctx.lineCap = 'round';
                for (var sl = 0; sl < 46; sl++) {
                    var an = sr() * 6.283;
                    var r0 = Math.max(W, H) * (.18 + sr() * .25);
                    var r1 = r0 + Math.max(W, H) * (.15 + sr() * .35) * sprint;
                    ctx.strokeStyle = 'rgba(225,238,255,' + (.25 * Math.min(1, sprint * 1.5)).toFixed(3) + ')';
                    ctx.lineWidth = .8 + sr() * 1.8;
                    ctx.beginPath();
                    ctx.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0);
                    ctx.lineTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1);
                    ctx.stroke();
                }
            }
            ctx.globalCompositeOperation = 'source-over';

            // Sinematik vinyet
            var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .78);
            vg.addColorStop(0, 'rgba(0,0,0,0)');
            vg.addColorStop(1, 'rgba(0,0,0,' + (.6 * (1 - prox * .6)) + ')');
            ctx.fillStyle = vg;
            ctx.fillRect(0, 0, W, H);
        }

        var start = 0, raf = 0, done = false, offset = 0;
        var flags = { pass: false, flash: false, exit: false };

        function finish() {
            if (done) return;
            done = true;
            window.cancelAnimationFrame(raf);
            window.removeEventListener('resize', size);
            document.removeEventListener('keydown', skip, true);
            document.documentElement.classList.remove('da-story-open');
            if (el.parentNode) el.parentNode.removeChild(el);
        }

        function land() {
            var root = document.documentElement;
            root.classList.add('md-landed');
            window.setTimeout(function () { root.classList.remove('md-landed'); }, 1400);
        }

        function frame(now) {
            if (done) return;
            if (!start) start = now;
            var t = (now - start) / 1000 + offset;
            draw(Math.min(t, TUN.reach + .3));
            if (!flags.pass && t >= TUN.pass) { flags.pass = true; el.classList.add('is-pass'); }
            if (!flags.flash && t >= TUN.flash) { flags.flash = true; el.classList.add('is-flash'); }
            if (!flags.exit && t >= TUN.exit) { flags.exit = true; el.classList.add('is-exit'); land(); }
            if (t >= TUN.end) { finish(); return; }
            raf = window.requestAnimationFrame(frame);
        }

        // Geç: doğrudan koşu ve ışık patlamasına atla
        function skip(e) {
            if (done) return;
            if (e && e.type === 'keydown' && (e.ctrlKey || e.metaKey || e.altKey)) return;
            if (e && e.preventDefault) e.preventDefault();
            var t = start ? (performance.now() - start) / 1000 + offset : 0;
            if (t < TUN.pass - .05) offset += (TUN.pass - .05) - t;
        }
        el.addEventListener('click', skip);
        document.addEventListener('keydown', skip, true);

        raf = window.requestAnimationFrame(frame);
        // Sekme arka plandaysa kare gelmeyebilir: sayfayı asla kilitli bırakma
        window.setTimeout(finish, 6000);
    }

    /* ---------------------------------------------------------
       13. Maç özeti videosu
       Tarayıcıda 9:16 dikey bir video kurgulanır: canvas sahne sahne
       çizilir, Web Audio ile taraftar uğultusu, düdük ve gol kornası
       sentezlenir, MediaRecorder ikisini birlikte .webm/.mp4 olarak kaydeder.
       Kayıt desteklenmiyorsa paylaşılabilir maç kartına düşülür.
       --------------------------------------------------------- */
    var REEL_W = 720, REEL_H = 1280, REEL_FPS = 30;
    var REEL_SCENES = [
        { key: 'intro', label: 'Giriş', from: 0, to: 2.4 },
        { key: 'versus', label: 'Karşılaşma', from: 2.4, to: 5.0 },
        { key: 'model', label: 'Tahmin', from: 5.0, to: 7.4 },
        { key: 'score', label: 'Skor', from: 7.4, to: 10.8 },
        { key: 'impact', label: 'Analiz', from: 10.8, to: 12.9 },
        { key: 'outro', label: 'Kapanış', from: 12.9, to: 14.6 }
    ];
    var REEL_DUR = 14.6;

    // 5x7 nokta matris rakamlar (stadyum skor tabelası)
    var REEL_FONT = {
        '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
        '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
        '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
        '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
        '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
        '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
        '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
        '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
        '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
        '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100']
    };

    function rclamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function rseg(t, a, b) { return rclamp((t - a) / (b - a)); }
    function rOut(k) { return 1 - Math.pow(1 - k, 3); }
    function rInOut(k) { return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
    function rBack(k) { var c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); }

    function rFont(ctx, weight, size, cond) {
        ctx.font = weight + ' ' + Math.round(size) + 'px ' + (cond ? '"Barlow Condensed", "Arial Narrow", sans-serif' : 'Barlow, Arial, sans-serif');
    }

    function rSpacing(ctx, px) {
        if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px';
    }

    // Metni genişliğe sığdırır: gerekirse puntoyu küçültür
    function rFit(ctx, text, x, y, maxW, weight, size, cond) {
        var s = size;
        rFont(ctx, weight, s, cond);
        while (ctx.measureText(text).width > maxW && s > 12) { s -= 2; rFont(ctx, weight, s, cond); }
        ctx.fillText(text, x, y);
        return s;
    }

    function rAlpha(hex, a) {
        var h = String(hex || '#8E9BB5').replace('#', '');
        if (h.length === 3) h = h.replace(/./g, '$&$&');
        var r = parseInt(h.slice(0, 2), 16) || 0, g = parseInt(h.slice(2, 4), 16) || 0, b = parseInt(h.slice(4, 6), 16) || 0;
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }

    function rLum(hex) {
        var h = String(hex || '').replace('#', '');
        if (h.length === 3) h = h.replace(/./g, '$&$&');
        var r = parseInt(h.slice(0, 2), 16) || 0, g = parseInt(h.slice(2, 4), 16) || 0, b = parseInt(h.slice(4, 6), 16) || 0;
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    }

    function reelData() {
        var col = colors();
        var p = DA.predict(m, { before: true });
        var h = pctText(p.home), d = pctText(p.draw), a = Math.max(0, 100 - h - d);
        var hs = m.homeScore || 0, as = m.awayScore || 0;
        var actual = hs > as ? 'home' : hs < as ? 'away' : 'draw';
        var fav = p.home >= p.away && p.home >= p.draw ? 'home' : p.away >= p.draw ? 'away' : 'draw';
        var chance = p[actual];
        var verdict, tone;
        if (actual === fav) { verdict = 'BEKLENEN SONUÇ'; tone = '#2BD67B'; }
        else if (chance < 0.25) { verdict = actual === 'draw' ? 'SÜRPRİZ BERABERLİK' : 'SÜRPRİZ SONUÇ'; tone = '#FF8A5B'; }
        else if (actual === 'draw') { verdict = 'PUANLAR PAYLAŞILDI'; tone = '#8E9BB5'; }
        else { verdict = 'İNCE FARK'; tone = '#FFC94A'; }

        // Bu maçtan önce ve sonra lig sırası
        var kick = DA.toDate(m.matchDate).getTime();
        var upto = data.matches.filter(function (x) { return L.isFinished(x) && DA.toDate(x.matchDate).getTime() <= kick; });
        var before = upto.filter(function (x) { return x.id !== id; });
        var ta = L.table(data.teams, upto), tb = L.table(data.teams, before);
        var rank = function (rows, tid) { var r = rowOf(rows, tid); return r ? r.rank : 0; };
        var hasBefore = before.some(function (x) { return x.homeTeamId === m.homeTeamId || x.awayTeamId === m.homeTeamId || x.homeTeamId === m.awayTeamId || x.awayTeamId === m.awayTeamId; });

        var winnerSide = actual;
        var wcol = actual === 'home' ? col.h : actual === 'away' ? col.a : { a: '#FFC94A', b: '#FFFFFF' };
        return {
            col: col, h: h, d: d, a: a, hs: hs, as: as, actual: actual, fav: fav,
            chance: pctText(chance), verdict: verdict, tone: tone, winnerSide: winnerSide, wcol: wcol,
            rank: {
                h: { b: rank(tb, m.homeTeamId), a: rank(ta, m.homeTeamId) },
                a: { b: rank(tb, m.awayTeamId), a: rank(ta, m.awayTeamId) },
                known: hasBefore
            },
            date: DA.toDate(m.matchDate)
        };
    }

    // Önceden üretilen parçacıklar: her karede aynı yerde dursunlar diye bir kez hesaplanır
    function reelParticles(rd) {
        var dust = [], conf = [];
        for (var i = 0; i < 70; i++) {
            dust.push({ x: Math.random() * REEL_W, y: Math.random() * REEL_H, r: .6 + Math.random() * 1.8, s: 8 + Math.random() * 26, o: .15 + Math.random() * .5 });
        }
        var palette = [rd.wcol.a, rd.wcol.b, '#FFFFFF', '#FFC94A', rd.wcol.a];
        for (var j = 0; j < 190; j++) {
            var left = j % 2 === 0;
            var ang = (left ? -1 : -1) * (Math.PI / 2) + (left ? .55 : -.55) + (Math.random() - .5) * .7;
            var sp = 900 + Math.random() * 900;
            conf.push({
                x: left ? -10 : REEL_W + 10, y: REEL_H * .78,
                vx: Math.cos(ang) * sp * (left ? 1 : 1), vy: Math.sin(ang) * sp,
                w: 8 + Math.random() * 10, h: 4 + Math.random() * 6,
                rot: Math.random() * 6, vr: (Math.random() - .5) * 14,
                c: palette[j % palette.length], delay: Math.random() * .25
            });
        }
        return { dust: dust, conf: conf };
    }

    function reelGoalTimes(rd) {
        // Skor sayacı: önce ev sahibi, sonra konuk; her gol bir tık
        var total = rd.hs + rd.as;
        var start = REEL_SCENES[3].from + .55;
        var span = 1.7;
        var step = total ? Math.min(.42, span / total) : 0;
        var list = [];
        var hh = 0, aa = 0;
        for (var k = 0; k < total; k++) {
            var side = hh < rd.hs && (aa >= rd.as || k % 2 === 0) ? 'h' : 'a';
            if (side === 'h') hh++; else aa++;
            list.push({ t: start + k * step, side: side, h: hh, a: aa });
        }
        return list;
    }

    /* ---- Çizim yardımcıları ---- */
    function rBeams(ctx, alpha, sway) {
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        var origins = [[-60, -40, .55], [180, -80, .3], [REEL_W - 180, -80, -.3], [REEL_W + 60, -40, -.55]];
        origins.forEach(function (o, i) {
            var ang = o[2] + Math.sin(sway * 1.3 + i) * .05;
            ctx.save();
            ctx.translate(o[0], o[1]);
            ctx.rotate(ang);
            var g = ctx.createLinearGradient(0, 0, 0, REEL_H * 1.1);
            g.addColorStop(0, 'rgba(225,238,255,' + (.42 * alpha) + ')');
            g.addColorStop(1, 'rgba(225,238,255,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(-14, 0);
            ctx.lineTo(14, 0);
            ctx.lineTo(210, REEL_H * 1.1);
            ctx.lineTo(-210, REEL_H * 1.1);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        });
        ctx.restore();
    }

    function rPitch(ctx, k, alpha) {
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = 'rgba(140,190,255,.55)';
        ctx.lineWidth = 2;
        var top = REEL_H * .62, bot = REEL_H + 40;
        var tl = REEL_W * .2, tr = REEL_W * .8, bl = -120, br = REEL_W + 120;
        ctx.setLineDash([2400]);
        ctx.lineDashOffset = 2400 * (1 - k);
        ctx.beginPath();
        ctx.moveTo(bl, bot); ctx.lineTo(tl, top); ctx.lineTo(tr, top); ctx.lineTo(br, bot);
        ctx.moveTo(REEL_W / 2, top); ctx.lineTo(REEL_W / 2, bot);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(REEL_W / 2, REEL_H * .8, 150, 46, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    function rBadge(ctx, x, y, r, name, col, glow) {
        ctx.save();
        if (glow) {
            var g = ctx.createRadialGradient(x, y, r * .6, x, y, r * 2.2);
            g.addColorStop(0, rAlpha(col.a, .55 * glow));
            g.addColorStop(1, rAlpha(col.a, 0));
            ctx.fillStyle = g;
            ctx.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
        }
        ctx.beginPath();
        ctx.arc(x, y, r + r * .09, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(4,8,18,.9)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        var grad = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
        grad.addColorStop(0, col.a);
        grad.addColorStop(.5, col.a);
        grad.addColorStop(.5, col.b);
        grad.addColorStop(1, col.b);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = Math.max(3, r * .06);
        ctx.strokeStyle = 'rgba(255,255,255,.85)';
        ctx.stroke();
        var code = DA.teamCode(name);
        rFont(ctx, 800, r * .62, true);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = r * .09;
        ctx.strokeStyle = 'rgba(0,0,0,.55)';
        ctx.strokeText(code, x, y + r * .04);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(code, x, y + r * .04);
        ctx.restore();
    }

    function rLedDigit(ctx, ch, x, y, dot, on, glowCol) {
        var map = REEL_FONT[ch] || REEL_FONT['0'];
        var gap = dot * .32, cell = dot + gap;
        for (var row = 0; row < 7; row++) {
            for (var c = 0; c < 5; c++) {
                var lit = map[row].charAt(c) === '1';
                var cx = x + c * cell + dot / 2, cy = y + row * cell + dot / 2;
                if (lit) {
                    ctx.beginPath();
                    ctx.arc(cx, cy, dot * .95, 0, Math.PI * 2);
                    ctx.fillStyle = rAlpha(glowCol, .22 * on);
                    ctx.fill();
                }
                ctx.beginPath();
                ctx.arc(cx, cy, dot / 2, 0, Math.PI * 2);
                ctx.fillStyle = lit ? (on > .5 ? '#E9FFF2' : rAlpha(glowCol, .9)) : 'rgba(255,255,255,.05)';
                ctx.fill();
            }
        }
        return 5 * cell - gap;
    }

    function rLedNumber(ctx, num, cx, y, dot, on, glowCol) {
        var s = String(num);
        var gap = dot * .32, cell = dot + gap, dw = 5 * cell - gap, sp = dot * 1.4;
        var w = s.length * dw + (s.length - 1) * sp;
        var x = cx - w / 2;
        for (var i = 0; i < s.length; i++) {
            rLedDigit(ctx, s.charAt(i), x + i * (dw + sp), y, dot, on, glowCol);
        }
        return w;
    }

    function rRoundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function rKicker(ctx, text, y, color, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;
        rFont(ctx, 800, 26, false);
        rSpacing(ctx, 6);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var w = ctx.measureText(text).width;
        ctx.fillStyle = color || '#FF3D5A';
        ctx.beginPath();
        ctx.arc(REEL_W / 2 - w / 2 - 20, y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.82)';
        ctx.fillText(text, REEL_W / 2 + 6, y);
        rSpacing(ctx, 0);
        ctx.restore();
    }

    /* ---- Sahneler ---- */
    function rIntro(ctx, t, rd, pc) {
        var u = t;
        ctx.fillStyle = '#020409';
        ctx.fillRect(0, 0, REEL_W, REEL_H);
        // Projektörler titreyerek yanar
        var flick = u < .35 ? 0 : u < .45 ? 1 : u < .55 ? .2 : u < .65 ? 1 : u < .72 ? .45 : 1;
        rBeams(ctx, flick, t);
        var glow = ctx.createRadialGradient(REEL_W / 2, REEL_H * .42, 20, REEL_W / 2, REEL_H * .42, REEL_H * .6);
        glow.addColorStop(0, 'rgba(46,123,255,' + (.28 * flick) + ')');
        glow.addColorStop(1, 'rgba(46,123,255,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, REEL_W, REEL_H);
        rPitch(ctx, rOut(rseg(u, .5, 2)), .7 * flick);
        // Toz
        pc.dust.forEach(function (p) {
            var y = (p.y - t * p.s) % REEL_H; if (y < 0) y += REEL_H;
            ctx.beginPath();
            ctx.arc(p.x + Math.sin(t + p.y) * 6, y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(220,235,255,' + (p.o * flick) + ')';
            ctx.fill();
        });
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var k1 = rOut(rseg(u, .7, 1.2));
        rKicker(ctx, 'MAÇ ÖZETİ', 470 - 20 * (1 - k1), '#FF3D5A', k1);
        var k2 = rBack(rseg(u, .85, 1.45));
        ctx.save();
        ctx.globalAlpha = rseg(u, .85, 1.1);
        ctx.translate(REEL_W / 2, 600);
        ctx.scale(.6 + .4 * k2, .6 + .4 * k2);
        rFont(ctx, 800, 168, true);
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(46,123,255,.8)';
        ctx.shadowBlur = 40;
        ctx.fillText(m.week + '. HAFTA', 0, 0);
        ctx.restore();
        var k3 = rOut(rseg(u, 1.25, 1.75));
        ctx.save();
        ctx.globalAlpha = k3;
        rFont(ctx, 700, 34, false);
        rSpacing(ctx, 2);
        ctx.fillStyle = 'rgba(230,238,255,.9)';
        ctx.fillText('SERIE A  ·  ' + DA.fmt.date.format(rd.date).toLocaleUpperCase('tr-TR'), REEL_W / 2, 720 + 16 * (1 - k3));
        rSpacing(ctx, 0);
        ctx.fillStyle = 'rgba(180,196,226,.85)';
        rFit(ctx, m.stadium || '', REEL_W / 2, 772 + 16 * (1 - k3), REEL_W - 120, 500, 30, false);
        ctx.restore();
        // Sahne geçişi: sona doğru beyaza açılır
        var out = rseg(u, 2.2, 2.4);
        if (out > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (out * .9) + ')'; ctx.fillRect(0, 0, REEL_W, REEL_H); }
    }

    function rVersus(ctx, t, rd) {
        var u = t - REEL_SCENES[1].from;
        var hc = rd.col.h, ac = rd.col.a;
        var push = 1 + .05 * rseg(u, 0, 2.6);
        ctx.save();
        ctx.translate(REEL_W / 2, REEL_H / 2);
        ctx.scale(push, push);
        ctx.translate(-REEL_W / 2, -REEL_H / 2);
        // Çapraz ikiye bölünmüş zemin
        var seam = rOut(rseg(u, 0, .5));
        var y1 = REEL_H * (.36 + (1 - seam) * -.5), y2 = REEL_H * (.64 + (1 - seam) * .5);
        var gh = ctx.createLinearGradient(0, 0, REEL_W, REEL_H * .6);
        gh.addColorStop(0, rAlpha(hc.a, .95));
        gh.addColorStop(1, '#05080F');
        ctx.fillStyle = gh;
        ctx.beginPath(); ctx.moveTo(-50, -50); ctx.lineTo(REEL_W + 50, -50); ctx.lineTo(REEL_W + 50, y1); ctx.lineTo(-50, y2); ctx.closePath(); ctx.fill();
        var ga = ctx.createLinearGradient(REEL_W, REEL_H, 0, REEL_H * .4);
        ga.addColorStop(0, rAlpha(ac.a, .95));
        ga.addColorStop(1, '#05080F');
        ctx.fillStyle = ga;
        ctx.beginPath(); ctx.moveTo(-50, y2); ctx.lineTo(REEL_W + 50, y1); ctx.lineTo(REEL_W + 50, REEL_H + 50); ctx.lineTo(-50, REEL_H + 50); ctx.closePath(); ctx.fill();
        // Doku: ince çizgiler
        ctx.save();
        ctx.globalAlpha = .07;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        for (var i = -REEL_H; i < REEL_W + REEL_H; i += 26) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - REEL_H * .5, REEL_H); ctx.stroke(); }
        ctx.restore();
        // Işıklı ek yeri
        ctx.save();
        ctx.shadowColor = '#FFFFFF';
        ctx.shadowBlur = 30;
        ctx.strokeStyle = 'rgba(255,255,255,.95)';
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(-50, y2); ctx.lineTo(REEL_W + 50, y1); ctx.stroke();
        ctx.restore();

        // Armalar kenarlardan kayarak gelir
        var kh = rBack(rseg(u, .25, .85)), ka = rBack(rseg(u, .4, 1));
        var hx = -200 + (230 + 200) * kh, ax = REEL_W + 200 - (REEL_W + 200 - 490) * ka;
        rBadge(ctx, hx, 330, 122, m.homeTeamName, hc, rseg(u, .3, 1));
        rBadge(ctx, ax, 950, 122, m.awayTeamName, ac, rseg(u, .45, 1.1));
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.save();
        ctx.globalAlpha = rseg(u, .8, 1.2);
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0,0,0,.6)';
        ctx.shadowBlur = 16;
        rFit(ctx, m.homeTeamName.toLocaleUpperCase('tr-TR'), hx, 505, 400, 800, 64, true);
        rFont(ctx, 700, 22, false); rSpacing(ctx, 4);
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.fillText('EV SAHİBİ', hx, 552);
        rSpacing(ctx, 0);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = rseg(u, .95, 1.35);
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0,0,0,.6)';
        ctx.shadowBlur = 16;
        rFit(ctx, m.awayTeamName.toLocaleUpperCase('tr-TR'), ax, 1128, 400, 800, 64, true);
        rFont(ctx, 700, 22, false); rSpacing(ctx, 4);
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.fillText('DEPLASMAN', ax, 1175);
        rSpacing(ctx, 0);
        ctx.restore();

        // VS çarpar
        var kv = rseg(u, .55, .95);
        if (kv > 0) {
            var sc = 3 - 2 * rBack(kv);
            ctx.save();
            ctx.translate(REEL_W / 2, REEL_H / 2);
            ctx.rotate(-.12);
            ctx.scale(sc, sc);
            ctx.globalAlpha = rclamp(kv * 2);
            rFont(ctx, 800, 190, true);
            ctx.lineWidth = 14;
            ctx.strokeStyle = '#05080F';
            ctx.strokeText('VS', 0, 8);
            ctx.fillStyle = '#FFFFFF';
            ctx.shadowColor = 'rgba(255,255,255,.9)';
            ctx.shadowBlur = 30;
            ctx.fillText('VS', 0, 8);
            ctx.restore();
        }
        ctx.restore();
        var flash = u > .78 ? Math.max(0, 1 - (u - .78) / .35) : 0;
        if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (flash * .75) + ')'; ctx.fillRect(0, 0, REEL_W, REEL_H); }
        var intro = 1 - rseg(u, 0, .25);
        if (intro > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (intro * .9) + ')'; ctx.fillRect(0, 0, REEL_W, REEL_H); }
    }

    function rModel(ctx, t, rd) {
        var u = t - REEL_SCENES[2].from;
        var bg = ctx.createLinearGradient(0, 0, 0, REEL_H);
        bg.addColorStop(0, '#0A1630');
        bg.addColorStop(1, '#03060E');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, REEL_W, REEL_H);
        // Izgara
        ctx.save();
        ctx.globalAlpha = .08;
        ctx.strokeStyle = '#8CB8FF';
        ctx.lineWidth = 1;
        for (var gx = 0; gx <= REEL_W; gx += 48) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, REEL_H); ctx.stroke(); }
        for (var gy = 0; gy <= REEL_H; gy += 48) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(REEL_W, gy); ctx.stroke(); }
        ctx.restore();
        var enter = rOut(rseg(u, 0, .45));
        ctx.save();
        ctx.translate(0, 60 * (1 - enter));
        ctx.globalAlpha = enter;
        rKicker(ctx, 'MAÇTAN ÖNCE', 300, '#5B9BFF', 1);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFFFFF';
        rFont(ctx, 800, 76, true);
        ctx.fillText('MODELİN TAHMİNİ', REEL_W / 2, 380);
        ctx.restore();

        var rows = [
            { label: m.homeTeamName, v: rd.h, c: rd.col.h.a, key: 'home' },
            { label: 'Beraberlik', v: rd.d, c: '#6F7D99', key: 'draw' },
            { label: m.awayTeamName, v: rd.a, c: rd.col.a.a, key: 'away' }
        ];
        var bx = 80, bw = REEL_W - 160, bh = 92;
        rows.forEach(function (r, i) {
            var y = 500 + i * 170;
            var k = rOut(rseg(u, .45 + i * .22, 1.25 + i * .22));
            var ap = rseg(u, .35 + i * .2, .6 + i * .2);
            ctx.save();
            ctx.globalAlpha = ap;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = 'rgba(230,238,255,.92)';
            rFit(ctx, r.label.toLocaleUpperCase('tr-TR'), bx, y - 16, bw - 160, 800, 36, true);
            if (r.key === rd.fav) {
                ctx.fillStyle = '#FFC94A';
                rFont(ctx, 800, 22, false);
                ctx.textAlign = 'right';
                ctx.fillText('★ FAVORİ', bx + bw, y - 18);
            }
            rRoundRect(ctx, bx, y, bw, bh, 22);
            ctx.fillStyle = 'rgba(255,255,255,.06)';
            ctx.fill();
            var fw = Math.max(bh, bw * (r.v / 100) * k);
            rRoundRect(ctx, bx, y, fw, bh, 22);
            var g = ctx.createLinearGradient(bx, 0, bx + fw, 0);
            g.addColorStop(0, rAlpha(r.c, .55));
            g.addColorStop(1, r.c);
            ctx.fillStyle = g;
            ctx.fill();
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            rFont(ctx, 800, 64, true);
            var shown = Math.round(r.v * k);
            var inside = fw > 230;
            ctx.fillStyle = inside ? (rLum(r.c) > .62 ? '#0A1226' : '#FFFFFF') : '#FFFFFF';
            ctx.fillText('%' + shown, inside ? bx + fw - 26 : bx + fw + 150, y + bh / 2 + 3);
            ctx.restore();
        });
        var out = rseg(u, 2.2, 2.4);
        if (out > 0) { ctx.fillStyle = 'rgba(0,0,0,' + out + ')'; ctx.fillRect(0, 0, REEL_W, REEL_H); }
    }

    function rScore(ctx, t, rd, pc, goals) {
        var u = t - REEL_SCENES[3].from;
        // Son gol anından sarsıntı
        var last = null;
        goals.forEach(function (g) { if (t >= g.t) last = g; });
        var since = last ? t - last.t : 9;
        var shake = since < .45 ? (1 - since / .45) * 18 : 0;
        var cur = last || { h: 0, a: 0 };
        var done = u > 2.45;
        ctx.save();
        if (shake) ctx.translate(Math.sin(t * 90) * shake, Math.cos(t * 77) * shake * .7);
        ctx.fillStyle = '#020409';
        ctx.fillRect(-40, -40, REEL_W + 80, REEL_H + 80);
        var wg = ctx.createRadialGradient(REEL_W / 2, REEL_H * .46, 30, REEL_W / 2, REEL_H * .46, REEL_H * .7);
        var glowK = done ? rOut(rseg(u, 2.45, 2.9)) : .35;
        wg.addColorStop(0, rAlpha(rd.wcol.a, .55 * glowK));
        wg.addColorStop(1, rAlpha(rd.wcol.a, 0));
        ctx.fillStyle = wg;
        ctx.fillRect(-40, -40, REEL_W + 80, REEL_H + 80);
        rBeams(ctx, done ? 1 : .55, t);
        // Dönen ışık hüzmeleri (bitişte)
        if (done) {
            ctx.save();
            ctx.translate(REEL_W / 2, 560);
            ctx.rotate(t * .4);
            ctx.globalAlpha = .18 * glowK;
            ctx.fillStyle = rd.wcol.a;
            for (var r = 0; r < 18; r++) {
                ctx.rotate(Math.PI * 2 / 18);
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1200, -70); ctx.lineTo(1200, 70); ctx.closePath(); ctx.fill();
            }
            ctx.restore();
        }
        var enter = rOut(rseg(u, 0, .4));
        rKicker(ctx, done ? 'MAÇ SONU' : 'SKOR', 250, done ? '#FFC94A' : '#FF3D5A', enter);

        // LED tabela
        var boardW = 600, boardH = 330, bx = (REEL_W - boardW) / 2, by = 390;
        ctx.save();
        ctx.globalAlpha = enter;
        ctx.translate(0, 40 * (1 - enter));
        rRoundRect(ctx, bx, by, boardW, boardH, 30);
        ctx.fillStyle = '#04070E';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = rAlpha('#3BFF8F', .3);
        ctx.stroke();
        var flashH = last && last.side === 'h' && since < .5 ? 1 - since / .5 : 0;
        var flashA = last && last.side === 'a' && since < .5 ? 1 - since / .5 : 0;
        rLedNumber(ctx, cur.h, bx + boardW * .25, by + 70, 22, flashH, '#3BFF8F');
        rLedNumber(ctx, cur.a, bx + boardW * .75, by + 70, 22, flashA, '#3BFF8F');
        ctx.fillStyle = 'rgba(59,255,143,.7)';
        ctx.beginPath(); ctx.arc(REEL_W / 2, by + 150, 8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(REEL_W / 2, by + 196, 8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // Takımlar
        rBadge(ctx, 170, 830, 62, m.homeTeamName, rd.col.h, rd.actual === 'home' && done ? 1 : 0);
        rBadge(ctx, REEL_W - 170, 830, 62, m.awayTeamName, rd.col.a, rd.actual === 'away' && done ? 1 : 0);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(235,242,255,.92)';
        rFit(ctx, m.homeTeamName.toLocaleUpperCase('tr-TR'), 170, 925, 280, 800, 34, true);
        rFit(ctx, m.awayTeamName.toLocaleUpperCase('tr-TR'), REEL_W - 170, 925, 280, 800, 34, true);

        // Kazanan
        if (done) {
            var kw = rBack(rseg(u, 2.5, 2.95));
            var text = rd.actual === 'draw' ? 'BERABERE' : (rd.actual === 'home' ? m.homeTeamName : m.awayTeamName).toLocaleUpperCase('tr-TR') + ' KAZANDI';
            ctx.save();
            ctx.translate(REEL_W / 2, 1060);
            ctx.scale(.5 + .5 * kw, .5 + .5 * kw);
            ctx.globalAlpha = rseg(u, 2.5, 2.7);
            ctx.fillStyle = '#FFFFFF';
            ctx.shadowColor = rd.wcol.a;
            ctx.shadowBlur = 30;
            rFit(ctx, text, 0, 0, REEL_W - 80, 800, 84, true);
            ctx.restore();
        }
        // Gol anlarında beyaz patlama
        if (since < .22) { ctx.fillStyle = 'rgba(255,255,255,' + ((1 - since / .22) * .55) + ')'; ctx.fillRect(-40, -40, REEL_W + 80, REEL_H + 80); }
        ctx.restore();

        // Konfeti
        if (done) {
            var ct = u - 2.45;
            pc.conf.forEach(function (p) {
                var tt = ct - p.delay;
                if (tt <= 0) return;
                var x = p.x + p.vx * tt * .55, y = p.y + p.vy * tt * .55 + 900 * tt * tt;
                if (y > REEL_H + 40) return;
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(p.rot + p.vr * tt);
                ctx.fillStyle = p.c;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.vr * tt)));
                ctx.restore();
            });
        }
    }

    function rImpact(ctx, t, rd) {
        var u = t - REEL_SCENES[4].from;
        var bg = ctx.createRadialGradient(REEL_W / 2, 300, 40, REEL_W / 2, 300, REEL_H);
        bg.addColorStop(0, rAlpha(rd.tone, .28));
        bg.addColorStop(1, '#03060E');
        ctx.fillStyle = '#03060E';
        ctx.fillRect(0, 0, REEL_W, REEL_H);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, REEL_W, REEL_H);
        var ki = rseg(u, 0, .2);
        rKicker(ctx, 'ANALİZ', 230, rd.tone, ki);
        // Damga
        var ks = rseg(u, .1, .45);
        if (ks > 0) {
            var sc = 2.2 - 1.2 * rBack(ks);
            ctx.save();
            ctx.translate(REEL_W / 2, 380);
            ctx.rotate(-.1);
            ctx.scale(sc, sc);
            ctx.globalAlpha = rclamp(ks * 2);
            rFont(ctx, 800, 64, true);
            var tw = Math.min(ctx.measureText(rd.verdict).width, REEL_W - 140);
            rRoundRect(ctx, -tw / 2 - 34, -58, tw + 68, 116, 18);
            ctx.lineWidth = 8;
            ctx.strokeStyle = rd.tone;
            ctx.stroke();
            ctx.fillStyle = rd.tone;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            rFit(ctx, rd.verdict, 0, 4, REEL_W - 140, 800, 64, true);
            ctx.restore();
        }
        var kt = rOut(rseg(u, .45, .8));
        ctx.save();
        ctx.globalAlpha = kt;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(225,234,252,.9)';
        rFont(ctx, 600, 32, false);
        ctx.fillText('Model bu sonuca maçtan önce', REEL_W / 2, 520);
        rFont(ctx, 800, 110, true);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('%' + Math.round(rd.chance * rOut(rseg(u, .5, 1.1))), REEL_W / 2, 610);
        rFont(ctx, 600, 32, false);
        ctx.fillStyle = 'rgba(225,234,252,.9)';
        ctx.fillText('ihtimal veriyordu', REEL_W / 2, 690);
        ctx.restore();

        // Puan tablosuna etkisi
        var items = [
            { name: m.homeTeamName, col: rd.col.h, r: rd.rank.h },
            { name: m.awayTeamName, col: rd.col.a, r: rd.rank.a }
        ];
        items.forEach(function (it, i) {
            var k = rOut(rseg(u, .8 + i * .18, 1.25 + i * .18));
            if (k <= 0) return;
            var y = 800 + i * 150;
            ctx.save();
            ctx.globalAlpha = k;
            ctx.translate(80 * (1 - k) * (i ? 1 : -1), 0);
            rRoundRect(ctx, 60, y, REEL_W - 120, 124, 26);
            ctx.fillStyle = 'rgba(255,255,255,.06)';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = rAlpha(it.col.a, .5);
            ctx.stroke();
            rBadge(ctx, 128, y + 62, 38, it.name, it.col, 0);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#FFFFFF';
            rFit(ctx, it.name.toLocaleUpperCase('tr-TR'), 186, y + 62, 230, 800, 40, true);
            ctx.textAlign = 'right';
            var diff = it.r.b - it.r.a;
            if (rd.rank.known && it.r.b && it.r.a) {
                rFont(ctx, 700, 30, true);
                ctx.fillStyle = 'rgba(200,212,236,.7)';
                ctx.fillText(it.r.b + '.  →', REEL_W - 210, y + 62);
                rFont(ctx, 800, 54, true);
                ctx.fillStyle = '#FFFFFF';
                ctx.fillText(it.r.a + '.', REEL_W - 130, y + 64);
                ctx.fillStyle = diff > 0 ? '#2BD67B' : diff < 0 ? '#FF5A6E' : '#8E9BB5';
                rFont(ctx, 800, 30, true);
                ctx.fillText(diff > 0 ? '▲' + diff : diff < 0 ? '▼' + (-diff) : '=', REEL_W - 80, y + 62);
            } else {
                rFont(ctx, 800, 54, true);
                ctx.fillStyle = '#FFFFFF';
                ctx.fillText((it.r.a || '-') + '.', REEL_W - 96, y + 64);
            }
            ctx.restore();
        });
        var kc = rseg(u, 1.2, 1.4);
        ctx.save();
        ctx.globalAlpha = kc;
        ctx.textAlign = 'center';
        rFont(ctx, 700, 24, false); rSpacing(ctx, 4);
        ctx.fillStyle = 'rgba(200,212,236,.6)';
        ctx.fillText('LİG SIRALAMASI', REEL_W / 2, 1150);
        rSpacing(ctx, 0);
        ctx.restore();
    }

    function rOutro(ctx, t) {
        var u = t - REEL_SCENES[5].from;
        ctx.fillStyle = '#020409';
        ctx.fillRect(0, 0, REEL_W, REEL_H);
        rBeams(ctx, .7, t);
        var k = rBack(rseg(u, 0, .5));
        // LED "90+"
        ctx.save();
        ctx.translate(REEL_W / 2, 520);
        ctx.scale(.6 + .4 * k, .6 + .4 * k);
        ctx.globalAlpha = rseg(u, 0, .25);
        rRoundRect(ctx, -170, -100, 340, 200, 26);
        ctx.fillStyle = '#04070E';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(59,255,143,.3)';
        ctx.stroke();
        rLedNumber(ctx, '90', -36, -62, 14, 0, '#3BFF8F');
        // "+" kırmızı
        ctx.fillStyle = '#FF3D5A';
        ctx.fillRect(96, -14, 52, 14);
        ctx.fillRect(115, -33, 14, 52);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = rOut(rseg(u, .3, .7));
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        rFont(ctx, 800, 118, true);
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(46,123,255,.7)';
        ctx.shadowBlur = 30;
        ctx.fillText('DOKSAN ARTI', REEL_W / 2, 730);
        ctx.shadowBlur = 0;
        rFont(ctx, 600, 32, false);
        ctx.fillStyle = 'rgba(200,212,236,.85)';
        ctx.fillText('Serie A, son düdüğe kadar', REEL_W / 2, 810);
        ctx.restore();
        var out = rseg(u, 1.35, 1.7);
        if (out > 0) { ctx.fillStyle = 'rgba(0,0,0,' + out + ')'; ctx.fillRect(0, 0, REEL_W, REEL_H); }
    }

    // Üstte hikaye çubukları + altta künye: her karede
    function rChrome(ctx, t) {
        var n = REEL_SCENES.length, gap = 8, x0 = 28, w = (REEL_W - x0 * 2 - gap * (n - 1)) / n;
        REEL_SCENES.forEach(function (s, i) {
            var k = rseg(t, s.from, s.to);
            var x = x0 + i * (w + gap);
            rRoundRect(ctx, x, 26, w, 6, 3);
            ctx.fillStyle = 'rgba(255,255,255,.25)';
            ctx.fill();
            if (k > 0) { rRoundRect(ctx, x, 26, Math.max(6, w * k), 6, 3); ctx.fillStyle = '#FFFFFF'; ctx.fill(); }
        });
        ctx.save();
        ctx.textBaseline = 'middle';
        rFont(ctx, 800, 26, true);
        rSpacing(ctx, 2);
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.fillText('DOKSAN ARTI', 30, 70);
        ctx.textAlign = 'right';
        rFont(ctx, 700, 22, false);
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        ctx.fillText(DA.teamCode(m.homeTeamName) + ' ' + (m.homeScore || 0) + '-' + (m.awayScore || 0) + ' ' + DA.teamCode(m.awayTeamName), REEL_W - 30, 70);
        rSpacing(ctx, 0);
        ctx.restore();
    }

    function drawReel(ctx, t, rd, pc, goals) {
        ctx.save();
        if (t < REEL_SCENES[1].from) rIntro(ctx, t, rd, pc);
        else if (t < REEL_SCENES[2].from) rVersus(ctx, t, rd);
        else if (t < REEL_SCENES[3].from) rModel(ctx, t, rd);
        else if (t < REEL_SCENES[4].from) rScore(ctx, t, rd, pc, goals);
        else if (t < REEL_SCENES[5].from) rImpact(ctx, t, rd);
        else rOutro(ctx, t);
        ctx.restore();
        rChrome(ctx, t);
    }

    /* ---- Ses: taraftar, düdük, korna, gümbürtü ---- */
    function reelAudio(goals) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        var ac;
        try { ac = new AC(); } catch (e) { return null; }
        var dest = ac.createMediaStreamDestination();
        var master = ac.createGain();
        master.gain.value = .9;
        master.connect(dest);
        var monitor = ac.createGain();
        monitor.gain.value = .55;
        master.connect(monitor);
        monitor.connect(ac.destination);
        var t0 = ac.currentTime + .05;

        // Kalabalık: filtrelenmiş gürültü döngüsü
        var len = ac.sampleRate * 2;
        var buf = ac.createBuffer(2, len, ac.sampleRate);
        for (var ch = 0; ch < 2; ch++) {
            var dd = buf.getChannelData(ch), last = 0;
            for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; last = (last + .04 * w) / 1.04; dd[i] = last * 3.2; }
        }
        var noise = ac.createBufferSource();
        noise.buffer = buf;
        noise.loop = true;
        var bp = ac.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = .6;
        var crowd = ac.createGain();
        crowd.gain.setValueAtTime(0, t0);
        crowd.gain.linearRampToValueAtTime(.25, t0 + .8);
        crowd.gain.linearRampToValueAtTime(.4, t0 + 2.9);
        crowd.gain.linearRampToValueAtTime(.28, t0 + 4.2);
        crowd.gain.linearRampToValueAtTime(.2, t0 + 7.2);
        noise.connect(bp); bp.connect(crowd); crowd.connect(master);
        noise.start(t0);
        noise.stop(t0 + REEL_DUR + .3);

        function whistle(at, dur) {
            var o = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
            o.type = 'sine'; o.frequency.value = 2950;
            lfo.frequency.value = 32; lg.gain.value = 140;
            lfo.connect(lg); lg.connect(o.frequency);
            g.gain.setValueAtTime(0, at);
            g.gain.linearRampToValueAtTime(.16, at + .02);
            g.gain.setValueAtTime(.16, at + dur - .04);
            g.gain.linearRampToValueAtTime(0, at + dur);
            o.connect(g); g.connect(master);
            o.start(at); lfo.start(at); o.stop(at + dur + .05); lfo.stop(at + dur + .05);
        }
        function boom(at) {
            var o = ac.createOscillator(), g = ac.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(110, at);
            o.frequency.exponentialRampToValueAtTime(32, at + .55);
            g.gain.setValueAtTime(.0001, at);
            g.gain.exponentialRampToValueAtTime(.9, at + .015);
            g.gain.exponentialRampToValueAtTime(.0001, at + .7);
            o.connect(g); g.connect(master);
            o.start(at); o.stop(at + .75);
        }
        function horn(at) {
            [233, 311, 466].forEach(function (f, i) {
                var o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
                o.type = 'sawtooth'; o.frequency.value = f;
                lp.type = 'lowpass'; lp.frequency.value = 1800;
                g.gain.setValueAtTime(.0001, at);
                g.gain.exponentialRampToValueAtTime(.11 / (i + 1), at + .04);
                g.gain.setValueAtTime(.11 / (i + 1), at + .42);
                g.gain.exponentialRampToValueAtTime(.0001, at + .7);
                o.connect(lp); lp.connect(g); g.connect(master);
                o.start(at); o.stop(at + .75);
            });
            crowd.gain.setValueAtTime(crowd.gain.value, at);
            crowd.gain.linearRampToValueAtTime(.75, at + .08);
            crowd.gain.linearRampToValueAtTime(.42, at + .9);
        }

        whistle(t0 + .4, .2); whistle(t0 + .7, .55);
        boom(t0 + REEL_SCENES[1].from + .58);
        goals.forEach(function (g) { horn(t0 + g.t); boom(t0 + g.t); });
        var end = t0 + REEL_SCENES[3].from + 2.2;
        whistle(end, .22); whistle(end + .32, .22); whistle(end + .64, .9);
        crowd.gain.setValueAtTime(.42, end + 1.3);
        crowd.gain.linearRampToValueAtTime(.85, end + 1.5);
        crowd.gain.linearRampToValueAtTime(.35, end + 3.4);
        crowd.gain.linearRampToValueAtTime(0, t0 + REEL_DUR);
        boom(t0 + REEL_SCENES[5].from + .05);

        return { ctx: ac, stream: dest.stream, close: function () { try { ac.close(); } catch (e) { } } };
    }

    function reelMime() {
        if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return null;
        // MP4 öncelikli: WhatsApp, Instagram ve iPhone doğrudan açar; yoksa WebM
        // (yalnızca gerçek H.264 varsa; düz "video/mp4" bazı tarayıcılarda VP9 üretir)
        var list = ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4;codecs=avc1,opus',
            'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
        for (var i = 0; i < list.length; i++) if (MediaRecorder.isTypeSupported(list[i])) return list[i];
        return null;
    }

    /* ---- Stüdyo penceresi ---- */
    var reelEl = null, reelBusy = false, reelUrl = null, reelLastFocus = null, reelStop = null;

    function buildReelLayer() {
        if (reelEl) return reelEl;
        var el = document.createElement('div');
        el.className = 'md-reel';
        el.hidden = true;
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-labelledby', 'mdReelTitle');
        el.innerHTML =
            '<div class="md-reel__backdrop" data-reel-close></div>' +
            '<div class="md-reel__studio">' +
            '<div class="md-reel__stage">' +
            '<div class="md-reel__phone">' +
            '<canvas class="md-reel__canvas" width="' + REEL_W + '" height="' + REEL_H + '" data-reel-canvas></canvas>' +
            '<video class="md-reel__video" data-reel-video playsinline loop controls hidden></video>' +
            '<span class="md-reel__rec" data-reel-rec><i></i>REC</span>' +
            '</div>' +
            '</div>' +
            '<div class="md-reel__panel">' +
            '<button type="button" class="md-reel__close" data-reel-close aria-label="Kapat"><svg aria-hidden="true"><use href="#i-x"/></svg></button>' +
            '<p class="md-reel__kicker"><svg aria-hidden="true"><use href="#i-film"/></svg>Maç özeti videosu</p>' +
            '<h2 class="md-reel__title" id="mdReelTitle"></h2>' +
            '<p class="md-reel__status" data-reel-status aria-live="polite"></p>' +
            '<div class="md-reel__progress"><span data-reel-bar></span></div>' +
            '<ol class="md-reel__scenes" data-reel-scenes></ol>' +
            '<p class="md-reel__note" data-reel-note>Kayıt bitene kadar bu sekmede kal. Sesi de videoya işleniyor.</p>' +
            '<div class="md-reel__actions" data-reel-actions hidden>' +
            '<a class="da-btn da-btn--primary" data-reel-download download><svg aria-hidden="true"><use href="#i-down"/></svg>Videoyu indir</a>' +
            '<button type="button" class="da-btn" data-reel-share hidden><svg aria-hidden="true"><use href="#i-share"/></svg>Paylaş</button>' +
            '<button type="button" class="da-btn" data-reel-again><svg aria-hidden="true"><use href="#i-play"/></svg>Yeniden oluştur</button>' +
            '</div>' +
            '<div class="md-reel__actions" data-reel-fallback hidden>' +
            '<button type="button" class="da-btn da-btn--primary" data-reel-card><svg aria-hidden="true"><use href="#i-share"/></svg>Maç kartını indir</button>' +
            '</div>' +
            '</div>' +
            '</div>';
        document.body.appendChild(el);
        $$('[data-reel-close]', el).forEach(function (b) { b.addEventListener('click', closeReel); });
        $('[data-reel-again]', el).addEventListener('click', function () { startReel(); });
        $('[data-reel-card]', el).addEventListener('click', function () { closeReel(); shareCard(); });
        $('[data-reel-share]', el).addEventListener('click', shareReel);
        reelEl = el;
        return el;
    }

    function reelKey(e) {
        if (e.key === 'Escape') closeReel();
    }

    function setReelState(state, info) {
        var el = reelEl;
        el.setAttribute('data-state', state);
        var status = $('[data-reel-status]', el);
        var rec = $('[data-reel-rec]', el);
        rec.hidden = state !== 'recording';
        $('[data-reel-actions]', el).hidden = state !== 'done';
        $('[data-reel-fallback]', el).hidden = state !== 'unsupported' && state !== 'error';
        $('[data-reel-note]', el).hidden = state !== 'recording';
        $('[data-reel-canvas]', el).hidden = state === 'done';
        $('[data-reel-video]', el).hidden = state !== 'done';
        if (state === 'recording') status.textContent = 'Video hazırlanıyor… %0';
        if (state === 'done') status.innerHTML = '<strong>Hazır!</strong> ' + esc(info || '');
        if (state === 'unsupported') status.textContent = 'Bu tarayıcı video kaydını desteklemiyor. Chrome veya Edge ile dene, ya da maç kartını görsel olarak indir.';
        if (state === 'error') status.textContent = 'Video oluşturulamadı. Tekrar dene ya da maç kartını görsel olarak indir.';
    }

    function openReel() {
        if (mode() !== 'done') return;
        var el = buildReelLayer();
        $('#mdReelTitle', el).textContent = m.homeTeamName + ' ' + (m.homeScore || 0) + '-' + (m.awayScore || 0) + ' ' + m.awayTeamName;
        $('[data-reel-scenes]', el).innerHTML = REEL_SCENES.map(function (s, i) {
            return '<li data-reel-scene="' + i + '"><i>' + (i + 1) + '</i>' + esc(s.label) + '</li>';
        }).join('');
        reelLastFocus = document.activeElement;
        el.hidden = false;
        document.documentElement.classList.add('da-story-open');
        document.addEventListener('keydown', reelKey);
        void el.offsetWidth;
        el.classList.add('is-open');
        $('.md-reel__close', el).focus();
        startReel();
    }

    function closeReel() {
        if (!reelEl || reelEl.hidden) return;
        if (reelStop) reelStop(true);
        var v = $('[data-reel-video]', reelEl);
        try { v.pause(); } catch (e) { }
        reelEl.classList.remove('is-open');
        reelEl.hidden = true;
        document.documentElement.classList.remove('da-story-open');
        document.removeEventListener('keydown', reelKey);
        if (reelLastFocus && reelLastFocus.focus) reelLastFocus.focus();
    }

    function startReel() {
        if (reelBusy) return;
        var el = reelEl;
        var canvas = $('[data-reel-canvas]', el);
        var ctx = canvas.getContext('2d');
        var mime = reelMime();
        var rd = reelData();
        var pc = reelParticles(rd);
        var goals = reelGoalTimes(rd);
        var bar = $('[data-reel-bar]', el);
        var status = $('[data-reel-status]', el);
        var sceneItems = $$('[data-reel-scene]', el);
        bar.style.width = '0%';
        sceneItems.forEach(function (li) { li.className = ''; });

        // Önizleme karesi: kayıt yoksa da sahne görünsün
        var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
        if (!mime || !canvas.captureStream) {
            fonts.then(function () { drawReel(ctx, 8.6, rd, pc, goals); });
            setReelState('unsupported');
            return;
        }
        if (reelUrl) { URL.revokeObjectURL(reelUrl); reelUrl = null; }
        reelBusy = true;
        setReelState('recording');

        fonts.then(function () {
            var stream = canvas.captureStream(REEL_FPS);
            var audio = reelAudio(goals);
            if (audio) audio.stream.getAudioTracks().forEach(function (tr) { stream.addTrack(tr); });
            var chunks = [];
            var rec;
            try { rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 }); }
            catch (e) {
                try { rec = new MediaRecorder(stream); } catch (e2) { reelBusy = false; if (audio) audio.close(); setReelState('error'); return; }
            }
            var cancelled = false, raf = 0, start = 0;
            rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
            rec.onstop = function () {
                window.cancelAnimationFrame(raf);
                stream.getTracks().forEach(function (tr) { tr.stop(); });
                if (audio) audio.close();
                reelBusy = false;
                reelStop = null;
                if (cancelled) return;
                var type = (rec.mimeType || mime).split(';')[0];
                var blob = new Blob(chunks, { type: type });
                if (!blob.size) { setReelState('error'); return; }
                var ext = type.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
                var name = 'doksan-arti-ozet-' + DA.teamCode(m.homeTeamName).toLowerCase() + '-' + DA.teamCode(m.awayTeamName).toLowerCase() + '.' + ext;
                reelUrl = URL.createObjectURL(blob);
                var video = $('[data-reel-video]', el);
                video.src = reelUrl;
                var dl = $('[data-reel-download]', el);
                dl.href = reelUrl;
                dl.setAttribute('download', name);
                el.__reelFile = { blob: blob, name: name, type: type };
                var shareBtn = $('[data-reel-share]', el);
                var canShare = false;
                try { canShare = !!(navigator.canShare && navigator.canShare({ files: [new File([blob], name, { type: type })] })); } catch (e) { canShare = false; }
                shareBtn.hidden = !canShare;
                bar.style.width = '100%';
                sceneItems.forEach(function (li) { li.className = 'is-done'; });
                setReelState('done', REEL_DUR.toFixed(0) + ' saniyelik ' + ext.toUpperCase() + ' videon hazır, ' + (blob.size / 1048576).toFixed(1).replace('.', ',') + ' MB.');
                video.muted = false;
                var pl = video.play();
                if (pl && pl.catch) pl.catch(function () { video.muted = true; video.play().catch(function () { }); });
                DA.toast('Maç özeti videosu hazır.', 'success');
            };
            reelStop = function (cancel) {
                cancelled = !!cancel;
                if (rec.state !== 'inactive') rec.stop();
            };

            function frame(now) {
                if (!start) start = now;
                var t = (now - start) / 1000;
                if (t > REEL_DUR) t = REEL_DUR;
                drawReel(ctx, t, rd, pc, goals);
                var pct = Math.round(t / REEL_DUR * 100);
                bar.style.width = pct + '%';
                status.textContent = 'Video hazırlanıyor… %' + pct;
                REEL_SCENES.forEach(function (s, i) {
                    var li = sceneItems[i];
                    if (!li) return;
                    li.className = t >= s.to ? 'is-done' : t >= s.from ? 'is-on' : '';
                });
                if (t >= REEL_DUR) { window.setTimeout(function () { if (rec.state !== 'inactive') rec.stop(); }, 250); return; }
                raf = window.requestAnimationFrame(frame);
            }
            drawReel(ctx, 0, rd, pc, goals);
            rec.start(250);
            raf = window.requestAnimationFrame(frame);
        });
    }

    function shareReel() {
        var f = reelEl && reelEl.__reelFile;
        if (!f || !navigator.share) return;
        var file = new File([f.blob], f.name, { type: f.type });
        navigator.share({ files: [file], title: m.homeTeamName + ' ' + (m.homeScore || 0) + '-' + (m.awayScore || 0) + ' ' + m.awayTeamName, text: 'Doksan Artı maç özeti' }).catch(function () { });
    }

    var reelBtn = $('[data-reel-open]');
    if (reelBtn) reelBtn.addEventListener('click', openReel);
})();
