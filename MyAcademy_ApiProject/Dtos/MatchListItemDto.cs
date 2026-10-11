namespace MyAcademy_ApiProject.Dtos
{
    public class MatchListItemDto
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
    }
}