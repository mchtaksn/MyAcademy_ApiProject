using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace MyAcademy_WebUiProject.Models.Admin
{
    // =====================================================================
    // Maç durumları: API'deki MatchStatus enum isimleriyle birebir aynı olmalı
    // =====================================================================
    public static class MatchStatuses
    {
        public const string Planned = "Planlandi";
        public const string Live = "Oynaniyor";
        public const string Finished = "Tamamlandi";
        public const string Postponed = "Ertelendi";

        public static readonly string[] All = { Planned, Live, Finished, Postponed };

        public static string Label(string? status) => status switch
        {
            Live => "Canlı",
            Finished => "Tamamlandı",
            Postponed => "Ertelendi",
            _ => "Planlandı"
        };

        // Skor girilmesi gereken durumlar
        public static bool HasScore(string? status) => status == Live || status == Finished;
    }

    // =====================================================================
    // API'den gelen takım (TeamDto) + WebUI'da hesaplanan maç sayısı
    // =====================================================================
    public class AdminTeamItem
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? LogoUrl { get; set; }
        public string City { get; set; } = string.Empty;
        public string Stadium { get; set; } = string.Empty;
        public int MatchCount { get; set; }
    }

    // =====================================================================
    // Admin sayfalarının ortak veri paketi (takımlar + tüm maçlar)
    // =====================================================================
    public class AdminSnapshot
    {
        public List<AdminTeamItem> Teams { get; set; } = new();
        public List<FixtureItemViewModel> Matches { get; set; } = new();
        public string? Error { get; set; }
    }

    // =====================================================================
    // Takım formu (ekle + düzenle)
    // =====================================================================
    public class TeamFormModel
    {
        public int? Id { get; set; }

        [Required(ErrorMessage = "Takım adını yazın.")]
        [StringLength(40, MinimumLength = 2, ErrorMessage = "Takım adı 2-40 karakter olmalı.")]
        public string Name { get; set; } = string.Empty;

        [Required(ErrorMessage = "Şehri yazın.")]
        [StringLength(40, ErrorMessage = "Şehir en fazla 40 karakter olabilir.")]
        public string City { get; set; } = string.Empty;

        [Required(ErrorMessage = "Stadyumu yazın.")]
        [StringLength(80, ErrorMessage = "Stadyum adı en fazla 80 karakter olabilir.")]
        public string Stadium { get; set; } = string.Empty;

        [Url(ErrorMessage = "Logo adresi http:// veya https:// ile başlayan geçerli bir adres olmalı.")]
        [StringLength(500, ErrorMessage = "Logo adresi çok uzun.")]
        public string? LogoUrl { get; set; }
    }

    // =====================================================================
    // Maç formu (ekle + düzenle)
    // =====================================================================
    public class MatchFormModel : IValidatableObject
    {
        public int? Id { get; set; }

        [Range(1, int.MaxValue, ErrorMessage = "Ev sahibi takımı seçin.")]
        public int HomeTeamId { get; set; }

        [Range(1, int.MaxValue, ErrorMessage = "Deplasman takımını seçin.")]
        public int AwayTeamId { get; set; }

        [Range(1, 38, ErrorMessage = "Hafta 1 ile 38 arasında olmalı.")]
        public int Week { get; set; }

        [Required(ErrorMessage = "Maç tarihini ve saatini seçin.")]
        public DateTime? MatchDate { get; set; }

        [Range(0, 99, ErrorMessage = "Skor 0 ile 99 arasında olmalı.")]
        public int? HomeScore { get; set; }

        [Range(0, 99, ErrorMessage = "Skor 0 ile 99 arasında olmalı.")]
        public int? AwayScore { get; set; }

        [Required(ErrorMessage = "Maç durumunu seçin.")]
        public string Status { get; set; } = MatchStatuses.Planned;

        [StringLength(80, ErrorMessage = "Stadyum adı en fazla 80 karakter olabilir.")]
        public string? Stadium { get; set; }

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            if (HomeTeamId > 0 && HomeTeamId == AwayTeamId)
                yield return new ValidationResult("Bir takım kendisiyle oynayamaz.", new[] { nameof(AwayTeamId) });

            if (!MatchStatuses.All.Contains(Status))
                yield return new ValidationResult("Geçersiz maç durumu.", new[] { nameof(Status) });

            if (MatchStatuses.HasScore(Status))
            {
                if (HomeScore is null)
                    yield return new ValidationResult("Ev sahibi skorunu girin.", new[] { nameof(HomeScore) });
                if (AwayScore is null)
                    yield return new ValidationResult("Deplasman skorunu girin.", new[] { nameof(AwayScore) });
            }
        }
    }

    // =====================================================================
    // Admin JSON uç noktalarının ortak cevabı
    // =====================================================================
    public class ApiResult
    {
        public bool Ok { get; set; }
        public string? Message { get; set; }
        public int? Id { get; set; }
        public int? StatusCode { get; set; }
        public Dictionary<string, string> Errors { get; set; } = new();

        public static ApiResult Success(int? id = null) => new() { Ok = true, Id = id };

        public static ApiResult Fail(string message, int? statusCode = null) =>
            new() { Ok = false, Message = message, StatusCode = statusCode };

        // ModelState hatalarını { "homeTeamId": "Ev sahibi takımı seçin." } biçimine çevirir
        public static ApiResult Invalid(ModelStateDictionary modelState)
        {
            var result = new ApiResult { Ok = false, Message = "İşaretli alanları kontrol edin." };
            foreach (var entry in modelState)
            {
                var error = entry.Value.Errors.FirstOrDefault();
                if (error is null) continue;

                var key = entry.Key.Replace("$.", string.Empty);
                if (key.Contains('.')) key = key[(key.LastIndexOf('.') + 1)..];
                if (key.Length > 0) key = char.ToLowerInvariant(key[0]) + key[1..];

                var message = string.IsNullOrWhiteSpace(error.ErrorMessage) ? "Bu alanın değeri geçersiz." : error.ErrorMessage;
                result.Errors.TryAdd(key.Length > 0 ? key : "form", message);
            }
            return result;
        }
    }
}