using System.Globalization;

namespace MyAcademy_WebUiProject.Models.Admin
{
    public class AdminStandingRow
    {
        public int TeamId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? LogoUrl { get; set; }
        public int Played { get; set; }
        public int Won { get; set; }
        public int Drawn { get; set; }
        public int Lost { get; set; }
        public int GoalsFor { get; set; }
        public int GoalsAgainst { get; set; }
        public int GoalDifference => GoalsFor - GoalsAgainst;
        public int Points => Won * 3 + Drawn;
    }

    public class AdminWeekSummary
    {
        public int Week { get; set; }
        public int Total { get; set; }
        public int Finished { get; set; }
        public int Live { get; set; }
        public int Planned { get; set; }
        public int Postponed { get; set; }
    }

    // Kontrol listesindeki tek bir uyarı
    public class AdminAlert
    {
        public string Level { get; set; } = "warn";   // "danger" | "warn" | "info"
        public string Title { get; set; } = string.Empty;
        public string Detail { get; set; } = string.Empty;
        public string? ActionText { get; set; }
        public string? ActionUrl { get; set; }
    }

    public class AdminDashboardViewModel
    {
        public string? Error { get; set; }

        public AdminSnapshot Snapshot { get; set; } = new();

        public int TeamCount { get; set; }
        public int MatchCount { get; set; }
        public int FinishedCount { get; set; }
        public int LiveCount { get; set; }
        public int PlannedCount { get; set; }
        public int PostponedCount { get; set; }
        public int GoalCount { get; set; }
        public double GoalsPerMatch { get; set; }

        public int ActiveWeek { get; set; } = 1;
        public int ExpectedMatchesPerWeek { get; set; }
        public AdminWeekSummary ActiveWeekSummary { get; set; } = new();
        public List<AdminWeekSummary> Weeks { get; set; } = new();

        public List<FixtureItemViewModel> ActiveWeekMatches { get; set; } = new();
        public List<FixtureItemViewModel> LiveMatches { get; set; } = new();
        public FixtureItemViewModel? NextMatch { get; set; }
        public List<FixtureItemViewModel> LatestResults { get; set; } = new();

        public List<AdminStandingRow> Standings { get; set; } = new();
        public List<AdminAlert> Alerts { get; set; } = new();

