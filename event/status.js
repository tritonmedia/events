/**
 * Update the status of cards based off of various services.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1
 */

const Trello = require('trello')
const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})

/**
  * Parse status updates.
  *
  * @param  {Event.EventEmitter} emitter event emitter
  * @param  {Object} config              config
  * @param  {Object} tracer              tracer object
  * @return {Boolean}                    success
  */
module.exports = (emitter, config, tracer) => {
  const trello = new Trello(config.keys.trello.key, config.keys.trello.token)

  const labels = config.instance.labels
  const lists = config.instance.flow_ids

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
