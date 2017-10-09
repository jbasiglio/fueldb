FROM node:8.6.0

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Bundle app source
COPY . /usr/src/app

# Install app dependencies
RUN npm --no-color install -q --production

EXPOSE 0-65535

CMD ["node", "server.js"]