namespace MyAcademy_WebUiProject.Models
{
    public class MatchDetailViewModel
    {
        public int Id { get; set; }
        public int Week { get; set; }
        public DateTime MatchDate { get; set; }
        public string Stadium { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;

        public int HomeTeamId { get; set; }
        public string HomeTeamName { get; set; } = string.Empty;
        public string? HomeTeamLogo { get; set; }

        public int AwayTeamId { get; set; }
        public string AwayTeamName { get; set; } = string.Empty;
        public string? AwayTeamLogo { get; set; }

        public int? HomeScore { get; set; }
        public int? AwayScore { get; set; }

        public List<GoalItemViewModel> Goals { get; set; } = new();
        public List<CardItemViewModel> Cards { get; set; } = new();
        public List<SubstitutionItemViewModel> Substitutions { get; set; } = new();
    }

    public class GoalItemViewModel
    {
        public int TeamId { get; set; }
        public string PlayerName { get; set; } = string.Empty;
        public int Minute { get; set; }
    }

    public class CardItemViewModel
    {
        public int TeamId { get; set; }
        public string PlayerName { get; set; } = string.Empty;
        public int Minute { get; set; }
        public string CardType { get; set; } = string.Empty;
    }

    public class SubstitutionItemViewModel
    {
        public int TeamId { get; set; }
        public string PlayerIn { get; set; } = string.Empty;
        public string PlayerOut { get; set; } = string.Empty;
        public int Minute { get; set; }
    }
}