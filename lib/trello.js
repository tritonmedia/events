/**
 * Converts Trello Webhooks into processable events.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1
 */

const _ = require('lodash')
const Trello = require('trello')
const path = require('path')

const logger = require('pino')({
  name: path.basename(__filename)
})

/**
 * Create a trello webhook proccessor if needed.
 * Then setup the webhook listener.
 *
 * @param {Object} auth  Authentication
 * @param {Object} opts   optional engine stuff.
 * @return {Promise} ...
 */
const init = async (auth, opts) => {
  const token = auth.token
  const key = auth.key

  const trello = new Trello(key, token)

  // eval a short ID to a long ID, who care's if it's not one, just one HTTP call.
  const board = await trello.makeRequest('get', `/1/boards/${opts.board}`)

  logger.info('trello board id is', board.id)
  opts.board = board.id

  // bail out of registering the webhook, but still run it
  // i.e for local development
  if (process.env.NO_WEBHOOK) {
    logger.info('skipping webhook registration due to process.env.NO_WEBHOOK being set')
    return
  }

  // fetch webhooks
  const webhooks = await trello.makeRequest('get', `/1/tokens/${token}/webhooks`)
  const similarWebhooks = _.find(webhooks, {
    idModel: opts.board,
    active: true
  })

  if (similarWebhooks) {
    logger.warn('found an existing webhook, cleaning it up:', similarWebhooks.id)
    trello.deleteWebhook(similarWebhooks.id)
  }

  const webhook = await trello.addWebhook('Polls for updates on the media board.', opts.callbackUrl, opts.board)
  if (typeof webhook !== 'object') {
    logger.error('Failed to create webhook', webhook)

    // Recursive function to ensure that we create the webhook
    return new Promise(resolve => {
      logger.info('going to retry in 5s')
      setTimeout(async () => {
        await init(auth, opts)

        return resolve()
      }, 5000)
    })
  }

  logger.info('created a webhook')
}

module.exports = init
