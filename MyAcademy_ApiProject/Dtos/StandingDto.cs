namespace MyAcademy_ApiProject.Dtos
{
    public class StandingDto
    {
        public int TeamId { get; set; }
        public string TeamName { get; set; } = string.Empty;
        public string? LogoUrl { get; set; }
        public int Played { get; set; }
        public int Won { get; set; }
        public int Drawn { get; set; }
        public int Lost { get; set; }
        public int GoalsFor { get; set; }
        public int GoalsAgainst { get; set; }
        public int GoalDifference { get; set; }
        public int Points { get; set; }
    }
}