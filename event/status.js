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

const proto = require('triton-core/proto')
const AMQP = require('triton-core/amqp')
const dyn = require('triton-core/dynamics')
const Storage = require('../lib/db')

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

  amqp.listen('v1.telemetry.status', async rmsg => {
    const msg = proto.decode(telemStatusProto, rmsg.message.content)

    logger.info(`processing status update for media ${msg.mediaId}, status: ${msg.status}`)

    await db.updateStatus(msg.mediaId, msg.status)

    if (process.env.NO_TRELLO) {
      return rmsg.ack()
    }

    // TODO: actually update the card here
    logger.info('updating trello card')

    rmsg.ack()
  })

  // const trello = new Trello(config.keys.trello.key, config.keys.trello.token)

  // const labels = config.instance.labels
  // const lists = config.instance.flow_ids

  // queue.process('status', 100, async container => {
  //   const data = container.data
  //   const cardId = data.id
  //   const status = data.status

  //   const child = logger.child({
  //     cardId,
  //     status
  //   })

  //   child.debug('status changed')

  //   const pointer = labels[status]
  //   if (pointer) {
  //     child.info('add label to card')
  //     await trello.makeRequest('post', `/1/cards/${cardId}/idLabels`, {
  //       value: pointer
  //     })
  //   }

  //   const listPointer = lists[status]
  //   if (listPointer) {
  //     child.debug('moving card to list')
  //     await trello.makeRequest('put', `/1/cards/${cardId}`, {
  //       idList: listPointer,
  //       pos: 2
  //     })
  //   }
  // })
}
