const express = require('express');
const session = require('express-session');
const app = express();
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const conn = require('./conn.js');

// Middleware setup
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.urlencoded({ extended: true }));

// Session setup
app.use(session({
    secret: 'your-secret-key', // Change this to a secure random string
    resave: false,
    saveUninitialized: true,
    cookie: {secure: false,maxAge: 30 * 60 * 1000}
}));

// Insert event
app.post('/addevent', isAuthenticated, (req, res) => {
    if (!req.session.user || !req.session.user.id) {
        return res.status(401).send("User  not authenticated");
    }

    const userId = req.session.user.id; // Get userId from session
    console.log("Attempting to insert event for userId:", userId); // Debugging output

    const title = req.body.title;
    const description = req.body.description;
    const startDate = req.body.startDate;
    const startTime = req.body.startTime;
    const endTime = req.body.endTime;



    // Check if userId exists in users table (for debugging)
    const checkUser_Sql = `SELECT * FROM users WHERE userId = ?`;
    conn.query(checkUser_Sql, [userId], (err, results) => {
        if (err) {
            console.error("Error checking user:", err);
            return res.status(500).send("Internal Server Error");
        }

        if (results.length === 0) {
            console.error("User  ID does not exist in users table:", userId);
            return res.status(400).send("User  ID does not exist");
        }

        // Proceed with inserting the event
        const sql = `INSERT INTO events (userId, title, description, startDate, startTime, endTime) VALUES ( ?, ?, ?, ?, ?, ?)`;
        conn.query(sql, [userId, title, description, startDate, startTime, endTime], (err, result) => {
            if (err) {
                console.error("Error inserting event:", err);
                return res.status(500).send("Internal Server Error");
            }
            console.log('New Event Inserted');
            res.send(`
                <script>
                    alert("1 Event Successfully Added!");
                    window.location.href="/";
                </script>
            `);
        });
    });
});



// Middleware to attach user to request
app.use((req, res, next) => {
    if (req.session.user) {
        conn.query('SELECT * FROM users WHERE userId = ?', [req.session.user.id], (err, result) => {
            if (err) {
                console.error("Error fetching user:", err);
                return next();
            }
            if (result.length > 0) {
                req.user = result[0];
            }
            next();
        });
    } else {
        next();
    }
});

// Insert note
app.post('/addnote', isAuthenticated, (req, res) => {
    if (!req.session.user || !req.session.user.id) {
        return res.status(401).send("User not authenticated");
    }

    const userId = req.session.user.id; // Get userId from session
    console.log("Attempting to insert note for userId:", userId); // Debugging output

    const noteTitle = req.body.noteTitle;
    const noteDescription = req.body.noteDescription;
    const noteLabel = req.body.noteLabel;
    const dueDate = req.body.dueDate;

    if (!noteTitle || !noteDescription || !noteLabel || !dueDate) {
        return res.status(400).send("All fields are required");
    }

    // Check if userId exists in users table (for debugging)
    const checkUserSql = `SELECT * FROM users WHERE userId = ?`;
    conn.query(checkUserSql, [userId], (err, results) => {
        if (err) {
            console.error("Error checking user:", err);
            return res.status(500).send("Internal Server Error");
        }

        if (results.length === 0) {
            console.error("User ID does not exist in users table:", userId);
            return res.status(400).send("User ID does not exist");
        }

        // Proceed with inserting the note
        const sql = `INSERT INTO notes (userId, noteTitle, noteDescription, noteLabel, dueDate) VALUES (?, ?, ?, ?, ?)`;
        
        conn.query(sql, [userId, noteTitle, noteDescription, noteLabel, dueDate], (err, result) => {
            if (err) {
                console.error("Error inserting note:", err);
                return res.status(500).send("Internal Server Error");
            }
            console.log('New Note Inserted');
            res.send(`
                <script>
                    alert("1 Note Successfully Added!");
                    window.location.href="/";
                </script>
            `);
        });
    });
});

