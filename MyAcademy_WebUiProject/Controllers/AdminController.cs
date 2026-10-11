using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using MyAcademy_WebUiProject.Hubs;
using MyAcademy_WebUiProject.Models.Admin;
using MyAcademy_WebUiProject.Services;

namespace MyAcademy_WebUiProject.Controllers
{

    public class AdminController : Controller
    {
        private readonly AdminApiService _api;
        private readonly IHubContext<MatchHub> _hub;

        public AdminController(AdminApiService api, IHubContext<MatchHub> hub)
        {
            _api = api;
            _hub = hub;
        }

        // ===================== Sayfalar =====================

        public async Task<IActionResult> Index()
        {
            var snapshot = await _api.GetSnapshotAsync();
            var model = AdminDashboardViewModel.Build(snapshot, DateTime.Now);
            return View(model);
        }

        public async Task<IActionResult> Teams()
        {
            var snapshot = await _api.GetSnapshotAsync();
            return View(snapshot);
        }

        public async Task<IActionResult> Matches()
        {
            var snapshot = await _api.GetSnapshotAsync();
            return View(snapshot);
        }

        // Lig sayfaları: hepsi aynı veri paketini alır, hesaplar tarayıcıda yapılır
        public async Task<IActionResult> Live()
        {
            var snapshot = await _api.GetSnapshotAsync();
            return View(snapshot);
        }

        public async Task<IActionResult> Standings()
        {
            var snapshot = await _api.GetSnapshotAsync();
            return View(snapshot);
        }

        public async Task<IActionResult> Calendar()
        {
            var snapshot = await _api.GetSnapshotAsync();
            return View(snapshot);
        }

        public async Task<IActionResult> Stats()
        {
            var snapshot = await _api.GetSnapshotAsync();
            return View(snapshot);
        }

        // Sayfaların yenileme ve hızlı arama (Ctrl+K) için kullandığı veri
        [HttpGet]
        public async Task<IActionResult> Data()
        {
            var snapshot = await _api.GetSnapshotAsync();
            return Json(new { teams = snapshot.Teams, matches = snapshot.Matches, error = snapshot.Error });
        }

        // ===================== Takım işlemleri =====================

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> SaveTeam([FromBody] TeamFormModel? form)
        {
            if (form is null)
                return Json(ApiResult.Fail("Form verisi okunamadı."));
            if (!ModelState.IsValid)
                return Json(ApiResult.Invalid(ModelState));

            var isEdit = form.Id is > 0;
            var result = isEdit
                ? await _api.UpdateTeamAsync(form.Id!.Value, form)
                : await _api.CreateTeamAsync(form);

            if (result.Ok)
            {
                result.Id ??= form.Id;
                result.Message = isEdit ? $"{form.Name.Trim()} güncellendi." : $"{form.Name.Trim()} lige eklendi.";
            }
            return Json(result);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteTeam(int id)
        {
            var result = await _api.DeleteTeamAsync(id);
            if (result.Ok) result.Message = "Takım silindi.";
            return Json(result);
        }


        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> SaveMatch([FromBody] MatchFormModel? form)
        {
            if (form is null)
                return Json(ApiResult.Fail("Form verisi okunamadı."));
            if (!ModelState.IsValid)
                return Json(ApiResult.Invalid(ModelState));

            var stadium = form.Stadium?.Trim() ?? string.Empty;
            if (stadium.Length == 0)
            {
                var snapshot = await _api.GetSnapshotAsync();
                stadium = snapshot.Teams.FirstOrDefault(t => t.Id == form.HomeTeamId)?.Stadium ?? string.Empty;
            }

            var isEdit = form.Id is > 0;
            var result = isEdit
                ? await _api.UpdateMatchAsync(form.Id!.Value, form, stadium)
                : await _api.CreateMatchAsync(form, stadium);

            if (result.Ok)
            {
                result.Id ??= form.Id;
                result.Message = isEdit ? "Maç güncellendi." : "Maç fikstüre eklendi.";

                if (result.Ok)
                {
                    await _hub.Clients.All.SendAsync("MatchUpdated", new
                    {
                        id = result.Id,
                        week = form.Week,
                        status = form.Status,
                        homeScore = form.HomeScore,
                        awayScore = form.AwayScore
                    });
                }
            }
            return Json(result);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteMatch(int id)
        {
            var result = await _api.DeleteMatchAsync(id);
            if (result.Ok) result.Message = "Maç silindi.";
            return Json(result);
        }
    }
}