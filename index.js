const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Your Roblox API key (keep this private)
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY || "eKTMowQ7PESnC/ZMYYnlV6uM+QgHe2ELgeGYVtNyDY9fAXhbZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNkluTnBaeTB5TURJeExUQTNMVEV6VkRFNE9qVXhPalE1V2lJc0luUjVjQ0k2SWtwWFZDSjkuZXlKaVlYTmxRWEJwUzJWNUlqb2laVXRVVFc5M1VUZFFSVk51UXk5YVRWbFpibXhXTm5WTksxRm5TR1V5UlV4blpVZFpWblJPZVVSWk9XWkJXR2hpSWl3aWIzZHVaWEpKWkNJNklqRTNOalF6TnpreU5URWlMQ0poZFdRaU9pSlNiMkpzYjNoSmJuUmxjbTVoYkNJc0ltbHpjeUk2SWtOc2IzVmtRWFYwYUdWdWRHbGpZWFJwYjI1VFpYSjJhV05sSWl3aVpYaHdJam94TnpRNE56VXdOemd4TENKcFlYUWlPakUzTkRnM05EY3hPREVzSW01aVppSTZNVGMwT0RjME56RTRNWDAuVjA3UmZzQWc2d2ZGbzBaYWNZOEhpeHY0ZTRYV2w4bXZYUm1MQXhGeFZ3Qm5tU0I1aEZFZEZPUXJHZkdRZWFyRnM4X3ZMSTR4NGxlYzgwYWdKOEUwZWFRNVA3X3dxQVlQYUg1ajZ0VWJDOFp3eFVZNGR1cWl4WUlzandVWENkX0hqVG1JTGlYQTlhZUhsSlowQjVaRUgyXzRRMlVmODhIWU95S1NWd0dNbzJKVkJKMFRyRkpGWGdtWFJpNVBKYzFpb3JVUVNvYVVZdkZhbUVhcERlcFI4WWFBRzBseHBvQXRQRUZtb2ZQT1FNam9OUGNFLWlEYnZkcUU0czM0X3pNQUxaOXFsNlZxSkRkVjBKNWlZTXJJaVhVX2FDZGVrYm9HUktCazZ2cTlOT25STGxmZ2txa2pxbmRfVVIydDRhRTNxVkxYS0Q3NHNkdXlzOHdqRnRqd0Rn";

// ✅ Known universe fallback (for older games)
const knownUniverses = {
  66654135: 142823291, // Murder Mystery 2
  7496300402: 2918007456, // Not Alone
  7242216625: 2822108470, // Obby DCO [Beta]
  5831571340: 2074435046, // Random Parkour
  3999217261: 1341857323,  // Ragdoll Dash
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

// 🔍 Fetch universeId from Open Cloud API using placeId
async function fetchUniverseId(placeId) {
  try {
    const res = await axios.get(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`, {
      headers: {
        "x-api-key": ROBLOX_API_KEY,
        "Content-Type": "application/json",
      },
    });
    return res.data.universeId;
  } catch (err) {
    console.warn(`❗ Failed to fetch universeId for placeId ${placeId}: ${err.message}`);
    return null;
  }
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

        // Try to get universeId from game data
        let universeId = game.universeId || knownUniverses[placeId] || null;

        // If universeId not found, fetch from Open Cloud API
        if (!universeId) {
          universeId = await fetchUniverseId(placeId);
        }

        console.log(`🧠 Using universeId for ${game.name} (placeId ${placeId}):`, universeId || "N/A");

        let visits = "N/A";
        let likes = "N/A";
        let dislikes = "N/A";

        if (universeId) {
          try {
            const statsRes = await axios.get(
              `https://games.roblox.com/v1/games?universeIds=${universeId}`
            );
            const stats = statsRes.data.data[0];
            if (stats) {
              visits = stats.visits;
              likes = stats.upVotes;
              dislikes = stats.downVotes;
            }
          } catch (e) {
            console.warn(`❗ Error fetching stats for ${game.name}: ${e.message}`);
          }
        } else {
          console.warn(`⚠️ ${game.name} has no universeId — showing N/A`);
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