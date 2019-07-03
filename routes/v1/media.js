// Media API

'use strict'

const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})

module.exports = async (app, opts) => {
  const { db } = opts

  // get media by id
  app.get('/:id', async (req, res) => {
    try {
      const { id } = req.params
      if (!id) {
        return res.status(400).send({
          success: false,
          message: 'Missing ID.'
        })
      }

      const obj = await db.getByID(req.params['id'])
      return res.send(obj)
    } catch (err) {
      logger.error('failed to get media', err.message || err)
      logger.error(err.stack)

      if (err.code === 'ERRNOTFOUND') {
        return res.status(404).send({
          success: false,
          message: 'ID not found'
        })
      }

      return res.status(400).send({
        success: false,
        message: 'Failed to get media'
      })
    }
  })
}
