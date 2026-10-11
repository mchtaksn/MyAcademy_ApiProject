namespace MyAcademy_ApiProject.Dtos
{
    public class MatchDetailDto
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

        public List<GoalDto> Goals { get; set; } = new();
        public List<CardDto> Cards { get; set; } = new();
        public List<SubstitutionDto> Substitutions { get; set; } = new();
    }

    public class GoalDto
    {
        public int TeamId { get; set; }
        public string PlayerName { get; set; } = string.Empty;
        public int Minute { get; set; }
    }

    public class CardDto
    {
        public int TeamId { get; set; }
        public string PlayerName { get; set; } = string.Empty;
        public int Minute { get; set; }
        public string CardType { get; set; } = string.Empty;
    }

    public class SubstitutionDto
    {
        public int TeamId { get; set; }
        public string PlayerIn { get; set; } = string.Empty;
        public string PlayerOut { get; set; } = string.Empty;
        public int Minute { get; set; }
    }
}