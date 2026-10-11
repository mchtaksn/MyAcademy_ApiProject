using Microsoft.AspNetCore.Mvc;
using MyAcademy_WebUiProject.Models.Site;
using MyAcademy_WebUiProject.Services;

namespace MyAcademy_WebUiProject.Controllers
{
    public class MatchController : Controller
    {
        private readonly AdminApiService _api;

        public MatchController(AdminApiService api)
        {
            _api = api;
        }

        public async Task<IActionResult> Detail(int id)
        {
            var model = new SitePageModel { Data = await _api.GetSnapshotAsync(), MatchId = id };

            if (model.Error == null && model.Match == null)
                Response.StatusCode = StatusCodes.Status404NotFound;

            return View(model);
        }

        public IActionResult Index(int? id)
        {
            return id is > 0 ? RedirectToAction(nameof(Detail), new { id }) : RedirectToAction("Index", "Fixtures");
        }
    }
}