// Display dashboard events and notes
// Display dashboard events and notes// Display dashboard events and notes
app.get('/', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const getEvents = `SELECT * FROM events WHERE userId = ?`;
    const getNotes = `SELECT * FROM notes WHERE userId = ?`;
    const dates = `SELECT startDate FROM events WHERE userId = ?`;
    const time = `SELECT startTime, endTime FROM events WHERE userId = ?`;

    conn.query(getEvents, [userId], (err, eventData) => {
        if (err) {
            console.error("Error fetching events:", err);
            return res.status(500).send("Internal Server Error");
        }

        conn.query(getNotes, [userId], (err, mydata) => {
            if (err) {
                console.error("Error fetching notes:", err);
                return res.status(500).send("Internal Server Error");
            }

            conn.query(dates, [userId], (err, dateRows) => {
                if (err) {
                    console.error("Error fetching dates:", err);
                    return res.status(500).send("Internal Server Error");
                }

                conn.query(time, [userId], (err, timedata) => {
                    if (err) {
                        console.error("Error fetching time data:", err);
                        return res.status(500).send("Internal Server Error");
                    }

                    // Calculate minutes for each event
                    const getMinutesDifference = (startTime, endTime) => {
                        const startParts = startTime.split(':').map(Number);
                        const endParts = endTime.split(':').map(Number);

                        const startDate = new Date();
                        startDate.setHours(startParts[0], startParts[1], startParts[2]);

                        const endDate = new Date();
                        endDate.setHours(endParts[0], endParts[1], endParts[2]);

                        // If end time is earlier than start time, assume it is the next day
                        if (endDate < startDate) {
                            endDate.setDate(endDate.getDate() + 1);
                        }

                        const differenceInMillis = endDate - startDate;
                        return Math.floor(differenceInMillis / (1000 * 60)); // Convert to minutes
                    };

                    // Calculate minutes for each event in the timedata
                    const minutesData = timedata.map(item => {
                        return getMinutesDifference(item.startTime, item.endTime);
                    });

                    // Format the fetched dates
                    const formattedDates = dateRows.map(row => {
                        const date = new Date(row.startDate);
                        // Check if the date is valid
                        if (date instanceof Date && !isNaN(date)) {
                            return date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
                        } else {
                            console.error("Invalid date:", row.startDate);
                            return null; // or handle invalid date as needed
                        }
                    }).filter(date => date !== null);
                
                    // Fetched Dates
                    const fetchedDates = formattedDates;

                    // Create the formatted data array
                    const formattedData = [['Date', 'Minutes']].concat(
                        fetchedDates.map((date, index) => [date, minutesData[index]])
                    );

                    // Output the formatted data
                    // console.log(formattedData);
                    function aggregateAndSortMinutes(data) {
                        // Create an object to hold the total minutes for each date
                        const minutesByDate = {};
                    
                        // Iterate through the data (skip the header)
                        for (let i = 1; i < data.length; i++) {
                            const date = data[i][0];
                            const minutes = data[i][1];
                    
                            // If the date already exists, add the minutes; otherwise, initialize it
                            if (minutesByDate[date]) {
                                minutesByDate[date] += minutes;
                            } else {
                                minutesByDate[date] = minutes;
                            }
                        }
                    
                        // Convert the object back to an array and sort by date
                        const aggregatedData = [['Date', 'Minutes']]; // Initialize with the header
                        for (const date in minutesByDate) {
                            aggregatedData.push([date, minutesByDate[date]]);
                        }
                    
                        // Sort the aggregated data by date (the first column)
                        aggregatedData.sort((a, b) => new Date(a[0]) - new Date(b[0]));
                    
                        return aggregatedData;
                    }
                    
                    // Example usage
                    const modifiedformattedData = formattedData;
                    
                    const result = aggregateAndSortMinutes(formattedData);
                    console.log(result);

                    // Render the dashboard with the calculated data
                    res.render('index', {
                        title: "PlanITSmart",
                        action: 'list',
                        events: eventData,
                        sampledata: mydata,
                        userName: req.session.user.name,
                        user: req.user,
                        modifiedformattedData: result
                    });
                });
            });
        });
    });
});
  

