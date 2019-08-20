// Media API

'use strict'

module.exports = async (app, opts) => {
  const { db } = opts

  /**
   * GET /:id - return the series object
   */
  app.get('/:id', async (req, res) => {
    let media
    try {
      media = await db.getSeries(req.params.id)
    } catch (err) {
      return res.error('Internal Server Error', 500)
    }

    if (media.length === 0) {
      return res.error('Not Found', 404)
    }

    return res.success(media)
  })

  /**
   * GET /:id/images - return a list of images for a series
   */
  app.get('/:id/images', async (req, res) => {
    let media
    try {
      media = await db.getSeriesImages(req.params.id)
    } catch (err) {
      return res.error('Internal Server Error', 500)
    }

    if (media.length === 0) {
      return res.error('Not Found', 404)
    }

    return res.success(media)
  })
}
