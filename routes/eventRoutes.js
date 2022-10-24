const express = require('express');

const eventController = require('../controllers/eventController');
const protect = require('../middleware/protect');

const router = express.Router();

//router.use(protect);

router.get('/searchLocation', eventController.searchLocation);

module.exports = router;
