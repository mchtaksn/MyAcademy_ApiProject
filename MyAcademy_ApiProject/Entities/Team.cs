namespace MyAcademy_ApiProject.Entities
{
    public class Team
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? LogoUrl { get; set; }
        public string City { get; set; } = string.Empty;
        public string Stadium { get; set; } = string.Empty;
    }
}