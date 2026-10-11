using Microsoft.AspNetCore.Mvc;
using MyAcademy_WebUiProject.Models.Site;
using MyAcademy_WebUiProject.Services;

namespace MyAcademy_WebUiProject.Controllers
{

    public class FixturesController : Controller
    {
        private readonly AdminApiService _api;

        public FixturesController(AdminApiService api)
        {
            _api = api;
        }

        public async Task<IActionResult> Index(int? week, int? team)
        {
            var model = new SitePageModel
            {
                Data = await _api.GetSnapshotAsync(),
                Week = week is > 0 ? week : null,
                TeamId = team is > 0 ? team : null
            };
            return View(model);
        }
    }
}