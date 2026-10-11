using MyAcademy_WebUiProject.Models.Admin;

namespace MyAcademy_WebUiProject.Models.Site
{

    public class SitePageModel
    {
        public AdminSnapshot Data { get; set; } = new();

        public int? MatchId { get; set; }
        public int? TeamId { get; set; }
        public int? Week { get; set; }

        public string? Error => Data.Error;

        public FixtureItemViewModel? Match =>
            MatchId is int id ? Data.Matches.FirstOrDefault(m => m.Id == id) : null;

        public AdminTeamItem? Team =>
            TeamId is int id ? Data.Teams.FirstOrDefault(t => t.Id == id) : null;

        // Sayfaya JSON olarak gömülen veri (#daSeed)
        public object Seed => new { teams = Data.Teams, matches = Data.Matches };
    }
}