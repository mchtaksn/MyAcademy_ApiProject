using Microsoft.AspNetCore.Mvc;
using MyAcademy_WebUiProject.Models.Site;
using MyAcademy_WebUiProject.Services;

namespace MyAcademy_WebUiProject.Controllers
{

    public class ClubsController : Controller
    {
        private readonly AdminApiService _api;

        public ClubsController(AdminApiService api)
        {
            _api = api;
        }

        public async Task<IActionResult> Index()
        {
            var model = new SitePageModel { Data = await _api.GetSnapshotAsync() };
            return View(model);
        }

        public async Task<IActionResult> Detail(int id)
        {
            var model = new SitePageModel { Data = await _api.GetSnapshotAsync(), TeamId = id };

            if (model.Error == null && model.Team == null)
                Response.StatusCode = StatusCodes.Status404NotFound;

            return View(model);
        }
    }
}