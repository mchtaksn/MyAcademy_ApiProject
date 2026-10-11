using MyAcademy_ApiProject.Context;
using MyAcademy_ApiProject.Entities;

namespace MyAcademy_ApiProject.Seed
{
    public static class DataSeeder
    {
        public static void Initialize(SerieAContext context)
        {
            // Veritabanında zaten veri varsa tekrar ekleme
            if (context.Teams.Any())
                return;

            // ---- 1) Takımlar ----
            var inter = new Team { Name = "Inter", City = "Milano", Stadium = "San Siro", LogoUrl = "https://media.api-sports.io/football/teams/505.png" };
            var milan = new Team { Name = "Milan", City = "Milano", Stadium = "San Siro", LogoUrl = "https://media.api-sports.io/football/teams/489.png" };
            var juventus = new Team { Name = "Juventus", City = "Torino", Stadium = "Allianz Stadium", LogoUrl = "https://media.api-sports.io/football/teams/496.png" };
            var napoli = new Team { Name = "Napoli", City = "Napoli", Stadium = "Diego Armando Maradona", LogoUrl = "https://media.api-sports.io/football/teams/492.png" };
            var roma = new Team { Name = "Roma", City = "Roma", Stadium = "Stadio Olimpico", LogoUrl = "https://media.api-sports.io/football/teams/497.png" };
            var lazio = new Team { Name = "Lazio", City = "Roma", Stadium = "Stadio Olimpico", LogoUrl = "https://media.api-sports.io/football/teams/487.png" };
            var atalanta = new Team { Name = "Atalanta", City = "Bergamo", Stadium = "Gewiss Stadium", LogoUrl = "https://media.api-sports.io/football/teams/499.png" };
            var fiorentina = new Team { Name = "Fiorentina", City = "Firenze", Stadium = "Artemio Franchi", LogoUrl = "https://media.api-sports.io/football/teams/502.png" };
            var bologna = new Team { Name = "Bologna", City = "Bologna", Stadium = "Renato Dall'Ara", LogoUrl = "https://media.api-sports.io/football/teams/500.png" };
            var torino = new Team { Name = "Torino", City = "Torino", Stadium = "Stadio Olimpico Grande Torino", LogoUrl = "https://media.api-sports.io/football/teams/503.png" };
            var udinese = new Team { Name = "Udinese", City = "Udine", Stadium = "Bluenergy Stadium", LogoUrl = "https://media.api-sports.io/football/teams/494.png" };
            var genoa = new Team { Name = "Genoa", City = "Genova", Stadium = "Luigi Ferraris", LogoUrl = "https://media.api-sports.io/football/teams/495.png" };
            var cagliari = new Team { Name = "Cagliari", City = "Cagliari", Stadium = "Unipol Domus", LogoUrl = "https://media.api-sports.io/football/teams/490.png" };
            var verona = new Team { Name = "Verona", City = "Verona", Stadium = "Marcantonio Bentegodi", LogoUrl = "https://media.api-sports.io/football/teams/504.png" };
            var empoli = new Team { Name = "Empoli", City = "Empoli", Stadium = "Carlo Castellani", LogoUrl = "https://media.api-sports.io/football/teams/511.png" };
            var lecce = new Team { Name = "Lecce", City = "Lecce", Stadium = "Via del Mare", LogoUrl = "https://media.api-sports.io/football/teams/867.png" };
            var sassuolo = new Team { Name = "Sassuolo", City = "Sassuolo", Stadium = "Mapei Stadium", LogoUrl = "https://media.api-sports.io/football/teams/488.png" };
            var monza = new Team { Name = "Monza", City = "Monza", Stadium = "U-Power Stadium", LogoUrl = "https://media.api-sports.io/football/teams/1579.png" };
            var venezia = new Team { Name = "Venezia", City = "Venezia", Stadium = "Pier Luigi Penzo", LogoUrl = "https://media.api-sports.io/football/teams/517.png" };
            var parma = new Team { Name = "Parma", City = "Parma", Stadium = "Ennio Tardini", LogoUrl = "https://media.api-sports.io/football/teams/523.png" };

            var teams = new List<Team>
            {
                inter, milan, juventus, napoli, roma, lazio, atalanta, fiorentina,
                bologna, torino, udinese, genoa, cagliari, verona, empoli, lecce,
                sassuolo, monza, venezia, parma
            };

            context.Teams.AddRange(teams);
            context.SaveChanges(); // Id'lerin atanması için

            // ---- 2) Fikstür: 3 hafta, haftada 10 maç (round-robin) ----
            // Hafta 1 ve 2 Tamamlandı (skorlu), hafta 3 Planlandı (henüz oynanmadı)
            var week1Date = new DateTime(2026, 8, 23, 20, 45, 0);
            var week2Date = new DateTime(2026, 8, 30, 20, 45, 0);
            var week3Date = new DateTime(2026, 9, 6, 20, 45, 0);

            var matches = new List<Match>
            {
                // Hafta 1 - Tamamlandı
                NewMatch(inter, parma, 1, week1Date, 3, 1, MatchStatus.Tamamlandi, inter.Stadium),
                NewMatch(milan, venezia, 1, week1Date, 2, 0, MatchStatus.Tamamlandi, milan.Stadium),
                NewMatch(juventus, monza, 1, week1Date, 1, 1, MatchStatus.Tamamlandi, juventus.Stadium),
                NewMatch(napoli, sassuolo, 1, week1Date, 2, 1, MatchStatus.Tamamlandi, napoli.Stadium),
                NewMatch(roma, lecce, 1, week1Date, 1, 0, MatchStatus.Tamamlandi, roma.Stadium),
                NewMatch(lazio, empoli, 1, week1Date, 2, 2, MatchStatus.Tamamlandi, lazio.Stadium),
                NewMatch(atalanta, verona, 1, week1Date, 3, 0, MatchStatus.Tamamlandi, atalanta.Stadium),
                NewMatch(fiorentina, cagliari, 1, week1Date, 1, 1, MatchStatus.Tamamlandi, fiorentina.Stadium),
                NewMatch(bologna, genoa, 1, week1Date, 2, 1, MatchStatus.Tamamlandi, bologna.Stadium),
                NewMatch(torino, udinese, 1, week1Date, 0, 0, MatchStatus.Tamamlandi, torino.Stadium),

                // Hafta 2 - Tamamlandı
                NewMatch(inter, venezia, 2, week2Date, 2, 1, MatchStatus.Tamamlandi, inter.Stadium),
                NewMatch(parma, monza, 2, week2Date, 1, 1, MatchStatus.Tamamlandi, parma.Stadium),
                NewMatch(milan, sassuolo, 2, week2Date, 3, 1, MatchStatus.Tamamlandi, milan.Stadium),
                NewMatch(juventus, lecce, 2, week2Date, 2, 0, MatchStatus.Tamamlandi, juventus.Stadium),
                NewMatch(napoli, empoli, 2, week2Date, 1, 0, MatchStatus.Tamamlandi, napoli.Stadium),
                NewMatch(roma, verona, 2, week2Date, 2, 2, MatchStatus.Tamamlandi, roma.Stadium),
                NewMatch(lazio, cagliari, 2, week2Date, 1, 0, MatchStatus.Tamamlandi, lazio.Stadium),
                NewMatch(atalanta, genoa, 2, week2Date, 2, 1, MatchStatus.Tamamlandi, atalanta.Stadium),
                NewMatch(fiorentina, udinese, 2, week2Date, 0, 1, MatchStatus.Tamamlandi, fiorentina.Stadium),
                NewMatch(bologna, torino, 2, week2Date, 1, 1, MatchStatus.Tamamlandi, bologna.Stadium),

                // Hafta 3 - Planlandı (henüz oynanmadı, skor yok)
                NewMatch(inter, monza, 3, week3Date, null, null, MatchStatus.Planlandi, inter.Stadium),
                NewMatch(venezia, sassuolo, 3, week3Date, null, null, MatchStatus.Planlandi, venezia.Stadium),
                NewMatch(parma, lecce, 3, week3Date, null, null, MatchStatus.Planlandi, parma.Stadium),
                NewMatch(milan, empoli, 3, week3Date, null, null, MatchStatus.Planlandi, milan.Stadium),
                NewMatch(juventus, verona, 3, week3Date, null, null, MatchStatus.Planlandi, juventus.Stadium),
                NewMatch(napoli, cagliari, 3, week3Date, null, null, MatchStatus.Planlandi, napoli.Stadium),
                NewMatch(roma, genoa, 3, week3Date, null, null, MatchStatus.Planlandi, roma.Stadium),
                NewMatch(lazio, udinese, 3, week3Date, null, null, MatchStatus.Planlandi, lazio.Stadium),
                NewMatch(atalanta, torino, 3, week3Date, null, null, MatchStatus.Planlandi, atalanta.Stadium),
                NewMatch(fiorentina, bologna, 3, week3Date, null, null, MatchStatus.Planlandi, fiorentina.Stadium),
            };

            context.Matches.AddRange(matches);
            context.SaveChanges(); // Match Id'lerinin atanması için

            // ---- 3) Detaylı maçlar (en az 3 tane: gol, kart, değişiklik) ----
            // Hafta 1'deki ilk 4 maçı detaylandırıyoruz: Inter-Parma, Milan-Venezia, Atalanta-Verona, + Milan-Sassuolo (hafta 2)
            var interParma = matches[0];
            var milanVenezia = matches[1];
            var atalantaVerona = matches[6];
            var milanSassuolo = matches[12];

            context.MatchGoals.AddRange(
                new MatchGoal { Match = interParma, Team = inter, PlayerName = "Lautaro Martinez", Minute = 12 },
                new MatchGoal { Match = interParma, Team = inter, PlayerName = "Thuram", Minute = 55 },
                new MatchGoal { Match = interParma, Team = parma, PlayerName = "Bonny", Minute = 63 },
                new MatchGoal { Match = interParma, Team = inter, PlayerName = "Calhanoglu", Minute = 78 },

                new MatchGoal { Match = milanVenezia, Team = milan, PlayerName = "Pulisic", Minute = 23 },
                new MatchGoal { Match = milanVenezia, Team = milan, PlayerName = "Leao", Minute = 68 },

                new MatchGoal { Match = atalantaVerona, Team = atalanta, PlayerName = "Retegui", Minute = 15 },
                new MatchGoal { Match = atalantaVerona, Team = atalanta, PlayerName = "Lookman", Minute = 40 },
                new MatchGoal { Match = atalantaVerona, Team = atalanta, PlayerName = "De Ketelaere", Minute = 82 },

                new MatchGoal { Match = milanSassuolo, Team = milan, PlayerName = "Leao", Minute = 10 },
                new MatchGoal { Match = milanSassuolo, Team = milan, PlayerName = "Pulisic", Minute = 33 },
                new MatchGoal { Match = milanSassuolo, Team = sassuolo, PlayerName = "Laurienté", Minute = 55 },
                new MatchGoal { Match = milanSassuolo, Team = milan, PlayerName = "Gimenez", Minute = 77 }
            );

            context.MatchCards.AddRange(
                new MatchCard { Match = interParma, Team = inter, PlayerName = "Bastoni", Minute = 44, CardType = CardType.Sari },
                new MatchCard { Match = interParma, Team = parma, PlayerName = "Balogh", Minute = 70, CardType = CardType.Sari },
                new MatchCard { Match = interParma, Team = parma, PlayerName = "Coulibaly", Minute = 85, CardType = CardType.Kirmizi },

                new MatchCard { Match = milanVenezia, Team = venezia, PlayerName = "Idzes", Minute = 50, CardType = CardType.Sari },

                new MatchCard { Match = atalantaVerona, Team = verona, PlayerName = "Dawidowicz", Minute = 30, CardType = CardType.Sari },

                new MatchCard { Match = milanSassuolo, Team = sassuolo, PlayerName = "Viti", Minute = 60, CardType = CardType.Sari }
            );

            context.Substitutions.AddRange(
                new Substitution { Match = interParma, Team = inter, PlayerIn = "Taremi", PlayerOut = "Arnautovic", Minute = 75 },
                new Substitution { Match = interParma, Team = parma, PlayerIn = "Man", PlayerOut = "Bonny", Minute = 80 },

                new Substitution { Match = milanVenezia, Team = milan, PlayerIn = "Chukwueze", PlayerOut = "Pulisic", Minute = 70 },
                new Substitution { Match = milanVenezia, Team = venezia, PlayerIn = "Yeboah", PlayerOut = "Busio", Minute = 60 },

                new Substitution { Match = atalantaVerona, Team = atalanta, PlayerIn = "Samardzic", PlayerOut = "De Ketelaere", Minute = 85 },

                new Substitution { Match = milanSassuolo, Team = milan, PlayerIn = "Chukwueze", PlayerOut = "Leao", Minute = 80 }
            );

            context.SaveChanges();
        }

        private static Match NewMatch(Team home, Team away, int week, DateTime date,
            int? homeScore, int? awayScore, MatchStatus status, string stadium)
        {
            return new Match
            {
                HomeTeam = home,
                AwayTeam = away,
                Week = week,
                MatchDate = date,
                HomeScore = homeScore,
                AwayScore = awayScore,
                Status = status,
                Stadium = stadium
            };
        }
    }
}