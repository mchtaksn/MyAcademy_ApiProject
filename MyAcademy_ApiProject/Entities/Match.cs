namespace MyAcademy_ApiProject.Entities
{
    public class Match
    {
        public int Id { get; set; }

        public int HomeTeamId { get; set; }
        public Team? HomeTeam { get; set; }

        public int AwayTeamId { get; set; }
        public Team? AwayTeam { get; set; }

        public int Week { get; set; }
        public DateTime MatchDate { get; set; }

        public int? HomeScore { get; set; }
        public int? AwayScore { get; set; }

        public MatchStatus Status { get; set; } = MatchStatus.Planlandi;
        public string Stadium { get; set; } = string.Empty;

        public ICollection<MatchGoal> Goals { get; set; } = new List<MatchGoal>();
        public ICollection<MatchCard> Cards { get; set; } = new List<MatchCard>();
        public ICollection<Substitution> Substitutions { get; set; } = new List<Substitution>();
    }
}