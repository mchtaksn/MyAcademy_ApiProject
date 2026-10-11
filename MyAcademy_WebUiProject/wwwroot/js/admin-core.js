/* =================================================================
   Doksan Artı — Teknik Masa ortak çekirdeği (admin-core.js)
   Bütün admin sayfalarında yüklenir; sayfa dosyaları window.TM üzerinden kullanır.
   1  Yardımcılar        6  Kırmızı kart (silme onayı)
   2  Arma               7  Veri önbelleği + menü rozetleri
   3  LED tabelalar      8  Hızlı arama (Ctrl+K)
   4  API çağrıları      9  Yan menü (mobil)
   5  Bildirim + dialog  10 Sayfa içi yönlendirme
   ================================================================= */
(function () {
    'use strict';

    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var trLocale = 'tr-TR';

    /* ---------------------------------------------------------
       1. Yardımcılar
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
        var code = letters.toUpperCase().slice(0, 3);
        while (code.length < 3) code += '?';
        return code;
    }

    // Razor tarafındaki Hue() ile aynı hesap: aynı takım her yerde aynı rengi alır
    function hue(name) {
        var sum = 0;
        var s = String(name || '');
        for (var i = 0; i < s.length; i++) sum = (sum + s.charCodeAt(i) * 37) % 360;
        return sum;
    }

    var STATUS = {
        Planlandi: 'Planlandı',
        Oynaniyor: 'Canlı',
        Tamamlandi: 'Tamamlandı',
        Ertelendi: 'Ertelendi'
    };

    function statusLabel(status) { return STATUS[status] || 'Planlandı'; }
    function hasScore(status) { return status === 'Oynaniyor' || status === 'Tamamlandi'; }

    function toDate(value) {
        if (value instanceof Date) return value;
        // "2026-10-17T15:00:00" yerel saat olarak okunur
        return new Date(String(value));
    }

    var fmtDay = new Intl.DateTimeFormat(trLocale, { day: 'numeric', month: 'short', weekday: 'short' });
    var fmtLong = new Intl.DateTimeFormat(trLocale, { day: 'numeric', month: 'long', weekday: 'long' });
    var fmtTime = new Intl.DateTimeFormat(trLocale, { hour: '2-digit', minute: '2-digit', hour12: false });
    var fmtShort = new Intl.DateTimeFormat(trLocale, { day: 'numeric', month: 'short' });

    function pad(n) { return (n < 10 ? '0' : '') + n; }

    // <input type="date"> ve <input type="time"> değerleri
    function dateInputValue(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function timeInputValue(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

    // Maç saati geçtiği halde planlı kalmış mı?
    function isOverdue(match, now) {
        var t = toDate(match.matchDate).getTime();
        now = now || Date.now();
        if (match.status === 'Planlandi') return t + 2 * 3600 * 1000 < now;
        if (match.status === 'Oynaniyor') return t + 3 * 3600 * 1000 < now;
        return false;
    }

    function params() { return new URLSearchParams(window.location.search); }

    // Adres çubuğunu sayfayı yenilemeden günceller (?edit=5 gibi)
    function setParams(changes) {
        var p = params();
        Object.keys(changes).forEach(function (k) {
            if (changes[k] === null || changes[k] === undefined || changes[k] === '') p.delete(k);
            else p.set(k, changes[k]);
        });
        var q = p.toString();
        window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : ''));
    }

    function readSeed() {
        var el = document.getElementById('tmSeed');
        if (!el) return null;
        try { return JSON.parse(el.textContent || '{}'); } catch (e) { return null; }
    }

    /* ---------------------------------------------------------
       2. Arma: logo varsa resim, yoksa renkli kısaltma
       --------------------------------------------------------- */
    function crest(name, logoUrl, size) {
        var cls = 'tm-crest' + (size ? ' tm-crest--' + size : '');
        if (logoUrl) {
            return '<img class="' + cls + '" src="' + esc(logoUrl) + '" alt="" loading="lazy" data-crest-name="' + esc(name) + '">';
        }
        return '<span class="' + cls + '" style="--h:' + hue(name) + '" aria-hidden="true">' + esc(teamCode(name)) + '</span>';
    }

    // Kırık logo adresleri sessizce kısaltma armasına döner
    document.addEventListener('error', function (e) {
        var img = e.target;
        if (!img || img.tagName !== 'IMG' || !img.classList.contains('tm-crest') || img.dataset.fallback) return;
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
       3. LED tabelalar (layout.js'teki DaLed motoru)
       --------------------------------------------------------- */
    function led(el, text, tone, animate) {
        if (!window.DaLed || !el) return null;
        text = String(text);
        var board = window.DaLed.create(el, text.length);
        var tones = [];
        for (var i = 0; i < text.length; i++) tones.push(tone || 'green');
        board.setTones(tones);
        board.setText(text, animate && !reduceMotion ? { stagger: 260 } : null);
        return board;
    }

    function initLeds(root) {
        $$('[data-led][data-led-text]', root).forEach(function (el) {
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
       4. API çağrıları (anti-forgery token header'da gider)
       --------------------------------------------------------- */
    function token() {
        var input = document.querySelector('input[name="__RequestVerificationToken"]');
        return input ? input.value : '';
    }

    function api(url, options) {
        options = options || {};
        var init = {
            method: options.method || 'GET',
            headers: { 'Accept': 'application/json', 'RequestVerificationToken': token() },
            credentials: 'same-origin'
        };
        if (options.body !== undefined) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(options.body);
        }

        return fetch(url, init)
            .then(function (res) {
                return res.text().then(function (text) {
                    var data = null;
                    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
                    if (!res.ok) {
                        var msg = res.status === 400
                            ? 'Güvenlik doğrulaması başarısız oldu. Sayfayı yenileyip tekrar dene.'
                            : 'Sunucu hatası (HTTP ' + res.status + ').';
                        return { ok: false, message: (data && data.message) || msg, errors: {} };
                    }
                    return data || { ok: true };
                });
            })
            .catch(function () {
                return { ok: false, message: 'Sunucuya ulaşılamadı. Bağlantını kontrol et.', errors: {} };
            });
    }

    /* ---------------------------------------------------------
       5. Bildirim + dialog yardımcıları
       --------------------------------------------------------- */
    var toastHost = $('[data-toasts]');
    var toastIcons = { success: 'tm-i-check', error: 'tm-i-alert', info: 'tm-i-info', warn: 'tm-i-alert' };

    function toast(message, type, duration) {
        if (!toastHost) return;
        type = type || 'success';
        duration = duration || (type === 'error' ? 6000 : 4000);

        var el = document.createElement('div');
        el.className = 'tm-toast tm-toast--' + type;
        el.setAttribute('role', type === 'error' ? 'alert' : 'status');
        el.style.setProperty('--d', duration + 'ms');
        el.innerHTML =
            '<span class="tm-toast__led"><svg class="tm-icon" aria-hidden="true"><use href="#' + toastIcons[type] + '"/></svg></span>' +
            '<span class="tm-toast__text">' + esc(message) + '</span>' +
            '<span class="tm-toast__time" aria-hidden="true"></span>';
        toastHost.appendChild(el);

        // En fazla 4 bildirim aynı anda
        while (toastHost.children.length > 4) toastHost.removeChild(toastHost.firstChild);

        var remove = function () {
            el.classList.add('is-leaving');
            window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
        };
        var timer = window.setTimeout(remove, duration);
        el.addEventListener('click', function () { window.clearTimeout(timer); remove(); });
    }

    var lastFocus = new WeakMap();

    function openDialog(dialog) {
        if (!dialog || dialog.open) return;
        lastFocus.set(dialog, document.activeElement);
        dialog.showModal();
    }

    function closeDialog(dialog) {
        if (dialog && dialog.open) dialog.close();
    }

    // Tüm modallar: arka plana tıklayınca ve [data-modal-close] ile kapanır, odak geri döner
    $$('dialog.tm-modal').forEach(function (dialog) {
        dialog.addEventListener('click', function (e) {
            if (e.target === dialog) closeDialog(dialog);
        });
        $$('[data-modal-close]', dialog).forEach(function (btn) {
            btn.addEventListener('click', function () { closeDialog(dialog); });
        });
        dialog.addEventListener('close', function () {
            var el = lastFocus.get(dialog);
            if (el && typeof el.focus === 'function' && document.contains(el)) el.focus();
        });
    });

    function setBusy(button, busy) {
        if (!button) return;
        button.classList.toggle('is-busy', busy);
        button.disabled = busy;
    }

    // Sunucudan gelen { alan: mesaj } hatalarını formda gösterir
    function showErrors(form, result) {
        clearErrors(form);
        var errors = (result && result.errors) || {};
        var keys = Object.keys(errors);
        keys.forEach(function (key) {
            var target = form.querySelector('[data-error-for="' + key + '"]');
            if (!target) return;
            target.textContent = errors[key];
            var field = target.closest('[data-field]') || target.parentNode;
            field.classList.add('has-error');
        });

        var alert = form.querySelector('[data-form-alert]');
        if (alert && result && result.message) {
            alert.textContent = result.message;
            alert.hidden = false;
        }

        var first = keys.length ? form.querySelector('[data-error-for="' + keys[0] + '"]') : null;
        var field = first ? first.closest('[data-field]') : null;
        var focusable = field ? field.querySelector('input:not([type="hidden"]), select, [tabindex="0"]') : null;
        if (focusable) focusable.focus();
    }

    function clearErrors(form) {
        $$('.has-error', form).forEach(function (el) { el.classList.remove('has-error'); });
        $$('[data-error-for]', form).forEach(function (el) { el.textContent = ''; });
        var alert = form.querySelector('[data-form-alert]');
        if (alert) { alert.hidden = true; alert.textContent = ''; }
    }

    /* ---------------------------------------------------------
       6. Kırmızı kart: silme onayı
       --------------------------------------------------------- */
    var redCard = document.getElementById('tmRedCard');

    // options: { title, html, confirmLabel, action: () => Promise<result> }
    // Silme başarılıysa Promise true ile, vazgeçilirse false ile çözülür
    function confirmDelete(options) {
        return new Promise(function (resolve) {
            if (!redCard) { resolve(false); return; }

            var title = $('[data-redcard-title]', redCard);
            var text = $('[data-redcard-text]', redCard);
            var error = $('[data-redcard-error]', redCard);
            var confirmBtn = $('[data-redcard-confirm]', redCard);
            var label = $('[data-redcard-confirm-label]', redCard);

            title.textContent = options.title || 'Kaydı sil';
            text.innerHTML = options.html || '';
            label.textContent = options.confirmLabel || 'Sil';
            error.hidden = true;
            confirmBtn.hidden = false;
            setBusy(confirmBtn, false);

            // Silinemeyeceği baştan biliniyorsa (ör. maçı olan takım) sebebi hemen göster
            if (options.blocked) {
                error.textContent = options.blocked;
                error.hidden = false;
                confirmBtn.hidden = true;
            }

            var done = false;
            function finish(value) {
                if (done) return;
                done = true;
                confirmBtn.removeEventListener('click', onConfirm);
                redCard.removeEventListener('close', onClose);
                redCard.removeEventListener('click', onBackdrop);
                resolve(value);
            }
            function onClose() { finish(false); }
            function onBackdrop(e) { if (e.target === redCard) closeDialog(redCard); }
            function onConfirm() {
                setBusy(confirmBtn, true);
                Promise.resolve(options.action()).then(function (result) {
                    setBusy(confirmBtn, false);
                    if (result && result.ok) {
                        finish(true);
                        closeDialog(redCard);
                        toast(result.message || 'Silindi.', 'success');
                        return;
                    }
                    // Örn. maçı olan takım: API 409 döndürür, kart sallanır ve sebep yazılır
                    error.textContent = (result && result.message) || 'Silme işlemi başarısız oldu.';
                    error.hidden = false;
                    if (result && result.statusCode === 409) confirmBtn.hidden = true;
                    redCard.classList.remove('is-shake');
                    void redCard.offsetWidth;
                    redCard.classList.add('is-shake');
                });
            }

            confirmBtn.addEventListener('click', onConfirm);
            redCard.addEventListener('close', onClose);
            redCard.addEventListener('click', onBackdrop);
            redCard.classList.remove('is-shake');
            openDialog(redCard);
            $('[data-redcard-cancel]', redCard).focus();
        });
    }

    if (redCard) {
        redCard.addEventListener('close', function () {
            var el = lastFocus.get(redCard);
            if (el && typeof el.focus === 'function' && document.contains(el)) el.focus();
        });
    }

    /* ---------------------------------------------------------
       7. Veri önbelleği + menü rozetleri
       --------------------------------------------------------- */
    var data = null;
    var dataPromise = null;
    var listeners = [];

    function setData(next) {
        if (!next) return;
        data = { teams: next.teams || [], matches: next.matches || [] };
        updateBadges();
        listeners.forEach(function (fn) { fn(data); });
    }

    function loadData(force) {
        if (data && !force) return Promise.resolve(data);
        if (dataPromise && !force) return dataPromise;
        dataPromise = fetch('/Admin/Data', { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
                dataPromise = null;
                if (d) setData(d);
                return data;
            })
            .catch(function () { dataPromise = null; return data; });
        return dataPromise;
    }

    function onData(fn) { listeners.push(fn); }

    function updateBadges() {
        if (!data) return;
        var live = data.matches.filter(function (m) { return m.status === 'Oynaniyor'; }).length;
        var liveBadge = $('[data-nav-live]');
        if (liveBadge) {
            liveBadge.hidden = live === 0;
            liveBadge.textContent = live;
            liveBadge.title = live + ' canlı maç';
        }
        var overdue = data.matches.filter(function (m) { return isOverdue(m); }).length;
        var overdueBadge = $('[data-nav-overdue]');
        if (overdueBadge) {
            overdueBadge.hidden = overdue === 0;
            overdueBadge.textContent = overdue;
            overdueBadge.title = overdue + ' maçın sonucu bekleniyor';
        }
        var teamBadge = $('[data-nav-teams]');
        if (teamBadge) {
            teamBadge.hidden = false;
            teamBadge.textContent = data.teams.length;
        }
    }

    /* ---------------------------------------------------------
       8. Hızlı arama (Ctrl+K)
       --------------------------------------------------------- */
    var cmdk = document.getElementById('tmCmdk');
    var cmdkInput = cmdk ? $('[data-cmdk-input]', cmdk) : null;
    var cmdkList = cmdk ? $('[data-cmdk-list]', cmdk) : null;
    var cmdkItems = [];
    var cmdkActive = 0;

    var PAGES = [
        { group: 'Sayfalar', icon: 'tm-i-board', title: 'Kontrol paneli', meta: 'Haftanın özeti, grafikler, kontrol listesi', url: '/Admin' },
        { group: 'Sayfalar', icon: 'tm-i-live', title: 'Canlı masa', meta: 'Canlı maçların skorunu anında güncelle', url: '/Admin/Live', keywords: 'canli skor gol yayin' },
        { group: 'Sayfalar', icon: 'tm-i-ball', title: 'Maçlar', meta: 'Fikstür, skorlar ve durumlar', url: '/Admin/Matches' },
        { group: 'Sayfalar', icon: 'tm-i-shield', title: 'Takımlar', meta: 'Kulüp bilgileri ve logolar', url: '/Admin/Teams' },
        { group: 'Sayfalar', icon: 'tm-i-trophy', title: 'Puan durumu', meta: 'Tablo, form, puan yarışı ve senaryo', url: '/Admin/Standings', keywords: 'puan tablo siralama senaryo' },
        { group: 'Sayfalar', icon: 'tm-i-calendar', title: 'Fikstür takvimi', meta: 'Aylık takvimde bütün maçlar', url: '/Admin/Calendar', keywords: 'takvim ay gun fikstur' },
        { group: 'Sayfalar', icon: 'tm-i-chart', title: 'İstatistikler', meta: 'Goller, rekorlar, takım karşılaştırma', url: '/Admin/Stats', keywords: 'istatistik gol rekor karsilastir' },
        { group: 'İşlemler', icon: 'tm-i-plus', title: 'Yeni maç ekle', meta: 'Maç formunu açar', url: '/Admin/Matches?new=1', keywords: 'mac ekle olustur' },
        { group: 'İşlemler', icon: 'tm-i-plus', title: 'Yeni takım ekle', meta: 'Takım formunu açar', url: '/Admin/Teams?new=1', keywords: 'takim ekle olustur kulup' },
        { group: 'İşlemler', icon: 'tm-i-alert', title: 'Sonuç bekleyen maçlar', meta: 'Saati geçmiş ama skoru girilmemiş maçlar', url: '/Admin/Matches?overdue=1', keywords: 'sonuc bekleyen gecmis' },
        { group: 'Sitede gör', icon: 'tm-i-home', title: 'Ana sayfa', meta: 'Sitede açılır', url: '/', external: true },
        { group: 'Sitede gör', icon: 'tm-i-trophy', title: 'Puan durumu (site)', meta: 'Sitede açılır', url: '/Standings', external: true },
        { group: 'Sitede gör', icon: 'tm-i-calendar', title: 'Fikstür (site)', meta: 'Sitede açılır', url: '/Fixtures', external: true }
    ];

    function highlight(text, query) {
        if (!query) return esc(text);
        var n = norm(text);
        var i = n.indexOf(query);
        if (i < 0) return esc(text);
        return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + query.length)) + '</mark>' + esc(text.slice(i + query.length));
    }

    function buildCmdkItems(query) {
        var q = norm(query);
        var items = [];

        PAGES.forEach(function (p) {
            if (!q || norm(p.title + ' ' + (p.keywords || '') + ' ' + p.meta).indexOf(q) >= 0) items.push(p);
        });

        if (data) {
            var teams = data.teams
                .filter(function (t) { return q && norm(t.name + ' ' + t.city + ' ' + t.stadium).indexOf(q) >= 0; })
                .sort(function (a, b) { return norm(a.name).indexOf(q) - norm(b.name).indexOf(q) || a.name.localeCompare(b.name, trLocale); })
                .slice(0, 6)
                .map(function (t) {
                    return { group: 'Takımlar', crest: crest(t.name, t.logoUrl, 'sm'), title: t.name, meta: t.city + ', ' + t.stadium, url: '/Admin/Teams?edit=' + t.id };
                });

            var matches = data.matches
                .filter(function (m) {
                    if (!q) return m.status === 'Oynaniyor';
                    var hay = norm(m.homeTeamName + ' ' + m.awayTeamName + ' ' + m.week + '. hafta ' + statusLabel(m.status));
                    return q.split(/\s+/).every(function (part) { return hay.indexOf(part) >= 0; });
                })
                .slice(0, 8)
                .map(function (m) {
                    var d = toDate(m.matchDate);
                    var score = hasScore(m.status) ? ' ' + (m.homeScore != null ? m.homeScore : 0) + '-' + (m.awayScore != null ? m.awayScore : 0) : '';
                    return {
                        group: q ? 'Maçlar' : 'Şu an canlı',
                        icon: 'tm-i-ball',
                        title: m.homeTeamName + ' - ' + m.awayTeamName + score,
                        meta: m.week + '. hafta, ' + fmtShort.format(d) + ' ' + fmtTime.format(d) + ', ' + statusLabel(m.status),
                        url: '/Admin/Matches?edit=' + m.id
                    };
                });

            items = items.concat(matches, teams);
        }
        return items;
    }

    function renderCmdk() {
        var q = norm(cmdkInput.value);
        cmdkItems = buildCmdkItems(cmdkInput.value);
        cmdkActive = 0;

        if (!cmdkItems.length) {
            cmdkList.innerHTML = '<p class="tm-cmdk__empty">"' + esc(cmdkInput.value) + '" için sonuç yok.</p>';
            return;
        }

        var html = '';
        var lastGroup = null;
        cmdkItems.forEach(function (item, i) {
            if (item.group !== lastGroup) {
                html += '<p class="tm-cmdk__group" role="presentation">' + esc(item.group) + '</p>';
                lastGroup = item.group;
            }
            var visual = item.crest || '<svg class="tm-icon" aria-hidden="true"><use href="#' + item.icon + '"/></svg>';
            html += '<a class="tm-cmdk__item" role="option" id="tmCmdkOpt' + i + '" data-index="' + i + '" href="' + esc(item.url) + '"' +
                (item.external ? ' target="_blank" rel="noopener"' : '') + '>' +
                visual +
                '<span class="tm-cmdk__text"><strong>' + highlight(item.title, q) + '</strong><span>' + esc(item.meta) + '</span></span>' +
                '<svg class="tm-icon tm-cmdk__enter" aria-hidden="true"><use href="#tm-i-enter"/></svg></a>';
        });
        cmdkList.innerHTML = html;
        setCmdkActive(0);
    }

    function setCmdkActive(index) {
        var links = $$('.tm-cmdk__item', cmdkList);
        if (!links.length) return;
        cmdkActive = (index + links.length) % links.length;
        links.forEach(function (a, i) {
            var on = i === cmdkActive;
            a.classList.toggle('is-active', on);
            a.setAttribute('aria-selected', String(on));
        });
        var active = links[cmdkActive];
        cmdkInput.setAttribute('aria-activedescendant', active.id);
        active.scrollIntoView({ block: 'nearest' });
    }

    function openCmdk() {
        if (!cmdk) return;
        cmdkInput.value = '';
        renderCmdk();
        openDialog(cmdk);
        cmdkInput.focus();
        loadData().then(function () { if (cmdk.open) renderCmdk(); });
    }

    if (cmdk) {
        cmdkInput.addEventListener('input', renderCmdk);
        cmdkInput.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setCmdkActive(cmdkActive + 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setCmdkActive(cmdkActive - 1); }
            else if (e.key === 'Enter') {
                e.preventDefault();
                var link = $$('.tm-cmdk__item', cmdkList)[cmdkActive];
                if (link) link.click();
            }
        });
        cmdkList.addEventListener('mousemove', function (e) {
            var a = e.target.closest('.tm-cmdk__item');
            if (a) {
                var i = parseInt(a.getAttribute('data-index'), 10);
                if (i !== cmdkActive) setCmdkActive(i);
            }
        });
        cmdkList.addEventListener('click', function (e) {
            var a = e.target.closest('.tm-cmdk__item');
            if (!a || a.target === '_blank') { closeDialog(cmdk); return; }
            e.preventDefault();
            closeDialog(cmdk);
            go(a.getAttribute('href'));
        });
        cmdk.addEventListener('click', function (e) { if (e.target === cmdk) closeDialog(cmdk); });
        cmdk.addEventListener('close', function () {
            var el = lastFocus.get(cmdk);
            if (el && typeof el.focus === 'function' && document.contains(el)) el.focus();
        });
    }

    $$('[data-cmdk-open]').forEach(function (btn) { btn.addEventListener('click', openCmdk); });

    document.addEventListener('keydown', function (e) {
        var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable);
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault();
            if (cmdk && cmdk.open) closeDialog(cmdk); else openCmdk();
        } else if (e.key === '/' && !typing && !document.querySelector('dialog[open]')) {
            e.preventDefault();
            openCmdk();
        }
    });

    /* ---------------------------------------------------------
       9. Yan menü (mobil)
       --------------------------------------------------------- */
    var sideToggle = $('[data-side-toggle]');
    function setSide(open) {
        document.body.classList.toggle('tm-side-open', open);
        if (sideToggle) sideToggle.setAttribute('aria-expanded', String(open));
    }
    if (sideToggle) sideToggle.addEventListener('click', function () { setSide(!document.body.classList.contains('tm-side-open')); });
    $$('[data-side-close]').forEach(function (el) { el.addEventListener('click', function () { setSide(false); }); });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && document.body.classList.contains('tm-side-open')) setSide(false);
    });

    /* ---------------------------------------------------------
       10. Sayfa içi yönlendirme
       Aynı sayfadaysak (ör. Takımlar'da bir takımı aramak) sayfa yenilenmez,
       sayfanın kayıtlı route fonksiyonu ?edit=... parametresini işler.
       --------------------------------------------------------- */
    var routeHandler = null;

    function onRoute(fn) { routeHandler = fn; }

    function go(url) {
        var target = new URL(url, window.location.origin);
        var samePage = target.pathname.toLowerCase() === window.location.pathname.toLowerCase();
        if (samePage && routeHandler) {
            window.history.replaceState(null, '', target.pathname + target.search);
            routeHandler(target.searchParams);
        } else {
            window.location.href = target.pathname + target.search;
        }
    }


    /* ---------------------------------------------------------
       11. Genel onay penceresi
       options: { title, html, confirmLabel, tone: 'primary'|'danger'|'success', action: () => Promise<result> }
       --------------------------------------------------------- */
    var confirmDlg = document.getElementById('tmConfirm');

    function confirmBox(options) {
        return new Promise(function (resolve) {
            if (!confirmDlg) { resolve(false); return; }
            var ok = $('[data-confirm-ok]', confirmDlg);
            var error = $('[data-confirm-error]', confirmDlg);
            $('[data-confirm-title]', confirmDlg).textContent = options.title || 'Emin misin?';
            $('[data-confirm-text]', confirmDlg).innerHTML = options.html || '';
            $('[data-confirm-label]', confirmDlg).textContent = options.confirmLabel || 'Onayla';
            ok.className = 'tm-btn tm-btn--' + (options.tone || 'primary');
            confirmDlg.setAttribute('data-tone', options.tone || 'primary');
            error.hidden = true;
            setBusy(ok, false);

            var done = false;
            function finish(v) {
                if (done) return;
                done = true;
                ok.removeEventListener('click', onOk);
                confirmDlg.removeEventListener('close', onClose);
                confirmDlg.removeEventListener('click', onBackdrop);
                resolve(v);
            }
            function onClose() { finish(false); }
            function onBackdrop(e) { if (e.target === confirmDlg) closeDialog(confirmDlg); }
            function onOk() {
                if (!options.action) { finish(true); closeDialog(confirmDlg); return; }
                setBusy(ok, true);
                Promise.resolve(options.action()).then(function (result) {
                    setBusy(ok, false);
                    if (result && result.ok) {
                        finish(result);
                        closeDialog(confirmDlg);
                        return;
                    }
                    error.textContent = (result && result.message) || 'İşlem tamamlanamadı.';
                    error.hidden = false;
                });
            }
            ok.addEventListener('click', onOk);
            confirmDlg.addEventListener('close', onClose);
            confirmDlg.addEventListener('click', onBackdrop);
            openDialog(confirmDlg);
            ok.focus();
        });
    }

    if (confirmDlg) {
        confirmDlg.addEventListener('close', function () {
            var el = lastFocus.get(confirmDlg);
            if (el && typeof el.focus === 'function' && document.contains(el)) el.focus();
        });
    }

    /* ---------------------------------------------------------
       12. Maçı tek alanla güncelle (canlı masa, toplu sonuç girişi)
       API maçın bütün alanlarını istediği için mevcut kayıt + değişiklik gönderilir
       --------------------------------------------------------- */
    function saveMatch(match, patch) {
        var m = Object.assign({}, match, patch || {});
        var scored = hasScore(m.status);
        return api('/Admin/SaveMatch', {
            method: 'POST',
            body: {
                id: m.id,
                homeTeamId: m.homeTeamId,
                awayTeamId: m.awayTeamId,
                week: m.week,
                matchDate: String(m.matchDate).slice(0, 19),
                homeScore: scored ? (m.homeScore == null ? 0 : m.homeScore) : null,
                awayScore: scored ? (m.awayScore == null ? 0 : m.awayScore) : null,
                status: m.status,
                stadium: m.stadium || null
            }
        });
    }

    /* ---------------------------------------------------------
       13. Otomatik yenileme (sekme görünürken)
       --------------------------------------------------------- */
    var pollTimer = null;
    function startPolling(ms) {
        if (pollTimer) return;
        pollTimer = window.setInterval(function () {
            if (document.visibilityState === 'visible') loadData(true);
        }, ms || 30000);
    }

    /* ---------------------------------------------------------
       14. Sayfa geçişinde üstte ince ilerleme çizgisi
       --------------------------------------------------------- */
    var progress = $('[data-progress]');
    document.addEventListener('click', function (e) {
        if (!progress || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
        var a = e.target.closest && e.target.closest('a[href]');
        if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
        var href = a.getAttribute('href');
        if (!href || href.charAt(0) === '#') return;
        var url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
        progress.classList.remove('is-done');
        progress.classList.add('is-loading');
    });
    window.addEventListener('pageshow', function () {
        if (progress) { progress.classList.remove('is-loading'); }
    });

    function plural(n, word) { return n + ' ' + word; }

    /* ---------------------------------------------------------
       15. Canlı yayın (SignalR) — bir maç değişince anında yenile
       --------------------------------------------------------- */
    function startLiveHub() {
        if (typeof signalR === 'undefined') return;
        var connection = new signalR.HubConnectionBuilder()
            .withUrl('/hubs/match')
            .withAutomaticReconnect()
            .build();
        connection.on('MatchUpdated', function () { loadData(true); });
        connection.start().catch(function (err) {
            console.error('Canlı yayına bağlanılamadı, otomatik yenilemeyle devam ediliyor:', err);
        });
    }

    /* Başlat */
    initLeds(document);
    var seed = readSeed();
    if (seed) setData(seed); else loadData();
    startLiveHub();

    window.TM = {
        $: $, $$: $$, esc: esc, norm: norm, teamCode: teamCode, hue: hue, crest: crest,
        statusLabel: statusLabel, hasScore: hasScore, toDate: toDate, isOverdue: isOverdue,
        fmtDay: fmtDay, fmtLong: fmtLong, fmtTime: fmtTime, fmtShort: fmtShort,
        dateInputValue: dateInputValue, timeInputValue: timeInputValue, pad: pad,
        params: params, setParams: setParams, readSeed: readSeed,
        led: led, initLeds: initLeds, api: api, toast: toast,
        openDialog: openDialog, closeDialog: closeDialog, setBusy: setBusy,
        showErrors: showErrors, clearErrors: clearErrors, confirmDelete: confirmDelete,
        getData: function () { return data; }, setData: setData, loadData: loadData, onData: onData,
        onRoute: onRoute, go: go, reduceMotion: reduceMotion,
        confirm: confirmBox, saveMatch: saveMatch, startPolling: startPolling, plural: plural
    };
})();