//  charts
    app.get('/charts', isAuthenticated, async(req, res) => {
    const userId = req.session.user.id;
    const getEvents = `SELECT * FROM events WHERE userId = ?`;
    const getNotes = `SELECT * FROM notes WHERE userId = ?`;
    const dates = `SELECT startDate FROM events WHERE userId = ?`;
    const time = `SELECT startTime, endTime FROM events WHERE userId = ?`;

    conn.query(getEvents, [userId], (err, eventData) => {
        if (err) {
            console.error("Error fetching events:", err);
            return res.status(500).send("Internal Server Error");
        }

        conn.query(getNotes, [userId], (err, mydata) => {
            if (err) {
                console.error("Error fetching notes:", err);
                return res.status(500).send("Internal Server Error");
            }

            conn.query(dates, [userId], (err, dateRows) => {
                if (err) {
                    console.error("Error fetching dates:", err);
                    return res.status(500).send("Internal Server Error");
                }

                conn.query(time, [userId], (err, timedata) => {
                    if (err) {
                        console.error("Error fetching time data:", err);
                        return res.status(500).send("Internal Server Error");
                    }

                    // Calculate minutes for each event
                    const getMinutesDifference = (startTime, endTime) => {
                        const startParts = startTime.split(':').map(Number);
                        const endParts = endTime.split(':').map(Number);

                        const startDate = new Date();
                        startDate.setHours(startParts[0], startParts[1], startParts[2]);

                        const endDate = new Date();
                        endDate.setHours(endParts[0], endParts[1], endParts[2]);

                        // If end time is earlier than start time, assume it is the next day
                        if (endDate < startDate) {
                            endDate.setDate(endDate.getDate() + 1);
                        }

                        const differenceInMillis = endDate - startDate;
                        return Math.floor(differenceInMillis / (1000 * 60)); // Convert to minutes
                    };

                    // Calculate minutes for each event in the timedata
                    const minutesData = timedata.map(item => {
                        return getMinutesDifference(item.startTime, item.endTime);
                    });

                    // Format the fetched dates
                    const formattedDates = dateRows.map(row => {
                        const date = new Date(row.startDate);
                        // Check if the date is valid
                        if (date instanceof Date && !isNaN(date)) {
                            return date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
                        } else {
                            console.error("Invalid date:", row.startDate);
                            return null; // or handle invalid date as needed
                        }
                    }).filter(date => date !== null);
                
                    // Fetched Dates
                    const fetchedDates = formattedDates;

                    // Create the formatted data array
                    const formattedData = [['Date', 'Minutes']].concat(
                        fetchedDates.map((date, index) => [date, minutesData[index]])
                    );

                    // Output the formatted data
                    console.log(formattedData);



                    function aggregateAndSortMinutes(data) {
                        // Create an object to hold the total minutes for each date
                        const minutesByDate = {};
                    
                        // Iterate through the data (skip the header)
                        for (let i = 1; i < data.length; i++) {
                            const date = data[i][0];
                            const minutes = data[i][1];
                    
                            // If the date already exists, add the minutes; otherwise, initialize it
                            if (minutesByDate[date]) {
                                minutesByDate[date] += minutes;
                            } else {
                                minutesByDate[date] = minutes;
                            }
                        }
                    
                        // Convert the object back to an array and sort by date
                        const aggregatedData = [['Date', 'Minutes']]; // Initialize with the header
                        for (const date in minutesByDate) {
                            aggregatedData.push([date, minutesByDate[date]]);
                        }
                    
                        // Sort the aggregated data by date (the first column)
                        aggregatedData.sort((a, b) => new Date(a[0]) - new Date(b[0]));
                    
                        return aggregatedData;
                    }
                    
                    // Example usage
                    const modifiedformattedData = formattedData;
                    
                    const result = aggregateAndSortMinutes(formattedData);
                    console.log(result);

                    // Render the dashboard with the calculated data
                    res.render('chart', {
                        title: "PlanITSmart",
                        action: 'list',
                        events: eventData,
                        sampledata: mydata,
                        userName: req.session.user.name,
                        user: req.user,
                        modifiedformattedData: result
                    });
                });
            });
        });
    });
});


