/* =================================================================
   Teknik Masa — maç yönetimi (admin-matches.js)
   1 Durum + yardımcılar     5 Form: durum seçici + skorbord
   2 Hafta şeridi            6 Form: doldur, doğrula, kaydet
   3 Maç tablosu             7 Silme
   4 Filtre olayları         8 Adres parametreleri
   ================================================================= */
(function () {
    'use strict';

    var TM = window.TM;
    if (!TM) return;

    var $ = TM.$, $$ = TM.$$, esc = TM.esc;
    var SEASON_WEEKS = 38;

    /* ---------------------------------------------------------
       1. Durum + yardımcılar
       --------------------------------------------------------- */
    var seed = TM.readSeed() || { teams: [], matches: [] };
    var matches = seed.matches || [];
    var teams = seed.teams || [];
    var state = { week: null, q: '', status: '', overdue: false };
    var savedId = null;

    var els = {
        rail: $('[data-week-rail]'),
        rows: $('[data-match-rows]'),
        empty: $('[data-match-empty]'),
        emptyTitle: $('[data-match-empty-title]'),
        emptyText: $('[data-match-empty-text]'),
        emptyAction: $('[data-match-empty-action]'),
        count: $('[data-match-count]'),
        search: $('[data-match-search]'),
        status: $('[data-match-status]'),
        overdue: $('[data-match-overdue]'),
        overdueLabel: $('[data-overdue-label]'),
        modal: document.getElementById('tmMatchModal'),
        form: $('[data-match-form]')
    };

    function perWeek() { return Math.max(1, Math.floor(teams.length / 2)); }

    function teamById(id) {
        id = Number(id);
        return teams.filter(function (t) { return t.id === id; })[0] || null;
    }

    function matchById(id) {
        id = Number(id);
        return matches.filter(function (m) { return m.id === id; })[0] || null;
    }

    function byKickoff(a, b) {
        return (a.week - b.week) || (TM.toDate(a.matchDate) - TM.toDate(b.matchDate)) || (a.id - b.id);
    }

    // İçinde oynanmamış ya da canlı maç olan ilk hafta
    function currentWeek() {
        var open = matches.filter(function (m) { return m.status === 'Planlandi' || m.status === 'Oynaniyor'; })
            .map(function (m) { return m.week; });
        if (open.length) return Math.min.apply(null, open);
        var all = matches.map(function (m) { return m.week; });
        return all.length ? Math.max.apply(null, all) : 1;
    }

    function weekStats(week) {
        var s = { total: 0, Tamamlandi: 0, Oynaniyor: 0, Planlandi: 0, Ertelendi: 0 };
        matches.forEach(function (m) {
            if (m.week !== week) return;
            s.total++;
            s[m.status] = (s[m.status] || 0) + 1;
        });
        return s;
    }

    function fillBar(s, total) {
        return '<span class="tm-rail__fill" aria-hidden="true">' +
            '<span class="tm-k-done" style="--n:' + s.Tamamlandi + ';--t:' + total + '"></span>' +
            '<span class="tm-k-live" style="--n:' + s.Oynaniyor + ';--t:' + total + '"></span>' +
            '<span class="tm-k-plan" style="--n:' + s.Planlandi + ';--t:' + total + '"></span>' +
            '<span class="tm-k-post" style="--n:' + s.Ertelendi + ';--t:' + total + '"></span>' +
            '</span>';
    }

    /* ---------------------------------------------------------
       2. Hafta şeridi (38 hafta)
       --------------------------------------------------------- */
    function renderRail() {
        var maxWeek = Math.max(SEASON_WEEKS, Math.max.apply(null, matches.map(function (m) { return m.week; }).concat([1])));
        var cur = currentWeek();
        var all = { total: matches.length, Tamamlandi: 0, Oynaniyor: 0, Planlandi: 0, Ertelendi: 0 };
        matches.forEach(function (m) { all[m.status] = (all[m.status] || 0) + 1; });

        var html = '<button type="button" class="tm-rail__btn tm-rail__btn--all" data-rail-week="" aria-pressed="' + (state.week === null) + '">' +
            '<strong>Tümü</strong>' + fillBar(all, Math.max(1, all.total)) + '</button>';

        for (var w = 1; w <= maxWeek; w++) {
            var s = weekStats(w);
            var label = w + '. hafta: ' + s.total + ' maç' + (s.total ? ', ' + s.Tamamlandi + ' bitti' : '');
            html += '<button type="button" class="tm-rail__btn' + (s.total === 0 ? ' is-empty' : '') + (w === cur ? ' is-current' : '') + '"' +
                ' data-rail-week="' + w + '" aria-pressed="' + (state.week === w) + '" title="' + label + '" aria-label="' + label + '">' +
                '<strong>' + w + '</strong>' + fillBar(s, Math.max(perWeek(), s.total)) + '</button>';
        }
        els.rail.innerHTML = html;
    }

    function scrollRailToSelection(smooth) {
        var btn = els.rail.querySelector('[aria-pressed="true"]') || els.rail.querySelector('.is-current');
        if (!btn) return;
        var left = btn.offsetLeft - els.rail.clientWidth / 2 + btn.offsetWidth / 2;
        els.rail.scrollTo({ left: Math.max(0, left), behavior: smooth && !TM.reduceMotion ? 'smooth' : 'auto' });
    }

    els.rail.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-rail-week]');
        if (!btn) return;
        var w = btn.getAttribute('data-rail-week');
        state.week = w ? Number(w) : null;
        TM.setParams({ week: state.week });
        render();
        scrollRailToSelection(true);
    });

    /* ---------------------------------------------------------
       3. Maç tablosu
       --------------------------------------------------------- */
    function filtered() {
        var q = TM.norm(state.q);
        var now = Date.now();
        return matches.filter(function (m) {
            if (state.week !== null && m.week !== state.week) return false;
            if (state.status && m.status !== state.status) return false;
            if (state.overdue && !TM.isOverdue(m, now)) return false;
            if (q) {
                var hay = TM.norm(m.homeTeamName + ' ' + m.awayTeamName + ' ' + m.stadium);
                if (!q.split(/\s+/).every(function (part) { return hay.indexOf(part) >= 0; })) return false;
            }
            return true;
        }).sort(byKickoff);
    }

    function scoreCell(m) {
        if (TM.hasScore(m.status) && m.homeScore != null && m.awayScore != null) {
            return '<span class="tm-score' + (m.status === 'Oynaniyor' ? ' tm-score--live' : '') + '">' +
                m.homeScore + '<i aria-hidden="true"></i>' + m.awayScore + '</span>';
        }
        return '<span class="tm-score tm-score--empty" aria-label="Skor yok">-<i aria-hidden="true"></i>-</span>';
    }

    function statusCell(m, now) {
        var html = '<span class="tm-pill tm-pill--' + m.status + '">' + TM.statusLabel(m.status) + '</span>';
        if (TM.isOverdue(m, now)) {
            html = '<span class="tm-pill tm-pill--overdue" title="Maç saati geçti, durumu güncellenmedi">' +
                (m.status === 'Planlandi' ? 'Sonuç bekleniyor' : 'Hâlâ canlı') + '</span>';
        }
        return html;
    }

    function groupRow(week, list) {
        var s = weekStats(week);
        var need = perWeek();
        var meta = s.total + '/' + need + ' maç';
        if (s.Tamamlandi) meta += ', ' + s.Tamamlandi + ' bitti';
        if (s.Oynaniyor) meta += ', ' + s.Oynaniyor + ' canlı';
        if (list.length !== s.total) meta += ', ' + list.length + ' tanesi filtrede';
        var add = s.total < need
            ? '<button type="button" class="tm-group__add" data-add-week="' + week + '"><svg class="tm-icon" aria-hidden="true"><use href="#tm-i-plus"/></svg>Bu haftaya maç ekle</button>'
            : '';
        return '<tr class="tm-group"><td colspan="8"><div class="tm-group__inner">' +
            '<span class="tm-group__title">' + week + '. hafta</span>' +
            '<span class="tm-group__meta">' + meta + '</span>' + add + '</div></td></tr>';
    }

    function row(m, now) {
        var d = TM.toDate(m.matchDate);
        var cls = [];
        if (m.id === savedId) cls.push('is-saved');
        if (m.status === 'Ertelendi') cls.push('is-postponed');
        var title = m.homeTeamName + ' - ' + m.awayTeamName;
        return '<tr data-id="' + m.id + '"' + (cls.length ? ' class="' + cls.join(' ') + '"' : '') + '>' +
            '<td class="tm-col-id">' + m.id + '</td>' +
            '<td><span class="tm-when"><strong>' + esc(TM.fmtDay.format(d)) + '</strong><span>' + esc(TM.fmtTime.format(d)) + '</span></span></td>' +
            '<td class="tm-col-home"><span class="tm-teamcell">' + TM.crest(m.homeTeamName, m.homeTeamLogo, 'sm') + esc(m.homeTeamName) + '</span></td>' +
            '<td class="tm-col-score">' + scoreCell(m) + '</td>' +
            '<td><span class="tm-teamcell">' + TM.crest(m.awayTeamName, m.awayTeamLogo, 'sm') + esc(m.awayTeamName) + '</span></td>' +
            '<td class="tm-col-stadium" title="' + esc(m.stadium) + '">' + esc(m.stadium) + '</td>' +
            '<td>' + statusCell(m, now) + '</td>' +
            '<td class="tm-col-actions"><div class="tm-rowactions">' +
            '<a class="tm-iconbtn" href="/Match/Detail/' + m.id + '" target="_blank" rel="noopener" title="Maç sayfasını aç" aria-label="' + esc(title) + ' maç sayfasını aç"><svg class="tm-icon" aria-hidden="true"><use href="#tm-i-eye"/></svg></a>' +
            '<button type="button" class="tm-iconbtn" data-edit="' + m.id + '" title="Düzenle" aria-label="' + esc(title) + ' maçını düzenle"><svg class="tm-icon" aria-hidden="true"><use href="#tm-i-edit"/></svg></button>' +
            '<button type="button" class="tm-iconbtn tm-iconbtn--danger" data-delete="' + m.id + '" title="Sil" aria-label="' + esc(title) + ' maçını sil"><svg class="tm-icon" aria-hidden="true"><use href="#tm-i-trash"/></svg></button>' +
            '</div></td></tr>';
    }

    function render() {
        var now = Date.now();
        var list = filtered();

        // Haftalara göre grupla
        var html = '';
        var lastWeek = null;
        list.forEach(function (m) {
            if (m.week !== lastWeek) {
                html += groupRow(m.week, list.filter(function (x) { return x.week === m.week; }));
                lastWeek = m.week;
            }
            html += row(m, now);
        });
        els.rows.innerHTML = html;

        // Boş durum: seçili haftada hiç maç yoksa doğrudan maç eklemeye çağır
        var hasFilters = state.q || state.status || state.overdue;
        els.empty.hidden = list.length > 0;
        if (!list.length) {
            if (state.week !== null && !hasFilters) {
                els.emptyTitle.textContent = state.week + '. haftada henüz maç yok';
                els.emptyText.textContent = 'Bu hafta için ' + perWeek() + ' maç eklenmesi gerekiyor.';
                els.emptyAction.textContent = 'Bu haftaya maç ekle';
                els.emptyAction.setAttribute('data-empty-mode', 'add');
            } else {
                els.emptyTitle.textContent = 'Bu filtreyle eşleşen maç yok';
                els.emptyText.textContent = 'Aramayı temizle ya da başka bir hafta seç.';
                els.emptyAction.textContent = 'Filtreleri temizle';
                els.emptyAction.setAttribute('data-empty-mode', 'reset');
            }
        }

        var label = state.week !== null ? state.week + '. haftada ' : '';
        els.count.textContent = label + list.length + ' maç gösteriliyor, sezonda toplam ' + matches.length + ' maç var';

        // Sonuç bekleyen maç düğmesi
        var overdueCount = matches.filter(function (m) { return TM.isOverdue(m, now); }).length;
        els.overdue.hidden = overdueCount === 0 && !state.overdue;
        els.overdue.setAttribute('aria-pressed', String(state.overdue));
        els.overdueLabel.textContent = overdueCount + ' maç güncelleme bekliyor';

        renderRail();
        savedId = null;
    }

    /* ---------------------------------------------------------
       4. Filtre olayları
       --------------------------------------------------------- */
    els.search.addEventListener('input', function () { state.q = els.search.value; render(); });
    els.status.addEventListener('change', function () {
        state.status = els.status.value;
        TM.setParams({ status: state.status });
        render();
    });
    els.overdue.addEventListener('click', function () { state.overdue = !state.overdue; render(); });
    els.emptyAction.addEventListener('click', function () {
        if (els.emptyAction.getAttribute('data-empty-mode') === 'add') {
            openForm(null, state.week);
            return;
        }
        state.q = ''; state.status = ''; state.overdue = false;
        els.search.value = ''; els.status.value = '';
        TM.setParams({ status: null });
        render();
    });

    els.rows.addEventListener('click', function (e) {
        var add = e.target.closest('[data-add-week]');
        var edit = e.target.closest('[data-edit]');
        var del = e.target.closest('[data-delete]');
        if (add) { openForm(null, Number(add.getAttribute('data-add-week'))); return; }
        if (edit) { openForm(matchById(edit.getAttribute('data-edit'))); return; }
        if (del) { removeMatch(matchById(del.getAttribute('data-delete'))); return; }
        if (e.target.closest('a, button')) return;
        // Satırın boş bir yerine tıklamak da düzenleme açar
        var tr = e.target.closest('tr[data-id]');
        if (tr) openForm(matchById(tr.getAttribute('data-id')));
    });

    function reload(highlightId) {
        return TM.loadData(true).then(function (d) {
            if (d) { matches = d.matches; teams = d.teams; }
            savedId = highlightId || null;
            fillTeamSelects();
            render();
        });
    }

    /* ---------------------------------------------------------
       5. Form: durum seçici + skorbord
       --------------------------------------------------------- */
    var f = els.form.elements;
    var board = $('[data-scoreboard]', els.form);
    var crests = { home: $('[data-crest="home"]', els.form), away: $('[data-crest="away"]', els.form) };
    var conflictHint = $('[data-week-conflict]', els.form);
    var detailLink = $('[data-match-detail-link]', els.form);
    var editing = null;
    var stadiumTouched = false;

    function status() {
        var checked = els.form.querySelector('input[name="status"]:checked');
        return checked ? checked.value : 'Planlandi';
    }

    // Tek bir skor göstergesi: ▲, LED tabela, ▼
    function Stepper(root) {
        this.root = root;
        this.input = $('[data-stepper-input]', root);
        this.output = $('[data-stepper-output]', root);
        this.boardEl = $('[data-stepper-board]', root);
        this.ledEl = $('[data-stepper-led]', root);
        this.buttons = $$('[data-step]', root);
        this.value = null;
        this.enabled = false;
        this.len = 0;
        this.ledBoard = null;
        this.typed = '';
        this.typedAt = 0;

        var self = this;
        this.buttons.forEach(function (b) {
            b.addEventListener('click', function () { self.step(Number(b.getAttribute('data-step'))); });
        });
        this.boardEl.addEventListener('keydown', function (e) {
            if (!self.enabled) return;
            if (e.key === 'ArrowUp' || e.key === '+') { e.preventDefault(); self.step(1); }
            else if (e.key === 'ArrowDown' || e.key === '-') { e.preventDefault(); self.step(-1); }
            else if (/^[0-9]$/.test(e.key)) {
                e.preventDefault();
                // Hızlı yazılan iki rakam iki basamaklı skor olur (ör. 1 sonra 0 = 10)
                var now = Date.now();
                self.typed = (now - self.typedAt < 700 && self.typed.length === 1) ? self.typed + e.key : e.key;
                self.typedAt = now;
                self.set(Number(self.typed), true);
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                self.set(0, true);
            }
        });
    }

    Stepper.prototype.draw = function (animate) {
        var text = this.enabled && this.value !== null ? String(this.value) : '';
        var len = Math.max(1, text.length);
        if (len !== this.len || !this.ledBoard) {
            this.len = len;
            this.ledBoard = TM.led(this.ledEl, new Array(len + 1).join(' '), status() === 'Oynaniyor' ? 'green' : 'white', false);
        }
        if (!this.ledBoard) {
            this.ledEl.textContent = text || '-';
            return;
        }
        var tones = [];
        for (var i = 0; i < len; i++) tones.push(status() === 'Oynaniyor' ? 'green' : 'white');
        this.ledBoard.setTones(tones);
        this.ledBoard.setText(text || new Array(len + 1).join(' '), animate && !TM.reduceMotion ? { stagger: 140 } : null);
    };

    Stepper.prototype.set = function (value, animate) {
        if (value === null || value === undefined || value === '') {
            this.value = null;
        } else {
            this.value = Math.max(0, Math.min(99, Math.round(Number(value))));
        }
        this.input.value = this.value === null ? '' : String(this.value);
        this.output.textContent = this.value === null ? 'Skor yok' : String(this.value);
        this.buttons[1].disabled = !this.enabled || !this.value;
        this.buttons[0].disabled = !this.enabled || this.value >= 99;
        this.root.classList.remove('has-error');
        this.draw(animate);
        if (animate && !TM.reduceMotion) {
            this.boardEl.classList.remove('is-bump');
            void this.boardEl.offsetWidth;
            this.boardEl.classList.add('is-bump');
        }
    };

    Stepper.prototype.step = function (delta) {
        if (!this.enabled) return;
        this.set((this.value || 0) + delta, true);
    };

    Stepper.prototype.setEnabled = function (on) {
        this.enabled = on;
        this.boardEl.setAttribute('tabindex', on ? '0' : '-1');
        this.boardEl.setAttribute('aria-disabled', String(!on));
        if (on && this.value === null) this.value = 0;
        this.set(this.value, false);
    };

    var steppers = {
        home: new Stepper($('[data-stepper="home"]', els.form)),
        away: new Stepper($('[data-stepper="away"]', els.form))
    };

    function applyStatus(animate) {
        var s = status();
        var scored = TM.hasScore(s);
        board.classList.toggle('is-off', !scored);
        board.classList.toggle('is-live', s === 'Oynaniyor');
        steppers.home.setEnabled(scored);
        steppers.away.setEnabled(scored);
        if (animate && scored) { steppers.home.draw(true); steppers.away.draw(true); }
        $$('.tm-status .has-error', els.form).forEach(function (el) { el.classList.remove('has-error'); });
    }

    $$('input[name="status"]', els.form).forEach(function (r) {
        r.addEventListener('change', function () { applyStatus(true); });
    });

    function fillTeamSelects() {
        var sorted = teams.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'tr'); });
        var options = '<option value="">Takım seç</option>' + sorted.map(function (t) {
            return '<option value="' + t.id + '">' + esc(t.name) + '</option>';
        }).join('');
        ['homeTeamId', 'awayTeamId'].forEach(function (n) {
            var current = f[n].value;
            f[n].innerHTML = options;
            f[n].value = current;
        });
    }

    function drawCrest(side) {
        var t = teamById(f[side === 'home' ? 'homeTeamId' : 'awayTeamId'].value);
        crests[side].innerHTML = t ? TM.crest(t.name, t.logoUrl, 'lg') : '';
    }

    // Seçilen takımlardan biri bu hafta başka maçta mı? (API'deki kuralın aynısı)
    function weekConflicts() {
        var week = Number(f.week.value);
        var ids = [Number(f.homeTeamId.value), Number(f.awayTeamId.value)].filter(Boolean);
        if (!week || !ids.length) return [];
        var found = [];
        matches.forEach(function (m) {
            if (m.week !== week || (editing && m.id === editing.id)) return;
            var clash = ids.filter(function (id) { return m.homeTeamId === id || m.awayTeamId === id; });
            if (!clash.length) return;
            var names = clash.map(function (id) { var t = teamById(id); return t ? t.name : 'Takım'; });
            var text = clash.length === 2
                ? names[0] + ' ve ' + names[1] + ' bu hafta zaten ' + m.homeTeamName + ' - ' + m.awayTeamName + ' maçında karşılaşıyor.'
                : names[0] + ' bu hafta zaten ' + m.homeTeamName + ' - ' + m.awayTeamName + ' maçında oynuyor.';
            found.push({ teamIds: clash, text: text });
        });
        return found;
    }

    function updateConflictHint() {
        var c = weekConflicts();
        conflictHint.hidden = c.length === 0;
        conflictHint.textContent = c.map(function (x) { return x.text; }).join(' ');
    }

    f.homeTeamId.addEventListener('change', function () {
        drawCrest('home');
        var t = teamById(f.homeTeamId.value);
        if (t && !stadiumTouched) f.stadium.value = t.stadium || '';
        clearField('homeTeamId');
        updateConflictHint();
    });
    f.awayTeamId.addEventListener('change', function () {
        drawCrest('away');
        clearField('awayTeamId');
        updateConflictHint();
    });
    f.week.addEventListener('input', function () { clearField('week'); updateConflictHint(); });
    f.date.addEventListener('input', function () { clearField('matchDate'); });
    f.time.addEventListener('input', function () { clearField('matchDate'); });
    f.stadium.addEventListener('input', function () { stadiumTouched = f.stadium.value.trim() !== ''; });

    function clearField(name) {
        var el = els.form.querySelector('[data-error-for="' + name + '"]');
        var field = el ? el.closest('[data-field]') : null;
        if (field) field.classList.remove('has-error');
    }

    /* ---------------------------------------------------------
       6. Form: doldur, doğrula, kaydet
       --------------------------------------------------------- */
    function defaultDateForWeek(week) {
        var same = matches.filter(function (m) { return m.week === week; }).sort(byKickoff)[0];
        if (same) return TM.toDate(same.matchDate);
        // Haftanın maçı yoksa: önceki haftanın ilk maçından 7 gün sonrası, o da yoksa bugün 20:45
        var prev = matches.filter(function (m) { return m.week === week - 1; }).sort(byKickoff)[0];
        var d = prev ? new Date(TM.toDate(prev.matchDate).getTime() + 7 * 86400000) : new Date();
        if (!prev) { d.setHours(20, 45, 0, 0); }
        return d;
    }

    function openForm(match, week) {
        editing = match || null;
        TM.clearErrors(els.form);
        els.form.reset();
        fillTeamSelects();
        stadiumTouched = false;

        var w = editing ? editing.week : (week || state.week || currentWeek());
        var d = editing ? TM.toDate(editing.matchDate) : defaultDateForWeek(w);

        f.id.value = editing ? editing.id : '';
        f.homeTeamId.value = editing ? editing.homeTeamId : '';
        f.awayTeamId.value = editing ? editing.awayTeamId : '';
        f.week.value = w;
        f.date.value = TM.dateInputValue(d);
        f.time.value = TM.timeInputValue(d);
        f.stadium.value = editing ? (editing.stadium || '') : '';
        stadiumTouched = !!(editing && editing.stadium);

        var st = editing ? editing.status : 'Planlandi';
        var radio = els.form.querySelector('input[name="status"][value="' + st + '"]');
        if (radio) radio.checked = true;

        steppers.home.value = editing && editing.homeScore != null ? editing.homeScore : null;
        steppers.away.value = editing && editing.awayScore != null ? editing.awayScore : null;
        applyStatus(false);
        drawCrest('home');
        drawCrest('away');
        updateConflictHint();

        $('[data-match-modal-title]').textContent = editing ? editing.homeTeamName + ' - ' + editing.awayTeamName : 'Yeni maç';
        $('[data-match-modal-sub]').textContent = editing
            ? editing.week + '. hafta, maç no ' + editing.id + '. Skoru ya da durumu değiştirip kaydet.'
            : 'Takımları seç, tarihi gir, durumu belirle.';
        $('[data-submit-label]', els.form).textContent = editing ? 'Değişiklikleri kaydet' : 'Maçı ekle';
        detailLink.hidden = !editing;
        if (editing) detailLink.href = '/Match/Detail/' + editing.id;

        TM.setParams(editing ? { edit: editing.id, 'new': null } : { 'new': 1, edit: null });
        TM.openDialog(els.modal);
        (editing ? els.form.querySelector('input[name="status"]:checked') : f.homeTeamId).focus();
    }

    els.modal.addEventListener('close', function () { TM.setParams({ edit: null, 'new': null }); });

    function collect() {
        var s = status();
        var scored = TM.hasScore(s);
        return {
            id: editing ? editing.id : null,
            homeTeamId: Number(f.homeTeamId.value) || 0,
            awayTeamId: Number(f.awayTeamId.value) || 0,
            week: Number(f.week.value) || 0,
            matchDate: f.date.value && f.time.value ? f.date.value + 'T' + f.time.value + ':00' : null,
            homeScore: scored ? steppers.home.value : null,
            awayScore: scored ? steppers.away.value : null,
            status: s,
            stadium: f.stadium.value.trim() || null
        };
    }

    function validate(body) {
        var errors = {};
        if (!body.homeTeamId) errors.homeTeamId = 'Ev sahibi takımı seç.';
        if (!body.awayTeamId) errors.awayTeamId = 'Deplasman takımını seç.';
        else if (body.homeTeamId && body.homeTeamId === body.awayTeamId) errors.awayTeamId = 'Bir takım kendisiyle oynayamaz.';
        if (!body.week || body.week < 1 || body.week > 38) errors.week = 'Hafta 1 ile 38 arasında olmalı.';
        if (!body.matchDate) errors.matchDate = 'Tarihi ve saati gir.';
        if (TM.hasScore(body.status)) {
            if (body.homeScore === null) errors.homeScore = 'Ev sahibi skorunu gir.';
            if (body.awayScore === null) errors.awayScore = 'Deplasman skorunu gir.';
        }
        weekConflicts().forEach(function (c) {
            c.teamIds.forEach(function (id) {
                var key = id === body.homeTeamId ? 'homeTeamId' : 'awayTeamId';
                if (!errors[key]) errors[key] = 'Bu takımın bu hafta başka maçı var.';
            });
        });
        return errors;
    }

    els.form.addEventListener('submit', function (e) {
        e.preventDefault();
        var body = collect();
        var errors = validate(body);
        if (Object.keys(errors).length) {
            TM.showErrors(els.form, { errors: errors, message: 'İşaretli alanları kontrol et.' });
            return;
        }

        var submit = $('[data-submit]', els.form);
        TM.setBusy(submit, true);
        TM.api('/Admin/SaveMatch', { method: 'POST', body: body }).then(function (result) {
            TM.setBusy(submit, false);
            if (!result.ok) {
                TM.showErrors(els.form, result);
                return;
            }
            var id = result.id || body.id;
            TM.closeDialog(els.modal);
            TM.toast(result.message || 'Kaydedildi.', 'success');
            reload(id).then(function () {
                var tr = els.rows.querySelector('tr[data-id="' + id + '"]');
                if (tr) tr.scrollIntoView({ block: 'center', behavior: TM.reduceMotion ? 'auto' : 'smooth' });
                else TM.toast('Kayıt, seçili filtreler yüzünden listede görünmüyor.', 'info');
            });
        });
    });

    $$('[data-match-new]').forEach(function (b) { b.addEventListener('click', function () { openForm(null, state.week); }); });

    /* ---------------------------------------------------------
       7. Silme (kırmızı kart)
       --------------------------------------------------------- */
    function removeMatch(m) {
        if (!m) return;
        var d = TM.toDate(m.matchDate);
        TM.confirmDelete({
            title: 'Maçı sil',
            html: '<strong>' + esc(m.homeTeamName) + ' - ' + esc(m.awayTeamName) + '</strong> (' + m.week + '. hafta, ' +
                esc(TM.fmtLong.format(d)) + ') fikstürden kalıcı olarak silinecek. Bu işlem geri alınamaz.',
            confirmLabel: 'Maçı sil',
            action: function () { return TM.api('/Admin/DeleteMatch/' + m.id, { method: 'POST' }); }
        }).then(function (deleted) {
            if (!deleted) return;
            var tr = els.rows.querySelector('tr[data-id="' + m.id + '"]');
            if (tr) tr.classList.add('is-leaving');
            window.setTimeout(function () { reload(null); }, TM.reduceMotion ? 0 : 320);
        });
    }

    /* ---------------------------------------------------------
       8. Adres parametreleri (?week=3, ?status=Ertelendi, ?overdue=1, ?new=1&date=2026-10-17, ?edit=12)
       --------------------------------------------------------- */
    function route(p) {
        var w = Number(p.get('week'));
        state.week = w >= 1 ? w : null;
        var s = p.get('status');
        state.status = s && TM.statusLabel(s) && ['Planlandi', 'Oynaniyor', 'Tamamlandi', 'Ertelendi'].indexOf(s) >= 0 ? s : '';
        els.status.value = state.status;
        if (p.get('overdue')) state.overdue = true;
        render();
        scrollRailToSelection(false);

        if (p.get('new')) {
            openForm(null, state.week);
            // Takvimden gelindiyse (?date=2026-10-17) tarih o güne ayarlanır, saat varsayılan kalır
            var day = p.get('date');
            if (/^\d{4}-\d{2}-\d{2}$/.test(day || '')) {
                f.date.value = day;
                var sameDay = matches.filter(function (m) { return TM.dateInputValue(TM.toDate(m.matchDate)) === day; })[0];
                if (sameDay && !state.week) f.week.value = sameDay.week;
                updateConflictHint();
                TM.setParams({ date: null });
            }
        }
        else if (p.get('edit')) {
            var m = matchById(p.get('edit'));
            if (m) openForm(m); else TM.toast('Bu maç bulunamadı. Silinmiş olabilir.', 'warn');
        }
    }

    TM.onRoute(route);
    TM.onData(function (d) { matches = d.matches; teams = d.teams; });
    fillTeamSelects();
    route(TM.params());
})();
