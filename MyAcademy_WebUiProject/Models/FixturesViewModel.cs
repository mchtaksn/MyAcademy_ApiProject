namespace MyAcademy_WebUiProject.Models
{
    public class FixturesViewModel
    {
        public int SelectedWeek { get; set; }
        public List<int> AvailableWeeks { get; set; } = new();
        public List<FixtureItemViewModel> Matches { get; set; } = new();
    }
}