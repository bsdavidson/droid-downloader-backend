FROM node:8-alpine

RUN npm install yarn -g

WORKDIR /opt
ADD ./package.json /opt/package.json
ADD ./yarn.lock /opt/yarn.lock
RUN yarn

ADD . /opt

CMD ["yarn", "start"]