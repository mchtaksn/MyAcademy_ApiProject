using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using MyAcademy_WebUiProject.Models;
using MyAcademy_WebUiProject.Models.Site;
using MyAcademy_WebUiProject.Services;

namespace MyAcademy_WebUiProject.Controllers
{
    public class HomeController : Controller
    {
        private readonly AdminApiService _api;

        public HomeController(AdminApiService api)
        {
            _api = api;
        }

        public async Task<IActionResult> Index()
        {
            var model = new SitePageModel { Data = await _api.GetSnapshotAsync() };
            return View(model);
        }

        [HttpGet]
        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public async Task<IActionResult> Data()
        {
            var snapshot = await _api.GetSnapshotAsync();
            return Json(new { teams = snapshot.Teams, matches = snapshot.Matches, error = snapshot.Error });
        }

        public IActionResult Privacy()
        {
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}