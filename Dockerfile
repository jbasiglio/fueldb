FROM    centos:centos6

# Enable EPEL for Node.js
RUN     rpm -Uvh http://download.fedoraproject.org/pub/epel/6/i386/epel-release-6-8.noarch.rpm
# Install Node.js and npm
RUN     yum install -y npm

# Bundle app source
COPY . /opt/fueldb
# Install app dependencies
RUN cd /opt/fueldb; npm install

EXPOSE  8101
EXPOSE  8102
EXPOSE  8103
EXPOSE  8104

CMD ["node", "/opt/fueldb/bin/server.js"]