// Display notes
app.get('/noteoptions', isAuthenticated,(req, res) => {
    const user = req.session.user; // Corrected typo
    const userId = req.session.user.id;
    const getNotes = `SELECT * FROM notes WHERE userId = ?`;

    conn.query(getNotes, [userId], (err, mydata) => {
        if (err) throw err;

        console.log("Data Displayed Successfully!");
        res.render('noteoptions', {
            title: "PlanITSmart",
            action: 'list',
            sampledata: mydata,user,
            userName: req.session.user.name,
            user: req.user,
        });
    });
});

//display events

app.get('/eventoptions', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const user = req.session.user; // Corrected typo

    const getEvents = `SELECT * FROM events WHERE userId = ?`;

    conn.query(getEvents, [userId], (err, mydata) => {
        if (err) {
            console.error("Error fetching events:", err);
            return res.status(500).send("Internal Server Error");
        }

        console.log("Data Displayed Successfully!");
        res.render('eventoptions', {
            title: "PlanITSmart",
            action: 'list',
            sampledata: mydata,// Pass the user object
            userName: req.session.user.name,
            user: req.user,

        });
    });
});


//update profile

app.post('/updateprofile', async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;

    // Validate inputs
    if (password && password !== confirmPassword) {
        return res.send(`
            <script>
                alert("Passwords do not match!");
                window.history.back();
            </script>
        `);
    }

    try {
        // Prepare the update query
        let updateQuery = 'UPDATE users SET name = ?, email = ?';
        const queryParams = [name, email];

        // If a new password is provided, hash it and add it to the update
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateQuery += ', pass = ?';
            queryParams.push(hashedPassword);
        }

        // Add user ID to the query parameters (assuming you have the user's ID)
        updateQuery += ' WHERE userId = ?';
        queryParams.push(req.session.user.id);

        // Execute the query
        conn.query(updateQuery, queryParams, (err, result) => {
            if (err) {
                console.error("Error updating data:", err);
                return res.status(500).send("Internal Server Error");
            }

            if (result.affectedRows > 0) {
                console.log('Profile updated successfully!');
                res.send(`
                    <script>
                        alert("Profile updated successfully!");
                        window.location.href = "/index"; // Redirect to profile page
                    </script>
                `);
            } else {
                res.send(`
                    <script>
                        alert("No changes were made.");
                        window.history.back();
                    </script>
                `);
            }
        });
    } catch (error) {
        console.error("Error during profile update process:", error);
        return res.status(500).send("Internal Server Error");
    }
});
app.get('/index', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const getEvents = `SELECT * FROM events WHERE userId = ?`;
    const getNotes = `SELECT * FROM notes WHERE userId = ?`;
    const dates = `SELECT startDate FROM events WHERE userId = ?`;
    const time = `SELECT startTime, endTime FROM events WHERE userId = ?`;

    conn.query(getEvents, [userId], (err, eventData) => {
        if (err) {
            console.error("Error fetching events:", err);
            return res.status(500).send("Internal Server Error");
        }

        conn.query(getNotes, [userId], (err, mydata) => {
            if (err) {
                console.error("Error fetching notes:", err);
                return res.status(500).send("Internal Server Error");
            }

            conn.query(dates, [userId], (err, dateRows) => {
                if (err) {
                    console.error("Error fetching dates:", err);
                    return res.status(500).send("Internal Server Error");
                }

                conn.query(time, [userId], (err, timedata) => {
                    if (err) {
                        console.error("Error fetching time data:", err);
                        return res.status(500).send("Internal Server Error");
                    }

                    // Calculate minutes for each event
                    const getMinutesDifference = (startTime, endTime) => {
                        const startParts = startTime.split(':').map(Number);
                        const endParts = endTime.split(':').map(Number);

                        const startDate = new Date();
                        startDate.setHours(startParts[0], startParts[1], startParts[2]);

                        const endDate = new Date();
                        endDate.setHours(endParts[0], endParts[1], endParts[2]);

                        // If end time is earlier than start time, assume it is the next day
                        if (endDate < startDate) {
                            endDate.setDate(endDate.getDate() + 1);
                        }

                        const differenceInMillis = endDate - startDate;
                        return Math.floor(differenceInMillis / (1000 * 60)); // Convert to minutes
                    };

                    // Calculate minutes for each event in the timedata
                    const minutesData = timedata.map(item => {
                        return getMinutesDifference(item.startTime, item.endTime);
                    });

                    // Format the fetched dates
                    const formattedDates = dateRows.map(row => {
                        const date = new Date(row.startDate);
                        // Check if the date is valid
                        if (date instanceof Date && !isNaN(date)) {
                            return date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
                        } else {
                            console.error("Invalid date:", row.startDate);
                            return null; // or handle invalid date as needed
                        }
                    }).filter(date => date !== null);
                
                    // Fetched Dates
                    const fetchedDates = formattedDates;

                    // Create the formatted data array
                    const formattedData = [['Date', 'Minutes']].concat(
                        fetchedDates.map((date, index) => [date, minutesData[index]])
                    );

                    // Output the formatted data
                    // console.log(formattedData);
                    function aggregateAndSortMinutes(data) {
                        // Create an object to hold the total minutes for each date
                        const minutesByDate = {};
                    
                        // Iterate through the data (skip the header)
                        for (let i = 1; i < data.length; i++) {
                            const date = data[i][0];
                            const minutes = data[i][1];
                    
                            // If the date already exists, add the minutes; otherwise, initialize it
                            if (minutesByDate[date]) {
                                minutesByDate[date] += minutes;
                            } else {
                                minutesByDate[date] = minutes;
                            }
                        }
                    
                        // Convert the object back to an array and sort by date
                        const aggregatedData = [['Date', 'Minutes']]; // Initialize with the header
                        for (const date in minutesByDate) {
                            aggregatedData.push([date, minutesByDate[date]]);
                        }
                    
                        // Sort the aggregated data by date (the first column)
                        aggregatedData.sort((a, b) => new Date(a[0]) - new Date(b[0]));
                    
                        return aggregatedData;
                    }
                    
                    // Example usage
                    const modifiedformattedData = formattedData;
                    
                    const result = aggregateAndSortMinutes(formattedData);
                    console.log(result);

                    // Render the dashboard with the calculated data
                    res.render('index', {
                        title: "PlanITSmart",
                        action: 'list',
                        events: eventData,
                        sampledata: mydata,
                        userName: req.session.user.name,
                        user: req.user,
                        modifiedformattedData: result
                    });
                });
            });
        });
    });
});

