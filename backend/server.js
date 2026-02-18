require('dotenv').config();
const app = require('./src/app');
// const pool = require('./src/db/db');

if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
}

// pool.connect();
const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 