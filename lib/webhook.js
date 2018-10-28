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

module.exports = async emitter => {
  let app = express()

  app.use(bodyp.json())

  // actual URL pinged by Trello.
  app.use(async (req, res, next) => {
    // debug('got', req.body)

    console.log(req.method, req.url)

    if (!req.body.action || req.method === 'HEAD') return res.status(200).send()
    if (req.url === '/v1/health') return next() // quick fix for health check

    const action = req.body.action
    const type = action.type

    logger.info('event', type, 'triggered')

    emitter.emit(type, action)

    return res.status(200).send()
  })

  app.get('/v1/health', (req, res) => {
    return res.status(200).send({
      message: 'healthy'
    })
  })

  app.listen(process.env.PORT || 3401, () => {
    logger.info('webhook is listening on port', process.env.PORT || 3401)
  })
}