// Insert event
app.post('/addevent', isAuthenticated, (req, res) => {
    // Check if the user is authenticated and retrieve userId from session
    if (!req.session.user || !req.session.user.id) {
        return res.status(401).send("User  not authenticated");
    }

    const userId = req.session.user.id; // Get userId from session
    const title = req.body.title;
    const description = req.body.description;
    const startDate = req.body.startDate;
    const startTime = req.body.startTime;
    const endTime = req.body.endTime;

    // SQL query to insert the event
    const sql = `INSERT INTO events (userId, title, description, startDate, startTime, endTime) VALUES (?, ?, ?, ?, ?, ?)`;
    
    // Execute the query
    conn.query(sql, [userId, title, description, startDate, startTime, endTime], (err, result) => {
        if (err) {
            console.error("Error inserting event:", err);
            return res.status(500).send("Internal Server Error");
        }
        console.log('New Event Inserted');
        res.send(`
            <script>
                alert("1 Event Successfully Added!");
                window.location.href="/"; // Redirect to home or another page
            </script>
        `);
    });
});

// Insert note
app.post('/addnote', isAuthenticated, (req, res) => {
    const userId = req.session.user.id; // Get userId from session
    const noteTitle = req.body.noteTitle;
    const noteDescription = req.body.noteDescription;
    const noteLabel = req.body.noteLabel;
    const dueDate = req.body.dueDate;
    const reminder =req.body.reminder;

    const sql = `INSERT INTO notes (userId, noteTitle, noteDescription, noteLabel, dueDate,reminder) VALUES (?, ?, ?, ?, ?, ?)`;
    
    conn.query(sql, [userId, noteTitle, noteDescription, noteLabel, dueDate], (err, result) => {
        if (err) {
            console.error("Error inserting note:", err);
            return res.status(500).send("Internal Server Error");
        }
        console.log('New Note Inserted');
        res.send(`
            <script>
                alert("1 Note Successfully Added!");
                window.location.href="/";
            </script>
        `);
    });
});

