const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

// Get userId from username
async function getUserId(username) {
  const res = await axios.post("https://users.roblox.com/v1/usernames/users", {
    usernames: [username],
    excludeBannedUsers: false,
  });

  const user = res.data.data[0];
  if (user && user.id) return user.id;
  throw new Error("User not found");
}

// Get universeId from placeId using Open Cloud
async function getUniverseIdFromPlaceId(placeId) {
  try {
    console.log(`🔍 Fetching universeId for placeId ${placeId}`);
    const res = await axios.get(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`, {
      headers: {
        'x-api-key': ROBLOX_API_KEY
      }
    });
    console.log(`✅ Got universeId for ${placeId}:`, res.data.universeId);
    return res.data.universeId;
  } catch (err) {
    console.warn(`❌ Failed to get universeId for ${placeId}: ${err.message}`);
    return null;
  }
}

// /get-games?username=USERNAME
app.get("/get-games", async (req, res) => {
  try {
    const username = req.query.username;
    if (!username) return res.status(400).json({ error: "Username required" });

    const userId = await getUserId(username);
    const limit = req.query.limit || 10;
    const response = await axios.get(
      `https://games.roblox.com/v2/users/${userId}/games?sortOrder=Asc&limit=${limit}`
    );
    const games = response.data.data;

    const enrichedGames = await Promise.all(
      games.map(async (game) => {
        const placeId = game.id;
        let universeId = game.universeId || null;

        

        if (!universeId) {
          universeId = await getUniverseIdFromPlaceId(placeId);
        }

        let visits = "N/A";
        let likes = "N/A";
        let dislikes = "N/A";

        if (universeId) {
          try {
            const statsRes = await axios.get(
              `https://games.roblox.com/v1/games?universeIds=${universeId}`,
              {
                headers: {
                  "User-Agent": "Mozilla/5.0 (compatible; FlexYourGame/1.0)"
                }
              }
            );
            const stats = statsRes.data.data[0];
            if (stats) {
              visits = stats.visits;
              likes = stats.voteCount ? stats.voteCount.upVotes : "N/A";
              dislikes = stats.voteCount ? stats.voteCount.downVotes : "N/A";
              console.log(`📊 Stats for ${game.name}: visits=${visits}, likes=${likes}, dislikes=${dislikes}`);
            }
            await sleep(300); // Pause to avoid hitting rate limit
          } catch (err) {
            if (err.response?.status === 429) {
              console.warn(`⏳ Rate limited for ${game.name}. Try again later.`);
            } else {
              console.warn(`❗ Failed to fetch stats for ${game.name}: ${err.message}`);
            }
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
          created: game.created,
          isArchived: game.isArchived,
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