/* =================================================================
   Doksan Artı — site çekirdeği (site-core.js)
   Bütün site sayfalarında yüklenir; sayfa dosyaları window.DA üzerinden kullanır.
   Teknik Masa'nın lig motoru (admin-league.js) ve grafik motoru (admin-charts.js)
   sitede de aynen kullanılır: bu dosya onların beklediği küçük TM köprüsünü kurar.

   1  Yardımcılar ve biçimler       7  GOL anı: tabela, konfeti, sıra
   2  Kulüp renkleri ve arma        8  Bildirimler
   3  LED tabela yardımcıları       9  Beliren öğeler, eğim, geri sayım
   4  Veri deposu ve değişiklikler  10 Kazanma ihtimali (Poisson modeli)
   5  Canlı yayın (SignalR)         11 Ortak maç parçaları
   6  Canlı şerit (header altı)     12 Başlat
   ================================================================= */
(function () {
    'use strict';

    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var canHover = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
    var trLocale = 'tr-TR';

    var FINISHED = 'Tamamlandi';
    var LIVE = 'Oynaniyor';
    var PLANNED = 'Planlandi';
    var POSTPONED = 'Ertelendi';

    /* ---------------------------------------------------------
       1. Yardımcılar ve biçimler
       --------------------------------------------------------- */
    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // Türkçe karakterleri ve büyük/küçük harfi yok sayan arama metni
    function norm(value) {
        return String(value == null ? '' : value)
            .toLocaleLowerCase(trLocale)
            .replace(/ı/g, 'i')
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .trim();
    }

    function teamCode(name) {
        var letters = String(name || '').replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '');
        var code = letters.toLocaleUpperCase(trLocale).slice(0, 3);
        while (code.length < 3) code += '?';
        return code;
    }

    // Serie A'nın bilinen derbileri — sıra önemsiz, isim eşleşmesi normalize edilmeden yapılır
    var DERBIES = [
        { a: 'Milan', b: 'Inter', label: 'Derby della Madonnina', short: 'Milano Derbisi' },
        { a: 'Roma', b: 'Lazio', label: 'Derby della Capitale', short: 'Roma Derbisi' },
        { a: 'Juventus', b: 'Torino', label: 'Derby della Mole', short: 'Torino Derbisi' },
        { a: 'Juventus', b: 'Inter', label: "Derby d'Italia", short: "İtalya Derbisi" }
    ];

    function derby(nameA, nameB) {
        var A = String(nameA || ''), B = String(nameB || '');
        for (var i = 0; i < DERBIES.length; i++) {
            var d = DERBIES[i];
            if ((d.a === A && d.b === B) || (d.a === B && d.b === A)) return d;
        }
        return null;
    }

    // Teknik Masa'daki ve Razor'daki Hue() ile aynı hesap
    function hue(name) {
        var sum = 0;
        var s = String(name || '');
        for (var i = 0; i < s.length; i++) sum = (sum + s.charCodeAt(i) * 37) % 360;
        return sum;
    }

    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    function toDate(value) {
        if (value instanceof Date) return value;
        return new Date(String(value));
    }

    var fmt = {
        day: new Intl.DateTimeFormat(trLocale, { day: 'numeric', month: 'short', weekday: 'short' }),
        dayLong: new Intl.DateTimeFormat(trLocale, { day: 'numeric', month: 'long', weekday: 'long' }),
        date: new Intl.DateTimeFormat(trLocale, { day: 'numeric', month: 'long', year: 'numeric' }),
        short: new Intl.DateTimeFormat(trLocale, { day: 'numeric', month: 'short' }),
        month: new Intl.DateTimeFormat(trLocale, { day: 'numeric', month: 'long' }),
        weekday: new Intl.DateTimeFormat(trLocale, { weekday: 'long' }),
        time: new Intl.DateTimeFormat(trLocale, { hour: '2-digit', minute: '2-digit', hour12: false }),
        num1: new Intl.NumberFormat(trLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
        num2: new Intl.NumberFormat(trLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        pct: new Intl.NumberFormat(trLocale, { maximumFractionDigits: 0 })
    };

    var romeTime = null;
    try { romeTime = new Intl.DateTimeFormat(trLocale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Rome' }); } catch (e) { romeTime = null; }

    function sameDay(a, b) {
        return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }

    // "Bugün 20:45", "Yarın 15:00", "Cmt 18 Eki 18:00"
    function when(value) {
        var d = toDate(value);
        var now = new Date();
        var tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        var yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        var t = fmt.time.format(d);
        if (sameDay(d, now)) return 'Bugün ' + t;
        if (sameDay(d, tomorrow)) return 'Yarın ' + t;
        if (sameDay(d, yesterday)) return 'Dün ' + t;
        return fmt.day.format(d) + ' ' + t;
    }

    // "3 gün sonra", "2 saat sonra", "25 dk sonra"
    function until(value) {
        var ms = toDate(value).getTime() - Date.now();
        if (ms <= 0) return 'şimdi';
        var min = Math.round(ms / 60000);
        if (min < 60) return min + ' dk sonra';
        var h = Math.round(min / 60);
        if (h < 24) return h + ' saat sonra';
        return Math.round(h / 24) + ' gün sonra';
    }

    function params() { return new URLSearchParams(window.location.search); }

    function setParams(changes) {
        var p = params();
        Object.keys(changes).forEach(function (k) {
            if (changes[k] === null || changes[k] === undefined || changes[k] === '') p.delete(k);
            else p.set(k, changes[k]);
        });
        var q = p.toString();
        window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : ''));
    }

    var STATUS = { Planlandi: 'Planlandı', Oynaniyor: 'Canlı', Tamamlandi: 'Maç sonu', Ertelendi: 'Ertelendi' };
    function statusLabel(status) { return STATUS[status] || 'Planlandı'; }
    function hasScore(m) { return m.homeScore !== null && m.homeScore !== undefined && m.awayScore !== null && m.awayScore !== undefined; }
    function isLive(m) { return m.status === LIVE; }
    function isFinished(m) { return m.status === FINISHED && hasScore(m); }

    function matchUrl(id) { return '/Match/Detail/' + id; }
    function clubUrl(id) { return '/Clubs/Detail/' + id; }
    function fixturesUrl(week) { return '/Fixtures' + (week ? '?week=' + week : ''); }

    /* ---------------------------------------------------------
       2. Kulüp renkleri ve arma
       Serie A kulüplerinin forma renkleri: konfeti, parlama ve şeritler için.
       Listede olmayan takım adının harflerinden bir renk alır.
       --------------------------------------------------------- */
    var CLUB = {
        atalanta: ['#2D7DD2', '#101828'], bologna: ['#C0283A', '#1A2F48'], cagliari: ['#C8102E', '#14306B'],
        como: ['#2A57B8', '#FFFFFF'], cremonese: ['#D7262E', '#9AA0A6'], empoli: ['#1E6FC8', '#FFFFFF'],
        fiorentina: ['#7A4BC4', '#FFFFFF'], frosinone: ['#F7D20A', '#1B4FA0'], genoa: ['#C2223A', '#1B2A4A'],
        inter: ['#1F6FE5', '#0B0B0B'], juventus: ['#F2F2F2', '#111111'], lazio: ['#7FC8F0', '#FFFFFF'],
        lecce: ['#F7D20A', '#D7262E'], milan: ['#E3121B', '#111111'], monza: ['#E30613', '#FFFFFF'],
        napoli: ['#1A9BDB', '#FFFFFF'], parma: ['#F7D20A', '#1E3D8F'], pisa: ['#2A57B8', '#111111'],
        roma: ['#B3243B', '#F2B33D'], salernitana: ['#9B2335', '#FFFFFF'], sassuolo: ['#00A651', '#111111'],
        spezia: ['#E8E8E8', '#111111'], torino: ['#A0280A', '#FFFFFF'], udinese: ['#EDEDED', '#111111'],
        venezia: ['#F28E00', '#00624D'], verona: ['#FFD200', '#1B3A75']
    };

    function clubColors(name) {
        var key = norm(name).replace(/[^a-z]/g, '');
        for (var k in CLUB) {
            if (Object.prototype.hasOwnProperty.call(CLUB, k) && key.indexOf(k) >= 0) {
                return { a: CLUB[k][0], b: CLUB[k][1], known: true };
            }
        }
        var h = hue(name);
        return { a: 'hsl(' + h + ' 80% 58%)', b: 'hsl(' + ((h + 40) % 360) + ' 70% 40%)', known: false };
    }

    function crest(name, logoUrl, size, extra) {
        var cls = 'da-crest' + (size ? ' da-crest--' + size : '') + (extra ? ' ' + extra : '');
        if (logoUrl) {
            return '<img class="' + cls + '" src="' + esc(logoUrl) + '" alt="" loading="lazy" decoding="async" data-crest-name="' + esc(name) + '">';
        }
        return '<span class="' + cls + '" style="--h:' + hue(name) + '" aria-hidden="true">' + esc(teamCode(name)) + '</span>';
    }

    // Kırık logo adresleri sessizce kısaltma armasına döner
    document.addEventListener('error', function (e) {
        var img = e.target;
        if (!img || img.tagName !== 'IMG' || !img.classList.contains('da-crest') || img.dataset.fallback) return;
        img.dataset.fallback = '1';
        var name = img.getAttribute('data-crest-name') || '';
        var span = document.createElement('span');
        span.className = img.className;
        span.style.setProperty('--h', hue(name));
        span.setAttribute('aria-hidden', 'true');
        span.textContent = teamCode(name);
        if (img.parentNode) img.parentNode.replaceChild(span, img);
    }, true);

    /* ---------------------------------------------------------
       3. LED tabela yardımcıları (layout.js'teki DaLed motoru)
       --------------------------------------------------------- */
    function led(el, text, tone, animate) {
        if (!window.DaLed || !el) return null;
        text = String(text);
        var board = window.DaLed.create(el, text.length);
        var tones = Array.isArray(tone) ? tone : [];
        if (!tones.length) for (var i = 0; i < text.length; i++) tones.push(tone || 'green');
        board.setTones(tones);
        board.setText(text, animate && !reduceMotion ? { stagger: typeof animate === 'number' ? animate : 260 } : null);
        return board;
    }

    // Sayfadaki [data-led-text] tabelaları (isteğe bağlı gecikmeyle) yakar
    function initLeds(root) {
        $$('[data-led][data-led-text]', root).forEach(function (el) {
            if (el.getAttribute('data-led-done')) return;
            el.setAttribute('data-led-done', '1');
            var text = el.getAttribute('data-led-text') || '0';
            var tone = el.getAttribute('data-led') || 'green';
            var delay = parseInt(el.getAttribute('data-led-delay') || '0', 10);
            var board = led(el, text.replace(/./g, ' '), tone, false);
            if (!board) return;
            var run = function () { board.setText(text, reduceMotion ? null : { stagger: 320 }); };
            if (delay > 0 && !reduceMotion) window.setTimeout(run, delay); else run();
        });
    }

    /* ---------------------------------------------------------
       4. Veri deposu ve değişiklikler
       Sayfa açılırken veri sayfaya gömülü gelir (#daSeed). Canlı yayından
       "bir maç değişti" sinyali gelince /Home/Data'dan taze paket alınır ve
       eski paketle karşılaştırılır: gol, başlama, bitiş, düzeltme olayları buradan çıkar.
       --------------------------------------------------------- */
    var data = { teams: [], matches: [] };
    var handlers = {};
    var lastSync = Date.now();

    function on(evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); }
    function emit(evt, payload) {
        (handlers[evt] || []).forEach(function (fn) {
            try { fn(payload); } catch (err) { if (window.console) console.error(err); }
        });
    }

    function readSeed() {
        var el = document.getElementById('daSeed');
        if (!el) return null;
        try { return JSON.parse(el.textContent || '{}'); } catch (e) { return null; }
    }

    function normalize(d) {
        d = d || {};
        return { teams: Array.isArray(d.teams) ? d.teams : [], matches: Array.isArray(d.matches) ? d.matches : [], error: d.error || null };
    }

    function byId(list) {
        var map = {};
        list.forEach(function (x) { map[x.id] = x; });
        return map;
    }

    function setData(next, silent) {
        next = normalize(next);
        var prev = data;
        data = next;
        lastSync = Date.now();
        if (!silent && prev && prev.matches.length) diff(prev, next);
        emit('data', data);
    }

    function diff(prev, next) {
        var old = byId(prev.matches);
        next.matches.forEach(function (m) {
            var o = old[m.id];
            if (!o) return;
            var wasLive = o.status === LIVE;
            var nowLive = m.status === LIVE;

            if (!wasLive && nowLive) emit('kickoff', { match: m, prev: o });

            if (nowLive || (wasLive && m.status === FINISHED)) {
                var oh = o.homeScore || 0, oa = o.awayScore || 0;
                var nh = m.homeScore || 0, na = m.awayScore || 0;
                if (nh > oh) emit('goal', { match: m, prev: o, side: 'home', count: nh - oh });
                if (na > oa) emit('goal', { match: m, prev: o, side: 'away', count: na - oa });
                if (nh < oh || na < oa) emit('correction', { match: m, prev: o });
            }

            if (wasLive && m.status === FINISHED) emit('fulltime', { match: m, prev: o });
            else if (!wasLive && o.status !== FINISHED && m.status === FINISHED) emit('result', { match: m, prev: o });
            if (o.status !== POSTPONED && m.status === POSTPONED) emit('postponed', { match: m, prev: o });
        });
    }

    var loading = null;
    var again = false;

    function loadData() {
        if (loading) { again = true; return loading; }
        loading = fetch('/Home/Data', { headers: { 'Accept': 'application/json' }, cache: 'no-store', credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
                if (d && !d.error) setData(d);
                return data;
            })
            .catch(function () { return data; })
            .then(function (d) {
                loading = null;
                if (again) { again = false; loadData(); }
                return d;
            });
        return loading;
    }

    /* ---------------------------------------------------------
       5. Canlı yayın (SignalR)
       Admin bir skoru kaydedince sunucu "MatchUpdated" yayınlar.
       Bağlantı yoksa sayfa görünürken arada bir kendisi yeniler.
       --------------------------------------------------------- */
    var live = { connected: false, hub: false };

    function setConnected(value) {
        live.connected = value;
        document.documentElement.classList.toggle('da-online', value);
        $$('[data-conn-text]').forEach(function (el) {
            el.textContent = value ? 'Canlı yayına bağlı' : 'Canlı yayın bağlantısı bekleniyor';
        });
        emit('connection', value);
    }

    function startHub() {
        if (typeof window.signalR === 'undefined') return;
        live.hub = true;
        var conn = new window.signalR.HubConnectionBuilder()
            .withUrl('/hubs/match')
            .withAutomaticReconnect([0, 2000, 5000, 10000, 20000, 30000])
            .configureLogging(window.signalR.LogLevel.None)
            .build();
        conn.on('MatchUpdated', function () { loadData(); });
        conn.onreconnecting(function () { setConnected(false); });
        conn.onreconnected(function () { setConnected(true); loadData(); });
        conn.onclose(function () { setConnected(false); });
        conn.start().then(function () { setConnected(true); }).catch(function () { setConnected(false); });
    }

    // Yedek: bağlantı yoksa 30 sn'de, canlı maç varken bağlantı olsa da 2 dk'da bir
    window.setInterval(function () {
        if (document.visibilityState !== 'visible') return;
        var idle = Date.now() - lastSync;
        var anyLive = data.matches.some(isLive);
        if ((!live.connected && idle > 30000) || (anyLive && idle > 120000)) loadData();
    }, 10000);

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' && Date.now() - lastSync > 20000) loadData();
    });

    /* ---------------------------------------------------------
       6. Canlı şerit: header'ın altında, canlı maç varken görünür
       --------------------------------------------------------- */
    var bar = null;

    function liveClock(m) {
        if (TM.league && TM.league.liveClock) return TM.league.liveClock(m);
        return { minute: 0, text: '', label: 'Canlı', phase: 'first' };
    }

    function initLiveBar() {
        var el = $('[data-livebar]');
        if (!el) return;
        bar = {
            el: el,
            track: $('[data-livebar-track]', el),
            viewport: $('[data-livebar-viewport]', el),
            count: $('[data-livebar-count]', el),
            ids: ''
        };
        var tag = $('[data-livebar-led]', el);
        if (tag) led(tag, 'CANLI', 'red', false);

        // GOL animasyonu aç / kapat (tercih tarayıcıda saklanır)
        var fx = $('[data-goal-fx]', el);
        if (fx) {
            fx.setAttribute('aria-pressed', String(celebrationsOn));
            fx.addEventListener('click', function () {
                DA.setCelebrations(!celebrationsOn);
                fx.setAttribute('aria-pressed', String(celebrationsOn));
                toast(celebrationsOn ? 'GOL animasyonu açık.' : 'GOL animasyonu kapalı. Goller kısa bildirimle gelecek.', 'info', { duration: 3500 });
            });
        }

        // Stadyum sesi aç / kapat (tercih tarayıcıda saklanır)
        var snd = $('[data-sound-fx]', el);
        if (snd) {
            var setSoundIcon = function () {
                snd.setAttribute('aria-pressed', String(soundOn));
                var use = $('use', snd);
                if (use) use.setAttribute('href', soundOn ? '#i-sound' : '#i-sound-off');
            };
            setSoundIcon();
            snd.addEventListener('click', function () {
                soundOn = !soundOn;
                try { window.localStorage.setItem('da-sound-fx', soundOn ? 'on' : 'off'); } catch (e) { }
                setSoundIcon();
                if (soundOn) { ensureAudio(); updateCrowd(); }
                else stopCrowd();
                toast(soundOn ? 'Stadyum sesi açık.' : 'Stadyum sesi kapalı.', 'info', { duration: 3000 });
            });
        }
        renderLiveBar();
        if (soundOn) updateCrowd();
        var resizeTimer = null;
        window.addEventListener('resize', function () {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(fitLiveBar, 150);
        });
    }

    function liveBarItem(m) {
        var clock = liveClock(m);
        return '<a class="da-livebar__item" href="' + matchUrl(m.id) + '" data-live-id="' + m.id + '" title="' + esc(m.homeTeamName + ' - ' + m.awayTeamName + ', ' + clock.label) + '">' +
            crest(m.homeTeamName, m.homeTeamLogo, 'xs') +
            '<span class="da-livebar__code">' + esc(teamCode(m.homeTeamName)) + '</span>' +
            '<b class="da-livebar__score"><span data-side="home">' + (m.homeScore || 0) + '</span><i>-</i><span data-side="away">' + (m.awayScore || 0) + '</span></b>' +
            '<span class="da-livebar__code">' + esc(teamCode(m.awayTeamName)) + '</span>' +
            crest(m.awayTeamName, m.awayTeamLogo, 'xs') +
            '<span class="da-livebar__min" data-live-min>' + esc(clock.text) + '</span>' +
            '</a>';
    }

    function renderLiveBar() {
        if (!bar) return;
        var list = data.matches.filter(isLive).sort(function (a, b) { return toDate(a.matchDate) - toDate(b.matchDate) || a.id - b.id; });
        var key = list.map(function (m) { return m.id + ':' + m.homeScore + '-' + m.awayScore; }).join('|');
        var show = list.length > 0;
        bar.el.hidden = !show;
        document.documentElement.classList.toggle('da-has-live', show);
        if (bar.count) bar.count.textContent = list.length;
        if (!show) { bar.ids = ''; return; }
        if (key === bar.ids) { tickLiveBar(); return; }
        bar.ids = key;
        var html = list.map(liveBarItem).join('');
        bar.track.innerHTML = '<div class="da-livebar__set">' + html + '</div>';
        bar.track.classList.remove('is-marquee');
        fitLiveBar();
    }

    // Sığmazsa kayan yazıya dönüşür (ikinci kopya ile kesintisiz döner)
    function fitLiveBar() {
        if (!bar || bar.el.hidden) return;
        var set = $('.da-livebar__set', bar.track);
        if (!set) return;
        var copies = $$('.da-livebar__set', bar.track);
        copies.slice(1).forEach(function (c) { c.parentNode.removeChild(c); });
        bar.track.classList.remove('is-marquee');
        if (reduceMotion) return;
        if (set.scrollWidth > bar.viewport.clientWidth + 4) {
            var clone = set.cloneNode(true);
            clone.setAttribute('aria-hidden', 'true');
            $$('a', clone).forEach(function (a) { a.setAttribute('tabindex', '-1'); });
            bar.track.appendChild(clone);
            bar.track.style.setProperty('--dur', Math.max(18, set.scrollWidth / 45) + 's');
            bar.track.classList.add('is-marquee');
        }
    }

    function tickLiveBar() {
        if (!bar) return;
        $$('[data-live-id]', bar.track).forEach(function (a) {
            var m = data.matches.filter(function (x) { return String(x.id) === a.getAttribute('data-live-id'); })[0];
            var min = $('[data-live-min]', a);
            if (m && min) min.textContent = liveClock(m).text;
        });
    }

    function flashLiveBar(matchId) {
        if (!bar) return;
        $$('[data-live-id="' + matchId + '"]', bar.track).forEach(function (a) {
            a.classList.remove('is-goal');
            void a.offsetWidth;
            a.classList.add('is-goal');
        });
    }

    /* ---------------------------------------------------------
       7. GOL anı
       Sahneye bir şerit süpürülür, LED tabelada "GOL" yanar, atan takımın
       renklerinde konfeti patlar, skor tabelasında rakam döner.
       Aynı anda birden fazla gol gelirse sırayla oynar.
       --------------------------------------------------------- */
    var goalQueue = [];
    var goalBusy = false;
    var goalEl = null;
    var goalTimer = null;
    var titleTimer = null;
    var baseTitle = document.title;
    var celebrationsOn = true;
    try { celebrationsOn = window.localStorage.getItem('da-goal-fx') !== 'off'; } catch (e) { celebrationsOn = true; }

    function buildGoalLayer() {
        var el = document.createElement('div');
        el.className = 'da-goal';
        el.hidden = true;
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'assertive');
        el.innerHTML =
            '<div class="da-goal__veil" aria-hidden="true"></div>' +
            '<div class="da-goal__rays" aria-hidden="true"></div>' +
            '<div class="da-goal__lights" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
            '<div class="da-goal__bands" aria-hidden="true">' +
            '<div class="da-goal__band da-goal__band--a"><div class="da-goal__track" data-goal-track></div></div>' +
            '<div class="da-goal__band da-goal__band--b"><div class="da-goal__track" data-goal-track></div></div>' +
            '</div>' +
            '<div class="da-goal__shake">' +
            '<div class="da-goal__scene">' +
            '<h2 class="da-goal__word" aria-hidden="true" data-goal-word></h2>' +
            '<div class="da-goal__hero">' +
            '<div class="da-goal__crestwrap"><div class="da-goal__rings" aria-hidden="true"><i></i><i></i><i></i></div><span class="da-goal__crest" data-goal-crest></span></div>' +
            '<div class="da-goal__team" data-goal-team></div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '<div class="da-goal__flashes" aria-hidden="true" data-goal-flashes></div>' +
            '<canvas class="da-goal__confetti" aria-hidden="true"></canvas>' +
            '<p class="da-goal__hint" aria-hidden="true">Kapatmak için dokun</p>' +
            '<div class="da-goal__card" data-goal-card>' +
            '<button type="button" class="da-goal__close" data-goal-close aria-label="Kapat">×</button>' +
            '<div class="da-goal__score" data-goal-score></div>' +
            '<p class="da-goal__meta" data-goal-meta></p>' +
            '<a class="da-goal__link" data-goal-link href="#">Maç merkezine git<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></a>' +
            '</div>' +
            '<div class="da-goal__flash" aria-hidden="true"></div>' +
            '<div class="da-goal__blackout" aria-hidden="true"></div>';
        document.body.appendChild(el);
        $('[data-goal-close]', el).addEventListener('click', function (e) { e.stopPropagation(); closeGoal(); });
        // Sahnenin herhangi bir yerine dokunmak kapatır; skor kartı ve bağlantı hariç
        el.addEventListener('click', function (e) {
            if (e.target.closest('[data-goal-card]')) return;
            closeGoal();
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && goalBusy) closeGoal(); });
        return el;
    }

    // Açık renkli kulüplerde (beyaz, sarı) bant yazısı koyu olsun
    function inkFor(hex) {
        var h = String(hex || '').replace('#', '');
        if (h.length === 3) h = h.replace(/./g, '$&$&');
        if (h.length !== 6) return '#FFFFFF';
        var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#0A1226' : '#FFFFFF';
    }

    // Fotoğrafçı flaşları: tribün bölgelerinde rastgele patlar
    function goalFlashes(box) {
        if (!box) return;
        var html = '';
        for (var i = 0; i < 26; i++) {
            var top = Math.random() < .5 ? 4 + Math.random() * 26 : 66 + Math.random() * 30;
            var left = Math.random() * 100;
            var delay = 0.45 + Math.random() * 3.4;
            var size = 5 + Math.random() * 8;
            html += '<i style="top:' + top.toFixed(1) + '%;left:' + left.toFixed(1) + '%;width:' + size.toFixed(0) + 'px;height:' + size.toFixed(0) + 'px;animation-delay:' + delay.toFixed(2) + 's"></i>';
        }
        box.innerHTML = html;
    }

    function celebrate(evt) {
        goalQueue.push(evt);
        if (!goalBusy) nextGoal();
    }

    function nextGoal() {
        if (!goalQueue.length) { goalBusy = false; return; }
        // Şampiyonluk/küme düşme anı o sırada oynuyorsa önce onun bitmesi beklenir
        if (clinchBusy && clinchEl && !clinchEl.hidden) { goalBusy = true; window.setTimeout(nextGoal, 500); return; }
        var evt = goalQueue.shift();
        if (!evt) { goalBusy = false; return; }
        goalBusy = true;
        // Sekme arka plandaysa başlık yanıp söner, dönüldüğünde kısa bildirim çıkar
        if (document.hidden || !celebrationsOn) {
            goalToast(evt);
            if (document.hidden) flashTitle(evt);
            goalBusy = false;
            nextGoal();
            return;
        }
        playGoal(evt);
    }

    function goalTeam(evt) {
        var m = evt.match;
        return evt.side === 'home'
            ? { name: m.homeTeamName, logo: m.homeTeamLogo, id: m.homeTeamId }
            : { name: m.awayTeamName, logo: m.awayTeamLogo, id: m.awayTeamId };
    }

    function playGoal(evt) {
        if (!goalEl) goalEl = buildGoalLayer();
        var m = evt.match;
        var p = evt.prev;
        var team = goalTeam(evt);
        var colors = clubColors(team.name);
        var clock = liveClock(m);
        var oldH = p.homeScore || 0, oldA = p.awayScore || 0;

        goalEl.style.setProperty('--ga', colors.a);
        goalEl.style.setProperty('--gb', colors.b);
        goalEl.style.setProperty('--gt', inkFor(colors.a));
        goalEl.classList.toggle('is-reduced', reduceMotion);

        // Dev harfler: G O (arma) O L — ortadaki "O" kulübün arması
        $('[data-goal-word]', goalEl).innerHTML = 'GOOOL'.split('').map(function (ch, i) {
            if (i === 2) return '<span class="da-goal__slot" style="--i:' + i + '"></span>';
            return '<span data-l="' + ch + '" style="--i:' + i + '">' + ch + '</span>';
        }).join('');

        $('[data-goal-crest]', goalEl).innerHTML = crest(team.name, team.logo, 'xxl');
        $('[data-goal-team]', goalEl).innerHTML =
            '<span class="visually-hidden">Gol: ' + esc(team.name) + (clock.text ? ', ' + esc(clock.text) : '') + '</span>' +
            '<span class="da-goal__who" aria-hidden="true">' + (clock.text ? '<em>' + esc(clock.text) + '</em>' : '') + esc(team.name) + '</span>';

        // Çapraz bantlar: kesintisiz akması için içerik iki kez yazılır
        var unit = '<span><b></b>GOL</span><span><b></b>' + esc(team.name) + '</span><span><b></b>' + (m.homeScore || 0) + ' - ' + (m.awayScore || 0) + '</span>';
        var run = '';
        for (var k = 0; k < 6; k++) run += unit;
        $$('[data-goal-track]', goalEl).forEach(function (t) { t.innerHTML = run + run; });

        $('[data-goal-score]', goalEl).innerHTML =
            '<span class="da-goal__side' + (evt.side === 'home' ? ' is-scorer' : '') + '">' + crest(m.homeTeamName, m.homeTeamLogo, 'sm') + '<span>' + esc(m.homeTeamName) + '</span></span>' +
            '<span class="da-goal__digits">' +
            '<b class="da-goal__digit' + (evt.side === 'home' ? ' is-turn' : '') + '" data-new="' + (m.homeScore || 0) + '"><span>' + oldH + '</span></b>' +
            '<i>-</i>' +
            '<b class="da-goal__digit' + (evt.side === 'away' ? ' is-turn' : '') + '" data-new="' + (m.awayScore || 0) + '"><span>' + oldA + '</span></b>' +
            '</span>' +
            '<span class="da-goal__side da-goal__side--away' + (evt.side === 'away' ? ' is-scorer' : '') + '"><span>' + esc(m.awayTeamName) + '</span>' + crest(m.awayTeamName, m.awayTeamLogo, 'sm') + '</span>';
        $('[data-goal-meta]', goalEl).textContent = (clock.text ? clock.text + ' · ' : '') + m.week + '. hafta · ' + (m.stadium || '');
        var link = $('[data-goal-link]', goalEl);
        link.href = matchUrl(m.id);
        link.hidden = window.location.pathname.toLowerCase() === matchUrl(m.id).toLowerCase();

        if (!reduceMotion) goalFlashes($('[data-goal-flashes]', goalEl));
        else $('[data-goal-flashes]', goalEl).innerHTML = '';

        goalEl.hidden = false;
        goalEl.classList.remove('is-on', 'is-leaving', 'is-turned');
        void goalEl.offsetWidth;
        goalEl.classList.add('is-on');

        var later = function (fn, ms) { return window.setTimeout(fn, reduceMotion ? Math.min(ms, 60) : ms); };
        if (!reduceMotion) later(function () { confetti($('.da-goal__confetti', goalEl), [colors.a, colors.b, '#FFFFFF', '#FFC94A', colors.a]); }, 420);
        later(function () {
            $$('.da-goal__digit.is-turn', goalEl).forEach(function (d) {
                d.innerHTML = '<span>' + d.getAttribute('data-new') + '</span>';
            });
            goalEl.classList.add('is-turned');
        }, 1500);

        window.clearTimeout(goalTimer);
        goalTimer = window.setTimeout(closeGoal, reduceMotion ? 3200 : 6200);
        flashLiveBar(m.id);
        if (document.hidden) flashTitle(evt);
    }

    function closeGoal() {
        if (!goalEl || goalEl.hidden) { goalBusy = false; return; }
        if (goalEl.classList.contains('is-leaving')) return;
        window.clearTimeout(goalTimer);
        goalEl.classList.add('is-leaving');
        var cv = $('.da-goal__confetti', goalEl);
        window.setTimeout(function () {
            if (cv && cv.__daConfettiStop) { cv.__daConfettiStop(); cv.__daConfettiStop = null; }
            goalEl.hidden = true;
            goalEl.classList.remove('is-on', 'is-leaving', 'is-turned');
            goalBusy = false;
            nextGoal();
        }, reduceMotion ? 60 : 520);
    }

    function goalToast(evt) {
        var m = evt.match;
        var team = goalTeam(evt);
        toast('<strong>GOL! ' + esc(team.name) + '</strong> ' + esc(m.homeTeamName) + ' ' + (m.homeScore || 0) + '-' + (m.awayScore || 0) + ' ' + esc(m.awayTeamName),
            'goal', { href: matchUrl(m.id), html: true, crest: crest(team.name, team.logo, 'sm') });
    }

    function flashTitle(evt) {
        var m = evt.match;
        var text = 'GOL! ' + m.homeTeamName + ' ' + (m.homeScore || 0) + '-' + (m.awayScore || 0) + ' ' + m.awayTeamName;
        window.clearInterval(titleTimer);
        var on = true;
        titleTimer = window.setInterval(function () {
            document.title = on ? '⚽ ' + text : baseTitle;
            on = !on;
        }, 1200);
        var stop = function () {
            if (document.hidden) return;
            window.clearInterval(titleTimer);
            document.title = baseTitle;
            document.removeEventListener('visibilitychange', stop);
        };
        document.addEventListener('visibilitychange', stop);
    }

    // Kulüp renklerinde konfeti: iki köşeden top atışı + yukarıdan hafif yağmur
    function confetti(canvas, colors) {
        if (!canvas || !canvas.getContext) return;
        // Aynı tuvalde önceki bir konfeti döngüsü hâlâ çalışıyorsa önce onu durdur
        if (canvas.__daConfettiStop) { canvas.__daConfettiStop(); canvas.__daConfettiStop = null; }
        var ctx = canvas.getContext('2d');
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        var W = window.innerWidth, H = window.innerHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        var parts = [];
        var count = W < 600 ? 110 : 190;
        function add(x, y, angle, spread, speed) {
            var a = angle + (Math.random() - 0.5) * spread;
            var v = speed * (0.55 + Math.random() * 0.6);
            parts.push({
                x: x, y: y,
                vx: Math.cos(a) * v, vy: Math.sin(a) * v,
                w: 6 + Math.random() * 7, h: 3 + Math.random() * 5,
                r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
                wob: Math.random() * 10, color: colors[Math.floor(Math.random() * colors.length)],
                shape: Math.random() < 0.22 ? 'circle' : Math.random() < 0.5 ? 'rect' : 'ribbon',
                life: 0, max: 150 + Math.random() * 70
            });
        }
        for (var i = 0; i < count / 2; i++) {
            add(-10, H * 0.82, -Math.PI / 3.1, 0.7, Math.max(16, W / 55));
            add(W + 10, H * 0.82, -Math.PI + Math.PI / 3.1, 0.7, Math.max(16, W / 55));
        }
        for (var j = 0; j < count / 3; j++) {
            parts.push({
                x: Math.random() * W, y: -20 - Math.random() * H * 0.4, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3,
                w: 5 + Math.random() * 6, h: 3 + Math.random() * 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
                wob: Math.random() * 10, color: colors[Math.floor(Math.random() * colors.length)], shape: 'rect', life: 0, max: 200
            });
        }

        var raf = null;
        function frame() {
            ctx.clearRect(0, 0, W, H);
            var alive = 0;
            parts.forEach(function (p) {
                if (p.life > p.max) return;
                alive++;
                p.life++;
                p.vx *= 0.985;
                p.vy = p.vy * 0.985 + 0.32;
                p.wob += 0.12;
                p.x += p.vx + Math.sin(p.wob) * 0.6;
                p.y += p.vy;
                p.r += p.vr;
                var fade = p.life > p.max - 40 ? Math.max(0, (p.max - p.life) / 40) : 1;
                ctx.save();
                ctx.globalAlpha = fade;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.r);
                ctx.fillStyle = p.color;
                if (p.shape === 'circle') {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.h * 0.7, 0, Math.PI * 2);
                    ctx.fill();
                } else if (p.shape === 'ribbon') {
                    ctx.scale(1, Math.cos(p.wob));
                    ctx.fillRect(-p.w / 2, -p.h / 4, p.w * 1.4, p.h / 2);
                } else {
                    ctx.scale(Math.cos(p.wob * 0.7), 1);
                    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                }
                ctx.restore();
            });
            if (alive > 0) raf = window.requestAnimationFrame(frame);
            else { ctx.clearRect(0, 0, W, H); canvas.__daConfettiStop = null; }
        }
        if (raf) window.cancelAnimationFrame(raf);
        raf = window.requestAnimationFrame(frame);
        canvas.__daConfettiStop = function () {
            window.cancelAnimationFrame(raf);
            ctx.clearRect(0, 0, W, H);
        };
    }

    /* ---------------------------------------------------------
       7b. Şampiyonluk / küme düşme anı
       Puan durumu matematiksel olarak kesinleştiği an (başka hiçbir takım
       yetişemiyorsa) tam ekran bir an gösterilir. Oturum başına bir kez.
       --------------------------------------------------------- */
    var clinchEl = null;
    var clinchQueue = [];
    var clinchBusy = false;
    var clinchTimer = null;

    function totalRounds() { return Math.max(0, (data.teams.length - 1) * 2); }

    function clinchKey(teamId, kind) { return 'da-clinch-' + kind + '-' + teamId; }

    function seenClinch(teamId, kind) {
        try { return window.sessionStorage.getItem(clinchKey(teamId, kind)) === '1'; } catch (e) { return false; }
    }

    function markClinch(teamId, kind) {
        try { window.sessionStorage.setItem(clinchKey(teamId, kind), '1'); } catch (e) { }
    }

    // doCelebrate=false: sayfa ilk açıldığında zaten gerçekleşmiş olanları
    // sessizce işaretler (geçmişe dönük kutlama olmasın diye)
    function scanClinches(doCelebrate) {
        if (!TM.league || !data.teams.length) return;
        var rows = TM.league.table(data.teams, data.matches);
        var n = rows.length;
        if (n < 4) return;
        var total = totalRounds();

        var leader = rows[0], second = rows[1];
        if (leader && second) {
            var secondMax = second.points + (total - second.played) * 3;
            if (leader.points > secondMax && !seenClinch(leader.id, 'title')) {
                markClinch(leader.id, 'title');
                if (doCelebrate) queueClinch(leader, 'title');
            }
        }

        var safeRow = rows[n - 4];
        if (safeRow) {
            rows.slice(n - 3).forEach(function (r) {
                var maxPts = r.points + (total - r.played) * 3;
                if (maxPts < safeRow.points && !seenClinch(r.id, 'rel')) {
                    markClinch(r.id, 'rel');
                    if (doCelebrate) queueClinch(r, 'rel');
                }
            });
        }
    }

    function queueClinch(row, kind) {
        clinchQueue.push({ row: row, kind: kind });
        if (!clinchBusy) nextClinch();
    }

    function nextClinch() {
        if (!clinchQueue.length) { clinchBusy = false; return; }
        // Bir GOL anı o sırada oynuyorsa önce onun bitmesi beklenir (ekranlar çakışmasın)
        if (goalBusy || goalQueue.length) { clinchBusy = true; window.setTimeout(nextClinch, 500); return; }
        var item = clinchQueue.shift();
        if (!item) { clinchBusy = false; return; }
        clinchBusy = true;
        if (document.hidden || !celebrationsOn) {
            clinchToast(item);
            clinchBusy = false;
            nextClinch();
            return;
        }
        playClinch(item);
    }

    function clinchToast(item) {
        var text = item.kind === 'title'
            ? esc(item.row.name) + ' şampiyonluğunu ilan etti!'
            : esc(item.row.name) + ' küme düştü.';
        toast(text, item.kind === 'title' ? 'goal' : 'warn', { crest: crest(item.row.name, item.row.logoUrl, 'sm') });
    }

    function buildClinchLayer() {
        var el = document.createElement('div');
        el.className = 'da-clinch';
        el.hidden = true;
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'assertive');
        el.innerHTML =
            '<canvas class="da-clinch__confetti" aria-hidden="true"></canvas>' +
            '<div class="da-clinch__veil" aria-hidden="true"></div>' +
            '<div class="da-clinch__stage">' +
            '<span class="da-clinch__crest" data-clinch-crest></span>' +
            '<div class="da-clinch__boardwrap"><span class="da-board da-board--xl da-clinch__board"><span class="da-led da-led--xl" data-clinch-led></span></span></div>' +
            '<div class="da-clinch__card">' +
            '<button type="button" class="da-clinch__close" data-clinch-close aria-label="Kapat">×</button>' +
            '<h2 class="da-clinch__name" data-clinch-name></h2>' +
            '<p class="da-clinch__meta" data-clinch-meta></p>' +
            '</div>' +
            '</div>';
        document.body.appendChild(el);
        $('[data-clinch-close]', el).addEventListener('click', closeClinch);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && clinchBusy) closeClinch(); });
        return el;
    }

    function playClinch(item) {
        if (!clinchEl) clinchEl = buildClinchLayer();
        var row = item.row, kind = item.kind;
        var col = clubColors(row.name);
        // Önceki kutlamadan kalmış olabilecek konfetiyi durdur (bu an kutlama değilse göstermeyelim)
        var prevCv = $('.da-clinch__confetti', clinchEl);
        if (prevCv && prevCv.__daConfettiStop) prevCv.__daConfettiStop();
        clinchEl.className = 'da-clinch is-' + kind + (reduceMotion ? ' is-reduced' : '');
        clinchEl.style.setProperty('--ga', kind === 'title' ? col.a : '#FF4D6D');
        clinchEl.style.setProperty('--gb', col.b);
        $('[data-clinch-crest]', clinchEl).innerHTML = crest(row.name, row.logoUrl, 'xxl');
        $('[data-clinch-name]', clinchEl).textContent = row.name;
        $('[data-clinch-meta]', clinchEl).textContent = kind === 'title'
            ? row.points + ' puan · Serie A şampiyonu'
            : "Serie A'dan küme düştü";

        clinchEl.hidden = false;
        clinchEl.classList.remove('is-leaving');
        void clinchEl.offsetWidth;
        clinchEl.classList.add('is-on');

        var word = kind === 'title' ? 'SAMPIYON' : 'DUSTU';
        var tones = word.split('').map(function (_, i) {
            return kind === 'title' ? (i % 2 === 0 ? 'amber' : 'white') : 'red';
        });
        var ledEl = $('[data-clinch-led]', clinchEl);
        var board = led(ledEl, word.replace(/./g, ' '), tones, false);

        var later = function (fn, ms) { return window.setTimeout(fn, reduceMotion ? Math.min(ms, 60) : ms); };
        later(function () { if (board) board.setText(word, reduceMotion ? null : { stagger: 90 }); }, 300);
        if (kind === 'title' && !reduceMotion) {
            later(function () { confetti($('.da-clinch__confetti', clinchEl), [col.a, col.b, '#FFC94A', '#FFFFFF']); }, 420);
        }

        window.clearTimeout(clinchTimer);
        clinchTimer = window.setTimeout(closeClinch, reduceMotion ? 3600 : (kind === 'title' ? 6400 : 5400));
    }

    function closeClinch() {
        if (!clinchEl || clinchEl.hidden) { clinchBusy = false; return; }
        window.clearTimeout(clinchTimer);
        clinchEl.classList.add('is-leaving');
        window.setTimeout(function () {
            clinchEl.hidden = true;
            clinchEl.classList.remove('is-on', 'is-leaving');
            clinchBusy = false;
            nextClinch();
        }, reduceMotion ? 60 : 420);
    }

    on('fulltime', function () { scanClinches(true); });
    on('result', function () { scanClinches(true); });

    /* ---------------------------------------------------------
       7c. Stadyum atmosferi (ses)
       Kalabalık uğultusu ve gol kornası WebAudio ile anlık üretilir,
       dosya indirilmez. Tarayıcı otomatik oynatmayı engellediği için
       yalnızca kullanıcı anahtarı açtıktan sonra duyulur.
       --------------------------------------------------------- */
    var soundOn = false;
    try { soundOn = window.localStorage.getItem('da-sound-fx') === 'on'; } catch (e) { soundOn = false; }
    var actx = null, crowdNodes = null;

    function ensureAudio() {
        if (actx) return actx;
        var Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        try { actx = new Ctor(); } catch (e) { actx = null; }
        return actx;
    }

    function noiseBuffer(ctx, seconds) {
        var rate = ctx.sampleRate;
        var buf = ctx.createBuffer(1, Math.max(1, Math.round(rate * seconds)), rate);
        var out = buf.getChannelData(0);
        var last = 0;
        for (var i = 0; i < out.length; i++) {
            var white = Math.random() * 2 - 1;
            last = (last + 0.045 * white) / 1.045;
            out[i] = last * 3.4;
        }
        return buf;
    }

    function startCrowd() {
        var ctx = ensureAudio();
        if (!ctx || crowdNodes) return;
        if (ctx.state === 'suspended') ctx.resume().catch(function () { });
        var src = ctx.createBufferSource();
        src.buffer = noiseBuffer(ctx, 4);
        src.loop = true;
        var filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 480;
        filter.Q.value = 0.7;
        var gain = ctx.createGain();
        gain.gain.value = 0;
        var lfo = ctx.createOscillator();
        lfo.frequency.value = 0.11;
        var lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.04;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 1.4);
        try { src.start(); lfo.start(); } catch (e) { }
        crowdNodes = { src: src, gain: gain, lfo: lfo };
    }

    function stopCrowd() {
        if (!crowdNodes || !actx) return;
        var ctx = actx, nodes = crowdNodes;
        crowdNodes = null;
        try {
            nodes.gain.gain.cancelScheduledValues(ctx.currentTime);
            nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, ctx.currentTime);
            nodes.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
            window.setTimeout(function () {
                try { nodes.src.stop(); nodes.lfo.stop(); } catch (e2) { }
            }, 550);
        } catch (e) { }
    }

    function playHorn() {
        if (!soundOn) return;
        var ctx = ensureAudio();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume().catch(function () { });
        var t = ctx.currentTime;
        [[0, 349], [0.08, 466]].forEach(function (pair) {
            var osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(pair[1], t + pair[0]);
            var g = ctx.createGain();
            g.gain.setValueAtTime(0, t + pair[0]);
            g.gain.linearRampToValueAtTime(0.15, t + pair[0] + 0.04);
            g.gain.exponentialRampToValueAtTime(0.0001, t + pair[0] + 1.1);
            osc.connect(g);
            g.connect(ctx.destination);
            try { osc.start(t + pair[0]); osc.stop(t + pair[0] + 1.2); } catch (e) { }
        });
        var burst = ctx.createBufferSource();
        burst.buffer = noiseBuffer(ctx, 1.4);
        var bf = ctx.createBiquadFilter();
        bf.type = 'bandpass'; bf.frequency.value = 900; bf.Q.value = 0.6;
        var bg = ctx.createGain();
        bg.gain.setValueAtTime(0, t);
        bg.gain.linearRampToValueAtTime(0.13, t + 0.15);
        bg.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
        burst.connect(bf); bf.connect(bg); bg.connect(ctx.destination);
        try { burst.start(t); burst.stop(t + 1.4); } catch (e) { }
    }

    function updateCrowd() {
        var hasLive = document.documentElement.classList.contains('da-has-live');
        if (soundOn && hasLive && !document.hidden) startCrowd();
        else stopCrowd();
    }

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) stopCrowd(); else updateCrowd();
    });

    on('goal', function () { playHorn(); });
    on('data', function () { updateCrowd(); });

    // Önceki oturumdan "ses açık" tercihi geldiyse, sayfadaki ilk dokunuşta
    // tarayıcının otomatik oynatma kilidini aç
    document.addEventListener('click', function () {
        if (actx && actx.state === 'suspended') actx.resume().catch(function () { });
    }, { passive: true });

    /* ---------------------------------------------------------
       8. Bildirimler
       --------------------------------------------------------- */
    var toastBox = null;

    function toast(message, tone, options) {
        options = options || {};
        if (!toastBox) {
            toastBox = document.createElement('div');
            toastBox.className = 'da-toasts';
            toastBox.setAttribute('aria-live', 'polite');
            document.body.appendChild(toastBox);
        }
        var tag = options.href ? 'a' : 'div';
        var el = document.createElement(tag);
        el.className = 'da-toast da-toast--' + (tone || 'info');
        if (options.href) el.href = options.href;
        el.innerHTML = (options.crest ? '<span class="da-toast__crest">' + options.crest + '</span>' : '<i class="da-toast__dot" aria-hidden="true"></i>') +
            '<span class="da-toast__text">' + (options.html ? message : esc(message)) + '</span>';
        toastBox.appendChild(el);
        while (toastBox.children.length > 4) toastBox.removeChild(toastBox.firstChild);
        window.setTimeout(function () {
            el.classList.add('is-leaving');
            window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
        }, options.duration || 6000);
        return el;
    }

    /* ---------------------------------------------------------
       9. Beliren öğeler, eğim efekti, geri sayım
       --------------------------------------------------------- */
    var revealObserver = null;

    function reveal(root) {
        var items = $$('[data-reveal]:not(.is-in)', root);
        if (reduceMotion || !('IntersectionObserver' in window)) {
            items.forEach(function (el) { el.classList.add('is-in'); });
            return;
        }
        if (!revealObserver) {
            revealObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) {
                    if (e.isIntersecting) {
                        e.target.classList.add('is-in');
                        revealObserver.unobserve(e.target);
                    }
                });
            }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
        }
        items.forEach(function (el) { revealObserver.observe(el); });
    }

    // Fareyle hafif üç boyutlu eğim (dokunmatikte ve hareket azaltmada kapalı)
    function tilt(el, strength) {
        if (!el || !canHover || reduceMotion || el.getAttribute('data-tilt-on')) return;
        el.setAttribute('data-tilt-on', '1');
        strength = strength || 8;
        var raf = null;
        el.addEventListener('pointermove', function (e) {
            var r = el.getBoundingClientRect();
            var x = (e.clientX - r.left) / r.width - 0.5;
            var y = (e.clientY - r.top) / r.height - 0.5;
            if (raf) window.cancelAnimationFrame(raf);
            raf = window.requestAnimationFrame(function () {
                el.style.setProperty('--rx', (-y * strength).toFixed(2) + 'deg');
                el.style.setProperty('--ry', (x * strength).toFixed(2) + 'deg');
                el.style.setProperty('--mx', ((x + 0.5) * 100).toFixed(1) + '%');
                el.style.setProperty('--my', ((y + 0.5) * 100).toFixed(1) + '%');
                el.classList.add('is-tilting');
            });
        });
        el.addEventListener('pointerleave', function () {
            if (raf) window.cancelAnimationFrame(raf);
            el.style.setProperty('--rx', '0deg');
            el.style.setProperty('--ry', '0deg');
            el.classList.remove('is-tilting');
        });
    }

    // LED geri sayım: gün / saat / dakika (/ saniye) tabelaları
    // parts: { d, h, m, s } -> LED kutuları; labels isteğe bağlı
    function countdown(root, target, onDone) {
        var boxes = {};
        ['d', 'h', 'm', 's'].forEach(function (k) {
            var el = $('[data-cd="' + k + '"]', root);
            if (el) boxes[k] = { el: el, board: led(el, '00', el.getAttribute('data-led') || 'green', false), last: '' };
        });
        var end = toDate(target).getTime();
        var timer = null;
        function tick(first) {
            var ms = Math.max(0, end - Date.now());
            var s = Math.floor(ms / 1000);
            var v = { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
            if (!boxes.d && v.d) v.h += v.d * 24;
            Object.keys(boxes).forEach(function (k) {
                var text = pad(Math.min(99, v[k]));
                var b = boxes[k];
                if (b.board && text !== b.last) {
                    b.board.setText(text, first || reduceMotion ? null : { stagger: 140 });
                    b.last = text;
                }
            });
            if (ms <= 0) {
                window.clearInterval(timer);
                if (onDone) onDone();
            }
        }
        tick(true);
        timer = window.setInterval(function () { tick(false); }, boxes.s ? 1000 : 15000);
        return { stop: function () { window.clearInterval(timer); } };
    }

    /* ---------------------------------------------------------
       10. Kazanma ihtimali (Poisson modeli)
       İki takımın bu sezonki attığı / yediği gol ortalamasından beklenen gol
       sayıları çıkar (az maçlı takımlar lig ortalamasına doğru çekilir).
       Canlı maçta mevcut skor sabit tutulur, kalan süre için yeniden hesaplanır.
       options.before: maç öncesi tahmin (bu maçtan sonraki sonuçları kullanma)
       --------------------------------------------------------- */
    function poisson(lambda, k) {
        var p = Math.exp(-lambda);
        for (var i = 1; i <= k; i++) p *= lambda / i;
        return p;
    }

    function predict(match, options) {
        options = options || {};
        var kickoff = toDate(match.matchDate).getTime();
        var done = data.matches.filter(function (m) {
            if (m.id === match.id || !isFinished(m)) return false;
            return options.before ? toDate(m.matchDate).getTime() < kickoff : true;
        });
        var hg = 0, ag = 0;
        done.forEach(function (m) { hg += m.homeScore; ag += m.awayScore; });
        var n = done.length;
        var avgH = n >= 6 ? hg / n : 1.45;
        var avgA = n >= 6 ? ag / n : 1.15;
        var perTeam = (avgH + avgA) / 2;
        var prior = 4;

        function strength(id) {
            var gf = 0, ga = 0, p = 0;
            done.forEach(function (m) {
                if (m.homeTeamId === id) { gf += m.homeScore; ga += m.awayScore; p++; }
                else if (m.awayTeamId === id) { gf += m.awayScore; ga += m.homeScore; p++; }
            });
            return {
                att: ((gf + perTeam * prior) / (p + prior)) / perTeam,
                def: ((ga + perTeam * prior) / (p + prior)) / perTeam,
                played: p
            };
        }

        var sh = strength(match.homeTeamId);
        var sa = strength(match.awayTeamId);
        var lh = clamp(avgH * sh.att * sa.def, 0.2, 4.5);
        var la = clamp(avgA * sa.att * sh.def, 0.15, 4);

        var baseH = 0, baseA = 0, factor = 1, minute = 0;
        var inPlay = !!options.live && isLive(match);
        if (inPlay) {
            baseH = match.homeScore || 0;
            baseA = match.awayScore || 0;
            minute = liveClock(match).minute || 0;
            factor = Math.max(0.03, (93 - minute) / 93);
        }

        var max = 8;
        var ph = [], pa = [];
        for (var k = 0; k <= max; k++) { ph.push(poisson(lh * factor, k)); pa.push(poisson(la * factor, k)); }
        var home = 0, draw = 0, away = 0;
        var lines = [];
        for (var i = 0; i <= max; i++) {
            for (var j = 0; j <= max; j++) {
                var p = ph[i] * pa[j];
                var fh = baseH + i, fa = baseA + j;
                if (fh > fa) home += p; else if (fh < fa) away += p; else draw += p;
                lines.push({ h: fh, a: fa, p: p });
            }
        }
        var total = home + draw + away || 1;
        lines.sort(function (a, b) { return b.p - a.p; });
        return {
            home: home / total, draw: draw / total, away: away / total,
            lh: lh, la: la, top: lines.slice(0, 6),
            inPlay: inPlay, minute: minute, sample: n,
            homeStrength: sh, awayStrength: sa
        };
    }

    /* ---------------------------------------------------------
       11. Ortak maç parçaları
       --------------------------------------------------------- */
    function stateChip(m) {
        if (isLive(m)) {
            var c = liveClock(m);
            return '<span class="da-state da-state--live"><i class="da-pulse" aria-hidden="true"></i><span data-live-text="' + m.id + '">' + esc(c.text || 'Canlı') + '</span></span>';
        }
        if (m.status === POSTPONED) return '<span class="da-state da-state--post">Ertelendi</span>';
        if (isFinished(m)) return '<span class="da-state da-state--done">MS</span>';
        if (m.status === PLANNED && toDate(m.matchDate).getTime() + 2 * 3600000 < Date.now()) return '<span class="da-state da-state--late">Sonuç bekleniyor</span>';
        return '<span class="da-state da-state--plan">' + esc(fmt.time.format(toDate(m.matchDate))) + '</span>';
    }

    // Sayfadaki canlı dakika yazılarını tazeler: [data-live-text="maçId"]
    function tickLiveTexts(root) {
        $$('[data-live-text]', root).forEach(function (el) {
            var id = el.getAttribute('data-live-text');
            var m = data.matches.filter(function (x) { return String(x.id) === id; })[0];
            if (m && isLive(m)) el.textContent = liveClock(m).text || 'Canlı';
        });
    }

    // Satır ya da kart içinde skoru güncellenen maçı parlatır
    function pulse(el, cls) {
        if (!el) return;
        cls = cls || 'is-updated';
        el.classList.remove(cls);
        void el.offsetWidth;
        el.classList.add(cls);
        window.setTimeout(function () { el.classList.remove(cls); }, 2200);
    }

    // FLIP: liste yeniden çizilince satırlar eski yerinden yenisine kayar
    function flip(container, selector, keyAttr, render) {
        var before = {};
        if (!reduceMotion) {
            $$(selector, container).forEach(function (el) { before[el.getAttribute(keyAttr)] = el.getBoundingClientRect().top; });
        }
        render();
        if (reduceMotion) return;
        $$(selector, container).forEach(function (el) {
            var old = before[el.getAttribute(keyAttr)];
            if (old === undefined) return;
            var delta = old - el.getBoundingClientRect().top;
            if (Math.abs(delta) < 1) return;
            el.style.transform = 'translateY(' + delta + 'px)';
            el.style.transition = 'none';
            el.classList.add('is-moving');
            window.requestAnimationFrame(function () {
                window.requestAnimationFrame(function () {
                    el.style.transition = 'transform .85s cubic-bezier(.2,.8,.2,1)';
                    el.style.transform = '';
                });
            });
            window.setTimeout(function () { el.classList.remove('is-moving'); el.style.transition = ''; }, 950);
        });
    }

    // Biten maçların imzası: değişmediyse ağır grafikler yeniden çizilmez
    function finishedKey() {
        return data.matches.filter(isFinished).map(function (m) { return m.id + ':' + m.homeScore + '-' + m.awayScore + ':' + m.week; }).join('|');
    }

    function weekRange(week) {
        var list = data.matches.filter(function (m) { return m.week === week; });
        if (!list.length) return null;
        var times = list.map(function (m) { return toDate(m.matchDate).getTime(); });
        var a = new Date(Math.min.apply(null, times));
        var b = new Date(Math.max.apply(null, times));
        if (sameDay(a, b)) return fmt.month.format(a);
        if (a.getMonth() === b.getMonth()) return a.getDate() + '–' + fmt.month.format(b);
        return fmt.short.format(a) + ' – ' + fmt.short.format(b);
    }

    /* ---------------------------------------------------------
       TM köprüsü: lig ve grafik motorları bunları bekler
       --------------------------------------------------------- */
    var TM = window.TM = window.TM || {};
    TM.$ = TM.$ || $;
    TM.$$ = TM.$$ || $$;
    TM.esc = TM.esc || esc;
    TM.toDate = TM.toDate || toDate;
    TM.pad = TM.pad || pad;
    TM.reduceMotion = reduceMotion;

    /* ---------------------------------------------------------
       12. Başlat
       --------------------------------------------------------- */
    var seed = readSeed();
    if (seed) setData(seed, true);

    var DA = window.DA = {
        FINISHED: FINISHED, LIVE: LIVE, PLANNED: PLANNED, POSTPONED: POSTPONED,
        $: $, $$: $$, esc: esc, norm: norm, teamCode: teamCode, hue: hue, pad: pad, clamp: clamp, derby: derby,
        toDate: toDate, fmt: fmt, when: when, until: until, sameDay: sameDay, romeTime: romeTime,
        params: params, setParams: setParams,
        statusLabel: statusLabel, hasScore: hasScore, isLive: isLive, isFinished: isFinished,
        matchUrl: matchUrl, clubUrl: clubUrl, fixturesUrl: fixturesUrl,
        clubColors: clubColors, crest: crest, led: led, initLeds: initLeds,
        getData: function () { return data; }, setData: setData, loadData: loadData,
        on: on, emit: emit, live: live,
        celebrate: celebrate, toast: toast, reveal: reveal, tilt: tilt, countdown: countdown,
        predict: predict, liveClock: liveClock, stateChip: stateChip, tickLiveTexts: tickLiveTexts,
        pulse: pulse, weekRange: weekRange, flip: flip, finishedKey: finishedKey,
        reduceMotion: reduceMotion, canHover: canHover,
        setCelebrations: function (value) {
            celebrationsOn = !!value;
            try { window.localStorage.setItem('da-goal-fx', value ? 'on' : 'off'); } catch (e) { /* depolama kapalı olabilir */ }
        },
        celebrationsOn: function () { return celebrationsOn; }
    };

    // Yapışkan header'ın yüksekliği (canlı şerit dahil): yapışkan alt başlıklar bunu kullanır
    var headerEl = null;
    var headerH = 0;
    var headerRaf = null;
    function measureHeader() {
        headerRaf = null;
        if (!headerEl) headerEl = $('[data-header]');
        if (!headerEl) return;
        var h = Math.round(headerEl.getBoundingClientRect().height);
        if (h && h !== headerH) {
            headerH = h;
            document.documentElement.style.setProperty('--da-header-h', h + 'px');
        }
    }
    function queueMeasure() {
        if (!headerRaf) headerRaf = window.requestAnimationFrame(measureHeader);
    }
    window.addEventListener('scroll', queueMeasure, { passive: true });
    window.addEventListener('resize', queueMeasure);

    // Sayfa başlıkları harf harf açılır (açılış sahnesi bitince)
    function initSplit() {
        var items = $$('[data-split]');
        if (!items.length) return;
        items.forEach(function (el) { if (window.DaSplit) window.DaSplit(el); });
        var show = function () {
            items.forEach(function (el, i) {
                window.setTimeout(function () { el.classList.add('is-in'); }, reduceMotion ? 0 : i * 160);
            });
        };
        if (document.documentElement.classList.contains('da-ready')) show();
        else document.addEventListener('da:ready', show);
    }

    // Lig ve grafik motorları bu dosyadan sonra yüklenir; hazır olunca bağlanır
    document.addEventListener('DOMContentLoaded', function () {
        initSplit();
        measureHeader();
        window.setTimeout(measureHeader, 400);
        DA.league = TM.league;
        DA.charts = TM.charts;
        initLiveBar();
        initLeds(document);
        reveal(document);
        startHub();
        // Geçmişte kesinleşmiş olanları sessizce işaretle; yalnızca yeni
        // bir sonuç bu anı doğurursa kutlama gösterilir (bkz. 7b)
        scanClinches(false);
        // Sayfaya veri gömülmediyse (ör. bulunamadı sayfası) canlı şerit için veri çekilir
        if (!seed) loadData();
    });

    on('data', function () { renderLiveBar(); queueMeasure(); });

    on('goal', function (evt) { celebrate(evt); });
    on('kickoff', function (evt) {
        var m = evt.match;
        toast('<strong>Başladı</strong> ' + esc(m.homeTeamName) + ' - ' + esc(m.awayTeamName), 'live', { href: matchUrl(m.id), html: true });
    });
    on('fulltime', function (evt) {
        var m = evt.match;
        toast('<strong>Maç sonu</strong> ' + esc(m.homeTeamName) + ' ' + m.homeScore + '-' + m.awayScore + ' ' + esc(m.awayTeamName), 'done', { href: matchUrl(m.id), html: true });
    });
    on('result', function (evt) {
        var m = evt.match;
        toast('<strong>Sonuç</strong> ' + esc(m.homeTeamName) + ' ' + m.homeScore + '-' + m.awayScore + ' ' + esc(m.awayTeamName), 'done', { href: matchUrl(m.id), html: true });
    });
    on('correction', function (evt) {
        var m = evt.match;
        toast('<strong>Skor düzeltildi</strong> ' + esc(m.homeTeamName) + ' ' + (m.homeScore || 0) + '-' + (m.awayScore || 0) + ' ' + esc(m.awayTeamName), 'warn', { href: matchUrl(m.id), html: true });
    });
    on('postponed', function (evt) {
        var m = evt.match;
        toast('<strong>Ertelendi</strong> ' + esc(m.homeTeamName) + ' - ' + esc(m.awayTeamName), 'warn', { href: matchUrl(m.id), html: true });
    });

    // Canlı dakikalar 20 sn'de bir ilerler
    window.setInterval(function () {
        tickLiveBar();
        tickLiveTexts(document);
        emit('tick', Date.now());
    }, 20000);
})();
