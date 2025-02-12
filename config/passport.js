const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcryptjs')
const { User, Restaurant } = require('../models')

passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password',
  passReqToCallback: true
}, (req, email, password, cb) => {
  return User.findOne({ where: { email } })
    .then(user => {
      if (!user) return cb(null, false, req.flash('error_message', 'Email or password incorrect.'))
      return bcrypt.compare(password, user.password)
        .then(res => {
          if (!res) return cb(null, false, req.flash('error_message', 'Email or password incorrect.'))
          return cb(null, user)
        })
        .catch(error => cb(error))
    })
    .catch(error => cb(error))
}))

passport.serializeUser((user, cb) => {
  return cb(null, user.id)
})

passport.deserializeUser((id, cb) => {
  return User.findByPk(id, {
    include: [
      { model: Restaurant, as: 'FavoritedRestaurants' },
      { model: Restaurant, as: 'LikedRestaurants' },
      { model: User, as: 'Followers' },
      { model: User, as: 'Followings' }
    ]
  })
    .then(user => {
      return cb(null, user.toJSON())
    })
    .catch(error => cb(error))
})

module.exports = passport
