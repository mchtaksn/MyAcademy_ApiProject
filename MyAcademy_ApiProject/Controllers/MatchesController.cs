using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyAcademy_ApiProject.Context;
using MyAcademy_ApiProject.Dtos;
using MyAcademy_ApiProject.Entities;

namespace MyAcademy_ApiProject.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MatchesController : ControllerBase
    {
        private readonly SerieAContext _context;

        public MatchesController(SerieAContext context)
        {
            _context = context;
        }
        // GET /api/matches  (Admin paneli tüm maçları tek seferde çeker)
        [HttpGet]
        public async Task<ActionResult<List<MatchListItemDto>>> GetAll()
        {
            var matches = await _context.Matches
                .Include(m => m.HomeTeam)
                .Include(m => m.AwayTeam)
                .OrderBy(m => m.Week)
                .ThenBy(m => m.MatchDate)
                .Select(m => new MatchListItemDto
                {
                    Id = m.Id,
                    Week = m.Week,
                    MatchDate = m.MatchDate,
                    Stadium = m.Stadium,
                    Status = m.Status.ToString(),
                    HomeTeamId = m.HomeTeamId,
                    HomeTeamName = m.HomeTeam!.Name,
                    HomeTeamLogo = m.HomeTeam.LogoUrl,
                    AwayTeamId = m.AwayTeamId,
                    AwayTeamName = m.AwayTeam!.Name,
                    AwayTeamLogo = m.AwayTeam.LogoUrl,
                    HomeScore = m.HomeScore,
                    AwayScore = m.AwayScore
                })
                .ToListAsync();

            return Ok(matches);
        }

        // GET /api/matches/week/3
        [HttpGet("week/{week}")]
        public async Task<ActionResult<List<MatchListItemDto>>> GetByWeek(int week)
        {
            var matches = await _context.Matches
                .Include(m => m.HomeTeam)
                .Include(m => m.AwayTeam)
                .Where(m => m.Week == week)
                .OrderBy(m => m.MatchDate)
                .Select(m => new MatchListItemDto
                {
                    Id = m.Id,
                    Week = m.Week,
                    MatchDate = m.MatchDate,
                    Stadium = m.Stadium,
                    Status = m.Status.ToString(),
                    HomeTeamId = m.HomeTeamId,
                    HomeTeamName = m.HomeTeam!.Name,
                    HomeTeamLogo = m.HomeTeam.LogoUrl,
                    AwayTeamId = m.AwayTeamId,
                    AwayTeamName = m.AwayTeam!.Name,
                    AwayTeamLogo = m.AwayTeam.LogoUrl,
                    HomeScore = m.HomeScore,
                    AwayScore = m.AwayScore
                })
                .ToListAsync();

            return Ok(matches);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<MatchDetailDto>> GetById(int id)
        {
            var match = await _context.Matches
                .Include(m => m.HomeTeam)
                .Include(m => m.AwayTeam)
                .Include(m => m.Goals)
                .Include(m => m.Cards)
                .Include(m => m.Substitutions)
                .FirstOrDefaultAsync(m => m.Id == id);

            if (match is null)
                return NotFound(new { message = $"{id} numaralı maç bulunamadı." });

            var dto = new MatchDetailDto
            {
                Id = match.Id,
                Week = match.Week,
                MatchDate = match.MatchDate,
                Stadium = match.Stadium,
                Status = match.Status.ToString(),
                HomeTeamId = match.HomeTeamId,
                HomeTeamName = match.HomeTeam!.Name,
                HomeTeamLogo = match.HomeTeam.LogoUrl,
                AwayTeamId = match.AwayTeamId,
                AwayTeamName = match.AwayTeam!.Name,
                AwayTeamLogo = match.AwayTeam.LogoUrl,
                HomeScore = match.HomeScore,
                AwayScore = match.AwayScore,
                Goals = match.Goals.Select(g => new GoalDto
                {
                    TeamId = g.TeamId,
                    PlayerName = g.PlayerName,
                    Minute = g.Minute
                }).OrderBy(g => g.Minute).ToList(),
                Cards = match.Cards.Select(c => new CardDto
                {
                    TeamId = c.TeamId,
                    PlayerName = c.PlayerName,
                    Minute = c.Minute,
                    CardType = c.CardType.ToString()
                }).OrderBy(c => c.Minute).ToList(),
                Substitutions = match.Substitutions.Select(s => new SubstitutionDto
                {
                    TeamId = s.TeamId,
                    PlayerIn = s.PlayerIn,
                    PlayerOut = s.PlayerOut,
                    Minute = s.Minute
                }).OrderBy(s => s.Minute).ToList()
            };

            return Ok(dto);
        }

        [HttpPost]
        public async Task<ActionResult<MatchDetailDto>> Create(MatchUpsertDto dto)
        {
            var validationError = await ValidateMatchRules(dto, excludeMatchId: null);
            if (validationError is not null)
                return BadRequest(new { message = validationError });

            if (!Enum.TryParse<MatchStatus>(dto.Status, true, out var status))
                return BadRequest(new { message = "Geçersiz Status değeri." });

            var match = new Match
            {
                HomeTeamId = dto.HomeTeamId,
                AwayTeamId = dto.AwayTeamId,
                Week = dto.Week,
                MatchDate = dto.MatchDate,
                HomeScore = dto.HomeScore,
                AwayScore = dto.AwayScore,
                Status = status,
                Stadium = dto.Stadium
            };

            _context.Matches.Add(match);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = match.Id }, match);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, MatchUpsertDto dto)
        {
            var match = await _context.Matches.FindAsync(id);
            if (match is null)
                return NotFound(new { message = $"{id} numaralı maç bulunamadı." });

            var validationError = await ValidateMatchRules(dto, excludeMatchId: id);
            if (validationError is not null)
                return BadRequest(new { message = validationError });

            if (!Enum.TryParse<MatchStatus>(dto.Status, true, out var status))
                return BadRequest(new { message = "Geçersiz Status değeri." });

            match.HomeTeamId = dto.HomeTeamId;
            match.AwayTeamId = dto.AwayTeamId;
            match.Week = dto.Week;
            match.MatchDate = dto.MatchDate;
            match.HomeScore = dto.HomeScore;
            match.AwayScore = dto.AwayScore;
            match.Status = status;
            match.Stadium = dto.Stadium;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var match = await _context.Matches.FindAsync(id);
            if (match is null)
                return NotFound(new { message = $"{id} numaralı maç bulunamadı." });

            _context.Matches.Remove(match);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private async Task<string?> ValidateMatchRules(MatchUpsertDto dto, int? excludeMatchId)
        {
            if (dto.HomeTeamId == dto.AwayTeamId)
                return "Ev sahibi ve deplasman takımı aynı olamaz.";

            var homeTeamExists = await _context.Teams.AnyAsync(t => t.Id == dto.HomeTeamId);
            var awayTeamExists = await _context.Teams.AnyAsync(t => t.Id == dto.AwayTeamId);
            if (!homeTeamExists || !awayTeamExists)
                return "Geçersiz takım Id'si.";

            bool teamAlreadyPlayingThisWeek = await _context.Matches
                .Where(m => m.Week == dto.Week && m.Id != excludeMatchId)
                .AnyAsync(m => m.HomeTeamId == dto.HomeTeamId || m.AwayTeamId == dto.HomeTeamId
                            || m.HomeTeamId == dto.AwayTeamId || m.AwayTeamId == dto.AwayTeamId);

            if (teamAlreadyPlayingThisWeek)
                return "Seçilen takımlardan biri bu hafta zaten başka bir maçta yer alıyor.";

            return null;
        }
    }
}