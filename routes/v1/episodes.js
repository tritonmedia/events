// Media API

'use strict'

module.exports = async (app, opts) => {
  const { db } = opts

  app.get('/:id', async (req, res) => {
    let media
    try {
      media = await db.listEpisodes(req.params.id)
    } catch (err) {
      return res.error('Internal Server Error', 500)
    }

    if (media.length === 0) {
      return res.error('Not Found', 404)
    }

    return res.success(media)
  })

  app.get('/:seriesid/files/:episodeid', async (req, res) => {
    let media
    try {
      media = await db.getEpisodeFiles(req.params.episodeid)
    } catch (err) {
      return res.error('Internal Server Error', 500)
    }

    if (media.length === 0) {
      return res.error('Not Found', 404)
    }

    return res.success(media)
  })
}
