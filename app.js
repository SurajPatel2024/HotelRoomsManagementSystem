require("dotenv").config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');
const connectDB = require('./config/db');
const User = require('./models/User');
const Hotel = require('./models/Hotel');
const Room = require('./models/Room');
const Booking = require('./models/Booking');

const app = express();
connectDB(); 

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
const MongoStore = require('connect-mongo');
const { error } = require("console");

app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({ mongoUrl: process.env.DATABASE_URL })
}));

app.set('view engine', 'ejs');
app.use(express.static('public'));

// Render login page
app.get('/', (req, res) => {
    res.render('login', { error: null });
});

// Signup page route
app.get('/signup', (req, res) => {
    res.render('signup',{error: null});
});

// Handle signup
app.post('/signup', async (req, res) => {
    const { username, password ,school} = req.body;

    const existingUser = await User.findOne({ name: username });
    if (existingUser) {
        return res.render('signup',{error:'User already exists. Please choose a different username.'})
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = new User({ name: username, password: hashedPassword ,school});
    await newUser.save();
    res.redirect('/');
});

//reset password
app.get('/forgot', (req, res) => {
    res.render('forgot',{error:null});  
});
app.post('/forgot', async(req, res) => {
    const { username, newPassword , school } = req.body;
 
    try {
        // Find the user by name and school
        const user = await User.findOne({ name:username, school });
        if (!user) {
            return res.render('forgot',{error:'User not found or incorrect school information.'})
           
        }
 
        // Hash the new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update the user's password
        user.password = hashedPassword;
        await user.save();
        res.render('login',{error:'Password has been successfully updated. Please log in with your new password.'})
         
    } catch (error) {
        console.error('Error in forget route:', error);
        res.send('An error occurred. Please try again later.');
    }
});
  
// Handle login 
 
app.post('/home', async (req, res) => {
    const { username, password } = req.body;
      const user = await User.findOne({name: username});
      if(!user || ! await bcrypt.compare(password,user.password)){
        return res.render('login',{error:"Username or password is wrong!"})
      }
      req.session.user = user;
      res.redirect('/home'); 
}); 

// Check if the user is logged in
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    } else {
        res.redirect('/');
    }
}



// Dashboard Route
app.get('/home', isAuthenticated, async (req, res) => {
    try {
        const userHotels = await Hotel.find({ userId: req.session.user._id });
        const lastHotel = userHotels.length ? userHotels[userHotels.length - 1] : null;

        // Fetch only rooms that belong to the logged-in user
        const rooms = await Room.find({ userId: req.session.user._id });

        const availableRooms = rooms.filter(room => room.status === 'Available').length;
        const bookedRooms = rooms.filter(room => room.status === 'Booked').length;

        // Fetch bookings for all rooms
        const bookings = await Booking.find({ userId: req.session.user._id });

        // Map room booking data into the rooms
        const roomsWithBooking = rooms.map(room => {
            const booking = bookings.find(b => b.roomNumber === room.roomNumber);
            return {
                ...room.toObject(),
                booking: booking || null // Attach booking if it exists
            };
        });

        res.render('home', {
            user: req.session.user,
            hotel: lastHotel,
            availableRooms,
            bookedRooms,
            rooms: roomsWithBooking // Pass rooms with booking info
        });
    } catch (error) {
        console.error("Error retrieving hotels:", error);
        res.status(500).send("Internal Server Error");
    }
});


// Render settings page (for adding hotel)
app.get('/settings', isAuthenticated, (req, res) => {
    res.render('settings');
});
app.get('/book-room', isAuthenticated, (req, res) => {
    res.render('book-room');
});

// Handle hotel form submission
app.post('/settings', isAuthenticated, async (req, res) => {
    const { hotelname, totalRooms } = req.body;

    // Create a new hotel
    const newHotel = new Hotel({ hotelname, totelrooms: totalRooms, userId: req.session.user._id });
    try {
        await newHotel.save();

        // Get the existing rooms for the user
        const existingRooms = await Room.find({ userId: req.session.user._id });

        // Calculate the starting room number
        const startingRoomNumber = existingRooms.length > 0 ? Math.max(...existingRooms.map(room => room.roomNumber)) + 1 : 1;

        // Create rooms for the new hotel
        for (let i = 0; i < totalRooms; i++) {
            const room = new Room({
                roomNumber: startingRoomNumber + i, // Start from the next available index


                status: 'Available',
                userId: req.session.user._id // Associate room with the current user
            });
            await room.save();
        }

        // Update the hotel's total number of rooms
        newHotel.totelrooms = existingRooms.length + parseInt(totalRooms);
        await newHotel.save();

        res.redirect('/home');
    } catch (error) {
        console.error("Error saving hotel data or creating rooms:", error);
        res.status(500).send("Internal Server Error");
    }
});
 
