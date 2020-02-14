FROM jaredallard/triton-base:latest

COPY --chown=999:999 package.json /stack
RUN yarn --production=true --frozen-lockfile

COPY --chown=999:999 . /stack
