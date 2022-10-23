const mongoose = require('mongoose');

var RolesSchema = mongoose.Schema({
  name: {
    type: String,
    unique: true,
    required: [true, 'A Role must have a name'],
  },
});

let Roles;

if (!mongoose.models['Roles']) {
  Roles = mongoose.model('Roles', RolesSchema);
} else {
  Roles = mongoose.models['Roles'];
}
module.exports = Roles;