        // -----------------------------------------------------------------
        // Kontrol panelindeki her şey burada, API'den gelen ham listelerden hesaplanır
        // -----------------------------------------------------------------
        public static AdminDashboardViewModel Build(AdminSnapshot snapshot, DateTime now)
        {
            var vm = new AdminDashboardViewModel { Error = snapshot.Error, Snapshot = snapshot }; var teams = snapshot.Teams;
            var matches = snapshot.Matches;
            var tr = new CultureInfo("tr-TR");

            vm.TeamCount = teams.Count;
            vm.MatchCount = matches.Count;
            vm.FinishedCount = matches.Count(m => m.Status == MatchStatuses.Finished);
            vm.LiveCount = matches.Count(m => m.Status == MatchStatuses.Live);
            vm.PlannedCount = matches.Count(m => m.Status == MatchStatuses.Planned);
            vm.PostponedCount = matches.Count(m => m.Status == MatchStatuses.Postponed);
            vm.GoalCount = matches
                .Where(m => m.Status == MatchStatuses.Finished)
                .Sum(m => (m.HomeScore ?? 0) + (m.AwayScore ?? 0));
            vm.GoalsPerMatch = vm.FinishedCount > 0 ? (double)vm.GoalCount / vm.FinishedCount : 0;
            vm.ExpectedMatchesPerWeek = Math.Max(1, teams.Count / 2);

            // Haftalık özetler
            vm.Weeks = matches
                .GroupBy(m => m.Week)
                .OrderBy(g => g.Key)
                .Select(g => new AdminWeekSummary
                {
                    Week = g.Key,
                    Total = g.Count(),
                    Finished = g.Count(m => m.Status == MatchStatuses.Finished),
                    Live = g.Count(m => m.Status == MatchStatuses.Live),
                    Planned = g.Count(m => m.Status == MatchStatuses.Planned),
                    Postponed = g.Count(m => m.Status == MatchStatuses.Postponed)
                })
                .ToList();

            // Aktif hafta: içinde oynanmamış ya da canlı maç olan ilk hafta
            // Aktif hafta: canlı maçın haftası; yoksa sıradaki maçın haftası;
            // o da yoksa içinde oynanmamış maç olan ilk hafta; hepsi bittiyse son hafta
            var liveWeek = matches.Where(m => m.Status == MatchStatuses.Live).Select(m => (int?)m.Week).Min();
            var nextWeek = matches.Where(m => m.Status == MatchStatuses.Planned && m.MatchDate >= now)
                                  .OrderBy(m => m.MatchDate).Select(m => (int?)m.Week).FirstOrDefault();
            var openWeek = vm.Weeks.FirstOrDefault(w => w.Planned > 0 || w.Live > 0)?.Week;
            vm.ActiveWeek = liveWeek ?? nextWeek ?? openWeek ?? (vm.Weeks.LastOrDefault()?.Week ?? 1);
            vm.ActiveWeekSummary = vm.Weeks.FirstOrDefault(w => w.Week == vm.ActiveWeek)
                                   ?? new AdminWeekSummary { Week = vm.ActiveWeek };
            vm.ActiveWeekMatches = matches.Where(m => m.Week == vm.ActiveWeek).OrderBy(m => m.MatchDate).ToList();

            vm.LiveMatches = matches.Where(m => m.Status == MatchStatuses.Live).OrderBy(m => m.MatchDate).ToList();
            vm.NextMatch = matches
                .Where(m => m.Status == MatchStatuses.Planned && m.MatchDate >= now)
                .OrderBy(m => m.MatchDate)
                .FirstOrDefault();
            vm.LatestResults = matches
                .Where(m => m.Status == MatchStatuses.Finished)
                .OrderByDescending(m => m.MatchDate)
                .ThenByDescending(m => m.Id)
                .Take(5)
                .ToList();

            vm.Standings = BuildStandings(teams, matches);
            vm.Alerts = BuildAlerts(vm, teams, matches, now, tr);
            return vm;
        }

        private static List<AdminStandingRow> BuildStandings(List<AdminTeamItem> teams, List<FixtureItemViewModel> matches)
        {
            var rows = teams.ToDictionary(t => t.Id, t => new AdminStandingRow { TeamId = t.Id, Name = t.Name, LogoUrl = t.LogoUrl });

            foreach (var m in matches.Where(x => x.Status == MatchStatuses.Finished && x.HomeScore.HasValue && x.AwayScore.HasValue))
            {
                if (!rows.TryGetValue(m.HomeTeamId, out var home) || !rows.TryGetValue(m.AwayTeamId, out var away))
                    continue;

                int hs = m.HomeScore!.Value, aws = m.AwayScore!.Value;
                home.Played++; away.Played++;
                home.GoalsFor += hs; home.GoalsAgainst += aws;
                away.GoalsFor += aws; away.GoalsAgainst += hs;

                if (hs > aws) { home.Won++; away.Lost++; }
                else if (hs < aws) { away.Won++; home.Lost++; }
                else { home.Drawn++; away.Drawn++; }
            }

            return rows.Values
                .OrderByDescending(r => r.Points)
                .ThenByDescending(r => r.GoalDifference)
                .ThenByDescending(r => r.GoalsFor)
                .ThenBy(r => r.Name)
                .ToList();
        }