// Update notes
app.post('/noteoptions/updatenotes/:id', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const upd_id = req.params.id;
    const noteTitle = req.body.noteTitle;
    const noteDescription = req.body.noteDescription;
    const noteLabel = req.body.noteLabel;
    const dueDate = req.body.dueDate;

    const toUpdate = `UPDATE notes SET noteTitle=?, noteDescription=?, noteLabel=?, dueDate=? WHERE id = ? AND userId = ?`;
    conn.query(toUpdate, [noteTitle, noteDescription, noteLabel, dueDate, upd_id, userId], (err, result) => {
        if (err) {
            console.error("Error updating note:", err);
            return res.status(500).send("Internal Server Error");
        }
        console.log('Note Updated Successfully');
        res.send(`
            <script>
                alert("Note Updated Successfully!");
                window.location.href="/noteoptions";
            </script>
        `);
    });
});

// Update events
app.post('/eventoptions/updateevents/:id', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const upd_id = req.params.id;
    const title = req.body.title;
    const description = req.body.description;
    const startDate = req.body.startDate;
    const startTime = req.body.startTime;
    const endTime = req.body.endTime;

    const toUpdate = `UPDATE events SET title=?, description=?, startDate=?, startTime=?, endTime=? WHERE id = ? AND userId = ?`;
    conn.query(toUpdate, [title, description, startDate, startTime, endTime, upd_id, userId], (err, result) => {
        if (err) {
            console.error("Error updating event:", err);
            return res.status(500 ).send("Internal Server Error");
        }
        console.log('Event Updated Successfully');
        res.send(`
            <script>
                alert("Event Updated Successfully!");
                window.location.href="/eventoptions";
            </script>
        `);
    });
});

// Delete notes
app.get('/noteoptions/deletenotes/:id', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const del_id = req.params.id;

    const toDelete = `DELETE FROM notes WHERE id = ? AND userId = ?`;
    conn.query(toDelete, [del_id, userId], (err, result) => {
        if (err) {
            console.error("Error deleting note:", err);
            return res.status(500).send("Internal Server Error");
        }
        console.log('Note Deleted Successfully');
        res.send(`
            <script>
                alert("Note Deleted Successfully!");
                window.location.href="/noteoptions";
            </script>
        `);
    });
});

