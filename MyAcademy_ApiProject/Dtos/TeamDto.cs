namespace MyAcademy_ApiProject.Dtos
{
    public class TeamDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? LogoUrl { get; set; }
        public string City { get; set; } = string.Empty;
        public string Stadium { get; set; } = string.Empty;
    }
}
