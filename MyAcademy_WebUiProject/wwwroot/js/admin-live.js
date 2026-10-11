/* =================================================================
   Doksan Artı — Teknik Masa canlı masa (admin-live.js)
   1  Durum ve yardımcılar
   2  Skorbordlar (canlı maçlar): gol ekle/geri al, bitir, ertele
   3  Başlamayı bekleyenler: maçı başlat
   4  Son 24 saatte bitenler: canlıya geri al
   5  Canlı puan durumu (yükselen/düşen oklarıyla)
   6  Kaydetme kuyruğu, gol anı, otomatik yenileme
   ================================================================= */
(function () {
    'use strict';

    var TM = window.TM;
    if (!TM || !TM.league) return;

    var L = TM.league;
    var $ = TM.$;
    var $$ = TM.$$;

    /* ---------------------------------------------------------
       1. Durum ve yardımcılar
       --------------------------------------------------------- */
    var state = {
        teams: [],
        matches: [],
        busy: {},       // kaydı süren maçlar: yenileme bu maçların ekrandaki halini ezmesin
        boards: {}      // maç id -> { el, home, away, minute, ... }
    };

    var els = {
        boards: $('[data-live-boards]'),
        empty: $('[data-live-empty]'),
        emptyText: $('[data-live-empty-text]'),
        liveCount: $('[data-live-count]'),
        wait: $('[data-wait-list]'),
        waitEmpty: $('[data-wait-empty]'),
        waitCount: $('[data-wait-count]'),
        done: $('[data-done-list]'),
        doneEmpty: $('[data-done-empty]'),
        doneCount: $('[data-done-count]'),
        table: $('[data-live-table]'),
        onair: $('[data-onair]'),
        flash: $('[data-goalflash]'),
        flashTeam: $('[data-goalflash-team]')
    };

    function load(d) {
        state.teams = d.teams || [];
        var incoming = d.matches || [];
        // Kaydı süren maçların yerel halini koru
        state.matches = incoming.map(function (m) {
            if (!state.busy[m.id]) return m;
            var local = byId(m.id, state.matches);
            return local || m;
        });
    }

    function byId(id, list) {
        id = Number(id);
        return (list || state.matches).filter(function (m) { return m.id === id; })[0] || null;
    }

    function time(m) { return TM.toDate(m.matchDate).getTime(); }

    function relative(ms) {
        var past = ms < 0;
        var min = Math.round(Math.abs(ms) / 60000);
        var text;
        if (min < 1) text = 'şimdi';
        else if (min >= 1440) text = Math.round(min / 1440) + ' gün';
        else if (min < 60) text = min + ' dk';
        else {
            var h = Math.floor(min / 60);
            var rest = min % 60;
            text = h + ' sa' + (rest ? ' ' + rest + ' dk' : '');
        }
        if (text === 'şimdi') return text;
        return past ? text + ' geçti' : text + ' sonra';
    }

    function score(m, side) {
        var v = side === 'home' ? m.homeScore : m.awayScore;
        return v == null ? 0 : v;
    }

    function teamName(m, side) { return side === 'home' ? m.homeTeamName : m.awayTeamName; }

    /* ---------------------------------------------------------
       2. Skorbordlar
       --------------------------------------------------------- */
    function boardHtml(m) {
        return '<article class="tm-sboard" data-id="' + m.id + '" tabindex="-1">' +
            '<span class="tm-sboard__glow" aria-hidden="true"></span>' +
            '<header class="tm-sboard__top">' +
            '<span class="tm-sboard__live"><i class="tm-pulse" aria-hidden="true"></i>Canlı</span>' +
            '<span class="da-board tm-sboard__clock"><span class="da-led da-led--xs" data-minute></span></span>' +
            '<span class="tm-sboard__phase" data-phase></span>' +
            '<span class="tm-sboard__meta">' + m.week + '. hafta · ' + TM.esc(m.stadium || '') + '</span>' +
            '</header>' +
            '<div class="tm-sboard__body">' +
            teamHtml(m, 'home') +
            '<div class="tm-sboard__score">' +
            sideHtml(m, 'home') +
            '<span class="tm-sboard__colon" aria-hidden="true"><i></i><i></i></span>' +
            sideHtml(m, 'away') +
            '</div>' +
            teamHtml(m, 'away') +
            '</div>' +
            '<footer class="tm-sboard__foot">' +
            '<button type="button" class="tm-btn tm-btn--success tm-btn--small" data-finish><svg class="tm-icon" aria-hidden="true"><use href="#tm-i-whistle"/></svg>Maçı bitir</button>' +
            '<button type="button" class="tm-btn tm-btn--small" data-postpone><svg class="tm-icon" aria-hidden="true"><use href="#tm-i-pause"/></svg>Ertele</button>' +
            '<a class="tm-btn tm-btn--small" href="/Admin/Matches?edit=' + m.id + '"><svg class="tm-icon" aria-hidden="true"><use href="#tm-i-edit"/></svg>Düzenle</a>' +
            '<span class="tm-sboard__saving" data-saving aria-live="polite"></span>' +
            '</footer>' +
            '</article>';
    }

    function teamHtml(m, side) {
        var name = teamName(m, side);
        var logo = side === 'home' ? m.homeTeamLogo : m.awayTeamLogo;
        return '<div class="tm-sboard__team tm-sboard__team--' + side + '">' +
            '<span class="tm-sboard__crest">' + TM.crest(name, logo, 'lg') + '</span>' +
            '<strong>' + TM.esc(name) + '</strong>' +
            '<span>' + (side === 'home' ? 'Ev sahibi' : 'Deplasman') + '</span>' +
            '</div>';
    }

    function sideHtml(m, side) {
        var name = teamName(m, side);
        return '<div class="tm-sboard__side" data-side="' + side + '">' +
            '<button type="button" class="tm-goalbtn" data-goal="' + side + '" aria-label="' + TM.esc(name) + ' gol attı">' +
            '<svg class="tm-icon" aria-hidden="true"><use href="#tm-i-plus"/></svg>Gol</button>' +
            '<span class="da-board tm-sboard__digits" tabindex="0" role="spinbutton" aria-valuemin="0" aria-valuemax="99" ' +
            'aria-label="' + TM.esc(name) + ' golleri" data-digits="' + side + '"><span class="da-led da-led--md" data-led="' + side + '"></span></span>' +
            '<button type="button" class="tm-undobtn" data-undo="' + side + '" aria-label="' + TM.esc(name) + ' golünü geri al">' +
            '<svg class="tm-icon" aria-hidden="true"><use href="#tm-i-minus"/></svg>Geri al</button>' +
            '</div>';
    }

    function setDigits(b, side, value, animate) {
        var text = String(value);
        var holder = b[side + 'El'];
        if (!b[side] || b[side + 'Len'] !== text.length) {
            b[side] = TM.led(holder, text.replace(/./g, ' '), 'green', false);
            b[side + 'Len'] = text.length;
            b[side + 'Text'] = '';
        }
        if (b[side + 'Text'] === text) return;
        b[side].setText(text, animate && !TM.reduceMotion ? { stagger: 260 } : null);
        b[side + 'Text'] = text;
        var digits = $('[data-digits="' + side + '"]', b.el);
        digits.setAttribute('aria-valuenow', value);
        digits.setAttribute('aria-valuetext', teamName(b.match, side) + ' ' + value + ' gol');
        $('[data-undo="' + side + '"]', b.el).disabled = value <= 0;
    }

    function updateClock(b) {
        var clock = L.liveClock(b.match);
        var text = (clock.text + '   ').slice(0, 3);
        if (!b.minute) b.minute = TM.led($('[data-minute]', b.el), '   ', 'red', false);
        if (b.minuteText !== text) {
            b.minute.setText(text, b.minuteText && !TM.reduceMotion ? null : { stagger: 240 });
            b.minuteText = text;
        }
        $('[data-phase]', b.el).textContent = clock.label;
        b.el.classList.toggle('is-break', clock.phase === 'break');
    }

    function renderBoards() {
        var live = state.matches.filter(L.isLive).sort(L.byDate);
        var ids = live.map(function (m) { return String(m.id); });

        // Artık canlı olmayanları kaldır
        Object.keys(state.boards).forEach(function (id) {
            if (ids.indexOf(id) >= 0) return;
            var b = state.boards[id];
            b.el.classList.add('is-leaving');
            window.setTimeout(function () { if (b.el.parentNode) b.el.parentNode.removeChild(b.el); }, TM.reduceMotion ? 0 : 380);
            delete state.boards[id];
        });

        live.forEach(function (m, i) {
            var b = state.boards[m.id];
            if (!b) {
                els.boards.insertAdjacentHTML('beforeend', boardHtml(m));
                var el = els.boards.querySelector('.tm-sboard[data-id="' + m.id + '"]');
                el.style.setProperty('--i', i);
                b = state.boards[m.id] = { el: el, match: m, homeEl: $('[data-led="home"]', el), awayEl: $('[data-led="away"]', el) };
                bindBoard(b);
            }
            b.match = m;
            setDigits(b, 'home', score(m, 'home'), true);
            setDigits(b, 'away', score(m, 'away'), true);
            updateClock(b);
        });

        els.liveCount.textContent = live.length;
        els.empty.hidden = live.length > 0;
        els.onair.textContent = live.length ? 'Yayında · ' + live.length + ' canlı maç' : 'Yayın masası';
        document.body.classList.toggle('tm-has-live', live.length > 0);

        if (!live.length) {
            var next = L.nextMatch(state.matches);
            els.emptyText.textContent = next
                ? 'Sıradaki maç ' + next.homeTeamName + ' - ' + next.awayTeamName + ', ' + TM.fmtLong.format(TM.toDate(next.matchDate)) + ' ' + TM.fmtTime.format(TM.toDate(next.matchDate)) + '.'
                : 'Planlanmış maç da yok. Maçlar sayfasından yeni maç ekleyebilirsin.';
        }
    }

    function bindBoard(b) {
        b.el.addEventListener('click', function (e) {
            var goal = e.target.closest('[data-goal]');
            var undo = e.target.closest('[data-undo]');
            if (goal) changeScore(b, goal.getAttribute('data-goal'), 1);
            else if (undo) changeScore(b, undo.getAttribute('data-undo'), -1);
            else if (e.target.closest('[data-finish]')) finish(b.match);
            else if (e.target.closest('[data-postpone]')) postpone(b.match);
        });
        $$('[data-digits]', b.el).forEach(function (d) {
            d.addEventListener('keydown', function (e) {
                var side = d.getAttribute('data-digits');
                if (e.key === 'ArrowUp' || e.key === '+') { e.preventDefault(); changeScore(b, side, 1); }
                else if (e.key === 'ArrowDown' || e.key === '-') { e.preventDefault(); changeScore(b, side, -1); }
            });
        });
    }

    function changeScore(b, side, delta) {
        var m = b.match;
        var current = score(m, side);
        var next = Math.max(0, Math.min(99, current + delta));
        if (next === current) return;

        var patch = side === 'home' ? { homeScore: next, awayScore: score(m, 'away') } : { awayScore: next, homeScore: score(m, 'home') };
        var before = { homeScore: m.homeScore, awayScore: m.awayScore };
        Object.assign(m, patch);
        setDigits(b, side, next, true);
        renderTable();

        if (delta > 0) goalMoment(b, side);
        save(m, patch, function () {
            Object.assign(m, before);
            setDigits(b, 'home', score(m, 'home'), false);
            setDigits(b, 'away', score(m, 'away'), false);
            renderTable();
        }, delta > 0
            ? 'Gol! ' + m.homeTeamName + ' ' + m.homeScore + '-' + m.awayScore + ' ' + m.awayTeamName
            : 'Gol geri alındı: ' + m.homeTeamName + ' ' + m.homeScore + '-' + m.awayScore + ' ' + m.awayTeamName);
    }

    function goalMoment(b, side) {
        var digits = $('[data-digits="' + side + '"]', b.el);
        digits.classList.remove('is-goal');
        b.el.classList.remove('is-goal-home', 'is-goal-away');
        void digits.offsetWidth;
        digits.classList.add('is-goal');
        b.el.classList.add('is-goal-' + side);
        window.setTimeout(function () {
            digits.classList.remove('is-goal');
            b.el.classList.remove('is-goal-' + side);
        }, 1600);

        if (!els.flash || TM.reduceMotion) return;
        els.flashTeam.textContent = teamName(b.match, side);
        els.flash.hidden = false;
        els.flash.classList.remove('is-on');
        void els.flash.offsetWidth;
        els.flash.classList.add('is-on');
        window.clearTimeout(goalMoment.t);
        goalMoment.t = window.setTimeout(function () { els.flash.hidden = true; els.flash.classList.remove('is-on'); }, 1700);
    }

    function finish(m) {
        var html = '<strong>' + TM.esc(m.homeTeamName) + ' ' + score(m, 'home') + ' - ' + score(m, 'away') + ' ' + TM.esc(m.awayTeamName) + '</strong><br>' +
            'Maç tamamlandı olarak kaydedilecek ve sonuç puan durumuna işlenecek.';
        TM.confirm({
            title: 'Maçı bitir',
            html: html,
            confirmLabel: 'Bitiş düdüğünü çal',
            tone: 'success',
            action: function () { return TM.saveMatch(m, { status: L.FINISHED, homeScore: score(m, 'home'), awayScore: score(m, 'away') }); }
        }).then(function (result) {
            if (!result) return;
            TM.toast('Maç sonu: ' + m.homeTeamName + ' ' + score(m, 'home') + '-' + score(m, 'away') + ' ' + m.awayTeamName, 'success');
            refresh();
        });
    }

    function postpone(m) {
        TM.confirm({
            title: 'Maçı ertele',
            html: '<strong>' + TM.esc(m.homeTeamName) + ' - ' + TM.esc(m.awayTeamName) + '</strong> ertelenmiş olarak işaretlenecek, skoru silinecek.',
            confirmLabel: 'Ertele',
            tone: 'primary',
            action: function () { return TM.saveMatch(m, { status: L.POSTPONED }); }
        }).then(function (result) {
            if (!result) return;
            TM.toast(m.homeTeamName + ' - ' + m.awayTeamName + ' ertelendi.', 'info');
            refresh();
        });
    }

    /* ---------------------------------------------------------
       3. Başlamayı bekleyenler
       --------------------------------------------------------- */
    function renderWaiting() {
        var now = Date.now();
        var list = state.matches.filter(function (m) {
            if (m.status !== L.PLANNED) return false;
            var t = time(m);
            return t <= now + 36 * 3600 * 1000 && t >= now - 7 * 24 * 3600 * 1000;
        }).sort(L.byDate);

        els.waitCount.textContent = list.length;
        els.waitEmpty.hidden = list.length > 0;
        els.wait.innerHTML = list.map(function (m, i) {
            var d = TM.toDate(m.matchDate);
            var diff = time(m) - now;
            var late = diff < 0;
            return '<li class="tm-qitem' + (late ? ' is-late' : diff < 3600000 ? ' is-soon' : '') + '" style="--i:' + i + '">' +
                '<span class="tm-qitem__time"><strong>' + TM.fmtTime.format(d) + '</strong><small>' + TM.esc(TM.fmtShort.format(d)) + '</small></span>' +
                '<span class="tm-qitem__teams">' +
                '<span>' + TM.crest(m.homeTeamName, m.homeTeamLogo, 'sm') + TM.esc(m.homeTeamName) + '</span>' +
                '<span>' + TM.crest(m.awayTeamName, m.awayTeamLogo, 'sm') + TM.esc(m.awayTeamName) + '</span>' +
                '</span>' +
                '<span class="tm-qitem__meta"><b>' + (late ? 'Saati ' : '') + relative(diff) + '</b>' + m.week + '. hafta · ' + TM.esc(m.stadium || '') + '</span>' +
                '<button type="button" class="tm-btn tm-btn--live tm-btn--small" data-start="' + m.id + '"><svg class="tm-icon" aria-hidden="true"><use href="#tm-i-play"/></svg>Başlat</button>' +
                '</li>';
        }).join('');
    }

    els.wait.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-start]');
        if (!btn) return;
        var m = byId(btn.getAttribute('data-start'));
        if (!m) return;
        var diff = time(m) - Date.now();
        var start = function () {
            TM.setBusy(btn, true);
            return TM.saveMatch(m, { status: L.LIVE, homeScore: 0, awayScore: 0 }).then(function (r) {
                TM.setBusy(btn, false);
                if (!r.ok) { TM.toast(r.message || 'Maç başlatılamadı.', 'error'); return r; }
                TM.toast('Başlama düdüğü: ' + m.homeTeamName + ' - ' + m.awayTeamName, 'success');
                refresh().then(function () {
                    var b = state.boards[m.id];
                    if (b) b.el.scrollIntoView({ block: 'center', behavior: TM.reduceMotion ? 'auto' : 'smooth' });
                });
                return r;
            });
        };
        if (diff > 30 * 60000) {
            TM.confirm({
                title: 'Maç saati gelmedi',
                html: '<strong>' + TM.esc(m.homeTeamName) + ' - ' + TM.esc(m.awayTeamName) + '</strong> maçının başlama saati ' +
                    TM.fmtTime.format(TM.toDate(m.matchDate)) + ' (' + relative(diff) + '). Yine de canlıya alınsın mı?',
                confirmLabel: 'Yine de başlat',
                action: start
            });
        } else {
            start();
        }
    });

    /* ---------------------------------------------------------
       4. Son 24 saatte bitenler
       --------------------------------------------------------- */
    function renderDone() {
        var now = Date.now();
        var list = state.matches.filter(function (m) {
            return L.isFinished(m) && time(m) >= now - 24 * 3600 * 1000 && time(m) <= now;
        }).sort(function (a, b) { return time(b) - time(a); });

        els.doneCount.textContent = list.length;
        els.doneEmpty.hidden = list.length > 0;
        els.done.innerHTML = list.map(function (m, i) {
            var hw = m.homeScore > m.awayScore, aw = m.awayScore > m.homeScore;
            return '<li class="tm-final" style="--i:' + i + '">' +
                '<span class="tm-final__team' + (hw ? ' is-win' : '') + '">' + TM.esc(m.homeTeamName) + TM.crest(m.homeTeamName, m.homeTeamLogo, 'sm') + '</span>' +
                '<span class="tm-final__score">' + m.homeScore + '<i>-</i>' + m.awayScore + '</span>' +
                '<span class="tm-final__team tm-final__team--away' + (aw ? ' is-win' : '') + '">' + TM.crest(m.awayTeamName, m.awayTeamLogo, 'sm') + TM.esc(m.awayTeamName) + '</span>' +
                '<span class="tm-final__meta">MS · ' + TM.fmtTime.format(TM.toDate(m.matchDate)) + '</span>' +
                '<button type="button" class="tm-iconbtn tm-final__reopen" data-reopen="' + m.id + '" title="Yanlışlıkla bitirildiyse canlıya geri al" aria-label="Canlıya geri al">' +
                '<svg class="tm-icon" aria-hidden="true"><use href="#tm-i-live"/></svg></button>' +
                '</li>';
        }).join('');
    }

    els.done.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-reopen]');
        if (!btn) return;
        var m = byId(btn.getAttribute('data-reopen'));
        if (!m) return;
        TM.confirm({
            title: 'Canlıya geri al',
            html: '<strong>' + TM.esc(m.homeTeamName) + ' ' + m.homeScore + '-' + m.awayScore + ' ' + TM.esc(m.awayTeamName) + '</strong> yeniden canlı olarak işaretlenecek. Skor korunur.',
            confirmLabel: 'Canlıya al',
            action: function () { return TM.saveMatch(m, { status: L.LIVE }); }
        }).then(function (r) {
            if (!r) return;
            TM.toast('Maç yeniden canlıda.', 'success');
            refresh();
        });
    });

    /* ---------------------------------------------------------
       5. Canlı puan durumu
       --------------------------------------------------------- */
    function renderTable() {
        var base = L.table(state.teams, state.matches);
        var live = L.table(state.teams, state.matches, { includeLive: true });
        var baseRank = {};
        base.forEach(function (r) { baseRank[r.id] = r.rank; });
        var playing = {};
        state.matches.filter(L.isLive).forEach(function (m) { playing[m.homeTeamId] = true; playing[m.awayTeamId] = true; });

        els.table.innerHTML = live.map(function (r, i) {
            var move = baseRank[r.id] - r.rank;
            var z = L.zone(r.rank, live.length);
            var arrow = move > 0
                ? '<span class="tm-move tm-move--up" title="' + move + ' sıra yükseliyor"><svg class="tm-icon" aria-hidden="true"><use href="#tm-i-up"/></svg>' + move + '</span>'
                : move < 0
                    ? '<span class="tm-move tm-move--down" title="' + (-move) + ' sıra düşüyor"><svg class="tm-icon" aria-hidden="true"><use href="#tm-i-down"/></svg>' + (-move) + '</span>'
                    : '';
            var gd = r.gd > 0 ? '+' + r.gd : String(r.gd);
            return '<tr class="' + (z ? 'zone-' + z : '') + (playing[r.id] ? ' is-playing' : '') + (move ? ' is-moving' : '') + '" style="--i:' + i + '">' +
                '<td class="tm-mini-table__rank">' + r.rank + '</td>' +
                '<th scope="row"><span class="tm-mini-table__team">' + TM.crest(r.name, r.logoUrl, 'xs') + '<span>' + TM.esc(r.name) + '</span>' +
                (playing[r.id] ? '<i class="tm-livetable__dot" title="Şu an sahada"></i>' : '') + arrow + '</span></th>' +
                '<td>' + r.played + '</td><td>' + gd + '</td><td class="tm-mini-table__pts">' + r.points + '</td></tr>';
        }).join('');
    }

    /* ---------------------------------------------------------
       6. Kaydetme kuyruğu ve yenileme
       Aynı maç için art arda tıklamalar sırayla gönderilir
       --------------------------------------------------------- */
    var queues = {};

    function save(m, patch, revert, message) {
        var id = m.id;
        state.busy[id] = (state.busy[id] || 0) + 1;
        var b = state.boards[id];
        var saving = b ? $('[data-saving]', b.el) : null;
        if (saving) { saving.textContent = 'Kaydediliyor…'; saving.classList.add('is-on'); }

        var run = function () {
            var current = byId(id) || m;
            return TM.saveMatch(current, patch).then(function (r) {
                state.busy[id]--;
                if (!state.busy[id]) delete state.busy[id];
                if (!r.ok) {
                    revert();
                    TM.toast(r.message || 'Skor kaydedilemedi.', 'error');
                } else if (message) {
                    TM.toast(message, 'success', 2600);
                }
                if (saving && !state.busy[id]) {
                    saving.textContent = r.ok ? 'Kaydedildi' : '';
                    window.setTimeout(function () { saving.classList.remove('is-on'); }, 1200);
                }
                return r;
            });
        };
        queues[id] = (queues[id] || Promise.resolve()).then(run, run);
        return queues[id];
    }

    function render() {
        renderBoards();
        renderWaiting();
        renderDone();
        renderTable();
    }

    function refresh() {
        return TM.loadData(true);
    }

    TM.onData(function (d) { load(d); render(); });

    var refreshBtn = $('[data-live-refresh]');
    refreshBtn.addEventListener('click', function () {
        TM.setBusy(refreshBtn, true);
        refresh().then(function () { TM.setBusy(refreshBtn, false); TM.toast('Veriler yenilendi.', 'info', 1800); });
    });

    // Dakikalar 15 saniyede bir, veriler 20 saniyede bir
    window.setInterval(function () {
        Object.keys(state.boards).forEach(function (id) { updateClock(state.boards[id]); });
        renderWaiting();
    }, 15000);
    TM.startPolling(20000);

    load(TM.getData() || { teams: [], matches: [] });
    render();
})();
