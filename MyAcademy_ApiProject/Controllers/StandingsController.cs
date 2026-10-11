using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyAcademy_ApiProject.Context;
using MyAcademy_ApiProject.Dtos;
using MyAcademy_ApiProject.Entities;

namespace MyAcademy_ApiProject.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StandingsController : ControllerBase
    {
        private readonly SerieAContext _context;

        public StandingsController(SerieAContext context)
        {
            _context = context;
        }

        // GET /api/standings
        [HttpGet]
        public async Task<ActionResult<List<StandingDto>>> GetStandings()
        {
            // Yalnızca Tamamlandı durumundaki maçlar puan durumuna dahil edilir
            var completedMatches = await _context.Matches
                .Where(m => m.Status == MatchStatus.Tamamlandi
                            && m.HomeScore.HasValue
                            && m.AwayScore.HasValue)
                .ToListAsync();

            var teams = await _context.Teams.ToListAsync();

            var standings = teams.Select(team =>
            {
                var homeMatches = completedMatches.Where(m => m.HomeTeamId == team.Id);
                var awayMatches = completedMatches.Where(m => m.AwayTeamId == team.Id);

                int played = homeMatches.Count() + awayMatches.Count();

                int won = homeMatches.Count(m => m.HomeScore > m.AwayScore)
                        + awayMatches.Count(m => m.AwayScore > m.HomeScore);

                int drawn = homeMatches.Count(m => m.HomeScore == m.AwayScore)
                          + awayMatches.Count(m => m.AwayScore == m.HomeScore);

                int lost = played - won - drawn;

                int goalsFor = homeMatches.Sum(m => m.HomeScore ?? 0)
                              + awayMatches.Sum(m => m.AwayScore ?? 0);

                int goalsAgainst = homeMatches.Sum(m => m.AwayScore ?? 0)
                                  + awayMatches.Sum(m => m.HomeScore ?? 0);

                return new StandingDto
                {
                    TeamId = team.Id,
                    TeamName = team.Name,
                    LogoUrl = team.LogoUrl,
                    Played = played,
                    Won = won,
                    Drawn = drawn,
                    Lost = lost,
                    GoalsFor = goalsFor,
                    GoalsAgainst = goalsAgainst,
                    GoalDifference = goalsFor - goalsAgainst,
                    Points = won * 3 + drawn * 1
                };
            })
            .OrderByDescending(s => s.Points)
            .ThenByDescending(s => s.GoalDifference)
            .ThenByDescending(s => s.GoalsFor)
            .ToList();

            return Ok(standings);
        }
    }
}