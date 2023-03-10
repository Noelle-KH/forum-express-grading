const bcrypt = require('bcryptjs')
const { User, Comment, Restaurant, Favorite, Like, Followship, sequelize } = require('../models')
const { getUser } = require('../helpers/auth-helpers')
const { imgurFileHandler } = require('../helpers/file-helpers')

const userController = {
  signUpPage: (req, res) => {
    return res.render('signup')
  },
  signUp: (req, res, next) => {
    const { name, email, password, passwordCheck } = req.body
    if (!name || !email || !password || !passwordCheck) throw new Error('All field is required.')
    if (password !== passwordCheck) throw new Error('Passwords do not match.')

    return User.findOne({ where: { email } })
      .then(user => {
        if (user) throw new Error('Email already exists.')
        return bcrypt.hash(password, 10)
      })
      .then(hash => User.create({
        name, email, password: hash
      }))
      .then(() => {
        req.flash('success_messages', 'Registered successfully')
        return res.redirect('/signin')
      })
      .catch(error => next(error))
  },
  signInPage: (req, res) => {
    return res.render('signin')
  },
  signIn: (req, res) => {
    req.flash('success_messages', 'Sign in successfully')
    return res.redirect('/restaurants')
  },
  logout: (req, res) => {
    req.flash('success_messages', 'Logout successfully')
    req.logout()
    return res.redirect('/signin')
  },
  getUser: (req, res, next) => {
    const { id } = req.params
    return Promise.all([
      User.findByPk(id, {
        include: [
          { model: User, as: 'Followers', attributes: ['id', 'image'] },
          { model: User, as: 'Followings', attributes: ['id', 'image'] },
          { model: Restaurant, as: 'FavoritedRestaurants', attributes: ['id', 'image'] }
        ],
        nest: true
      }),
      Comment.findAll({
        where: { userId: id },
        include: [{ model: Restaurant, attributes: ['id', 'image'] }],
        attributes: ['restaurantId'],
        group: 'restaurantId',
        nest: true,
        raw: true
      })
    ])
      .then(([userProfile, comments]) => {
        if (!userProfile) throw new Error("User didn't exist.")

        const loginUser = getUser(req)
        const isFollowed = loginUser.Followers.some(following => following.id === userProfile.id)
        return res.render('users/profile', {
          user: loginUser,
          userProfile: userProfile.toJSON(),
          comments,
          isFollowed
        })
      })
      .catch(error => next(error))
  },
  editUser: (req, res, next) => {
    const loginUserId = getUser(req).id
    return User.findByPk(loginUserId)
      .then(user => {
        if (!user) throw new Error("User didn't exist.")

        return res.render('users/edit', { user: user.toJSON() })
      })
      .catch(error => next(error))
  },
  putUser: (req, res, next) => {
    const loginUser = getUser(req)
    const { name } = req.body
    const { file } = req
    return Promise.all([
      User.findByPk(loginUser.id),
      imgurFileHandler(file)
    ])
      .then(([user, filePath]) => {
        if (!user) throw new Error("User didn't exist.")

        return user.update({
          name,
          image: filePath || user.image
        })
      })
      .then(() => {
        req.flash('success_messages', '使用者資料編輯成功')
        return res.redirect(`/users/${loginUser.id}`)
      })
      .catch(error => next(error))
  },
  addFavorite: (req, res, next) => {
    const { restaurantId } = req.params
    const loginUserId = getUser(req).id
    return Promise.all([
      Restaurant.findByPk(restaurantId, {
        attributes: ['id']
      }),
      Favorite.findOne({
        where: { userId: loginUserId, restaurantId }
      })
    ])
      .then(([restaurant, favorite]) => {
        if (!restaurant) throw new Error("Restaurant didn't exist.")
        if (favorite) throw new Error('You have favorite this restaurant')

        return Favorite.create({ userId: loginUserId, restaurantId })
      })
      .then(() => res.redirect('back'))
      .catch(error => next(error))
  },
  removeFavorite: (req, res, next) => {
    const loginUserId = getUser(req).id
    const { restaurantId } = req.params
    return Favorite.findOne({
      where: { userId: loginUserId, restaurantId }
    })
      .then(favorite => {
        if (!favorite) throw new Error("You haven't favorite this restaurant.")

        return favorite.destroy()
      })
      .then(() => res.redirect('back'))
      .catch(error => next(error))
  },
  addLike: (req, res, next) => {
    const { restaurantId } = req.params
    const loginUserId = getUser(req).id
    return Promise.all([
      Restaurant.findByPk(restaurantId, {
        attributes: ['id']
      }),
      Like.findOne({
        where: { userId: loginUserId, restaurantId }
      })
    ])
      .then(([restaurant, like]) => {
        if (!restaurant) throw new Error("Restaurant didn't exist.")
        if (like) throw new Error('You already liked this restaurant')

        return Like.create({ userId: loginUserId, restaurantId })
      })
      .then(() => res.redirect('back'))
      .catch(error => next(error))
  },
  removeLike: (req, res, next) => {
    const { restaurantId } = req.params
    const loginUserId = getUser(req).id
    return Like.findOne({
      where: { userId: loginUserId, restaurantId }
    })
      .then(like => {
        if (!like) throw new Error("You haven't liked this restaurant")

        return like.destroy()
      })
      .then(() => res.redirect('back'))
      .catch(error => next(error))
  },
  getTopUsers: (req, res, next) => {
    return User.findAll({
      include: [{ model: User, as: 'Followers' }],
      attributes: ['id', 'name', 'image', [sequelize.fn('COALESCE', sequelize.fn('COUNT', sequelize.col('Followers.id')), 0), 'followerCount']],
      group: ['User.id'],
      order: [['followerCount', 'DESC'], ['name', 'ASC']]
    })
      .then(users => {
        const loginUser = getUser(req)
        const result = users
          .map(user => ({
            ...user.toJSON(),
            isFollowed: loginUser.Followings.some(following => following.id === user.id),
            canFollowed: loginUser.id !== user.id
          }))
        return res.render('top-users', { users: result })
      })
      .catch(error => next(error))
  },
  addFollowing: (req, res, next) => {
    const loginUserId = getUser(req).id
    const { userId } = req.params
    return Promise.all([
      User.findByPk(userId, { attributes: ['id'] }),
      Followship.findOne({
        where: {
          followerId: loginUserId,
          followingId: userId
        }
      })
    ])
      .then(([user, followship]) => {
        if (!user) throw new Error("User didn't exist.")
        if (followship) throw new Error('You are already following this user')

        return Followship.create({
          followerId: loginUserId,
          followingId: userId
        })
      })
      .then(() => res.redirect('back'))
      .catch(error => next(error))
  },
  removeFollowing: (req, res, next) => {
    const loginUserId = getUser(req).id
    const { userId } = req.params
    return Followship.findOne({
      where: {
        followerId: loginUserId,
        followingId: userId
      }
    })
      .then(followship => {
        if (!followship) throw new Error("You haven't followed this user.")

        return followship.destroy()
      })
      .then(() => res.redirect('back'))
      .catch(error => next(error))
  }
}

module.exports = userController
