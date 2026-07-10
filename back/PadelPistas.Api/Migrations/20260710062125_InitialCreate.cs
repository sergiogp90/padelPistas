using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace PadelPistas.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Clubs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Nombre = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Slug = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Clubs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Courts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ClubId = table.Column<int>(type: "INTEGER", nullable: false),
                    Nombre = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Orden = table.Column<int>(type: "INTEGER", nullable: false),
                    CurrentMatchJson = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Courts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Courts_Clubs_ClubId",
                        column: x => x.ClubId,
                        principalTable: "Clubs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Clubs",
                columns: new[] { "Id", "Nombre", "Slug" },
                values: new object[] { 1, "Club de ejemplo", "lgancce" });

            migrationBuilder.InsertData(
                table: "Courts",
                columns: new[] { "Id", "ClubId", "CurrentMatchJson", "Nombre", "Orden" },
                values: new object[,]
                {
                    { 1, 1, "{\"teams\":[{\"players\":[{\"name\":\"Ana\",\"gender\":\"female\"},{\"name\":\"Luc\\u00EDa\",\"gender\":\"female\"}]},{\"players\":[{\"name\":\"Marta\",\"gender\":\"female\"},{\"name\":\"Sara\",\"gender\":\"female\"}]}],\"score\":{\"currentPoint\":[30,40],\"games\":[[6,4],[3,5]],\"sets\":[1,0]}}", "Pista Central", 1 },
                    { 2, 1, "{\"teams\":[{\"players\":[{\"name\":\"Carlos\",\"gender\":\"male\"},{\"name\":\"Javier\",\"gender\":\"male\"}]},{\"players\":[{\"name\":\"Diego\",\"gender\":\"male\"},{\"name\":\"Pablo\",\"gender\":\"male\"}]}],\"score\":{\"currentPoint\":[\"AD\",40],\"games\":[[5,5]],\"sets\":[0,0]}}", "Pista 2", 2 },
                    { 3, 1, null, "Pista 3", 3 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Clubs_Slug",
                table: "Clubs",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Courts_ClubId",
                table: "Courts",
                column: "ClubId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Courts");

            migrationBuilder.DropTable(
                name: "Clubs");
        }
    }
}
