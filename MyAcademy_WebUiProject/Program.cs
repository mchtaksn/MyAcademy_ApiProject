using MyAcademy_WebUiProject.Hubs;
using MyAcademy_WebUiProject.Services;


var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();

builder.Services.AddHttpClient("SerieAApi", client =>
{
    client.BaseAddress = new Uri("https://localhost:7019/");
});

builder.Services.AddScoped<AdminApiService>();
builder.Services.AddSignalR();

builder.Services.AddAntiforgery(options => options.HeaderName = "RequestVerificationToken");

var app = builder.Build();   

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");
app.MapHub<MatchHub>("/hubs/match");
app.Run();