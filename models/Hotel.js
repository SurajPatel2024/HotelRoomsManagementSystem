const mongoose = require('mongoose');

const HotelSchema = new mongoose.Schema({
    hotelname: {
        type: String,
        required: true,
    },
    totelrooms: {
        type: Number,
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }
});

module.exports = mongoose.model('Hotel', HotelSchema);
