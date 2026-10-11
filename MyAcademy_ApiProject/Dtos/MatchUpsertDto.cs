namespace MyAcademy_ApiProject.Dtos
{
    public class MatchUpsertDto
    {
        public int HomeTeamId { get; set; }
        public int AwayTeamId { get; set; }
        public int Week { get; set; }
        public DateTime MatchDate { get; set; }
        public int? HomeScore { get; set; }
        public int? AwayScore { get; set; }
        public string Status { get; set; } = "Planlandi";
        public string Stadium { get; set; } = string.Empty;
    }
}