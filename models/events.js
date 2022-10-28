const mongoose = require('mongoose');

var EventsSchema = mongoose.Schema({
  name: {
    type: String,
    required: [true, 'An Event must have a name'],
  },
  tags: [String],
  description: {
    type: String,
    required: [true, 'An Event must have a description'],
  },
  image: {
    type: String,
    required: [true, 'An Event must have a description'],
  },
  startDate: {
    type: Date,
    required: [true, 'An Event must have a start date'],
  },
  endDate: {
    type: Date,
    required: [true, 'An Event must have a end date'],
  },
  location: {
    type: String,
    required: [true, 'An Event must have a Location'],
  },
  venue: {
    type: String,
    required: [true, 'An Event must have a Venue'],
  },
  price: {
    type: Number,
    required: [true, 'An Event must have price'],
  },
  address: {
    type: String,
    required: [true, 'An Event must have a detailed address'],
  },
  phone: {
    type: String,
    required: [true, 'An Event must contain phone number'],
  },
  email: {
    type: String,
    required: [true, 'An Event must have an email'],
  },
  facebook: {
    type: String,
  },
  twitter: {
    type: String,
  },
  insta: {
    type: String,
  },
  linkdin: {
    type: String,
  },
  snapchat: {
    type: String,
  },
  whatsApp: {
    type: String,
  },
  //   totalTicket:{
  //     type: Number,
  //     required: [true, 'An Event must have number of tickets'],
  //   },
  sponsors: [String],
  speakers: [
    {
      image: String,
      name: String,
      description: String,
      occupation: String,
      facebook: String,
      twitter: String,
      insta: String,
      linkdin: String,
      snapchat: String,
      whatsApp: String,
    },
  ],
  schedule: [
    {
      date: Date,
      topic: String,
      topicDetails: String,
      speaker: String,
    },
  ],
});

let Events;

if (!mongoose.models['Events']) {
  Events = mongoose.model('Events', EventsSchema);
} else {
  Events = mongoose.models['Events'];
}
module.exports = Events;
