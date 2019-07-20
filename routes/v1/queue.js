// Queue API

'use strict'

const proto = require('triton-core/proto')
const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})

/**
 * @param {express.Application} app express app
 */
module.exports = async (app, opts) => {
  const { db, amqp } = opts
  const downloadProto = await proto.load('api.Download')

  // requeue media by id
  app.post('/:id', async (req, res) => {
    const id = req.params.id
    if (!id) {
      return res.error('Missing ID in path /:id.')
    }

    try {
      await db.updateStatus(id, 0)
      await db.setConverterStatus(id, 0)

      const obj = await db.getByID(id)
      const payload = {
        createdAt: new Date().toISOString(),
        media: obj
      }

      logger.info('creating new v1.download message for', id)
      const encoded = proto.encode(downloadProto, payload)
      await amqp.publish('v1.download', encoded)
      return res.success(obj)
    } catch (err) {
      logger.error('failed to requeue', err.message || err)
      logger.error(err.stack)

      if (err.code === 'ERRNOTFOUND') {
        return res.error('ID not found', 404)
      }

      return res.error('Failed to update media', 500)
    }
  })
}
