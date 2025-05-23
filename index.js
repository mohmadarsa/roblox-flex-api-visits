const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 🔧 Utility: get UserId from username
async function getUserId(username) {
    const res = await axios.post("https://users.roblox.com/v1/usernames/users", {
        usernames: [username],
        excludeBannedUsers: false
    });

    const user = res.data.data[0];
    if (user && user.id) return user.id;

    throw new Error("User not found");
}

// 📦 Route: /get-games?username=USERNAME
app.get("/get-games", async (req, res) => {
    try {
        const username = req.query.username;
        if (!username) return res.status(400).send({ error: "Username required" });

        const userId = await getUserId(username);
        const response = await axios.get(`https://games.roblox.com/v2/users/${userId}/games?sortOrder=Asc&limit=10`);
        const games = response.data.data;

        const enrichedGames = await Promise.all(games.map(async (game) => {
            const universeId = game.universeId;
            let visits = 0;
            let likes = 0;
            let dislikes = 0;

            try {
                // Fetch vote stats
                const voteRes = await axios.get(`https://games.roblox.com/v1/games/votes?universeIds=${universeId}`);
                const voteData = voteRes.data.data[0];
                if (voteData) {
                    likes = voteData.upVotes;
                    dislikes = voteData.downVotes;
                }
            } catch (e) {
                console.warn(`❗ Could not fetch votes for ${game.name}:`, e.message);
            }

            try {
                // Fetch visit stats
                const statRes = await axios.get(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
                const gameStats = statRes.data.data[0];
                if (gameStats) {
                    visits = gameStats.visits;
                }
            } catch (e) {
                console.warn(`❗ Could not fetch stats for ${game.name}:`, e.message);
            }

            // Optional logging for debugging
            console.log(`[✔] ${game.name} — Visits: ${visits}, Likes: ${likes}, Dislikes: ${dislikes}`);

            return {
                name: game.name,
                id: game.id,
                universeId,
                visits,
                likes,
                dislikes,
                thumbnail: `https://thumbnails.roblox.com/v1/places/${game.id}/thumbnail?size=768x432&format=png`
            };
        }));

        res.json({ userId, games: enrichedGames });
    } catch (err) {
        console.error("🔥 Failed to fetch games:", err.message);
        res.status(500).send({ error: "Failed to fetch games" });
    }
});

// 🚀 Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
