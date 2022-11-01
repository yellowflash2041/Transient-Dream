const mongoose = require('mongoose');
const UserSchema = require('./user.js').schema;
const Schema = mongoose.Schema;

const patronSchema = new Schema({
  listingId: String,
  patrons: [UserSchema] // Allows us to add an array of Users (i.e. patrons)
}, {
  collection: 'fccnlca-patrons'
});

module.exports = mongoose.model('Patrons', patronSchema);