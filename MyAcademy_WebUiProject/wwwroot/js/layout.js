/* =================================================================
   Doksan Artı — uygulama kabuğu davranışları (layout.js)
   1 LED yazı tipi ve tabela (rakamlar, işaretler ve harfler)
   2 Harf harf bölme
   3 Tabelaları kur
   4 Hazır olma (da-ready)
   5 Açılış sahnesi
   6 Header: kaydırma, ışık, dakika çubuğu, başa dön
   7 Navigasyon: kayan gösterge, dalga, mobil menü
   8 Roma saati
   9 Header tabelasının uzatma dakikası değişimi
   10 Footer saha çizgileri
   ================================================================= */
(function () {
    'use strict';

    var root = document.documentElement;
    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var canHover = !!(window.matchMedia && window.matchMedia('(hover: hover)').matches);

    /* ---------------------------------------------------------
       1. LED yazı tipi ve tabela (5x7 nokta)
       --------------------------------------------------------- */
    var FONT = {
        '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
        '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
        '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
        '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
        '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
        '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
        '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
        '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
        '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
        '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
        '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
        "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
        ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
        '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
        ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
        '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
        '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
        '%': ['11000', '11001', '00010', '00100', '01000', '10011', '00011'],
        // Harfler: "GOL", "MS", "CANLI" gibi tabela yazıları için
        'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
        'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
        'C': ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
        'D': ['11100', '10010', '10001', '10001', '10001', '10010', '11100'],
        'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
        'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
        'G': ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
        'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
        'I': ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
        'J': ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
        'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
        'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
        'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
        'N': ['10001', '10001', '11001', '10101', '10011', '10001', '10001'],
        'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
        'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
        'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
        'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
        'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
        'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
        'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
        'Y': ['10001', '10001', '10001', '01010', '00100', '00100', '00100'],
        'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111']
    };

    // Türkçe harfler tabelada en yakın karşılığıyla yanar (İ -> I, Ş -> S)
    var FOLD = { 'İ': 'I', 'I': 'I', 'ı': 'I', 'Ş': 'S', 'ş': 'S', 'Ç': 'C', 'ç': 'C', 'Ğ': 'G', 'ğ': 'G', 'Ö': 'O', 'ö': 'O', 'Ü': 'U', 'ü': 'U' };
    function glyph(ch) {
        if (FONT[ch]) return FONT[ch];
        var folded = FOLD[ch] || String(ch).toLocaleUpperCase('tr-TR');
        return FONT[folded] || FONT[folded.toUpperCase()] || FONT[' '];
    }

    function LedBoard(el, length) {
        this.el = el;
        this.cells = [];
        el.textContent = '';
        for (var i = 0; i < length; i++) {
            var charEl = document.createElement('span');
            charEl.className = 'da-led__char';
            var dots = [];
            for (var d = 0; d < 35; d++) {
                var dot = document.createElement('span');
                dot.className = 'da-led__dot';
                charEl.appendChild(dot);
                dots.push(dot);
            }
            el.appendChild(charEl);
            this.cells.push({ el: charEl, dots: dots, ch: ' ', timers: [] });
        }
    }

    LedBoard.prototype.setTones = function (tones) {
        for (var i = 0; i < this.cells.length; i++) {
            var tone = tones && tones[i] ? tones[i] : 'green';
            var cellEl = this.cells[i].el;
            cellEl.classList.remove('is-green', 'is-red', 'is-white', 'is-blue', 'is-amber');
            cellEl.classList.add('is-' + tone);
        }
    };

    function toggleDot(dot, on) {
        return function () { dot.classList.toggle('is-on', on); };
    }

    LedBoard.prototype.setChar = function (index, ch, options) {
        var cell = this.cells[index];
        if (!cell) return;
        var rows = glyph(ch);
        var stagger = options && options.stagger ? options.stagger : 0;

        cell.timers.forEach(function (t) { window.clearTimeout(t); });
        cell.timers = [];
        cell.ch = ch;

        for (var r = 0; r < 7; r++) {
            for (var c = 0; c < 5; c++) {
                var on = rows[r].charAt(c) === '1';
                var dot = cell.dots[r * 5 + c];
                if (stagger && !reduceMotion) {
                    cell.timers.push(window.setTimeout(toggleDot(dot, on), Math.random() * stagger));
                } else {
                    dot.classList.toggle('is-on', on);
                }
            }
        }
    };

    LedBoard.prototype.setText = function (text, options) {
        for (var i = 0; i < this.cells.length; i++) {
            this.setChar(i, text.charAt(i) || ' ', options);
        }
    };

    window.DaLed = {
        create: function (el, length) { return new LedBoard(el, length); },
        has: function (ch) { return glyph(ch) !== FONT[' '] || ch === ' '; }
    };

    /* ---------------------------------------------------------
       2. Harf harf bölme
       --------------------------------------------------------- */
    function splitChars(el) {
        if (!el || el.getAttribute('data-split-done')) return;
        var text = el.textContent.trim();
        el.textContent = '';
        var index = 0;
        text.split('').forEach(function (ch) {
            if (ch === ' ') {
                var space = document.createElement('span');
                space.className = 'da-space';
                el.appendChild(space);
                return;
            }
            var mask = document.createElement('span');
            mask.className = 'da-char-mask';
            var charEl = document.createElement('span');
            charEl.className = 'da-char';
            charEl.textContent = ch;
            charEl.style.setProperty('--i', index++);
            mask.appendChild(charEl);
            el.appendChild(mask);
        });
        el.setAttribute('data-split-done', '1');
    }

    window.DaSplit = splitChars;

    /* ---------------------------------------------------------
       3. Tabelaları kur
       --------------------------------------------------------- */
    var stoppage = 3;
    var brandBoardEl = document.querySelector('[data-brand-board]');
    var brandLedEl = document.querySelector('[data-brand-led]');
    var brandBoard = null;

    if (brandLedEl) {
        brandBoard = new LedBoard(brandLedEl, 4);
        brandBoard.setTones(['green', 'green', 'red', 'red']);
        brandBoard.setText('90+' + stoppage);
    }

    document.querySelectorAll('[data-led-static]').forEach(function (el) {
        var text = el.getAttribute('data-led-static') || '';
        var tones = (el.getAttribute('data-led-tones') || '').split(',');
        var board = new LedBoard(el, text.length);
        board.setTones(tones);
        board.setText(text);
    });

    document.querySelectorAll('[data-wordmark]').forEach(splitChars);

    /* ---------------------------------------------------------
       4. Hazır olma
       --------------------------------------------------------- */
    function markReady() {
        if (root.classList.contains('da-ready')) return;
        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
                root.classList.add('da-ready');
                window.setTimeout(function () { root.classList.add('da-settled'); }, 1400);
                var evt;
                try {
                    evt = new CustomEvent('da:ready');
                } catch (e) {
                    evt = document.createEvent('Event');
                    evt.initEvent('da:ready', true, true);
                }
                document.dispatchEvent(evt);
                startBoardFlicker();
            });
        });
    }

    /* ---------------------------------------------------------
       5. Açılış sahnesi
       --------------------------------------------------------- */
    function runIntro() {
        var intro = document.querySelector('[data-intro]');
        if (!intro || !root.classList.contains('da-intro-active')) {
            root.classList.remove('da-intro-active');
            if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
            markReady();
            return;
        }

        var boardWrap = intro.querySelector('[data-intro-board]');
        var ledEl = intro.querySelector('[data-intro-led]');
        var title = intro.querySelector('[data-intro-title]');
        var board = new LedBoard(ledEl, 4);
        board.setTones(['green', 'green', 'red', 'red']);
        board.setText('00  ');
        splitChars(title);

        var finished = false;
        var timers = [];
        var rafId = null;

        function later(fn, ms) { timers.push(window.setTimeout(fn, ms)); }

        function rememberSeen() {
            try { window.sessionStorage.setItem('da-intro-seen', '1'); } catch (e) { /* depolama kapalı olabilir */ }
        }

        function cleanup() {
            timers.forEach(function (t) { window.clearTimeout(t); });
            timers = [];
            if (rafId) window.cancelAnimationFrame(rafId);
            rafId = null;
            intro.removeEventListener('click', skip);
            document.removeEventListener('keydown', onKey);
        }

        function removeIntro() {
            if (intro.parentNode) intro.parentNode.removeChild(intro);
        }

        function skip() {
            if (finished) return;
            finished = true;
            cleanup();
            rememberSeen();
            intro.classList.add('is-leaving');
            boardWrap.style.transition = 'opacity .25s ease';
            boardWrap.style.opacity = '0';
            root.classList.remove('da-intro-active');
            markReady();
            window.setTimeout(removeIntro, 600);
        }

        function onKey(e) {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                skip();
            }
        }

        intro.addEventListener('click', skip);
        document.addEventListener('keydown', onKey);

        // 00'dan 90'a sayım
        var countDuration = 1350;
        var start = null;
        var lastMinute = -1;

        function count(ts) {
            if (start === null) start = ts;
            var t = Math.min(1, (ts - start) / countDuration);
            var eased = 1 - Math.pow(1 - t, 3);
            var minute = Math.round(eased * 90);
            if (minute !== lastMinute) {
                lastMinute = minute;
                var s = (minute < 10 ? '0' : '') + minute;
                board.setChar(0, s.charAt(0));
                board.setChar(1, s.charAt(1));
            }
            if (t < 1) {
                rafId = window.requestAnimationFrame(count);
            } else {
                rafId = null;
                onNinety();
            }
        }

        function onNinety() {
            boardWrap.classList.add('is-flash');
            later(function () { board.setChar(2, '+', { stagger: 160 }); }, 380);
            later(function () { board.setChar(3, String(stoppage), { stagger: 240 }); }, 620);
            later(function () { intro.classList.add('is-titled'); }, 900);
            later(dock, 2400);
        }

        // Tabela küçülerek header'daki logonun yerine uçar
        function dock() {
            if (finished) return;
            finished = true;
            cleanup();
            rememberSeen();
            intro.classList.add('is-leaving');

            var target = brandBoardEl;
            var from = boardWrap.getBoundingClientRect();
            var to = target ? target.getBoundingClientRect() : null;
            var canAnimate = to && to.width > 0 && typeof boardWrap.animate === 'function';

            function complete() {
                root.classList.remove('da-intro-active');
                markReady();
                window.setTimeout(removeIntro, 60);
            }

            if (canAnimate) {
                var dx = (to.left + to.width / 2) - (from.left + from.width / 2);
                var dy = (to.top + to.height / 2) - (from.top + from.height / 2);
                var scale = to.width / from.width;
                var anim = boardWrap.animate([
                    { transform: 'translate(0px, 0px) scale(1)' },
                    { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(' + scale + ')' }
                ], { duration: 720, easing: 'cubic-bezier(.65, 0, .25, 1)', fill: 'forwards' });
                anim.onfinish = complete;
            } else {
                boardWrap.style.transition = 'opacity .4s ease';
                boardWrap.style.opacity = '0';
                window.setTimeout(complete, 420);
            }
        }

        later(function () { rafId = window.requestAnimationFrame(count); }, 650);
    }

    /* ---------------------------------------------------------
       6. Header: kaydırma, ışık, dakika çubuğu, başa dön
       --------------------------------------------------------- */
    var header = document.querySelector('[data-header]');
    var progress = document.querySelector('[data-progress]');
    var minuteEl = document.querySelector('[data-progress-minute]');
    var totop = document.querySelector('[data-totop]');
    var totopSpin = document.querySelector('[data-totop-spin]');
    var scrollTicking = false;
    var hideMinuteTimer = null;
    var firstScrollUpdate = true;

    function updateScroll() {
        scrollTicking = false;
        var y = window.pageYOffset || document.documentElement.scrollTop || 0;

        if (header) header.classList.toggle('is-compact', y > 16);

        var max = document.documentElement.scrollHeight - window.innerHeight;
        var scrollable = max > 80;
        var p = scrollable ? Math.min(1, Math.max(0, y / max)) : 0;

        if (progress) {
            progress.style.setProperty('--p', p.toFixed(4));
            if (minuteEl) {
                minuteEl.textContent = p >= 0.995 ? '90+' : Math.max(1, Math.round(p * 90)) + "'";
            }
            if (scrollable && y > 4 && !firstScrollUpdate) {
                progress.classList.add('is-active');
                window.clearTimeout(hideMinuteTimer);
                hideMinuteTimer = window.setTimeout(function () {
                    progress.classList.remove('is-active');
                }, 900);
            }
        }

        if (totop) {
            totop.classList.toggle('is-visible', y > 480);
            if (totopSpin && !reduceMotion) {
                totopSpin.setAttribute('transform', 'rotate(' + (y * 0.35).toFixed(1) + ')');
            }
        }

        firstScrollUpdate = false;
    }

    function onScroll() {
        if (scrollTicking) return;
        scrollTicking = true;
        window.requestAnimationFrame(updateScroll);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    updateScroll();

    if (header && !reduceMotion && canHover) {
        header.addEventListener('mousemove', function (e) {
            var r = header.getBoundingClientRect();
            header.style.setProperty('--mx', (e.clientX - r.left) + 'px');
            header.style.setProperty('--my', (e.clientY - r.top) + 'px');
            header.classList.add('is-lit');
        });
        header.addEventListener('mouseleave', function () {
            header.classList.remove('is-lit');
        });
    }

    if (totop) {
        totop.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        });
    }

    /* ---------------------------------------------------------
       7. Navigasyon
       --------------------------------------------------------- */
    var nav = document.querySelector('[data-nav]');
    var toggle = document.querySelector('[data-nav-toggle]');
    var indicator = document.querySelector('[data-nav-indicator]');

    if (nav) {
        var links = Array.prototype.slice.call(nav.querySelectorAll('[data-nav-link]'));
        var activeLink = nav.querySelector('.da-nav__link.is-active');

        var moveIndicator = function (link) {
            if (!indicator) return;
            if (!link) {
                indicator.style.opacity = '0';
                return;
            }
            indicator.style.opacity = '1';
            indicator.style.width = link.offsetWidth + 'px';
            indicator.style.transform = 'translateX(' + link.offsetLeft + 'px)';
        };

        moveIndicator(activeLink);

        // Fontlar yüklenince genişlikler değişebilir
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () { moveIndicator(activeLink); });
        }

        links.forEach(function (link) {
            link.addEventListener('mouseenter', function () { moveIndicator(link); });
            link.addEventListener('focus', function () { moveIndicator(link); });
            link.addEventListener('blur', function () { moveIndicator(activeLink); });

            link.addEventListener('pointerdown', function (e) {
                if (reduceMotion) return;
                var r = link.getBoundingClientRect();
                var ripple = document.createElement('span');
                ripple.className = 'da-ripple';
                ripple.style.left = (e.clientX - r.left) + 'px';
                ripple.style.top = (e.clientY - r.top) + 'px';
                link.appendChild(ripple);
                window.setTimeout(function () {
                    if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
                }, 650);
            });

            link.addEventListener('click', function () { setMenu(false); });
        });

        nav.addEventListener('mouseleave', function () { moveIndicator(activeLink); });
        window.addEventListener('resize', function () { moveIndicator(activeLink); });
    }

    function setMenu(open) {
        if (!toggle || !nav) return;
        toggle.setAttribute('aria-expanded', String(open));
        nav.setAttribute('data-open', String(open));
    }

    if (toggle && nav) {
        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            setMenu(toggle.getAttribute('aria-expanded') !== 'true');
        });

        document.addEventListener('click', function (e) {
            if (toggle.getAttribute('aria-expanded') === 'true' && !nav.contains(e.target)) {
                setMenu(false);
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
                setMenu(false);
                toggle.focus();
            }
        });
    }

    /* ---------------------------------------------------------
       8. Roma saati
       --------------------------------------------------------- */
    var clockTime = document.querySelector('[data-clock-time]');
    if (clockTime) {
        var clockFormat = null;
        try {
            clockFormat = new Intl.DateTimeFormat('tr-TR', {
                hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Rome'
            });
        } catch (e) {
            clockFormat = null;
        }

        var tickClock = function () {
            if (!clockFormat) {
                var wrap = clockTime.closest('[data-clock]');
                if (wrap) wrap.style.display = 'none';
                return;
            }
            var parts = clockFormat.format(new Date()).split(':');
            clockTime.innerHTML = '<span>' + parts[0] + '</span><span class="da-clock__colon">:</span><span>' + (parts[1] || '00') + '</span>';
            var now = new Date();
            var msToNextMinute = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
            window.setTimeout(tickClock, msToNextMinute + 50);
        };

        tickClock();
    }

    /* ---------------------------------------------------------
       9. Header tabelasının uzatma dakikası değişimi
       --------------------------------------------------------- */
    var flickerStarted = false;
    var lastRefresh = 0;

    function refreshStoppage() {
        if (!brandBoard || reduceMotion) return;
        var now = Date.now();
        if (now - lastRefresh < 1200) return;
        lastRefresh = now;

        var next = stoppage;
        while (next === stoppage) next = 1 + Math.floor(Math.random() * 7);
        stoppage = next;

        if (brandBoardEl) {
            brandBoardEl.classList.remove('is-refresh');
            void brandBoardEl.offsetWidth;
            brandBoardEl.classList.add('is-refresh');
        }

        brandBoard.setChar(3, ' ', { stagger: 140 });
        window.setTimeout(function () {
            brandBoard.setChar(3, String(next), { stagger: 260 });
        }, 200);
    }

    function startBoardFlicker() {
        if (flickerStarted || !brandBoard || reduceMotion) return;
        flickerStarted = true;

        window.setInterval(function () {
            if (!document.hidden) refreshStoppage();
        }, 7000);

        var brand = document.querySelector('.da-brand');
        if (brand && canHover) {
            brand.addEventListener('mouseenter', refreshStoppage);
        }
    }

    /* ---------------------------------------------------------
       10. Footer saha çizgileri
       --------------------------------------------------------- */
    var footer = document.querySelector('[data-footer]');
    if (footer) {
        if ('IntersectionObserver' in window && !reduceMotion) {
            var footerObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        footer.classList.add('is-drawn');
                        footerObserver.disconnect();
                    }
                });
            }, { threshold: 0.2 });
            footerObserver.observe(footer);
        } else {
            footer.classList.add('is-drawn');
        }
    }

    /* Başlat */
    runIntro();
})();
