/**
 * Webhook spawned by Trello.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1
 */

const express = require('express')
const bodyp = require('body-parser')
const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})

const Config = require('triton-core/config')

module.exports = async (emitter, trelloEvents) => {
  let app = express()

  const config = await Config('events')

  app.use(bodyp.json())

  // actual URL pinged by Trello.
  app.use(async (req, res, next) => {
    // debug('got', req.body)

    if (!req.body.action || req.method === 'HEAD') return res.status(200).send()
    if (req.url === '/v1/health') return next() // quick fix for health check

    const action = req.body.action
    const type = action.type

    logger.info('event', type, 'triggered')
    if (trelloEvents[type]) {
      for (const event of trelloEvents[type]) {
        logger.debug('ran oneshot for event, type:', type)
        await event(req.body, config)
      }
    }

    emitter.emit(type, action)

    return res.status(200).send()
  })

  app.get('/v1/health', (req, res) => {
    return res.status(200).send({
      message: 'healthy'
    })
  })

  app.listen(3401, () => {
    logger.info('webhook is listening on port', 3401)
  })
}
