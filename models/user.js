const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  provider: String,
  id: Number,
  username: String
}, {
  collection: 'fccnlca-users'
});

module.exports = mongoose.model('User', userSchema);