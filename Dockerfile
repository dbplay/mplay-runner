FROM node:12

RUN  apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4

RUN  echo "deb http://repo.mongodb.org/apt/debian stretch/mongodb-org/4.0 main" | tee /etc/apt/sources.list.d/mongodb-org-4.0.list
RUN apt-get update
RUN apt-get install -y mongodb-org-shell

RUN mkdir /src
WORKDIR /src

COPY package.json /src/package.json
COPY package-lock.json /src/package-lock.json

RUN npm ci

COPY index.js /src/index.js

EXPOSE 3000
CMD [ "npm", "start" ]
 