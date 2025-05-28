const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ✅ Known universe fallback (for older games)
const knownUniverses = {
  66654135: 142823291, // Murder Mystery 2
  // Add more placeId: universeId mappings here if needed
};

// 🔍 Get userId from username
async function getUserId(username) {
  const res = await axios.post("https://users.roblox.com/v1/usernames/users", {
    usernames: [username],
    excludeBannedUsers: false,
  });

  const user = res.data.data[0];
  if (user && user.id) return user.id;
  throw new Error("User not found");
}

// 📦 /get-games?username=USERNAME
app.get("/get-games", async (req, res) => {
  try {
    const username = req.query.username;
    if (!username) return res.status(400).json({ error: "Username required" });

    const userId = await getUserId(username);
    const response = await axios.get(
      `https://games.roblox.com/v2/users/${userId}/games?sortOrder=Asc&limit=10`
    );
    const games = response.data.data;

    const enrichedGames = await Promise.all(
      games.map(async (game) => {
        const placeId = game.id;
        const universeId = game.universeId || knownUniverses[placeId];

        let visits = "N/A";
        let likes = "N/A";
        let dislikes = "N/A";

        if (!universeId) {
          console.warn(`⚠️ ${game.name} has no universeId — showing N/A`);
        } else {
          try {
            const statsRes = await axios.get(
              `https://games.roblox.com/v1/games?universeIds=${universeId}`
            );
            const stats = statsRes.data.data[0];
            console.log(`📊 Stats for ${game.name}:`, stats);

            if (stats) {
              visits = stats.visits;
              likes = stats.upVotes;
              dislikes = stats.downVotes;
            }
          } catch (e) {
            console.warn(`❗ Error fetching stats for ${game.name}: ${e.message}`);
          }
        }

        return {
          name: game.name,
          id: placeId,
          universeId: universeId || "N/A",
          visits,
          likes,
          dislikes,
          thumbnail: `https://thumbnails.roblox.com/v1/places/${placeId}/thumbnail?size=768x432&format=png`,
        };
      })
    );

    res.json({ userId, games: enrichedGames });
  } catch (err) {
    console.error("🔥 API Error:", err.message);
    res.status(500).json({ error: "Failed to fetch games" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});