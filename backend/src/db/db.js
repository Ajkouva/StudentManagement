const pg = require('pg');
// require('dotenv').config();

const pool = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.on('connect', () => {
    console.log('Connected to the database');
})

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
})

module.exports = pool;