// Example Express route to get room details
app.get('/room/:roomNumber', async (req, res) => {
    const roomNumber = req.params.roomNumber;

    try {
        // Fetch the room details from your database
        const room = await Room.findOne({ roomNumber: roomNumber }); // Ensure `Room` is defined and imported

        if (!room) {
            return res.status(404).send('Room not found');
        }

        // Render the room details page
        res.render('roomDetails', { room }); // Make sure `room` is passed to the view
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// Assuming you have express and your booking model imported
// View booking details route
app.get('/view-booking/:id', isAuthenticated, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).send('Booking not found');
        }
        res.render('view-booking', { booking }); // Render the view-booking template with booking data
    } catch (error) {
        res.status(500).send('Server error');
    }
});
 
 
 
// Book a room by room number
app.post('/book-room', isAuthenticated, async (req, res) => {
    const { guestName, guestMobile, roomNumber, checkIn, checkOut, guestCount, roomprice, paymentStatus } = req.body;

    // Find the room by the provided room number
    const room = await Room.findOne({ roomNumber, userId: req.session.user._id });

    if (!room || room.status !== 'Available') {
        return res.status(404).send('Room not found or not available for booking.');
    }

    try {
        // Create a new booking
        const booking = new Booking({
            guestName,
            guestMobile,
            roomNumber,
            checkIn,
            checkOut,
            guestCount,
            roomprice,
            paymentStatus, // Use the unified payment field
            userId: req.session.user._id // Associate booking with the logged-in user
        });
        await booking.save();

        // Update the room status to 'Booked'
        await Room.findOneAndUpdate({ roomNumber, userId: req.session.user._id }, { status: 'Booked' });

        res.redirect('/home');
    } catch (error) {
        console.error('Error while booking room:', error);
        res.status(500).send('Internal Server Error');
    }
});


// Render the edit form for a booking
app.get('/edit-booking/:id', isAuthenticated, async (req, res) => {
    const bookingId = req.params.id;

    try {
        // Find the booking by its ID
        const booking = await Booking.findById(bookingId);
        if (!booking || booking.userId.toString() !== req.session.user._id.toString()) {
            return res.status(404).send("Booking not found or access denied.");
        }

        res.render('edit-booking', { booking });
    } catch (error) {
        console.error('Error retrieving booking for editing:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Handle booking edit submission
app.post('/edit-booking/:id', isAuthenticated, async (req, res) => {
    const bookingId = req.params.id;
    const { guestName, guestMobile, roomNumber, checkIn, checkOut, guestCount, roomprice, paymentStatus } = req.body;

    try {
        // Find and update the booking
        const booking = await Booking.findById(bookingId);
        if (!booking || booking.userId.toString() !== req.session.user._id.toString()) {
            return res.status(404).send("Booking not found or access denied.");
        }

        // Update booking fields
        booking.guestName = guestName;
        booking.guestMobile = guestMobile;
        booking.roomNumber = roomNumber;
        booking.checkIn = new Date(checkIn);
        booking.checkOut = new Date(checkOut);
        booking.guestCount = guestCount;
        booking.roomprice = roomprice;
        booking.paymentStatus = paymentStatus;

        await booking.save();

        res.redirect('/bookings');
    } catch (error) {
        console.error('Error updating booking:', error);
        res.status(500).send('Internal Server Error');
    }
});


// Delete a booking
app.post('/delete-booking/:id', isAuthenticated, async (req, res) => {
    const bookingId = req.params.id;

    try {
        const booking = await Booking.findById(bookingId);
        if (!booking || booking.userId.toString() !== req.session.user._id.toString()) {
            return res.status(404).send("Booking not found or access denied.");
        }

        // Delete the booking
        await Booking.findByIdAndDelete(bookingId);

        // Update the room status to 'Available'
        await Room.findOneAndUpdate({ roomNumber: booking.roomNumber, userId: req.session.user._id }, { status: 'Available' });

        res.redirect('/bookings');
    } catch (error) {
        console.error('Error deleting booking:', error);
        res.status(500).send('Internal Server Error');
    }
});

 

// View all bookings
app.get('/bookings', isAuthenticated, async (req, res) => {
    try {
        const bookings = await Booking.find({ userId: req.session.user._id });

        res.render('bookings', { bookings });
    } catch (error) {
        console.error("Error retrieving bookings:", error);
        res.status(500).send("Internal Server Error");
    }
});
 
app.post('/delete-room', isAuthenticated, async (req, res) => {
    const { roomNumber } = req.body;



    try {
        // Find and delete the room
        const deletedRoom = await Room.findOneAndDelete({ roomNumber, userId: req.session.user._id });

        if (!deletedRoom) {
            console.log("Room not found or does not belong to the user.");
            return res.status(404).send('Room not found or does not belong to the user.');
        }

        // After deleting the room, update the hotel's total rooms
        const hotel = await Hotel.findOne({ userId: req.session.user._id });
        if (hotel) {
            hotel.totelrooms = hotel.totelrooms - 1; // Reduce the total rooms count
            await hotel.save();
        }

        res.redirect('/home');
    } catch (error) {
        console.error('Error deleting room:', error);
        res.status(500).send('Internal Server Error');
    }
});

 
// Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send("Logout failed.");
        }
        res.redirect('/');
    });
});
 
 
const PORT = process.env.PORT||5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
