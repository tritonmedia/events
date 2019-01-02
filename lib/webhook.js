/**
 * Webhook spawned by Trello.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1
 */

const express = require('express')
const bodyp = require('body-parser')
const opentracing = require('triton-core/tracer').opentracing
const path = require('path')
const logger = require('pino')({
  name: path.basename(__filename)
})

/* eslint no-unused-vars: [0] */
const { Tags, Tracer } = opentracing
const { EventEmitter } = require('events')

/**
 * Generate a webhook
 * @param {EventEmitter} emitter - event emitter
 * @param {Tracer} tracer - opentracing tracer
 */
module.exports = async (emitter, tracer) => {
  let app = express()

  app.use(bodyp.json())

  // actual URL pinged by Trello.
  app.use(async (req, res, next) => {
    // debug('got', req.body)
    const parentSpanContext = tracer.extract(opentracing.FORMAT_HTTP_HEADERS, req.headers)
    const span = tracer.startSpan('http_request', {
      childOf: parentSpanContext
    })

    span.setTag(Tags.HTTP_URL, req.url)
    span.setTag(Tags.HTTP_METHOD, req.method)

    logger.debug(req.method, req.url)

    if (!req.body.action || req.method === 'HEAD') return res.status(200).send()
    if (req.url === '/v1/health') return next() // quick fix for health check

    const action = req.body.action
    const type = action.type

    logger.info('event', type, 'triggered')

    const traceContext = {}
    tracer.inject(span, opentracing.FORMAT_TEXT_MAP, traceContext)
    emitter.emit(type, action, JSON.stringify(traceContext))
    span.finish()

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