// Delete events
app.get('/eventoptions/deleteevents/:id', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const del_id = req.params.id;

    const toDelete = `DELETE FROM events WHERE id = ? AND userId = ?`;
    conn.query(toDelete, [del_id, userId], (err, result) => {
        if (err) {
            console.error("Error deleting event:", err);
            return res.status(500).send("Internal Server Error");
        }
        console.log('Event Deleted Successfully');
        res.send(`
            <script>
                alert("Event Deleted Successfully!");
                window.location.href="/eventoptions";
            </script>
        `);
    });
});
app.get('/login', (req, res) => {
    res.render('login'); // This will render anotherFile.ejs
});

app.get('/register',(req, res)=>{
    res.render('register.ejs');
});

app.post('/signup', async (req, res) => {
    const signup_name = req.body.signup_name;
    const signup_email = req.body.signup_email;
    const signup_password = req.body.signup_password;

    // Validation
    if (!signup_name || signup_name.length < 2) {
        return res.send(`
            <script>
                alert("Name must be at least 2 characters long.");
                window.history.back();
            </script>
        `);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Simple email regex
    if (!signup_email || !emailRegex.test(signup_email)) {
        return res.send(`
            <script>
                alert("Please enter a valid email address.");
                window.history.back();
            </script>
        `);
    }

    if (!signup_password || signup_password.length < 8) {
        return res.send(`
            <script>
                alert("Password must be at least 8 characters long.");
                window.history.back();
            </script>
        `);
    }

    try {

         // Check if the email already exists
    const check_email = `SELECT * FROM users WHERE email = ?`;
    
    conn.query(check_email, [signup_email], async (err, results) => {
        if (err) {
            console.error("Error checking email:", err);
            return res.status(500).send("Internal Server Error");
        }

        // If results are not empty, the email is already taken
        if (results.length > 0) {
            return res.status(400).send(`
                <script>
                    alert("Email already exists. Please use a different email.");
                    window.location.href="/signup"; // Redirect back to signup page
                </script>
            `);
        }
        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(signup_password, 10);

        // Prepare the insert query
        const insert_user = `INSERT INTO users (name, email, pass) VALUES (?, ?, ?)`;

        // Execute the query
        conn.query(insert_user, [signup_name, signup_email, hashedPassword], (err, result) => {
            if (err) {
                console.error("Error inserting data:", err);
                return res.status(500).send("Internal Server Error");
            }
            console.log('Registered Successfully!');
            res.send(`
                <script>
                    alert("Registered Successfully. Congrats!");
                    window.location.href="/login"; // Redirect to login page
                </script>
            `);
        });
    });
    } catch (error) {
        console.error("Error during signup process:", error);
        return res.status(500).send("Internal Server Error");
    }
});

app.get('/signup', (req, res) => {
    res.render('register'); // This will render register.ejs
});




// Login route
app.post('/login', (req, res) => {
    const login_email = req.body.login_email;
    const login_password = req.body.login_password;

    const get_login = `SELECT * FROM users WHERE email = ?`;

    conn.query(get_login, [login_email], async (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).send("Internal Server Error");
        }

        if (result.length > 0) {
            const user = result[0];
            const isPasswordValid = await bcrypt.compare(login_password, user.pass);

            if (isPasswordValid) {
                // Store user name in session
                req.session.user = { id: user.userId, name: user.name }; // Ensure this is done after successful login 
                console.log("Login Successfully");
                res.send(`
                    <script>
                        alert("Login Successfully!");
                        window.location.href = "/";
                    </script>
                `);
            } else {
                res.send(`
                    <script>
                        alert("Wrong username or password!");
                        window.location.href = "/login"; // Redirect back to login
                    </script>
                `);
            }
        } else {
            res.send(`
                <script>
                    alert("Wrong username or password!");
                    window.location.href = "/login"; // Redirect back to login
                </script>
            `);
        }
    });
});


// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next(); // User is authenticated
    } else {
        res.redirect('/login'); // Redirect to login page if not authenticated
    }
}

// Start the server
app.listen(3000, (req, res) => {
    console.log("listening at port 3000...");
});