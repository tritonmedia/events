/**
 * Update the status of cards based off of various services.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1
 */

// const Trello = require('trello')
const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})
const Trello = require('trello')

const proto = require('triton-core/proto')
const AMQP = require('triton-core/amqp')
const dyn = require('triton-core/dynamics')
const Storage = require('triton-core/db')

/**
  * Parse status updates.
  *
  * @param  {Event.EventEmitter} emitter event emitter
  * @param  {Object} config              config
  * @param  {Object} tracer              tracer object
  * @return {Boolean}                    success
  */
module.exports = async (emitter, config, tracer) => {
  // amqp
  const amqp = new AMQP(dyn('rabbitmq'), 100)
  await amqp.connect()

  // proto
  const telemStatusProto = await proto.load('api.TelemetryStatus')

  // database
  const db = new Storage()
  await db.connect()

  const trello = new Trello(config.keys.trello.key, config.keys.trello.token)
  const lists = config.instance.flow_ids

  amqp.listen('v1.telemetry.status', async rmsg => {
    const msg = proto.decode(telemStatusProto, rmsg.message.content)
    const { mediaId, status } = msg

    logger.info(`processing status update for media ${mediaId}, status: ${status}`)

    await db.updateStatus(mediaId, status)

    if (process.env.NO_TRELLO) {
      return rmsg.ack()
    }

    let statusText
    switch (status) {
      case 0:
        statusText = 'QUEUED'
        break
      case 1:
        statusText = 'DOWNLOADING'
        break
      case 2:
        statusText = 'CONVERTING'
        break
      case 3:
        statusText = 'UPLOADING'
        break
      case 4:
        statusText = 'DEPLOYED'
        break
      case 5:
        statusText = 'ERRORED'
        break
    }

    const media = await db.getByID(mediaId)

    if (media.creator !== 0) {
      return logger.warn('skipping Trello update for non-trello media', mediaId)
    }

    const listPointer = lists[statusText.toLowerCase()]
    if (listPointer) {
      logger.info(`moving media card ${mediaId} (card id ${media.creatorId})`)
      await trello.makeRequest('put', `/1/cards/${media.creatorId}`, {
        idList: listPointer,
        pos: 2
      })
    } else {
      logger.warn('unable to find list for status', status)
    }

    rmsg.ack()
  })
}
