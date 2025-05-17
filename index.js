const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// This function converts Roblox username to UserId using the current Roblox API
async function getUserId(username) {
    const res = await axios.post('https://users.roblox.com/v1/usernames/users', {
        usernames: [username],
        excludeBannedUsers: false
    });

    const user = res.data.data[0];
    if (user && user.id) return user.id;

    throw new Error('User not found');
}

// Main API route: fetches up to 10 games for the given username
app.get('/get-games', async (req, res) => {
    try {
        const username = req.query.username;
        if (!username) return res.status(400).json({ error: 'Username is required' });

        console.log(`Looking up user ID for ${username}...`);
        const userId = await getUserId(username);
        console.log(`User ID found: ${userId}`);

        const gamesRes = await axios.get(`https://games.roblox.com/v2/users/${userId}/games?sortOrder=Asc&limit=10`);

        const games = gamesRes.data.data.map(game => ({
            name: game.name,
            id: game.id,
            visits: game.visits,
            thumbnail: `https://thumbnails.roblox.com/v1/places/${game.id}/thumbnail?size=768x432&format=png`
        }));

        res.json({ userId, games });
    } catch (err) {
        console.error('Error:', err.message || err.response?.data);
        res.status(500).json({ error: 'Failed to fetch games', message: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
