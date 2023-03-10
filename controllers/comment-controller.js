const { Comment, User, Restaurant } = require('../models')
const { getUser } = require('../helpers/auth-helpers')

const commentController = {
  postComment: (req, res, next) => {
    const { restaurantId, text } = req.body
    const loginUserId = getUser(req).id
    if (!text) throw new Error('Comment text is required.')

    return Promise.all([
      User.findByPk(loginUserId),
      Restaurant.findByPk(restaurantId)
    ])
      .then(([user, restaurant]) => {
        if (!user) throw new Error("User didn't exist.")
        if (!restaurant) throw new Error("Restaurant didn't exist.")

        return Comment.create({ text, restaurantId, userId: loginUserId })
      })
      .then(() => res.redirect(`/restaurants/${restaurantId}`))
      .catch(error => next(error))
  },
  deleteComment: (req, res, next) => {
    const { id } = req.params
    return Comment.findByPk(id)
      .then(comment => {
        if (!comment) throw new Error("Comment didn't exist.")

        return comment.destroy()
      })
      .then(deleteComment => res.redirect(`/restaurants/${deleteComment.restaurantId}`))
      .catch(error => next(error))
  }
}

module.exports = commentController
