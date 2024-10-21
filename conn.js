const mysql = require('mysql')

const conn = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Rogerskie1234",
    database: "PLANITSMART"
});

conn.connect((err)=> {
    if(err) throw err;
    console.log('Database is connected successfully!');
    
})

module.exports = conn;