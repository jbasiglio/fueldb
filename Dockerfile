FROM    node:latest

# Bundle app source
COPY . /opt/fueldb

WORKDIR /opt/fueldb
# Install app dependencies
RUN npm install

EXPOSE  8101
EXPOSE  8102
EXPOSE  8103
EXPOSE  8104

CMD ["npm", "start"]