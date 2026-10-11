using Microsoft.EntityFrameworkCore;
using MyAcademy_ApiProject.Entities;

namespace MyAcademy_ApiProject.Context
{
    public class SerieAContext : DbContext
    {
        public SerieAContext(DbContextOptions<SerieAContext> options) : base(options)
        {
        }

        public DbSet<Team> Teams { get; set; }
        public DbSet<Match> Matches { get; set; }
        public DbSet<MatchGoal> MatchGoals { get; set; }
        public DbSet<MatchCard> MatchCards { get; set; }
        public DbSet<Substitution> Substitutions { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {

            modelBuilder.Entity<Match>()
                .HasOne(m => m.HomeTeam)
                .WithMany()
                .HasForeignKey(m => m.HomeTeamId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Match>()
                .HasOne(m => m.AwayTeam)
                .WithMany()
                .HasForeignKey(m => m.AwayTeamId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<MatchGoal>()
                .HasOne(g => g.Match)
                .WithMany(m => m.Goals)
                .HasForeignKey(g => g.MatchId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<MatchCard>()
                .HasOne(c => c.Match)
                .WithMany(m => m.Cards)
                .HasForeignKey(c => c.MatchId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Substitution>()
                .HasOne(s => s.Match)
                .WithMany(m => m.Substitutions)
                .HasForeignKey(s => s.MatchId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}