const { Restaurant, Category, Comment, User, sequelize } = require('../models')
const { getOffset, getPagination } = require('../helpers/pagination-helper')
const { getUser } = require('../helpers/auth-helpers')

const restaurantController = {
  getRestaurants: (req, res, next) => {
    const loginUser = getUser(req)
    const DEFAULT_LIMIT = 9
    const categoryId = Number(req.query.categoryId) || ''
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || DEFAULT_LIMIT
    const offset = getOffset(limit, page)
    return Promise.all([
      Restaurant.findAndCountAll({
        include: Category,
        where: {
          ...categoryId ? { categoryId } : {}
        },
        limit,
        offset,
        nest: true,
        raw: true
      }),
      Category.findAll({ raw: true })
    ])
      .then(([restaurants, categories]) => {
        if (!restaurants.rows.length) throw new Error("Restaurant didn't exist.")
        if (!categories.length) throw new Error("Category didn't exist.")

        const favoritedRestaurantsId = loginUser && loginUser.FavoritedRestaurants
          .map(favorite => favorite.id)
        const likedRestaurantId = loginUser && loginUser.LikedRestaurants
          .map(like => like.id)
        const data = restaurants.rows.map(restaurant => ({
          ...restaurant,
          description: restaurant.description.substring(0, 50),
          isFavorited: favoritedRestaurantsId.includes(restaurant.id),
          isLiked: likedRestaurantId.includes(restaurant.id)
        }))
        return res.render('restaurants', {
          restaurants: data,
          categories,
          categoryId,
          pagination: getPagination(limit, page, restaurants.count)
        })
      })
      .catch(error => next(error))
  },
  getRestaurant: (req, res, next) => {
    const loginUserId = getUser(req).id
    const id = req.params.id
    return Restaurant.findByPk(id, {
      include: [
        { model: Category, attributes: ['name'] },
        { model: Comment, include: { model: User, attributes: ['id', 'name'] } },
        { model: User, as: 'FavoritedUsers', attributes: ['id'] },
        { model: User, as: 'LikedUsers', attributes: ['id'] }
      ],
      order: [[Comment, 'createdAt', 'DESC']]
    })
      .then(restaurant => {
        if (!restaurant) throw new Error("Restaurant didn't exist.")

        return restaurant.increment('view_counts')
      })
      .then(restaurant => {
        const isFavorited = restaurant.FavoritedUsers.some(favorite => favorite.id === loginUserId)
        const isLiked = restaurant.LikedUsers.some(like => like.id === loginUserId)
        return res.render('restaurant', {
          restaurant: restaurant.toJSON(),
          isFavorited,
          isLiked
        })
      })
      .catch(error => next(error))
  },
  getDashboard: (req, res, next) => {
    const id = req.params.id
    return Restaurant.findByPk(id, {
      include: [
        { model: Category, attributes: ['id', 'name'] },
        { model: Comment, attributes: ['id'] },
        { model: User, as: 'FavoritedUsers', attributes: ['id'] }
      ]
    })
      .then(restaurant => {
        if (!restaurant) throw new Error("Restaurant didn't exits")

        return res.render('dashboard', { restaurant: restaurant.toJSON() })
      })
      .catch(error => next(error))
  },
  getFeeds: (req, res, next) => {
    return Promise.all([
      Restaurant.findAll({
        limit: 10,
        order: [['createdAt', 'DESC']],
        include: { model: Category, attributes: ['name'] },
        raw: true,
        nest: true
      }),
      Comment.findAll({
        limit: 10,
        order: [['createdAt', 'DESC']],
        include: [
          { model: User, attributes: ['id', 'name'] },
          { model: Restaurant, attributes: ['id', 'name'] }
        ],
        raw: true,
        nest: true
      })
    ])
      .then(([restaurants, comments]) => {
        return res.render('feeds', { restaurants, comments })
      })
      .catch(error => next(error))
  },
  getTopRestaurants: (req, res, next) => {
    const loginUser = getUser(req)
    return Restaurant.findAll({
      include: [{ model: User, as: 'FavoritedUsers', attributes: ['id'] }],
      attributes: {
        include: [[sequelize.fn('COUNT', sequelize.col('FavoritedUsers.id')), 'favoritedCount']]
      },
      group: ['Restaurant.id'],
      order: [['favoritedCount', 'DESC']]
    })
      .then(restaurants => {
        const result = restaurants
          .map(restaurant => ({
            ...restaurant.toJSON(),
            description: restaurant.description.substring(0, 50),
            isFavorited: loginUser && loginUser.FavoritedRestaurants.some(favorite => favorite.id === restaurant.id)
          }))
          .slice(0, 10)
        return res.render('top-restaurants', { restaurants: result })
      })
      .catch(error => next(error))
  }
}

module.exports = restaurantController
