namespace MyAcademy_ApiProject.Dtos
{
    public class TeamUpsertDto
    {
        public string Name { get; set; } = string.Empty;
        public string? LogoUrl { get; set; }
        public string City { get; set; } = string.Empty;
        public string Stadium { get; set; } = string.Empty;
    }
}