        private static List<AdminAlert> BuildAlerts(AdminDashboardViewModel vm, List<AdminTeamItem> teams,
            List<FixtureItemViewModel> matches, DateTime now, CultureInfo tr)
        {
            var alerts = new List<AdminAlert>();

            // 1) Saati geçtiği halde hâlâ "Planlandı" görünen maçlar
            foreach (var m in matches.Where(x => x.Status == MatchStatuses.Planned && x.MatchDate.AddHours(2) < now).Take(4))
            {
                alerts.Add(new AdminAlert
                {
                    Level = "danger",
                    Title = $"{m.HomeTeamName} - {m.AwayTeamName} için sonuç girilmedi",
                    Detail = $"{m.Week}. hafta, {m.MatchDate.ToString("d MMMM HH:mm", tr)}. Maç oynanmış olmalı ama hâlâ planlı görünüyor.",
                    ActionText = "Sonucu gir",
                    ActionUrl = $"/Admin/Matches?edit={m.Id}"
                });
            }

            // 2) Üç saatten uzun süredir "Canlı" kalan maçlar
            foreach (var m in matches.Where(x => x.Status == MatchStatuses.Live && x.MatchDate.AddHours(3) < now).Take(3))
            {
                alerts.Add(new AdminAlert
                {
                    Level = "warn",
                    Title = $"{m.HomeTeamName} - {m.AwayTeamName} hâlâ canlı",
                    Detail = $"Başlama saati {m.MatchDate.ToString("d MMMM HH:mm", tr)}. Maç bittiyse durumu Tamamlandı yapın.",
                    ActionText = "Maçı bitir",
                    ActionUrl = $"/Admin/Matches?edit={m.Id}"
                });
            }

            // 3) Eksik haftalar
            foreach (var w in vm.Weeks.Where(w => w.Total < vm.ExpectedMatchesPerWeek).Take(3))
            {
                alerts.Add(new AdminAlert
                {
                    Level = "warn",
                    Title = $"{w.Week}. haftada {vm.ExpectedMatchesPerWeek - w.Total} maç eksik",
                    Detail = $"{teams.Count} takımlı ligde her hafta {vm.ExpectedMatchesPerWeek} maç oynanır, bu haftada {w.Total} maç var.",
                    ActionText = "Maç ekle",
                    ActionUrl = $"/Admin/Matches?week={w.Week}&new=1"
                });
            }

            // 4) Ertelenen maçlar
            var postponed = matches.Where(m => m.Status == MatchStatuses.Postponed).ToList();
            if (postponed.Count > 0)
            {
                alerts.Add(new AdminAlert
                {
                    Level = "info",
                    Title = postponed.Count == 1 ? "1 maç ertelendi" : $"{postponed.Count} maç ertelendi",
                    Detail = string.Join(", ", postponed.Take(3).Select(m => $"{m.HomeTeamName} - {m.AwayTeamName}"))
                             + (postponed.Count > 3 ? " ve diğerleri" : "") + ". Yeni tarih belli olunca güncelleyin.",
                    ActionText = "Ertelenenleri gör",
                    ActionUrl = "/Admin/Matches?status=Ertelendi"
                });
            }

            // 5) Logosu olmayan takımlar
            var noLogo = teams.Where(t => string.IsNullOrWhiteSpace(t.LogoUrl)).ToList();
            if (noLogo.Count > 0)
            {
                alerts.Add(new AdminAlert
                {
                    Level = "info",
                    Title = $"{noLogo.Count} takımın logosu yok",
                    Detail = string.Join(", ", noLogo.Take(4).Select(t => t.Name))
                             + (noLogo.Count > 4 ? $" ve {noLogo.Count - 4} takım daha" : "")
                             + ". Sitede logo yerine kısaltma görünüyor.",
                    ActionText = "Logoları ekle",
                    ActionUrl = "/Admin/Teams?filter=nologo"
                });
            }

            // 6) Hiç maçı olmayan takımlar
            var idle = teams.Where(t => t.MatchCount == 0).ToList();
            if (idle.Count > 0)
            {
                alerts.Add(new AdminAlert
                {
                    Level = "info",
                    Title = idle.Count == 1 ? $"{idle[0].Name} fikstürde yok" : $"{idle.Count} takım fikstürde yok",
                    Detail = string.Join(", ", idle.Take(4).Select(t => t.Name)) + " için henüz maç eklenmedi.",
                    ActionText = "Takımları gör",
                    ActionUrl = "/Admin/Teams?filter=idle"
                });
            }

            var order = new Dictionary<string, int> { ["danger"] = 0, ["warn"] = 1, ["info"] = 2 };
            return alerts.OrderBy(a => order[a.Level]).ToList();
        }
    }
}