/* =================================================================
   Teknik Masa — takım yönetimi (admin-teams.js)
   1 Durum + filtreler   3 Form (ekle/düzenle) + canlı önizleme
   2 Listeyi çiz         4 Silme   5 Adres parametreleri
   ================================================================= */
(function () {
    'use strict';

    var TM = window.TM;
    if (!TM) return;

    var $ = TM.$, $$ = TM.$$, esc = TM.esc;

    /* ---------------------------------------------------------
       1. Durum + filtreler
       --------------------------------------------------------- */
    var seed = TM.readSeed() || { teams: [], matches: [] };
    var teams = seed.teams || [];
    var state = { q: '', city: '', sort: 'name', quick: 'all', view: 'grid' };
    var savedId = null;

    try {
        var storedView = window.localStorage.getItem('tm-team-view');
        if (storedView === 'grid' || storedView === 'table') state.view = storedView;
    } catch (e) { /* tarayıcı depolaması kapalı olabilir */ }

    var els = {
        grid: $('[data-team-grid]'),
        tableWrap: $('[data-team-tablewrap]'),
        rows: $('[data-team-rows]'),
        empty: $('[data-team-empty]'),
        count: $('[data-team-count]'),
        search: $('[data-team-search]'),
        city: $('[data-team-city]'),
        sort: $('[data-team-sort]'),
        quick: $$('[data-quick]'),
        views: $$('[data-view]'),
        modal: document.getElementById('tmTeamModal'),
        form: $('[data-team-form]')
    };

    function isNoLogo(t) { return !t.logoUrl || !String(t.logoUrl).trim(); }

    function filtered() {
        var q = TM.norm(state.q);
        var list = teams.filter(function (t) {
            if (q && TM.norm(t.name + ' ' + t.city + ' ' + t.stadium).indexOf(q) < 0) return false;
            if (state.city && t.city !== state.city) return false;
            if (state.quick === 'nologo' && !isNoLogo(t)) return false;
            if (state.quick === 'idle' && t.matchCount > 0) return false;
            return true;
        });

        var byName = function (a, b) { return a.name.localeCompare(b.name, 'tr'); };
        list.sort(function (a, b) {
            if (state.sort === 'city') return a.city.localeCompare(b.city, 'tr') || byName(a, b);
            if (state.sort === 'matches') return (b.matchCount - a.matchCount) || byName(a, b);
            if (state.sort === 'id') return a.id - b.id;
            return byName(a, b);
        });
        return list;
    }

    /* ---------------------------------------------------------
       2. Listeyi çiz
       --------------------------------------------------------- */
    function tags(t) {
        var html = '<span class="tm-tag">' + t.matchCount + ' maç</span>';
        if (isNoLogo(t)) html += '<span class="tm-tag tm-tag--warn">Logo yok</span>';
        if (t.matchCount === 0) html += '<span class="tm-tag tm-tag--info">Fikstürde yok</span>';
        return html;
    }

    function actions(t) {
        return '<button type="button" class="tm-iconbtn" data-edit="' + t.id + '" title="Düzenle" aria-label="' + esc(t.name) + ' takımını düzenle">' +
            '<svg class="tm-icon" aria-hidden="true"><use href="#tm-i-edit"/></svg></button>' +
            '<button type="button" class="tm-iconbtn tm-iconbtn--danger" data-delete="' + t.id + '" title="Sil" aria-label="' + esc(t.name) + ' takımını sil">' +
            '<svg class="tm-icon" aria-hidden="true"><use href="#tm-i-trash"/></svg></button>';
    }

    function render() {
        var list = filtered();

        els.grid.innerHTML = list.map(function (t, i) {
            return '<article class="tm-teamcard' + (t.id === savedId ? ' is-saved' : '') + '" style="--i:' + Math.min(i, 20) + '" data-id="' + t.id + '">' +
                '<div class="tm-teamcard__top">' + TM.crest(t.name, t.logoUrl, 'lg') +
                '<div class="tm-teamcard__actions">' + actions(t) + '</div></div>' +
                '<button type="button" class="tm-teamcard__name" data-edit="' + t.id + '">' + esc(t.name) + '</button>' +
                '<ul class="tm-teamcard__meta">' +
                '<li><svg class="tm-icon" aria-hidden="true"><use href="#tm-i-pin"/></svg><span>' + esc(t.city || 'Şehir yok') + '</span></li>' +
                '<li><svg class="tm-icon" aria-hidden="true"><use href="#tm-i-stadium"/></svg><span>' + esc(t.stadium || 'Stadyum yok') + '</span></li>' +
                '</ul>' +
                '<div class="tm-teamcard__foot">' + tags(t) + '</div>' +
                '<span class="tm-teamcard__code" aria-hidden="true">' + esc(TM.teamCode(t.name)) + '</span>' +
                '</article>';
        }).join('');

        els.rows.innerHTML = list.map(function (t) {
            return '<tr data-id="' + t.id + '"' + (t.id === savedId ? ' class="is-saved"' : '') + '>' +
                '<td class="tm-col-id">' + t.id + '</td>' +
                '<td><span class="tm-teamcell">' + TM.crest(t.name, t.logoUrl, 'sm') + esc(t.name) + '</span></td>' +
                '<td>' + esc(t.city) + '</td>' +
                '<td>' + esc(t.stadium) + '</td>' +
                '<td class="tm-col-num">' + t.matchCount + '</td>' +
                '<td class="tm-col-actions"><div class="tm-rowactions">' + actions(t) + '</div></td>' +
                '</tr>';
        }).join('');

        var showGrid = state.view === 'grid';
        els.grid.hidden = !showGrid || list.length === 0;
        els.tableWrap.hidden = showGrid || list.length === 0;
        els.empty.hidden = list.length > 0;
        els.count.textContent = teams.length + ' takımdan ' + list.length + ' tanesi gösteriliyor';

        els.views.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === state.view)); });
        els.quick.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-quick') === state.quick)); });
        updateQuickCounts();
        savedId = null;
    }

    function updateQuickCounts() {
        var set = function (key, v) { var el = $('[data-quick-count="' + key + '"]'); if (el) el.textContent = v; };
        set('all', teams.length);
        set('cities', new Set(teams.map(function (t) { return t.city; }).filter(Boolean)).size);
        set('nologo', teams.filter(isNoLogo).length);
        set('idle', teams.filter(function (t) { return t.matchCount === 0; }).length);
    }

    function refreshCities() {
        var current = els.city.value;
        var cities = Array.from(new Set(teams.map(function (t) { return t.city; }).filter(Boolean)))
            .sort(function (a, b) { return a.localeCompare(b, 'tr'); });
        els.city.innerHTML = '<option value="">Tüm şehirler</option>' +
            cities.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');
        els.city.value = cities.indexOf(current) >= 0 ? current : '';
        state.city = els.city.value;
        var list = document.getElementById('tmCityList');
        if (list) list.innerHTML = cities.map(function (c) { return '<option value="' + esc(c) + '"></option>'; }).join('');
    }

    // Filtre olayları
    els.search.addEventListener('input', function () { state.q = els.search.value; render(); });
    els.city.addEventListener('change', function () { state.city = els.city.value; render(); });
    els.sort.addEventListener('change', function () { state.sort = els.sort.value; render(); });
    els.quick.forEach(function (b) {
        b.addEventListener('click', function () {
            var key = b.getAttribute('data-quick');
            state.quick = state.quick === key && key !== 'all' ? 'all' : key;
            TM.setParams({ filter: state.quick === 'all' ? null : state.quick });
            render();
        });
    });
    els.views.forEach(function (b) {
        b.addEventListener('click', function () {
            state.view = b.getAttribute('data-view');
            try { window.localStorage.setItem('tm-team-view', state.view); } catch (e) { }
            render();
        });
    });
    $('[data-team-reset]').addEventListener('click', function () {
        state.q = ''; state.city = ''; state.quick = 'all';
        els.search.value = ''; els.city.value = '';
        TM.setParams({ filter: null });
        render();
    });

    // Kart ve tablo içindeki düğmeler
    document.addEventListener('click', function (e) {
        var edit = e.target.closest('[data-edit]');
        var del = e.target.closest('[data-delete]');
        if (edit && (els.grid.contains(edit) || els.rows.contains(edit))) {
            openForm(findTeam(edit.getAttribute('data-edit')));
        } else if (del && (els.grid.contains(del) || els.rows.contains(del))) {
            removeTeam(findTeam(del.getAttribute('data-delete')));
        }
    });

    function findTeam(id) {
        id = Number(id);
        return teams.filter(function (t) { return t.id === id; })[0] || null;
    }

    // Kaydetme / silme sonrası güncel veriyi çek
    function reload(highlightId) {
        return TM.loadData(true).then(function (d) {
            if (d) teams = d.teams;
            savedId = highlightId || null;
            refreshCities();
            render();
        });
    }

    /* ---------------------------------------------------------
       3. Form (ekle/düzenle) + canlı önizleme
       --------------------------------------------------------- */
    var f = els.form.elements;
    var preview = {
        box: $('.tm-teampreview', els.form),
        crest: $('[data-preview-crest]', els.form),
        name: $('[data-preview-name]', els.form),
        meta: $('[data-preview-meta]', els.form),
        code: $('[data-preview-code]', els.form),
        hint: $('[data-logo-hint]', els.form)
    };
    var defaultHint = preview.hint.textContent;
    var editing = null;
    var logoTimer = null;
    var lastCrestKey = '';

    function updatePreview() {
        var name = f.name.value.trim();
        var city = f.city.value.trim();
        var stadium = f.stadium.value.trim();
        var logo = f.logoUrl.value.trim();

        preview.box.classList.toggle('is-placeholder', !name);
        preview.name.textContent = name || 'Takım adı';
        preview.meta.textContent = [city, stadium].filter(Boolean).join(', ') || 'Şehir ve stadyum';
        preview.code.textContent = name ? TM.teamCode(name) : '---';

        var validLogo = /^https?:\/\/\S+$/i.test(logo);
        var key = (validLogo ? logo : '') + '|' + TM.teamCode(name || '?');
        if (key === lastCrestKey) return;
        lastCrestKey = key;

        window.clearTimeout(logoTimer);
        logoTimer = window.setTimeout(function () {
            preview.crest.innerHTML = TM.crest(name || '?', validLogo ? logo : null, 'xl');
            preview.hint.classList.remove('is-warn');
            preview.hint.textContent = logo && !validLogo
                ? 'Adres http:// veya https:// ile başlamalı.'
                : defaultHint;
            var img = preview.crest.querySelector('img');
            if (img) {
                img.addEventListener('load', function () {
                    preview.hint.textContent = 'Logo yüklendi.';
                });
                img.addEventListener('error', function () {
                    preview.hint.classList.add('is-warn');
                    preview.hint.textContent = 'Bu adresten görsel yüklenemedi. Kaydedebilirsin ama sitede kısaltma görünür.';
                });
            }
        }, validLogo ? 300 : 0);
    }

    ['name', 'city', 'stadium', 'logoUrl'].forEach(function (n) {
        f[n].addEventListener('input', function () {
            updatePreview();
            var field = f[n].closest('[data-field]');
            if (field) field.classList.remove('has-error');
        });
    });

    function openForm(team) {
        editing = team || null;
        TM.clearErrors(els.form);
        els.form.reset();
        lastCrestKey = '';
        f.id.value = editing ? editing.id : '';
        f.name.value = editing ? editing.name : '';
        f.city.value = editing ? editing.city : '';
        f.stadium.value = editing ? editing.stadium : '';
        f.logoUrl.value = editing && editing.logoUrl ? editing.logoUrl : '';

        $('[data-team-modal-title]').textContent = editing ? editing.name + ' takımını düzenle' : 'Yeni takım';
        $('[data-submit-label]', els.form).textContent = editing ? 'Değişiklikleri kaydet' : 'Takımı ekle';
        updatePreview();
        TM.setParams(editing ? { edit: editing.id, 'new': null } : { 'new': 1, edit: null });
        TM.openDialog(els.modal);
        f.name.focus();
    }

    els.modal.addEventListener('close', function () { TM.setParams({ edit: null, 'new': null }); });

    function validate(body) {
        var errors = {};
        if (!body.name) errors.name = 'Takım adını yaz.';
        else if (body.name.length < 2) errors.name = 'Takım adı en az 2 karakter olmalı.';
        else {
            var dupe = teams.filter(function (t) {
                return TM.norm(t.name) === TM.norm(body.name) && (!editing || t.id !== editing.id);
            })[0];
            if (dupe) errors.name = '"' + dupe.name + '" adında bir takım zaten var.';
        }
        if (!body.city) errors.city = 'Şehri yaz.';
        if (!body.stadium) errors.stadium = 'Stadyumu yaz.';
        if (body.logoUrl && !/^https?:\/\/\S+$/i.test(body.logoUrl)) errors.logoUrl = 'Logo adresi http:// veya https:// ile başlamalı.';
        return errors;
    }

    els.form.addEventListener('submit', function (e) {
        e.preventDefault();
        var body = {
            id: editing ? editing.id : null,
            name: f.name.value.trim(),
            city: f.city.value.trim(),
            stadium: f.stadium.value.trim(),
            logoUrl: f.logoUrl.value.trim() || null
        };

        var errors = validate(body);
        if (Object.keys(errors).length) {
            TM.showErrors(els.form, { errors: errors });
            return;
        }

        var submit = $('[data-submit]', els.form);
        TM.setBusy(submit, true);
        TM.api('/Admin/SaveTeam', { method: 'POST', body: body }).then(function (result) {
            TM.setBusy(submit, false);
            if (!result.ok) {
                TM.showErrors(els.form, result);
                return;
            }
            TM.closeDialog(els.modal);
            TM.toast(result.message || 'Kaydedildi.', 'success');
            reload(result.id || body.id).then(function () {
                var card = els.grid.querySelector('[data-id="' + (result.id || body.id) + '"]') ||
                    els.rows.querySelector('[data-id="' + (result.id || body.id) + '"]');
                if (card) card.scrollIntoView({ block: 'nearest', behavior: TM.reduceMotion ? 'auto' : 'smooth' });
                else if (state.q || state.city || state.quick !== 'all') TM.toast('Kayıt, seçili filtreler yüzünden listede görünmüyor.', 'info');
            });
        });
    });

    $$('[data-team-new]').forEach(function (b) { b.addEventListener('click', function () { openForm(null); }); });

    /* ---------------------------------------------------------
       4. Silme (kırmızı kart)
       --------------------------------------------------------- */
    function removeTeam(team) {
        if (!team) return;
        TM.confirmDelete({
            title: 'Takımı sil',
            html: '<strong>' + esc(team.name) + '</strong> ligden kalıcı olarak silinecek. Bu işlem geri alınamaz.',
            confirmLabel: 'Takımı sil',
            blocked: team.matchCount > 0
                ? team.name + ' takımının fikstürde ' + team.matchCount + ' maçı var. Önce bu maçları Maçlar sayfasından silmelisin.'
                : null,
            action: function () { return TM.api('/Admin/DeleteTeam/' + team.id, { method: 'POST' }); }
        }).then(function (deleted) {
            if (!deleted) return;
            var nodes = $$('[data-id="' + team.id + '"]');
            nodes.forEach(function (n) { n.classList.add('is-leaving'); });
            window.setTimeout(function () { reload(null); }, TM.reduceMotion ? 0 : 320);
        });
    }

    /* ---------------------------------------------------------
       5. Adres parametreleri (?new=1, ?edit=5, ?filter=nologo)
       --------------------------------------------------------- */
    function route(p) {
        var filter = p.get('filter');
        if (filter === 'nologo' || filter === 'idle') state.quick = filter;
        render();
        if (p.get('new')) openForm(null);
        else if (p.get('edit')) {
            var t = findTeam(p.get('edit'));
            if (t) openForm(t); else TM.toast('Bu takım bulunamadı. Silinmiş olabilir.', 'warn');
        }
    }

    TM.onRoute(route);
    TM.onData(function (d) { teams = d.teams; });
    route(TM.params());
})();
