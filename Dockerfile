FROM node:8-alpine

RUN npm install yarn -g && \
  apk update && \
  apk add make gcc g++ python
RUN apk add vips-dev fftw-dev --update-cache --repository https://dl-3.alpinelinux.org/alpine/edge/testing/

WORKDIR /opt
ADD ./package.json /opt/package.json
ADD ./yarn.lock /opt/yarn.lock
RUN yarn

ADD . /opt

CMD ["yarn", "start"]