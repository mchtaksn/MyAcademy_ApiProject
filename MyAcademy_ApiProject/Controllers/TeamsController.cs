using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyAcademy_ApiProject.Context;
using MyAcademy_ApiProject.Dtos;
using MyAcademy_ApiProject.Entities;

namespace MyAcademy_ApiProject.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TeamsController : ControllerBase
    {
        private readonly SerieAContext _context;

        public TeamsController(SerieAContext context)
        {
            _context = context;
        }

        // GET /api/teams
        [HttpGet]
        public async Task<ActionResult<List<TeamDto>>> GetAll()
        {
            var teams = await _context.Teams
                .OrderBy(t => t.Name)
                .Select(t => new TeamDto
                {
                    Id = t.Id,
                    Name = t.Name,
                    LogoUrl = t.LogoUrl,
                    City = t.City,
                    Stadium = t.Stadium
                })
                .ToListAsync();

            return Ok(teams);
        }

        // GET /api/teams/5
        [HttpGet("{id}")]
        public async Task<ActionResult<TeamDto>> GetById(int id)
        {
            var team = await _context.Teams.FindAsync(id);
            if (team is null)
                return NotFound(new { message = $"{id} numaralı takım bulunamadı." });

            return Ok(new TeamDto
            {
                Id = team.Id,
                Name = team.Name,
                LogoUrl = team.LogoUrl,
                City = team.City,
                Stadium = team.Stadium
            });
        }

        // POST /api/teams
        [HttpPost]
        public async Task<ActionResult<TeamDto>> Create(TeamUpsertDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { message = "Takım adı boş olamaz." });

            var team = new Team
            {
                Name = dto.Name,
                LogoUrl = dto.LogoUrl,
                City = dto.City,
                Stadium = dto.Stadium
            };

            _context.Teams.Add(team);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = team.Id }, team);
        }

        // PUT /api/teams/5
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, TeamUpsertDto dto)
        {
            var team = await _context.Teams.FindAsync(id);
            if (team is null)
                return NotFound(new { message = $"{id} numaralı takım bulunamadı." });

            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { message = "Takım adı boş olamaz." });

            team.Name = dto.Name;
            team.LogoUrl = dto.LogoUrl;
            team.City = dto.City;
            team.Stadium = dto.Stadium;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // DELETE /api/teams/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var team = await _context.Teams.FindAsync(id);
            if (team is null)
                return NotFound(new { message = $"{id} numaralı takım bulunamadı." });

            bool hasMatches = await _context.Matches
                .AnyAsync(m => m.HomeTeamId == id || m.AwayTeamId == id);

            if (hasMatches)
                return Conflict(new { message = "Bu takımın oynadığı maç kayıtları var, önce onları silmelisiniz." });

            _context.Teams.Remove(team);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}