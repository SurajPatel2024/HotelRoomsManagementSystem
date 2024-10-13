const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    guestName: { type: String, required: true },
    guestMobile: { type: Number, required: true },
    roomNumber: { type: Number, required: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    guestCount: { type: Number, required: true },
    roomprice: { type: Number, required: true },
    
    paymentStatus: { type: String, enum: ['Paid', 'Unpaid'], required: true }, // New payment status field

    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

module.exports = mongoose.model('Booking', BookingSchema);
