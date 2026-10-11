namespace MyAcademy_ApiProject.Entities
{
    public enum CardType
    {
        Sari,
        Kirmizi
    }

    public class MatchCard
    {
        public int Id { get; set; }

        public int MatchId { get; set; }
        public Match? Match { get; set; }

        public int TeamId { get; set; }
        public Team? Team { get; set; }

        public string PlayerName { get; set; } = string.Empty;
        public int Minute { get; set; }
        public CardType CardType { get; set; }
    }
}