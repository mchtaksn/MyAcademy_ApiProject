using Microsoft.AspNetCore.Mvc;
using MyAcademy_WebUiProject.Models.Site;
using MyAcademy_WebUiProject.Services;

namespace MyAcademy_WebUiProject.Controllers
{
    public class StandingsController : Controller
    {
        private readonly AdminApiService _api;

        public StandingsController(AdminApiService api)
        {
            _api = api;
        }

        public async Task<IActionResult> Index()
        {
            var model = new SitePageModel { Data = await _api.GetSnapshotAsync() };
            return View(model);
        }
    }
}