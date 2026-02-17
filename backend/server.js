require('dotenv').config();
const app = require('./src/app');
// const pool = require('./src/db/db');

// pool.connect();
const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 