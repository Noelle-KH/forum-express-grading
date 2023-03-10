const { Category } = require('../models')

const categoryController = {
  getCategories: (req, res, next) => {
    const { id } = req.params
    return Promise.all([
      Category.findAll({ raw: true }),
      id ? Category.findByPk(id, { raw: true }) : null
    ])
      .then(([categories, category]) => {
        return res.render('admin/categories', { categories, category })
      })
      .catch(error => next(error))
  },
  postCategory: (req, res, next) => {
    const { name } = req.body
    if (!name) throw new Error('Category name is required.')

    return Category.create({ name })
      .then(() => res.redirect('/admin/categories'))
      .catch(error => next(error))
  },
  putCategory: (req, res, next) => {
    const { id } = req.params
    const { name } = req.body
    if (!name) throw new Error('Category name is required.')

    return Category.findByPk(id)
      .then(category => {
        if (!category) throw new Error("Category didn't exist.")
        return category.update({ name })
      })
      .then(() => res.redirect('/admin/categories'))
      .catch(error => next(error))
  },
  deleteCategory: (req, res, next) => {
    const { id } = req.params
    return Category.findByPk(id)
      .then(category => {
        if (!category) throw new Error("Category didn't exist.")

        return category.destroy()
      })
      .then(() => res.redirect('/admin/categories'))
      .catch(error => next(error))
  }
}

module.exports = categoryController
