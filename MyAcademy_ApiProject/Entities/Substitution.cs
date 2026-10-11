namespace MyAcademy_ApiProject.Entities
{
    public class Substitution
    {
        public int Id { get; set; }

        public int MatchId { get; set; }
        public Match? Match { get; set; }

        public int TeamId { get; set; }
        public Team? Team { get; set; }

        public string PlayerIn { get; set; } = string.Empty;
        public string PlayerOut { get; set; } = string.Empty;
        public int Minute { get; set; }
    }
}