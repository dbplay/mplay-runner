FROM node:12

RUN  apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4

RUN  echo "deb http://repo.mongodb.org/apt/debian stretch/mongodb-org/4.0 main" | tee /etc/apt/sources.list.d/mongodb-org-4.0.list
RUN apt-get update
RUN apt-get install -y mongodb-org-shell

RUN mkdir -p /app
WORKDIR /app

COPY package.json /app/package.json
COPY package-lock.json /app/package-lock.json

RUN npm ci

COPY tsconfig.json /app/tsconfig.json
COPY src /app/src
RUN npm run build

EXPOSE 3000
CMD [ "npm", "start" ]
 