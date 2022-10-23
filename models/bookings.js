const mongoose = require('mongoose');

var bookingSchema = mongoose.Schema({
  date: {
    type: Date,
    required: [true, 'Invaid date'],
  },
  duration: {
    type: Number,
    required: true,
    min: 1,
  },
  eventLocation: {
    type: String,
    required: true,
  },
  timezone: {
    type: String,
    require: true,
  },
  bookedBy: Object,
  eventId: String,
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'meetings',
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
});

let Bookings;

if (!mongoose.models['Bookings']) {
  Bookings = mongoose.model('Bookings', bookingSchema);
} else {
  Bookings = mongoose.models['Bookings'];
}
module.exports = Bookings;
