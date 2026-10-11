/* =================================================================
   Doksan Artı — Teknik Masa grafik motoru (admin-charts.js)
   Harici kütüphane yok: SVG ve HTML ile çizilen küçük bir set.
   1  Ortak: ipucu kutusu, görünür olunca çalıştır, yeniden boyutlama
   2  Sayaç (sayılar 0'dan yukarı sayar)
   3  İlerleme halkası
   4  Sütun grafik (yığılmış ya da tek seri)
   5  Çizgi grafik (çok seri, artı imleç, uçta etiket)
   6  Halka grafik
   7  Mini çizgi (sparkline)
   8  Yatay çubuklar (sıralama, iki yönlü)
   9  Isı haritası (skor dağılımı)
   Hepsi window.TM.charts altında.
   ================================================================= */
(function () {
    'use strict';

    var TM = window.TM;
    if (!TM) return;

    var reduce = TM.reduceMotion;
    var SVGNS = 'http://www.w3.org/2000/svg';
    var nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
    var nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    var nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    /* ---------------------------------------------------------
       1. Ortak
       --------------------------------------------------------- */
    var tip = document.createElement('div');
    tip.className = 'tm-tip';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    document.body.appendChild(tip);

    function showTip(html, x, y) {
        tip.innerHTML = html;
        tip.hidden = false;
        var w = tip.offsetWidth;
        var h = tip.offsetHeight;
        var left = Math.min(window.innerWidth - w - 10, Math.max(10, x - w / 2));
        var top = y - h - 14;
        if (top < 10) top = y + 18;
        tip.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(top) + 'px)';
    }

    function hideTip() { tip.hidden = true; }
    window.addEventListener('scroll', hideTip, { passive: true });

    // Öğe ekrana girince bir kez çalıştırır (animasyonlar görünmeden boşa oynamasın)
    function whenVisible(el, fn) {
        if (reduce || !('IntersectionObserver' in window)) { fn(); return; }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) { io.disconnect(); fn(); }
            });
        }, { rootMargin: '0px 0px -8% 0px' });
        io.observe(el);
    }

    // Kabın genişliği değişince yeniden çizer (ilk çizimde animasyon, sonrakilerde yok)
    function responsive(el, draw) {
        var lastW = 0;
        var first = true;
        function run() {
            var w = Math.floor(el.clientWidth);
            if (!w || w === lastW) return;
            lastW = w;
            draw(w, first);
            first = false;
        }
        whenVisible(el, run);
        if ('ResizeObserver' in window) {
            var t = null;
            new ResizeObserver(function () {
                if (first) return;
                window.clearTimeout(t);
                t = window.setTimeout(run, 120);
            }).observe(el);
        }
        return { redraw: function () { lastW = 0; run(); } };
    }

    function svg(w, h, cls) {
        return '<svg class="tm-chart__svg ' + (cls || '') + '" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" focusable="false">';
    }

    // Üstü 4px yuvarlak, tabanı düz sütun
    function topRounded(x, y, w, h, r) {
        if (h <= 0) return '';
        r = Math.min(r, h, w / 2);
        return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
            'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
    }

    function rightRounded(x, y, w, h, r) {
        if (w <= 0) return '';
        r = Math.min(r, w, h / 2);
        return 'M' + x + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) +
            'V' + (y + h - r) + 'Q' + (x + w) + ',' + (y + h) + ' ' + (x + w - r) + ',' + (y + h) + 'H' + x + 'Z';
    }

    // Eksen için "güzel" üst sınır ve aralık
    function niceScale(max, ticks) {
        ticks = ticks || 4;
        if (max <= 0) return { max: ticks, step: 1 };
        var raw = max / ticks;
        var mag = Math.pow(10, Math.floor(Math.log10(raw)));
        var norm = raw / mag;
        var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
        if (step < 1) step = 1;
        return { max: Math.ceil(max / step) * step, step: step };
    }

    function fmt(n, d) {
        return d === 2 ? nf2.format(n) : d === 1 ? nf1.format(n) : nf0.format(n);
    }

    /* ---------------------------------------------------------
       2. Sayaç: [data-count="47"] [data-count-decimals="2"] [data-count-suffix="%"]
       --------------------------------------------------------- */
    function countUp(el) {
        var target = parseFloat(String(el.getAttribute('data-count')).replace(',', '.')) || 0;
        var decimals = parseInt(el.getAttribute('data-count-decimals') || '0', 10);
        var suffix = el.getAttribute('data-count-suffix') || '';
        var done = function () { el.textContent = fmt(target, decimals) + suffix; };
        if (reduce || target === 0) { done(); return; }
        var duration = Math.min(1600, 700 + target * 12);
        whenVisible(el, function () {
            var start = performance.now();
            function frame(t) {
                var p = Math.min(1, (t - start) / duration);
                var eased = 1 - Math.pow(1 - p, 3);
                el.textContent = fmt(target * eased, decimals) + suffix;
                if (p < 1) window.requestAnimationFrame(frame); else done();
            }
            el.textContent = fmt(0, decimals) + suffix;
            window.requestAnimationFrame(frame);
        });
    }

    function initCounters(root) {
        TM.$$('[data-count]', root).forEach(countUp);
    }

    /* ---------------------------------------------------------
       3. İlerleme halkası
       options: { value 0..1, size, stroke, tone: 'blue'|'green'|'amber' }
       --------------------------------------------------------- */
    function ring(el, options) {
        var size = options.size || 120;
        var stroke = options.stroke || 10;
        var r = (size - stroke) / 2;
        var v = Math.max(0, Math.min(1, options.value || 0));
        var id = 'tmRing' + Math.random().toString(36).slice(2, 8);
        el.innerHTML =
            '<svg class="tm-ring tm-ring--' + (options.tone || 'blue') + '" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" aria-hidden="true">' +
            '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="tm-ring__g1"/><stop offset="1" class="tm-ring__g2"/></linearGradient></defs>' +
            '<circle class="tm-ring__track" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + stroke + '"/>' +
            '<circle class="tm-ring__ticks" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + (r - stroke / 2 - 5) + '" pathLength="100"/>' +
            '<circle class="tm-ring__bar" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + stroke + '" pathLength="100" stroke="url(#' + id + ')" ' +
            'stroke-dasharray="0 100" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
            '</svg>';
        var bar = el.querySelector('.tm-ring__bar');
        var final = (v * 100).toFixed(2) + ' 100';
        if (reduce) { bar.setAttribute('stroke-dasharray', final); return; }
        whenVisible(el, function () {
            window.requestAnimationFrame(function () {
                window.requestAnimationFrame(function () { bar.setAttribute('stroke-dasharray', final); });
            });
        });
    }

    /* ---------------------------------------------------------
       4. Sütun grafik
       options:
         labels   : ['1', '2', ...]  x ekseni
         series   : [{ name, color, values: [] }]  birden fazlaysa üst üste yığılır
         height   : piksel
         xLabel   : fn(label, i) -> x ekseni yazısı
         tooltip  : fn(i) -> html
         highlight: vurgulanacak sütun indeksi
         onClick  : fn(i)
       --------------------------------------------------------- */
    function bars(el, options) {
        var height = options.height || 220;
        return responsive(el, function (width, animate) {
            var padL = 30, padR = 6, padT = 14, padB = 28;
            var n = options.labels.length;
            var totals = options.labels.map(function (_, i) {
                return options.series.reduce(function (s, se) { return s + (se.values[i] || 0); }, 0);
            });
            var scale = niceScale(Math.max.apply(null, totals.concat([1])), 4);
            var plotW = width - padL - padR;
            var plotH = height - padT - padB;
            var band = plotW / Math.max(1, n);
            var colW = Math.max(6, Math.min(34, band * 0.58));
            var y = function (v) { return padT + plotH - (v / scale.max) * plotH; };

            var html = svg(width, height, 'tm-bars' + (animate && !reduce ? ' is-animating' : ''));
            // Izgara
            for (var t = 0; t <= scale.max + 0.001; t += scale.step) {
                html += '<line class="tm-chart__grid' + (t === 0 ? ' is-base' : '') + '" x1="' + padL + '" x2="' + (width - padR) + '" y1="' + y(t) + '" y2="' + y(t) + '"/>';
                html += '<text class="tm-chart__tick" x="' + (padL - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + fmt(t) + '</text>';
            }
            // Sütunlar
            var skip = Math.ceil(n / Math.max(1, Math.floor(plotW / 34)));
            options.labels.forEach(function (label, i) {
                var cx = padL + band * i + band / 2;
                var x = cx - colW / 2;
                var cls = 'tm-bars__col' + (options.highlight === i ? ' is-current' : '');
                html += '<g class="' + cls + '" data-i="' + i + '" style="--i:' + i + '">';
                var base = 0;
                var visible = options.series.filter(function (s) { return (s.values[i] || 0) > 0; });
                options.series.forEach(function (s) {
                    var v = s.values[i] || 0;
                    if (v <= 0) return;
                    var isTop = s === visible[visible.length - 1];
                    var y0 = y(base);
                    var y1 = y(base + v);
                    var gap = base > 0 ? 2 : 0;
                    var h = Math.max(0, y0 - y1 - gap);
                    html += isTop
                        ? '<path class="tm-bars__seg" d="' + topRounded(x, y1, colW, h, 4) + '" fill="' + s.color + '"/>'
                        : '<rect class="tm-bars__seg" x="' + x + '" y="' + y1 + '" width="' + colW + '" height="' + h + '" fill="' + s.color + '"/>';
                    base += v;
                });
                if (totals[i] === 0) {
                    html += '<rect class="tm-bars__empty" x="' + x + '" y="' + (y(0) - 2) + '" width="' + colW + '" height="2" rx="1"/>';
                }
                html += '</g>';
                if (i % skip === 0 || options.highlight === i) {
                    var text = options.xLabel ? options.xLabel(label, i) : label;
                    html += '<text class="tm-chart__xtick' + (options.highlight === i ? ' is-current' : '') + '" x="' + cx + '" y="' + (height - 8) + '" text-anchor="middle">' + TM.esc(text) + '</text>';
                }
                // Geniş tıklama/hover alanı
                html += '<rect class="tm-chart__hit" data-i="' + i + '" x="' + (padL + band * i) + '" y="' + padT + '" width="' + band + '" height="' + plotH + '"/>';
            });
            html += '</svg>';
            el.innerHTML = html;
            bindHover(el, '.tm-chart__hit', function (i) { return options.tooltip ? options.tooltip(i) : ''; }, function (i, on) {
                var col = el.querySelector('.tm-bars__col[data-i="' + i + '"]');
                if (col) col.classList.toggle('is-hover', on);
            }, options.onClick);
        });
    }

    function bindHover(el, selector, html, toggle, onClick) {
        var current = null;
        function leave() {
            if (current !== null && toggle) toggle(current, false);
            current = null;
            hideTip();
        }
        el.addEventListener('pointermove', function (e) {
            var hit = e.target.closest && e.target.closest(selector);
            if (!hit) { leave(); return; }
            var i = parseInt(hit.getAttribute('data-i'), 10);
            if (i !== current) {
                if (current !== null && toggle) toggle(current, false);
                current = i;
                if (toggle) toggle(i, true);
            }
            var content = html(i);
            if (content) showTip(content, e.clientX, e.clientY); else hideTip();
        });
        el.addEventListener('pointerleave', leave);
        if (onClick) {
            el.addEventListener('click', function (e) {
                var hit = e.target.closest && e.target.closest(selector);
                if (hit) onClick(parseInt(hit.getAttribute('data-i'), 10));
            });
            el.classList.add('is-clickable');
        }
    }

    /* ---------------------------------------------------------
       5. Çizgi grafik
       options:
         labels      : x ekseni değerleri (hafta numaraları)
         series      : [{ id, name, color, values }]
         height
         invert      : true -> küçük değer üstte (sıralama grafiği)
         yMin, yMax  : sabit eksen sınırları
         yTicks      : [değerler] sabit eksen çizgileri
         xLabel      : fn(label) -> metin
         tooltipTitle: fn(i) -> başlık
         valueText   : fn(v, series) -> metin
         labelWidth  : uçtaki isim etiketleri için sağ boşluk
       --------------------------------------------------------- */
    function line(el, options) {
        var height = options.height || 240;
        return responsive(el, function (width, animate) {
            var labelW = options.labelWidth === undefined ? 92 : options.labelWidth;
            var padL = 30, padR = labelW + 10, padT = 14, padB = 28;
            var n = options.labels.length;
            var all = [];
            options.series.forEach(function (s) { all = all.concat(s.values); });
            var minV = options.yMin !== undefined ? options.yMin : 0;
            var scale = options.yMax !== undefined ? { max: options.yMax, step: 1 } : niceScale(Math.max.apply(null, all.concat([1])), 4);
            var plotW = width - padL - padR;
            var plotH = height - padT - padB;
            var x = function (i) { return padL + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1)); };
            var y = function (v) {
                var ratio = (v - minV) / Math.max(1, scale.max - minV);
                return options.invert ? padT + ratio * plotH : padT + plotH - ratio * plotH;
            };

            var html = svg(width, height, 'tm-line' + (animate && !reduce ? ' is-animating' : ''));
            var ticks = options.yTicks || [];
            if (!ticks.length) for (var t = minV; t <= scale.max + 0.001; t += scale.step) ticks.push(t);
            ticks.forEach(function (t) {
                html += '<line class="tm-chart__grid" x1="' + padL + '" x2="' + (width - padR) + '" y1="' + y(t) + '" y2="' + y(t) + '"/>';
                html += '<text class="tm-chart__tick" x="' + (padL - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + fmt(t) + '</text>';
            });
            var skip = Math.ceil(n / Math.max(1, Math.floor(plotW / 30)));
            options.labels.forEach(function (label, i) {
                if (i % skip !== 0 && i !== n - 1) return;
                html += '<text class="tm-chart__xtick" x="' + x(i) + '" y="' + (height - 8) + '" text-anchor="middle">' + TM.esc(options.xLabel ? options.xLabel(label) : label) + '</text>';
            });

            html += '<line class="tm-line__cross" x1="0" x2="0" y1="' + padT + '" y2="' + (padT + plotH) + '" hidden/>';

            // Çizgiler
            options.series.forEach(function (s, si) {
                var d = s.values.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join('');
                var area = options.area && si === 0
                    ? '<path class="tm-line__area" d="' + d + 'L' + x(n - 1) + ',' + (padT + plotH) + 'L' + x(0) + ',' + (padT + plotH) + 'Z" fill="' + s.color + '"/>'
                    : '';
                html += '<g class="tm-line__series" data-s="' + si + '" style="--i:' + si + ';--c:' + s.color + '">' + area +
                    '<path class="tm-line__path" d="' + d + '" stroke="' + s.color + '" pathLength="1"/>';
                if (n === 1) html += '<circle class="tm-line__end" cx="' + x(0) + '" cy="' + y(s.values[0]) + '" r="4.5" fill="' + s.color + '"/>';
                else html += '<circle class="tm-line__end" cx="' + x(n - 1) + '" cy="' + y(s.values[n - 1]) + '" r="4.5" fill="' + s.color + '"/>';
                html += '<circle class="tm-line__dot" r="5" fill="' + s.color + '" hidden/></g>';
            });

            // Uçtaki etiketler: çakışmasın diye en az 15px aralıkla dizilir
            if (labelW > 0) {
                var ends = options.series.map(function (s, si) {
                    return { si: si, s: s, y: y(s.values[n - 1]) };
                }).sort(function (a, b) { return a.y - b.y; });
                for (var k = 1; k < ends.length; k++) {
                    if (ends[k].y - ends[k - 1].y < 15) ends[k].y = ends[k - 1].y + 15;
                }
                var overflow = ends.length ? ends[ends.length - 1].y - (padT + plotH + 4) : 0;
                if (overflow > 0) ends.forEach(function (e) { e.y -= overflow; });
                ends.forEach(function (e) {
                    var val = options.valueText ? options.valueText(e.s.values[n - 1], e.s) : fmt(e.s.values[n - 1]);
                    html += '<text class="tm-line__label" data-s="' + e.si + '" x="' + (width - padR + 10) + '" y="' + (e.y + 4) + '">' +
                        '<tspan class="tm-line__label-name">' + TM.esc(e.s.short || e.s.name) + '</tspan>' +
                        '<tspan class="tm-line__label-val" dx="5">' + TM.esc(val) + '</tspan></text>';
                });
            }

            html += '<rect class="tm-chart__hit tm-line__hit" x="' + padL + '" y="' + padT + '" width="' + plotW + '" height="' + plotH + '"/>';
            html += '</svg>';
            el.innerHTML = html;

            var cross = el.querySelector('.tm-line__cross');
            var hit = el.querySelector('.tm-line__hit');
            var svgEl = el.querySelector('svg');
            var dots = TM.$$('.tm-line__dot', el);

            function move(e) {
                var rect = svgEl.getBoundingClientRect();
                var px = (e.clientX - rect.left) * (width / rect.width);
                var i = n <= 1 ? 0 : Math.round(((px - padL) / plotW) * (n - 1));
                i = Math.max(0, Math.min(n - 1, i));
                cross.setAttribute('x1', x(i));
                cross.setAttribute('x2', x(i));
                cross.hidden = false;
                dots.forEach(function (dot, si) {
                    dot.setAttribute('cx', x(i));
                    dot.setAttribute('cy', y(options.series[si].values[i]));
                    dot.hidden = false;
                });
                var rows = options.series.map(function (s) { return { s: s, v: s.values[i] }; })
                    .sort(function (a, b) { return options.invert ? a.v - b.v : b.v - a.v; });
                var title = options.tooltipTitle ? options.tooltipTitle(i) : options.labels[i];
                var body = rows.map(function (r) {
                    return '<span class="tm-tip__row"><i style="background:' + r.s.color + '"></i>' + TM.esc(r.s.name) +
                        '<b>' + TM.esc(options.valueText ? options.valueText(r.v, r.s) : fmt(r.v)) + '</b></span>';
                }).join('');
                showTip('<strong class="tm-tip__title">' + TM.esc(title) + '</strong>' + body, e.clientX, rect.top + (y(rows[0].v) * rect.height / height));
            }
            function leave() {
                cross.hidden = true;
                dots.forEach(function (d) { d.hidden = true; });
                hideTip();
            }
            hit.addEventListener('pointermove', move);
            hit.addEventListener('pointerleave', leave);

            // Etikete gelince o çizgi öne çıkar
            TM.$$('.tm-line__label', el).forEach(function (lab) {
                var si = lab.getAttribute('data-s');
                lab.addEventListener('pointerenter', function () { svgEl.classList.add('has-focus'); focusSeries(si, true); });
                lab.addEventListener('pointerleave', function () { svgEl.classList.remove('has-focus'); focusSeries(si, false); });
            });
            function focusSeries(si, on) {
                var g = el.querySelector('.tm-line__series[data-s="' + si + '"]');
                if (g) g.classList.toggle('is-focus', on);
                var lab = el.querySelector('.tm-line__label[data-s="' + si + '"]');
                if (lab) lab.classList.toggle('is-focus', on);
            }
        });
    }

    /* ---------------------------------------------------------
       6. Halka grafik
       options: { segments: [{ label, value, color }], size, thickness, centerValue, centerLabel, tooltip: fn(seg) }
       --------------------------------------------------------- */
    function donut(el, options) {
        var size = options.size || 180;
        var thick = options.thickness || 20;
        var r = (size - thick) / 2;
        var total = options.segments.reduce(function (s, x) { return s + x.value; }, 0);
        var gap = total > 0 && options.segments.filter(function (s) { return s.value > 0; }).length > 1 ? (2 / (2 * Math.PI * r)) * 100 + 0.4 : 0;
        var start = 0;
        var html = '<svg class="tm-donut__svg" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" focusable="false">' +
            '<circle class="tm-donut__track" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + thick + '"/>';
        var finals = [];
        options.segments.forEach(function (s, i) {
            if (s.value <= 0 || total === 0) { finals.push(null); return; }
            var len = Math.max(0.1, (s.value / total) * 100 - gap);
            finals.push(len.toFixed(2) + ' ' + (100 - len).toFixed(2));
            html += '<circle class="tm-donut__seg" data-i="' + i + '" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke="' + s.color + '" stroke-width="' + thick + '" pathLength="100" ' +
                'stroke-dasharray="0 100" stroke-dashoffset="' + (-start).toFixed(2) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')" style="--i:' + i + '"/>';
            start += (s.value / total) * 100;
        });
        html += '</svg>';
        if (options.centerValue !== undefined) {
            html += '<span class="tm-donut__center"><strong>' + TM.esc(options.centerValue) + '</strong><span>' + TM.esc(options.centerLabel || '') + '</span></span>';
        }
        el.innerHTML = html;
        el.classList.add('tm-donut');

        function draw() {
            TM.$$('.tm-donut__seg', el).forEach(function (c) {
                var i = parseInt(c.getAttribute('data-i'), 10);
                c.setAttribute('stroke-dasharray', finals[i]);
            });
        }
        if (reduce) draw(); else whenVisible(el, function () { window.requestAnimationFrame(function () { window.requestAnimationFrame(draw); }); });

        bindHover(el, '.tm-donut__seg', function (i) {
            var s = options.segments[i];
            if (options.tooltip) return options.tooltip(s, total);
            var pct = total ? Math.round((s.value / total) * 100) : 0;
            return '<span class="tm-tip__row"><i style="background:' + s.color + '"></i>' + TM.esc(s.label) + '<b>' + fmt(s.value) + ' (%' + pct + ')</b></span>';
        }, function (i, on) {
            var c = el.querySelector('.tm-donut__seg[data-i="' + i + '"]');
            if (c) c.classList.toggle('is-hover', on);
        });
    }

    /* ---------------------------------------------------------
       7. Mini çizgi
       --------------------------------------------------------- */
    function spark(el, values, options) {
        options = options || {};
        var w = 120, h = 36, pad = 4;
        if (!values.length) { el.innerHTML = ''; return; }
        var max = Math.max.apply(null, values.concat([1]));
        var min = options.zero === false ? Math.min.apply(null, values) : 0;
        var x = function (i) { return values.length === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (values.length - 1); };
        var y = function (v) { return h - pad - ((v - min) / Math.max(1e-6, max - min)) * (h - pad * 2); };
        var d = values.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join('');
        var id = 'tmSp' + Math.random().toString(36).slice(2, 8);
        var color = options.color || 'var(--tm-blue-2)';
        el.innerHTML = '<svg class="tm-spark' + (reduce ? '' : ' is-animating') + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
            '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".35"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
            '<path class="tm-spark__area" d="' + d + 'L' + x(values.length - 1) + ',' + h + 'L' + x(0) + ',' + h + 'Z" fill="url(#' + id + ')"/>' +
            '<path class="tm-spark__line" d="' + d + '" stroke="' + color + '" pathLength="1"/>' +
            '<circle class="tm-spark__dot" cx="' + x(values.length - 1) + '" cy="' + y(values[values.length - 1]) + '" r="3" fill="' + color + '"/></svg>';
    }

    /* ---------------------------------------------------------
       8. Yatay çubuklar (HTML)
       rows: [{ label, value, display, crest, sub, href, color }]
       options: { max, diverging, format }
       --------------------------------------------------------- */
    function hbars(el, rows, options) {
        options = options || {};
        var max = options.max || Math.max.apply(null, rows.map(function (r) { return Math.abs(r.value); }).concat([1]));
        var html = '<ol class="tm-hbars' + (options.diverging ? ' tm-hbars--div' : '') + '">';
        rows.forEach(function (r, i) {
            var pct = Math.min(100, (Math.abs(r.value) / max) * 100);
            var neg = r.value < 0;
            var tag = r.href ? 'a' : 'div';
            html += '<li style="--i:' + i + '"><' + tag + ' class="tm-hbars__row' + (neg ? ' is-neg' : '') + '"' + (r.href ? ' href="' + TM.esc(r.href) + '"' : '') + '>' +
                '<span class="tm-hbars__rank">' + (i + 1) + '</span>' +
                (r.crest || '') +
                '<span class="tm-hbars__label">' + TM.esc(r.label) + (r.sub ? '<small>' + TM.esc(r.sub) + '</small>' : '') + '</span>' +
                '<span class="tm-hbars__track"><span class="tm-hbars__fill" style="--w:' + pct.toFixed(1) + '%' + (r.color ? ';--c:' + r.color : '') + '"></span></span>' +
                '<span class="tm-hbars__value">' + TM.esc(r.display !== undefined ? r.display : fmt(r.value)) + '</span>' +
                '</' + tag + '></li>';
        });
        html += '</ol>';
        el.innerHTML = html;
        var list = el.querySelector('.tm-hbars');
        if (reduce) list.classList.add('is-in');
        else whenVisible(list, function () { window.requestAnimationFrame(function () { list.classList.add('is-in'); }); });
    }

    /* ---------------------------------------------------------
       9. Isı haritası (skor dağılımı)
       data: TM.league.scorelines() sonucu
       --------------------------------------------------------- */
    var RAMP = ['#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec', '#86b6ef', '#9ec5f4'];

    function heat(el, data, options) {
        options = options || {};
        var cap = data.cap;
        var html = '<div class="tm-heat" style="--n:' + (cap + 1) + '">';
        html += '<span class="tm-heat__corner" aria-hidden="true"><span>Ev</span><span>Dep</span></span>';
        for (var a = 0; a <= cap; a++) html += '<span class="tm-heat__head">' + (a === cap ? cap + '+' : a) + '</span>';
        for (var h = 0; h <= cap; h++) {
            html += '<span class="tm-heat__head tm-heat__head--row">' + (h === cap ? cap + '+' : h) + '</span>';
            for (a = 0; a <= cap; a++) {
                var v = data.grid[h][a];
                var level = v === 0 || data.max === 0 ? -1 : Math.round((v / data.max) * (RAMP.length - 1));
                var bg = level < 0 ? '' : ';--bg:' + RAMP[level];
                var light = level >= 5;
                var label = (h === cap ? cap + '+' : h) + '-' + (a === cap ? cap + '+' : a);
                html += '<span class="tm-heat__cell' + (level < 0 ? ' is-zero' : '') + (light ? ' is-light' : '') + (h === a ? ' is-draw' : '') + '" ' +
                    'style="--i:' + (h * (cap + 1) + a) + bg + '" data-label="' + label + '" data-v="' + v + '">' + (v || '') + '</span>';
            }
        }
        html += '</div>';
        el.innerHTML = html;
        var grid = el.querySelector('.tm-heat');
        if (reduce) grid.classList.add('is-in'); else whenVisible(grid, function () { grid.classList.add('is-in'); });
        el.addEventListener('pointermove', function (e) {
            var c = e.target.closest && e.target.closest('.tm-heat__cell');
            if (!c) { hideTip(); return; }
            var v = c.getAttribute('data-v');
            showTip('<strong class="tm-tip__title">' + c.getAttribute('data-label') + '</strong><span class="tm-tip__row">' + v + ' maç bu skorla bitti</span>', e.clientX, e.clientY);
        });
        el.addEventListener('pointerleave', hideTip);
    }

    TM.charts = {
        showTip: showTip, hideTip: hideTip, whenVisible: whenVisible, fmt: fmt,
        countUp: countUp, initCounters: initCounters, ring: ring,
        bars: bars, line: line, donut: donut, spark: spark, hbars: hbars, heat: heat,
        topRounded: topRounded, rightRounded: rightRounded, niceScale: niceScale,
        // Doğrulanmış kategorik palet (koyu zemin, #0C1830 üzerinde)
        palette: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9'],
        home: '#3987e5',
        away: '#d95926'
    };

    initCounters(document);
})();
