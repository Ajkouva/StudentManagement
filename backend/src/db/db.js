const pg = require('pg');
// require('dotenv').config();

const pool = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    // Improvement #20: explicit pool config instead of relying on silent defaults
    max: 10,   // max open connections (default is also 10, but explicit = predictable)
    idleTimeoutMillis: 30000, // close idle connections after 30 s
    connectionTimeoutMillis: 2000, // fail fast if no connection available within 2 s
});

pool.on('connect', () => {
    console.log('Connected to the database');
})

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
})

module.exports = pool;