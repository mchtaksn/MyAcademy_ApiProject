/* =================================================================
   Doksan Artı — Teknik Masa lig hesapları (admin-league.js)
   Puan durumu, form, haftalık puan yarışı, gol istatistikleri,
   rekorlar ve iki takım karşılaştırması burada hesaplanır.
   Bütün sayfalar aynı hesabı kullanır: kontrol paneli, puan durumu,
   istatistikler ve canlı masa. window.TM.league olarak açılır.
   ================================================================= */
(function () {
    'use strict';

    var TM = window.TM;
    if (!TM) return;

    var FINISHED = 'Tamamlandi';
    var LIVE = 'Oynaniyor';
    var PLANNED = 'Planlandi';
    var POSTPONED = 'Ertelendi';

    /* ---------------------------------------------------------
       Yardımcılar
       --------------------------------------------------------- */
    function hasScore(m) {
        return m.homeScore !== null && m.homeScore !== undefined && m.awayScore !== null && m.awayScore !== undefined;
    }

    function isFinished(m) { return m.status === FINISHED && hasScore(m); }
    function isLive(m) { return m.status === LIVE; }

    function byDate(a, b) {
        return TM.toDate(a.matchDate) - TM.toDate(b.matchDate) || a.id - b.id;
    }

    function weeksOf(matches) {
        var seen = {};
        matches.forEach(function (m) { seen[m.week] = true; });
        return Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
    }

    // Maçın sonucu belirli bir takım açısından: G (galibiyet), B (beraberlik), M (mağlubiyet)
    function outcomeFor(m, teamId) {
        var mine = m.homeTeamId === teamId ? m.homeScore : m.awayScore;
        var theirs = m.homeTeamId === teamId ? m.awayScore : m.homeScore;
        return mine > theirs ? 'G' : mine < theirs ? 'M' : 'B';
    }

    function teamIndex(teams) {
        var map = {};
        teams.forEach(function (t) { map[t.id] = t; });
        return map;
    }

    /* ---------------------------------------------------------
       Puan durumu
       options:
         upToWeek   : bu haftaya kadar olan maçlar (dahil)
         venue      : 'all' | 'home' | 'away'
         includeLive: canlı maçları anlık skoruyla say
         overrides  : { maçId: { home: 2, away: 1 } } senaryo skorları
       --------------------------------------------------------- */
    function table(teams, matches, options) {
        options = options || {};
        var venue = options.venue || 'all';
        var overrides = options.overrides || {};
        var rows = {};

        teams.forEach(function (t) {
            rows[t.id] = {
                id: t.id, name: t.name, logoUrl: t.logoUrl, city: t.city,
                played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0,
                cleanSheets: 0, failedToScore: 0, results: [], rank: 0
            };
        });

        var counted = [];
        matches.forEach(function (m) {
            if (options.upToWeek && m.week > options.upToWeek) return;
            var o = overrides[m.id];
            var copy = m;
            if (o) {
                copy = Object.assign({}, m, { homeScore: o.home, awayScore: o.away, status: FINISHED });
            } else if (options.includeLive && isLive(m) && hasScore(m)) {
                copy = Object.assign({}, m, { status: FINISHED });
            }
            if (isFinished(copy)) counted.push(copy);
        });
        counted.sort(byDate);

        counted.forEach(function (m) {
            var home = rows[m.homeTeamId];
            var away = rows[m.awayTeamId];
            if (home && venue !== 'away') apply(home, m.homeScore, m.awayScore, m);
            if (away && venue !== 'home') apply(away, m.awayScore, m.homeScore, m);
        });

        var list = Object.keys(rows).map(function (k) { return rows[k]; });
        list.forEach(function (r) {
            r.gd = r.gf - r.ga;
            r.points = r.won * 3 + r.drawn;
            r.form = r.results.slice(-5);
            r.ppg = r.played ? r.points / r.played : 0;
        });
        list.sort(compareRows);
        list.forEach(function (r, i) { r.rank = i + 1; });
        return list;
    }

    function apply(row, mine, theirs, m) {
        row.played++;
        row.gf += mine;
        row.ga += theirs;
        if (theirs === 0) row.cleanSheets++;
        if (mine === 0) row.failedToScore++;
        var res = mine > theirs ? 'G' : mine < theirs ? 'M' : 'B';
        if (res === 'G') row.won++;
        else if (res === 'B') row.drawn++;
        else row.lost++;
        row.results.push({ r: res, match: m });
    }

    function compareRows(a, b) {
        return b.points - a.points ||
            (b.gf - b.ga) - (a.gf - a.ga) ||
            b.gf - a.gf ||
            a.name.localeCompare(b.name, 'tr-TR');
    }

    /* ---------------------------------------------------------
       Haftalık puan yarışı: her takımın hafta sonundaki toplam puanı ve sırası
       --------------------------------------------------------- */
    function race(teams, matches) {
        var weeks = weeksOf(matches.filter(isFinished));
        var points = {};
        var ranks = {};
        teams.forEach(function (t) { points[t.id] = []; ranks[t.id] = []; });

        weeks.forEach(function (w) {
            var snapshot = table(teams, matches, { upToWeek: w });
            snapshot.forEach(function (r) {
                points[r.id].push(r.points);
                ranks[r.id].push(r.rank);
            });
        });
        return { weeks: weeks, points: points, ranks: ranks };
    }

    /* ---------------------------------------------------------
       Haftalık gol / sonuç özetleri
       --------------------------------------------------------- */
    function weekly(matches) {
        var weeks = weeksOf(matches);
        return weeks.map(function (w) {
            var list = matches.filter(function (m) { return m.week === w; });
            var done = list.filter(isFinished);
            var homeGoals = 0, awayGoals = 0, homeWins = 0, draws = 0, awayWins = 0;
            done.forEach(function (m) {
                homeGoals += m.homeScore;
                awayGoals += m.awayScore;
                if (m.homeScore > m.awayScore) homeWins++;
                else if (m.homeScore < m.awayScore) awayWins++;
                else draws++;
            });
            return {
                week: w,
                total: list.length,
                finished: done.length,
                live: list.filter(isLive).length,
                planned: list.filter(function (m) { return m.status === PLANNED; }).length,
                postponed: list.filter(function (m) { return m.status === POSTPONED; }).length,
                homeGoals: homeGoals,
                awayGoals: awayGoals,
                goals: homeGoals + awayGoals,
                avg: done.length ? (homeGoals + awayGoals) / done.length : 0,
                homeWins: homeWins,
                draws: draws,
                awayWins: awayWins
            };
        });
    }

    function outcomes(matches) {
        var r = { home: 0, draw: 0, away: 0, total: 0, goals: 0, homeGoals: 0, awayGoals: 0, bothScored: 0, over25: 0, cleanSheets: 0 };
        matches.filter(isFinished).forEach(function (m) {
            r.total++;
            r.goals += m.homeScore + m.awayScore;
            r.homeGoals += m.homeScore;
            r.awayGoals += m.awayScore;
            if (m.homeScore > m.awayScore) r.home++;
            else if (m.homeScore < m.awayScore) r.away++;
            else r.draw++;
            if (m.homeScore > 0 && m.awayScore > 0) r.bothScored++;
            if (m.homeScore + m.awayScore > 2) r.over25++;
            if (m.homeScore === 0) r.cleanSheets++;
            if (m.awayScore === 0) r.cleanSheets++;
        });
        r.avg = r.total ? r.goals / r.total : 0;
        return r;
    }

    /* ---------------------------------------------------------
       Skor dağılımı: [ev golü][deplasman golü] = maç sayısı (4 ve üstü tek kutu)
       --------------------------------------------------------- */
    function scorelines(matches, cap) {
        cap = cap || 4;
        var grid = [];
        for (var h = 0; h <= cap; h++) {
            grid.push([]);
            for (var a = 0; a <= cap; a++) grid[h].push(0);
        }
        var max = 0;
        matches.filter(isFinished).forEach(function (m) {
            var h = Math.min(cap, m.homeScore);
            var a = Math.min(cap, m.awayScore);
            grid[h][a]++;
            if (grid[h][a] > max) max = grid[h][a];
        });
        return { grid: grid, max: max, cap: cap };
    }

    /* ---------------------------------------------------------
       Rekorlar ve seriler
       --------------------------------------------------------- */
    function records(teams, matches) {
        var done = matches.filter(isFinished).sort(byDate);
        var biggestWin = null, highestScoring = null, biggestAwayWin = null;

        done.forEach(function (m) {
            var margin = Math.abs(m.homeScore - m.awayScore);
            var total = m.homeScore + m.awayScore;
            if (!biggestWin || margin > biggestWin.margin || (margin === biggestWin.margin && total > biggestWin.total)) {
                biggestWin = { match: m, margin: margin, total: total };
            }
            if (!highestScoring || total > highestScoring.total) highestScoring = { match: m, total: total };
            if (m.awayScore > m.homeScore && (!biggestAwayWin || m.awayScore - m.homeScore > biggestAwayWin.margin)) {
                biggestAwayWin = { match: m, margin: m.awayScore - m.homeScore };
            }
        });

        var streaks = teams.map(function (t) { return streak(t, done); });
        var unbeaten = streaks.slice().sort(function (a, b) { return b.unbeaten - a.unbeaten || b.wins - a.wins; })[0];
        var winning = streaks.slice().sort(function (a, b) { return b.wins - a.wins || b.unbeaten - a.unbeaten; })[0];
        var winless = streaks.slice().sort(function (a, b) { return b.winless - a.winless; })[0];

        return {
            biggestWin: biggestWin,
            highestScoring: highestScoring,
            biggestAwayWin: biggestAwayWin,
            unbeaten: unbeaten && unbeaten.unbeaten > 1 ? unbeaten : null,
            winning: winning && winning.wins > 1 ? winning : null,
            winless: winless && winless.winless > 1 ? winless : null
        };
    }

    // Takımın şu anki (son maçtan geriye doğru) serileri
    function streak(team, done) {
        var mine = done.filter(function (m) { return m.homeTeamId === team.id || m.awayTeamId === team.id; });
        var res = mine.map(function (m) { return outcomeFor(m, team.id); }).reverse();
        function count(pred) {
            var n = 0;
            for (var i = 0; i < res.length; i++) { if (pred(res[i])) n++; else break; }
            return n;
        }
        return {
            team: team,
            wins: count(function (r) { return r === 'G'; }),
            unbeaten: count(function (r) { return r !== 'M'; }),
            winless: count(function (r) { return r !== 'G'; })
        };
    }

    /* ---------------------------------------------------------
       İki takım karşılaştırması
       --------------------------------------------------------- */
    function compare(teams, matches, aId, bId) {
        var rows = table(teams, matches);
        var home = table(teams, matches, { venue: 'home' });
        var away = table(teams, matches, { venue: 'away' });
        function pick(list, id) { return list.filter(function (r) { return r.id === id; })[0]; }
        var meetings = matches.filter(function (m) {
            return (m.homeTeamId === aId && m.awayTeamId === bId) || (m.homeTeamId === bId && m.awayTeamId === aId);
        }).sort(byDate);
        return {
            a: pick(rows, aId), b: pick(rows, bId),
            aHome: pick(home, aId), bHome: pick(home, bId),
            aAway: pick(away, aId), bAway: pick(away, bId),
            meetings: meetings
        };
    }

    /* ---------------------------------------------------------
       Takımın maçları (son ve sıradaki)
       --------------------------------------------------------- */
    function teamMatches(matches, teamId) {
        return matches.filter(function (m) { return m.homeTeamId === teamId || m.awayTeamId === teamId; }).sort(byDate);
    }

    function nextMatch(matches, now) {
        now = now || Date.now();
        return matches
            .filter(function (m) { return m.status === PLANNED && TM.toDate(m.matchDate).getTime() >= now; })
            .sort(byDate)[0] || null;
    }

    // Kontrol paneliyle aynı kural: canlı maçın haftası, yoksa sıradaki maçın haftası,
    // yoksa içinde oynanmamış maç olan ilk hafta, hepsi bittiyse son hafta
    function activeWeek(matches) {
        var live = matches.filter(isLive).map(function (m) { return m.week; });
        if (live.length) return Math.min.apply(null, live);
        var next = nextMatch(matches);
        if (next) return next.week;
        var list = weekly(matches);
        for (var i = 0; i < list.length; i++) {
            if (list[i].live > 0 || list[i].planned > 0) return list[i].week;
        }
        return list.length ? list[list.length - 1].week : 1;
    }

    /* ---------------------------------------------------------
       Canlı dakika (başlama saatine göre tahmini)
       45. dakikadan sonra 15 dakika devre arası sayılır
       --------------------------------------------------------- */
    function liveClock(match, now) {
        var start = TM.toDate(match.matchDate).getTime();
        var elapsed = Math.floor(((now || Date.now()) - start) / 60000);
        if (elapsed < 0) return { minute: 0, text: "0'", phase: 'pre', label: 'Başlamadı' };
        if (elapsed <= 45) return { minute: elapsed, text: elapsed + "'", phase: 'first', label: 'İlk yarı' };
        if (elapsed <= 47) return { minute: 45, text: "45+", phase: 'first', label: 'İlk yarı uzatması' };
        if (elapsed <= 62) return { minute: 45, text: "45'", phase: 'break', label: 'Devre arası' };
        var second = elapsed - 17;
        if (second <= 90) return { minute: second, text: second + "'", phase: 'second', label: 'İkinci yarı' };
        return { minute: 90, text: "90+", phase: 'extra', label: 'Uzatma dakikaları' };
    }

    /* ---------------------------------------------------------
       Bölgeler: Şampiyonlar Ligi, Avrupa Ligi, Konferans Ligi, küme düşme
       --------------------------------------------------------- */
    function zone(rank, total) {
        if (total < 8) return '';
        if (rank <= 4) return 'ucl';
        if (rank === 5) return 'uel';
        if (rank === 6) return 'uecl';
        if (rank > total - 3) return 'rel';
        return '';
    }

    var ZONES = {
        ucl: 'Şampiyonlar Ligi',
        uel: 'Avrupa Ligi',
        uecl: 'Konferans Ligi',
        rel: 'Küme düşme'
    };

    TM.league = {
        FINISHED: FINISHED, LIVE: LIVE, PLANNED: PLANNED, POSTPONED: POSTPONED,
        hasScore: hasScore, isFinished: isFinished, isLive: isLive, byDate: byDate,
        weeksOf: weeksOf, outcomeFor: outcomeFor, teamIndex: teamIndex,
        table: table, race: race, weekly: weekly, outcomes: outcomes, scorelines: scorelines,
        records: records, streak: streak, compare: compare, teamMatches: teamMatches,
        nextMatch: nextMatch, activeWeek: activeWeek, liveClock: liveClock,
        zone: zone, ZONES: ZONES
    };
})();
