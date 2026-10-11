using System.Net.Http.Json;
using System.Text.Json;
using MyAcademy_WebUiProject.Models;
using MyAcademy_WebUiProject.Models.Admin;

namespace MyAcademy_WebUiProject.Services
{
    // Admin panelinin API ile konuştuğu tek yer.
    // Controller'lar HttpClient ile uğraşmaz, bu servisin metotlarını çağırır.
    public class AdminApiService
    {
        private static readonly JsonSerializerOptions ReadOptions = new() { PropertyNameCaseInsensitive = true };
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<AdminApiService> _logger;

        public AdminApiService(IHttpClientFactory httpClientFactory, ILogger<AdminApiService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        private HttpClient Client => _httpClientFactory.CreateClient("SerieAApi");

        // -------------------------------------------------------------
        // Okuma: takımlar + maçlar tek pakette, takım başına maç sayısı hesaplanmış
        // -------------------------------------------------------------
        public async Task<AdminSnapshot> GetSnapshotAsync()
        {
            var snapshot = new AdminSnapshot();
            try
            {
                var teamsTask = GetListAsync<AdminTeamItem>("api/teams");
                var matchesTask = GetListAsync<FixtureItemViewModel>("api/matches");
                await Task.WhenAll(teamsTask, matchesTask);

                snapshot.Teams = teamsTask.Result;
                snapshot.Matches = matchesTask.Result
                    .OrderBy(m => m.Week)
                    .ThenBy(m => m.MatchDate)
                    .ToList();

                var counts = snapshot.Matches
                    .SelectMany(m => new[] { m.HomeTeamId, m.AwayTeamId })
                    .GroupBy(id => id)
                    .ToDictionary(g => g.Key, g => g.Count());

                foreach (var team in snapshot.Teams)
                    team.MatchCount = counts.TryGetValue(team.Id, out var c) ? c : 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin verileri API'den alınamadı.");
                snapshot.Error = "API'den veri alınamadı. MyAcademy_ApiProject'in çalıştığından ve "
                               + "GET api/matches uç noktasının eklendiğinden emin olun.";
            }
            return snapshot;
        }

        private async Task<List<T>> GetListAsync<T>(string url)
        {
            using var response = await Client.GetAsync(url);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<List<T>>(json, ReadOptions) ?? new List<T>();
        }

        // -------------------------------------------------------------
        // Takım yazma işlemleri
        // -------------------------------------------------------------
        public Task<ApiResult> CreateTeamAsync(TeamFormModel form) =>
            SendAsync(HttpMethod.Post, "api/teams", ToTeamBody(form));

        public Task<ApiResult> UpdateTeamAsync(int id, TeamFormModel form) =>
            SendAsync(HttpMethod.Put, $"api/teams/{id}", ToTeamBody(form));

        public Task<ApiResult> DeleteTeamAsync(int id) =>
            SendAsync(HttpMethod.Delete, $"api/teams/{id}", null);

        private static object ToTeamBody(TeamFormModel form) => new
        {
            name = form.Name.Trim(),
            logoUrl = string.IsNullOrWhiteSpace(form.LogoUrl) ? null : form.LogoUrl.Trim(),
            city = form.City.Trim(),
            stadium = form.Stadium.Trim()
        };

        // -------------------------------------------------------------
        // Maç yazma işlemleri
        // -------------------------------------------------------------
        public Task<ApiResult> CreateMatchAsync(MatchFormModel form, string stadium) =>
            SendAsync(HttpMethod.Post, "api/matches", ToMatchBody(form, stadium));

        public Task<ApiResult> UpdateMatchAsync(int id, MatchFormModel form, string stadium) =>
            SendAsync(HttpMethod.Put, $"api/matches/{id}", ToMatchBody(form, stadium));

        public Task<ApiResult> DeleteMatchAsync(int id) =>
            SendAsync(HttpMethod.Delete, $"api/matches/{id}", null);

        private static object ToMatchBody(MatchFormModel form, string stadium)
        {
            var scored = MatchStatuses.HasScore(form.Status);
            return new
            {
                homeTeamId = form.HomeTeamId,
                awayTeamId = form.AwayTeamId,
                week = form.Week,
                matchDate = form.MatchDate!.Value,
                // Planlandı / Ertelendi maçlarda skor tutulmaz
                homeScore = scored ? form.HomeScore : null,
                awayScore = scored ? form.AwayScore : null,
                status = form.Status,
                stadium
            };
        }

        // -------------------------------------------------------------
        // Ortak gönderici: API'nin { message } hatalarını kullanıcıya taşır
        // -------------------------------------------------------------
        private async Task<ApiResult> SendAsync(HttpMethod method, string url, object? body)
        {
            try
            {
                using var request = new HttpRequestMessage(method, url);
                if (body is not null)
                    request.Content = JsonContent.Create(body);

                using var response = await Client.SendAsync(request);
                var text = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                    return ApiResult.Success(ReadId(text));

                var message = ReadErrorMessage(text)
                              ?? $"API isteği başarısız oldu (HTTP {(int)response.StatusCode}).";
                return ApiResult.Fail(message, (int)response.StatusCode);
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "API isteği gönderilemedi: {Method} {Url}", method, url);
                return ApiResult.Fail("API'ye ulaşılamadı. API projesinin çalıştığından emin olun.");
            }
        }

        private static int? ReadId(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            try
            {
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.ValueKind != JsonValueKind.Object) return null;
                foreach (var prop in doc.RootElement.EnumerateObject())
                {
                    if (prop.Name.Equals("id", StringComparison.OrdinalIgnoreCase) && prop.Value.TryGetInt32(out var id))
                        return id;
                }
            }
            catch (JsonException) { }
            return null;
        }

        private static string? ReadErrorMessage(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                if (root.ValueKind != JsonValueKind.Object) return null;

                foreach (var prop in root.EnumerateObject())
                {
                    // Bizim API'nin döndürdüğü { message = "..." }
                    if (prop.Name.Equals("message", StringComparison.OrdinalIgnoreCase) && prop.Value.ValueKind == JsonValueKind.String)
                        return prop.Value.GetString();

                    // [ApiController]'ın otomatik doğrulama cevabı { errors: { Alan: ["..."] } }
                    if (prop.Name.Equals("errors", StringComparison.OrdinalIgnoreCase) && prop.Value.ValueKind == JsonValueKind.Object)
                    {
                        foreach (var field in prop.Value.EnumerateObject())
                        {
                            if (field.Value.ValueKind == JsonValueKind.Array && field.Value.GetArrayLength() > 0)
                                return field.Value[0].GetString();
                        }
                    }
                }
            }
            catch (JsonException) { }
            return null;
        }
    }
}